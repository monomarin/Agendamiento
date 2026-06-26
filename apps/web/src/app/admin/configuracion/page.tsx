import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Settings, Globe, Key, Bell, Database, Server } from "lucide-react"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminConfigPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } })
  if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard")

  // Env check (no muestra valores, solo si están configurados)
  const envChecks = [
    { key: "DATABASE_URL", set: !!process.env.DATABASE_URL, label: "Base de Datos (Neon)" },
    { key: "CLERK_SECRET_KEY", set: !!process.env.CLERK_SECRET_KEY, label: "Clerk Auth" },
    { key: "CLERK_WEBHOOK_SECRET", set: !!process.env.CLERK_WEBHOOK_SECRET, label: "Clerk Webhook" },
    { key: "RESEND_API_KEY", set: !!process.env.RESEND_API_KEY, label: "Resend (Email)" },
    { key: "STRIPE_SECRET_KEY", set: !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_placeholder", label: "Stripe Payments" },
    { key: "CALCOM_API_KEY", set: !!process.env.CALCOM_API_KEY && process.env.CALCOM_API_KEY !== "cal_api_key_placeholder", label: "Cal.com API" },
    { key: "UPSTASH_REDIS_REST_URL", set: !!process.env.UPSTASH_REDIS_REST_URL && !process.env.UPSTASH_REDIS_REST_URL.includes("placeholder"), label: "Upstash Redis" },
  ]

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-400" />
          Configuración Global
        </h1>
        <p className="text-neutral-400 text-sm mt-1">Estado de los servicios e integraciones de la plataforma.</p>
      </div>

      {/* Platform Info */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-neutral-400" />
          Información de la Plataforma
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1">Dominio</p>
            <p className="text-sm text-white font-mono">{process.env.NEXT_PUBLIC_APP_URL ?? "No configurado"}</p>
          </div>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1">Entorno</p>
            <p className="text-sm text-white font-mono">{process.env.NODE_ENV ?? "production"}</p>
          </div>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1">Next.js</p>
            <p className="text-sm text-white font-mono">16.2.7</p>
          </div>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1">Región Vercel</p>
            <p className="text-sm text-white font-mono">{process.env.VERCEL_REGION ?? "Auto"}</p>
          </div>
        </div>
      </div>

      {/* Environment Variables Health Check */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-neutral-400" />
          Estado de Servicios
        </h2>
        <div className="space-y-2">
          {envChecks.map((env) => (
            <div key={env.key} className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${env.set ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"}`} />
                <span className="text-sm text-neutral-300">{env.label}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                env.set
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                {env.set ? "Configurado" : "No configurado"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl border border-amber-800/30 bg-amber-950/20 p-6 space-y-3">
        <h2 className="font-semibold text-amber-300 flex items-center gap-2 text-sm">
          <Bell className="w-4 h-4" />
          Notas del Administrador
        </h2>
        <ul className="text-sm text-neutral-400 space-y-2 list-disc list-inside">
          <li>Para asignar el rol <code className="text-red-400 bg-neutral-800 px-1 py-0.5 rounded text-xs">SUPER_ADMIN</code> a un usuario, actualiza directamente en la base de datos.</li>
          <li>Los webhooks de Clerk deben apuntar a <code className="text-red-400 bg-neutral-800 px-1 py-0.5 rounded text-xs">/api/webhooks/clerk</code>.</li>
          <li>Verifica que las variables de entorno estén configuradas en el dashboard de Vercel.</li>
        </ul>
      </div>
    </div>
  )
}
