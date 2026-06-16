import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get("email")
    
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    
    // Check if any restaurant has this email
    const existingRestaurant = await prisma.restaurant.findFirst({
      where: { email: email.toLowerCase() },
    })
    
    return NextResponse.json({ available: !existingRestaurant })
  } catch (error) {
    console.error("[Check Email Error]:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
