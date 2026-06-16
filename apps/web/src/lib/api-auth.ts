import { NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import { prisma } from "@/lib/prisma"
import { hashApiKey } from "@/lib/api-key"

// ─── Rate limiter: 60 req/min por API Key ────────────────────────────────────
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const freeLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 h"),
  prefix: "rl:api:v1:free",
})

const proLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, "1 h"),
  prefix: "rl:api:v1:pro",
})

export type ApiAuthResult =
  | { ok: true; restaurantId: string; scopes: string[]; keyId: string; environment: "live" | "test" }
  | { ok: false; response: NextResponse }

/**
 * Verifica la API Key enviada en el header `Authorization: Bearer <key>`
 * y aplica rate limiting por clave. Retorna el restaurantId y los scopes
 * autorizados si la autenticación es exitosa.
 */
export async function authenticateApiKey(
  req: NextRequest
): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "missing_auth", message: "Authorization header required" },
        { status: 401 }
      ),
    }
  }

  const rawKey = authHeader.slice(7).trim()

  if (!rawKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_token", message: "API key is empty" },
        { status: 401 }
      ),
    }
  }

  const keyHash = hashApiKey(rawKey)

  // Buscar la llave en BD — solo columnas necesarias para evitar over-fetching
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      restaurantId: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
      environment: true,
      restaurant: {
        select: {
          plan: true,
        },
      },
    },
  })

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_token", message: "Invalid API key" },
        { status: 401 }
      ),
    }
  }

  if (!apiKey.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "key_revoked", message: "API key has been revoked" },
        { status: 401 }
      ),
    }
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "key_expired", message: "API key has expired" },
        { status: 401 }
      ),
    }
  }

  // Bloquear llaves de test en producción
  if (apiKey.environment === "test" && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", message: "Test API keys cannot be used in production environment" },
        { status: 403 }
      ),
    }
  }

  // Aislamiento de Sandbox: usar SANDBOX_RESTAURANT_ID si es clave test
  const effectiveRestaurantId = apiKey.environment === "test" && process.env.SANDBOX_RESTAURANT_ID
    ? process.env.SANDBOX_RESTAURANT_ID
    : apiKey.restaurantId

  // Rate limiting por plan del restaurante
  const plan = (apiKey.restaurant?.plan ?? "FREE").toUpperCase()
  let success = true
  let limit = 0
  let remaining = 0
  let reset = 0

  if (plan === "FREE") {
    const res = await freeLimit.limit(`restaurant:${effectiveRestaurantId}`)
    success = res.success
    limit = res.limit
    remaining = res.remaining
    reset = res.reset
  } else if (plan === "PRO") {
    const res = await proLimit.limit(`restaurant:${effectiveRestaurantId}`)
    success = res.success
    limit = res.limit
    remaining = res.remaining
    reset = res.reset
  } else {
    // ENTERPRISE o ilimitado
    success = true
    limit = 100000
    remaining = 100000
    reset = Date.now() + 3600 * 1000
  }

  // Actualizar lastUsedAt de forma asíncrona sin bloquear la respuesta
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Ignorar errores en la actualización del timestamp
    })

  if (!success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: "Too many requests. Try again later.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      ),
    }
  }

  return {
    ok: true,
    restaurantId: effectiveRestaurantId,
    scopes: apiKey.scopes,
    keyId: apiKey.id,
    environment: apiKey.environment as "live" | "test",
  }
}

/**
 * Verifica si los scopes autorizados incluyen el scope requerido.
 */
export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes("*")
}

/**
 * Añade los headers de rate limit estándar a una respuesta existente.
 */
export function withRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  reset: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", limit.toString())
  response.headers.set("X-RateLimit-Remaining", remaining.toString())
  response.headers.set("X-RateLimit-Reset", reset.toString())
  return response
}
