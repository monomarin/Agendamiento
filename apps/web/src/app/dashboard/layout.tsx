import * as React from "react"
export const dynamic = "force-dynamic"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import {
  CalendarDays, Users, LayoutGrid, Settings, BarChart3,
  MessageSquare, ShieldCheck, Menu,
} from "lucide-react"

import prisma from "@/lib/prisma"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: CalendarDays, label: "Reservas" },
  { href: "/dashboard/clientes", icon: Users, label: "Clientes" },
  { href: "/dashboard/mesas", icon: LayoutGrid, label: "Floor Plan" },
  { href: "/dashboard/conversaciones", icon: MessageSquare, label: "Conversaciones" },
  { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/dashboard/habeas-data", icon: ShieldCheck, label: "Habeas Data" },
  { href: "/dashboard/configuracion", icon: Settings, label: "Configuración" },
]

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  // Look up the user's restaurant
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      restaurant: { select: { id: true, name: true, slug: true, primaryColor: true } },
    },
  })

  if (!user?.restaurant) {
    redirect("/onboarding")
  }

  const restaurant = user.restaurant

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex antialiased">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-neutral-900/50 border-r border-neutral-800/60 backdrop-blur-xl">
        {/* Brand */}
        <div className="p-6 border-b border-neutral-800/60">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg"
              style={{ backgroundColor: restaurant.primaryColor }}
            >
              {restaurant.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-tight leading-tight">
                {restaurant.name}
              </h2>
              <span className="text-[10px] text-neutral-500 font-mono">/{restaurant.slug}</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-all duration-150 group"
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
              <p className="text-xs text-neutral-400 truncate">{user.email}</p>
              <p className="text-[10px] text-neutral-600 capitalize">{user.role.toLowerCase()}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-neutral-800/60 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: restaurant.primaryColor }}
            >
              {restaurant.name.charAt(0)}
            </div>
            <span className="font-semibold text-sm">{restaurant.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <UserButton />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
