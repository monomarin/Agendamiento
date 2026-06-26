import * as React from "react"
export const dynamic = "force-dynamic"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import {
  CalendarDays, Users, LayoutGrid, Settings, BarChart3,
  MessageSquare, ShieldCheck, Menu, HelpCircle,
} from "lucide-react"

import prisma from "@/lib/prisma"
import { TenantSwitcher } from "@/components/dashboard/tenant-switcher"
import { MobileNav } from "@/components/dashboard/mobile-nav"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const ICON_MAP: Record<string, any> = {
  CalendarDays,
  Users,
  LayoutGrid,
  Settings,
  BarChart3,
  MessageSquare,
  ShieldCheck,
}

const NAV_ITEMS = [
  { href: "/dashboard", iconName: "CalendarDays", label: "Reservas" },
  { href: "/dashboard/clientes", iconName: "Users", label: "Clientes" },
  { href: "/dashboard/mesas", iconName: "LayoutGrid", label: "Floor Plan" },
  { href: "/dashboard/conversaciones", iconName: "MessageSquare", label: "Conversaciones" },
  { href: "/dashboard/analytics", iconName: "BarChart3", label: "Analytics" },
  { href: "/dashboard/habeas-data", iconName: "ShieldCheck", label: "Habeas Data" },
  { href: "/dashboard/configuracion", iconName: "Settings", label: "Configuración" },
]

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  // Upsert user in DB — resilient fallback in case webhook hasn't fired yet
  const clerkUserData = await import("@clerk/nextjs/server").then((m) => m.currentUser())

  const user = await prisma.user.upsert({
    where: { clerkUserId: userId },
    update: {},
    create: {
      clerkUserId: userId,
      email: clerkUserData?.emailAddresses?.[0]?.emailAddress ?? "",
      name:
        `${clerkUserData?.firstName ?? ""} ${clerkUserData?.lastName ?? ""}`.trim() ||
        "Usuario",
      role: "OWNER",
    },
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
        {/* Brand Switcher */}
        <div className="p-4 border-b border-neutral-800/60">
          <TenantSwitcher currentRestaurant={restaurant} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.iconName] || HelpCircle
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-all duration-150 group"
              >
                <Icon className="w-4.5 h-4.5 text-neutral-500 group-hover:text-white transition-colors" style={{ width: 18, height: 18 }} />
                {item.label}
              </Link>
            )
          })}
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
        {/* Mobile Header / Drawer */}
        <MobileNav 
          restaurant={{
            name: restaurant.name,
            slug: restaurant.slug,
            primaryColor: restaurant.primaryColor,
          }}
          user={{
            email: user.email,
            role: user.role,
          }}
          navItems={NAV_ITEMS}
        />

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
