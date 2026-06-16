import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import prisma from "@/lib/prisma"

const redis = Redis.fromEnv()
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
  const cached = await redis.get(cacheKey)
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
        schedules: { where: { dayOfWeek } },
        tableTypes: {
          where: {
            minCapacity: { lte: partySize },
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
      await redis.setex(cacheKey, CACHE_TTL, result)
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
          }
        } catch (err) {
          console.error("[Cal.com availability error]:", err)
          // Fallback: all slots available for dev
          for (const slot of slots) {
            availabilityMap[slot] = true
          }
        }
      }
    } else {
      // Dev/mock mode: all slots available
      for (const slot of slots) {
        availabilityMap[slot] = true
      }
    }

    // ── Count existing bookings to detect "last table" state ──
    const bookingCounts = await prisma.booking.groupBy({
      by: ["dateTime"],
      where: {
        branchId,
        dateTime: {
          gte: new Date(`${date}T00:00:00Z`),
          lte: new Date(`${date}T23:59:59Z`),
        },
        status: { in: ["CONFIRMED", "CHECKED_IN", "PENDING_PAYMENT"] },
      },
      _count: { id: true },
    })

    const totalTables = branch.tableTypes.reduce((sum: number, t: any) => sum + t.quantity, 0)
    const bookedBySlot: Record<string, number> = {}
    for (const bc of bookingCounts) {
      const t = bc.dateTime.toISOString().slice(11, 16)
      bookedBySlot[t] = (bookedBySlot[t] || 0) + bc._count.id
    }

    const slotData = slots.map((time) => {
      const booked = bookedBySlot[time] || 0
      const available = availabilityMap[time] !== false
      const remaining = totalTables - booked
      return {
        time,
        available: available && remaining > 0,
        isLastTable: available && remaining === 1,
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

    await redis.setex(cacheKey, CACHE_TTL, result)
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
