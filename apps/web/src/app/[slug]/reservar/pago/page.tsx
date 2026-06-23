"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CreditCard, Users, CalendarDays, Clock, User, Mail, Phone,
  ChevronLeft, Loader2, AlertCircle, ShieldCheck, CheckCircle2,
  MessageSquare, Edit3,
} from "lucide-react"

import { useBookingStore } from "@/lib/booking-store"
import { Button } from "@/components/ui/button"

// ──────────────────────────────────────────────────────────────────────────────
// Saga state machine
// ──────────────────────────────────────────────────────────────────────────────
type SagaState =
  | "idle"
  | "locking"      // Acquiring Redis lock
  | "processing"   // Cal.com creating booking
  | "payment"      // Payment gateway
  | "finalizing"   // Saving to DB
  | "success"
  | "error"

interface PagoPageProps {
  params: Promise<{ slug: string }>
}

export default function PagoPage({ params }: PagoPageProps) {
  const router = useRouter()
  const { slug } = React.use(params)

  const store = useBookingStore()
  const {
    selectedBranchId,
    partySize,
    eventType,
    specialRequests,
    selectedDate,
    selectedTime,
    customer,
    setBookingId,
    setConfirmationCode,
    setStep,
  } = store

  const [sagaState, setSagaState] = React.useState<SagaState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [requiresPayment, setRequiresPayment] = React.useState(false)
  const [depositInfo, setDepositInfo] = React.useState<{ amount: number; currency: string; type: "FIXED" | "PERCENTAGE" } | null>(null)

  // Load payment info from API
  React.useEffect(() => {
    if (!selectedBranchId) return
    fetch(`/api/branches/${selectedBranchId}/payment-settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.requireDeposit) {
          setRequiresPayment(true)
          setDepositInfo({
            amount: data.depositAmount,
            currency: data.currency,
            type: data.depositType,
          })
        }
      })
      .catch(() => {})
  }, [selectedBranchId])

  const handleBack = () => {
    setStep(3)
    router.push(`/${slug}/reservar/datos`)
  }

  // ── Saga orchestration ──
  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !customer || !selectedBranchId) {
      setErrorMessage("Faltan datos del flujo. Por favor, comienza de nuevo.")
      return
    }

    setErrorMessage(null)
    setSagaState("locking")

    try {
      // Step 1: POST to bookings API — triggers full Saga on server
      setSagaState("processing")
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId,
          partySize,
          eventType,
          specialRequests,
          date: selectedDate,
          time: selectedTime,
          customer,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || "Error al crear la reserva")
      }

      const data = await res.json()

      // Step 2: If payment required, redirect to payment gateway
      if (data.paymentRequired && data.paymentUrl) {
        setSagaState("payment")
        window.location.href = data.paymentUrl
        return
      }

      // Step 3: Save and navigate to success
      setSagaState("finalizing")
      setBookingId(data.bookingId)
      setConfirmationCode(data.confirmationCode)
      setSagaState("success")
      setStep(5)
      router.push(`/${slug}/reservar/confirmacion`)
    } catch (err: any) {
      setSagaState("error")
      setErrorMessage(err.message || "Algo salió mal. Intenta de nuevo.")
    }
  }

  const isLoading = ["locking", "processing", "payment", "finalizing"].includes(sagaState)

  const sagaLabel: Record<SagaState, string> = {
    idle:        "Confirmar Reserva",
    locking:     "Verificando disponibilidad...",
    processing:  "Creando tu reserva...",
    payment:     "Redirigiendo a pago seguro...",
    finalizing:  "Finalizando...",
    success:     "¡Reserva confirmada!",
    error:       "Confirmar Reserva",
  }

  const formattedDate = selectedDate
    ? format(new Date(selectedDate + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })
    : "—"

  const depositLabel = depositInfo
    ? depositInfo.type === "FIXED"
      ? `$${depositInfo.amount.toLocaleString("es-CO")} ${depositInfo.currency}`
      : `${depositInfo.amount}%`
    : null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[var(--primary)]" />
          Confirmar reserva
        </h2>
        <p className="text-neutral-400 text-sm">
          Revisa los detalles y confirma tu reserva.
        </p>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Reservation details */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Detalles de Reserva</h3>
            <button
              onClick={() => router.push(`/${slug}/reservar/personas`)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
              aria-label="Editar detalles de reserva"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
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
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{
                eventType === "Cena casual" ? "🍽️" :
                eventType === "Cena romántica" ? "💑" :
                eventType === "Cumpleaños" ? "🎂" :
                eventType === "Aniversario" ? "🥂" :
                eventType === "Reunión de negocios" ? "💼" :
                eventType === "Celebración especial" ? "🎉" :
                eventType === "Comida familiar" ? "👨‍👩‍👧" : "✏️"
              }</span>
              <span>{eventType}</span>
            </div>
            {specialRequests && (
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                <span className="text-xs text-neutral-400 italic">"{specialRequests}"</span>
              </div>
            )}
          </div>
        </div>

        {/* Customer details */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Tus Datos</h3>
            <button
              onClick={() => router.push(`/${slug}/reservar/datos`)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
              aria-label="Editar datos personales"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2 text-sm text-neutral-300">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>{customer?.name || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span className="font-mono text-xs">{customer?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>{customer?.phone || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment info */}
      {requiresPayment && depositInfo && (
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--primary)]/20 space-y-3">
          <h3 className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Garantía de Reserva
          </h3>
          <p className="text-sm text-neutral-300">
            Este restaurante requiere un depósito de garantía de{" "}
            <strong className="text-white">{depositLabel}</strong> para confirmar la reserva.
            Este monto se aplica a tu cuenta al llegar.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            Pago seguro · Datos de tarjeta cifrados (nunca pasan por nuestros servidores)
          </div>
        </div>
      )}

      {!requiresPayment && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Este restaurante no requiere depósito. La reserva es completamente gratis.</span>
        </div>
      )}

      {/* Error banner */}
      {sagaState === "error" && errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Saga progress indicator */}
      {isLoading && (
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-[var(--primary)]/20 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
            <span className="text-sm text-neutral-300">{sagaLabel[sagaState]}</span>
          </div>
          <div className="flex gap-2">
            {(["locking", "processing", "payment", "finalizing"] as SagaState[]).map((step, idx) => {
              const stages: SagaState[] = ["locking", "processing", "payment", "finalizing"]
              const currentIdx = stages.indexOf(sagaState)
              return (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    idx <= currentIdx ? "bg-[var(--primary)]" : "bg-neutral-800"
                  }`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between pt-4 border-t border-neutral-900">
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={handleBack}
          className="border-neutral-800 text-neutral-300 hover:bg-neutral-900 gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Atrás
        </Button>

        <Button
          id="pago-confirmar"
          disabled={isLoading}
          onClick={handleConfirm}
          className={`px-8 gap-2 font-semibold transition-all duration-300 ${
            isLoading
              ? "bg-[var(--primary)]/70 cursor-not-allowed"
              : "bg-[var(--primary)] hover:opacity-90 shadow-[0_0_20px_var(--primary)/30]"
          } text-white`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {sagaLabel[sagaState]}
            </>
          ) : (
            <>
              {requiresPayment ? "Pagar y Confirmar" : "Confirmar Reserva"}
              <ShieldCheck className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      <p className="text-center text-[10px] text-neutral-700">
        Al confirmar, recibirás un correo de confirmación y un mensaje de WhatsApp en {customer?.phone || "tu teléfono"}.
      </p>
    </div>
  )
}
