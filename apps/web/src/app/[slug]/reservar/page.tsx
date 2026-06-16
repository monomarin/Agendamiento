import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"

interface ReservarRootPageProps {
  params: Promise<{ slug: string }>
}

// Server component: auto-redirect single-branch restaurants
export default async function ReservarRootPage({ params }: ReservarRootPageProps) {
  const { slug } = await params

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: slug.toLowerCase() },
    include: {
      branches: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  })

  if (!restaurant) {
    redirect("/")
  }

  // Single branch → skip to step 1 directly
  if (restaurant.branches.length <= 1) {
    redirect(`/${slug}/reservar/personas`)
  }

  // Multiple branches → show branch selector
  redirect(`/${slug}/reservar/sede`)
}
