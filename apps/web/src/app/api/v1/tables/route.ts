import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, hasScope } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/v1/tables
 *
 * Lista la configuración de todas las mesas del restaurante.
 * Requiere scope: tables:read o *
 */
export async function GET(req: NextRequest) {
  // 1. Autenticación
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  // 2. Verificar scope
  if (!hasScope(auth.scopes, "tables:read")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'tables:read' required" },
      { status: 403 }
    )
  }

  try {
    const tables = await prisma.table.findMany({
      where: {
        zone: {
          branch: {
            restaurantId: auth.restaurantId,
          },
        },
      },
      include: {
        tableType: { select: { name: true, minCapacity: true, maxCapacity: true } },
        zone: { select: { name: true, branch: { select: { name: true, id: true } } } },
      },
      orderBy: { number: "asc" },
    })

    return NextResponse.json({
      status: "success",
      data: tables.map((t) => ({
        id: t.id,
        number: t.number,
        capacity: t.capacity,
        shape: t.shape,
        status: t.status,
        tableType: t.tableType.name,
        zone: t.zone.name,
        branch: t.zone.branch.name,
        branchId: t.zone.branch.id,
      })),
    })
  } catch (err) {
    console.error("[API v1/tables GET] Error:", err)
    return NextResponse.json(
      { error: "internal_error", message: "Internal server error" },
      { status: 500 }
    )
  }
}
