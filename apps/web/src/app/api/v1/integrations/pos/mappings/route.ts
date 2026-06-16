import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/v1/integrations/pos/mappings
 * Lista todos los mapeos de mesa del restaurante.
 */
export async function GET() {
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

  const mappings = await prisma.posTableMapping.findMany({
    where: { restaurantId: user.restaurantId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ status: "success", data: mappings })
}

/**
 * POST /api/v1/integrations/pos/mappings
 * Crea o actualiza un mapeo de mesa física a número de mesa en el POS.
 */
export async function POST(req: NextRequest) {
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

  let body: { antigravityTableId?: unknown; posTableNumber?: unknown }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { antigravityTableId, posTableNumber } = body

  if (!antigravityTableId || typeof antigravityTableId !== "string" || !posTableNumber || typeof posTableNumber !== "string") {
    return NextResponse.json(
      { error: "validation_error", message: "antigravityTableId and posTableNumber are required strings" },
      { status: 400 }
    )
  }

  // Verificar que la mesa física exista y pertenezca al restaurante actual
  const table = await prisma.table.findUnique({
    where: { id: antigravityTableId },
    include: {
      zone: {
        include: {
          branch: true,
        },
      },
    },
  })

  if (!table || table.zone.branch.restaurantId !== user.restaurantId) {
    return NextResponse.json(
      { error: "table_not_found", message: "Table not found or doesn't belong to this restaurant" },
      { status: 404 }
    )
  }

  // Crear o actualizar (upsert lógico)
  const existing = await prisma.posTableMapping.findFirst({
    where: {
      restaurantId: user.restaurantId,
      antigravityTableId,
    },
  })

  let mapping
  if (existing) {
    mapping = await prisma.posTableMapping.update({
      where: { id: existing.id },
      data: {
        posTableNumber: posTableNumber.trim(),
      },
    })
  } else {
    mapping = await prisma.posTableMapping.create({
      data: {
        restaurantId: user.restaurantId,
        antigravityTableId,
        posTableNumber: posTableNumber.trim(),
      },
    })
  }

  return NextResponse.json({ status: "success", data: mapping }, { status: 201 })
}
