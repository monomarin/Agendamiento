"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Store, Check, Loader2 } from "lucide-react"

interface RestaurantSummary {
  id: string
  name: string
  slug: string
}

interface TenantSwitcherProps {
  currentRestaurant: {
    id: string
    name: string
    slug: string
    primaryColor: string
  }
}

export function TenantSwitcher({ currentRestaurant }: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [restaurants, setRestaurants] = React.useState<RestaurantSummary[]>([])
  const [loading, setLoading] = React.useState(false)
  const [switchingId, setSwitchingId] = React.useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Fetch list of restaurants when dropdown is opened
  React.useEffect(() => {
    if (isOpen && restaurants.length === 0) {
      setLoading(true)
      fetch("/api/dashboard/restaurants/list")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.restaurants)) {
            setRestaurants(data.restaurants)
          }
        })
        .catch((err) => console.error("Error loading restaurants list:", err))
        .finally(() => setLoading(false))
    }
  }, [isOpen, restaurants.length])

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSwitch = async (restaurantId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (restaurantId === currentRestaurant.id) return
    setSwitchingId(restaurantId)
    try {
      const res = await fetch("/api/dashboard/restaurants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      })
      const data = await res.json()
      if (data.success) {
        // Force redirect to dashboard to reload new context
        window.location.href = "/dashboard"
      } else {
        alert(data.error || "Error al cambiar de establecimiento")
        setSwitchingId(null)
      }
    } catch (err) {
      console.error(err)
      alert("Error de conexión al cambiar de establecimiento")
      setSwitchingId(null)
    }
  }

  const handleCreateNew = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.location.href = "/onboarding?new=true"
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700 transition-all text-left text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-700"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md"
            style={{ backgroundColor: currentRestaurant.primaryColor }}
          >
            {currentRestaurant.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white truncate leading-tight text-[11px]">{currentRestaurant.name}</p>
            <span className="text-[9px] text-neutral-500 font-mono block">/{currentRestaurant.slug}</span>
          </div>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl p-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="max-h-[220px] overflow-y-auto space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center gap-1.5 py-4 text-xs text-neutral-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Cargando...
              </div>
            ) : restaurants.length <= 1 ? (
              <div className="py-2.5 px-3 text-[10px] text-neutral-500 italic">
                Solo tienes este establecimiento.
              </div>
            ) : (
              restaurants.map((r) => {
                const isSelected = r.id === currentRestaurant.id
                const isSwitching = switchingId === r.id

                return (
                  <button
                    key={r.id}
                    disabled={isSwitching}
                    onClick={(e) => handleSwitch(r.id, e)}
                    className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-neutral-800 text-white font-medium"
                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Store className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </div>
                    {isSwitching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />
                    ) : isSelected ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : null}
                  </button>
                )
              })
            )}
          </div>

          <div className="border-t border-neutral-800/80 mt-1 pt-1">
            <button
              onClick={handleCreateNew}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs text-[var(--primary)] hover:bg-[var(--primary)]/10 hover:text-white transition-all font-semibold"
              style={{ "--primary": currentRestaurant.primaryColor } as React.CSSProperties}
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar establecimiento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
