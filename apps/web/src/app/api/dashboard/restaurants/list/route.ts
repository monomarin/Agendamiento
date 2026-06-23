import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Fetch current user to determine role/admin status
    const dbUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { email: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isAdmin = dbUser.email === "admin@iagenda.com" || dbUser.email.endsWith("@iagenda.com")

    let restaurants = []

    if (isAdmin) {
      // Admin sees all restaurants in the SaaS
      restaurants = await prisma.restaurant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: "asc" },
      })
    } else {
      // Regular user sees only their created restaurants
      restaurants = await prisma.restaurant.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: "asc" },
      })
    }

    return NextResponse.json({ success: true, restaurants })
  } catch (error: any) {
    console.error("[Restaurant List API Error]:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
