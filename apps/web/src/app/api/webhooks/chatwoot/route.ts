import crypto from "crypto"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// ── Verify Chatwoot webhook signature ──
function verifyChatwootSignature(payload: string, signature: string): boolean {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
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
  const signature = req.headers.get("x-chatwoot-signature") || ""

  if (!verifyChatwootSignature(rawBody, signature)) {
    return new Response("Unauthorized", { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event = body.event

  // ── Handle relevant events ──
  switch (event) {
    case "message_created": {
      const { content, message_type, conversation } = body
      if (!conversation?.id) break

      // Log inbound customer messages
      if (message_type === "incoming") {
        const restaurantSlug = conversation?.meta?.sender?.phone_number || ""
        // Try to find restaurant by phone in agents
        await prisma.communicationLog.create({
          data: {
            restaurantId: "unknown", // Update with proper lookup if needed
            type: "webchat",
            direction: "inbound",
            content: content || "",
            source: "human",
          },
        }).catch(() => {})
      }
      break
    }

    case "conversation_created": {
      // A new conversation started — could trigger AI takeover
      console.log("[Chatwoot] New conversation:", body.id)
      break
    }

    case "conversation_resolved": {
      console.log("[Chatwoot] Conversation resolved:", body.id)
      break
    }

    default:
      break
  }

  return NextResponse.json({ status: "ok" })
}
