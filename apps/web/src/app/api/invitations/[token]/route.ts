import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"

import prisma from "@/lib/prisma"
import { setUserPublicMetadata } from "@/lib/clerk-metadata"
import { logAuditEvent, extractIpAddress } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ token: string }>
}

/**
 * GET /api/invitations/[token]
 *
 * Valida un token de invitación. Retorna info del restaurante y rol
 * para mostrar en la página de aceptación. No requiere autenticación.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params

  const invitation = await prisma.staffInvitation.findUnique({
    where: { token },
    include: {
      restaurant: { select: { name: true, primaryColor: true, logoUrl: true } },
    },
  })

  if (!invitation) {
    return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
  }

  if (invitation.usedAt) {
    return NextResponse.json({ error: "Esta invitación ya fue utilizada" }, { status: 410 })
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Esta invitación ha expirado" }, { status: 410 })
  }

  const roleLabels: Record<string, string> = {
    MANAGER: "Gerente / Manager",
    HOSTESS: "Recepcionista / Hostess",
    WAITER: "Mesero / Operador",
  }

  return NextResponse.json({
    valid: true,
    email: invitation.email,
    role: invitation.role,
    roleLabel: roleLabels[invitation.role] ?? invitation.role,
    restaurantName: invitation.restaurant.name,
    restaurantColor: invitation.restaurant.primaryColor,
    logoUrl: invitation.restaurant.logoUrl,
    expiresAt: invitation.expiresAt,
  })
}

/**
 * POST /api/invitations/[token]
 *
 * Acepta la invitación. El usuario debe estar autenticado en Clerk.
 * Crea el StaffMember en Prisma y actualiza la metadata de Clerk.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params

  try {
    const { userId: clerkUserId } = await auth()
    const clerkUser = await currentUser()

    if (!clerkUserId || !clerkUser) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para aceptar la invitación" },
        { status: 401 }
      )
    }

    // Verificar que el token sea válido
    const invitation = await prisma.staffInvitation.findUnique({
      where: { token },
      include: {
        restaurant: { select: { id: true, name: true, slug: true, primaryColor: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
    }

    if (invitation.usedAt) {
      return NextResponse.json({ error: "Esta invitación ya fue utilizada" }, { status: 410 })
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Esta invitación ha expirado" }, { status: 410 })
    }

    // Verificar que el email de Clerk coincide con el email de la invitación
    const clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase()
    if (clerkEmail !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `Esta invitación fue enviada a ${invitation.email}. Por favor inicia sesión con ese correo.`,
        },
        { status: 403 }
      )
    }

    // Verificar que no sea ya miembro del restaurante
    const existingMember = await prisma.staffMember.findFirst({
      where: { restaurantId: invitation.restaurantId, clerkUserId },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: "Ya eres miembro de este equipo" },
        { status: 409 }
      )
    }

    const staffName = clerkUser.firstName
      ? `${clerkUser.firstName} ${clerkUser.lastName ?? ""}`.trim()
      : invitation.email

    // Transacción: crear StaffMember + marcar invitación como usada + actualizar User
    await prisma.$transaction(async (tx) => {
      // Crear o actualizar registro en StaffMember
      await tx.staffMember.upsert({
        where: { clerkUserId },
        update: {
          restaurantId: invitation.restaurantId,
          role: invitation.role,
        },
        create: {
          restaurantId: invitation.restaurantId,
          clerkUserId,
          email: invitation.email,
          name: staffName,
          role: invitation.role,
        },
      })

      // Actualizar o crear el User general también
      await tx.user.upsert({
        where: { clerkUserId },
        update: {
          restaurantId: invitation.restaurantId,
          role: invitation.role,
        },
        create: {
          clerkUserId,
          email: invitation.email,
          name: staffName,
          role: invitation.role,
          restaurantId: invitation.restaurantId,
        },
      })

      // Marcar la invitación como usada (token inutilizable para siempre)
      await tx.staffInvitation.update({
        where: { token },
        data: { usedAt: new Date() },
      })
    })

    // Actualizar metadata en Clerk para que el JWT refleje el nuevo rol y restaurante
    await setUserPublicMetadata(clerkUserId, {
      role: invitation.role as any,
      restaurantId: invitation.restaurant.id,
      restaurantSlug: invitation.restaurant.slug,
    })

    // Registrar en AuditLog
    await logAuditEvent({
      actorId: clerkUserId,
      actorRole: invitation.role,
      restaurantId: invitation.restaurant.id,
      eventType: "staff.invitation_accepted",
      resourceType: "StaffInvitation",
      resourceId: invitation.id,
      ipAddress: extractIpAddress(req),
      userAgent: req.headers.get("user-agent"),
      metadata: { email: invitation.email, role: invitation.role },
      severity: "INFO",
    })

    return NextResponse.json({
      success: true,
      message: `Bienvenido/a al equipo de ${invitation.restaurant.name}`,
      restaurantSlug: invitation.restaurant.slug,
    })
  } catch (error: any) {
    console.error("[Accept Invitation]:", error)
    return NextResponse.json(
      { error: error.message ?? "Error interno" },
      { status: 500 }
    )
  }
}
