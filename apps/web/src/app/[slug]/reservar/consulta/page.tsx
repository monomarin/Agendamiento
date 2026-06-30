import * as React from "react"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import ConsultaClient from "./consulta-client"

interface ConsultaPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ref?: string; code?: string }>
}

export default async function ConsultaPage({ params, searchParams }: ConsultaPageProps) {
  const { slug } = await params
  const { ref, code } = await searchParams

  if (!ref && !code) {
    notFound()
  }

  // Fetch the booking from database
  const booking = await prisma.booking.findFirst({
    where: ref ? { id: ref } : { confirmationCode: code?.toUpperCase().trim() },
    include: {
      customer: true,
      branch: {
        select: {
          name: true,
          restaurantId: true,
          restaurant: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      },
      tableType: { select: { name: true } },
      tables: { select: { id: true, number: true } }
    }
  })

  if (!booking || booking.branch.restaurant.slug !== slug.toLowerCase()) {
    notFound()
  }

  // Check if logged in user is admin/staff of this restaurant
  let isAdmin = false
  const { userId } = await auth()
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { restaurantId: true }
    })
    if (user && user.restaurantId === booking.branch.restaurantId) {
      isAdmin = true
    }
  }

  return (
    <ConsultaClient
      booking={{
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        dateTime: booking.dateTime.toISOString(),
        partySize: booking.partySize,
        specialRequests: booking.specialRequests,
        status: booking.status,
        customer: {
          name: booking.customer.name,
          email: booking.customer.email,
          phone: booking.customer.phone
        },
        branchName: booking.branch.name,
        restaurantName: booking.branch.restaurant.name,
        tableTypeName: booking.tableType.name,
        tables: booking.tables
      }}
      isAdmin={isAdmin}
    />
  )
}
