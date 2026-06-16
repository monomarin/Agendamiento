import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateApiKey } from "@/lib/api-key"

/**
 * GET /api/v1/keys
 * Lista las API Keys del restaurante autenticado (sin mostrar el hash).
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

  const apiKeys = await prisma.apiKey.findMany({
    where: { restaurantId: user.restaurantId },
    select: {
      id: true,
      name: true,
      scopes: true,
      isActive: true,
      environment: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ status: "success", data: apiKeys })
}

/**
 * POST /api/v1/keys
 * Crea una nueva API Key.
 * El rawKey se devuelve UNA SOLA VEZ al momento de creación.
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

  // Solo OWNER o MANAGER pueden crear API Keys
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  let body: {
    name?: unknown
    scopes?: unknown
    environment?: unknown
    expiresAt?: unknown
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, scopes, environment, expiresAt } = body

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "validation_error", message: "name is required" },
      { status: 400 }
    )
  }

  const allowedScopes = ["bookings:read", "bookings:write", "webhooks:read", "webhooks:write", "*"]
  const requestedScopes = Array.isArray(scopes) ? scopes as string[] : ["bookings:read"]

  for (const scope of requestedScopes) {
    if (!allowedScopes.includes(scope)) {
      return NextResponse.json(
        { error: "validation_error", message: `Invalid scope: ${scope}` },
        { status: 400 }
      )
    }
  }

  const env = environment === "test" ? "test" : "live"
  const { rawKey, keyHash } = generateApiKey(env)

  const apiKey = await prisma.apiKey.create({
    data: {
      restaurantId: user.restaurantId,
      keyHash,
      name: name.trim(),
      scopes: requestedScopes,
      environment: env,
      expiresAt: expiresAt ? new Date(expiresAt as string) : null,
      isActive: true,
    },
  })

  // Retornar el rawKey UNA SOLA VEZ (no se puede recuperar después)
  return NextResponse.json(
    {
      status: "success",
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey, // ← Solo se muestra aquí
        scopes: apiKey.scopes,
        environment: apiKey.environment,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      warning:
        "Store this API key securely. It will not be shown again.",
    },
    { status: 201 }
  )
}
