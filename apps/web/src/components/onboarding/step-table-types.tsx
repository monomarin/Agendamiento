"use client"

import * as React from "react"
import { Grid, Plus, Trash2, ChevronLeft, HelpCircle } from "lucide-react"

import { useOnboardingStore, OnboardingTableType } from "@/lib/onboarding-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function StepTableTypes() {
  const { tableTypes, updateTableTypes, nextStep, prevStep } = useOnboardingStore()

  // Local state initialized from Zustand
  const [localTypes, setLocalTypes] = React.useState<OnboardingTableType[]>(tableTypes)

  // Form input states for new table type
  const [newName, setNewName] = React.useState("")
  const [newMin, setNewMin] = React.useState(2)
  const [newMax, setNewMax] = React.useState(4)
  const [newQty, setNewQty] = React.useState(5)

  const handleAddTableType = () => {
    if (!newName.trim()) return

    const newType: OnboardingTableType = {
      id: Math.random().toString(36).substring(2, 9), // Client temp ID
      name: newName.trim(),
      minCapacity: Number(newMin),
      maxCapacity: Number(newMax),
      quantity: Number(newQty),
    }

    setLocalTypes([...localTypes, newType])
    setNewName("")
    setNewMin(2)
    setNewMax(4)
    setNewQty(5)
  }

  const handleRemoveTableType = (idToRemove?: string, indexToRemove?: number) => {
    let updated: OnboardingTableType[] = []
    if (idToRemove) {
      updated = localTypes.filter((t) => t.id !== idToRemove)
    } else if (indexToRemove !== undefined) {
      updated = localTypes.filter((_, idx) => idx !== indexToRemove)
    }
    setLocalTypes(updated)
  }

  const handleNext = () => {
    updateTableTypes(localTypes)
    nextStep()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Grid className="w-5 h-5 text-red-500" />
          Configuración de Mesas
        </h2>
        <p className="text-neutral-400 text-sm">
          Define los tipos de mesa disponibles. Cada tipo se asociará a un calendario de disponibilidad (Cal.com).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form area */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="font-semibold text-white text-sm">Agregar Tipo de Mesa</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tableName">Nombre de la Categoría</Label>
                <Input
                  id="tableName"
                  placeholder="Ej. Terraza Central, Salón Ventana"
                  className="bg-neutral-950 border-neutral-800 text-white"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tableQty">Cantidad de Mesas</Label>
                <Input
                  id="tableQty"
                  type="number"
                  min="1"
                  className="bg-neutral-950 border-neutral-800 text-white"
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tableMin">Comensales Mínimos</Label>
                <Input
                  id="tableMin"
                  type="number"
                  min="1"
                  className="bg-neutral-950 border-neutral-800 text-white"
                  value={newMin}
                  onChange={(e) => setNewMin(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tableMax">Comensales Máximos</Label>
                <Input
                  id="tableMax"
                  type="number"
                  min="1"
                  className="bg-neutral-950 border-neutral-800 text-white"
                  value={newMax}
                  onChange={(e) => setNewMax(Number(e.target.value))}
                />
              </div>
            </div>

            <Button
              type="button"
              className="w-full bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 gap-1.5"
              onClick={handleAddTableType}
            >
              <Plus className="w-4 h-4" />
              Agregar Categoría
            </Button>
          </div>

          {/* List of configured tables */}
          <div className="space-y-3">
            <h4 className="font-semibold text-neutral-300 text-xs uppercase tracking-wider">
              Categorías Configuradas ({localTypes.length})
            </h4>

            {localTypes.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-sm">
                Aún no has agregado tipos de mesa. Agrega al menos uno para continuar.
              </div>
            ) : (
              <div className="space-y-2">
                {localTypes.map((type, index) => (
                  <div
                    key={type.id || index}
                    className="flex justify-between items-center p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition-colors"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-white">{type.name}</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Capacidad: {type.minCapacity} - {type.maxCapacity} personas · Cantidad: {type.quantity} mesas
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                      onClick={() => handleRemoveTableType(type.id, index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visualizer sidebar */}
        <div className="lg:col-span-5 flex flex-col bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-white text-sm">Visualizador de Distribución</h3>
          </div>

          <div className="flex-1 min-h-[220px] rounded-lg border border-neutral-800 bg-neutral-950 p-4 flex flex-wrap gap-4 items-center justify-center overflow-y-auto">
            {localTypes.length === 0 ? (
              <span className="text-neutral-600 text-xs text-center">
                Configura mesas para ver el diseño interactivo aquí.
              </span>
            ) : (
              localTypes.flatMap((type, typeIdx) =>
                Array.from({ length: Math.min(type.quantity, 6) }).map((_, seatIdx) => {
                  const isCircle = typeIdx % 2 === 0
                  return (
                    <div
                      key={`${typeIdx}-${seatIdx}`}
                      className="flex flex-col items-center justify-center p-2 rounded bg-neutral-900 border border-neutral-800 hover:scale-105 transition-transform"
                    >
                      <div
                        className={`w-10 h-10 border border-red-500/30 bg-red-950/20 text-white flex items-center justify-center text-[10px] font-bold ${
                          isCircle ? "rounded-full" : "rounded-md"
                        }`}
                      >
                        {type.maxCapacity}p
                      </div>
                      <span className="text-[9px] text-neutral-500 mt-1 truncate max-w-[60px]">
                        {type.name.split(" ")[0]}
                      </span>
                    </div>
                  )
                })
              )
            )}
          </div>
          <p className="text-[10px] text-neutral-500 leading-normal">
            * Se muestran hasta 6 mesas de muestra de cada categoría. Las mesas redondas y cuadradas optimizan el espacio en tu Floor Plan digital.
          </p>
        </div>
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
          disabled={localTypes.length === 0}
          onClick={handleNext}
        >
          Siguiente Paso
        </Button>
      </div>
    </div>
  )
}
