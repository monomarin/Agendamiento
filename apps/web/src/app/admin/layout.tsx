import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { ShieldCheck, Users, Building2, LayoutGrid, BarChart3, Settings } from "lucide-react"
import prisma from "@/lib/prisma"

const NAV_ITEMS = [
  { href: "/admin", icon: BarChart3, label: "Panel General" },
  { href: "/admin/restaurantes", icon: Building2, label: "Restaurantes" },
  { href: "/admin/usuarios", icon: Users, label: "Usuarios" },
  { href: "/admin/configuracion", icon: Settings, label: "Configuración" },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true, name: true, email: true },
  })

  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex antialiased">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-neutral-900/60 border-r border-neutral-800/60 backdrop-blur-xl">
        {/* Brand */}
        <div className="p-5 border-b border-neutral-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-white leading-none">iAgenda</p>
            <p className="text-[10px] text-red-400 font-semibold mt-0.5 uppercase tracking-wider">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-all group"
            >
              <item.icon className="w-4.5 h-4.5 text-neutral-500 group-hover:text-white transition-colors" style={{ width: 18, height: 18 }} />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800/60">
          <div className="flex items-center gap-3">
            <UserButton />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-neutral-300 truncate font-medium">{user.name}</p>
              <p className="text-[10px] text-red-400 font-semibold">SUPER_ADMIN</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-500" />
            <span className="font-bold text-sm">Admin Panel</span>
          </div>
          <UserButton />
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
