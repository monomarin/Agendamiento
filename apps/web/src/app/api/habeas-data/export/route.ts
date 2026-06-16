import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify user is OWNER or MANAGER
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true, role: true },
  })
  if (!user?.restaurantId || !["OWNER", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const email = (formData.get("email") as string)?.toLowerCase()

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 })
  }

  // Find customer and all related data
  const customer = await prisma.customer.findUnique({
    where: { email },
    include: {
      bookings: {
        where: { branch: { restaurantId: user.restaurantId } },
        include: {
          branch: { select: { name: true } },
          tableType: { select: { name: true } },
        },
      },
      tags: true,
      preferences: true,
    },
  })

  if (!customer) {
    return NextResponse.json({ error: "Customer not found", email }, { status: 404 })
  }

  // Find consent records
  const consents = await prisma.consentRecord.findMany({
    where: { clientEmail: email, restaurantId: user.restaurantId },
  })

  // Build export payload
  const exportData = {
    _metadata: {
      exportDate: new Date().toISOString(),
      exportedBy: userId,
      restaurantId: user.restaurantId,
      law: "Ley 1581 de 2012 - Habeas Data (Colombia)",
    },
    personalData: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      notes: customer.notes,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    tags: customer.tags.map((t) => t.name),
    preferences: customer.preferences.map((p) => ({
      key: p.key,
      value: p.value,
    })),
    bookings: customer.bookings.map((b) => ({
      id: b.id,
      date: b.dateTime,
      partySize: b.partySize,
      status: b.status,
      branch: b.branch.name,
      tableType: b.tableType?.name,
      specialRequests: b.specialRequests,
      paymentStatus: b.paymentStatus,
      source: b.source,
      createdAt: b.createdAt,
    })),
    consentRecords: consents.map((c) => ({
      timestamp: c.timestamp,
      policyVersion: c.policyVersion,
      ipAddress: c.ipAddress,
    })),
  }

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="habeas-data-${email}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
