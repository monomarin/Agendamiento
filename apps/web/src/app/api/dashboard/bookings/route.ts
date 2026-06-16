import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay } from "date-fns"

export const dynamic = "force-dynamic"

/**
 * GET /api/dashboard/bookings
 * Lists all bookings for the authenticated user's restaurant with optional filters.
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
  const branchId = searchParams.get("branchId")
  const dateStr = searchParams.get("date") // YYYY-MM-DD
  const status = searchParams.get("status") // CONFIRMED, CHECKED_IN, etc.
  const search = searchParams.get("search") // customer name, email, phone

  const whereClause: any = {
    branch: { restaurantId: user.restaurantId },
  }

  if (branchId) {
    whereClause.branchId = branchId
  }

  if (dateStr) {
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`)
    whereClause.dateTime = {
      gte: startOfDay(targetDate),
      lte: endOfDay(targetDate),
    }
  }

  if (status) {
    whereClause.status = status.toUpperCase()
  }

  if (search) {
    whereClause.customer = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    }
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        customer: true,
        branch: { select: { id: true, name: true } },
        tableType: { select: { id: true, name: true, minCapacity: true, maxCapacity: true } },
        tables: { select: { id: true, number: true, shape: true, capacity: true } },
      },
      orderBy: { dateTime: "asc" },
    })

    return NextResponse.json({ status: "success", data: bookings })
  } catch (err) {
    console.error("[Dashboard Bookings GET] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/bookings
 * Manually creates a walk-in or manual reservation.
 */
export async function POST(req: NextRequest) {
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

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const {
    branchId,
    tableTypeId,
    dateTime,
    partySize,
    customer, // { name, email, phone }
    specialRequests,
    status = "CONFIRMED",
    tableId, // optional physical table to assign immediately
  } = body

  if (!branchId || !tableTypeId || !dateTime || !partySize || !customer?.name || !customer?.email) {
    return NextResponse.json(
      { error: "validation_error", message: "Missing required fields" },
      { status: 400 }
    )
  }

  try {
    // Verify branch belongs to user's restaurant
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, restaurantId: user.restaurantId },
    })
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    // Upsert customer
    const dbCustomer = await prisma.customer.upsert({
      where: { email: customer.email.toLowerCase().trim() },
      update: {
        name: customer.name.trim(),
        phone: customer.phone ? customer.phone.trim() : undefined,
      },
      create: {
        email: customer.email.toLowerCase().trim(),
        name: customer.name.trim(),
        phone: customer.phone ? customer.phone.trim() : null,
      },
    })

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        branchId,
        tableTypeId,
        customerId: dbCustomer.id,
        dateTime: new Date(dateTime),
        partySize: Number(partySize),
        specialRequests: specialRequests || null,
        source: "MANUAL",
        status: status.toUpperCase(),
        ...(tableId ? {
          tables: {
            connect: { id: tableId },
          },
        } : {}),
      },
      include: {
        customer: true,
        branch: { select: { name: true } },
        tableType: { select: { name: true } },
        tables: true,
      },
    })

    // Log communication
    await prisma.communicationLog.create({
      data: {
        restaurantId: user.restaurantId,
        customerId: dbCustomer.id,
        type: "system",
        direction: "outbound",
        content: `Reserva manual creada por el personal para ${partySize} personas el ${new Date(dateTime).toLocaleString()}.`,
        source: "system",
      },
    }).catch(console.error)

    return NextResponse.json({ status: "success", data: booking }, { status: 201 })
  } catch (err) {
    console.error("[Dashboard Bookings POST] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
