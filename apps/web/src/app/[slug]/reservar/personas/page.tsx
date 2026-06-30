"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DayPicker } from "react-day-picker"
import { addDays, format, isBefore, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { Users, CalendarDays, Clock, Minus, Plus, MessageSquare, Loader2, AlertCircle } from "lucide-react"

import { useBookingStore } from "@/lib/booking-store"
import { Button } from "@/components/ui/button"
import { getBusinessTypeConfig } from "@/lib/business-types"

// ──────────────────────────────────────────────────────────────────────────────
// Types & Suggestions
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

// EVENT_TYPES and SPECIAL_CHIPS are now dynamically derived from the restaurant type via getBusinessTypeConfig

// ──────────────────────────────────────────────────────────────────────────────
// Fetchers
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
// Unified Booking Screen Component
// ──────────────────────────────────────────────────────────────────────────────
interface PersonasPageProps {
  params: Promise<{ slug: string }>
}

export default function PersonasPage({ params }: PersonasPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { slug } = React.use(params)
  const queryClient = useQueryClient()

  const {
    partySize,
    eventType,
    specialRequests,
    selectedBranchId,
    selectedDate,
    selectedTime,
    setPartySize,
    setEventType,
    setSpecialRequests,
    setSelectedBranchId,
    setSelectedDate,
    setSelectedTime,
    setStep,
  } = useBookingStore()

  // 1. Fetch branches on mount to auto-select if missing
  const [branches, setBranches] = React.useState<any[]>([])
  const [restaurantType, setRestaurantType] = React.useState<string | null>(null)
  React.useEffect(() => {
    const branchIdParam = searchParams.get("branchId")
    if (branchIdParam) {
      setSelectedBranchId(branchIdParam)
    }

    fetch(`/api/restaurants/${slug}/branches`)
      .then((r) => r.json())
      .then((data) => {
        if (data.branches && data.branches.length > 0) {
          setBranches(data.branches)
          if (!selectedBranchId && !branchIdParam) {
            setSelectedBranchId(data.branches[0].id)
          }
        }
        if (data.restaurantType) {
          setRestaurantType(data.restaurantType)
        }
      })
      .catch((err) => console.error("[Loading branches error]:", err))
  }, [slug, selectedBranchId, setSelectedBranchId, searchParams])

  // Derive contextual config from business type
  const typeConfig = getBusinessTypeConfig(restaurantType)

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
  })

  // Suggestion: next available day when current is full
  const [suggestion, setSuggestion] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (dayData?.level === "full" && selectedDate) {
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

  // Form input states
  const [showMoreInput, setShowMoreInput] = React.useState(partySize > 15)
  const [customAllergyInput, setCustomAllergyInput] = React.useState(false)
  const [allergyText, setAllergyText] = React.useState("")

  const handlePartySizeClick = (size: number) => {
    if (size <= 15) {
      setPartySize(size)
      setShowMoreInput(false)
      setSelectedTime(null) // Reset time selection on size change
    }
  }

  const handleMoreClick = () => {
    setShowMoreInput(true)
    if (partySize <= 15) {
      setPartySize(16)
    }
    setSelectedTime(null)
  }

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

  const addChip = (chip: string) => {
    if (chip === "Alergias") {
      setCustomAllergyInput(true)
      return
    }
    const current = specialRequests.trim()
    const newText = current ? `${current}, ${chip}` : chip
    setSpecialRequests(newText.slice(0, 500))
  }

  const handleAllergySubmit = () => {
    if (!allergyText.trim()) return
    const current = specialRequests.trim()
    const allergyStr = `Alergias: ${allergyText.trim()}`
    const newText = current ? `${current}, ${allergyStr}` : allergyStr
    setSpecialRequests(newText.slice(0, 500))
    setCustomAllergyInput(false)
    setAllergyText("")
  }

  // Active branch phone for WhatsApp fallback
  const activeBranch = branches.find((b) => b.id === selectedBranchId)
  const activePhone = activeBranch?.phone || ""
  const whatsappUrl = activePhone
    ? `https://wa.me/${activePhone.replace(/[^0-9]/g, "")}?text=Hola,%20quisiera%20reservar%20una%20mesa%20para%20${partySize}%20personas.`
    : "#"

  return (
    <div className="space-y-6">
      {/* 3-Column Grid for cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* CARD 1: Comensales & Ocasión */}
        <div className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-5 backdrop-blur-xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--primary)]" />
          
          <div className="space-y-1">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--primary)]" />
              1. ¿Cuántas {typeConfig.partySizeLabel.toLowerCase()}?
            </h2>
            <p className="text-neutral-500 text-[11px]">{typeConfig.partySizeSublabel}</p>
          </div>

          {/* Party size circles */}
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }, (_, i) => i + 1).map((size) => (
              <button
                key={size}
                onClick={() => handlePartySizeClick(size)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border focus:outline-none focus:ring-1 focus:ring-[var(--primary)] ${
                  partySize === size && !showMoreInput
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_0_12px_var(--primary)/30]"
                    : "border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700"
                }`}
              >
                {size}
              </button>
            ))}
            <button
              onClick={handleMoreClick}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border focus:outline-none focus:ring-1 focus:ring-[var(--primary)] ${
                showMoreInput
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_0_12px_var(--primary)/30]"
                  : "border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700"
              }`}
            >
              +
            </button>
          </div>

          {/* More than 15 count editor */}
          {showMoreInput && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-400">Total comensales:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPartySize(Math.max(16, partySize - 1))}
                  className="w-7 h-7 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-white hover:bg-neutral-700"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-bold text-xs text-white">{partySize}</span>
                <button
                  onClick={() => setPartySize(partySize + 1)}
                  className="w-7 h-7 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-white hover:bg-neutral-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp redirect when size > 15 */}
          {partySize > 15 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-2">
              <p>Para reservas de más de 15 personas, contáctanos directamente por WhatsApp.</p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] rounded-lg font-bold transition-colors"
              >
                Reservar por WhatsApp
              </a>
            </div>
          )}

          {/* Occasion Section */}
          <div className="border-t border-neutral-900 pt-3 space-y-2">
            <h3 className="text-xs font-semibold text-neutral-300">Tipo de ocasión</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {typeConfig.eventTypes.map((event) => (
                <button
                  key={event.label}
                  onClick={() => setEventType(event.label)}
                  className={`py-1.5 px-2 rounded-lg border text-center transition-all text-[10px] ${
                    eventType === event.label
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-white"
                      : "border-neutral-850 bg-neutral-950/20 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                  }`}
                >
                  <span className="truncate block font-medium">{event.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Special Requests section */}
          <div className="border-t border-neutral-900 pt-3 space-y-2">
            <h3 className="text-xs font-semibold text-neutral-300 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
              Notas opcionales
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {typeConfig.specialChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => addChip(chip)}
                  className="px-2.5 py-1 rounded-full text-[9px] border border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-neutral-700 hover:text-white"
                >
                  + {chip}
                </button>
              ))}
            </div>

            {customAllergyInput && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Especifica alergias..."
                  value={allergyText}
                  onChange={(e) => setAllergyText(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none"
                />
                <Button size="sm" onClick={handleAllergySubmit} className="bg-[var(--primary)] hover:opacity-90 text-xs">
                  Añadir
                </Button>
              </div>
            )}

            <textarea
              placeholder={typeConfig.specialRequestsPlaceholder}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value.slice(0, 500))}
              rows={2}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-650 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* CARD 2: Calendario de Fecha */}
        <div className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-5 backdrop-blur-xl space-y-4 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--primary)]" />
          
          <div className="space-y-1">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
              2. Selecciona la fecha
            </h2>
            <p className="text-neutral-500 text-[11px]">Escoge el día de tu reserva.</p>
          </div>

          {/* Dots Legend */}
          <div className="flex items-center gap-3 text-[9px] text-neutral-500 select-none pb-1">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Disponible</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Pocas mesas</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Lleno</span>
          </div>

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
            classNames={{ root: "rdp-root w-full" }}
          />

          {/* Quick Date buttons */}
          <div className="flex gap-1.5 pt-3 border-t border-neutral-900">
            {["Hoy", "Mañana", "Fin de semana"].map((label) => {
              const getDate = () => {
                if (label === "Hoy") return today
                if (label === "Mañana") return addDays(today, 1)
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
                  className="flex-1 py-1.5 text-[9px] font-bold rounded-lg border border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-[var(--primary)]/40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* CARD 3: Selector de Horarios */}
        <div className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-5 backdrop-blur-xl space-y-4 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--primary)]" />
          
          <div className="space-y-1">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--primary)]" />
              3. Elige la hora
            </h2>
            <p className="text-neutral-500 text-[11px]">Horarios disponibles para la fecha.</p>
          </div>

          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-neutral-800 rounded-xl text-neutral-600 text-[11px] gap-2">
              <Clock className="w-6 h-6 text-neutral-700" />
              <span>Selecciona un día en el calendario</span>
            </div>
          ) : slotsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[11px] text-neutral-500 gap-2">
              <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
              <span>Buscando mesas libres...</span>
            </div>
          ) : slotsError ? (
            <div className="p-3.5 rounded-xl border border-red-950/20 bg-red-950/10 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Error de red. Intenta de nuevo.</span>
            </div>
          ) : dayData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Turnos libres</span>
                <span className="text-[10px] text-neutral-500 capitalize font-medium">
                  {format(new Date(selectedDate + "T12:00:00"), "EEEE d MMMM", { locale: es })}
                </span>
              </div>

              {/* Closed notice */}
              {dayData.level === "closed" ? (
                <div className="p-4 border border-neutral-850 bg-neutral-950/30 text-center text-neutral-500 text-xs rounded-xl">
                  Establecimiento cerrado este día.
                </div>
              ) : dayData.slots.length === 0 ? (
                <div className="p-4 border border-neutral-850 bg-neutral-950/30 text-center text-neutral-500 text-xs rounded-xl">
                  No hay mesas disponibles para {partySize} personas.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[220px] pr-1">
                  {dayData.slots.map((slot) => (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => handleSlotSelect(slot)}
                      className={`relative py-2.5 rounded-lg text-xs font-bold border transition-all duration-200 focus:outline-none ${
                        !slot.available
                          ? "border-neutral-900/50 bg-neutral-950/20 text-neutral-700 cursor-not-allowed line-through"
                          : selectedTime === slot.time
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_0_10px_var(--primary)/30]"
                          : slot.isLastTable
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-500/60"
                          : "border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-600 hover:text-white"
                      }`}
                    >
                      {slot.time}
                      {slot.isLastTable && slot.available && (
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-amber-500 text-neutral-950 text-[7px] font-black px-1 rounded-full whitespace-nowrap uppercase">
                          1 mesa
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestions when day is full */}
              {dayData.level === "full" && suggestion && (
                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-[10px] space-y-2">
                  <p>Lleno hoy. Te sugerimos buscar el siguiente día disponible:</p>
                  <button
                    onClick={() => handleDaySelect(new Date(suggestion + "T12:00:00"))}
                    className="px-2.5 py-1 bg-amber-500 text-neutral-950 rounded font-bold hover:bg-amber-400 transition-colors"
                  >
                    Ver {format(new Date(suggestion + "T12:00:00"), "EEEE d", { locale: es })}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
