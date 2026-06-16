import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify user is OWNER only (deletion is a dangerous action)
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true, role: true },
  })
  if (!user?.restaurantId || user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el propietario puede eliminar datos de clientes." }, { status: 403 })
  }

  const formData = await req.formData()
  const email = (formData.get("email") as string)?.toLowerCase()

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 })
  }

  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true },
  })

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado", email }, { status: 404 })
  }

  // Transaction: delete all data for this customer related to this restaurant
  await prisma.$transaction(async (tx) => {
    // 1. Delete bookings for this restaurant
    await tx.booking.deleteMany({
      where: {
        customerId: customer.id,
        branch: { restaurantId: user.restaurantId! },
      },
    })

    // 2. Delete consent records
    await tx.consentRecord.deleteMany({
      where: {
        clientEmail: email,
        restaurantId: user.restaurantId!,
      },
    })

    // 3. Delete preferences
    await tx.customerPreference.deleteMany({
      where: { customerId: customer.id },
    })

    // 4. Check if this customer has bookings with other restaurants
    const otherBookings = await tx.booking.count({
      where: { customerId: customer.id },
    })

    // 5. If no other bookings exist, delete the customer record entirely
    if (otherBookings === 0) {
      await tx.customer.delete({
        where: { id: customer.id },
      })
    } else {
      // Anonymize the customer data for this restaurant's records
      // But keep the customer record for other restaurants
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          notes: null,
        },
      })
    }

    // 6. Log the deletion event
    await tx.communicationLog.create({
      data: {
        restaurantId: user.restaurantId!,
        type: "system",
        direction: "outbound",
        content: `Habeas Data: Datos del cliente ${email} eliminados por ${userId}`,
        source: "system",
      },
    })
  })

  return NextResponse.json({
    success: true,
    message: `Los datos del cliente ${email} han sido eliminados según la Ley 1581 de 2012.`,
  })
}
