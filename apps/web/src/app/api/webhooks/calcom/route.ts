import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { dispatchWebhookEvent, WebhookEvent } from "@/lib/webhook-queue"

// Pusher server-side (usamos la misma instancia del módulo 3)
import Pusher from "pusher"

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

/**
 * POST /api/webhooks/calcom
 *
 * Receptor de webhooks entrantes desde Cal.com.
 * - Verifica la firma HMAC-SHA256 del payload
 * - Actualiza el estado de la reserva en BD local
 * - Notifica al dashboard en tiempo real vía Pusher
 * - Dispara los webhooks salientes configurados por el restaurante
 */
export async function POST(req: NextRequest) {
  // 1. Leer el body como texto para verificar la firma ANTES de parsear
  const rawBody = await req.text()

  // 2. Verificar firma HMAC-SHA256 de Cal.com
  const signature = req.headers.get("x-cal-signature-256")
  const webhookSecret = process.env.CALCOM_WEBHOOK_SECRET

  if (webhookSecret && signature) {
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex")

    // Comparación en tiempo constante para evitar timing attacks
    const sigValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    )

    if (!sigValid) {
      console.warn("[Cal.com Webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let event: {
    triggerEvent?: string
    payload?: {
      uid?: string
      id?: number
      status?: string
      title?: string
      startTime?: string
      attendees?: Array<{ email?: string; name?: string }>
      metadata?: Record<string, unknown>
    }
  }

  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const triggerEvent = event.triggerEvent
  const payload = event.payload

  if (!triggerEvent || !payload) {
    return NextResponse.json({ error: "Missing triggerEvent or payload" }, { status: 400 })
  }

  const calcomUid = payload.uid ?? String(payload.id ?? "")

  if (!calcomUid) {
    return NextResponse.json({ error: "Missing booking uid" }, { status: 400 })
  }

  // 3. Buscar la reserva en BD local por calcomUid
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ calcomUid }, { calcomBookingId: String(payload.id ?? "") }],
    },
    include: {
      branch: {
        select: {
          restaurantId: true,
          restaurant: { select: { name: true, slug: true } },
        },
      },
      customer: { select: { name: true, email: true } },
    },
  })

  // Mapear el triggerEvent de Cal.com a nuestro BookingStatus y WebhookEvent
  const statusMap: Record<string, { status: string; webhookEvent: WebhookEvent }> = {
    BOOKING_CREATED: { status: "CONFIRMED", webhookEvent: "booking.created" },
    BOOKING_RESCHEDULED: { status: "CONFIRMED", webhookEvent: "booking.updated" },
    BOOKING_CANCELLED: { status: "CANCELLED", webhookEvent: "booking.cancelled" },
    BOOKING_PAYMENT_INITIATED: { status: "PENDING_PAYMENT", webhookEvent: "booking.updated" },
    BOOKING_PAID: { status: "CONFIRMED", webhookEvent: "booking.updated" },
    BOOKING_NO_SHOW_UPDATED: { status: "NO_SHOW", webhookEvent: "booking.no_show" },
  }

  const mapped = statusMap[triggerEvent]

  if (booking && mapped) {
    // 4. Actualizar estado en BD local
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: mapped.status as "CONFIRMED" | "CANCELLED" | "PENDING_PAYMENT" | "NO_SHOW" },
    })

    const restaurantId = booking.branch.restaurantId

    // 5. Notificar al dashboard en tiempo real vía Pusher
    try {
      await pusher.trigger(`private-restaurant-${restaurantId}`, "booking-update", {
        bookingId: booking.id,
        calcomUid,
        event: triggerEvent,
        status: mapped.status,
        dateTime: payload.startTime,
        customer: booking.customer,
        restaurantName: booking.branch.restaurant.name,
        timestamp: new Date().toISOString(),
      })
    } catch (pusherErr) {
      // No bloquear el flujo si Pusher falla
      console.error("[Cal.com Webhook] Pusher error:", pusherErr)
    }

    // 6. Disparar webhooks salientes del restaurante de forma asíncrona
    await dispatchWebhookEvent(restaurantId, mapped.webhookEvent, booking.id, {
      bookingId: booking.id,
      calcomUid,
      event: triggerEvent,
      status: mapped.status,
      dateTime: payload.startTime,
      partySize: booking.partySize,
      customer: {
        name: booking.customer.name,
        email: booking.customer.email,
      },
    }).catch((err) => {
      console.error("[Cal.com Webhook] Webhook dispatch error:", err)
    })
  }

  // Siempre responder 200 a Cal.com para evitar reintentos
  return NextResponse.json({ received: true })
}
