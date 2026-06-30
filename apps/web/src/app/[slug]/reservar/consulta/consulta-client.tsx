"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CheckCircle2, XCircle, Users, CalendarDays, Clock, User, Phone, Mail,
  ClipboardList, AlertCircle, Loader2, ArrowLeft, Check, LogIn
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { maskName, maskEmail, maskPhone } from "@/lib/privacy-utils"

interface BookingDetails {
  id: string
  confirmationCode: string | null
  dateTime: string
  partySize: number
  specialRequests: string | null
  status: string
  customer: {
    name: string
    email: string
    phone: string | null
  }
  branchName: string
  restaurantName: string
  tableTypeName: string
  tables: Array<{ id: string; number: string }>
}

export default function ConsultaClient({ booking: initialBooking, isAdmin }: { booking: BookingDetails; isAdmin: boolean }) {
  const [booking, setBooking] = React.useState(initialBooking)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const formattedDate = booking.dateTime
    ? format(new Date(booking.dateTime), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    : "—"

  const formattedTime = booking.dateTime
    ? format(new Date(booking.dateTime), "HH:mm 'hs'", { locale: es })
    : "—"

  const handleUpdateStatus = async (newStatus: "CHECKED_IN" | "NO_SHOW") => {
    setActionLoading(true)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/dashboard/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el estado de la reserva")
      }
      
      setBooking(prev => ({ ...prev, status: newStatus }))
      setSuccessMsg(newStatus === "CHECKED_IN" ? "¡Entrada registrada con éxito!" : "Reserva marcada como inasistencia.")
    } catch (err: any) {
      alert(err.message || "Error al actualizar la reserva")
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONFIRMED":
        return <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Confirmada ✅</span>
      case "CHECKED_IN":
        return <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Ingresado 🚪</span>
      case "NO_SHOW":
        return <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">Inasistencia (No Show) ❌</span>
      case "CANCELLED":
        return <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Cancelada 🚫</span>
      default:
        return <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-neutral-700 text-neutral-300">{status}</span>
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 w-full">
      {/* Admin header banner */}
      {isAdmin && (
        <div className="p-4 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center justify-between gap-2 shadow-lg shadow-red-950/10">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 animate-pulse" />
            <span>Verificación de Administrador Autorizada</span>
          </div>
          <Link href="/dashboard/verificar" className="text-red-400 hover:text-red-300 underline font-semibold flex items-center gap-1">
            Ir al panel <ArrowLeft className="w-3 h-3 rotate-180" />
          </Link>
        </div>
      )}

      {/* Main card */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-8 relative overflow-hidden">
        {/* Ambient background effect */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[var(--primary)] opacity-[0.03] blur-3xl pointer-events-none" />
        
        {/* Success / Status Message */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center">
            {booking.status === "CONFIRMED" ? (
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            ) : booking.status === "CHECKED_IN" ? (
              <CheckCircle2 className="w-9 h-9 text-blue-500" />
            ) : (
              <XCircle className="w-9 h-9 text-neutral-500" />
            )}
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Detalles de la Reserva</h2>
            <p className="text-xs text-neutral-400 mt-1">Sede: {booking.branchName} · {booking.restaurantName}</p>
          </div>

          <div className="mt-2">
            {getStatusBadge(booking.status)}
          </div>
        </div>

        {/* Dynamic validation actions success message */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 text-center font-medium">
            {successMsg}
          </div>
        )}

        {/* Confirmation Code Showcase */}
        {booking.confirmationCode && (
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-center font-mono">
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Código de Confirmación</span>
            <span className="text-xl font-bold text-[var(--primary)] tracking-widest mt-1">{booking.confirmationCode}</span>
          </div>
        )}

        {/* Event Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left border-t border-neutral-800 pt-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">Detalles de la Reserva</h3>
            <div className="space-y-2.5 text-sm text-neutral-300">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-neutral-500 shrink-0" />
                <span className="capitalize">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>{formattedTime}</span>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>{booking.partySize} {booking.partySize === 1 ? "persona" : "personas"}</span>
              </div>
              <div className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>{booking.specialRequests || "Reserva estándar"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">Información del Cliente</h3>
            <div className="space-y-2.5 text-sm text-neutral-300">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>{isAdmin ? booking.customer.name : maskName(booking.customer.name)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-neutral-500 shrink-0" />
                <span className="break-all">{isAdmin ? booking.customer.email : maskEmail(booking.customer.email)}</span>
              </div>
              {booking.customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>{isAdmin ? booking.customer.phone : maskPhone(booking.customer.phone)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin controls section */}
        {isAdmin && booking.status.toUpperCase() === "CONFIRMED" && (
          <div className="border-t border-neutral-800 pt-6 space-y-4">
            <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider text-center">Acciones Rápidas</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                disabled={actionLoading}
                onClick={() => handleUpdateStatus("NO_SHOW")}
                variant="outline"
                className="border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 font-semibold px-4"
              >
                Registrar Inasistencia (No Show)
              </Button>
              <Button
                disabled={actionLoading}
                onClick={() => handleUpdateStatus("CHECKED_IN")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 shadow-lg shadow-emerald-950/20"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Confirmar Llegada (Check-in)"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CTA back or Sign-in for admin */}
      <div className="flex justify-center text-xs text-neutral-500 gap-4">
        {!isAdmin && (
          <Link href="/sign-in" className="hover:text-neutral-400 flex items-center gap-1">
            <LogIn className="w-3.5 h-3.5" /> ¿Eres el administrador del local? Inicia sesión
          </Link>
        )}
      </div>
    </div>
  )
}
