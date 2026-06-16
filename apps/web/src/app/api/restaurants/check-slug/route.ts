import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get("slug")
    
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 })
    }
    
    const existing = await prisma.restaurant.findUnique({
      where: { slug: slug.toLowerCase() },
    })
    
    return NextResponse.json({ available: !existing })
  } catch (error) {
    console.error("[Check Slug Error]:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
