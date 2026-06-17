import * as React from "react"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import ConfigClient from "./config-client"

export const dynamic = "force-dynamic"

export default async function ConfiguracionPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  // Buscar el restaurante del usuario y su rol/email
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      email: true,
      restaurantId: true,
      restaurant: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  })

  if (!user?.restaurantId || !user?.restaurant) {
    redirect("/onboarding")
  }

  const restaurantId = user.restaurantId
  const restaurantName = user.restaurant.name
  const restaurantSlug = user.restaurant.slug
  const ownerEmail = user.email

  // Consultar Claves API, Webhooks, Mesas Físicas, Mapeos del POS y Sedes de forma paralela
  const [apiKeys, webhooks, tables, posMappings, branches] = await Promise.all([
    prisma.apiKey.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhook.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.table.findMany({
      where: {
        zone: {
          branch: {
            restaurantId,
          },
        },
      },
      select: {
        id: true,
        number: true,
        capacity: true,
        zone: {
          select: {
            name: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { zone: { branch: { name: "asc" } } },
        { zone: { name: "asc" } },
        { number: "asc" },
      ],
    }),
    prisma.posTableMapping.findMany({
      where: { restaurantId },
    }),
    prisma.branch.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
    }),
  ])

  // Formatear fechas para pasar de forma segura al componente del cliente
  const formattedApiKeys = apiKeys.map((k) => ({
    id: k.id,
    name: k.name,
    scopes: k.scopes,
    isActive: k.isActive,
    environment: k.environment,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
  }))

  const formattedWebhooks = webhooks.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    isActive: w.isActive,
    status: w.status,
    consecutiveFailures: w.consecutiveFailures,
    createdAt: w.createdAt.toISOString(),
  }))

  const formattedTables = tables.map((t) => ({
    id: t.id,
    number: t.number,
    capacity: t.capacity,
    zone: {
      name: t.zone.name,
      branch: {
        name: t.zone.branch.name,
      },
    },
  }))

  const formattedMappings = posMappings.map((m) => ({
    id: m.id,
    antigravityTableId: m.antigravityTableId,
    posTableNumber: m.posTableNumber,
  }))

  const formattedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
  }))

  return (
    <ConfigClient
      initialApiKeys={formattedApiKeys}
      initialWebhooks={formattedWebhooks}
      initialTables={formattedTables}
      initialMappings={formattedMappings}
      initialBranches={formattedBranches}
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      restaurantSlug={restaurantSlug}
      ownerEmail={ownerEmail}
    />
  )
}
