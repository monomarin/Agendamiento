import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

/**
 * Envía un correo electrónico al propietario del restaurante informando
 * que su webhook ha sido suspendido por fallos consecutivos.
 */
export async function sendWebhookSuspendedEmail(
  toEmail: string,
  webhookUrl: string,
  restaurantName: string
) {
  if (!resend || process.env.RESEND_API_KEY === "re_placeholder") {
    console.log(
      `[MOCK EMAIL] Enviando correo a ${toEmail}: El webhook a ${webhookUrl} ha sido suspendido debido a 5 fallos consecutivos para el restaurante ${restaurantName}.`
    )
    return
  }

  try {
    await resend.emails.send({
      from: "iAgenda Webhooks <onboarding@resend.dev>", // Usar remitente por defecto de Resend en desarrollo/test
      to: toEmail,
      subject: `⚠️ Webhook Suspendido - ${restaurantName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #dc2626; margin-top: 0;">Tu webhook ha sido suspendido</h2>
          <p>Hola,</p>
          <p>Te informamos que el webhook configurado hacia la siguiente URL ha fallado <strong>5 veces consecutivas</strong> para tu restaurante <strong>${restaurantName}</strong>:</p>
          <p style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-all;">
            ${webhookUrl}
          </p>
          <p>Para evitar problemas de rendimiento y reintentos innecesarios, el sistema ha <strong>suspendido temporalmente</strong> este webhook.</p>
          <p>Por favor verifica que tu servidor esté respondiendo correctamente y luego reactiva el webhook en el Dashboard de iAgenda.</p>
          <div style="margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/configuracion" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Ir al Dashboard
            </a>
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Este es un mensaje automático de iAgenda. Por favor, no respondas a este correo.</p>
        </div>
      `,
    })
    console.log(`[Email] Correo de suspensión enviado a ${toEmail}`)
  } catch (error) {
    console.error("[Email] Error al enviar correo de suspensión:", error)
  }
}
