"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js"
import { User, Mail, Phone, ShieldCheck, ChevronLeft, ChevronRight, Loader2, CheckCircle } from "lucide-react"

import { useBookingStore } from "@/lib/booking-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

const customerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z
    .string()
    .email("Correo electrónico inválido")
    .transform((v) => v.toLowerCase()),
  phone: z.string().refine(
    (v) => {
      try {
        return isValidPhoneNumber(v, "CO")
      } catch {
        return false
      }
    },
    { message: "Número de teléfono inválido (incluye código de área)" }
  ),
  hasConsent: z.literal(true, {
    message: "Debes aceptar el tratamiento de datos personales",
  }),
})

type CustomerValues = z.infer<typeof customerSchema>

interface DatosPageProps {
  params: Promise<{ slug: string }>
}

export default function DatosPage({ params }: DatosPageProps) {
  const router = useRouter()
  const { slug } = React.use(params)
  const { customer, setCustomer, setStep } = useBookingStore()

  const [emailStatus, setEmailStatus] = React.useState<"idle" | "checking" | "existing" | "new">("idle")

  const form = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      hasConsent: customer?.hasConsent ? true : undefined,
    },
  })

  // onBlur email check
  const handleEmailBlur = async (email: string) => {
    if (!email || !z.string().email().safeParse(email).success) return
    setEmailStatus("checking")
    try {
      const res = await fetch(`/api/customers/verify-email?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        setEmailStatus(data.exists ? "existing" : "new")
      }
    } catch {
      setEmailStatus("idle")
    }
  }

  const onSubmit = (values: CustomerValues) => {
    setCustomer({
      name: values.name,
      email: values.email,
      phone: values.phone,
      hasConsent: values.hasConsent,
    })
    setStep(4)
    router.push(`/${slug}/reservar/pago`)
  }

  const handleBack = () => {
    setStep(2)
    router.push(`/${slug}/reservar/fecha`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <User className="w-5 h-5 text-[var(--primary)]" />
          Tus datos de contacto
        </h2>
        <p className="text-neutral-400 text-sm">
          No necesitas crear una cuenta. Solo necesitamos tu información para confirmar la reserva.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-neutral-300 text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                  Nombre completo
                </FormLabel>
                <FormControl>
                  <Input
                    id="customer-name"
                    placeholder="Tu nombre y apellido"
                    className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:border-[var(--primary)]/60"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-neutral-300 text-sm flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[var(--primary)]" />
                  Correo electrónico
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="tu@correo.com"
                      className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:border-[var(--primary)]/60 pr-10"
                      {...field}
                      onBlur={(e) => {
                        field.onBlur()
                        handleEmailBlur(e.target.value)
                      }}
                    />
                    {emailStatus === "checking" && (
                      <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-neutral-500 animate-spin" />
                    )}
                    {emailStatus === "existing" && (
                      <CheckCircle className="absolute right-3 top-2.5 w-4 h-4 text-emerald-500" />
                    )}
                    {emailStatus === "new" && (
                      <CheckCircle className="absolute right-3 top-2.5 w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                </FormControl>
                {emailStatus === "existing" && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                    <CheckCircle className="w-3 h-3" />
                    ¡Bienvenido de vuelta! Tu información ya está guardada.
                  </p>
                )}
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-neutral-300 text-sm flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[var(--primary)]" />
                  Teléfono celular
                </FormLabel>
                <FormControl>
                  <Input
                    id="customer-phone"
                    type="tel"
                    placeholder="+57 300 123 4567"
                    className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:border-[var(--primary)]/60"
                    {...field}
                  />
                </FormControl>
                <p className="text-[10px] text-neutral-600 mt-1">
                  Te enviaremos la confirmación por WhatsApp a este número.
                </p>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Habeas Data consent */}
          <FormField
            control={form.control}
            name="hasConsent"
            render={({ field }) => (
              <FormItem>
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Al continuar, autorizas el tratamiento de tus datos personales de acuerdo con la{" "}
                        <a href="/legal/privacidad" className="text-[var(--primary)] underline hover:opacity-80">
                          Política de Privacidad
                        </a>{" "}
                        y la Ley 1581 de 2012 (Habeas Data). Tus datos se usarán únicamente para gestionar tu reserva y enviarte notificaciones relacionadas.
                      </p>
                      <FormControl>
                        <label className="flex items-center gap-2.5 cursor-pointer group" id="consent-label">
                          <div
                            onClick={() => field.onChange(field.value ? undefined : true)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
                              field.value
                                ? "bg-emerald-600 border-emerald-600"
                                : "border-neutral-600 bg-neutral-800 group-hover:border-neutral-400"
                            }`}
                          >
                            {field.value && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs text-neutral-300 group-hover:text-white transition-colors">
                            Acepto el tratamiento de mis datos personales
                          </span>
                        </label>
                      </FormControl>
                    </div>
                  </div>
                </div>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t border-neutral-900">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="border-neutral-800 text-neutral-300 hover:bg-neutral-900 gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              Atrás
            </Button>
            <Button
              id="datos-continue"
              type="submit"
              className="px-8 gap-2 bg-[var(--primary)] hover:opacity-90 text-white font-semibold"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
