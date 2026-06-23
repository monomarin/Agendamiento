"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { 
  Menu, X, CalendarDays, Users, LayoutGrid, Settings, 
  BarChart3, MessageSquare, ShieldCheck, HelpCircle 
} from "lucide-react"

const IconMap: Record<string, any> = {
  CalendarDays,
  Users,
  LayoutGrid,
  Settings,
  BarChart3,
  MessageSquare,
  ShieldCheck,
}

interface NavItem {
  href: string
  iconName: string
  label: string
}

interface MobileNavProps {
  restaurant: {
    name: string
    slug: string
    primaryColor: string
  }
  user: {
    email: string
    role: string
  }
  navItems: NavItem[]
}

export function MobileNav({ restaurant, user, navItems }: MobileNavProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()

  // Close menu on navigation
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b border-neutral-800/60 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-40 w-full">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700 transition-all focus:outline-none"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-md"
              style={{ backgroundColor: restaurant.primaryColor }}
            >
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-xs text-white truncate max-w-[120px]">{restaurant.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <UserButton />
        </div>
      </header>

      {/* Drawer Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden transition-all duration-300"
        />
      )}

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-neutral-950 border-r border-neutral-900 p-5 flex flex-col justify-between shadow-2xl lg:hidden transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Header with Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-md shadow-md"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                {restaurant.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-xs text-white leading-tight">{restaurant.name}</h2>
                <span className="text-[9px] text-neutral-500 font-mono">/{restaurant.slug}</span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-white transition-all"
              aria-label="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const IconComponent = IconMap[item.iconName] || HelpCircle
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${
                    isActive
                      ? "bg-white/5 text-white font-semibold"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                  style={isActive ? { borderLeft: `2px solid ${restaurant.primaryColor}` } : {}}
                >
                  <IconComponent 
                    className="w-4.5 h-4.5 transition-colors" 
                    style={{ 
                      width: 18, 
                      height: 18,
                      color: isActive ? restaurant.primaryColor : "rgb(115, 115, 115)"
                    }} 
                  />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer Profile info */}
        <div className="border-t border-neutral-900 pt-4 flex items-center gap-3">
          <UserButton />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-white font-medium truncate">{user.email}</p>
            <p className="text-[9px] text-neutral-500 capitalize">{user.role.toLowerCase()}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
