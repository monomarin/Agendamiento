import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * POST /api/dashboard/tables
 * Registers a new physical table in a zone.
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

  const { zoneId, tableTypeId, number, capacity, shape = "ROUND", x = 100, y = 100 } = body

  if (!zoneId || !tableTypeId || !number || !capacity) {
    return NextResponse.json(
      { error: "validation_error", message: "zoneId, tableTypeId, number and capacity are required" },
      { status: 400 }
    )
  }

  try {
    // Verify ownership of the zone
    const zone = await prisma.zone.findFirst({
      where: {
        id: zoneId,
        branch: { restaurantId: user.restaurantId },
      },
    })

    if (!zone) {
      return NextResponse.json({ error: "Zone not found or unauthorized" }, { status: 404 })
    }

    // Verify table type belongs to the same branch
    const tableType = await prisma.tableType.findFirst({
      where: {
        id: tableTypeId,
        branchId: zone.branchId,
      },
    })

    if (!tableType) {
      return NextResponse.json({ error: "Table type not found for this branch" }, { status: 404 })
    }

    const table = await prisma.table.create({
      data: {
        zoneId,
        tableTypeId,
        number: String(number).trim(),
        capacity: Number(capacity),
        shape: shape.toUpperCase(),
        x: Number(x),
        y: Number(y),
        status: "AVAILABLE",
      },
      include: {
        tableType: { select: { name: true } },
      },
    })

    return NextResponse.json({ status: "success", data: table }, { status: 201 })
  } catch (err) {
    console.error("[Dashboard Tables POST] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
