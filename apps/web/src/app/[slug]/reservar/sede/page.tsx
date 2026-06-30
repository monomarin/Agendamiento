"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MapPin, Clock, ArrowRight, Navigation } from "lucide-react"

import { useBookingStore } from "@/lib/booking-store"
import { getBranchPlaceholderImage } from "@/lib/business-types"

interface Branch {
  id: string
  name: string
  address: string
  phone: string | null
  isOpen: boolean
  nextOpenTime: string | null
}

interface SedePageProps {
  params: Promise<{ slug: string }>
}

export default function SedePage({ params }: SedePageProps) {
  const router = useRouter()
  const { slug } = React.use(params)
  const { setSelectedBranchId, setStep, restaurantType, setRestaurantType } = useBookingStore()

  const [branches, setBranches] = React.useState<Branch[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<"all" | "open" | "near">("all")

  React.useEffect(() => {
    fetch(`/api/restaurants/${slug}/branches`)
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches || [])
        if (data.restaurantType) {
          setRestaurantType(data.restaurantType)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug, setRestaurantType])

  const handleSelectBranch = (branchId: string) => {
    setSelectedBranchId(branchId)
    setStep(1)
    router.push(`/${slug}/reservar/personas`)
  }

  const filteredBranches = branches.filter((b) => {
    if (filter === "open") return b.isOpen
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[var(--primary)]" />
          Selecciona una sede
        </h2>
        <p className="text-neutral-400 text-sm">
          {restaurantType === "restaurante" || restaurantType === "bar" || restaurantType === "cafe" || restaurantType === "fast_food"
            ? "Elige la ubicación donde deseas reservar tu mesa."
            : "Elige la ubicación donde deseas agendar tu cita."}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "open", "near"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
              filter === f
                ? "border-[var(--primary)]/50 bg-[var(--primary)]/10 text-white"
                : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700"
            }`}
          >
            {f === "all" && "Todas"}
            {f === "open" && "🟢 Abierto ahora"}
            {f === "near" && "📍 Cerca de mí"}
          </button>
        ))}
      </div>

      {/* Branch grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-neutral-900/60 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-sm">
          No se encontraron sedes con los filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredBranches.map((branch, index) => (
            <button
              key={branch.id}
              id={`branch-${branch.id}`}
              onClick={() => handleSelectBranch(branch.id)}
              className="group p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-left hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 transition-all duration-200 space-y-3 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {/* Branch image placeholder */}
              <div className="h-24 rounded-lg bg-neutral-850 overflow-hidden relative border border-neutral-800/30">
                <img
                  src={getBranchPlaceholderImage(restaurantType, index)}
                  alt={branch.name}
                  className="w-full h-full object-cover opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all duration-350"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white/90 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                  <span className="font-semibold text-[10px] truncate max-w-[150px]">{branch.name}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-sm group-hover:text-[var(--primary)] transition-colors">
                    {branch.name}
                  </h3>
                  {branch.isOpen ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                      Abierto
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-500 text-[10px] font-medium">
                      Cerrado
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-neutral-400 text-xs">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{branch.address}</span>
                </div>

                {branch.phone && (
                  <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
                    📞 <span>{branch.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end">
                <span className="text-[11px] text-[var(--primary)] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {restaurantType === "restaurante" || restaurantType === "bar" || restaurantType === "cafe" || restaurantType === "fast_food"
                    ? "Reservar aquí"
                    : "Agendar aquí"} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
