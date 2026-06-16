import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, hasScope } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { dispatchWebhookEvent } from "@/lib/webhook-queue"

const CAL_COM_BASE = process.env.CALCOM_API_URL ?? "https://api.cal.com/v2"
const CAL_COM_KEY = process.env.CALCOM_API_KEY ?? ""

/**
 * POST /api/v1/bookings
 *
 * Crea una reserva desde la API pública.
 * Requiere scope: bookings:write
 *
 * Body:
 *   - eventTypeId: number
 *   - startTime: ISO datetime string
 *   - partySize: number
 *   - customer: { name, email, phone? }
 *   - specialRequests?: string
 *   - timezone?: string
 */
export async function POST(req: NextRequest) {
  // 1. Autenticación
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  // 2. Verificar scope
  if (!hasScope(auth.scopes, "bookings:write")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'bookings:write' required" },
      { status: 403 }
    )
  }

  // 3. Parsear y validar body
  let body: {
    eventTypeId?: unknown
    startTime?: unknown
    partySize?: unknown
    customer?: { name?: unknown; email?: unknown; phone?: unknown }
    specialRequests?: unknown
    timezone?: unknown
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 }
    )
  }

  const { eventTypeId, startTime, partySize, customer, specialRequests, timezone } = body

  if (
    !eventTypeId ||
    !startTime ||
    !partySize ||
    !customer?.email ||
    !customer?.name
  ) {
    return NextResponse.json(
      {
        error: "validation_error",
        message:
          "Required fields: eventTypeId, startTime, partySize, customer.name, customer.email",
      },
      { status: 400 }
    )
  }

  const eventTypeIdNum = Number(eventTypeId)
  const partySizeNum = Number(partySize)

  if (isNaN(eventTypeIdNum) || eventTypeIdNum <= 0) {
    return NextResponse.json(
      { error: "validation_error", message: "eventTypeId must be a positive integer" },
      { status: 400 }
    )
  }

  if (isNaN(partySizeNum) || partySizeNum < 1 || partySizeNum > 50) {
    return NextResponse.json(
      { error: "validation_error", message: "partySize must be between 1 and 50" },
      { status: 400 }
    )
  }

  const startDateTime = new Date(startTime as string)
  if (isNaN(startDateTime.getTime()) || startDateTime < new Date()) {
    return NextResponse.json(
      { error: "validation_error", message: "startTime must be a valid future ISO datetime" },
      { status: 400 }
    )
  }

  // 4. Verificar ownership del eventTypeId (seguridad cross-tenant)
  const tableType = await prisma.tableType.findFirst({
    where: {
      calcomEventId: eventTypeIdNum,
      branch: { restaurantId: auth.restaurantId },
    },
    include: {
      branch: {
        include: {
          restaurant: { select: { timezone: true } },
        },
      },
    },
  })

  if (!tableType) {
    return NextResponse.json(
      {
        error: "not_found",
        message: "eventTypeId not found or does not belong to your restaurant",
      },
      { status: 404 }
    )
  }

  // 5. Upsert customer
  const dbCustomer = await prisma.customer.upsert({
    where: { email: (customer.email as string).toLowerCase() },
    update: {
      name: customer.name as string,
      ...(customer.phone ? { phone: customer.phone as string } : {}),
    },
    create: {
      email: (customer.email as string).toLowerCase(),
      name: customer.name as string,
      phone: (customer.phone as string) ?? null,
    },
  })

  // 6. Crear booking en Cal.com
  const tz = (timezone as string) ?? tableType.branch.restaurant.timezone ?? "America/Bogota"

  const calRes = await fetch(`${CAL_COM_BASE}/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CAL_COM_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventTypeId: eventTypeIdNum,
      start: startDateTime.toISOString(),
      responses: {
        name: customer.name,
        email: customer.email,
      },
      timeZone: tz,
      language: "es",
      metadata: {
        source: "api",
        partySize: partySizeNum,
        specialRequests: specialRequests ?? "",
        restaurantId: auth.restaurantId,
        apiKeyId: auth.keyId,
      },
    }),
  })

  if (!calRes.ok) {
    const errBody = await calRes.json().catch(() => ({}))
    console.error("[API v1/bookings] Cal.com error:", errBody)
    return NextResponse.json(
      {
        error: "upstream_error",
        message: "Error creating booking in Cal.com",
        detail: errBody,
      },
      { status: 502 }
    )
  }

  const calData = await calRes.json()
  const calcomBookingId = String(calData.data?.id ?? calData.id ?? "")
  const calcomUid = calData.data?.uid ?? calData.uid ?? ""

  // 7. Persistir en BD local
  const booking = await prisma.booking.create({
    data: {
      branchId: tableType.branchId,
      tableTypeId: tableType.id,
      customerId: dbCustomer.id,
      calcomBookingId,
      calcomUid,
      dateTime: startDateTime,
      partySize: partySizeNum,
      duration: 90,
      specialRequests: specialRequests as string | undefined,
      source: "API",
      status: "CONFIRMED",
    },
  })

  // Registrar en CommunicationLog
  await prisma.communicationLog.create({
    data: {
      restaurantId: auth.restaurantId,
      customerId: dbCustomer.id,
      type: "api",
      direction: "inbound",
      content: `Reserva creada vía API pública (Código: ${(calcomUid || "").slice(0, 8).toUpperCase()}) para ${partySizeNum} personas.`,
      source: "api",
    },
  }).catch((err) => {
    console.error("[API v1/bookings] CommunicationLog error:", err)
  })

  // 8. Disparar webhook saliente de forma asíncrona
  await dispatchWebhookEvent(auth.restaurantId, "booking.created", booking.id, {
    bookingId: booking.id,
    calcomUid,
    eventTypeId: eventTypeIdNum,
    dateTime: startDateTime.toISOString(),
    partySize: partySizeNum,
    customer: {
      name: dbCustomer.name,
      email: dbCustomer.email,
      phone: dbCustomer.phone,
    },
    specialRequests: booking.specialRequests,
    source: "API",
  }).catch((err) => {
    console.error("[API v1/bookings] Webhook dispatch error:", err)
  })

  return NextResponse.json(
    {
      status: "success",
      data: {
        id: booking.id,
        calcomUid,
        calcomBookingId,
        dateTime: booking.dateTime.toISOString(),
        partySize: booking.partySize,
        status: booking.status,
        customer: {
          name: dbCustomer.name,
          email: dbCustomer.email,
        },
      },
    },
    { status: 201 }
  )
}

/**
 * GET /api/v1/bookings
 *
 * Lista las reservas del restaurante.
 * Requiere scope: bookings:read
 *
 * Query params:
 *   - date?: string (YYYY-MM-DD)
 *   - status?: string (CONFIRMED, CANCELLED, etc.)
 */
export async function GET(req: NextRequest) {
  // 1. Autenticación
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  // 2. Verificar scope
  if (!hasScope(auth.scopes, "bookings:read")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'bookings:read' required" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date")
  const statusStr = searchParams.get("status")

  const whereClause: any = {
    branch: { restaurantId: auth.restaurantId },
  }

  if (dateStr) {
    // Validar formato YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateStr)) {
      return NextResponse.json(
        { error: "validation_error", message: "date must be in YYYY-MM-DD format" },
        { status: 400 }
      )
    }
    const startDate = new Date(`${dateStr}T00:00:00.000Z`)
    const endDate = new Date(`${dateStr}T23:59:59.999Z`)
    
    whereClause.dateTime = {
      gte: startDate,
      lte: endDate,
    }
  }

  if (statusStr) {
    whereClause.status = statusStr.toUpperCase()
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        branch: { select: { name: true } },
        tableType: { select: { name: true } },
      },
      orderBy: { dateTime: "asc" },
    })

    return NextResponse.json({
      status: "success",
      data: bookings.map((b) => ({
        id: b.id,
        calcomUid: b.calcomUid,
        status: b.status,
        dateTime: b.dateTime.toISOString(),
        partySize: b.partySize,
        duration: b.duration,
        specialRequests: b.specialRequests,
        source: b.source,
        customer: b.customer,
        branch: b.branch.name,
        tableType: b.tableType.name,
        createdAt: b.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error("[API v1/bookings GET] Error:", err)
    return NextResponse.json(
      { error: "internal_error", message: "Internal server error" },
      { status: 500 }
    )
  }
}
