"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { MapPin, Phone, Mail, ShieldCheck, ChevronRight } from "lucide-react"
import { useBookingStore } from "@/lib/booking-store"
import { Button } from "@/components/ui/button"

interface BookingFooterProps {
  restaurant: {
    name: string
    slug: string
    primaryColor: string
    branches: Array<{
      id: string
      name: string
      address: string
      phone: string | null
    }>
  }
}

export function BookingFooter({ restaurant }: BookingFooterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { selectedDate, selectedTime } = useBookingStore()

  // Only show the "COMPLETA LOS DATOS" footer button on step 1 (selection step)
  const isSelectionStep = pathname.endsWith("/personas")
  
  // Enabled only when date and time are selected
  const canContinue = !!(selectedDate && selectedTime)

  const handleContinue = () => {
    if (canContinue) {
      router.push(`/${restaurant.slug}/reservar/datos`)
    }
  }

  // Get active branch or default to first branch
  const activeBranch = restaurant.branches[0]

  return (
    <footer className="w-full mt-auto border-t border-neutral-900 bg-neutral-950 text-neutral-400">
      {/* Dynamic CTA Button Panel (Sticky-like overlay when on selection page) */}
      {isSelectionStep && (
        <div className="w-full border-b border-neutral-900 bg-neutral-900/20 backdrop-blur-md py-4 px-4 flex justify-center">
          <div className="max-w-md w-full">
            <Button
              onClick={handleContinue}
              disabled={!canContinue}
              className="w-full py-6 text-sm font-bold tracking-wide uppercase transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 rounded-xl text-white"
              style={{
                backgroundColor: canContinue ? restaurant.primaryColor : "#171717",
                boxShadow: canContinue ? `0 0 25px ${restaurant.primaryColor}30` : "none",
                borderColor: canContinue ? restaurant.primaryColor : "transparent",
              }}
            >
              Completa los datos
              <ChevronRight className="w-4 h-4" />
            </Button>
            {!canContinue && (
              <p className="text-[10px] text-center text-neutral-600 mt-1.5">
                * Por favor, selecciona número de personas, fecha y hora para continuar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Restaurant Info section */}
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {/* Address */}
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Ubicación</p>
            <p className="text-neutral-500">{activeBranch?.address || "Dirección no disponible"}</p>
          </div>
        </div>

        {/* Contact */}
        <div className="flex items-start gap-3">
          <Phone className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" style={{ color: restaurant.primaryColor }} />
          <div className="space-y-1">
            <p className="font-semibold text-white">Teléfono de Reservas</p>
            <p className="text-neutral-500">{activeBranch?.phone || "Sin teléfono registrado"}</p>
          </div>
        </div>

        {/* Email */}
        <div className="flex items-start gap-3">
          <Mail className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Correo Electrónico</p>
            <p className="text-neutral-500">{restaurant.slug}@iagenda.com</p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="py-6 border-t border-neutral-900 bg-neutral-950 text-center text-[10px] text-neutral-600 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 opacity-60">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Reserva protegida por Habeas Data · iAgenda 2026</span>
        </div>
        <p className="mt-1">
          © {new Date().getFullYear()} {restaurant.name}. Powered by <span className="font-semibold text-neutral-500">iAgenda</span> by iAgentes.
        </p>
      </div>
    </footer>
  )
}
