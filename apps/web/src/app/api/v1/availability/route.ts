import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, hasScope } from "@/lib/api-auth"

const CAL_COM_BASE = process.env.CALCOM_API_URL ?? "https://api.cal.com/v2"
const CAL_COM_KEY = process.env.CALCOM_API_KEY ?? ""

/**
 * GET /api/v1/availability
 *
 * Consulta disponibilidad de slots.
 * Requiere scope: bookings:read
 *
 * Query params:
 *   - eventTypeId: number (requerido)
 *   - startTime: ISO date string (requerido)
 *   - endTime: ISO date string (requerido)
 *   - timezone: string (opcional, default America/Bogota)
 */
export async function GET(req: NextRequest) {
  // 1. Autenticación
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  // 2. Verificar scope
  if (!hasScope(auth.scopes, "bookings:read")) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Scope 'bookings:read' required",
      },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const eventTypeId = searchParams.get("eventTypeId")
  const startTime = searchParams.get("startTime")
  const endTime = searchParams.get("endTime")
  const timezone = searchParams.get("timezone") ?? "America/Bogota"

  // 3. Validación de parámetros
  if (!eventTypeId || !startTime || !endTime) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "eventTypeId, startTime and endTime are required",
      },
      { status: 400 }
    )
  }

  const eventTypeIdNum = parseInt(eventTypeId, 10)
  if (isNaN(eventTypeIdNum) || eventTypeIdNum <= 0) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "eventTypeId must be a positive integer",
      },
      { status: 400 }
    )
  }

  // 4. Verificar que el eventTypeId pertenece al restaurante de la API key
  // (Seguridad: evitar acceso cross-tenant)
  const { prisma } = await import("@/lib/prisma")
  const tableType = await prisma.tableType.findFirst({
    where: {
      calcomEventId: eventTypeIdNum,
      branch: { restaurantId: auth.restaurantId },
    },
    select: { id: true },
  })

  if (!tableType) {
    return NextResponse.json(
      {
        error: "not_found",
        message: "eventTypeId not found or does not belong to your restaurant",
      },
      { status: 404 }
    )
  }

  // 5. Proxy a Cal.com
  try {
    const calUrl = new URL(`${CAL_COM_BASE}/slots/available`)
    calUrl.searchParams.set("eventTypeId", eventTypeId)
    calUrl.searchParams.set("startTime", startTime)
    calUrl.searchParams.set("endTime", endTime)
    calUrl.searchParams.set("timeZone", timezone)

    const calResponse = await fetch(calUrl.toString(), {
      headers: {
        Authorization: `Bearer ${CAL_COM_KEY}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 }, // cache 60s en edge
    })

    if (!calResponse.ok) {
      const error = await calResponse.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: "upstream_error",
          message: "Error fetching availability from Cal.com",
          detail: error,
        },
        { status: 502 }
      )
    }

    const data = await calResponse.json()

    return NextResponse.json({
      status: "success",
      data: data.slots ?? data,
    })
  } catch (err) {
    console.error("[API v1] /availability error:", err)
    return NextResponse.json(
      { error: "internal_error", message: "Internal server error" },
      { status: 500 }
    )
  }
}
