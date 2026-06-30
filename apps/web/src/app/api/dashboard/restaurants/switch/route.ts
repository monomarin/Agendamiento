import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { restaurantId } = body

    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId is required" }, { status: 400 })
    }

    // 1. Fetch current user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { email: true, name: true, role: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isAdmin = dbUser.role === "SUPER_ADMIN" || dbUser.email === "admin@iagenda.com" || dbUser.email.endsWith("@iagenda.com")


    // 2. Fetch the target restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    })

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    // 3. Check permissions: Admin can switch to any, owner only to their created ones
    if (!isAdmin && restaurant.creatorId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this restaurant" }, { status: 403 })
    }

    // 4. Perform switch: update User and StaffMember records
    await prisma.$transaction([
      prisma.user.update({
        where: { clerkUserId: userId },
        data: { restaurantId },
      }),
      prisma.staffMember.upsert({
        where: { clerkUserId: userId },
        update: { restaurantId },
        create: {
          restaurantId,
          clerkUserId: userId,
          email: dbUser.email,
          name: dbUser.name,
          role: "OWNER",
        },
      }),
    ])

    return NextResponse.json({ success: true, message: `Switched to restaurant: ${restaurant.name}` })
  } catch (error: any) {
    console.error("[Restaurant Switch API Error]:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
