import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")?.toLowerCase()

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 })
  }

  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, name: true },
  })

  return NextResponse.json({
    exists: !!customer,
    name: customer?.name || null,
  })
}
