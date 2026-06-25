import prisma from "@/lib/prisma"

export type AuditSeverity = "INFO" | "WARN" | "CRITICAL"

export interface AuditEventParams {
  /** clerkUserId del actor. null para eventos de sistema. */
  actorId?: string | null
  /** Rol del actor en el momento de la acción */
  actorRole?: string | null
  /** UUID del restaurante/tenant afectado. null para eventos globales de plataforma */
  restaurantId?: string | null
  /** Código del evento — usar nomenclatura "entidad.accion", ej: "auth.login", "reservation.cancelled" */
  eventType: string
  /** Entidad/tabla afectada, ej: "Booking", "StaffMember", "Restaurant" */
  resourceType?: string | null
  /** ID del recurso afectado */
  resourceId?: string | null
  /** IP del actor (extraída del request) */
  ipAddress?: string | null
  /** User-Agent del navegador/cliente */
  userAgent?: string | null
  /** Datos adicionales relevantes para el evento */
  metadata?: Record<string, unknown> | null
  severity?: AuditSeverity
}

/**
 * Registra un evento en la tabla AuditLog.
 *
 * Esta función es "fire and forget" — no lanza errores para no
 * interrumpir el flujo principal. Los errores se loggean a consola.
 *
 * @example
 * await logAuditEvent({
 *   actorId: clerkUserId,
 *   actorRole: "OWNER",
 *   restaurantId: restaurant.id,
 *   eventType: "staff.invited",
 *   resourceType: "StaffInvitation",
 *   resourceId: invitation.id,
 *   metadata: { invitedEmail: email, role },
 *   severity: "INFO",
 * })
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorRole: params.actorRole ?? null,
        restaurantId: params.restaurantId ?? null,
        eventType: params.eventType,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: (params.metadata as any) ?? undefined,
        severity: params.severity ?? "INFO",
      },
    })
  } catch (error) {
    // No lanzar — el fallo de auditoría nunca debe bloquear la operación principal
    console.error("[AuditLog] Error registrando evento:", params.eventType, error)
  }
}

/**
 * Extrae la IP real del cliente desde los headers de un NextRequest/Request.
 * Considera proxies y Cloudflare/Vercel.
 */
export function extractIpAddress(req: Request): string | null {
  const headers = req.headers
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    null
  )
}
