import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"

import prisma from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

// Helper to register Event Type in self-hosted Cal.com v2
async function createCalcomEventType(
  apiUrl: string,
  apiKey: string,
  tableTypeName: string,
  slug: string,
  timezone: string
): Promise<number | null> {
  try {
    const response = await fetch(`${apiUrl}/event-types`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: tableTypeName,
        slug: slug.toLowerCase(),
        length: 90, // Default duration: 90 minutes
        timeZone: timezone,
        schedulingType: "collective",
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn(`[Cal.com Sync Warning]: Status ${response.status} - ${text}`)
      return null
    }

    const data = await response.json()
    // Extract Event Type ID
    return data.data?.id || data.id || null
  } catch (error) {
    console.error("[Cal.com Sync Error]:", error)
    return null
  }
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkUserId } = await auth()
    const user = await currentUser()

    if (!clerkUserId || !user) {
      return NextResponse.json(
        { message: "No autorizado. Inicia sesión para continuar." },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { restaurantInfo, schedules, tableTypes, paymentSettings } = body

    if (!restaurantInfo || !restaurantInfo.name || !restaurantInfo.slug || !restaurantInfo.email) {
      return NextResponse.json(
        { message: "Faltan datos obligatorios del restaurante (nombre, slug, correo)." },
        { status: 400 }
      )
    }

    // 2. Check if slug is already taken
    const existingRestaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantInfo.slug.toLowerCase() },
    })

    if (existingRestaurant) {
      return NextResponse.json(
        { message: "El enlace de reservas (slug) ya está en uso. Elige otro." },
        { status: 400 }
      )
    }

    // 3. Encrypt secrets using AES-256-GCM
    const encryptedStripeSecret = paymentSettings.stripeSecretKey
      ? encrypt(paymentSettings.stripeSecretKey)
      : null
    const encryptedWompiPrivate = paymentSettings.wompiPrivateKey
      ? encrypt(paymentSettings.wompiPrivateKey)
      : null

    // 4. Save everything inside a database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the restaurant
      const restaurant = await tx.restaurant.create({
        data: {
          slug: restaurantInfo.slug.toLowerCase(),
          name: restaurantInfo.name,
          nit: restaurantInfo.nit || null,
          type: restaurantInfo.type,
          email: restaurantInfo.email.toLowerCase(),
          description: restaurantInfo.description || null,
          logoUrl: restaurantInfo.logoUrl || null,
          bannerUrl: restaurantInfo.bannerUrl || null,
          bannerOpacity: restaurantInfo.bannerOpacity ?? 0.15,
          primaryColor: restaurantInfo.primaryColor,
          secondaryColor: restaurantInfo.secondaryColor,
          timezone: restaurantInfo.timezone || "America/Bogota",
          status: "ACTIVE", // Onboarding completes, restaurant is active
          creatorId: clerkUserId,
        },
      })

      // Create or update the owner user record
      const dbUser = await tx.user.upsert({
        where: { clerkUserId },
        update: {
          restaurantId: restaurant.id,
        },
        create: {
          clerkUserId,
          email: user.emailAddresses?.[0]?.emailAddress || "",
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Usuario",
          role: "OWNER",
          restaurantId: restaurant.id,
        },
      })

      // Create or update owner as first StaffMember (upsert to avoid unique constraint on clerkUserId)
      await tx.staffMember.upsert({
        where: { clerkUserId },
        update: {
          restaurantId: restaurant.id,
          email: user.emailAddresses?.[0]?.emailAddress || "",
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Usuario",
          role: "OWNER",
        },
        create: {
          restaurantId: restaurant.id,
          clerkUserId,
          email: user.emailAddresses?.[0]?.emailAddress || "",
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Usuario",
          role: "OWNER",
        },
      })

      // Create branch (Sede Principal)
      const branch = await tx.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: "Sede Principal",
          address: restaurantInfo.address,
          phone: restaurantInfo.phone || null,
          isActive: true,
        },
      })

      // Create branch schedules
      if (schedules && schedules.length > 0) {
        await tx.schedule.createMany({
          data: schedules.map((s: any) => ({
            branchId: branch.id,
            dayOfWeek: s.dayOfWeek,
            openTime: s.openTime,
            closeTime: s.closeTime,
            isClosed: s.isClosed,
          })),
        })
      }

      // Create table types (and dummy tables for the floor plan layout)
      const createdTableTypes = []
      if (tableTypes && tableTypes.length > 0) {
        for (const type of tableTypes) {
          const tableType = await tx.tableType.create({
            data: {
              branchId: branch.id,
              name: type.name,
              minCapacity: type.minCapacity,
              maxCapacity: type.maxCapacity,
              quantity: type.quantity,
            },
          })

          createdTableTypes.push(tableType)

          // Create default Zone
          const zone = await tx.zone.create({
            data: {
              branchId: branch.id,
              name: "Salón Principal",
            },
          })

          // Auto-generate physical tables for this category in the default zone
          const tableData = Array.from({ length: type.quantity }).map((_, idx) => ({
            tableTypeId: tableType.id,
            zoneId: zone.id,
            number: `${idx + 1}`,
            capacity: type.maxCapacity,
            shape: "SQUARE",
            status: "AVAILABLE",
            x: 50 + (idx % 4) * 120, // Grid positioning for draft floor plan
            y: 80 + Math.floor(idx / 4) * 120,
          }))

          await tx.table.createMany({
            data: tableData,
          })
        }
      }

      // Create payment settings
      await tx.paymentSettings.create({
        data: {
          restaurantId: restaurant.id,
          stripeEnabled: paymentSettings.stripeEnabled,
          stripePublishableKey: paymentSettings.stripePublishableKey || null,
          stripeSecretKey: encryptedStripeSecret,
          wompiEnabled: paymentSettings.wompiEnabled,
          wompiPublicKey: paymentSettings.wompiPublicKey || null,
          wompiPrivateKey: encryptedWompiPrivate,
          requireDeposit: paymentSettings.requireDeposit,
          depositAmount: paymentSettings.depositAmount || 0,
          depositType: paymentSettings.depositType || "FIXED",
          currency: paymentSettings.currency || "COP",
          cancellationPolicyDays: paymentSettings.cancellationPolicyDays || 1,
        },
      })

      return { restaurant, dbUser, branch, createdTableTypes }
    })

    // 5. Cal.com integration for Table Types (Event Types)
    const calcomApiUrl = process.env.CALCOM_API_URL
    const calcomApiKey = process.env.CALCOM_API_KEY
    const hasCalcomConfig = calcomApiUrl && calcomApiKey && calcomApiKey !== "cal_api_key_placeholder"

    for (const type of result.createdTableTypes) {
      let calcomEventId: number | null = null

      if (hasCalcomConfig) {
        console.log(`[Cal.com] Sincronizando event type para la mesa: ${type.name}...`)
        const slugSeed = `${result.restaurant.slug}-${type.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`
        calcomEventId = await createCalcomEventType(
          calcomApiUrl!,
          calcomApiKey!,
          type.name,
          slugSeed,
          result.restaurant.timezone
        )
      } else {
        // Mock ID for development if Cal.com is not fully configured
        calcomEventId = Math.floor(100000 + Math.random() * 900000)
        console.log(`[Cal.com Simulation] Mesa "${type.name}" registrada con ID simulado: ${calcomEventId}`)
      }

      if (calcomEventId) {
        await prisma.tableType.update({
          where: { id: type.id },
          data: { calcomEventId },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Establecimiento configurado con éxito.",
      restaurantId: result.restaurant.id,
      slug: result.restaurant.slug,
    })
  } catch (error: any) {
    console.error("[Onboarding API Error]:", error)
    return NextResponse.json(
      { message: error.message || "Error interno del servidor." },
      { status: 500 }
    )
  }
}
