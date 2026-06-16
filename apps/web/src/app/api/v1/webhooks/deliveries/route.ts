import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/v1/webhooks/deliveries
 * Lista los logs de entrega de webhooks con filtros y paginación.
 * Accesible solo para usuarios autenticados del restaurante.
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
  const limitParam = searchParams.get("limit")
  const cursor = searchParams.get("cursor")
  const status = searchParams.get("status")
  const webhookId = searchParams.get("webhookId")
  const startDateStr = searchParams.get("startDate")
  const endDateStr = searchParams.get("endDate")

  const limit = Math.min(Math.max(parseInt(limitParam ?? "20", 10), 1), 100)

  // Construir condiciones del filtro
  const where: any = {
    webhook: {
      restaurantId: user.restaurantId,
    },
  }

  if (webhookId) {
    where.webhookId = webhookId
  }

  if (status === "success" || status === "failed") {
    where.status = status
  }

  if (startDateStr || endDateStr) {
    where.createdAt = {}
    if (startDateStr) {
      where.createdAt.gte = new Date(startDateStr)
    }
    if (endDateStr) {
      where.createdAt.lte = new Date(endDateStr)
    }
  }

  // Consulta Prisma con paginación basada en cursor
  const deliveries = await prisma.webhookDelivery.findMany({
    where,
    take: limit + 1, // Obtener uno más para determinar si hay página siguiente
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0, // Omitir el cursor si existe
    orderBy: { createdAt: "desc" },
    include: {
      webhook: {
        select: {
          url: true,
        },
      },
    },
  })

  let nextCursor: string | null = null
  if (deliveries.length > limit) {
    const nextItem = deliveries.pop()
    nextCursor = nextItem?.id ?? null
  }

  return NextResponse.json({
    status: "success",
    data: deliveries,
    pagination: {
      limit,
      nextCursor,
    },
  })
}
