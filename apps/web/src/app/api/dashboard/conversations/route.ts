import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/dashboard/conversations
 * Lists all conversations for the user's restaurant.
 * Seeds mock conversations from existing bookings/customers if the database is empty.
 */
export async function GET(req: NextRequest) {
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

  try {
    let conversations = await prisma.conversation.findMany({
      where: { restaurantId: user.restaurantId },
      orderBy: { updatedAt: "desc" },
    })

    // If there are no conversations in the DB, let's create a couple of mock ones
    // based on real customer and booking data to populate the UI.
    if (conversations.length === 0) {
      const bookings = await prisma.booking.findMany({
        where: { branch: { restaurantId: user.restaurantId } },
        include: { customer: true },
        take: 3,
        orderBy: { createdAt: "desc" },
      })

      if (bookings.length > 0) {
        for (const booking of bookings) {
          const clientPhone = booking.customer.phone || `+57300${Math.floor(1000000 + Math.random() * 9000000)}`
          const mockMessages = [
            {
              role: "user",
              content: `Hola, me gustaría reservar una mesa para ${booking.partySize} personas por favor.`,
              timestamp: new Date(booking.createdAt.getTime() - 5 * 60 * 1000).toISOString(),
            },
            {
              role: "assistant",
              content: `¡Hola! Con gusto. Tengo disponibilidad para esa cantidad de personas. ¿En qué fecha y hora te gustaría reservar?`,
              timestamp: new Date(booking.createdAt.getTime() - 4 * 60 * 1000).toISOString(),
            },
            {
              role: "user",
              content: `Para el ${booking.dateTime.toLocaleDateString()} a las ${booking.dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
              timestamp: new Date(booking.createdAt.getTime() - 3 * 60 * 1000).toISOString(),
            },
            {
              role: "assistant",
              content: `¡Perfecto! Tu reserva ha sido confirmada con éxito. Código de reserva: ${(booking.calcomUid || "MOCK").slice(0, 8).toUpperCase()}. ¡Te esperamos!`,
              timestamp: booking.createdAt.toISOString(),
            },
          ]

          await prisma.conversation.create({
            data: {
              restaurantId: user.restaurantId,
              clientPhone,
              messages: mockMessages,
              bookingId: booking.id,
              status: "active",
            },
          })
        }

        // Re-query
        conversations = await prisma.conversation.findMany({
          where: { restaurantId: user.restaurantId },
          orderBy: { updatedAt: "desc" },
        })
      }
    }

    // Map phone numbers to names from Customer table
    const phones = conversations.map((c) => c.clientPhone)
    const customers = await prisma.customer.findMany({
      where: { phone: { in: phones } },
      select: { name: true, phone: true, email: true },
    })

    const customerMap = new Map(customers.map((c) => [c.phone, c]))

    const formattedConversations = conversations.map((conv) => {
      const customer = customerMap.get(conv.clientPhone)
      return {
        id: conv.id,
        restaurantId: conv.restaurantId,
        clientPhone: conv.clientPhone,
        messages: conv.messages,
        bookingId: conv.bookingId,
        status: conv.status,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        customer: customer || {
          name: "Cliente Anónimo",
          phone: conv.clientPhone,
          email: "",
        },
      }
    })

    return NextResponse.json({ status: "success", data: formattedConversations })
  } catch (err) {
    console.error("[Dashboard Conversations GET] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
