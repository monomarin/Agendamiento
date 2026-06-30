"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CheckCircle2, CalendarPlus, Download, QrCode, Share2,
  Users, CalendarDays, Clock, MessageCircle,
} from "lucide-react"

import { useBookingStore } from "@/lib/booking-store"
import { Button } from "@/components/ui/button"

interface ConfirmacionPageProps {
  params: Promise<{ slug: string }>
}

export default function ConfirmacionPage({ params }: ConfirmacionPageProps) {
  const { slug } = React.use(params)
  const store = useBookingStore()
  const {
    bookingId,
    confirmationCode,
    selectedDate,
    selectedTime,
    partySize,
    eventType,
    customer,
  } = store

  const [qrUrl, setQrUrl] = React.useState<string | null>(null)
  const [confettiDone, setConfettiDone] = React.useState(false)

  const formattedDate = selectedDate
    ? format(new Date(selectedDate + "T12:00:00"), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    : "—"

  // Generate QR code URL using a public service
  React.useEffect(() => {
    if (!bookingId) return
    const bookingUrl = `${window.location.origin}/${slug}/reservar/consulta?ref=${bookingId}`
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}&color=FFFFFF&bgcolor=0A0A0A&margin=2`
    setQrUrl(qrApiUrl)
  }, [bookingId, slug])

  // Trigger confetti animation once
  React.useEffect(() => {
    if (confettiDone) return
    setConfettiDone(true)
    // Could integrate canvas-confetti here
  }, [confettiDone])

  // Generate ICS for calendar download
  const generateICS = () => {
    if (!selectedDate || !selectedTime) return
    const [hours, minutes] = selectedTime.split(":").map(Number)
    const startDT = new Date(selectedDate)
    startDT.setHours(hours, minutes, 0, 0)
    const endDT = new Date(startDT.getTime() + 90 * 60 * 1000) // 90 min default

    const formatDT = (dt: Date) =>
      dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//iAgenda//iAgenda//ES",
      "BEGIN:VEVENT",
      `UID:${bookingId}@iagenda.app`,
      `DTSTART:${formatDT(startDT)}`,
      `DTEND:${formatDT(endDT)}`,
      `SUMMARY:Reserva en ${slug} · ${partySize} personas`,
      `DESCRIPTION:Código de confirmación: ${confirmationCode || bookingId}\\nEvento: ${eventType}`,
      `STATUS:CONFIRMED`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")

    const blob = new Blob([icsContent], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reserva-${confirmationCode || bookingId}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleGoogleCalendar = () => {
    if (!selectedDate || !selectedTime) return
    const [hours, minutes] = selectedTime.split(":").map(Number)
    const startDT = new Date(selectedDate)
    startDT.setHours(hours, minutes, 0, 0)
    const endDT = new Date(startDT.getTime() + 90 * 60 * 1000)

    const formatGCal = (dt: Date) =>
      dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

    const url = new URL("https://calendar.google.com/calendar/render")
    url.searchParams.set("action", "TEMPLATE")
    url.searchParams.set("text", `Reserva en ${slug} · ${partySize} personas`)
    url.searchParams.set("dates", `${formatGCal(startDT)}/${formatGCal(endDT)}`)
    url.searchParams.set("details", `Código: ${confirmationCode || bookingId}\nEvento: ${eventType}`)
    window.open(url.toString(), "_blank")
  }

  const handleShare = async () => {
    const shareData = {
      title: `Mi reserva confirmada · ${formattedDate}`,
      text: `Reservé mesa para ${partySize} personas. Código: ${confirmationCode}`,
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        alert("Enlace copiado al portapapeles")
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8 text-center">
      {/* Success animation */}
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center animate-[pulse_2s_ease-in-out_infinite]">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="absolute -inset-2 rounded-full border border-emerald-500/10 animate-ping" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">¡Reserva Confirmada!</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Tu mesa está reservada. Te esperamos con gusto.
          </p>
        </div>
        {confirmationCode && (
          <div className="px-4 py-2 rounded-xl bg-neutral-900/60 border border-emerald-500/20">
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Código de confirmación</p>
            <p className="text-xl font-mono font-bold text-emerald-400 tracking-widest">
              {confirmationCode}
            </p>
          </div>
        )}
      </div>

      {/* Details + QR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
        {/* Booking details */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <h3 className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Detalles</h3>
          <div className="space-y-2 text-sm text-neutral-300">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span className="capitalize">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>{selectedTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>{partySize} {partySize === 1 ? "persona" : "personas"}</span>
            </div>
            {customer && (
              <div className="pt-2 border-t border-neutral-800 space-y-1">
                <p className="text-white font-medium">{customer.name}</p>
                <p className="text-xs text-neutral-500 font-mono">{customer.email}</p>
                <p className="text-xs text-neutral-500">{customer.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* QR Code */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <QrCode className="w-3.5 h-3.5" />
            Muestra este QR al llegar
          </div>
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="QR de confirmación de reserva"
              className="w-36 h-36 rounded-lg border border-neutral-700 object-contain"
            />
          ) : (
            <div className="w-36 h-36 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-neutral-600 text-xs">
              Generando QR...
            </div>
          )}
          {qrUrl && (
            <a
              href={qrUrl}
              download={`qr-reserva-${confirmationCode || bookingId}.png`}
              className="text-[10px] text-[var(--primary)] hover:opacity-80 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Descargar QR
            </a>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Agrega a tu calendario</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            id="add-google-calendar"
            variant="outline"
            onClick={handleGoogleCalendar}
            className="border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 gap-2"
          >
            <CalendarPlus className="w-4 h-4" />
            Google Calendar
          </Button>
          <Button
            id="download-ics"
            variant="outline"
            onClick={generateICS}
            className="border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar .ics
          </Button>
          <Button
            id="share-booking"
            variant="outline"
            onClick={handleShare}
            className="border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 gap-2"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </Button>
        </div>
      </div>

      {/* Info footer */}
      <div className="space-y-2 pb-2">
        <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
          <MessageCircle className="w-3.5 h-3.5 text-green-500" />
          <span>Recibirás un recordatorio por WhatsApp 24h y 2h antes de tu reserva.</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Email de confirmación enviado a {customer?.email || "tu correo"}.</span>
        </div>
      </div>

      {/* CTA back to home */}
      <div className="pt-2 border-t border-neutral-900">
        <Link
          href={`/${slug}/reservar/personas`}
          className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ¿Quieres hacer otra reserva?
        </Link>
      </div>
    </div>
  )
}
