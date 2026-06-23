import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

// PUT /api/dashboard/restaurants — Update restaurant details
export async function PUT(req: Request) {
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
    const {
      name,
      description,
      logoUrl,
      bannerUrl,
      bannerOpacity,
      primaryColor,
      secondaryColor,
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ message: "El nombre es obligatorio" }, { status: 400 })
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: user.restaurantId },
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        logoUrl: logoUrl ? logoUrl.trim() : null,
        bannerUrl: bannerUrl ? bannerUrl.trim() : null,
        bannerOpacity: typeof bannerOpacity === "number" ? bannerOpacity : 0.15,
        primaryColor: primaryColor || "#dc2626",
        secondaryColor: secondaryColor || "#171717",
      },
    })

    return NextResponse.json(updatedRestaurant)
  } catch (error: any) {
    console.error("[Restaurant Update Error]:", error)
    return NextResponse.json({ message: error.message || "Error interno" }, { status: 500 })
  }
}
