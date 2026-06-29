import { NextResponse } from "next/server"
import { redis, getRatelimit } from "@/lib/redis"
import prisma from "@/lib/prisma"

// Rate limit: 5 bookings per IP per hour
const ratelimit = getRatelimit(5, "1 h", "bookings-ratelimit")

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/bookings
// Saga: Redis lock → Cal.com create → DB save → (Payment redirect if needed)
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // 1. Rate limiting by IP
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"
  const { success: rateLimitOk } = ratelimit ? await ratelimit.limit(ip) : { success: true }
  if (!rateLimitOk) {
    return NextResponse.json(
      { message: "Demasiados intentos. Espera un momento antes de intentar de nuevo." },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 })
  }

  const { branchId, partySize, eventType, specialRequests, date, time, customer } = body

  // 2. Validate required fields
  if (!branchId || !date || !time || !customer?.email || !customer?.name) {
    return NextResponse.json(
      { message: "Faltan campos obligatorios" },
      { status: 400 }
    )
  }

  // 3. Optimistic Redis lock for the slot (prevents double-booking)
  const lockKey = `slot-lock:${branchId}:${date}:${time}`
  const lockValue = `${ip}-${Date.now()}`
  // Try to SET NX EX 30 seconds
  const lockAcquired = redis ? await redis.set(lockKey, lockValue, { nx: true, ex: 30 }) : true
  if (!lockAcquired) {
    return NextResponse.json(
      { message: "Este horario acaba de ser reservado. Por favor selecciona otro." },
      { status: 409 }
    )
  }

  try {
    // 4. Verify the branch exists and get payment settings
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        restaurant: {
          include: {
            paymentSettings: true,
          },
        },
        tableTypes: {
          where: {
            minCapacity: { lte: partySize === 1 ? 2 : partySize },
            maxCapacity: { gte: partySize },
          },
          take: 1,
        },
      },
    })

    if (!branch) {
      if (redis) await redis.del(lockKey)
      return NextResponse.json({ message: "Sede no encontrada" }, { status: 404 })
    }

    // 5. Upsert customer
    const dbCustomer = await prisma.customer.upsert({
      where: { email: customer.email.toLowerCase() },
      update: {
        name: customer.name,
        phone: customer.phone || undefined,
      },
      create: {
        email: customer.email.toLowerCase(),
        name: customer.name,
        phone: customer.phone || null,
      },
    })

    // 6. Save consent record (Habeas Data)
    if (customer.hasConsent) {
      await prisma.consentRecord.create({
        data: {
          clientEmail: customer.email.toLowerCase(),
          restaurantId: branch.restaurantId,
          policyVersion: "2026-06",
          ipAddress: ip,
        },
      })
    }

    // 7. Create Cal.com booking (if configured)
    const calcomApiUrl = process.env.CALCOM_API_URL
    const calcomApiKey = process.env.CALCOM_API_KEY
    let calcomBookingId: string | null = null
    let calcomUid: string | null = null
    let confirmationCode: string

    const tableType = branch.tableTypes[0]
    const timezone = branch.restaurant.timezone || "America/Bogota"
    const dateTime = parseLocalDateInTimezone(date, time, timezone)

    const isCalcomConfigured =
      calcomApiUrl &&
      calcomApiKey &&
      calcomApiKey !== "cal_api_key_placeholder" &&
      !calcomApiUrl.includes("localhost") &&
      !calcomApiUrl.includes("127.0.0.1") &&
      tableType?.calcomEventId

    if (isCalcomConfigured) {
      try {
        const calRes = await fetch(`${calcomApiUrl}/bookings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${calcomApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventTypeId: tableType.calcomEventId,
            start: dateTime.toISOString(),
            responses: {
              name: customer.name,
              email: customer.email,
              guests: partySize > 1 ? Array(partySize - 1).fill({ name: "Invitado" }) : [],
              notes: `${eventType}${specialRequests ? ` | ${specialRequests}` : ""}`,
            },
            timeZone: branch.restaurant.timezone || "America/Bogota",
            language: "es",
            metadata: {
              source: "web",
              partySize,
              eventType,
              specialRequests,
            },
          }),
        })

        if (calRes.ok) {
          const calData = await calRes.json()
          calcomBookingId = String(calData.data?.id || calData.id || "")
          calcomUid = calData.data?.uid || calData.uid || ""
          confirmationCode = (calcomUid || "").slice(0, 8).toUpperCase()
        } else {
          // Cal.com failed → release lock and return error
          if (redis) await redis.del(lockKey)
          return NextResponse.json(
            { message: "No se pudo crear la reserva en el sistema de calendarios. Intenta de nuevo." },
            { status: 502 }
          )
        }
      } catch (err) {
        if (redis) await redis.del(lockKey)
        return NextResponse.json(
          { message: "Error de conexión con el sistema de reservas." },
          { status: 502 }
        )
      }
    } else {
      // Dev/mock mode
      const mockId = Math.random().toString(36).slice(2, 10).toUpperCase()
      calcomBookingId = `MOCK-${mockId}`
      calcomUid = `mock-${mockId}`
      confirmationCode = mockId
    }

    // 8. Save booking to database
    const booking = await prisma.booking.create({
      data: {
        branchId,
        tableTypeId: tableType?.id || branch.tableTypes[0]?.id,
        customerId: dbCustomer.id,
        calcomBookingId,
        calcomUid,
        dateTime,
        partySize,
        duration: 90,
        specialRequests: `${eventType}${specialRequests ? ` | ${specialRequests}` : ""}`,
        source: "WEB",
        status: "CONFIRMED",
      },
    })

    // 9. Check if payment is required
    const paymentSettings = branch.restaurant.paymentSettings
    const requiresPayment = paymentSettings?.requireDeposit && paymentSettings?.stripeEnabled

    // 10. Release Redis lock (booking is created, slot is no longer "tentative")
    // We keep the lock briefly to prevent race conditions — it expires in 30s anyway
    // await redis.del(lockKey) — intentionally keep for 30s

    // 11. Invalidate availability cache for this slot
    if (redis) await redis.del(`availability:${branchId}:${date}:${partySize}`)

    if (requiresPayment && paymentSettings) {
      // Return payment required flag — client will redirect to gateway
      return NextResponse.json({
        success: true,
        bookingId: booking.id,
        confirmationCode,
        paymentRequired: true,
        paymentUrl: `/api/payment/create-session?bookingId=${booking.id}`,
      })
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      confirmationCode,
      paymentRequired: false,
    })
  } catch (error: any) {
    // Release lock on unexpected errors
    if (redis) await redis.del(lockKey)
    console.error("[Bookings API Error]:", error)
    return NextResponse.json(
      { message: error.message || "Error interno del servidor." },
      { status: 500 }
    )
  }
}

// GET /api/bookings?id={bookingId}
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true, branch: { include: { restaurant: true } } },
  })

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })
  }

  return NextResponse.json({
    id: booking.id,
    calcomUid: booking.calcomUid,
    status: booking.status,
    dateTime: booking.dateTime,
    partySize: booking.partySize,
    customer: {
      name: booking.customer.name,
      email: booking.customer.email,
      phone: booking.customer.phone,
    },
    restaurant: booking.branch.restaurant.name,
  })
}

function parseLocalDateInTimezone(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)
  
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute))
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  })
  
  const formattedParts = formatter.formatToParts(utcDate)
  const parts: Record<string, number> = {}
  for (const part of formattedParts) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value)
    }
  }
  
  const targetLocalTime = Date.UTC(year, month - 1, day, hour, minute)
  const actualLocalTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute
  )
  
  const diff = targetLocalTime - actualLocalTime
  return new Date(utcDate.getTime() + diff)
}
