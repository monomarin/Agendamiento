import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { dispatchWebhookEvent } from "@/lib/webhook-queue"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PUT /api/dashboard/bookings/[id]
 * Updates a booking's status, details, or physical table assignments.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { status, dateTime, partySize, specialRequests, tableIds } = body

  try {
    // 1. Verify ownership of the booking
    const existingBooking = await prisma.booking.findFirst({
      where: {
        id,
        branch: { restaurantId: user.restaurantId },
      },
      include: {
        tables: true,
      },
    })

    if (!existingBooking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const updateData: any = {}

    if (status) {
      updateData.status = status.toUpperCase()
    }
    if (dateTime) {
      updateData.dateTime = new Date(dateTime)
    }
    if (partySize) {
      updateData.partySize = Number(partySize)
    }
    if (specialRequests !== undefined) {
      updateData.specialRequests = specialRequests
    }

    // Handle physical tables assignment if provided
    if (Array.isArray(tableIds)) {
      updateData.tables = {
        set: tableIds.map((tid: string) => ({ id: tid })),
      }
    }

    // 2. Perform the update
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        tables: true,
        customer: true,
      },
    })

    // 3. Side effects: Table Status updates based on Booking Status
    const targetBookingStatus = updatedBooking.status
    const assignedTables = updatedBooking.tables

    if (targetBookingStatus === "CHECKED_IN") {
      // Mark assigned tables as OCCUPIED
      for (const table of assignedTables) {
        if (table.status !== "OCCUPIED") {
          await prisma.table.update({
            where: { id: table.id },
            data: { status: "OCCUPIED" },
          })
          await dispatchWebhookEvent(user.restaurantId, "table.status_changed", table.id, {
            tableId: table.id,
            number: table.number,
            status: "OCCUPIED",
            updatedAt: new Date().toISOString(),
          }).catch(console.error)
        }
      }
    } else if (["CANCELLED", "NO_SHOW"].includes(targetBookingStatus)) {
      // Release tables (mark as AVAILABLE)
      // We also release tables that were previously assigned
      const tablesToRelease = Array.isArray(tableIds) ? existingBooking.tables : assignedTables
      for (const table of tablesToRelease) {
        await prisma.table.update({
          where: { id: table.id },
          data: { status: "AVAILABLE" },
        })
        await dispatchWebhookEvent(user.restaurantId, "table.status_changed", table.id, {
          tableId: table.id,
          number: table.number,
          status: "AVAILABLE",
          updatedAt: new Date().toISOString(),
        }).catch(console.error)
      }
    } else if (targetBookingStatus === "CONFIRMED" && Array.isArray(tableIds)) {
      // If reassigned back to CONFIRMED, set any tables that are no longer assigned to AVAILABLE
      const oldTableIds = existingBooking.tables.map(t => t.id)
      const removedTableIds = oldTableIds.filter(id => !tableIds.includes(id))
      for (const tid of removedTableIds) {
        const t = await prisma.table.update({
          where: { id: tid },
          data: { status: "AVAILABLE" },
        })
        await dispatchWebhookEvent(user.restaurantId, "table.status_changed", tid, {
          tableId: tid,
          number: t.number,
          status: "AVAILABLE",
          updatedAt: new Date().toISOString(),
        }).catch(console.error)
      }
    }

    // 4. Dispatch booking webhook event
    const eventName = targetBookingStatus === "CANCELLED" ? "booking.cancelled" : "booking.updated"
    await dispatchWebhookEvent(user.restaurantId, eventName, updatedBooking.id, {
      bookingId: updatedBooking.id,
      status: updatedBooking.status,
      dateTime: updatedBooking.dateTime.toISOString(),
      partySize: updatedBooking.partySize,
      customer: {
        name: updatedBooking.customer.name,
        email: updatedBooking.customer.email,
        phone: updatedBooking.customer.phone,
      },
      tables: updatedBooking.tables.map(t => ({ id: t.id, number: t.number })),
    }).catch(console.error)

    return NextResponse.json({ status: "success", data: updatedBooking })
  } catch (err) {
    console.error("[Dashboard Bookings ID PUT] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/bookings/[id]
 * Deletes a booking from the database and releases its tables.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true },
  })

  if (!user?.restaurantId) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  }

  const { id } = await params

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id,
        branch: { restaurantId: user.restaurantId },
      },
      include: {
        tables: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Release tables before deletion
    for (const table of booking.tables) {
      await prisma.table.update({
        where: { id: table.id },
        data: { status: "AVAILABLE" },
      })
      await dispatchWebhookEvent(user.restaurantId, "table.status_changed", table.id, {
        tableId: table.id,
        number: table.number,
        status: "AVAILABLE",
        updatedAt: new Date().toISOString(),
      }).catch(console.error)
    }

    await prisma.booking.delete({
      where: { id },
    })

    return NextResponse.json({ status: "success", message: "Booking deleted successfully" })
  } catch (err) {
    console.error("[Dashboard Bookings ID DELETE] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
