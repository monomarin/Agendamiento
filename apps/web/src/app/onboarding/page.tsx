"use client"

import * as React from "react"
import { UserButton, useUser } from "@clerk/nextjs"
import { Check, Sparkles } from "lucide-react"

import { useOnboardingStore } from "@/lib/onboarding-store"
import { StepBasicInfo } from "@/components/onboarding/step-basic-info"
import { StepSchedules } from "@/components/onboarding/step-schedules"
import { StepTableTypes } from "@/components/onboarding/step-table-types"
import { StepPayments } from "@/components/onboarding/step-payments"
import { StepReview } from "@/components/onboarding/step-review"

const STEPS = [
  { id: 1, label: "Información" },
  { id: 2, label: "Horarios" },
  { id: 3, label: "Mesas" },
  { id: 4, label: "Pagos" },
  { id: 5, label: "Publicar" },
]

export default function OnboardingPage() {
  const { user } = useUser()
  const { currentStep, reset } = useOnboardingStore()

  // Prevent hydration mismatches
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Detect ?new=true to reset onboarding state for creating a new restaurant
  React.useEffect(() => {
    if (mounted) {
      const searchParams = new URLSearchParams(window.location.search)
      if (searchParams.get("new") === "true") {
        reset()
        // Clean URL parameter
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, "", cleanUrl)
      }
    }
  }, [mounted, reset])

  // Auto-Save Effect: Runs every 30 seconds when mounted
  React.useEffect(() => {
    if (!mounted) return

    const autoSave = async () => {
      const state = useOnboardingStore.getState()
      // Don't autosave if the name and slug are empty (initial unconfigured state)
      if (!state.restaurantInfo.name && !state.restaurantInfo.slug) return

      try {
        await fetch("/api/onboarding/autosave", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurantInfo: state.restaurantInfo,
            schedules: state.schedules,
            tableTypes: state.tableTypes,
            paymentSettings: state.paymentSettings,
            currentStep: state.currentStep,
          }),
        })
      } catch (err) {
        console.error("[Autosave Client Error]:", err)
      }
    }

    const interval = setInterval(autoSave, 30000)
    return () => clearInterval(interval)
  }, [mounted])

  if (!mounted) return null

  const renderActiveStep = () => {
    switch (currentStep) {
      case 1:
        return <StepBasicInfo />
      case 2:
        return <StepSchedules />
      case 3:
        return <StepTableTypes />
      case 4:
        return <StepPayments />
      case 5:
        return <StepReview />
      default:
        return <StepBasicInfo />
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col antialiased">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(220,38,38,0.4)]">
            i
          </div>
          <span className="font-semibold text-lg tracking-tight">
            iAgenda <span className="text-red-500 font-light text-sm">by iAgentes</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-block text-xs text-neutral-400">
            {user ? `Estás registrado como: ${user.firstName || user.emailAddresses?.[0]?.emailAddress}` : "Registrándose..."}
          </span>
          <UserButton />
        </div>
      </header>

      {/* Main wizard wrapper */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center">
        <div className="w-full bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden">
          {/* Top subtle decoration */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 to-amber-500" />
          <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

          {/* Progress stepper */}
          <div className="mb-8 md:mb-10">
            <div className="flex items-center justify-between relative">
              {/* Stepper background line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-neutral-800 z-0" />
              
              {/* Stepper active progress line */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-red-600 transition-all duration-300 z-0"
                style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
              />

              {STEPS.map((step) => {
                const isCompleted = currentStep > step.id
                const isActive = currentStep === step.id

                return (
                  <div key={step.id} className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                        isCompleted
                          ? "bg-red-600 border-red-500 text-white"
                          : isActive
                          ? "bg-neutral-950 border-red-600 text-red-500 ring-4 ring-red-600/10 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                          : "bg-neutral-950 border-neutral-800 text-neutral-500"
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                    </div>
                    <span
                      className={`hidden sm:inline-block text-[10px] mt-2 font-medium tracking-wide transition-colors duration-300 ${
                        isActive ? "text-red-500 font-semibold" : isCompleted ? "text-neutral-300" : "text-neutral-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Active step content */}
          <div className="relative z-10">
            {renderActiveStep()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-neutral-900 bg-neutral-950 text-center text-xs text-neutral-600">
        iAgenda by iAgentes · Impulsando la eficiencia en reservas gastronómicas
      </footer>
    </div>
  )
}
