"use client"

import * as React from "react"
import { Clock, Plus, Trash2, ChevronLeft, Copy, Check } from "lucide-react"

import { useOnboardingStore, OnboardingSchedule } from "@/lib/onboarding-store"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

interface Shift {
  id: string
  openTime: string
  closeTime: string
}

interface DaySchedule {
  dayOfWeek: number
  isClosed: boolean
  shifts: Shift[]
}

export function StepSchedules() {
  const { schedules, updateSchedules, nextStep, prevStep } = useOnboardingStore()

  // Initialize local DaySchedule state from flattened Zustand schedules
  const [daySchedules, setDaySchedules] = React.useState<DaySchedule[]>(() => {
    const initialDays: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isClosed: true,
      shifts: [{ id: "1", openTime: "12:00", closeTime: "22:00" }],
    }))

    schedules.forEach((s) => {
      const day = initialDays.find((d) => d.dayOfWeek === s.dayOfWeek)
      if (day) {
        if (!s.isClosed) {
          if (day.isClosed) {
            day.isClosed = false
            day.shifts = []
          }
          day.shifts.push({
            id: Math.random().toString(36).substring(2, 9),
            openTime: s.openTime,
            closeTime: s.closeTime,
          })
        } else {
          day.isClosed = true
        }
      }
    })

    return initialDays
  })

  const [errors, setErrors] = React.useState<string[]>([])

  const handleToggleClosed = (dayIdx: number, checked: boolean) => {
    setDaySchedules((prev) => {
      const copy = [...prev]
      copy[dayIdx] = {
        ...copy[dayIdx],
        isClosed: !checked,
        // Ensure at least one shift if opening
        shifts: copy[dayIdx].shifts.length === 0 
          ? [{ id: Math.random().toString(36).substring(2, 9), openTime: "12:00", closeTime: "22:00" }]
          : copy[dayIdx].shifts,
      }
      return copy
    })
  }

  const handleTimeChange = (dayIdx: number, shiftId: string, field: "openTime" | "closeTime", value: string) => {
    setDaySchedules((prev) => {
      const copy = [...prev]
      copy[dayIdx] = {
        ...copy[dayIdx],
        shifts: copy[dayIdx].shifts.map((s) => (s.id === shiftId ? { ...s, [field]: value } : s)),
      }
      return copy
    })
  }

  const handleAddShift = (dayIdx: number) => {
    setDaySchedules((prev) => {
      const copy = [...prev]
      const currentShifts = copy[dayIdx].shifts
      // Base next shift open time on the last shift's close time or a default
      const lastClose = currentShifts[currentShifts.length - 1]?.closeTime || "17:00"
      const newOpen = lastClose
      const newClose = "22:00"

      copy[dayIdx] = {
        ...copy[dayIdx],
        shifts: [
          ...currentShifts,
          { id: Math.random().toString(36).substring(2, 9), openTime: newOpen, closeTime: newClose },
        ],
      }
      return copy
    })
  }

  const handleRemoveShift = (dayIdx: number, shiftId: string) => {
    setDaySchedules((prev) => {
      const copy = [...prev]
      copy[dayIdx] = {
        ...copy[dayIdx],
        shifts: copy[dayIdx].shifts.filter((s) => s.id !== shiftId),
      }
      // If no shifts left, close the day
      if (copy[dayIdx].shifts.length === 0) {
        copy[dayIdx].isClosed = true
        copy[dayIdx].shifts = [{ id: Math.random().toString(36).substring(2, 9), openTime: "12:00", closeTime: "22:00" }]
      }
      return copy
    })
  }

  const handleCopyFrom = (targetDayIdx: number, sourceDayValue: string) => {
    const sourceDayIdx = parseInt(sourceDayValue, 10)
    if (isNaN(sourceDayIdx)) return

    setDaySchedules((prev) => {
      const copy = [...prev]
      const sourceDay = copy.find((d) => d.dayOfWeek === sourceDayIdx)
      if (sourceDay) {
        copy[targetDayIdx] = {
          ...copy[targetDayIdx],
          isClosed: sourceDay.isClosed,
          shifts: sourceDay.shifts.map((s) => ({
            ...s,
            id: Math.random().toString(36).substring(2, 9),
          })),
        }
      }
      return copy
    })
  }

  const handleApplyToAllWeekdays = () => {
    // Monday is index 1
    const mondaySchedule = daySchedules.find((d) => d.dayOfWeek === 1)
    if (!mondaySchedule) return

    setDaySchedules((prev) => {
      return prev.map((day) => {
        // Weekdays: 1 (Mon), 2 (Tue), 3 (Wed), 4 (Thu), 5 (Fri)
        if (day.dayOfWeek >= 1 && day.dayOfWeek <= 5) {
          return {
            ...day,
            isClosed: mondaySchedule.isClosed,
            shifts: mondaySchedule.shifts.map((s) => ({
              ...s,
              id: Math.random().toString(36).substring(2, 9),
            })),
          }
        }
        return day
      })
    })
  }

  const validateSchedules = (): boolean => {
    const newErrors: string[] = []
    
    daySchedules.forEach((day) => {
      if (day.isClosed) return
      
      day.shifts.forEach((shift, idx) => {
        const [openH, openM] = shift.openTime.split(":").map(Number)
        const [closeH, closeM] = shift.closeTime.split(":").map(Number)
        const openMin = openH * 60 + openM
        const closeMin = closeH * 60 + closeM
        
        if (closeMin <= openMin) {
          newErrors.push(
            `En el ${DAYS_OF_WEEK[day.dayOfWeek]}, la hora de cierre (${shift.closeTime}) debe ser posterior a la de apertura (${shift.openTime}).`
          )
        }

        // Check for overlaps with other shifts on the same day
        day.shifts.forEach((otherShift, otherIdx) => {
          if (idx === otherIdx) return
          const [oOpenH, oOpenM] = otherShift.openTime.split(":").map(Number)
          const [oCloseH, oCloseM] = otherShift.closeTime.split(":").map(Number)
          const oOpenMin = oOpenH * 60 + oOpenM
          const oCloseMin = oCloseH * 60 + oCloseM

          if (openMin < oCloseMin && closeMin > oOpenMin) {
            newErrors.push(
              `En el ${DAYS_OF_WEEK[day.dayOfWeek]}, existen turnos que se superponen entre sí.`
            )
          }
        })
      })
    })

    // Deduplicate errors
    const uniqueErrors = Array.from(new Set(newErrors))
    setErrors(uniqueErrors)
    return uniqueErrors.length === 0
  }

  const handleNextStep = () => {
    if (!validateSchedules()) return

    // Flatten back to Zustand store format
    const flatSchedules: OnboardingSchedule[] = []
    daySchedules.forEach((day) => {
      if (day.isClosed) {
        flatSchedules.push({
          dayOfWeek: day.dayOfWeek,
          openTime: "12:00",
          closeTime: "22:00",
          isClosed: true,
        })
      } else {
        day.shifts.forEach((shift) => {
          flatSchedules.push({
            dayOfWeek: day.dayOfWeek,
            openTime: shift.openTime,
            closeTime: shift.closeTime,
            isClosed: false,
          })
        })
      }
    })

    updateSchedules(flatSchedules)
    nextStep()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-red-500" />
          Horarios de Atención
        </h2>
        <p className="text-neutral-400 text-sm">
          Define los turnos y horas hábiles de tu restaurante. Soporta múltiples turnos por día.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs space-y-1">
          {errors.map((err, i) => (
            <div key={i}>• {err}</div>
          ))}
        </div>
      )}

      <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
        {daySchedules.map((day, dayIdx) => {
          const dayName = DAYS_OF_WEEK[day.dayOfWeek]
          const isOpen = !day.isClosed

          // Filter copyable days (only days that are open and not the current day)
          const copyableDays = daySchedules.filter((d) => !d.isClosed && d.dayOfWeek !== day.dayOfWeek)

          return (
            <div
              key={day.dayOfWeek}
              className={`flex flex-col p-4 rounded-lg border transition-colors space-y-3 ${
                isOpen ? "bg-neutral-900/40 border-neutral-800" : "bg-neutral-950/20 border-neutral-900/60 opacity-60"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-[150px]">
                  <Switch
                    checked={isOpen}
                    onCheckedChange={(checked) => handleToggleClosed(dayIdx, checked)}
                  />
                  <span className={`font-semibold text-sm ${isOpen ? "text-white" : "text-neutral-500"}`}>
                    {dayName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* MondayWeekdayShortcut */}
                  {day.dayOfWeek === 1 && isOpen && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-md"
                      onClick={handleApplyToAllWeekdays}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Aplicar a Lun-Vie
                    </Button>
                  )}

                  {isOpen && copyableDays.length > 0 && (
                    <Select onValueChange={(val) => handleCopyFrom(dayIdx, val as string)}>
                      <SelectTrigger className="h-8 w-36 bg-neutral-950 border-neutral-800 text-[11px] text-neutral-400">
                        <SelectValue placeholder="Copiar horario de..." />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white text-xs">
                        {copyableDays.map((d) => (
                          <SelectItem key={d.dayOfWeek} value={d.dayOfWeek.toString()}>
                            {DAYS_OF_WEEK[d.dayOfWeek]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {isOpen ? (
                <div className="space-y-2.5 pt-2 border-t border-neutral-900/40">
                  {day.shifts.map((shift, shiftIdx) => (
                    <div key={shift.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 sm:flex-none">
                        <span className="text-[10px] text-neutral-500 w-12 sm:w-auto">Turno {shiftIdx + 1}:</span>
                        <Input
                          type="time"
                          className="w-24 bg-neutral-950 border-neutral-800 text-white text-center text-xs h-8"
                          value={shift.openTime}
                          onChange={(e) => handleTimeChange(dayIdx, shift.id, "openTime", e.target.value)}
                        />
                        <span className="text-xs text-neutral-500">—</span>
                        <Input
                          type="time"
                          className="w-24 bg-neutral-950 border-neutral-800 text-white text-center text-xs h-8"
                          value={shift.closeTime}
                          onChange={(e) => handleTimeChange(dayIdx, shift.id, "closeTime", e.target.value)}
                        />
                      </div>

                      {day.shifts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-md shrink-0"
                          onClick={() => handleRemoveShift(dayIdx, shift.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[11px] text-neutral-400 hover:text-white hover:bg-neutral-900"
                      onClick={() => handleAddShift(dayIdx)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar Turno
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-neutral-500 font-medium italic block py-1">
                  Cerrado todo el día
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t border-neutral-900">
        <Button
          type="button"
          variant="outline"
          className="border-neutral-800 text-neutral-300 hover:bg-neutral-900"
          onClick={prevStep}
        >
          <ChevronLeft className="w-4 h-4 mr-1.5" />
          Atrás
        </Button>
        <Button
          type="button"
          className="bg-red-600 hover:bg-red-700 text-white px-6"
          onClick={handleNextStep}
        >
          Siguiente Paso
        </Button>
      </div>
    </div>
  )
}
