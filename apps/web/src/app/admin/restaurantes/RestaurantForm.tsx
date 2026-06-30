"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Save, ArrowLeft, Loader2, Sparkles, Image as ImageIcon } from "lucide-react"
import { updateRestaurantAction } from "./actions"

interface RestaurantFormProps {
  restaurant: {
    id: string
    name: string
    slug: string
    type: string
    status: "DRAFT" | "ACTIVE" | "SUSPENDED"
    timezone: string
    plan: string
    primaryColor: string
    secondaryColor: string
    logoUrl: string | null
    bannerUrl: string | null
    bannerOpacity: number
  }
}

const TIMEZONES = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Santiago",
  "America/Lima",
  "America/Caracas",
  "America/Buenos_Aires",
  "America/New_York",
  "Europe/Madrid",
]

const PLANS = ["FREE", "PRO", "ENTERPRISE"]
const STATUSES: { value: "DRAFT" | "ACTIVE" | "SUSPENDED"; label: string }[] = [
  { value: "DRAFT", label: "Borrador" },
  { value: "ACTIVE", label: "Activo" },
  { value: "SUSPENDED", label: "Suspendido" },
]

export default function RestaurantForm({ restaurant }: RestaurantFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: restaurant.name,
    slug: restaurant.slug,
    type: restaurant.type,
    status: restaurant.status,
    timezone: restaurant.timezone,
    plan: restaurant.plan,
    primaryColor: restaurant.primaryColor,
    secondaryColor: restaurant.secondaryColor,
    logoUrl: restaurant.logoUrl || "",
    bannerUrl: restaurant.bannerUrl || "",
    bannerOpacity: restaurant.bannerOpacity,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "bannerOpacity" ? parseFloat(value) : value,
    }))
  }

  const handleSlugBlur = () => {
    // Autogenerate clean slug format on blur
    setFormData((prev) => ({
      ...prev,
      slug: prev.slug.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, ""),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await updateRestaurantAction(restaurant.id, formData)
      setSuccess(true)
      router.refresh()
      setTimeout(() => {
        router.push("/admin/restaurantes")
      }, 1500)
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al guardar los cambios.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header / Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/admin/restaurantes")}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a establecimientos
        </button>
        <span className="text-xs text-neutral-500 font-mono">ID: {restaurant.id}</span>
      </div>

      <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-8 backdrop-blur-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 rounded-full blur-[80px]" />

        <div className="flex items-center gap-4 relative z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg"
            style={{ backgroundColor: formData.primaryColor || "#dc2626" }}
          >
            {formData.name.slice(0, 2).toUpperCase() || "R"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Configuración del Establecimiento</h1>
            <p className="text-xs text-neutral-400">Modificar propiedades, diseño e integraciones</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> ¡Cambios guardados con éxito! Redirigiendo...
            </div>
          )}

          {/* Sección 1: Información Básica */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Información Básica</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nombre del Establecimiento</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2.5 text-sm text-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Enlace / Slug (Ej: elcielo)</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-sm text-neutral-600">/</span>
                  <input
                    type="text"
                    name="slug"
                    required
                    value={formData.slug}
                    onChange={handleChange}
                    onBlur={handleSlugBlur}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl pl-7 pr-4 py-2.5 text-sm text-white transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Tipo de Negocio</label>
                <input
                  type="text"
                  name="type"
                  required
                  placeholder="restaurante, bar, cafeteria"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2.5 text-sm text-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Zona Horaria</label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2.5 text-sm text-white transition-all"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sección 2: Estado y Licencia */}
          <div className="space-y-4 pt-4 border-t border-neutral-800/60">
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Estado y Licencia</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Estado Operativo</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2.5 text-sm text-white transition-all"
                >
                  {STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Plan de Suscripción</label>
                <select
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2.5 text-sm text-white transition-all font-semibold text-red-400"
                >
                  {PLANS.map((pl) => (
                    <option key={pl} value={pl}>
                      {pl}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sección 3: Diseño y Apariencia */}
          <div className="space-y-4 pt-4 border-t border-neutral-800/60">
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Identidad Visual</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Color Primario</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    name="primaryColor"
                    value={formData.primaryColor}
                    onChange={handleChange}
                    className="w-11 h-10 bg-neutral-950 border border-neutral-800 rounded-xl p-1 cursor-pointer"
                  />
                  <input
                    type="text"
                    name="primaryColor"
                    value={formData.primaryColor}
                    onChange={handleChange}
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2 text-sm text-white transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Color Secundario</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    name="secondaryColor"
                    value={formData.secondaryColor}
                    onChange={handleChange}
                    className="w-11 h-10 bg-neutral-950 border border-neutral-800 rounded-xl p-1 cursor-pointer"
                  />
                  <input
                    type="text"
                    name="secondaryColor"
                    value={formData.secondaryColor}
                    onChange={handleChange}
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2 text-sm text-white transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Enlace de Logo (URL)</label>
                <input
                  type="url"
                  name="logoUrl"
                  placeholder="https://ejemplo.com/logo.png"
                  value={formData.logoUrl}
                  onChange={handleChange}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2.5 text-sm text-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Enlace de Imagen de Portada (Banner URL)</label>
                <input
                  type="url"
                  name="bannerUrl"
                  placeholder="https://ejemplo.com/banner.jpg"
                  value={formData.bannerUrl}
                  onChange={handleChange}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl px-4 py-2.5 text-sm text-white transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-neutral-400">Opacidad de la Portada</label>
                  <span className="text-xs text-neutral-500 font-mono">{Math.round(formData.bannerOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  name="bannerOpacity"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.bannerOpacity}
                  onChange={handleChange}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-6 border-t border-neutral-800/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/restaurantes")}
              disabled={loading}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

