import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { Webhook } from "svix"
import prisma from "@/lib/prisma"
import { logAuditEvent } from "@/lib/audit"

// Tipos de eventos de Clerk que manejamos
type ClerkWebhookEvent =
  | { type: "user.created"; data: { id: string; email_addresses: { email_address: string }[]; first_name?: string; last_name?: string } }
  | { type: "session.created"; data: { id: string; user_id: string } }
  | { type: "session.ended"; data: { id: string; user_id: string } }
  | { type: "session.removed"; data: { id: string; user_id: string } }

/**
 * POST /api/webhooks/clerk
 *
 * Recibe eventos de Clerk vía Svix y:
 * 1. user.created → crea el usuario en Prisma si no existe
 * 2. session.created → registra auth.login en AuditLog
 * 3. session.ended / session.removed → registra auth.logout en AuditLog
 *
 * Para configurar: en el Clerk Dashboard → Webhooks → agregar endpoint:
 *   URL: https://tudominio.com/api/webhooks/clerk
 *   Eventos: user.created, session.created, session.ended, session.removed
 *   Copiar el Signing Secret y agregarlo a .env como CLERK_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  // Si no hay secret configurado, loggear y responder OK (para no bloquear dev)
  if (!webhookSecret || webhookSecret === "placeholder_webhook_clerk") {
    console.warn("[Clerk Webhook] CLERK_WEBHOOK_SECRET no configurado — evento ignorado")
    return NextResponse.json({ received: true, skipped: true })
  }

  // Verificar firma Svix
  const headersList = await headers()
  const svix_id = headersList.get("svix-id")
  const svix_timestamp = headersList.get("svix-timestamp")
  const svix_signature = headersList.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(webhookSecret)

  let event: ClerkWebhookEvent
  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookEvent
  } catch {
    console.error("[Clerk Webhook] Firma inválida")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null

  // ── Procesar eventos ────────────────────────────────────────────────────────
  switch (event.type) {
    case "user.created": {
      const { id: clerkUserId, email_addresses, first_name, last_name } = event.data
      const email = email_addresses?.[0]?.email_address ?? ""
      const name = [first_name, last_name].filter(Boolean).join(" ") || "Usuario"

      // Crear usuario en Prisma si no existe (upsert seguro)
      await prisma.user.upsert({
        where: { clerkUserId },
        update: {},
        create: {
          clerkUserId,
          email,
          name,
          role: "OWNER",
          // restaurantId se asignará durante el onboarding
        },
      })

      await logAuditEvent({
        actorId: clerkUserId,
        actorRole: "OWNER",
        eventType: "auth.user_created",
        resourceType: "User",
        resourceId: clerkUserId,
        ipAddress,
        metadata: { email },
        severity: "INFO",
      })
      break
    }

    case "session.created": {
      const { user_id } = event.data

      // Buscar restaurantId para enriquecer el log
      const dbUser = await prisma.user.findUnique({
        where: { clerkUserId: user_id },
        select: { restaurantId: true, role: true },
      })

      await logAuditEvent({
        actorId: user_id,
        actorRole: dbUser?.role ?? null,
        restaurantId: dbUser?.restaurantId ?? null,
        eventType: "auth.login",
        ipAddress,
        severity: "INFO",
      })
      break
    }

    case "session.ended":
    case "session.removed": {
      const { user_id } = event.data

      const dbUser = await prisma.user.findUnique({
        where: { clerkUserId: user_id },
        select: { restaurantId: true, role: true },
      })

      await logAuditEvent({
        actorId: user_id,
        actorRole: dbUser?.role ?? null,
        restaurantId: dbUser?.restaurantId ?? null,
        eventType: "auth.logout",
        ipAddress,
        severity: "INFO",
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
