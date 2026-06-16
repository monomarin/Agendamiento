import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { differenceInDays } from "date-fns"

export const dynamic = "force-dynamic"

/**
 * GET /api/dashboard/customers
 * Lists and searches customers who have booked at the authenticated user's restaurant.
 * Dynamically calculates visits, total spent, last visit, and CRM segment for each customer.
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

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") // search by name, email, phone
  const segmentFilter = searchParams.get("segment") // VIP, REGULAR, NEW, INACTIVE, etc.

  try {
    // 1. Build where clause to fetch customers who have booked at this restaurant
    const customerWhere: any = {
      bookings: {
        some: {
          branch: { restaurantId: user.restaurantId },
        },
      },
    }

    if (search) {
      customerWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    // 2. Query customers
    const customers = await prisma.customer.findMany({
      where: customerWhere,
      include: {
        tags: true,
        bookings: {
          where: {
            branch: { restaurantId: user.restaurantId },
          },
          select: {
            status: true,
            dateTime: true,
            paymentAmount: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    // 3. Process metrics and segments on the fly
    const now = new Date()
    const processedCustomers = customers.map((customer) => {
      const restaurantBookings = customer.bookings

      // Calculate visits (CONFIRMED or CHECKED_IN)
      const validVisits = restaurantBookings.filter((b: any) => 
        ["CONFIRMED", "CHECKED_IN"].includes(b.status)
      )
      const totalVisits = validVisits.length

      // Calculate total spent (deposits paid successfully)
      const totalSpent = restaurantBookings
        .filter((b: any) => b.paymentStatus === "PAID" && b.paymentAmount)
        .reduce((sum: number, b: any) => sum + Number(b.paymentAmount || 0), 0)

      // Calculate last visit date
      const visitDates = validVisits.map((b: any) => new Date(b.dateTime).getTime())
      const lastVisitTime = visitDates.length > 0 ? Math.max(...visitDates) : null
      const lastVisitAt = lastVisitTime ? new Date(lastVisitTime).toISOString() : null

      // Determine segment dynamically
      let segment = "NEW"
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

      // Check for at-risk
      if (segment === "REGULAR" && daysSinceLastVisit > 90) {
        segment = "AT_RISK"
      }
      // Check for inactive
      if (daysSinceLastVisit > 180 && lastVisitTime !== null) {
        segment = "INACTIVE"
      }

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: customer.notes,
        tags: customer.tags.map(t => t.name),
        totalVisits,
        totalSpent,
        lastVisitAt,
        segment,
      }
    })

    // 4. Apply segment filter if specified
    const filteredCustomers = segmentFilter
      ? processedCustomers.filter(c => c.segment === segmentFilter.toUpperCase())
      : processedCustomers

    return NextResponse.json({ status: "success", data: filteredCustomers })
  } catch (err) {
    console.error("[Dashboard Customers GET] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
