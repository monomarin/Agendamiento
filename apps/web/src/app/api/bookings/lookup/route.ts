import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const code = searchParams.get("code")

  if (!id && !code) {
    return NextResponse.json({ error: "id or code is required" }, { status: 400 })
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: id ? { id } : { confirmationCode: code?.toUpperCase().trim() },
      include: {
        customer: true,
        branch: {
          select: {
            name: true,
            restaurant: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        },
        tableType: { select: { name: true } },
        tables: { select: { id: true, number: true } }
      }
    })

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })
    }

    return NextResponse.json({
      status: "success",
      data: {
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        dateTime: booking.dateTime,
        partySize: booking.partySize,
        specialRequests: booking.specialRequests,
        status: booking.status,
        customer: {
          name: booking.customer.name,
          email: booking.customer.email,
          phone: booking.customer.phone,
        },
        branchName: booking.branch.name,
        restaurantName: booking.branch.restaurant.name,
        restaurantSlug: booking.branch.restaurant.slug,
        tableTypeName: booking.tableType.name,
        tables: booking.tables,
      }
    })
  } catch (err) {
    console.error("[Booking Lookup API Error]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
