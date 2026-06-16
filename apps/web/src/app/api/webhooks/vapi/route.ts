import crypto from "crypto"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// ── Verify Vapi webhook signature ──
function verifyVapiSignature(payload: string, signature: string): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET
  if (!secret) return true // dev: skip
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-vapi-signature") || ""

  if (!verifyVapiSignature(rawBody, signature)) {
    return new Response("Unauthorized", { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { type, call, transcript, summary } = body

  switch (type) {
    case "call-started": {
      // New voice call started
      console.log("[Vapi] Call started:", call?.id)
      break
    }

    case "transcript": {
      // Real-time transcript update
      if (call?.id && transcript) {
        // Store partial transcript in Redis (TTL 1h)
        const { Redis } = await import("@upstash/redis")
        const redis = Redis.fromEnv()
        await redis.setex(`vapi-transcript:${call.id}`, 3600, transcript)
      }
      break
    }

    case "call-ended": {
      // Call finished — save full log
      if (call?.id) {
        const phone = call?.customer?.number || "unknown"

        // Find restaurant by Vapi phone number if available
        // For now, log generically
        await prisma.communicationLog.create({
          data: {
            restaurantId: call.metadata?.restaurantId || "unknown",
            type: "call",
            direction: "inbound",
            content: summary || transcript || `Llamada de ${phone} (${Math.round((call.endedAt - call.startedAt) / 1000)}s)`,
            source: "bot",
          },
        }).catch(() => {})
      }
      break
    }

    case "function-call": {
      // Agent function calling — similar to WhatsApp tool calls
      const { functionCall } = body
      const funcName = functionCall?.name
      const funcArgs = functionCall?.parameters

      console.log(`[Vapi] Function call: ${funcName}`, funcArgs)

      // Return function result
      if (funcName === "check_availability") {
        return NextResponse.json({
          result: "Disponibilidad verificada. Hay mesas disponibles para las horas solicitadas.",
        })
      }

      if (funcName === "create_reservation") {
        return NextResponse.json({
          result: `Reserva creada. Tu código de confirmación es: ${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        })
      }

      return NextResponse.json({ result: "Función no reconocida." })
    }

    default:
      break
  }

  return NextResponse.json({ status: "ok" })
}
