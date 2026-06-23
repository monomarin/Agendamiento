import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import prisma from "@/lib/prisma"

const CACHE_TTL = 60 // seconds

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const date = searchParams.get("date")     // YYYY-MM-DD
  const partySize = parseInt(searchParams.get("partySize") || "2", 10)

  if (!branchId || !date) {
    return NextResponse.json({ error: "branchId and date are required" }, { status: 400 })
  }

  // ── Cache key ──
  const cacheKey = `availability:${branchId}:${date}:${partySize}`
  const cached = redis ? await redis.get(cacheKey) : null
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    })
  }

  try {
    // ── Check if branch is open on this day ──
    const dayOfWeek = new Date(date + "T12:00:00").getDay() // 0=Sun...6=Sat
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        restaurant: { select: { timezone: true } },
        schedules: { where: { dayOfWeek } },
        tableTypes: {
          where: {
            minCapacity: { lte: partySize === 1 ? 2 : partySize },
            maxCapacity: { gte: partySize },
          },
          select: { id: true, name: true, calcomEventId: true, quantity: true },
        },
      },
    })

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    const schedule = branch.schedules[0]

    if (!schedule || schedule.isClosed) {
      const result = { date, level: "closed", slots: [] }
      if (redis) await redis.setex(cacheKey, CACHE_TTL, result)
      return NextResponse.json(result)
    }

    // ── Generate time slots from schedule ──
    const slots = generateTimeSlots(schedule.openTime, schedule.closeTime)

    // ── Check Cal.com availability for relevant table types ──
    const calcomApiUrl = process.env.CALCOM_API_URL
    const calcomApiKey = process.env.CALCOM_API_KEY

    let availabilityMap: Record<string, boolean> = {}

    if (calcomApiUrl && calcomApiKey && branch.tableTypes.length > 0) {
      const eventTypeId = branch.tableTypes[0]?.calcomEventId
      if (eventTypeId) {
        try {
          const calRes = await fetch(
            `${calcomApiUrl}/slots?eventTypeId=${eventTypeId}&startTime=${date}T${schedule.openTime}:00Z&endTime=${date}T${schedule.closeTime}:00Z&timeZone=America/Bogota`,
            {
              headers: { Authorization: `Bearer ${calcomApiKey}` },
              next: { revalidate: 60 },
            }
          )
          if (calRes.ok) {
            const calData = await calRes.json()
            // Cal.com returns { slots: { [dateKey]: [{ time }] } }
            const dateSlots: { time: string }[] = calData.slots?.[date] || []
            for (const slot of dateSlots) {
              const t = slot.time.slice(11, 16) // Extract HH:MM from ISO
              availabilityMap[t] = true
            }
          } else {
            // Cal.com returned error — fall back to all available
            for (const slot of slots) {
              availabilityMap[slot] = true
            }
          }
        } catch (err) {
          console.error("[Cal.com availability error]:", err)
          // Fallback: all slots available for dev
          for (const slot of slots) {
            availabilityMap[slot] = true
          }
        }
      } else {
        // No calcomEventId configured — fall back to all available
        for (const slot of slots) {
          availabilityMap[slot] = true
        }
      }
    } else {
      // Dev/mock mode or no table types: all slots available
      for (const slot of slots) {
        availabilityMap[slot] = true
      }
    }

    const timezone = branch.restaurant?.timezone || "America/Bogota"
    const startOfDayUTC = parseLocalDateInTimezone(date, "00:00", timezone)
    const endOfDayUTC = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000 - 1000)

    // ── Count existing bookings to detect "last table" state ──
    const bookingCounts = await prisma.booking.groupBy({
      by: ["dateTime"],
      where: {
        branchId,
        dateTime: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
        status: { in: ["CONFIRMED", "CHECKED_IN", "PENDING_PAYMENT"] },
      },
      _count: { id: true },
    })

    // If no matching table types found, treat as unlimited capacity (all slots available)
    const totalTables = branch.tableTypes.reduce((sum: number, t: any) => sum + t.quantity, 0)
    const hasTableConstraint = totalTables > 0

    const bookedBySlot: Record<string, number> = {}
    for (const bc of bookingCounts) {
      const t = formatTimeInTimezone(bc.dateTime, timezone)
      bookedBySlot[t] = (bookedBySlot[t] || 0) + bc._count.id
    }

    const slotData = slots.map((time) => {
      const booked = bookedBySlot[time] || 0
      const available = availabilityMap[time] !== false
      // If no table types configured, only block by Cal.com availability (availabilityMap)
      const remaining = hasTableConstraint ? totalTables - booked : Infinity
      return {
        time,
        available: available && remaining > 0,
        isLastTable: hasTableConstraint && available && remaining === 1,
      }
    })

    // ── Determine day level ──
    const availableCount = slotData.filter((s) => s.available).length
    const ratio = slotData.length > 0 ? availableCount / slotData.length : 0
    const level =
      availableCount === 0 ? "full" :
      ratio < 0.2 ? "partial" :
      ratio < 0.5 ? "partial" : "available"

    const result = { date, level, slots: slotData }

    if (redis) await redis.setex(cacheKey, CACHE_TTL, result)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Availability API Error]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── Helpers ──
function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = []
  const [openH, openM] = openTime.split(":").map(Number)
  const [closeH, closeM] = closeTime.split(":").map(Number)

  let h = openH
  let m = openM

  const closeTotal = closeH * 60 + closeM - 90 // Stop 90 min before close

  while (h * 60 + m <= closeTotal) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    m += 30
    if (m >= 60) {
      m -= 60
      h++
    }
  }

  return slots
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

function formatTimeInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
  
  const parts = formatter.formatToParts(date)
  let hour = ""
  let minute = ""
  for (const part of parts) {
    if (part.type === "hour") hour = part.value;
    if (part.type === "minute") minute = part.value;
  }
  
  if (hour === "24") hour = "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
