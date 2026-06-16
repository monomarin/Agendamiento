import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PUT /api/dashboard/tables/[id]
 * Updates a physical table's details (coordinates, capacity, shape, zone, number, status).
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

  const { number, capacity, shape, x, y, status, zoneId, tableTypeId } = body

  try {
    // Verify ownership of the table
    const table = await prisma.table.findFirst({
      where: {
        id,
        zone: { branch: { restaurantId: user.restaurantId } },
      },
    })

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    const updateData: any = {}
    if (number !== undefined) updateData.number = String(number).trim()
    if (capacity !== undefined) updateData.capacity = Number(capacity)
    if (shape !== undefined) updateData.shape = shape.toUpperCase()
    if (x !== undefined) updateData.x = Number(x)
    if (y !== undefined) updateData.y = Number(y)
    if (status !== undefined) updateData.status = status.toUpperCase()

    if (zoneId) {
      // Verify zone belongs to the restaurant
      const targetZone = await prisma.zone.findFirst({
        where: { id: zoneId, branch: { restaurantId: user.restaurantId } },
      })
      if (!targetZone) {
        return NextResponse.json({ error: "Zone not found" }, { status: 404 })
      }
      updateData.zoneId = zoneId
    }

    if (tableTypeId) {
      // Verify tableType belongs to the branch
      const currentZone = zoneId
        ? await prisma.zone.findUnique({ where: { id: zoneId } })
        : await prisma.zone.findUnique({ where: { id: table.zoneId } })
      
      const targetTableType = await prisma.tableType.findFirst({
        where: { id: tableTypeId, branchId: currentZone?.branchId },
      })
      if (!targetTableType) {
        return NextResponse.json({ error: "Table type not found for this branch" }, { status: 404 })
      }
      updateData.tableTypeId = tableTypeId
    }

    const updatedTable = await prisma.table.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ status: "success", data: updatedTable })
  } catch (err) {
    console.error("[Dashboard Tables ID PUT] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/tables/[id]
 * Deletes a physical table.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
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
    // Verify ownership of the table
    const table = await prisma.table.findFirst({
      where: {
        id,
        zone: { branch: { restaurantId: user.restaurantId } },
      },
    })

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    await prisma.table.delete({
      where: { id },
    })

    return NextResponse.json({ status: "success", message: "Table deleted successfully" })
  } catch (err) {
    console.error("[Dashboard Tables ID DELETE] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
