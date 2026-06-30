import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: slug.toLowerCase() },
    include: {
      branches: {
        where: { isActive: true },
        include: {
          schedules: true,
        },
      },
    },
  })

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  const now = new Date()
  const currentDay = now.getDay()
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  const branches = restaurant.branches.map((branch) => {
    const todaySchedule = branch.schedules.find((s) => s.dayOfWeek === currentDay)
    const isOpen = todaySchedule
      ? !todaySchedule.isClosed && currentTime >= todaySchedule.openTime && currentTime <= todaySchedule.closeTime
      : false

    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      latitude: branch.latitude,
      longitude: branch.longitude,
      isOpen,
      nextOpenTime: todaySchedule?.openTime || null,
    }
  })

  return NextResponse.json({ branches, restaurantType: restaurant.type })
}
