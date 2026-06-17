import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { differenceInDays } from "date-fns"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/dashboard/customers/[id]
 * Retrieves full details for a customer, filtering booking history and communications for the user's restaurant.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
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

  try {
    // 1. Fetch customer with preferences, tags, bookings and communication logs for this restaurant
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        preferences: true,
        tags: true,
        bookings: {
          where: { branch: { restaurantId: user.restaurantId } },
          include: {
            branch: { select: { name: true } },
            tables: { select: { number: true } },
          },
          orderBy: { dateTime: "desc" },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // 2. Fetch communication logs
    const communications = await prisma.communicationLog.findMany({
      where: {
        restaurantId: user.restaurantId,
        customerId: id,
      },
      orderBy: { createdAt: "desc" },
    })

    // 3. Compute stats specifically for this restaurant
    const restaurantBookings = customer.bookings
    const validVisits = restaurantBookings.filter((b: any) => 
      ["CONFIRMED", "CHECKED_IN"].includes(b.status)
    )
    const totalVisits = validVisits.length

    const totalSpent = restaurantBookings
      .filter((b: any) => b.paymentStatus === "PAID" && b.paymentAmount)
      .reduce((sum: number, b: any) => sum + Number(b.paymentAmount || 0), 0)

    const avgPartySize = totalVisits > 0
      ? validVisits.reduce((sum: number, b: any) => sum + b.partySize, 0) / totalVisits
      : 0

    const visitDates = validVisits.map((b: any) => new Date(b.dateTime).getTime())
    const lastVisitTime = visitDates.length > 0 ? Math.max(...visitDates) : null
    const firstVisitTime = visitDates.length > 0 ? Math.min(...visitDates) : null

    // Determine segment dynamically
    let segment = "NEW"
    const now = new Date()
    const daysSinceLastVisit = lastVisitTime 
      ? differenceInDays(now, new Date(lastVisitTime))
      : Infinity

    if (totalVisits >= 10 || totalSpent >= 500000) {
      segment = "VIP"
    } else if (totalVisits >= 3) {
      segment = "REGULAR"
    } else if (totalVisits >= 1) {
      segment = "NEW"
    }

    if (segment === "REGULAR" && daysSinceLastVisit > 90) {
      segment = "AT_RISK"
    }
    if (daysSinceLastVisit > 180 && lastVisitTime !== null) {
      segment = "INACTIVE"
    }

    const stats = {
      totalVisits,
      totalSpent,
      avgPartySize: Number(avgPartySize.toFixed(1)),
      firstVisitAt: firstVisitTime ? new Date(firstVisitTime).toISOString() : null,
      lastVisitAt: lastVisitTime ? new Date(lastVisitTime).toISOString() : null,
      daysSinceLastVisit: lastVisitTime ? daysSinceLastVisit : null,
      segment,
    }

    return NextResponse.json({
      status: "success",
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes,
          createdAt: customer.createdAt,
        },
        preferences: customer.preferences,
        tags: customer.tags.map(t => t.name),
        bookings: restaurantBookings,
        communications,
        stats,
      },
    })
  } catch (err) {
    console.error("[Dashboard Customers ID GET] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/dashboard/customers/[id]
 * Updates customer details, internal notes, preferences, and tags.
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

  const { name, phone, notes, tags, preferences } = body

  try {
    // Verify customer exists and is associated with this restaurant
    const customerExists = await prisma.customer.findFirst({
      where: {
        id,
        bookings: { some: { branch: { restaurantId: user.restaurantId } } },
      },
    })

    if (!customerExists) {
      return NextResponse.json({ error: "Customer not found or unauthorized" }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null
    if (notes !== undefined) updateData.notes = notes

    // Handle tag relationships
    if (Array.isArray(tags)) {
      const tagConnections = []
      for (const tagName of tags) {
        const cleanedName = tagName.trim().toUpperCase()
        if (cleanedName) {
          const tag = await prisma.customerTag.upsert({
            where: { name: cleanedName },
            update: {},
            create: { name: cleanedName },
          })
          tagConnections.push({ id: tag.id })
        }
      }
      updateData.tags = {
        set: tagConnections,
      }
    }

    // Perform customer details update
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: updateData,
      include: { tags: true },
    })

    // Handle preferences update (delete and insert)
    if (Array.isArray(preferences)) {
      await prisma.$transaction([
        prisma.customerPreference.deleteMany({
          where: { customerId: id },
        }),
        prisma.customerPreference.createMany({
          data: preferences.map((p: { key: string; value: string }) => ({
            customerId: id,
            key: p.key.trim(),
            value: p.value.trim(),
          })),
        }),
      ])
    }

    return NextResponse.json({
      status: "success",
      data: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        notes: updatedCustomer.notes,
        tags: updatedCustomer.tags.map(t => t.name),
      },
    })
  } catch (err) {
    console.error("[Dashboard Customers ID PUT] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/customers/[id]
 * Deletes a customer and their associated data.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
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

  try {
    // Verify customer has at least one booking in this restaurant (ownership check)
    const customerExists = await prisma.customer.findFirst({
      where: {
        id,
        bookings: { some: { branch: { restaurantId: user.restaurantId } } },
      },
    })

    if (!customerExists) {
      return NextResponse.json({ error: "Customer not found or unauthorized" }, { status: 404 })
    }

    await prisma.customer.delete({ where: { id } })

    return NextResponse.json({ status: "success", message: "Cliente eliminado correctamente." })
  } catch (err) {
    console.error("[Dashboard Customers ID DELETE] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
