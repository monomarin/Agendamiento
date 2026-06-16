import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay } from "date-fns"

export const dynamic = "force-dynamic"

/**
 * GET /api/dashboard/zones
 * Returns zones, physical tables, today's bookings on tables, and table types for a branch.
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

  if (!branchId) {
    // Return all branches first to let the client select
    const branches = await prisma.branch.findMany({
      where: { restaurantId: user.restaurantId, isActive: true },
      select: { id: true, name: true },
    })
    return NextResponse.json({ status: "success", branches })
  }

  try {
    const today = new Date()
    const todayStart = startOfDay(today)
    const todayEnd = endOfDay(today)

    // Verify branch ownership
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, restaurantId: user.restaurantId },
    })

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    // Fetch zones with tables and today's bookings
    const zones = await prisma.zone.findMany({
      where: { branchId },
      include: {
        tables: {
          include: {
            tableType: { select: { name: true } },
            bookings: {
              where: {
                dateTime: { gte: todayStart, lte: todayEnd },
                status: { in: ["CONFIRMED", "CHECKED_IN"] },
              },
              include: {
                customer: { select: { name: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    })

    // Fetch available table types for the branch
    const tableTypes = await prisma.tableType.findMany({
      where: { branchId },
      select: { id: true, name: true, minCapacity: true, maxCapacity: true },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({
      status: "success",
      data: {
        zones,
        tableTypes,
      },
    })
  } catch (err) {
    console.error("[Dashboard Zones GET] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/zones
 * Creates a new zone.
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

  const { branchId, name, width = 800, height = 600 } = body

  if (!branchId || !name) {
    return NextResponse.json(
      { error: "validation_error", message: "branchId and name are required" },
      { status: 400 }
    )
  }

  try {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, restaurantId: user.restaurantId },
    })
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    const zone = await prisma.zone.create({
      data: {
        branchId,
        name: name.trim(),
        width: Number(width),
        height: Number(height),
      },
    })

    return NextResponse.json({ status: "success", data: zone }, { status: 201 })
  } catch (err) {
    console.error("[Dashboard Zones POST] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
