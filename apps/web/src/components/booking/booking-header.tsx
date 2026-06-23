"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, MessageCircle, User } from "lucide-react"

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

interface BookingHeaderProps {
  restaurant: {
    name: string
    slug: string
    logoUrl: string | null
    primaryColor: string
    branches: Array<{ phone: string | null }>
  }
}

export function BookingHeader({ restaurant }: BookingHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Determine current step based on route
  const isConfirmStep = pathname.endsWith("/datos") || pathname.endsWith("/pago") || pathname.endsWith("/confirmacion")
  
  // Back action: if on confirm step, go back to details selector. Otherwise go to landing/home.
  const handleBack = () => {
    if (isConfirmStep) {
      router.push(`/${restaurant.slug}/reservar/personas`)
    } else {
      router.push(`/`)
    }
  }

  // Get restaurant WhatsApp number (branch phone or general)
  const phone = restaurant.branches[0]?.phone || ""
  const whatsappUrl = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : "#"

  return (
    <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 md:px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left side: Back button & Brand Logo */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700 transition-all text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </button>

          <Link href={`/${restaurant.slug}/reservar`} className="flex items-center gap-2.5 group">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-9 h-9 rounded-lg object-cover border border-neutral-800"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-md shadow-md"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                {restaurant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <h1 className="font-bold text-sm text-white group-hover:text-[var(--primary)] transition-colors leading-tight" style={{ "--primary": restaurant.primaryColor } as React.CSSProperties}>
                {restaurant.name}
              </h1>
              <span className="text-[9px] text-neutral-500 block uppercase tracking-wider font-mono">
                Portal de Reservas
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Simplified Step Indicator */}
        <div className="flex items-center gap-2 md:gap-4 text-xs font-semibold text-neutral-500 py-1 px-4 bg-neutral-900/30 border border-neutral-900 rounded-full select-none">
          <span 
            className={`transition-colors ${!isConfirmStep ? "text-white" : "text-neutral-600"}`}
            style={!isConfirmStep ? { color: restaurant.primaryColor } : {}}
          >
            1. Selecciona datos
          </span>
          <span className="text-neutral-800">───</span>
          <span 
            className={`transition-colors ${isConfirmStep ? "text-white" : "text-neutral-600"}`}
            style={isConfirmStep ? { color: restaurant.primaryColor } : {}}
          >
            2. Confirmar reserva
          </span>
        </div>

        {/* Right side: Social Icons, Iniciar Sesión, Language Switcher */}
        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
          {/* Social Icons */}
          <div className="flex items-center gap-2.5">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg border border-neutral-850 bg-neutral-900/20 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
              title="Instagram"
            >
              <InstagramIcon className="w-4 h-4" />
            </a>
            {phone && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg border border-neutral-850 bg-neutral-900/20 text-neutral-400 hover:text-emerald-400 hover:border-emerald-950 transition-colors flex items-center gap-1"
                title="WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Login button */}
            <Link
              href="/sign-in"
              className="flex items-center gap-1 text-[11px] font-bold text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
            >
              <User className="w-3.5 h-3.5" />
              Iniciar Sesión
            </Link>

            {/* Language Switcher */}
            <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/30 p-0.5 text-[10px] font-bold font-mono">
              <button className="px-2 py-1 rounded bg-neutral-800 text-white">ES</button>
              <button className="px-2 py-1 rounded text-neutral-600 hover:text-neutral-300">EN</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
