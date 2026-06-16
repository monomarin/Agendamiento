import crypto from "crypto"
import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import prisma from "@/lib/prisma"

const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, "1 m"),
  prefix: "whatsapp-webhook",
})

// ── Verify Meta X-Hub-Signature-256 ──
function verifyMetaSignature(payload: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) return false
  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex")}`
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// ── GET: Meta webhook verification ──
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response("Forbidden", { status: 403 })
}

// ── POST: Incoming WhatsApp messages ──
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"
  const { success: rateLimitOk } = await ratelimit.limit(ip)
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get("x-hub-signature-256") || ""

  // Verify HMAC signature
  if (process.env.META_APP_SECRET && !verifyMetaSignature(rawBody, signature)) {
    console.error("[WhatsApp webhook] Invalid signature")
    return new Response("Unauthorized", { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Extract message
  const entry = body.entry?.[0]
  const change = entry?.changes?.[0]
  const value = change?.value
  const message = value?.messages?.[0]

  if (!message || message.type !== "text") {
    // Acknowledge non-text messages
    return NextResponse.json({ status: "ok" })
  }

  const fromPhone = message.from          // Sender's WhatsApp number
  const msgText = message.text?.body || ""
  const whatsappNumberId = value.metadata?.phone_number_id

  // Find restaurant by WhatsApp phone number ID
  const agent = await prisma.whatsAppAgent.findFirst({
    where: { phoneNumberId: whatsappNumberId, isActive: true },
    include: {
      restaurant: {
        include: {
          branches: {
            where: { isActive: true },
            include: {
              schedules: true,
              tableTypes: { select: { name: true, minCapacity: true, maxCapacity: true, calcomEventId: true } },
            },
            take: 1,
          },
        },
      },
    },
  })

  if (!agent) {
    console.error("[WhatsApp webhook] No active agent for phone number ID:", whatsappNumberId)
    return NextResponse.json({ status: "ok" })
  }

  const restaurantId = agent.restaurantId
  const restaurant = agent.restaurant

  // ── Rate limit per restaurant (100 conversations/day in free plan) ──
  const restaurantRateKey = `whatsapp-restaurant:${restaurantId}`
  const restaurantUsage = (await redis.incr(restaurantRateKey)) as number
  if (restaurantUsage === 1) {
    await redis.expire(restaurantRateKey, 86400) // Reset daily
  }
  if (restaurantUsage > 100) {
    console.warn(`[WhatsApp] Restaurant ${restaurantId} exceeded daily limit`)
    return NextResponse.json({ status: "ok" })
  }

  // ── Load or initialize conversation from Redis ──
  const convKey = `conversation:${restaurantId}:${fromPhone}`
  const existingConv: any[] = (await redis.get(convKey)) || []
  
  // Check first-message consent requirement
  const isFirstMessage = existingConv.length === 0
  
  // Add user message to history
  existingConv.push({ role: "user", content: msgText })

  // ── Build system prompt (cached in Redis) ──
  const systemPrompt = await buildSystemPrompt(restaurantId, restaurant)

  // ── Record consent on first message ──
  if (isFirstMessage) {
    try {
      await prisma.consentRecord.create({
        data: {
          clientEmail: `whatsapp-${fromPhone}@noemail.iagenda`,
          restaurantId,
          policyVersion: "2026-06",
          ipAddress: fromPhone,
        },
      })
    } catch {
      // May already exist
    }
  }

  // ── Process with OpenAI (if key configured) ──
  const openaiKey = process.env.OPENAI_API_KEY
  let replyText: string

  if (openaiKey) {
    try {
      replyText = await processWithOpenAI(systemPrompt, existingConv, restaurantId, restaurant)
    } catch (err) {
      console.error("[OpenAI Error]:", err)
      replyText = "Lo siento, estoy teniendo dificultades técnicas. Por favor, llámanos directamente."
    }
  } else {
    // Dev/mock mode
    replyText = `¡Hola! Bienvenido a ${restaurant.name}. Estoy aquí para ayudarte con tu reserva. ¿Para cuántas personas y qué fecha tienes en mente?`
  }

  // Add assistant reply to history
  existingConv.push({ role: "assistant", content: replyText })

  // Save conversation to Redis with 24h TTL
  await redis.setex(convKey, 86400, existingConv)

  // ── Save conversation log to DB (async-safe) ──
  await prisma.communicationLog.create({
    data: {
      restaurantId,
      type: "whatsapp",
      direction: "inbound",
      content: msgText,
      source: "bot",
    },
  })

  // ── Send reply via Meta WhatsApp API ──
  await sendWhatsAppMessage(fromPhone, replyText, whatsappNumberId)

  return NextResponse.json({ status: "ok" })
}

// ── Helper: Build system prompt (cached 10 min in Redis) ──
async function buildSystemPrompt(restaurantId: string, restaurant: any): Promise<string> {
  const cacheKey = `system-prompt:${restaurantId}`
  const cached = await redis.get(cacheKey)
  if (cached) return cached as string

  const branch = restaurant.branches?.[0]
  const scheduleStr = branch?.schedules
    ?.map((s: any) => {
      if (s.isClosed) return null
      const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
      return `${days[s.dayOfWeek]}: ${s.openTime}-${s.closeTime}`
    })
    .filter(Boolean)
    .join(", ") || "Consultar disponibilidad"

  const tablesStr = branch?.tableTypes
    ?.map((t: any) => `${t.name}: ${t.minCapacity}-${t.maxCapacity} personas`)
    .join("\n") || "Mesas disponibles para 2-8 personas"

  const prompt = `Eres el asistente virtual de ${restaurant.name}, un ${restaurant.type} ubicado en ${restaurant.city || "Colombia"}.

PERSONALIDAD: Amigable, profesional y eficiente. Responde siempre en español (o en el idioma del cliente).

HORARIOS: ${scheduleStr}

MESAS DISPONIBLES:
${tablesStr}

REGLAS ESTRICTAS:
- NUNCA inventes disponibilidad. USA SOLO la herramienta check_availability para verificar.
- Para grupos de más de 10 personas: solicita contacto directo.
- Si el cliente quiere cancelar: usa cancel_reservation.
- Máximo 3 respuestas de herramientas por turno (loop guard).
- Si no puedes ayudar: deriva al teléfono del restaurante.
- SIEMPRE confirma: nombre, fecha, hora y número de personas antes de crear la reserva.

FLUJO DE RESERVA:
1. Saluda y pregunta para cuántas personas y qué fecha/hora.
2. Verifica disponibilidad con check_availability.
3. Pide: nombre completo y correo electrónico del cliente.
4. Crea la reserva con create_reservation.
5. Confirma los detalles y el código de confirmación.`

  await redis.setex(cacheKey, 600, prompt) // 10 min cache
  return prompt
}

// ── Helper: Process with OpenAI + Loop Guard ──
async function processWithOpenAI(
  systemPrompt: string,
  messages: any[],
  restaurantId: string,
  restaurant: any
): Promise<string> {
  const MAX_TOOL_CALLS = 3
  let iterations = 0

  const AGENT_TOOLS = [
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Verificar disponibilidad de mesas para una fecha, hora y número de personas",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
            time: { type: "string", description: "Hora en formato HH:MM" },
            party_size: { type: "number", description: "Número de personas" },
          },
          required: ["date", "time", "party_size"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_reservation",
        description: "Crear una reserva en el sistema",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nombre completo del cliente" },
            email: { type: "string", description: "Email del cliente" },
            phone: { type: "string", description: "Teléfono del cliente" },
            date: { type: "string", description: "Fecha YYYY-MM-DD" },
            time: { type: "string", description: "Hora HH:MM" },
            party_size: { type: "number", description: "Número de personas" },
            notes: { type: "string", description: "Notas adicionales" },
          },
          required: ["name", "email", "date", "time", "party_size"],
        },
      },
    },
  ]

  const allMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ]

  // Dynamic import to avoid bundling issues
  const { OpenAI } = await import("openai")
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let currentResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: allMessages as any,
    tools: AGENT_TOOLS as any,
    max_tokens: 500,
  })

  // ── Loop Guard ──
  while (currentResponse.choices[0]?.message?.tool_calls && iterations < MAX_TOOL_CALLS) {
    const toolCalls = currentResponse.choices[0].message.tool_calls
    allMessages.push(currentResponse.choices[0].message as any)

    const toolResults = await Promise.all(
      toolCalls.map(async (tc: any) => {
        const args = JSON.parse(tc.function.arguments)
        let result: string

        if (tc.function.name === "check_availability") {
          result = await checkAvailabilityTool(restaurantId, args)
        } else if (tc.function.name === "create_reservation") {
          result = await createReservationTool(restaurantId, restaurant, args)
        } else {
          result = "Herramienta no disponible"
        }

        return {
          role: "tool" as const,
          tool_call_id: tc.id,
          content: result,
        }
      })
    )

    allMessages.push(...toolResults)
    iterations++

    currentResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: allMessages as any,
      tools: AGENT_TOOLS as any,
      max_tokens: 500,
    })
  }

  // If we hit the loop guard limit, send fallback
  if (iterations >= MAX_TOOL_CALLS && currentResponse.choices[0]?.message?.tool_calls) {
    return "¿Puedo ayudarte de alguna otra manera? Puedes también llamarnos directamente para hacer tu reserva."
  }

  return currentResponse.choices[0]?.message?.content || "No pude procesar tu solicitud en este momento."
}

// ── Tool: Check availability ──
async function checkAvailabilityTool(restaurantId: string, args: any): Promise<string> {
  try {
    const branch = await prisma.branch.findFirst({
      where: { restaurantId, isActive: true },
      select: { id: true },
    })
    if (!branch) return "No se encontró la sede del restaurante."

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/availability?branchId=${branch.id}&date=${args.date}&partySize=${args.party_size}`
    )
    const data = await res.json()

    if (data.level === "closed") return `El restaurante está cerrado el ${args.date}.`
    if (data.level === "full") return `No hay disponibilidad para el ${args.date}. Te recomiendo elegir otra fecha.`

    const availableSlots = data.slots?.filter((s: any) => s.available).map((s: any) => s.time) || []
    if (availableSlots.length === 0) return `No hay mesas disponibles para ${args.party_size} personas el ${args.date}.`

    return `✅ Hay disponibilidad para ${args.party_size} personas el ${args.date}. Horarios disponibles: ${availableSlots.join(", ")}.`
  } catch {
    return "Error al verificar disponibilidad. Por favor intenta de nuevo."
  }
}

// ── Tool: Create reservation ──
async function createReservationTool(restaurantId: string, restaurant: any, args: any): Promise<string> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/bookings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: restaurant.branches?.[0]?.id,
          partySize: args.party_size,
          eventType: "WhatsApp",
          specialRequests: args.notes || "",
          date: args.date,
          time: args.time,
          customer: {
            name: args.name,
            email: args.email,
            phone: args.phone || "",
            hasConsent: true,
          },
        }),
      }
    )
    const data = await res.json()
    if (data.success) {
      return `✅ ¡Reserva creada con éxito! Tu código de confirmación es: *${data.confirmationCode}*. Te enviaremos un recordatorio 24 horas antes.`
    }
    return `No se pudo crear la reserva: ${data.message || "Error desconocido"}.`
  } catch {
    return "Error al crear la reserva. Por favor intenta de nuevo."
  }
}

// ── Helper: Send WhatsApp message via Meta API ──
async function sendWhatsAppMessage(to: string, text: string, phoneNumberId: string): Promise<void> {
  const token = process.env.META_WHATSAPP_TOKEN
  if (!token) {
    console.log(`[WhatsApp Mock] To: ${to} | Message: ${text}`)
    return
  }

  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    })
  } catch (err) {
    console.error("[WhatsApp send error]:", err)
  }
}
