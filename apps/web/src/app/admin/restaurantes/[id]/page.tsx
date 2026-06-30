import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import RestaurantForm from "../RestaurantForm"

export const dynamic = "force-dynamic"

interface EditRestaurantPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditRestaurantPage({ params }: EditRestaurantPageProps) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  })

  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  const { id } = await params

  // Fetch restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      status: true,
      timezone: true,
      plan: true,
      primaryColor: true,
      secondaryColor: true,
      logoUrl: true,
      bannerUrl: true,
      bannerOpacity: true,
    },
  })

  if (!restaurant) {
    notFound()
  }

  return (
    <div className="py-4">
      <RestaurantForm restaurant={restaurant} />
    </div>
  )
}
