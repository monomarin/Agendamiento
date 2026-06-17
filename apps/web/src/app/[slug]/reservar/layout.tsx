import * as React from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Phone, ShieldCheck } from "lucide-react"

import prisma from "@/lib/prisma"
import { ReactQueryProvider } from "@/lib/query-client"
import { StepIndicator } from "@/components/booking/step-indicator"

interface BookingLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: slug.toLowerCase() },
  })

  if (!restaurant) return { title: "Restaurante no encontrado" }

  return {
    title: `Reserva en ${restaurant.name} | iAgenda`,
    description: `Reserva tu mesa en ${restaurant.name} de forma fácil, segura y sin filas.`,
    openGraph: {
      title: `Reserva en ${restaurant.name}`,
      description: `Disfruta la mejor experiencia en ${restaurant.name}. Reserva tu mesa en línea.`,
      images: restaurant.bannerUrl ? [{ url: restaurant.bannerUrl }] : [],
    },
  }
}

const BOOKING_STEPS = [
  { id: 1, label: "Personas", path: "personas" },
  { id: 2, label: "Fecha", path: "fecha" },
  { id: 3, label: "Datos", path: "datos" },
  { id: 4, label: "Pago", path: "pago" },
  { id: 5, label: "✓", path: "confirmacion" },
]

export default async function BookingLayout({ children, params }: BookingLayoutProps) {
  const { slug } = await params

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: slug.toLowerCase() },
    include: {
      branches: {
        where: { isActive: true },
      },
    },
  })

  if (!restaurant) {
    notFound()
  }

  // Define dynamic style variable object
  const brandThemeStyle = {
    "--primary": restaurant.primaryColor,
    "--secondary": restaurant.secondaryColor,
  } as React.CSSProperties

  return (
    <ReactQueryProvider>
      <div
        style={brandThemeStyle}
        className="min-h-screen bg-neutral-950 text-white flex flex-col antialiased relative selection:bg-[var(--primary)] selection:text-white"
      >
        {/* Background ambient lighting */}
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full opacity-10 blur-[120px] pointer-events-none transition-all duration-1000"
          style={{ backgroundColor: restaurant.primaryColor }}
        />

        {/* Header */}
        <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href={`/${restaurant.slug}/reservar`} className="flex items-center gap-3 group">
              {restaurant.logoUrl ? (
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-10 h-10 rounded-lg object-cover border border-neutral-800"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-lg transition-transform group-hover:scale-105"
                  style={{ backgroundColor: restaurant.primaryColor }}
                >
                  {restaurant.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="font-bold text-md tracking-tight text-white group-hover:text-[var(--primary)] transition-colors">
                  {restaurant.name}
                </h1>
                <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">
                  Portal de Reservas Oficial
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-4 text-xs text-neutral-400">
              {restaurant.branches[0]?.phone && (
                <a
                  href={`tel:${restaurant.branches[0].phone}`}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" style={{ color: restaurant.primaryColor }} />
                  <span className="hidden sm:inline">{restaurant.branches[0].phone}</span>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Main Flow Container */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col gap-6 z-10">
          {/* Step Progress Bar */}
          <div className="w-full bg-neutral-900/30 border border-neutral-900 rounded-2xl p-4 backdrop-blur-xl">
            <StepIndicator steps={BOOKING_STEPS} primaryColor={restaurant.primaryColor} />
          </div>

          {/* Content card */}
          <div className="w-full bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden">
            {/* Top highlight bar */}
            <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: restaurant.primaryColor }} />

            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 border-t border-neutral-900 bg-neutral-950 text-center text-[10px] text-neutral-600 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 opacity-60">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Reserva protegida por Habeas Data · iAgenda 2026</span>
          </div>
          <p className="mt-1">© {new Date().getFullYear()} {restaurant.name}. Powered by iAgenda by iAgentes.</p>
        </footer>
      </div>
    </ReactQueryProvider>
  )
}
