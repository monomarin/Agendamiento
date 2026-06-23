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
      include: {
        restaurant: { select: { timezone: true } },
        schedules: true,
      },
    })
    if (!branch) return NextResponse.json({})

    // Build month summary
    const summary: Record<string, "available" | "partial" | "full" | "closed"> = {}
    const daysInMonth = new Date(year, month, 0).getDate()

    const timezone = branch.restaurant?.timezone || "America/Bogota"

    // Get all bookings for the month bounded by local month days converted to UTC
    const startMonthStr = `${year}-${String(month).padStart(2, "0")}-01`
    const startOfMonthUTC = parseLocalDateInTimezone(startMonthStr, "00:00", timezone)
    
    const endMonthStr = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`
    const endOfMonthUTC = new Date(parseLocalDateInTimezone(endMonthStr, "00:00", timezone).getTime() + 24 * 60 * 60 * 1000 - 1000)

    const bookings = await prisma.booking.findMany({
      where: {
        branchId,
        dateTime: { gte: startOfMonthUTC, lte: endOfMonthUTC },
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
      const d = formatDateInTimezone(b.dateTime, timezone)
      bookingsByDate[d] = (bookingsByDate[d] || 0) + 1
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const d = new Date(dateStr + "T12:00:00")
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

function parseLocalDateInTimezone(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)
  
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute))
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  })
  
  const formattedParts = formatter.formatToParts(utcDate)
  const parts: Record<string, number> = {}
  for (const part of formattedParts) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value)
    }
  }
  
  const targetLocalTime = Date.UTC(year, month - 1, day, hour, minute)
  const actualLocalTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute
  )
  
  const diff = targetLocalTime - actualLocalTime
  return new Date(utcDate.getTime() + diff)
}

function formatDateInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  let year = ""
  let month = ""
  let day = ""
  for (const part of parts) {
    if (part.type === "year") year = part.value
    if (part.type === "month") month = part.value
    if (part.type === "day") day = part.value
  }
  return `${year}-${month}-${day}`
}
