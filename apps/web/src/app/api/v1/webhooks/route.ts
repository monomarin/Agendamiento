import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

/**
 * GET /api/v1/webhooks
 * Lista los webhooks del restaurante.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  const webhooks = await prisma.webhook.findMany({
    where: { restaurantId: user.restaurantId },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      status: true,
      consecutiveFailures: true,
      createdAt: true,
      // Secret NO se devuelve en lista
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ status: "success", data: webhooks })
}

/**
 * POST /api/v1/webhooks
 * Registra un nuevo webhook saliente.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true, role: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  let body: { url?: unknown; events?: unknown; secret?: unknown }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { url, events, secret } = body

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "validation_error", message: "url is required" },
      { status: 400 }
    )
  }

  // Validar URL
  try {
    const parsed = new URL(url)
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
  } catch {
    return NextResponse.json(
      { error: "validation_error", message: "url must be a valid HTTP/HTTPS URL" },
      { status: 400 }
    )
  }

  const validEvents = [
    "booking.created",
    "booking.updated",
    "booking.cancelled",
    "booking.checked_in",
    "booking.no_show",
    "table.status_changed",
  ]

  const requestedEvents = Array.isArray(events) ? events as string[] : ["booking.created"]

  for (const event of requestedEvents) {
    if (!validEvents.includes(event)) {
      return NextResponse.json(
        { error: "validation_error", message: `Invalid event: ${event}` },
        { status: 400 }
      )
    }
  }

  // Generar secret si no se provee
  const webhookSecret =
    typeof secret === "string" && secret.length >= 16
      ? secret
      : crypto.randomBytes(32).toString("hex")

  const webhook = await prisma.webhook.create({
    data: {
      restaurantId: user.restaurantId,
      url: url.trim(),
      secret: webhookSecret,
      events: requestedEvents,
      isActive: true,
      status: "active",
    },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      status: true,
      createdAt: true,
    },
  })

  return NextResponse.json(
    {
      status: "success",
      data: {
        ...webhook,
        secret: webhookSecret, // Solo se muestra en creación
      },
      warning: "Store the webhook secret securely. It will not be shown again.",
    },
    { status: 201 }
  )
}
