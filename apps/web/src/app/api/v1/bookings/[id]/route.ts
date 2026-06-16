import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, hasScope } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { dispatchWebhookEvent } from "@/lib/webhook-queue"

const CAL_COM_BASE = process.env.CALCOM_API_URL ?? "https://api.cal.com/v2"
const CAL_COM_KEY = process.env.CALCOM_API_KEY ?? ""

type RouteParams = { params: Promise<{ id: string }> }

// ─── GET /api/v1/bookings/[id] ───────────────────────────────────────────────

/**
 * Obtiene los detalles de una reserva.
 * Requiere scope: bookings:read
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  if (!hasScope(auth.scopes, "bookings:read")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'bookings:read' required" },
      { status: 403 }
    )
  }

  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      branch: {
        select: {
          restaurantId: true,
          name: true,
          restaurant: { select: { name: true } },
        },
      },
      tableType: { select: { name: true } },
    },
  })

  if (!booking) {
    return NextResponse.json(
      { error: "not_found", message: "Booking not found" },
      { status: 404 }
    )
  }

  // Verificar ownership (el booking pertenece al restaurante de la API key)
  if (booking.branch.restaurantId !== auth.restaurantId) {
    return NextResponse.json(
      { error: "not_found", message: "Booking not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({
    status: "success",
    data: {
      id: booking.id,
      calcomUid: booking.calcomUid,
      status: booking.status,
      dateTime: booking.dateTime.toISOString(),
      partySize: booking.partySize,
      duration: booking.duration,
      specialRequests: booking.specialRequests,
      source: booking.source,
      customer: booking.customer,
      branch: booking.branch.name,
      restaurant: booking.branch.restaurant.name,
      tableType: booking.tableType.name,
      createdAt: booking.createdAt.toISOString(),
    },
  })
}

// ─── PUT /api/v1/bookings/[id] ───────────────────────────────────────────────

/**
 * Actualiza una reserva (fecha, partySize, notas).
 * Requiere scope: bookings:write
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  if (!hasScope(auth.scopes, "bookings:write")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'bookings:write' required" },
      { status: 403 }
    )
  }

  const { id } = await params

  // Verificar ownership
  const existing = await prisma.booking.findUnique({
    where: { id },
    include: {
      branch: { select: { restaurantId: true } },
    },
  })

  if (!existing) {
    return NextResponse.json(
      { error: "not_found", message: "Booking not found" },
      { status: 404 }
    )
  }

  if (existing.branch.restaurantId !== auth.restaurantId) {
    return NextResponse.json(
      { error: "not_found", message: "Booking not found" },
      { status: 404 }
    )
  }

  if (existing.status === "CANCELLED") {
    return NextResponse.json(
      { error: "conflict", message: "Cannot update a cancelled booking" },
      { status: 409 }
    )
  }

  let body: {
    startTime?: unknown
    partySize?: unknown
    specialRequests?: unknown
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 }
    )
  }

  const updates: {
    dateTime?: Date
    partySize?: number
    specialRequests?: string
  } = {}

  if (body.startTime) {
    const dt = new Date(body.startTime as string)
    if (isNaN(dt.getTime())) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid startTime format" },
        { status: 400 }
      )
    }
    updates.dateTime = dt

    // Actualizar en Cal.com si hay uid
    if (existing.calcomUid) {
      const calRes = await fetch(
        `${CAL_COM_BASE}/bookings/${existing.calcomUid}/reschedule`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CAL_COM_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start: dt.toISOString(),
            rescheduledBy: "api",
            reschedulingReason: "API reschedule",
          }),
        }
      )

      if (!calRes.ok) {
        const errBody = await calRes.json().catch(() => ({}))
        return NextResponse.json(
          {
            error: "upstream_error",
            message: "Error rescheduling in Cal.com",
            detail: errBody,
          },
          { status: 502 }
        )
      }
    }
  }

  if (body.partySize !== undefined) {
    const ps = Number(body.partySize)
    if (isNaN(ps) || ps < 1 || ps > 50) {
      return NextResponse.json(
        { error: "validation_error", message: "partySize must be between 1 and 50" },
        { status: 400 }
      )
    }
    updates.partySize = ps
  }

  if (body.specialRequests !== undefined) {
    updates.specialRequests = body.specialRequests as string
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: updates,
  })

  // Disparar webhook saliente
  await dispatchWebhookEvent(auth.restaurantId, "booking.updated", id, {
    bookingId: id,
    changes: updates,
    updatedAt: new Date().toISOString(),
  }).catch((err) => {
    console.error("[API v1/bookings/:id PUT] Webhook dispatch error:", err)
  })

  return NextResponse.json({
    status: "success",
    data: {
      id: updatedBooking.id,
      status: updatedBooking.status,
      dateTime: updatedBooking.dateTime.toISOString(),
      partySize: updatedBooking.partySize,
      specialRequests: updatedBooking.specialRequests,
      updatedAt: updatedBooking.updatedAt.toISOString(),
    },
  })
}

// ─── DELETE /api/v1/bookings/[id] ────────────────────────────────────────────

/**
 * Cancela una reserva.
 * Requiere scope: bookings:write
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  if (!hasScope(auth.scopes, "bookings:write")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'bookings:write' required" },
      { status: 403 }
    )
  }

  const { id } = await params

  const existing = await prisma.booking.findUnique({
    where: { id },
    include: { branch: { select: { restaurantId: true } } },
  })

  if (!existing) {
    return NextResponse.json(
      { error: "not_found", message: "Booking not found" },
      { status: 404 }
    )
  }

  if (existing.branch.restaurantId !== auth.restaurantId) {
    return NextResponse.json(
      { error: "not_found", message: "Booking not found" },
      { status: 404 }
    )
  }

  if (existing.status === "CANCELLED") {
    return NextResponse.json(
      { error: "conflict", message: "Booking is already cancelled" },
      { status: 409 }
    )
  }

  // Obtener razón de cancelación del body (opcional)
  let cancellationReason: string | undefined
  try {
    const body = await req.json()
    cancellationReason = body.reason as string | undefined
  } catch {
    // Body opcional
  }

  // Cancelar en Cal.com si hay uid
  if (existing.calcomUid) {
    const calRes = await fetch(
      `${CAL_COM_BASE}/bookings/${existing.calcomUid}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CAL_COM_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancellationReason: cancellationReason ?? "Cancelled via API",
          allRemainingBookings: false,
        }),
      }
    )

    if (!calRes.ok) {
      const errBody = await calRes.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: "upstream_error",
          message: "Error cancelling in Cal.com",
          detail: errBody,
        },
        { status: 502 }
      )
    }
  }

  // Actualizar estado en BD local
  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  })

  // Disparar webhook saliente
  await dispatchWebhookEvent(auth.restaurantId, "booking.cancelled", id, {
    bookingId: id,
    cancellationReason: cancellationReason ?? "Cancelled via API",
    cancelledAt: new Date().toISOString(),
  }).catch((err) => {
    console.error("[API v1/bookings/:id DELETE] Webhook dispatch error:", err)
  })

  return new NextResponse(null, { status: 204 })
}
