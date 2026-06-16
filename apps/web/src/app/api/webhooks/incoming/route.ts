import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { dispatchWebhookEvent } from "@/lib/webhook-queue"

const POS_SECRET = process.env.POS_INCOMING_WEBHOOK_SECRET ?? "pos_secret_placeholder"

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false
  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex")
  
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }
  
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

/**
 * POST /api/webhooks/incoming
 * Recibe eventos desde un POS externo (e.g. Vendty, SoftRestaurant)
 * para realizar acciones como liberar mesas físicas al pagar la cuenta.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-pos-signature")
  const rawBody = await req.text()

  // 1. Verificar firma HMAC
  const isValid = verifySignature(rawBody, signature, POS_SECRET)
  if (!isValid) {
    return NextResponse.json({ error: "Firma inválida o no provista" }, { status: 401 })
  }

  // 2. Parsear el cuerpo del webhook
  let data: {
    event?: string
    tableNumber?: string
    restaurantId?: string
  }

  try {
    data = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const { event, tableNumber, restaurantId } = data

  if (!event || !tableNumber || !restaurantId) {
    return NextResponse.json(
      { error: "validation_error", message: "event, tableNumber, and restaurantId are required" },
      { status: 400 }
    )
  }

  // 3. Procesar el evento
  if (event === "bill_paid" || event === "order.completed" || event === "table.released") {
    // Buscar el mapeo de la mesa para el restaurante
    const mapping = await prisma.posTableMapping.findFirst({
      where: {
        restaurantId,
        posTableNumber: tableNumber,
      },
    })

    if (!mapping) {
      return NextResponse.json(
        { error: "mapping_not_found", message: `No table mapping found for POS table number: ${tableNumber}` },
        { status: 404 }
      )
    }

    // Actualizar el estado de la mesa física en Antigravity a AVAILABLE
    await prisma.table.update({
      where: { id: mapping.antigravityTableId },
      data: { status: "AVAILABLE" },
    })

    // Disparar webhook saliente para notificar a otras integraciones
    await dispatchWebhookEvent(restaurantId, "table.status_changed", "", {
      tableId: mapping.antigravityTableId,
      status: "AVAILABLE",
      posTableNumber: tableNumber,
      releasedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: `Table ${tableNumber} (Antigravity ID: ${mapping.antigravityTableId}) successfully released.`,
    })
  }

  return NextResponse.json({ received: true, message: `Event '${event}' not processed.` })
}
