import * as React from "react"
import { auth } from "@clerk/nextjs/server"
import { ShieldCheck, Download, Trash2, AlertTriangle, Search } from "lucide-react"

import prisma from "@/lib/prisma"

export default async function HabeasDataPage() {
  const { userId } = await auth()
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { restaurantId: true, role: true },
  })
  if (!user?.restaurantId) return null

  // Only OWNER and MANAGER can access Habeas Data
  if (!["OWNER", "MANAGER"].includes(user.role)) {
    return (
      <div className="p-12 text-center">
        <ShieldCheck className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
        <p className="text-neutral-400">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  // Recent consent records
  const recentConsents = await prisma.consentRecord.findMany({
    where: { restaurantId: user.restaurantId },
    orderBy: { timestamp: "desc" },
    take: 20,
  })

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          Habeas Data
        </h1>
        <p className="text-neutral-400 text-sm">
          Gestión de datos personales · Ley 1581 de 2012 (Colombia)
        </p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Exportar datos de cliente</h3>
              <p className="text-xs text-neutral-500">Descarga todos los datos de un cliente (Derecho de acceso)</p>
            </div>
          </div>
          <form action="/api/habeas-data/export" method="POST" className="flex gap-2">
            <input
              type="email"
              name="email"
              placeholder="email@del-cliente.com"
              required
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Exportar
            </button>
          </form>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-red-900/30 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Eliminar datos de cliente</h3>
              <p className="text-xs text-neutral-500">Borra TODOS los datos y reservas (Derecho de supresión)</p>
            </div>
          </div>
          <form action="/api/habeas-data/delete" method="POST" className="flex gap-2">
            <input
              type="email"
              name="email"
              placeholder="email@del-cliente.com"
              required
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Eliminar
            </button>
          </form>
          <p className="text-[10px] text-red-400/80 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Esta acción es irreversible y elimina reservas, preferencias y registros de contacto.
          </p>
        </div>
      </div>

      {/* Recent Consent Records */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg text-white">Registros de Consentimiento Recientes</h2>
        {recentConsents.length === 0 ? (
          <p className="text-neutral-500 text-sm">No hay registros de consentimiento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500 border-b border-neutral-800">
                  <th className="text-left py-2 px-3">Email</th>
                  <th className="text-left py-2 px-3">Fecha</th>
                  <th className="text-left py-2 px-3">Versión</th>
                  <th className="text-left py-2 px-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {recentConsents.map((consent) => (
                  <tr key={consent.id} className="border-b border-neutral-800/60 hover:bg-neutral-900/30">
                    <td className="py-2.5 px-3 font-mono text-neutral-300">{consent.clientEmail}</td>
                    <td className="py-2.5 px-3 text-neutral-400">
                      {consent.timestamp.toLocaleDateString("es-CO")} {consent.timestamp.toLocaleTimeString("es-CO")}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500">{consent.policyVersion}</td>
                    <td className="py-2.5 px-3 text-neutral-600 font-mono">{consent.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
