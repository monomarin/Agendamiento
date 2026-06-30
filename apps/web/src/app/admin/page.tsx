import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Building2, Users, CalendarDays, TrendingUp,
  Activity, ShieldCheck, Globe, DollarSign,
} from "lucide-react"
import prisma from "@/lib/prisma"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  // Stats globales de la plataforma
  const [
    totalRestaurants,
    activeRestaurants,
    totalUsers,
    totalBookings,
    todayBookings,
    recentRestaurants,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.booking.count(),
    prisma.booking.count({
      where: {
        dateTime: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        users: { take: 1, select: { name: true, email: true } },
        branches: {
          select: {
            _count: {
              select: { bookings: true }
            }
          }
        }
      },
    }),
  ])

  const recentRestaurantsWithCounts = recentRestaurants.map((r) => {
    const bookingsCount = r.branches.reduce((sum, b) => sum + b._count.bookings, 0)
    return {
      ...r,
      bookingsCount
    }
  })


  const stats = [
    {
      label: "Restaurantes Totales",
      value: totalRestaurants,
      sub: `${activeRestaurants} activos`,
      icon: Building2,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Usuarios Registrados",
      value: totalUsers,
      sub: "propietarios + staff",
      icon: Users,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Reservas Totales",
      value: totalBookings,
      sub: `${todayBookings} hoy`,
      icon: CalendarDays,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Plataforma",
      value: activeRestaurants,
      sub: "restaurantes en línea",
      icon: Globe,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
  ]

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold tracking-tight">Panel de Administración</h1>
        </div>
        <p className="text-neutral-400 text-sm">
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })} · Vista global de la plataforma iAgenda.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`p-5 rounded-2xl ${s.bg} border ${s.border} space-y-3 hover:scale-[1.02] transition-transform`}
          >
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <p className="text-3xl font-extrabold text-white">{s.value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-neutral-600 mt-1">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Restaurants Table */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-neutral-400" />
            Restaurantes Recientes
          </h2>
          <Link
            href="/admin/restaurantes"
            className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
          >
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Restaurante</th>
                <th className="text-left px-6 py-3 font-medium">Slug</th>
                <th className="text-left px-6 py-3 font-medium">Propietario</th>
                <th className="text-left px-6 py-3 font-medium">Estado</th>
                <th className="text-right px-6 py-3 font-medium">Reservas</th>
                <th className="text-right px-6 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {recentRestaurantsWithCounts.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-neutral-800/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: r.primaryColor || "#dc2626" }}
                      >
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-white truncate max-w-[150px]">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                      /{r.slug}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-neutral-400 text-xs">
                    {r.users[0]?.name ?? "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-neutral-800 text-neutral-500"
                      }`}
                    >
                      {r.status === "ACTIVE" ? "Activo" : r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-neutral-300 font-semibold">
                    {r.bookingsCount}
                  </td>
                  <td className="px-6 py-4 text-right text-neutral-500 text-xs">
                    {format(new Date(r.createdAt), "dd MMM yyyy", { locale: es })}
                  </td>
                </tr>
              ))}
              {recentRestaurantsWithCounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-600 text-sm">
                    No hay restaurantes registrados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/restaurantes"
          className="p-5 rounded-2xl bg-white/5 border border-neutral-800 hover:border-neutral-700 transition-all group flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Gestionar Restaurantes</p>
            <p className="text-xs text-neutral-500">Ver, activar o suspender</p>
          </div>
        </Link>

        <Link
          href="/admin/usuarios"
          className="p-5 rounded-2xl bg-white/5 border border-neutral-800 hover:border-neutral-700 transition-all group flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Gestionar Usuarios</p>
            <p className="text-xs text-neutral-500">Roles, acceso y más</p>
          </div>
        </Link>

        <Link
          href="/admin/configuracion"
          className="p-5 rounded-2xl bg-white/5 border border-neutral-800 hover:border-neutral-700 transition-all group flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Configuración Global</p>
            <p className="text-xs text-neutral-500">Ajustes de plataforma</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
