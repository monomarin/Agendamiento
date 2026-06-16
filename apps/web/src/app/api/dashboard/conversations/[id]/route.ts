import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PUT /api/dashboard/conversations/[id]
 * Updates conversation status (active, resolved, human).
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { status } = body

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 })
  }

  try {
    // Verify ownership
    const conv = await prisma.conversation.findFirst({
      where: { id, restaurantId: user.restaurantId },
    })

    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { status: status.toLowerCase() },
    })

    return NextResponse.json({ status: "success", data: updated })
  } catch (err) {
    console.error("[Dashboard Conversations ID PUT] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/conversations/[id]
 * Appends a new staff-composed message to the conversation log.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { content } = body

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required and must be a string" }, { status: 400 })
  }

  try {
    // Verify ownership
    const conv = await prisma.conversation.findFirst({
      where: { id, restaurantId: user.restaurantId },
    })

    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const messages = Array.isArray(conv.messages) ? [...conv.messages] : []
    const newMessage = {
      role: "assistant",
      content: content.trim(),
      timestamp: new Date().toISOString(),
      sender: "human", // demarcate this was sent by a human staff member
    }
    messages.push(newMessage)

    // Update conversation message log
    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        messages,
        status: "human", // auto-take control to human if staff is writing
      },
    })

    // Try to lookup customer by phone to record a proper communication log
    const customer = await prisma.customer.findFirst({
      where: { phone: conv.clientPhone },
      select: { id: true },
    })

    await prisma.communicationLog.create({
      data: {
        restaurantId: user.restaurantId,
        customerId: customer?.id || null,
        type: "whatsapp",
        direction: "outbound",
        content: content.trim(),
        source: "human",
      },
    }).catch(console.error)

    // Simulate sending message to WhatsApp API
    console.log(`[WhatsApp Simulation] Outbound message sent to ${conv.clientPhone}: "${content}"`)

    return NextResponse.json({ status: "success", data: updated })
  } catch (err) {
    console.error("[Dashboard Conversations ID POST] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
