import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, hasScope } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/v1/customers
 *
 * Busca un cliente por email o por teléfono.
 * Requiere scope: customers:read o *
 */
export async function GET(req: NextRequest) {
  // 1. Autenticación
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  // 2. Verificar scope
  if (!hasScope(auth.scopes, "customers:read")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'customers:read' required" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")
  const phone = searchParams.get("phone")

  if (!email && !phone) {
    return NextResponse.json(
      { error: "validation_error", message: "email or phone query parameter is required" },
      { status: 400 }
    )
  }

  const whereClause: any = {}
  if (email) {
    whereClause.email = email.toLowerCase().trim()
  }
  if (phone) {
    whereClause.phone = phone.trim()
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: whereClause,
      include: {
        bookings: {
          where: {
            branch: { restaurantId: auth.restaurantId }
          },
          orderBy: { dateTime: "desc" },
          take: 10,
          select: {
            id: true,
            dateTime: true,
            partySize: true,
            status: true,
            specialRequests: true,
          }
        }
      }
    })

    if (!customer) {
      return NextResponse.json(
        { error: "not_found", message: "Customer not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      status: "success",
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: customer.notes,
        createdAt: customer.createdAt.toISOString(),
        recentBookings: customer.bookings.map((b) => ({
          id: b.id,
          dateTime: b.dateTime.toISOString(),
          partySize: b.partySize,
          status: b.status,
          specialRequests: b.specialRequests,
        })),
      },
    })
  } catch (err) {
    console.error("[API v1/customers GET] Error:", err)
    return NextResponse.json(
      { error: "internal_error", message: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/customers
 *
 * Registra o actualiza un cliente (CRM sync).
 * Requiere scope: customers:write o *
 */
export async function POST(req: NextRequest) {
  // 1. Autenticación
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  // 2. Verificar scope
  if (!hasScope(auth.scopes, "customers:write")) {
    return NextResponse.json(
      { error: "forbidden", message: "Scope 'customers:write' required" },
      { status: 403 }
    )
  }

  // 3. Parsear y validar body
  let body: {
    email?: unknown
    name?: unknown
    phone?: unknown
    notes?: unknown
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 }
    )
  }

  const { email, name, phone, notes } = body

  if (!email || typeof email !== "string" || !name || typeof name !== "string") {
    return NextResponse.json(
      { error: "validation_error", message: "email and name are required and must be strings" },
      { status: 400 }
    )
  }

  try {
    const customer = await prisma.customer.upsert({
      where: { email: email.toLowerCase().trim() },
      update: {
        name: name.trim(),
        ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        ...(notes !== undefined ? { notes: notes ? String(notes).trim() : null } : {}),
      },
      create: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        phone: phone ? String(phone).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
    })

    return NextResponse.json({
      status: "success",
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: customer.notes,
        createdAt: customer.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (err) {
    console.error("[API v1/customers POST] Error:", err)
    return NextResponse.json(
      { error: "internal_error", message: "Internal server error" },
      { status: 500 }
    )
  }
}
