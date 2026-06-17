"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Check } from "lucide-react"

interface Step {
  id: number
  label: string
  path: string
}

interface StepIndicatorProps {
  steps: Step[]
  primaryColor: string
}

export function StepIndicator({ steps, primaryColor }: StepIndicatorProps) {
  const pathname = usePathname()

  // Determine current step index from the URL path
  const currentStepIdx = steps.findIndex((s) => pathname.endsWith(s.path))
  const activeIdx = currentStepIdx === -1 ? 0 : currentStepIdx

  return (
    <div className="flex items-center justify-between relative">
      {/* Background line */}
      <div className="absolute left-0 right-0 top-3.5 h-0.5 bg-neutral-800 z-0" />
      {/* Progress line (fills up to active step) */}
      <div
        className="absolute left-0 top-3.5 h-0.5 z-0 transition-all duration-500"
        style={{
          width: activeIdx === 0 ? "0%" : `${(activeIdx / (steps.length - 1)) * 100}%`,
          backgroundColor: primaryColor,
        }}
      />

      {steps.map((step, idx) => {
        const isCompleted = idx < activeIdx
        const isActive = idx === activeIdx

        return (
          <div key={step.id} className="flex flex-col items-center relative z-10">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-300"
              style={
                isActive
                  ? {
                      borderColor: primaryColor,
                      backgroundColor: primaryColor,
                      color: "#fff",
                      boxShadow: `0 0 12px ${primaryColor}50`,
                    }
                  : isCompleted
                  ? {
                      borderColor: primaryColor,
                      backgroundColor: primaryColor,
                      color: "#fff",
                      opacity: 0.7,
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.15)",
                      backgroundColor: "#0a0a0a",
                      color: "rgba(255,255,255,0.3)",
                    }
              }
            >
              {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
            </div>
            <span
              className="hidden sm:inline-block text-[9px] mt-1.5 tracking-wide transition-colors"
              style={{
                color: isActive
                  ? primaryColor
                  : isCompleted
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(255,255,255,0.2)",
              }}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
