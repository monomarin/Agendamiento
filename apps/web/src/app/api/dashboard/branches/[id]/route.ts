import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

interface Params {
  params: Promise<{ id: string }>
}

// PUT /api/dashboard/branches/[id] — Update branch
export async function PUT(req: Request, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ message: "No autorizado" }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, address, phone, isActive } = body

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { restaurantId: true },
    })

    const branch = await prisma.branch.findUnique({ where: { id } })
    if (!branch || branch.restaurantId !== user?.restaurantId) {
      return NextResponse.json({ message: "Sede no encontrada" }, { status: 404 })
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("[Branch Update Error]:", error)
    return NextResponse.json({ message: error.message || "Error interno" }, { status: 500 })
  }
}

// DELETE /api/dashboard/branches/[id] — Delete branch
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ message: "No autorizado" }, { status: 401 })

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { restaurantId: true },
    })

    const branch = await prisma.branch.findUnique({ where: { id } })
    if (!branch || branch.restaurantId !== user?.restaurantId) {
      return NextResponse.json({ message: "Sede no encontrada" }, { status: 404 })
    }

    // Count remaining active branches
    const activeCount = await prisma.branch.count({
      where: { restaurantId: user.restaurantId, isActive: true },
    })
    if (activeCount <= 1) {
      return NextResponse.json(
        { message: "No puedes eliminar la única sede activa." },
        { status: 400 }
      )
    }

    await prisma.branch.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Branch Delete Error]:", error)
    return NextResponse.json({ message: error.message || "Error interno" }, { status: 500 })
  }
}
