import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Building2, Users, CalendarDays, ExternalLink } from "lucide-react"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminRestaurantesPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } })
  if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard")

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { take: 1, select: { name: true, email: true } },
      branches: {
        select: {
          id: true,
          _count: {
            select: { bookings: true }
          }
        }
      }
    },
  })

  const restaurantsWithCounts = restaurants.map((r) => {
    const bookingsCount = r.branches.reduce((sum, b) => sum + b._count.bookings, 0)
    const branchesCount = r.branches.length
    return {
      ...r,
      bookingsCount,
      branchesCount
    }
  })


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-400" />
          Restaurantes
        </h1>
        <p className="text-neutral-400 text-sm mt-1">{restaurants.length} restaurantes registrados en la plataforma.</p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-4 font-medium">Restaurante</th>
                <th className="text-left px-6 py-4 font-medium">Propietario</th>
                <th className="text-left px-6 py-4 font-medium">Tipo</th>
                <th className="text-left px-6 py-4 font-medium">Estado</th>
                <th className="text-right px-6 py-4 font-medium">Sedes</th>
                <th className="text-right px-6 py-4 font-medium">Reservas</th>
                <th className="text-right px-6 py-4 font-medium">Creado</th>
                <th className="text-right px-6 py-4 font-medium">Enlace</th>
              </tr>
            </thead>
            <tbody>
              {restaurantsWithCounts.map((r) => (
                <tr key={r.id} className="border-b border-neutral-800/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: r.primaryColor || "#dc2626" }}
                      >
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{r.name}</p>
                        <code className="text-[10px] text-neutral-500">/{r.slug}</code>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-neutral-300 text-xs">{r.users[0]?.name ?? "—"}</p>
                    <p className="text-neutral-600 text-[10px]">{r.users[0]?.email ?? ""}</p>
                  </td>
                  <td className="px-6 py-4 text-neutral-400 text-xs capitalize">{r.type?.toLowerCase() ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      r.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : r.status === "SUSPENDED"
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-neutral-800 text-neutral-500 border-neutral-700"
                    }`}>
                      {r.status === "ACTIVE" ? "Activo" : r.status === "SUSPENDED" ? "Suspendido" : r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-neutral-300">{r.branchesCount}</td>
                  <td className="px-6 py-4 text-right text-neutral-300 font-semibold">{r.bookingsCount}</td>
                  <td className="px-6 py-4 text-right text-neutral-500 text-xs">
                    {format(new Date(r.createdAt), "dd MMM yyyy", { locale: es })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={`/${r.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs transition-colors"
                    >
                      Ver <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
              {restaurantsWithCounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-neutral-600 text-sm">
                    No hay restaurantes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
