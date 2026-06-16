import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PUT /api/dashboard/zones/[id]
 * Updates zone details.
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

  const { name, width, height } = body

  try {
    // Verify ownership of the zone
    const zone = await prisma.zone.findFirst({
      where: {
        id,
        branch: { restaurantId: user.restaurantId },
      },
    })

    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 })
    }

    const updateData: any = {}
    if (name) updateData.name = name.trim()
    if (width !== undefined) updateData.width = Number(width)
    if (height !== undefined) updateData.height = Number(height)

    const updatedZone = await prisma.zone.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ status: "success", data: updatedZone })
  } catch (err) {
    console.error("[Dashboard Zones ID PUT] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/zones/[id]
 * Deletes a zone and its tables.
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
    // Verify ownership of the zone
    const zone = await prisma.zone.findFirst({
      where: {
        id,
        branch: { restaurantId: user.restaurantId },
      },
    })

    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 })
    }

    await prisma.zone.delete({
      where: { id },
    })

    return NextResponse.json({ status: "success", message: "Zone and all tables deleted successfully" })
  } catch (err) {
    console.error("[Dashboard Zones ID DELETE] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
