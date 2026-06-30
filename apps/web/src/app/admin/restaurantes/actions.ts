"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { RestaurantStatus } from "@prisma/client"

export async function updateRestaurantAction(
  restaurantId: string,
  data: {
    name: string
    slug: string
    type: string
    status: RestaurantStatus
    timezone: string
    plan: string
    primaryColor: string
    secondaryColor: string
    logoUrl?: string | null
    bannerUrl?: string | null
    bannerOpacity?: number
  }
) {
  const { userId } = await auth()
  if (!userId) throw new Error("No autenticado")

  // Verificar que el usuario actual sea SUPER_ADMIN
  const currentUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  })

  if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
    throw new Error("No autorizado. Se requieren permisos de Administrador.")
  }

  // Validar slug único
  const existingWithSlug = await prisma.restaurant.findFirst({
    where: {
      slug: data.slug,
      NOT: { id: restaurantId },
    },
  })

  if (existingWithSlug) {
    throw new Error("El slug ya está siendo utilizado por otro restaurante.")
  }

  // Actualizar restaurante
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: data.name,
      slug: data.slug.toLowerCase().trim().replace(/\s+/g, "-"),
      type: data.type,
      status: data.status,
      timezone: data.timezone,
      plan: data.plan,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      logoUrl: data.logoUrl || null,
      bannerUrl: data.bannerUrl || null,
      bannerOpacity: data.bannerOpacity ?? 0.15,
    },
  })

  revalidatePath("/admin")
  revalidatePath("/admin/restaurantes")
  revalidatePath(`/admin/restaurantes/${restaurantId}`)
}
