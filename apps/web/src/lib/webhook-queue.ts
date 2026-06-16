import { Queue, Worker, Job } from "bullmq"
import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"
import crypto from "crypto"

// BullMQ incluye su propio ioredis internamente. Usamos la URL de conexión
// directamente con el formato esperado por BullMQ.

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | "booking.created"
  | "booking.updated"
  | "booking.cancelled"
  | "booking.checked_in"
  | "booking.no_show"
  | "table.status_changed"

export interface WebhookJobData {
  restaurantId: string
  event: WebhookEvent
  bookingId: string
  payload: Record<string, unknown>
  idempotencyKey: string
}

// ─── Opciones de conexión para BullMQ ────────────────────────────────────────

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"

// BullMQ acepta la URL de Redis directamente como string en su connectionOptions
const connectionOptions = {
  connection: {
    url: redisUrl,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  },
}

// ─── Cola de Webhooks ────────────────────────────────────────────────────────

let webhookQueue: Queue | null = null

export function getWebhookQueue(): Queue {
  if (!webhookQueue) {
    webhookQueue = new Queue("webhook-deliveries", {
      ...connectionOptions,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000, // 1s, 2s, 4s, 8s, 16s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    })
  }
  return webhookQueue
}

/**
 * Encola un evento de webhook para todos los webhooks activos
 * del restaurante que estén suscritos al evento.
 */
export async function dispatchWebhookEvent(
  restaurantId: string,
  event: WebhookEvent,
  bookingId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      restaurantId,
      isActive: true,
      status: "active",
      events: { has: event },
    },
    select: { id: true },
  })

  if (webhooks.length === 0) return

  const queue = getWebhookQueue()

  await Promise.all(
    webhooks.map((webhook) => {
      const idempotencyKey = `${webhook.id}:${event}:${bookingId}`
      return queue.add(
        "deliver",
        {
          restaurantId,
          event,
          bookingId,
          payload,
          idempotencyKey,
        } as WebhookJobData,
        {
          jobId: idempotencyKey, // Deduplicación automática por BullMQ
        }
      )
    })
  )
}

// ─── Firma HMAC-SHA256 ───────────────────────────────────────────────────────

function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

// ─── Sanitización PII (Ley 1581 Colombia) ───────────────────────────────────

function sanitizePayloadForLog(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const piiFields = ["email", "phone", "name", "document", "address"]
  const sanitized = { ...payload }

  for (const field of piiFields) {
    if (field in sanitized) {
      const val = sanitized[field]
      if (typeof val === "string" && val.length > 0) {
        sanitized[field] = val.slice(0, 2) + "***"
      }
    }
  }

  // Sanitizar dentro de customer si existe
  if (sanitized.customer && typeof sanitized.customer === "object") {
    sanitized.customer = sanitizePayloadForLog(
      sanitized.customer as Record<string, unknown>
    )
  }

  return sanitized
}

// ─── Worker de entrega ───────────────────────────────────────────────────────

let worker: Worker | null = null

export function startWebhookWorker(): void {
  if (worker) return // Ya iniciado

  worker = new Worker(
    "webhook-deliveries",
    async (job: Job) => {
      const jobData = job.data as WebhookJobData
      const { idempotencyKey, event, bookingId, payload } = jobData

      // Extraer webhookId del idempotencyKey: `${webhookId}:${event}:${bookingId}`
      const webhookId = idempotencyKey.split(":")[0]

      // Verificar idempotencia: si ya hay un delivery exitoso, saltar
      const existing = await prisma.webhookDelivery.findUnique({
        where: { idempotencyKey },
        select: { status: true },
      })

      if (existing?.status === "success") {
        return // Ya entregado exitosamente
      }

      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId },
        select: { url: true, secret: true, isActive: true, status: true, restaurantId: true },
      })

      if (!webhook || !webhook.isActive || webhook.status !== "active") {
        return // Webhook desactivado, descartar
      }

      const body = JSON.stringify({
        id: idempotencyKey,
        event,
        createdAt: new Date().toISOString(),
        data: payload,
      })

      const signature = signPayload(webhook.secret, body)

      let deliveryStatus: "success" | "failed" = "failed"
      let errorMessage: string | undefined

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": `sha256=${signature}`,
            "X-Webhook-Event": event,
            "User-Agent": "iAgenda-Webhooks/1.0",
          },
          body,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        })

        if (response.ok) {
          deliveryStatus = "success"
        } else {
          errorMessage = `HTTP ${response.status}: ${await response.text().catch(() => "")}`
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err)
      }

      // Registrar el intento con payload sanitizado (PII compliance)
      const sanitizedPayload = sanitizePayloadForLog(payload)

      await prisma.webhookDelivery.upsert({
        where: { idempotencyKey },
        create: {
          webhookId,
          event,
          bookingId,
          idempotencyKey,
          status: deliveryStatus,
          payload: sanitizedPayload as Prisma.InputJsonValue,
          errorMessage,
        },
        update: {
          status: deliveryStatus,
          errorMessage,
        },
      })

      // Manejo de fallos consecutivos: suspender webhook tras 5 fallos seguidos
      if (deliveryStatus === "failed") {
        const updated = await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            consecutiveFailures: { increment: 1 },
          },
          select: { consecutiveFailures: true },
        })

        if (updated.consecutiveFailures >= 5) {
          await prisma.webhook.update({
            where: { id: webhookId },
            data: { status: "suspended", isActive: false },
          })

          try {
            const restaurant = await prisma.restaurant.findUnique({
              where: { id: webhook.restaurantId },
              select: {
                name: true,
                users: {
                  where: { role: "OWNER" },
                  select: { email: true },
                  take: 1,
                },
              },
            })

            const ownerEmail = restaurant?.users[0]?.email
            const restaurantName = restaurant?.name ?? "tu restaurante"

            if (ownerEmail) {
              const { sendWebhookSuspendedEmail } = await import("./email")
              await sendWebhookSuspendedEmail(ownerEmail, webhook.url, restaurantName)
            }
          } catch (emailErr) {
            console.error("[WebhookWorker] Error al intentar enviar email de suspension:", emailErr)
          }
        }

        // Re-lanzar para que BullMQ reintente con backoff exponencial
        throw new Error(errorMessage ?? "Delivery failed")
      }

      // Éxito: resetear contador de fallos
      await prisma.webhook.update({
        where: { id: webhookId },
        data: { consecutiveFailures: 0 },
      })
    },
    {
      ...connectionOptions,
      concurrency: 5,
    }
  )

  worker.on("failed", (job, err) => {
    console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message)
  })

  worker.on("completed", (job) => {
    console.log(`[WebhookWorker] Job ${job.id} completed`)
  })
}
