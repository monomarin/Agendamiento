import { Resend } from "resend"
import { format } from "date-fns"
import { es } from "date-fns/locale"

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

/**
 * Envía el correo de invitación al staff con el link de aceptación.
 */
export async function sendStaffInvitationEmail(params: {
  toEmail: string
  restaurantName: string
  inviterName: string
  role: string
  inviteUrl: string
}) {
  const { toEmail, restaurantName, inviterName, role, inviteUrl } = params

  const roleLabels: Record<string, string> = {
    MANAGER: "Gerente / Manager",
    HOSTESS: "Recepcionista / Hostess",
    WAITER: "Mesero / Operador",
  }
  const roleLabel = roleLabels[role] ?? role

  if (!resend || process.env.RESEND_API_KEY === "re_placeholder") {
    console.log(
      `[MOCK EMAIL] Invitación de staff a ${toEmail}: ${inviteUrl}`
    )
    return { id: "mock-email-id" }
  }

  try {
    const result = await resend.emails.send({
      from: "iAgenda <no-reply@resend.dev>",
      to: toEmail,
      subject: `Invitación para unirte a ${restaurantName} en iAgenda`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; border-radius: 12px; overflow: hidden;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1a0000 0%, #0a0a0a 100%); padding: 32px 40px; border-bottom: 1px solid #262626;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; background: #dc2626; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: white; box-shadow: 0 0 20px rgba(220,38,38,0.4);">
                i
              </div>
              <span style="font-size: 18px; font-weight: 600; color: #ffffff; margin-left: 8px;">
                iAgenda <span style="color: #ef4444; font-weight: 300; font-size: 13px;">by iAgentes</span>
              </span>
            </div>
          </div>

          <!-- Body -->
          <div style="padding: 40px;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 12px 0; font-weight: 700;">
              Has sido invitado/a 🎉
            </h1>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              <strong style="color: #ffffff;">${inviterName}</strong> te ha invitado a unirte al equipo de
              <strong style="color: #ef4444;">${restaurantName}</strong> en iAgenda con el rol de
              <strong style="color: #ffffff;">${roleLabel}</strong>.
            </p>

            <!-- Invite box -->
            <div style="background: #171717; border: 1px solid #262626; border-radius: 10px; padding: 24px; margin: 0 0 32px 0;">
              <p style="color: #737373; font-size: 13px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Tu rol asignado</p>
              <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0;">${roleLabel}</p>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin: 0 0 32px 0;">
              <a href="${inviteUrl}"
                style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 0 20px rgba(220,38,38,0.35); letter-spacing: 0.01em;">
                Aceptar invitación
              </a>
            </div>

            <p style="color: #525252; font-size: 13px; margin: 0 0 8px 0;">
              O copia y pega este enlace en tu navegador:
            </p>
            <p style="background: #171717; border: 1px solid #262626; border-radius: 6px; padding: 10px 14px; font-family: monospace; font-size: 12px; color: #a3a3a3; word-break: break-all; margin: 0 0 32px 0;">
              ${inviteUrl}
            </p>

            <p style="color: #525252; font-size: 13px; margin: 0;">
              ⏱️ Este enlace expira en <strong style="color: #a3a3a3;">72 horas</strong>. Si no esperabas esta invitación, puedes ignorar este correo.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 40px; border-top: 1px solid #1a1a1a; background: #050505;">
            <p style="color: #404040; font-size: 12px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} iAgentes · Este es un mensaje automático, no respondas a este correo.
            </p>
          </div>
        </div>
      `,
    })
    console.log(`[Email] Invitación enviada a ${toEmail}`)
    return result
  } catch (error) {
    console.error("[Email] Error al enviar invitación de staff:", error)
    throw error
  }
}

/**
 * Sends a booking confirmation email to the customer with all details.
 */
export async function sendBookingConfirmationEmail(params: {
  toEmail: string
  customerName: string
  confirmationCode: string
  dateTime: Date
  partySize: number
  specialRequests: string | null
  branchName: string
  restaurantName: string
  restaurantType: string
  bookingId: string
  slug: string
}) {
  const {
    toEmail,
    customerName,
    confirmationCode,
    dateTime,
    partySize,
    specialRequests,
    branchName,
    restaurantName,
    restaurantType,
    bookingId,
    slug
  } = params

  const isRestaurant = restaurantType === "restaurante" || restaurantType === "bar" || restaurantType === "cafe" || restaurantType === "fast_food"
  const isClinic = restaurantType === "clinica_dental" || restaurantType === "consultorio_medico" || restaurantType === "eps_ips" || restaurantType === "psicologia" || restaurantType === "nutricion" || restaurantType === "fisioterapia" || restaurantType === "laboratorio"
  
  const appointmentWord = isRestaurant ? "reserva" : "cita"
  const attendeesWord = isRestaurant ? "personas" : isClinic ? "pacientes" : "personas"
  
  const formattedDate = format(new Date(dateTime), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  const formattedTime = format(new Date(dateTime), "HH:mm 'hs'", { locale: es })

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://iagendapp.vercel.app"}/${slug}/reservar/consulta?ref=${bookingId}`

  if (!resend || process.env.RESEND_API_KEY === "re_placeholder") {
    console.log(
      `[MOCK EMAIL] Confirmación de ${appointmentWord} enviado a ${toEmail}: código ${confirmationCode}`
    )
    return { id: "mock-email-id" }
  }

  try {
    const result = await resend.emails.send({
      from: "iAgenda <no-reply@resend.dev>",
      to: toEmail,
      subject: `Confirmación de tu ${appointmentWord} - ${restaurantName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #262626;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1f1f1f 0%, #0a0a0a 100%); padding: 32px 40px; border-bottom: 1px solid #262626; text-align: center;">
            <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
              iAgend<span style="color: #dc2626;">app</span>
            </span>
          </div>

          <!-- Body -->
          <div style="padding: 40px;">
            <h1 style="color: #10b981; font-size: 22px; margin: 0 0 16px 0; font-weight: 700; text-align: center;">
              ¡Tu ${appointmentWord} está confirmada! 🎉
            </h1>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
              Hola <strong>${customerName}</strong>, tu ${appointmentWord} en <strong>${restaurantName}</strong> (${branchName}) ha sido confirmada con éxito.
            </p>

            <!-- Code Box -->
            <div style="background: #171717; border: 1px solid #262626; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
              <span style="color: #737373; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 6px;">Código de confirmación</span>
              <strong style="color: #10b981; font-size: 24px; font-family: monospace; letter-spacing: 0.15em;">${confirmationCode}</strong>
            </div>

            <!-- Details Table -->
            <div style="background: #171717; border: 1px solid #262626; border-radius: 10px; padding: 24px; margin: 0 0 32px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="color: #737373; padding: 6px 0; width: 35%;">Fecha:</td>
                  <td style="color: #ffffff; padding: 6px 0; font-weight: 600; text-transform: capitalize;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="color: #737373; padding: 6px 0;">Hora:</td>
                  <td style="color: #ffffff; padding: 6px 0; font-weight: 600;">${formattedTime}</td>
                </tr>
                <tr>
                  <td style="color: #737373; padding: 6px 0;">Asistentes:</td>
                  <td style="color: #ffffff; padding: 6px 0; font-weight: 600;">${partySize} ${partySize === 1 ? attendeesWord.slice(0, -1) : attendeesWord}</td>
                </tr>
                ${specialRequests ? `
                <tr>
                  <td style="color: #737373; padding: 6px 0;">Notas:</td>
                  <td style="color: #ffffff; padding: 6px 0; font-weight: 500;">${specialRequests}</td>
                </tr>
                ` : ""}
              </table>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin: 0 0 32px 0;">
              <a href="${bookingUrl}"
                style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 0 20px rgba(220,38,38,0.35);">
                Ver ticket con código QR
              </a>
            </div>

            <p style="color: #525252; font-size: 12px; text-align: center; margin: 0;">
              Presenta el código QR adjunto en el enlace al llegar al establecimiento para un rápido registro de entrada.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 40px; border-top: 1px solid #1a1a1a; background: #050505;">
            <p style="color: #404040; font-size: 11px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} iAgendapp · Mensaje automático, no respondas a este correo.
            </p>
          </div>
        </div>
      `,
    })
    console.log(`[Email] Confirmación de reserva enviada a ${toEmail}`)
    return result
  } catch (error) {
    console.error("[Email] Error al enviar confirmación de reserva:", error)
  }
}
