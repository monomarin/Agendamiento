"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DayPicker } from "react-day-picker"
import { addDays, format, isBefore, startOfDay, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, Clock, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from "lucide-react"

import { useBookingStore } from "@/lib/booking-store"
import { Button } from "@/components/ui/button"

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface TimeSlot {
  time: string        // "HH:MM"
  available: boolean
  isLastTable: boolean
}

interface DayAvailability {
  date: string        // "YYYY-MM-DD"
  level: "available" | "partial" | "full" | "closed"
  slots: TimeSlot[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Fetcher
// ──────────────────────────────────────────────────────────────────────────────
async function fetchAvailability(
  branchId: string,
  date: string,
  partySize: number
): Promise<DayAvailability> {
  const res = await fetch(
    `/api/availability?branchId=${branchId}&date=${date}&partySize=${partySize}`
  )
  if (!res.ok) throw new Error("Error cargando disponibilidad")
  return res.json()
}

async function fetchMonthSummary(
  branchId: string,
  year: number,
  month: number,
  partySize: number
): Promise<Record<string, "available" | "partial" | "full" | "closed">> {
  const res = await fetch(
    `/api/availability/month?branchId=${branchId}&year=${year}&month=${month}&partySize=${partySize}`
  )
  if (!res.ok) return {}
  return res.json()
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
interface FechaPageProps {
  params: Promise<{ slug: string }>
}

export default function FechaPage({ params }: FechaPageProps) {
  const router = useRouter()
  const { slug } = React.use(params)
  const queryClient = useQueryClient()

  const {
    selectedBranchId,
    partySize,
    selectedDate,
    selectedTime,
    setSelectedDate,
    setSelectedTime,
    setStep,
  } = useBookingStore()

  const today = startOfDay(new Date())
  const maxDate = addDays(today, 60)

  const [displayMonth, setDisplayMonth] = React.useState<Date>(today)

  // Parse stored date
  const selectedDayObj = selectedDate ? new Date(selectedDate + "T12:00:00") : undefined

  // ── Month Summary (colour dots) ──
  const { data: monthSummary = {} } = useQuery({
    queryKey: [
      "month-summary",
      selectedBranchId,
      displayMonth.getFullYear(),
      displayMonth.getMonth(),
      partySize,
    ],
    queryFn: () =>
      fetchMonthSummary(
        selectedBranchId!,
        displayMonth.getFullYear(),
        displayMonth.getMonth() + 1,
        partySize
      ),
    enabled: !!selectedBranchId,
    staleTime: 2 * 60 * 1000,
  })

  // ── Day Slots ──
  const {
    data: dayData,
    isLoading: slotsLoading,
    error: slotsError,
  } = useQuery({
    queryKey: ["availability", selectedBranchId, selectedDate, partySize],
    queryFn: () =>
      fetchAvailability(selectedBranchId!, selectedDate!, partySize),
    enabled: !!selectedBranchId && !!selectedDate,
    staleTime: 60_000,
    refetchInterval: 30_000,
  })

  // Pre-fetch next 3 days
  React.useEffect(() => {
    if (!selectedDate || !selectedBranchId) return
    ;[1, 2, 3].forEach((offset) => {
      const nextDate = format(addDays(new Date(selectedDate + "T12:00:00"), offset), "yyyy-MM-dd")
      queryClient.prefetchQuery({
        queryKey: ["availability", selectedBranchId, nextDate, partySize],
        queryFn: () => fetchAvailability(selectedBranchId!, nextDate, partySize),
      })
    })
  }, [selectedDate, partySize, selectedBranchId, queryClient])

  // Suggestion: next available day when current is full
  const [suggestion, setSuggestion] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (dayData?.level === "full" && selectedDate) {
      // Try to find next available day (up to 7 days)
      const tryDays = async () => {
        for (let i = 1; i <= 7; i++) {
          const nextDate = format(addDays(new Date(selectedDate + "T12:00:00"), i), "yyyy-MM-dd")
          try {
            const data = await fetchAvailability(selectedBranchId!, nextDate, partySize)
            if (data.level !== "full" && data.level !== "closed") {
              const firstSlot = data.slots.find((s) => s.available)
              if (firstSlot) {
                setSuggestion(nextDate)
                break
              }
            }
          } catch {
            // continue
          }
        }
      }
      tryDays()
    } else {
      setSuggestion(null)
    }
  }, [dayData?.level, selectedDate, selectedBranchId, partySize])

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return
    const dateStr = format(day, "yyyy-MM-dd")
    setSelectedDate(dateStr)
    setSelectedTime(null)
    setSuggestion(null)
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return
    setSelectedTime(slot.time)
  }

  const handleContinue = () => {
    setStep(3)
    router.push(`/${slug}/reservar/datos`)
  }

  const handleBack = () => {
    setStep(1)
    router.push(`/${slug}/reservar/personas`)
  }

  // ── Dot style per day availability ──
  const getDotClass = (level: string) => {
    switch (level) {
      case "available": return "bg-emerald-500"
      case "partial":   return "bg-amber-400"
      case "full":      return "bg-red-500"
      default:          return "bg-neutral-700"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[var(--primary)]" />
          Elige fecha y hora
        </h2>
        <p className="text-neutral-400 text-sm">
          Selecciona el día y el horario que prefieras.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 overflow-hidden">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-[10px] text-neutral-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Disponible</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Pocas mesas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Lleno</span>
          </div>

          <style>{`
            .rdp-day_available::after,
            .rdp-day_partial::after,
            .rdp-day_full::after,
            .rdp-day_closed::after {
              content: '';
              display: block;
              width: 5px;
              height: 5px;
              border-radius: 50%;
              margin-top: 2px;
            }
            .rdp-day_available::after { background-color: #10b981; }
            .rdp-day_partial::after  { background-color: #fbbf24; }
            .rdp-day_full::after     { background-color: #ef4444; }
            .rdp-day_closed::after   { background-color: #404040; }
          `}</style>

          <DayPicker
            mode="single"
            selected={selectedDayObj}
            onSelect={handleDaySelect}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            locale={es}
            disabled={[
              { before: today },
              { after: maxDate },
            ]}
            modifiers={{
              available: Object.entries(monthSummary)
                .filter(([, l]) => l === "available")
                .map(([d]) => new Date(d + "T12:00:00")),
              partial: Object.entries(monthSummary)
                .filter(([, l]) => l === "partial")
                .map(([d]) => new Date(d + "T12:00:00")),
              full: Object.entries(monthSummary)
                .filter(([, l]) => l === "full")
                .map(([d]) => new Date(d + "T12:00:00")),
              closed: Object.entries(monthSummary)
                .filter(([, l]) => l === "closed")
                .map(([d]) => new Date(d + "T12:00:00")),
            }}
            modifiersClassNames={{
              available: "rdp-day_available",
              partial: "rdp-day_partial",
              full: "rdp-day_full",
              closed: "rdp-day_closed",
            }}
            classNames={{
              root: "w-full",
              months: "w-full",
              month: "w-full",
              caption: "flex justify-between items-center px-1 mb-3",
              caption_label: "font-semibold text-sm text-white capitalize",
              nav: "flex gap-1",
              button_previous: "w-7 h-7 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-neutral-300 hover:bg-neutral-700 transition-colors",
              button_next: "w-7 h-7 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-neutral-300 hover:bg-neutral-700 transition-colors",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "flex-1 text-[10px] text-neutral-500 font-medium text-center pb-2 uppercase",
              row: "flex w-full mt-1",
              cell: "flex-1 relative",
              day: "w-full aspect-square rounded-xl text-xs font-medium transition-all duration-150 flex flex-col items-center justify-center gap-0.5 relative hover:bg-neutral-800",
              day_selected: "bg-[var(--primary)] text-white shadow-[0_0_15px_var(--primary)/30]",
              day_disabled: "text-neutral-700 cursor-not-allowed",
              day_today: "text-[var(--primary)] font-bold border border-[var(--primary)]/30",
              day_outside: "opacity-0 pointer-events-none",
            }}
          />

          {/* Quick buttons */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-800">
            {["Hoy", "Mañana", "Fin de semana"].map((label) => {
              const getDate = () => {
                if (label === "Hoy") return today
                if (label === "Mañana") return addDays(today, 1)
                // Next Saturday
                const day = today.getDay()
                const diff = day <= 6 ? 6 - day : 0
                return addDays(today, diff || 7)
              }
              const d = getDate()
              const isDisabled = isBefore(d, today) || isBefore(maxDate, d)
              return (
                <button
                  key={label}
                  disabled={isDisabled}
                  onClick={() => handleDaySelect(d)}
                  className="flex-1 py-1.5 text-[11px] font-medium rounded-lg border border-neutral-700 bg-neutral-800/60 text-neutral-300 hover:border-[var(--primary)]/40 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time slots */}
        <div className="space-y-4">
          {!selectedDate ? (
            <div className="h-full min-h-[200px] flex items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-neutral-600 text-sm">
              Selecciona un día para ver los horarios disponibles
            </div>
          ) : slotsLoading ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/30">
              <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
              <span className="text-neutral-500 text-sm">Cargando disponibilidad...</span>
            </div>
          ) : slotsError ? (
            <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Error al cargar horarios. Intenta de nuevo.
            </div>
          ) : dayData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[var(--primary)]" />
                  Horarios disponibles
                </h3>
                <span className="text-[10px] text-neutral-500 capitalize">
                  {format(new Date(selectedDate + "T12:00:00"), "EEEE d MMMM", { locale: es })}
                </span>
              </div>

              {/* Suggestion banner */}
              {dayData.level === "full" && suggestion && (
                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs space-y-2">
                  <p>No hay mesas disponibles para este día. ¿Qué tal este otro día?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDaySelect(new Date(suggestion + "T12:00:00"))}
                      className="px-3 py-1.5 bg-amber-500 text-neutral-950 rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors"
                    >
                      Ver {format(new Date(suggestion + "T12:00:00"), "EEEE d", { locale: es })}
                    </button>
                  </div>
                </div>
              )}

              {dayData.level === "closed" ? (
                <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/30 text-center text-neutral-500 text-sm">
                  Este día el restaurante está cerrado.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {dayData.slots.map((slot) => (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => handleSlotSelect(slot)}
                      aria-label={`${slot.time} ${slot.available ? (slot.isLastTable ? "última mesa disponible" : "disponible") : "no disponible"}${selectedTime === slot.time ? " seleccionado" : ""}`}
                      className={`relative py-3 rounded-xl text-sm font-semibold border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 focus:ring-offset-neutral-950 ${
                        !slot.available
                          ? "border-neutral-800 bg-neutral-900/20 text-neutral-700 cursor-not-allowed line-through"
                          : selectedTime === slot.time
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_0_15px_var(--primary)/30]"
                          : slot.isLastTable
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-500/70"
                          : "border-neutral-700 bg-neutral-900/40 text-neutral-200 hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5"
                      }`}
                    >
                      {slot.time}
                      {slot.isLastTable && slot.available && (
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-amber-500 text-neutral-950 text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          Última mesa
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-neutral-900">
        <Button
          variant="outline"
          onClick={handleBack}
          className="border-neutral-800 text-neutral-300 hover:bg-neutral-900 gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Atrás
        </Button>
        <Button
          id="fecha-continue"
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
          className="px-8 gap-2 bg-[var(--primary)] hover:opacity-90 text-white font-semibold disabled:opacity-40"
        >
          Continuar
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
