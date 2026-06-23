import { NextResponse } from "next/server"
export const dynamic = "force-dynamic"
import { redis } from "@/lib/redis"
import prisma from "@/lib/prisma"

const CACHE_TTL = 2 * 60 // 2 minutes for month summary

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const year = parseInt(searchParams.get("year") || "0", 10)
  const month = parseInt(searchParams.get("month") || "0", 10)
  const partySize = parseInt(searchParams.get("partySize") || "2", 10)

  if (!branchId || !year || !month) {
    return NextResponse.json({}, { status: 400 })
  }

  const cacheKey = `month-summary:${branchId}:${year}-${month}:${partySize}`
  const cached = redis ? await redis.get(cacheKey) : null
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } })
  }

  try {
    // Get schedules for the branch
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { schedules: true },
    })
    if (!branch) return NextResponse.json({})

    // Build month summary
    const summary: Record<string, "available" | "partial" | "full" | "closed"> = {}
    const daysInMonth = new Date(year, month, 0).getDate()

    // Get all bookings for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)
    const bookings = await prisma.booking.findMany({
      where: {
        branchId,
        dateTime: { gte: startDate, lte: endDate },
        status: { in: ["CONFIRMED", "CHECKED_IN", "PENDING_PAYMENT"] },
      },
      select: { dateTime: true },
    })

    const totalTables = await prisma.tableType.aggregate({
      where: {
        branchId,
        minCapacity: { lte: partySize === 1 ? 2 : partySize },
        maxCapacity: { gte: partySize },
      },
      _sum: { quantity: true },
    })
    const tableCount = totalTables._sum.quantity || 1

    // Count bookings by date
    const bookingsByDate: Record<string, number> = {}
    for (const b of bookings) {
      const d = b.dateTime.toISOString().slice(0, 10)
      bookingsByDate[d] = (bookingsByDate[d] || 0) + 1
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day)
      const dateStr = d.toISOString().slice(0, 10)
      const dow = d.getDay()
      const schedule = branch.schedules.find((s: any) => s.dayOfWeek === dow)

      if (!schedule || schedule.isClosed) {
        summary[dateStr] = "closed"
        continue
      }

      const booked = bookingsByDate[dateStr] || 0
      
      // Calculate realistic available slots
      // openTime and closeTime stored as "HH:MM"
      const [openH, openM] = (schedule.openTime || "12:00").split(":").map(Number)
      const [closeH, closeM] = (schedule.closeTime || "23:00").split(":").map(Number)
      const openMins = openH * 60 + openM
      const closeMins = closeH * 60 + closeM - 90 // last slot 90 min before close
      const slotCount = Math.max(1, Math.floor((closeMins - openMins) / 30))
      
      // Total "capacity events" per day = tables × slots
      const totalCapacity = tableCount * slotCount
      
      // booked is the count of booking rows for this date
      const ratio = totalCapacity > 0 ? booked / totalCapacity : 0

      summary[dateStr] = ratio >= 0.9 ? "full" : ratio >= 0.5 ? "partial" : "available"
    }

    if (redis) await redis.setex(cacheKey, CACHE_TTL, summary)
    return NextResponse.json(summary)
  } catch (err: any) {
    console.error("[Month summary error]:", err)
    return NextResponse.json({})
  }
}
