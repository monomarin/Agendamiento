import * as React from "react"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import ConversacionesClient from "./conversaciones-client"

export const dynamic = "force-dynamic"

export default async function ConversacionesPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  })

  if (!user?.restaurantId) {
    redirect("/onboarding")
  }

  return (
    <ConversacionesClient restaurantId={user.restaurantId} />
  )
}
