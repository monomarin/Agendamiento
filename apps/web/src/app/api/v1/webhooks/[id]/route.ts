import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * DELETE /api/v1/webhooks/[id]
 * Elimina un webhook saliente.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  return PATCH(req, { params })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true, role: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  const { id } = await params

  const webhook = await prisma.webhook.findUnique({
    where: { id },
    select: { restaurantId: true },
  })

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  if (webhook.restaurantId !== user.restaurantId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  let body: { url?: unknown; events?: unknown; isActive?: unknown }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const updates: { url?: string; events?: string[]; isActive?: boolean; status?: string; consecutiveFailures?: number } = {}

  if (body.url !== undefined) {
    if (typeof body.url !== "string") {
      return NextResponse.json({ error: "validation_error", message: "url must be a string" }, { status: 400 })
    }
    try {
      const parsed = new URL(body.url)
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
    } catch {
      return NextResponse.json(
        { error: "validation_error", message: "url must be a valid HTTP/HTTPS URL" },
        { status: 400 }
      )
    }
    updates.url = body.url
  }

  if (body.events !== undefined) {
    if (!Array.isArray(body.events)) {
      return NextResponse.json({ error: "validation_error", message: "events must be an array" }, { status: 400 })
    }
    const validEvents = [
      "booking.created",
      "booking.updated",
      "booking.cancelled",
      "booking.checked_in",
      "booking.no_show",
      "table.status_changed",
    ]
    for (const event of body.events) {
      if (!validEvents.includes(event)) {
        return NextResponse.json(
          { error: "validation_error", message: `Invalid event: ${event}` },
          { status: 400 }
        )
      }
    }
    updates.events = body.events as string[]
  }

  if (body.isActive !== undefined) {
    updates.isActive = Boolean(body.isActive)
    // Si se reactiva, resetear fallos y estado
    if (updates.isActive) {
      updates.status = "active"
      updates.consecutiveFailures = 0
    }
  }

  const updated = await prisma.webhook.update({
    where: { id },
    data: updates,
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      status: true,
      consecutiveFailures: true,
    },
  })

  return NextResponse.json({ status: "success", data: updated })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
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

  const { id } = await params

  const webhook = await prisma.webhook.findUnique({
    where: { id },
    select: { restaurantId: true },
  })

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  if (webhook.restaurantId !== user.restaurantId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  await prisma.webhook.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
