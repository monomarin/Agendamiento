import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, hasScope } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { dispatchWebhookEvent } from "@/lib/webhook-queue"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PUT /api/v1/tables/[id]
 *
 * Cambia el estado de una mesa (AVAILABLE/OCCUPIED/etc.).
 * Requiere scope: tables:write o *
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  // 1. Autenticación
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  // 2. Verificar scope
  if (!hasScope(auth.scopes, "tables:write")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'tables:write' required" },
      { status: 403 }
    )
  }

  const { id } = await params

  try {
    // 3. Verificar ownership de la mesa (seguridad cross-tenant)
    const table = await prisma.table.findUnique({
      where: { id },
      include: {
        zone: {
          include: {
            branch: { select: { restaurantId: true } }
          }
        }
      }
    })

    if (!table || table.zone.branch.restaurantId !== auth.restaurantId) {
      return NextResponse.json(
        { error: "not_found", message: "Table not found" },
        { status: 404 }
      )
    }

    // 4. Parsear body
    let body: { status?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    const { status } = body

    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { error: "validation_error", message: "status is required and must be a string" },
        { status: 400 }
      )
    }

    const uppercaseStatus = status.toUpperCase()
    const allowedStatuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"]

    if (!allowedStatuses.includes(uppercaseStatus)) {
      return NextResponse.json(
        { error: "validation_error", message: `status must be one of: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // 5. Actualizar estado en base de datos
    const updatedTable = await prisma.table.update({
      where: { id },
      data: { status: uppercaseStatus },
    })

    // 6. Disparar webhook saliente
    await dispatchWebhookEvent(auth.restaurantId, "table.status_changed", id, {
      tableId: id,
      number: table.number,
      status: uppercaseStatus,
      updatedAt: new Date().toISOString(),
    }).catch((err) => {
      console.error("[API v1/tables/[id] PUT] Webhook dispatch error:", err)
    })

    return NextResponse.json({
      status: "success",
      data: {
        id: updatedTable.id,
        number: updatedTable.number,
        status: updatedTable.status,
      },
    })
  } catch (err) {
    console.error("[API v1/tables/[id] PUT] Error:", err)
    return NextResponse.json(
      { error: "internal_error", message: "Internal server error" },
      { status: 500 }
    )
  }
}
