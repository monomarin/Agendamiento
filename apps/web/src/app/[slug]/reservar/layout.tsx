import * as React from "react"
import { notFound } from "next/navigation"
import Link from "next/link"

import prisma from "@/lib/prisma"
import { ReactQueryProvider } from "@/lib/query-client"
import { BookingHeader } from "@/components/booking/booking-header"
import { BookingFooter } from "@/components/booking/booking-footer"

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
        {/* Background image if configured */}
        {restaurant.bannerUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
            style={{
              backgroundImage: `url(${restaurant.bannerUrl})`,
              opacity: restaurant.bannerOpacity ?? 0.08,
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.1) 75%, rgba(0,0,0,0) 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.1) 75%, rgba(0,0,0,0) 100%)",
            }}
          />
        )}

        {/* Background ambient lighting */}
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full opacity-10 blur-[120px] pointer-events-none transition-all duration-1000"
          style={{ backgroundColor: restaurant.primaryColor }}
        />

        {/* Header */}
        <BookingHeader restaurant={restaurant} />

        {/* Main Flow Container */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 z-10 flex flex-col justify-center">
          {children}
        </main>

        {/* Footer */}
        <BookingFooter restaurant={restaurant} />
      </div>
    </ReactQueryProvider>
  )
}
