import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * DELETE /api/v1/integrations/pos/mappings/[id]
 * Elimina un mapeo de mesa del POS.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true, role: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  const { id } = await params

  const mapping = await prisma.posTableMapping.findUnique({
    where: { id },
  })

  if (!mapping) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 })
  }

  if (mapping.restaurantId !== user.restaurantId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  await prisma.posTableMapping.delete({
    where: { id },
  })

  return new NextResponse(null, { status: 204 })
}
