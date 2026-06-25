import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { randomUUID } from "crypto"

import prisma from "@/lib/prisma"
import { sendStaffInvitationEmail } from "@/lib/email"
import { logAuditEvent, extractIpAddress } from "@/lib/audit"

/**
 * POST /api/invitations
 *
 * Crea una invitación de staff. Solo puede llamarlo el OWNER del restaurante.
 *
 * Body: { email: string, role: "MANAGER" | "HOSTESS" | "WAITER", permissions?: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    const clerkUser = await currentUser()

    if (!clerkUserId || !clerkUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Buscar el usuario y su restaurante en Prisma
    const dbUser = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        restaurant: { select: { id: true, name: true } },
      },
    })

    if (!dbUser?.restaurant) {
      return NextResponse.json(
        { error: "No tienes un restaurante configurado" },
        { status: 403 }
      )
    }

    // Solo OWNER o SUPER_ADMIN puede invitar staff
    if (dbUser.role !== "OWNER" && (dbUser.role as string) !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Solo el propietario puede invitar miembros al equipo" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { email, role, permissions = [] } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: "El correo y el rol son obligatorios" },
        { status: 400 }
      )
    }

    const validRoles = ["MANAGER", "HOSTESS", "WAITER"]
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Rol inválido. Opciones: ${validRoles.join(", ")}` },
        { status: 400 }
      )
    }

    // Verificar que el email no sea ya miembro activo de este restaurante
    const existingMember = await prisma.staffMember.findFirst({
      where: { restaurantId: dbUser.restaurant.id, email: email.toLowerCase() },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: "Este correo ya es miembro del equipo" },
        { status: 409 }
      )
    }

    // Verificar si ya hay una invitación pendiente para este email en este restaurante
    const existingInvitation = await prisma.staffInvitation.findFirst({
      where: {
        restaurantId: dbUser.restaurant.id,
        email: email.toLowerCase(),
        usedAt: null, // solo pendientes
        expiresAt: { gt: new Date() }, // no expiradas
      },
    })

    if (existingInvitation) {
      return NextResponse.json(
        { error: "Ya existe una invitación pendiente para este correo" },
        { status: 409 }
      )
    }

    // Crear el token y la invitación
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // +72 horas

    const invitation = await prisma.staffInvitation.create({
      data: {
        restaurantId: dbUser.restaurant.id,
        email: email.toLowerCase(),
        role,
        permissions,
        token,
        expiresAt,
        invitedById: clerkUserId,
      },
    })

    // Construir URL de invitación
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const inviteUrl = `${appUrl}/invite?token=${token}`

    // Obtener nombre del invitador
    const inviterName =
      clerkUser.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName ?? ""}`.trim()
        : clerkUser.emailAddresses?.[0]?.emailAddress ?? "El equipo de iAgenda"

    // Enviar email de invitación
    await sendStaffInvitationEmail({
      toEmail: email,
      restaurantName: dbUser.restaurant.name,
      inviterName,
      role,
      inviteUrl,
    })

    // Registrar en AuditLog
    await logAuditEvent({
      actorId: clerkUserId,
      actorRole: dbUser.role,
      restaurantId: dbUser.restaurant.id,
      eventType: "staff.invited",
      resourceType: "StaffInvitation",
      resourceId: invitation.id,
      ipAddress: extractIpAddress(req),
      userAgent: req.headers.get("user-agent"),
      metadata: { invitedEmail: email, role, permissions },
      severity: "INFO",
    })

    return NextResponse.json({
      success: true,
      message: `Invitación enviada a ${email}`,
      invitationId: invitation.id,
      expiresAt: invitation.expiresAt,
      // En desarrollo: exponer la URL para pruebas
      ...(process.env.NODE_ENV !== "production" && { inviteUrl }),
    })
  } catch (error: any) {
    console.error("[Invitations API]:", error)
    return NextResponse.json(
      { error: error.message ?? "Error interno" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/invitations
 *
 * Lista las invitaciones del restaurante del usuario autenticado.
 * Solo accesible por el OWNER.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { restaurantId: true, role: true },
    })

    if (!dbUser?.restaurantId || (dbUser.role !== "OWNER" && (dbUser.role as string) !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const invitations = await prisma.staffInvitation.findMany({
      where: { restaurantId: dbUser.restaurantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        permissions: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
    })

    // Enriquecer con estado
    const enriched = invitations.map((inv: typeof invitations[number]) => ({
      ...inv,
      status:
        inv.usedAt
          ? "accepted"
          : inv.expiresAt < new Date()
          ? "expired"
          : "pending",
    }))

    return NextResponse.json({ invitations: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Error interno" }, { status: 500 })
  }
}
