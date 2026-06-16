"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutGrid, Plus, Edit2, Play, Trash2, CheckCircle2,
  XCircle, UserPlus, ZoomIn, ZoomOut, RotateCcw,
  Sparkles, Layers, RefreshCw, AlertTriangle
} from "lucide-react"
import { toast } from "sonner"

interface Branch {
  id: string
  name: string
}

interface TableType {
  id: string
  name: string
  minCapacity: number
  maxCapacity: number
}

interface Booking {
  id: string
  dateTime: string
  partySize: number
  status: string
  customer: {
    name: string
    phone: string | null
  }
}

interface Table {
  id: string
  number: string
  capacity: number
  x: number
  y: number
  shape: string // ROUND, SQUARE, RECTANGLE
  status: string // AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE
  tableTypeId: string
  tableType: {
    name: string
  }
  bookings: Booking[]
}

interface Zone {
  id: string
  name: string
  width: number
  height: number
  tables: Table[]
}

interface FloorPlanClientProps {
  initialBranches: Branch[]
  restaurantId: string
}

export default function FloorPlanClient({ initialBranches, restaurantId }: FloorPlanClientProps) {
  const router = useRouter()
  const [branches] = useState<Branch[]>(initialBranches)
  const [selectedBranchId, setSelectedBranchId] = useState<string>("")
  const [zones, setZones] = useState<Zone[]>([])
  const [tableTypes, setTableTypes] = useState<TableType[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string>("")
  const [editMode, setEditMode] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  // Zoom & View
  const [scale, setScale] = useState<number>(1)

  // Modals / Dialogs
  const [showAddZoneModal, setShowAddZoneModal] = useState<boolean>(false)
  const [newZoneName, setNewZoneName] = useState<string>("")
  const [showAddTableModal, setShowAddTableModal] = useState<boolean>(false)
  const [newTableNumber, setNewTableNumber] = useState<string>("")
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4)
  const [newTableShape, setNewTableShape] = useState<string>("SQUARE")
  const [newTableTypeId, setNewTableTypeId] = useState<string>("")

  // Table Details Modal
  const [activeTable, setActiveTable] = useState<Table | null>(null)
  const [showTableDetailsModal, setShowTableDetailsModal] = useState<boolean>(false)

  // Unassigned Bookings Sidebar list
  const [unassignedBookings, setUnassignedBookings] = useState<any[]>([])

  // Drag State for Tables (within SVG Canvas)
  const [draggingTable, setDraggingTable] = useState<{ id: string; startX: number; startY: number } | null>(null)

  // Load selected branch first
  useEffect(() => {
    if (branches.length > 0) {
      setSelectedBranchId(branches[0].id)
    }
  }, [branches])

  // Fetch Zones, Tables, and Bookings when Branch changes
  useEffect(() => {
    if (selectedBranchId) {
      fetchFloorPlanData()
      fetchUnassignedBookings()
    }
  }, [selectedBranchId])

  const fetchFloorPlanData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/zones?branchId=${selectedBranchId}`)
      const json = await res.json()
      if (json.status === "success") {
        setZones(json.data.zones || [])
        setTableTypes(json.data.tableTypes || [])
        if (json.data.zones?.length > 0 && !selectedZoneId) {
          setSelectedZoneId(json.data.zones[0].id)
        }
      } else {
        toast.error("Error al cargar zonas.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error de conexión.")
    } finally {
      setLoading(false)
    }
  }

  const fetchUnassignedBookings = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const res = await fetch(`/api/dashboard/bookings?date=${today}&branchId=${selectedBranchId}`)
      const json = await res.json()
      if (json.status === "success") {
        // Bookings with NO tables assigned
        const unassigned = (json.data || []).filter((b: any) => !b.tables || b.tables.length === 0)
        setUnassignedBookings(unassigned)
      }
    } catch (err) {
      console.error("Error listing unassigned bookings", err)
    }
  }

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newZoneName.trim()) return

    try {
      const res = await fetch("/api/dashboard/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId,
          name: newZoneName.trim(),
        }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Zona creada con éxito.")
        setNewZoneName("")
        setShowAddZoneModal(false)
        fetchFloorPlanData()
      } else {
        toast.error(json.error || "No se pudo crear la zona.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta zona y todas sus mesas?")) return

    try {
      const res = await fetch(`/api/dashboard/zones/${zoneId}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Zona eliminada con éxito.")
        setSelectedZoneId("")
        fetchFloorPlanData()
      } else {
        toast.error("Error al eliminar zona.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTableNumber.trim() || !newTableTypeId) {
      toast.error("Por favor llena todos los campos.")
      return
    }

    try {
      const res = await fetch("/api/dashboard/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: selectedZoneId,
          tableTypeId: newTableTypeId,
          number: newTableNumber,
          capacity: Number(newTableCapacity),
          shape: newTableShape,
          x: 120,
          y: 120,
        }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success(`Mesa ${newTableNumber} agregada al plano.`)
        setNewTableNumber("")
        setNewTableTypeId("")
        setShowAddTableModal(false)
        fetchFloorPlanData()
      } else {
        toast.error(json.error || "No se pudo agregar la mesa.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta mesa?")) return

    try {
      const res = await fetch(`/api/dashboard/tables/${tableId}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Mesa eliminada.")
        setShowTableDetailsModal(false)
        setActiveTable(null)
        fetchFloorPlanData()
      } else {
        toast.error("Error al eliminar la mesa.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  // Drag & Drop Table Coordinate Updates (via SVG absolute moves)
  const handleSvgMouseDown = (e: React.MouseEvent<SVGElement>, tableId: string, tableX: number, tableY: number) => {
    if (!editMode) return
    e.preventDefault()
    // Calculate initial relative mouse drag offset
    const clientX = e.clientX
    const clientY = e.clientY
    setDraggingTable({
      id: tableId,
      startX: clientX - tableX,
      startY: clientY - tableY,
    })
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGElement>) => {
    if (!draggingTable) return
    const activeZone = zones.find(z => z.id === selectedZoneId)
    if (!activeZone) return

    // Calculate raw target coordinates
    const newX = e.clientX - draggingTable.startX
    const newY = e.clientY - draggingTable.startY

    // Snap to 10px grid and boundary containment
    const snappedX = Math.max(10, Math.min(activeZone.width - 60, Math.round(newX / 10) * 10))
    const snappedY = Math.max(10, Math.min(activeZone.height - 60, Math.round(newY / 10) * 10))

    // Optimistically update table coordinates in local state
    setZones(prevZones =>
      prevZones.map(z => {
        if (z.id !== selectedZoneId) return z
        return {
          ...z,
          tables: z.tables.map(t => (t.id === draggingTable.id ? { ...t, x: snappedX, y: snappedY } : t)),
        }
      })
    )
  }

  const handleSvgMouseUp = async () => {
    if (!draggingTable) return
    const tableId = draggingTable.id
    setDraggingTable(null)

    // Find table updated coordinates
    const activeZone = zones.find(z => z.id === selectedZoneId)
    const table = activeZone?.tables.find(t => t.id === tableId)
    if (!table) return

    // Persist new coordinates in DB
    try {
      await fetch(`/api/dashboard/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: table.x,
          y: table.y,
        }),
      })
    } catch (err) {
      toast.error("Error al guardar coordenadas en base de datos.")
    }
  }

  // Booking Actions on Table (Check-in, Check-out, Assign)
  const handleAssignBookingToTable = async (bookingId: string, tableId: string) => {
    try {
      const res = await fetch(`/api/dashboard/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableIds: [tableId],
          status: "CHECKED_IN", // auto check-in upon placing on table
        }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Mesa asignada con check-in rápido.")
        fetchFloorPlanData()
        fetchUnassignedBookings()
      } else {
        toast.error(json.error || "No se pudo asignar.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleCheckInBooking = async (bookingId: string, tableId: string) => {
    try {
      const res = await fetch(`/api/dashboard/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CHECKED_IN",
        }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Check-in realizado con éxito.")
        setShowTableDetailsModal(false)
        fetchFloorPlanData()
      } else {
        toast.error("Error al realizar check-in.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleReleaseTable = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/dashboard/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CHECKED_IN", // Keep status checked_in but clear physical tables
          tableIds: [], // disconnect tables
        }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Mesa liberada.")
        setShowTableDetailsModal(false)
        fetchFloorPlanData()
        fetchUnassignedBookings()
      } else {
        toast.error("Error al liberar mesa.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleCheckoutTable = async (bookingId: string) => {
    try {
      // Mark booking as completed (checkout is simulated by releasing table & cancelling/finishing)
      const res = await fetch(`/api/dashboard/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED", // cancel/checkout frees table
        }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success("Check-out realizado. Mesa disponible.")
        setShowTableDetailsModal(false)
        fetchFloorPlanData()
        fetchUnassignedBookings()
      } else {
        toast.error("Error al realizar checkout.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleTableStatusChange = async (tableId: string, nextStatus: string) => {
    try {
      const res = await fetch(`/api/dashboard/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success(`Mesa cambiada a ${nextStatus}`)
        setShowTableDetailsModal(false)
        fetchFloorPlanData()
      } else {
        toast.error("Error al cambiar estado.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  // Active Zone & Stats
  const activeZone = zones.find((z) => z.id === selectedZoneId)
  const allTables = zones.reduce<Table[]>((all, z) => [...all, ...z.tables], [])

  // Calculate live stats
  const totalTablesCount = allTables.length
  const occupiedTables = allTables.filter((t) => t.status === "OCCUPIED" || t.bookings.some(b => b.status === "CHECKED_IN")).length
  const maintenanceTables = allTables.filter((t) => t.status === "MAINTENANCE").length
  const availableTables = totalTablesCount - occupiedTables - maintenanceTables
  const occupancyPercentage = totalTablesCount > 0 ? Math.round((occupiedTables / totalTablesCount) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-red-500" />
            Floor Plan interactivo
          </h1>
          <p className="text-neutral-400 text-sm">
            Diseña la distribución de tu restaurante y gestiona comensales en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Branch Select */}
          <select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value)
              setSelectedZoneId("")
            }}
            className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-red-500"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Mode Switcher Toggle */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md ${
              editMode
                ? "bg-amber-500 text-black hover:bg-amber-400"
                : "bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800"
            }`}
          >
            {editMode ? (
              <>
                <Edit2 className="w-4 h-4 animate-pulse" />
                Modo Edición
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-emerald-400" />
                Modo Operación
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-1">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Mesas Libres</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-emerald-400">{availableTables}</p>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-1">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Mesas Ocupadas</p>
          <p className="text-2xl font-bold text-red-400">{occupiedTables}</p>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-1">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Tasa de Ocupación</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-white">{occupancyPercentage}%</p>
            <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${occupancyPercentage}%` }}
              />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-1">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Fuera de Servicio</p>
          <p className="text-2xl font-bold text-neutral-500">{maintenanceTables}</p>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Left canvas board (Zones & Interactive Canvas) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Zones Tabs Selector bar */}
          <div className="flex items-center justify-between bg-neutral-900/50 p-2 border border-neutral-800/80 rounded-2xl">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedZoneId === zone.id
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/15"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  {zone.name}
                </button>
              ))}
              {editMode && (
                <button
                  onClick={() => setShowAddZoneModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-neutral-700 text-xs text-neutral-400 hover:text-white hover:border-white transition-all ml-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva Zona
                </button>
              )}
            </div>

            {editMode && activeZone && (
              <button
                onClick={() => handleDeleteZone(activeZone.id)}
                className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Eliminar Zona actual"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Canvas Board wrapper */}
          {activeZone ? (
            <div className="relative border border-neutral-800 rounded-3xl bg-neutral-950 overflow-auto shadow-2xl flex flex-col justify-center items-center">
              {/* Canvas controls banner overlay */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md">
                <button
                  onClick={() => setScale(prev => Math.min(prev + 0.1, 1.8))}
                  className="p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setScale(prev => Math.max(prev - 0.1, 0.6))}
                  className="p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setScale(1)}
                  className="p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                  title="Restaurar zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                {editMode && (
                  <button
                    onClick={() => setShowAddTableModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva Mesa
                  </button>
                )}
              </div>

              {/* Dynamic SVG Board */}
              <div
                className="w-full transition-all flex justify-center items-center overflow-auto p-8"
                style={{
                  minHeight: activeZone.height + 40,
                }}
              >
                <svg
                  width={activeZone.width}
                  height={activeZone.height}
                  className="border border-dashed border-neutral-800/80 rounded-2xl bg-neutral-950 select-none"
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={handleSvgMouseUp}
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    transition: draggingTable ? "none" : "transform 0.2s ease",
                  }}
                >
                  {/* Premium Grid Pattern Background */}
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="#262626" />
                    </pattern>
                    <filter id="tableShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
                    </filter>
                  </defs>
                  <rect width={activeZone.width} height={activeZone.height} fill="url(#grid)" />

                  {/* Render Tables */}
                  {activeZone.tables.map((table) => {
                    const hasActiveBooking = table.bookings.length > 0
                    const activeBooking = hasActiveBooking ? table.bookings[0] : null
                    
                    // Determine occupancy status color
                    let tableColor = "#262626" // DEFAULT
                    let strokeColor = "#404040"
                    
                    if (table.status === "MAINTENANCE") {
                      tableColor = "#404040" // Grey
                      strokeColor = "#737373"
                    } else if (table.bookings.some(b => b.status === "CHECKED_IN") || table.status === "OCCUPIED") {
                      tableColor = "#ef4444" // Red
                      strokeColor = "#f87171"
                    } else if (table.bookings.some(b => b.status === "CONFIRMED") || table.status === "RESERVED") {
                      tableColor = "#f59e0b" // Orange/Yellow
                      strokeColor = "#fbbf24"
                    } else {
                      tableColor = "#10b981" // Green
                      strokeColor = "#34d399"
                    }

                    const isDraggingThis = draggingTable?.id === table.id

                    return (
                      <g
                        key={table.id}
                        onMouseDown={(e) => handleSvgMouseDown(e, table.id, table.x, table.y)}
                        onClick={() => {
                          if (!editMode) {
                            setActiveTable(table)
                            setShowTableDetailsModal(true)
                          }
                        }}
                        style={{ cursor: editMode ? "move" : "pointer" }}
                        className="transition-opacity duration-150"
                        opacity={isDraggingThis ? 0.7 : 1}
                      >
                        {table.shape === "ROUND" ? (
                          // CIRCULAR TABLE
                          <g>
                            <circle
                              cx={table.x}
                              cy={table.y}
                              r={30 + table.capacity * 2}
                              fill={tableColor}
                              fillOpacity={0.15}
                              stroke={strokeColor}
                              strokeWidth={isDraggingThis ? 3 : 2}
                              filter="url(#tableShadow)"
                            />
                            <circle
                              cx={table.x}
                              cy={table.y}
                              r={16}
                              fill="#0a0a0a"
                              stroke={strokeColor}
                              strokeWidth={1}
                            />
                          </g>
                        ) : table.shape === "RECTANGLE" ? (
                          // RECTANGULAR TABLE
                          <rect
                            x={table.x - 45}
                            y={table.y - 30}
                            width={90}
                            height={60}
                            rx={8}
                            fill={tableColor}
                            fillOpacity={0.15}
                            stroke={strokeColor}
                            strokeWidth={isDraggingThis ? 3 : 2}
                            filter="url(#tableShadow)"
                          />
                        ) : (
                          // SQUARE TABLE
                          <rect
                            x={table.x - 35}
                            y={table.y - 35}
                            width={70}
                            height={70}
                            rx={8}
                            fill={tableColor}
                            fillOpacity={0.15}
                            stroke={strokeColor}
                            strokeWidth={isDraggingThis ? 3 : 2}
                            filter="url(#tableShadow)"
                          />
                        )}

                        {/* Table Number & Capacity text overlays */}
                        <text
                          x={table.x}
                          y={table.y + 4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="13"
                          fontWeight="bold"
                        >
                          {table.number}
                        </text>
                        
                        <text
                          x={table.x}
                          y={table.shape === "ROUND" ? table.y + 24 : table.y + 20}
                          textAnchor="middle"
                          fill="#a3a3a3"
                          fontSize="9"
                        >
                          {table.capacity}p
                        </text>

                        {/* Status indicators badges */}
                        {activeBooking && (
                          <g transform={`translate(${table.x - 30}, ${table.y - 50})`}>
                            <rect
                              width={60}
                              height={16}
                              rx={4}
                              fill="#171717"
                              stroke={strokeColor}
                              strokeWidth={0.5}
                            />
                            <text
                              x={30}
                              y={11}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="8"
                              fontWeight="medium"
                            >
                              {activeBooking.customer.name.split(" ")[0]}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/10 space-y-4">
              <Layers className="w-12 h-12 text-neutral-700 mx-auto" />
              <div className="max-w-md mx-auto space-y-2">
                <p className="font-semibold text-white">No hay zonas configuradas</p>
                <p className="text-xs text-neutral-500">
                  Crea tu primera zona (como Terraza o Comedor Principal) para comenzar a colocar mesas.
                </p>
              </div>
              {editMode && (
                <button
                  onClick={() => setShowAddZoneModal(true)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold shadow-lg shadow-red-600/10"
                >
                  Crear Zona
                </button>
              )}
            </div>
          )}

          {/* Legends panel */}
          <div className="flex flex-wrap items-center gap-6 p-4 bg-neutral-900/30 border border-neutral-800 rounded-2xl text-xs text-neutral-400">
            <span className="font-medium text-white">Estados de Mesa:</span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500" />
              <span>Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500" />
              <span>Reservada</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neutral-600/20 border border-neutral-500" />
              <span>Fuera de Servicio</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar panel (Reservas de hoy sin asignar) */}
        <div className="space-y-4">
          <div className="p-4 rounded-3xl border border-neutral-800 bg-neutral-900/20 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Reservas sin asignar
              </h3>
              <button
                onClick={fetchUnassignedBookings}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                title="Refrescar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {unassignedBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
                No hay reservas sin asignar para hoy.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-auto pr-1">
                {unassignedBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all space-y-2 group shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-xs text-white truncate max-w-[140px]">
                          {b.customer.name}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          {b.dateTime ? new Date(b.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Hora desconocida"}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-400 text-[9px] font-mono">
                        {b.partySize}p
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-800/40">
                      <span className="text-[9px] text-neutral-500 uppercase tracking-tight">
                        {b.tableType?.name || "Mesa estándar"}
                      </span>

                      {!editMode && activeZone && activeZone.tables.length > 0 && (
                        <div className="relative group/btn">
                          <button
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold shadow-md transition-all shrink-0"
                          >
                            <UserPlus className="w-3 h-3" />
                            Asignar...
                          </button>
                          
                          {/* Floating menu drop down for assignment */}
                          <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover/btn:block bg-neutral-950 border border-neutral-800 p-2 rounded-xl shadow-2xl z-30 min-w-[120px] max-h-[160px] overflow-auto">
                            <p className="text-[8px] text-neutral-500 uppercase font-bold tracking-wider px-2 py-1 border-b border-neutral-800">
                              Mesa libre:
                            </p>
                            {activeZone.tables
                              .filter((t) => t.status === "AVAILABLE" && t.bookings.length === 0)
                              .map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => handleAssignBookingToTable(b.id, t.id)}
                                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-neutral-800 text-xs text-white truncate transition-colors"
                                >
                                  Mesa {t.number} ({t.capacity}p)
                                </button>
                              ))}
                            {activeZone.tables.filter(t => t.status === "AVAILABLE" && t.bookings.length === 0).length === 0 && (
                              <p className="text-[10px] text-neutral-600 px-2 py-1.5">No hay libres</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Zone Modal */}
      {showAddZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Crear Nueva Zona</h3>
            <form onSubmit={handleCreateZone} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-medium">Nombre de la Zona</label>
                <input
                  type="text"
                  placeholder="ej. Terraza, Interior, VIP"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddZoneModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/15 transition-all"
                >
                  Crear Zona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Agregar Nueva Mesa</h3>
            <form onSubmit={handleCreateTable} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Número / Identificador</label>
                  <input
                    type="text"
                    placeholder="ej. 1, A, VIP-1"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Capacidad (Comensales)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Forma Física</label>
                  <select
                    value={newTableShape}
                    onChange={(e) => setNewTableShape(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="ROUND">Circular</option>
                    <option value="SQUARE">Cuadrada</option>
                    <option value="RECTANGLE">Rectangular</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Tipo de Mesa</label>
                  <select
                    value={newTableTypeId}
                    onChange={(e) => setNewTableTypeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-red-500"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {tableTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.minCapacity}-{t.maxCapacity}p)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/15 transition-all"
                >
                  Crear Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table Details / Booking Actions Modal */}
      {showTableDetailsModal && activeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white">Mesa {activeTable.number}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Capacidad: {activeTable.capacity} personas · Tipo: {activeTable.tableType?.name}
                </p>
              </div>
              <button
                onClick={() => setShowTableDetailsModal(false)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Status Info */}
            <div className="space-y-4">
              {/* If there is an active reservation sent to this table */}
              {activeTable.bookings.length > 0 ? (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/35 text-red-400 text-[10px] font-semibold uppercase">
                      Mesa Ocupada
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {new Date(activeTable.bookings[0].dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-sm text-white">{activeTable.bookings[0].customer.name}</p>
                    <p className="text-xs text-neutral-500">{activeTable.bookings[0].customer.phone || "Sin teléfono"}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-400 pt-1 border-t border-neutral-900">
                    <span>Comensales: {activeTable.bookings[0].partySize}</span>
                    <span>Reserva ID: {activeTable.bookings[0].id.slice(0,8).toUpperCase()}</span>
                  </div>

                  {/* Operational actions */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {activeTable.bookings[0].status === "CONFIRMED" && (
                      <button
                        onClick={() => handleCheckInBooking(activeTable.bookings[0].id, activeTable.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Marcar Check-in
                      </button>
                    )}
                    <button
                      onClick={() => handleCheckoutTable(activeTable.bookings[0].id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
                    >
                      Liberar y Checkout
                    </button>
                    <button
                      onClick={() => handleReleaseTable(activeTable.bookings[0].id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 border border-red-800/20 text-red-300 text-xs font-semibold transition-colors"
                    >
                      Desvincular Mesa
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    La mesa se encuentra actualmente **disponible**.
                  </div>

                  {/* Manual Status Overrides */}
                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-medium">Cambiar Estado Manual:</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleTableStatusChange(activeTable.id, "AVAILABLE")}
                        className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs transition-colors"
                      >
                        Disponible
                      </button>
                      <button
                        onClick={() => handleTableStatusChange(activeTable.id, "MAINTENANCE")}
                        className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400 hover:bg-neutral-800 text-xs transition-colors"
                      >
                        Fuera de Servicio / Mantenimiento
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
              <button
                onClick={() => handleDeleteTable(activeTable.id)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Mesa
              </button>
              <button
                onClick={() => setShowTableDetailsModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
