import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Users, ShieldCheck, Building2 } from "lucide-react"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ROLE_LABELS: Record<string, { label: string; class: string }> = {
  SUPER_ADMIN: { label: "Super Admin", class: "bg-red-500/10 text-red-400 border-red-500/20" },
  OWNER: { label: "Propietario", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  MANAGER: { label: "Gerente", class: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  HOSTESS: { label: "Hostess", class: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  WAITER: { label: "Mesero", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
}

export default async function AdminUsuariosPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const currentUser = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } })
  if (!currentUser || currentUser.role !== "SUPER_ADMIN") redirect("/dashboard")

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: { select: { name: true, slug: true } },
    },
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-emerald-400" />
          Usuarios
        </h1>
        <p className="text-neutral-400 text-sm mt-1">{users.length} usuarios registrados en la plataforma.</p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-4 font-medium">Usuario</th>
                <th className="text-left px-6 py-4 font-medium">Email</th>
                <th className="text-left px-6 py-4 font-medium">Rol</th>
                <th className="text-left px-6 py-4 font-medium">Restaurante</th>
                <th className="text-right px-6 py-4 font-medium">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleInfo = ROLE_LABELS[u.role] ?? { label: u.role, class: "bg-neutral-800 text-neutral-500 border-neutral-700" }
                return (
                  <tr key={u.id} className="border-b border-neutral-800/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-400 text-xs font-mono">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleInfo.class}`}>
                        {u.role === "SUPER_ADMIN" && <ShieldCheck className="w-3 h-3 inline mr-1" />}
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.restaurant ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="text-neutral-300 text-xs">{u.restaurant.name}</span>
                          <code className="text-[10px] text-neutral-600">/{u.restaurant.slug}</code>
                        </div>
                      ) : (
                        <span className="text-neutral-600 text-xs">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-neutral-500 text-xs">
                      {format(new Date(u.createdAt), "dd MMM yyyy", { locale: es })}
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-600 text-sm">
                    No hay usuarios registrados.
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
