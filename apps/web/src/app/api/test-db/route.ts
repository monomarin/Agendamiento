import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true }
    })
    return NextResponse.json({ success: true, users })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message,
      stack: error.stack,
      envSet: !!process.env.DATABASE_URL
    }, { status: 500 })
  }
}
