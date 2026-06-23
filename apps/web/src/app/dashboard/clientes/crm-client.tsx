"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  Users, Search, Filter, Calendar, DollarSign,
  User, CheckCircle2, AlertTriangle, ChevronRight,
  Plus, X, Save, Edit3, Tag, MessageSquare, Clipboard,
  RefreshCw, Trash2
} from "lucide-react"
import { toast } from "sonner"

interface CustomerSummary {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  tags: string[]
  totalVisits: number
  totalSpent: number
  lastVisitAt: string | null
  segment: string
}

interface Preference {
  key: string
  value: string
}

interface Booking {
  id: string
  dateTime: string
  partySize: number
  status: string
  specialRequests: string | null
  branch: { name: string }
  tables: Array<{ number: string }>
}

interface CustomerDetail {
  customer: {
    id: string
    name: string
    email: string
    phone: string | null
    notes: string | null
    createdAt: string
  }
  preferences: Preference[]
  tags: string[]
  bookings: Booking[]
  communications: any[]
  stats: {
    totalVisits: number
    totalSpent: number
    avgPartySize: number
    firstVisitAt: string | null
    lastVisitAt: string | null
    daysSinceLastVisit: number | null
    segment: string
  }
}

interface CrmClientProps {
  restaurantId: string
}

export default function CrmClient({ restaurantId }: CrmClientProps) {
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>("")
  const [selectedSegment, setSelectedSegment] = useState<string>("ALL")

  // Selected customer for detail view
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("resumen")

  // Form states for edits
  const [editNotes, setEditNotes] = useState<string>("")
  const [editTags, setEditTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState<string>("")
  const [editPreferences, setEditPreferences] = useState<Preference[]>([])

  // Load customer list
  useEffect(() => {
    fetchCustomers()
  }, [search, selectedSegment])

  // Load customer profile when selection changes
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetail(selectedCustomerId)
    }
  }, [selectedCustomerId])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const segParam = selectedSegment !== "ALL" ? `&segment=${selectedSegment}` : ""
      const res = await fetch(`/api/dashboard/customers?search=${encodeURIComponent(search)}${segParam}`)
      const json = await res.json()
      if (json.status === "success") {
        setCustomers(json.data || [])
      } else {
        toast.error("Error al cargar clientes.")
      }
    } catch (err) {
      toast.error("Error de conexión.")
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomerDetail = async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/dashboard/customers/${id}`)
      const json = await res.json()
      if (json.status === "success") {
        const detail = json.data as CustomerDetail
        setCustomerDetail(detail)
        setEditNotes(detail.customer.notes || "")
        setEditTags(detail.tags || [])
        // Map preferences ensuring key keys exist
        const defaultKeys = ["alergias", "solicitudes_frecuentes", "bebida_preferida", "mesa_preferida"]
        const mappedPrefs = defaultKeys.map(k => {
          const found = detail.preferences.find(p => p.key === k)
          return { key: k, value: found ? found.value : "" }
        })
        setEditPreferences(mappedPrefs)
      } else {
        toast.error("No se pudo cargar la ficha del cliente.")
      }
    } catch (err) {
      toast.error("Error al conectar con el servidor.")
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!selectedCustomerId || !customerDetail) return

    try {
      const res = await fetch(`/api/dashboard/customers/${selectedCustomerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes,
          tags: editTags,
          preferences: editPreferences.filter(p => p.value.trim() !== ""),
        }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Perfil de cliente actualizado.")
        fetchCustomers() // Refresh list stats
        fetchCustomerDetail(selectedCustomerId) // Reload details
      } else {
        toast.error("Error al actualizar perfil.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleAddTag = () => {
    const cleanTag = newTagInput.trim().toUpperCase()
    if (cleanTag && !editTags.includes(cleanTag)) {
      setEditTags([...editTags, cleanTag])
      setNewTagInput("")
    }
  }

  const handleRemoveTag = (tagName: string) => {
    setEditTags(editTags.filter(t => t !== tagName))
  }

  const handleDeleteCustomer = async () => {
    if (!selectedCustomerId || !customerDetail) return
    if (!confirm(`¿Estás seguro de eliminar a ${customerDetail.customer.name}? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/dashboard/customers/${selectedCustomerId}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (json.status === "success" || res.ok) {
        toast.success("Cliente eliminado.")
        setSelectedCustomerId(null)
        setCustomerDetail(null)
        fetchCustomers()
      } else {
        toast.error(json.error || "Error al eliminar el cliente.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handlePreferenceChange = (key: string, value: string) => {
    setEditPreferences(prev => prev.map(p => p.key === key ? { ...p, value } : p))
  }

  const getSegmentStyles = (segment: string) => {
    switch (segment.toUpperCase()) {
      case "VIP":
        return "bg-purple-500/10 border-purple-500/20 text-purple-400"
      case "REGULAR":
        return "bg-blue-500/10 border-blue-500/20 text-blue-400"
      case "NEW":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      case "AT_RISK":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400"
      case "INACTIVE":
        return "bg-neutral-500/10 border-neutral-500/20 text-neutral-400"
      default:
        return "bg-neutral-800 border-neutral-700 text-neutral-400"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-red-500" />
          CRM de Clientes
        </h1>
        <p className="text-neutral-400 text-sm">
          Conoce a tus comensales, guarda sus preferencias y segmenta para fidelización.
        </p>
      </div>

      {/* Main CRM split pane workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Customer List view pane */}
        <div className="lg:col-span-2 space-y-4 bg-neutral-900/30 p-4 border border-neutral-800 rounded-3xl">
          {/* Search and filter controls bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-600" />
              <input
                type="text"
                placeholder="Buscar cliente por nombre, correo o celular..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-red-500"
              >
                <option value="ALL">Todos los segmentos</option>
                <option value="VIP">VIP</option>
                <option value="REGULAR">Regular</option>
                <option value="NEW">Nuevo</option>
                <option value="AT_RISK">En riesgo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </div>
          </div>

          {/* Customers Table list */}
          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
              Cargando base de datos de clientes...
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-neutral-800 rounded-2xl text-xs text-neutral-500">
              No se encontraron clientes con el criterio de búsqueda especificado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-850 text-[10px] text-neutral-500 uppercase font-semibold">
                    <th className="py-3 px-4">Comensal</th>
                    <th className="py-3 px-4">Segmento</th>
                    <th className="py-3 px-4 text-center">Visitas</th>
                    <th className="py-3 px-4 text-right">Consumo</th>
                    <th className="py-3 px-4 text-right">Última Visita</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`hover:bg-neutral-900/40 transition-colors cursor-pointer group ${
                        selectedCustomerId === c.id ? "bg-neutral-900/60" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-750 flex items-center justify-center font-bold text-white text-xs">
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-white truncate max-w-[150px]">{c.name}</p>
                          <p className="text-[10px] text-neutral-500 truncate max-w-[150px]">{c.email}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold tracking-wider ${getSegmentStyles(c.segment)}`}>
                          {c.segment}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-semibold text-neutral-300">
                        {c.totalVisits}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs font-medium text-emerald-400">
                        {c.totalSpent > 0 ? `$${c.totalSpent.toLocaleString()} COP` : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right text-[10px] text-neutral-400">
                        {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-neutral-700 group-hover:text-white transition-colors ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer Profile detail view pane */}
        <div className="lg:col-span-1">
          {selectedCustomerId ? (
            loadingDetail ? (
              <div className="p-12 text-center text-xs text-neutral-500 bg-neutral-900/30 border border-neutral-800 rounded-3xl">
                Cargando ficha del comensal...
              </div>
            ) : customerDetail ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-5 shadow-2xl">
                {/* Profile Header */}
                <div className="flex items-start gap-4 border-b border-neutral-850 pb-4">
                  <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-red-600/10">
                    {customerDetail.customer.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="font-bold text-sm text-white truncate">{customerDetail.customer.name}</h2>
                    <p className="text-[10px] text-neutral-500 truncate">{customerDetail.customer.email}</p>
                    <p className="text-[10px] text-neutral-500">{customerDetail.customer.phone || "Sin teléfono registrado"}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full border text-[9px] font-semibold tracking-wider mt-1 ${getSegmentStyles(customerDetail.stats.segment)}`}>
                      {customerDetail.stats.segment}
                    </span>
                  </div>
                  <button
                    onClick={handleDeleteCustomer}
                    title="Eliminar cliente"
                    className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs bar */}
                <div className="flex border-b border-neutral-850 text-xs">
                  <button
                    onClick={() => setActiveTab("resumen")}
                    className={`flex-1 pb-2 border-b-2 font-medium transition-colors ${
                      activeTab === "resumen" ? "border-red-600 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Resumen
                  </button>
                  <button
                    onClick={() => setActiveTab("historial")}
                    className={`flex-1 pb-2 border-b-2 font-medium transition-colors ${
                      activeTab === "historial" ? "border-red-600 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Historial
                  </button>
                  <button
                    onClick={() => setActiveTab("preferencias")}
                    className={`flex-1 pb-2 border-b-2 font-medium transition-colors ${
                      activeTab === "preferencias" ? "border-red-600 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Ficha
                  </button>
                </div>

                {/* Tab content panel */}
                <div className="space-y-4 min-h-[300px] overflow-auto">
                  {activeTab === "resumen" && (
                    <div className="space-y-4 text-xs">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl space-y-0.5">
                          <p className="text-[10px] text-neutral-500 uppercase">Total Visitas</p>
                          <p className="text-lg font-bold text-white">{customerDetail.stats.totalVisits}</p>
                        </div>
                        <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl space-y-0.5">
                          <p className="text-[10px] text-neutral-500 uppercase">Gasto Total</p>
                          <p className="text-lg font-bold text-emerald-400">
                            ${customerDetail.stats.totalSpent.toLocaleString()} COP
                          </p>
                        </div>
                        <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl space-y-0.5">
                          <p className="text-[10px] text-neutral-500 uppercase">Comensales Promedio</p>
                          <p className="text-lg font-bold text-white">{customerDetail.stats.avgPartySize}p</p>
                        </div>
                        <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl space-y-0.5">
                          <p className="text-[10px] text-neutral-500 uppercase">Días Inactivo</p>
                          <p className="text-lg font-bold text-neutral-300">
                            {customerDetail.stats.daysSinceLastVisit !== null ? `${customerDetail.stats.daysSinceLastVisit} días` : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Communications Logs count */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
                          Últimas comunicaciones
                        </h4>
                        {customerDetail.communications.length === 0 ? (
                          <p className="text-neutral-500 italic text-[11px]">No hay registros de chats.</p>
                        ) : (
                          <div className="space-y-2 max-h-[140px] overflow-auto">
                            {customerDetail.communications.slice(0, 3).map((log: any) => (
                              <div key={log.id} className="p-2 rounded bg-neutral-950/60 border border-neutral-900 flex justify-between gap-2">
                                <div>
                                  <p className="text-white text-[11px] truncate max-w-[180px]">{log.content}</p>
                                  <span className="text-[9px] text-neutral-500 capitalize">{log.type} · {log.direction}</span>
                                </div>
                                <span className="text-[8px] text-neutral-600 mt-0.5">
                                  {new Date(log.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "historial" && (
                    <div className="space-y-3.5 text-xs max-h-[380px] overflow-auto pr-1">
                      {customerDetail.bookings.length === 0 ? (
                        <p className="text-neutral-500 italic">Este cliente no registra visitas pasadas.</p>
                      ) : (
                        customerDetail.bookings.map((booking) => (
                          <div key={booking.id} className="p-3 bg-neutral-950 border border-neutral-850 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-white font-semibold">
                                {new Date(booking.dateTime).toLocaleDateString()}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase ${
                                booking.status === "CHECKED_IN"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : booking.status === "NO_SHOW"
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}>
                                {booking.status === "CHECKED_IN" ? "Checked-in" : booking.status === "NO_SHOW" ? "No-Show" : "Completada"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-neutral-400 text-[10px] pt-1 border-t border-neutral-900">
                              <span>Sede: {booking.branch.name}</span>
                              <span>{booking.partySize} personas</span>
                            </div>
                            {booking.tables.length > 0 && (
                              <p className="text-[10px] text-neutral-500">
                                Mesa: {booking.tables.map(t => t.number).join(", ")}
                              </p>
                            )}
                            {booking.specialRequests && (
                              <p className="text-[10px] text-amber-500/80 italic font-mono">
                                Request: "{booking.specialRequests}"
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === "preferencias" && (
                    <div className="space-y-4 text-xs">
                      {/* Notes area */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-neutral-400 font-medium flex items-center gap-1">
                          <Clipboard className="w-3.5 h-3.5 text-neutral-500" />
                          Notas internas del staff
                        </label>
                        <textarea
                          placeholder="ej. Prefiere mesas tranquilas, alérgico al gluten..."
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full h-20 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 resize-none"
                        />
                      </div>

                      {/* Dynamic Key Value Preferences fields */}
                      <div className="space-y-3">
                        <label className="text-xs text-neutral-400 font-medium">Preferencias de servicio</label>
                        {editPreferences.map((p) => (
                          <div key={p.key} className="grid grid-cols-3 gap-2 items-center">
                            <span className="text-[10px] text-neutral-500 font-mono capitalize">
                              {p.key.replace("_", " ")}:
                            </span>
                            <input
                              type="text"
                              value={p.value}
                              onChange={(e) => handlePreferenceChange(p.key, e.target.value)}
                              placeholder="..."
                              className="col-span-2 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-850 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-red-500"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Interative Tags list */}
                      <div className="space-y-2 border-t border-neutral-850 pt-3">
                        <label className="text-xs text-neutral-400 font-medium flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-neutral-500" />
                          Etiquetas de Cliente
                        </label>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {editTags.map((t) => (
                            <span
                              key={t}
                              className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[9px] text-white font-semibold"
                            >
                              {t}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(t)}
                                className="text-neutral-500 hover:text-red-400 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="NUEVO TAG..."
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                handleAddTag()
                              }
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-850 text-[10px] text-white focus:outline-none focus:border-red-500 uppercase font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleAddTag}
                            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-white text-[10px] font-semibold transition-colors"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>

                      {/* Save Profile Button */}
                      <button
                        onClick={handleUpdateProfile}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-850 hover:bg-neutral-800 text-white text-xs font-bold transition-all"
                      >
                        <Save className="w-4 h-4" />
                        Guardar Ficha
                      </button>

                      {/* Danger Zone */}
                      <div className="border-t border-red-900/20 mt-4 pt-4 space-y-2">
                        <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Zona de Peligro</p>
                        <button
                          onClick={handleDeleteCustomer}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-950/20 border border-red-900/30 hover:bg-red-900/40 text-red-400 text-xs font-bold transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar Cliente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null
          ) : (
            <div className="p-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 bg-neutral-900/10 rounded-3xl space-y-2">
              <User className="w-10 h-10 text-neutral-700 mx-auto" />
              <p className="text-white font-medium">Ficha del comensal</p>
              <p>Selecciona un cliente del listado para ver su historial, estadísticas y preferencias.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
