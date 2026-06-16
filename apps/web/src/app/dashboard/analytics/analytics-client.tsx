"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  BarChart3, Calendar, Users, TrendingUp, Download,
  Printer, Sparkles, RefreshCw, AlertTriangle, CheckCircle2,
  DollarSign, ArrowUpRight, Award, Clock
} from "lucide-react"
import { toast } from "sonner"

interface Metric {
  totalReservations: number
  reservationGrowth: number
  conversionRate: number
  avgOccupancy: number
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  retentionRate: number
  noShowRate: number
  lostRevenue: number
  totalDeposits: number
  estimatedRevenue: number
  avgTicketPerPerson: number
}

interface ChartData {
  reservationsByDay: Array<{ date: string; total: number; noShows: number }>
  occupancyByHour: Array<{ hour: string; occupancy: number; capacity: number }>
  sourceDistribution: Array<{ source: string; count: number; percentage: number }>
  partySizeDistribution: Array<{ size: number; count: number }>
  dayOfWeekDistribution: Array<{ day: string; count: number }>
  newVsReturning: Array<{ date: string; new: number; returning: number }>
}

interface Insight {
  type: string
  message: string
}

interface AnalyticsData {
  metrics: Metric
  chartsData: ChartData
  insights: Insight[]
}

interface AnalyticsClientProps {
  restaurantId: string
}

export default function AnalyticsClient({ restaurantId }: AnalyticsClientProps) {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/analytics?days=${days}`)
      const json = await res.json()
      if (json.status === "success") {
        setData(json)
      } else {
        toast.error("Error al cargar estadísticas.")
      }
    } catch (err) {
      toast.error("Error al conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }

  // 1. Export Excel (CSV)
  const handleExportCSV = () => {
    if (!data) return

    const { metrics, chartsData } = data

    // Generate CSV content
    let csv = "KEY PERFORMANCE METRICS (KPIs)\n"
    csv += `Reservas Totales,${metrics.totalReservations}\n`
    csv += `Tasa de Ausencias (No-Show),${metrics.noShowRate}%\n`
    csv += `Clientes Totales,${metrics.totalCustomers}\n`
    csv += `Tasa de Retencion,${metrics.retentionRate}%\n`
    csv += `Ingresos Estimados,$${metrics.estimatedRevenue} COP\n`
    csv += `Depositos Cobrados,$${metrics.totalDeposits} COP\n`
    csv += `Ingresos Perdidos (No-Shows),$${metrics.lostRevenue} COP\n\n`

    csv += "RESERVAS POR DIA\nFecha,Total Reservas,No-Shows\n"
    chartsData.reservationsByDay.forEach(row => {
      csv += `${row.date},${row.total},${row.noShows}\n`
    })

    csv += "\nDISTRIBUCION POR CANAL\nCanal,Reservas,Porcentaje\n"
    chartsData.sourceDistribution.forEach(row => {
      csv += `${row.source},${row.count},${row.percentage}%\n`
    })

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `iagenda_reporte_${days}_dias.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Excel (CSV) exportado e iniciado la descarga.")
  }

  // 2. Print PDF
  const handlePrintPDF = () => {
    window.print()
  }

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-xs text-neutral-500 bg-neutral-900/10 border border-neutral-800 rounded-3xl">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
        Consolidando reportes históricos y analizando tendencias...
      </div>
    )
  }

  const { metrics, chartsData, insights } = data

  // Dynamic SVG Chart Coordinates calculations
  // A. Reservations Line Chart SVG Coordinates
  const lineChartWidth = 600
  const lineChartHeight = 160
  const maxReservationsVal = Math.max(...chartsData.reservationsByDay.map(d => d.total), 4)
  const linePoints = chartsData.reservationsByDay.map((d, index) => {
    const x = (index / (chartsData.reservationsByDay.length - 1)) * (lineChartWidth - 40) + 20
    const y = lineChartHeight - 20 - (d.total / maxReservationsVal) * (lineChartHeight - 40)
    return { x, y, date: d.date, total: d.total }
  })
  
  const pathD = linePoints.length > 0
    ? `M ${linePoints[0].x} ${linePoints[0].y} ` + linePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : ""

  const areaD = linePoints.length > 0
    ? `${pathD} L ${linePoints[linePoints.length - 1].x} ${lineChartHeight - 20} L ${linePoints[0].x} ${lineChartHeight - 20} Z`
    : ""

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      {/* Print-specific layout headers */}
      <style>{`
        @media print {
          aside, header, nav, button, select, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          .print-full {
            width: 100% !important;
            grid-template-cols: 1fr !important;
          }
        }
      `}</style>

      {/* Header Controls banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-500" />
            Tablero de Analytics
          </h1>
          <p className="text-neutral-400 text-sm">
            Audita el rendimiento del restaurante, ausencias y flujo de caja estimado.
          </p>
        </div>

        <div className="flex items-center gap-3.5 self-end sm:self-auto">
          {/* Timeframe Select */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white focus:outline-none focus:border-red-500"
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 3 meses</option>
          </select>

          {/* Export Actions Buttons */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-all shadow"
            title="Exportar a CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md transition-all"
            title="Imprimir reporte en PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Print PDF Cover Header */}
      <div className="hidden print:block space-y-2 pb-6 border-b border-neutral-200">
        <h1 className="text-3xl font-extrabold text-black">iAgenda - Reporte Ejecutivo de Ventas y Reservas</h1>
        <p className="text-sm text-neutral-500">
          Estadísticas operacionales consolidadas de los últimos {days} días. Generado el {new Date().toLocaleDateString()}.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-full">
        {/* Card 1: Total reservations */}
        <div className="p-4 rounded-3xl bg-neutral-900/40 border border-neutral-800/60 space-y-2 print:border-neutral-200 print:bg-neutral-50">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Reservas Realizadas</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-2xl font-bold text-white print:text-black">{metrics.totalReservations}</p>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              +{metrics.reservationGrowth}% vs prev
            </span>
          </div>
        </div>

        {/* Card 2: No-show rate */}
        <div className="p-4 rounded-3xl bg-neutral-900/40 border border-neutral-800/60 space-y-2 print:border-neutral-200 print:bg-neutral-50">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Tasa de No-Shows</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="space-y-0.5">
            <p className={`text-2xl font-bold ${metrics.noShowRate > 10 ? "text-red-400" : "text-emerald-400"} print:text-black`}>
              {metrics.noShowRate.toFixed(1)}%
            </p>
            <span className="text-[10px] text-neutral-500 font-medium">
              Promedio de ausencias del periodo
            </span>
          </div>
        </div>

        {/* Card 3: Clientes & retention */}
        <div className="p-4 rounded-3xl bg-neutral-900/40 border border-neutral-800/60 space-y-2 print:border-neutral-200 print:bg-neutral-50">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Clientes Únicos</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-2xl font-bold text-white print:text-black">{metrics.totalCustomers}</p>
            <span className="text-[10px] text-purple-400 font-semibold flex items-center gap-0.5">
              <Award className="w-3.5 h-3.5" />
              {metrics.retentionRate}% recurrencia
            </span>
          </div>
        </div>

        {/* Card 4: Estimated Revenue & Deposits */}
        <div className="p-4 rounded-3xl bg-neutral-900/40 border border-neutral-800/60 space-y-2 print:border-neutral-200 print:bg-neutral-50">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] uppercase font-bold tracking-wider">Ingreso Estimado</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-2xl font-bold text-emerald-400 print:text-black">
              ${metrics.estimatedRevenue.toLocaleString()} COP
            </p>
            <span className="text-[9px] text-neutral-500 truncate block">
              Depósitos cobrados: ${metrics.totalDeposits.toLocaleString()} COP
            </span>
          </div>
        </div>
      </div>

      {/* AI insights Banner */}
      <div className="p-4 rounded-3xl border border-neutral-800 bg-neutral-900/20 space-y-2.5 no-print">
        <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          Insights automatizados de iAgenda
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-neutral-950 border border-neutral-850 flex items-start gap-2.5 text-[11px] text-neutral-300 leading-relaxed shadow-sm"
            >
              {ins.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              ) : ins.type === "positive" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span>{ins.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graphical Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-full">
        {/* Chart 1: Daily Reservations (SVG Line Chart) */}
        <div className="p-5 border border-neutral-800 rounded-3xl bg-neutral-900/10 space-y-4 print:border-neutral-200 print:bg-neutral-50">
          <h3 className="font-bold text-sm text-white print:text-black">Tendencia de Reservas Diarias</h3>
          
          <div className="w-full flex justify-center items-center">
            {linePoints.length > 0 ? (
              <svg viewBox={`0 0 ${lineChartWidth} ${lineChartHeight}`} className="w-full max-h-[200px]">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal reference grid lines */}
                <line x1="20" y1="20" x2={lineChartWidth - 20} y2="20" stroke="#262626" strokeWidth="0.5" strokeDasharray="4" className="print:stroke-neutral-200" />
                <line x1="20" y1="80" x2={lineChartWidth - 20} y2="80" stroke="#262626" strokeWidth="0.5" strokeDasharray="4" className="print:stroke-neutral-200" />
                <line x1="20" y1="140" x2={lineChartWidth - 20} y2="140" stroke="#262626" strokeWidth="0.5" className="print:stroke-neutral-350" />

                {/* Shaded Area */}
                <path d={areaD} fill="url(#areaGradient)" />

                {/* Bold Path Line */}
                <path d={pathD} fill="none" stroke="#ef4444" strokeWidth="2.5" />

                {/* Vertices marker circles */}
                {linePoints.filter((_, idx) => idx % Math.round(linePoints.length / 8) === 0 || idx === linePoints.length - 1).map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                    <text x={pt.x} y={pt.y - 8} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" className="print:fill-black">
                      {pt.total}
                    </text>
                  </g>
                ))}
              </svg>
            ) : (
              <p className="text-xs text-neutral-600">Sin suficientes datos</p>
            )}
          </div>
        </div>

        {/* Chart 2: Hourly Occupancy (SVG Bar Chart) */}
        <div className="p-5 border border-neutral-800 rounded-3xl bg-neutral-900/10 space-y-4 print:border-neutral-200 print:bg-neutral-50">
          <h3 className="font-bold text-sm text-white print:text-black flex items-center justify-between">
            <span>Ocupación Promedio por Hora (Comensales sentados)</span>
            <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
          </h3>

          <div className="w-full flex justify-center items-center">
            <svg viewBox="0 0 500 160" className="w-full max-h-[200px]">
              {/* Reference Grid lines */}
              <line x1="20" y1="20" x2="480" y2="20" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3" /> {/* Capacity Limit */}
              <text x="480" y="16" textAnchor="end" fill="#ef4444" fontSize="8" fontWeight="bold">Límite capacidad</text>
              <line x1="20" y1="140" x2="480" y2="140" stroke="#262626" strokeWidth="0.5" className="print:stroke-neutral-350" />

              {/* Render Bars */}
              {chartsData.occupancyByHour.map((row, index) => {
                const barWidth = 24
                const gap = 16
                const startX = 35 + index * (barWidth + gap)
                
                // Height relative to max capacity (40 comensales)
                const barHeight = Math.max((row.occupancy / row.capacity) * 110, 4)
                const startY = 140 - barHeight

                return (
                  <g key={row.hour}>
                    <rect
                      x={startX}
                      y={startY}
                      width={barWidth}
                      height={barHeight}
                      rx={3}
                      fill={row.occupancy > 30 ? "#ef4444" : row.occupancy > 15 ? "#f59e0b" : "#10b981"}
                      fillOpacity={0.8}
                    />
                    {/* Val */}
                    <text x={startX + barWidth / 2} y={startY - 6} textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold" className="print:fill-black">
                      {Math.round(row.occupancy)}
                    </text>
                    {/* Label */}
                    <text x={startX + barWidth / 2} y={152} textAnchor="middle" fill="#737373" fontSize="8" className="print:fill-neutral-500">
                      {row.hour.split(":")[0]}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Chart 3: Distribution by Booking Channels (Tailwind Horizontal Progress Bars) */}
        <div className="p-5 border border-neutral-800 rounded-3xl bg-neutral-900/10 space-y-4 print:border-neutral-200 print:bg-neutral-50">
          <h3 className="font-bold text-sm text-white print:text-black">Canales de Origen de Reservas</h3>
          
          <div className="space-y-3.5">
            {chartsData.sourceDistribution.map((row) => {
              // Colors based on source
              let barColor = "bg-blue-500"
              if (row.source === "WHATSAPP") barColor = "bg-emerald-500"
              if (row.source === "VOICE") barColor = "bg-purple-500"
              if (row.source === "WALKIN") barColor = "bg-amber-500"

              return (
                <div key={row.source} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-neutral-400 print:text-neutral-700">
                    <span className="font-semibold tracking-wider text-[11px] print:text-black">{row.source}</span>
                    <span className="font-mono">{row.count} reservas ({row.percentage}%)</span>
                  </div>
                  
                  {/* Progress Container */}
                  <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-900 print:border-neutral-200 print:bg-neutral-100">
                    <div
                      className={`h-full ${barColor} rounded-full`}
                      style={{ width: `${row.percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chart 4: Group Sizes Distribution (SVG Bar Chart) */}
        <div className="p-5 border border-neutral-800 rounded-3xl bg-neutral-900/10 space-y-4 print:border-neutral-200 print:bg-neutral-50">
          <h3 className="font-bold text-sm text-white print:text-black">Distribución de Tamaño de Grupos (Comensales)</h3>

          <div className="w-full flex justify-center items-center">
            <svg viewBox="0 0 400 160" className="w-full max-h-[200px]">
              <line x1="20" y1="140" x2="380" y2="140" stroke="#262626" strokeWidth="0.5" className="print:stroke-neutral-350" />

              {/* Render Bars */}
              {chartsData.partySizeDistribution.map((row, index) => {
                const barWidth = 30
                const gap = 20
                const startX = 40 + index * (barWidth + gap)
                
                const maxCountVal = Math.max(...chartsData.partySizeDistribution.map(r => r.count), 1)
                const barHeight = (row.count / maxCountVal) * 110
                const startY = 140 - barHeight

                return (
                  <g key={row.size}>
                    <rect
                      x={startX}
                      y={startY}
                      width={barWidth}
                      height={barHeight}
                      rx={3.5}
                      fill="#ef4444"
                      fillOpacity={0.8}
                    />
                    <text x={startX + barWidth / 2} y={startY - 6} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" className="print:fill-black">
                      {row.count}
                    </text>
                    <text x={startX + barWidth / 2} y={152} textAnchor="middle" fill="#737373" fontSize="9" className="print:fill-neutral-500">
                      {row.size === 6 ? "6+ p" : `${row.size} p`}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
