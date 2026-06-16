import * as React from "react"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import FloorPlanClient from "./floor-plan-client"

export const dynamic = "force-dynamic"

export default async function MesasPage() {
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

  const branches = await prisma.branch.findMany({
    where: { restaurantId: user.restaurantId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <FloorPlanClient
      initialBranches={branches}
      restaurantId={user.restaurantId}
    />
  )
}
