import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

// POST /api/dashboard/branches — Create a new branch
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { restaurantId: true },
    })

    if (!user?.restaurantId) {
      return NextResponse.json({ message: "Restaurante no encontrado" }, { status: 404 })
    }

    const body = await req.json()
    const { name, address, phone } = body

    if (!name || !address) {
      return NextResponse.json({ message: "Nombre y dirección son obligatorios" }, { status: 400 })
    }

    const branch = await prisma.branch.create({
      data: {
        restaurantId: user.restaurantId,
        name,
        address,
        phone: phone || null,
        isActive: true,
      },
    })

    return NextResponse.json(branch)
  } catch (error: any) {
    console.error("[Branch Create Error]:", error)
    return NextResponse.json({ message: error.message || "Error interno" }, { status: 500 })
  }
}

// GET /api/dashboard/branches — List all branches for the user's restaurant
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { restaurantId: true },
    })

    if (!user?.restaurantId) {
      return NextResponse.json({ message: "Restaurante no encontrado" }, { status: 404 })
    }

    const branches = await prisma.branch.findMany({
      where: { restaurantId: user.restaurantId },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(branches)
  } catch (error: any) {
    console.error("[Branch List Error]:", error)
    return NextResponse.json({ message: error.message || "Error interno" }, { status: 500 })
  }
}
