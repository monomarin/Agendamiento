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

  // Dynamic self-repair logic for demo slugs
  if (slug.toLowerCase() === "clinicadental" && restaurant.type !== "clinica_dental") {
    try {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { type: "clinica_dental" }
      })
      restaurant.type = "clinica_dental"
    } catch (e) {
      console.error("Failed to repair restaurant type:", e)
    }
  } else if (slug.toLowerCase() === "eps-familiar" && restaurant.type !== "eps_ips") {
    try {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { type: "eps_ips" }
      })
      restaurant.type = "eps_ips"
    } catch (e) {
      console.error("Failed to repair restaurant type:", e)
    }
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
