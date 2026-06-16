import * as React from "react"
import { auth } from "@clerk/nextjs/server"
import { format, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarDays, Users, CheckCircle2, Clock, XCircle,
  AlertTriangle, TrendingUp, ChevronRight,
} from "lucide-react"

import prisma from "@/lib/prisma"

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true, name: true, restaurant: { select: { slug: true } } },
  })
  if (!user?.restaurantId) return null

  const restaurantId = user.restaurantId
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)

  // Fetch today's bookings across all branches
  const [todayBookings, totalCustomers, recentBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        branch: { restaurantId },
        dateTime: { gte: todayStart, lte: todayEnd },
      },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        tableType: { select: { name: true } },
      },
      orderBy: { dateTime: "asc" },
    }),
    prisma.customer.count({
      where: {
        bookings: {
          some: {
            branch: { restaurantId },
          },
        },
      },
    }),
    prisma.booking.count({
      where: {
        branch: { restaurantId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  // Stats
  const confirmed = todayBookings.filter((b) => b.status === "CONFIRMED").length
  const checkedIn = todayBookings.filter((b) => b.status === "CHECKED_IN").length
  const noShow = todayBookings.filter((b) => b.status === "NO_SHOW").length
  const cancelled = todayBookings.filter((b) => b.status === "CANCELLED").length
  const totalGuests = todayBookings
    .filter((b) => ["CONFIRMED", "CHECKED_IN"].includes(b.status))
    .reduce((sum: number, b: any) => sum + b.partySize, 0)

  const statCards = [
    {
      label: "Reservas hoy",
      value: todayBookings.length,
      icon: CalendarDays,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      label: "Comensales esperados",
      value: totalGuests,
      icon: Users,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Confirmadas",
      value: confirmed,
      icon: CheckCircle2,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
    },
    {
      label: "Últimos 7 días",
      value: recentBookings,
      icon: TrendingUp,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
    },
  ]

  const statusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">Confirmada</span>
      case "CHECKED_IN":
        return <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium">Check-in</span>
      case "NO_SHOW":
        return <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium">No Show</span>
      case "CANCELLED":
        return <span className="px-2 py-0.5 rounded-full bg-neutral-500/10 border border-neutral-500/20 text-neutral-400 text-[10px] font-medium">Cancelada</span>
      case "PENDING_PAYMENT":
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium">Pago pendiente</span>
      default:
        return <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-500 text-[10px]">{status}</span>
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {user.name?.split(" ")[0] || "Chef"} 👋
        </h1>
        <p className="text-neutral-400 text-sm">
          {format(today, "EEEE d 'de' MMMM, yyyy", { locale: es })} · Estas son las reservas del día.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-2xl ${stat.bgColor} border ${stat.borderColor} space-y-2 transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-neutral-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Integration Links (Module 1) */}
      <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                🔗
              </span>
              Tu Link Público de Reservas
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Comparte este enlace en tus redes sociales o insértalo en tu sitio web.
            </p>
          </div>
          <a
            href={`/${user.restaurant?.slug}/reservar`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-red-900/20"
          >
            Ver página de reservas
          </a>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">URL Directa</p>
            <code className="text-sm text-red-400 break-all select-all">
              https://tu-dominio.com/{user.restaurant?.slug}/reservar
            </code>
          </div>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">Insertar en tu web (Iframe)</p>
            <code className="text-xs text-neutral-400 break-all select-all">
              {`<iframe src="https://tu-dominio.com/${user.restaurant?.slug}/reservar" width="100%" height="800px" frameborder="0"></iframe>`}
            </code>
          </div>
        </div>
      </div>

      {/* Today's Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-neutral-500" />
            Reservas de hoy
          </h2>
          <span className="text-xs text-neutral-500">{todayBookings.length} total</span>
        </div>

        {todayBookings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/20">
            <CalendarDays className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">No hay reservas para hoy</p>
            <p className="text-neutral-600 text-xs mt-1">Las reservas aparecerán aquí en tiempo real.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 hover:border-neutral-700 transition-all group"
              >
                {/* Time */}
                <div className="text-center min-w-[50px]">
                  <p className="text-lg font-bold text-white leading-none">
                    {format(booking.dateTime, "HH:mm")}
                  </p>
                  <p className="text-[10px] text-neutral-600 mt-0.5">
                    {format(booking.dateTime, "a", { locale: es })}
                  </p>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-neutral-800" />

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-white truncate">
                      {booking.customer.name}
                    </p>
                    {statusBadge(booking.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {booking.partySize}p
                    </span>
                    {booking.tableType && (
                      <span>{booking.tableType.name}</span>
                    )}
                    <span className="font-mono text-[10px]">{booking.customer.email}</span>
                  </div>
                </div>

                {/* Action */}
                <ChevronRight className="w-4 h-4 text-neutral-700 group-hover:text-neutral-400 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick stats footer */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-xl bg-neutral-900/30 border border-neutral-800">
          <p className="text-xs text-neutral-500">Check-ins</p>
          <p className="text-xl font-bold text-blue-400">{checkedIn}</p>
        </div>
        <div className="p-3 rounded-xl bg-neutral-900/30 border border-neutral-800">
          <p className="text-xs text-neutral-500">No Shows</p>
          <p className="text-xl font-bold text-red-400">{noShow}</p>
        </div>
        <div className="p-3 rounded-xl bg-neutral-900/30 border border-neutral-800">
          <p className="text-xs text-neutral-500">Clientes totales</p>
          <p className="text-xl font-bold text-neutral-300">{totalCustomers}</p>
        </div>
      </div>
    </div>
  )
}
