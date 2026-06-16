"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ChevronLeft, Loader2, Store, Clock, Grid, CreditCard, Sparkles } from "lucide-react"

import { useOnboardingStore } from "@/lib/onboarding-store"
import { Button } from "@/components/ui/button"

const DAYS_OF_WEEK = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]

export function StepReview() {
  const router = useRouter()
  const store = useOnboardingStore()
  const prevStep = store.prevStep
  
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handlePublish = async () => {
    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantInfo: store.restaurantInfo,
          schedules: store.schedules,
          tableTypes: store.tableTypes,
          paymentSettings: store.paymentSettings,
          whatsappConfig: store.whatsappConfig,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Error al publicar la configuración.")
      }

      // Clear store upon successful publish
      store.reset()
      
      // Redirect to dashboard overview page
      router.push("/dashboard")
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || "Algo salió mal. Por favor, reintenta.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openSchedules = store.schedules.filter((s) => !s.isClosed)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-red-500" />
          Revisión y Publicación
        </h2>
        <p className="text-neutral-400 text-sm">
          Verifica todos los datos de tu establecimiento antes de publicar tu portal oficial de reservas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info Card */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2 text-red-500 font-semibold text-xs uppercase tracking-wider">
            <Store className="w-4 h-4" />
            <span>Datos Básicos</span>
          </div>
          <div className="space-y-2 text-sm text-neutral-300">
            <div>
              <span className="text-neutral-500 block text-xs">Nombre</span>
              <strong className="text-white">{store.restaurantInfo.name || "Sin nombre"}</strong>
            </div>
            <div>
              <span className="text-neutral-500 block text-xs">Slug URL</span>
              <span className="text-white font-mono text-xs">/r/{store.restaurantInfo.slug}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-neutral-500 block text-xs">Establecimiento</span>
                <span className="text-white capitalize">{store.restaurantInfo.type}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-xs">NIT</span>
                <span className="text-white">{store.restaurantInfo.nit || "N/A"}</span>
              </div>
            </div>
            <div>
              <span className="text-neutral-500 block text-xs">Dirección, Teléfono y Correo</span>
              <span className="text-white block">{store.restaurantInfo.address}</span>
              <span className="text-white block">{store.restaurantInfo.phone}</span>
              <span className="text-white block font-mono text-xs">{store.restaurantInfo.email}</span>
            </div>
            {store.restaurantInfo.description && (
              <div>
                <span className="text-neutral-500 block text-xs">Descripción</span>
                <p className="text-white text-xs italic">"{store.restaurantInfo.description}"</p>
              </div>
            )}
            <div>
              <span className="text-neutral-500 block text-xs">Personalización</span>
              <div className="flex gap-2 mt-1">
                <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: store.restaurantInfo.primaryColor }} />
                  <span className="font-mono text-[10px]">{store.restaurantInfo.primaryColor}</span>
                </div>
                <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: store.restaurantInfo.secondaryColor }} />
                  <span className="font-mono text-[10px]">{store.restaurantInfo.secondaryColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Schedules & Tables Card */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          {/* Schedules */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-500 font-semibold text-xs uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>Horarios ({openSchedules.length} días hábiles)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {store.schedules.map((s) => (
                <div
                  key={s.dayOfWeek}
                  className={`px-2 py-1 rounded text-[10px] border font-medium ${
                    s.isClosed
                      ? "bg-neutral-950/40 border-neutral-900 text-neutral-600"
                      : "bg-red-950/20 border-red-500/20 text-red-400"
                  }`}
                >
                  {DAYS_OF_WEEK[s.dayOfWeek]} {!s.isClosed && <span className="block text-[8px] mt-0.5">{s.openTime}-{s.closeTime}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Table Types */}
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-red-500 font-semibold text-xs uppercase tracking-wider">
              <Grid className="w-4 h-4" />
              <span>Tipos de Mesa ({store.tableTypes.length} categorías)</span>
            </div>
            <div className="space-y-1 text-xs text-neutral-300">
              {store.tableTypes.map((t, idx) => (
                <div key={idx} className="flex justify-between bg-neutral-950/40 px-2 py-1.5 rounded">
                  <span>{t.name}</span>
                  <span className="font-medium text-neutral-400">
                    {t.quantity} mesas ({t.minCapacity}-{t.maxCapacity}p)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payments Card */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2 text-red-500 font-semibold text-xs uppercase tracking-wider">
            <CreditCard className="w-4 h-4" />
            <span>Pasarelas y Políticas</span>
          </div>
          <div className="space-y-2 text-sm text-neutral-300">
            <div className="flex gap-2">
              <div
                className={`px-2 py-1 rounded text-xs border font-medium ${
                  store.paymentSettings.stripeEnabled
                    ? "bg-indigo-950/30 border-indigo-500/20 text-indigo-400"
                    : "bg-neutral-950 border-neutral-900 text-neutral-600"
                }`}
              >
                Stripe {store.paymentSettings.stripeEnabled ? "Activo" : "Inactivo"}
              </div>
              <div
                className={`px-2 py-1 rounded text-xs border font-medium ${
                  store.paymentSettings.wompiEnabled
                    ? "bg-cyan-950/30 border-cyan-500/20 text-cyan-400"
                    : "bg-neutral-950 border-neutral-900 text-neutral-600"
                }`}
              >
                Wompi {store.paymentSettings.wompiEnabled ? "Activo" : "Inactivo"}
              </div>
            </div>
            <div className="pt-1">
              <span className="text-neutral-500 block text-xs">Garantía por Reserva</span>
              <strong className="text-white">
                {store.paymentSettings.requireDeposit
                  ? `${store.paymentSettings.depositType === "FIXED" ? "$" : ""}${store.paymentSettings.depositAmount}${
                      store.paymentSettings.depositType === "PERCENTAGE" ? "%" : ""
                    } ${store.paymentSettings.currency}`
                  : "No requiere (Reserva Gratis)"}
              </strong>
            </div>
            {store.paymentSettings.requireDeposit && (
              <div>
                <span className="text-neutral-500 block text-xs">Política de Reembolso</span>
                <span className="text-white">Hasta {store.paymentSettings.cancellationPolicyDays} día(s) antes</span>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp AI Agent Card */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2 text-red-500 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Agente Virtual IA (WhatsApp)</span>
          </div>
          <div className="space-y-2 text-sm text-neutral-300">
            <div>
              <span className="text-neutral-500 block text-xs">Estado del Agente</span>
              <span
                className={`font-semibold text-xs ${
                  store.whatsappConfig.agentEnabled ? "text-green-500" : "text-neutral-500"
                }`}
              >
                {store.whatsappConfig.agentEnabled ? "Habilitado (Fase 3)" : "Deshabilitado"}
              </span>
            </div>
            {store.whatsappConfig.agentEnabled && (
              <>
                <div>
                  <span className="text-neutral-500 block text-xs">Número del Agente</span>
                  <span className="text-white font-mono text-xs">{store.whatsappConfig.whatsappNumber || "No asignado"}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-xs">Instrucción Principal</span>
                  <p className="text-white text-xs leading-relaxed truncate max-w-[280px]">
                    {store.whatsappConfig.customInstructions}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t border-neutral-900">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          className="border-neutral-800 text-neutral-300 hover:bg-neutral-900"
          onClick={prevStep}
        >
          <ChevronLeft className="w-4 h-4 mr-1.5" />
          Atrás
        </Button>
        <Button
          type="button"
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700 text-white px-8 font-semibold shadow-[0_0_20px_rgba(22,163,74,0.3)] gap-1.5"
          onClick={handlePublish}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publicando...
            </>
          ) : (
            "Confirmar y Publicar"
          )}
        </Button>
      </div>
    </div>
  )
}
