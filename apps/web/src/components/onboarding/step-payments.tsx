"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CreditCard, DollarSign, Key, Info, ChevronLeft } from "lucide-react"

import { useOnboardingStore } from "@/lib/onboarding-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

const paymentSchema = z.object({
  stripeEnabled: z.boolean(),
  stripePublishableKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
  wompiEnabled: z.boolean(),
  wompiPublicKey: z.string().optional(),
  wompiPrivateKey: z.string().optional(),
  requireDeposit: z.boolean(),
  depositAmount: z.number().min(0, "El monto no puede ser negativo"),
  depositType: z.enum(["FIXED", "PERCENTAGE"]),
  currency: z.string(),
  cancellationPolicyDays: z.number().min(0, "Días inválidos"),
})

type PaymentValues = z.infer<typeof paymentSchema>

export function StepPayments() {
  const { paymentSettings, updatePaymentSettings, nextStep, prevStep } = useOnboardingStore()

  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      stripeEnabled: paymentSettings.stripeEnabled,
      stripePublishableKey: paymentSettings.stripePublishableKey || "",
      stripeSecretKey: paymentSettings.stripeSecretKey || "",
      wompiEnabled: paymentSettings.wompiEnabled,
      wompiPublicKey: paymentSettings.wompiPublicKey || "",
      wompiPrivateKey: paymentSettings.wompiPrivateKey || "",
      requireDeposit: paymentSettings.requireDeposit,
      depositAmount: paymentSettings.depositAmount,
      depositType: paymentSettings.depositType,
      currency: paymentSettings.currency,
      cancellationPolicyDays: paymentSettings.cancellationPolicyDays,
    },
  })

  const stripeWatch = form.watch("stripeEnabled")
  const wompiWatch = form.watch("wompiEnabled")
  const requireDepositWatch = form.watch("requireDeposit")

  const onSubmit = (values: PaymentValues) => {
    updatePaymentSettings(values)
    nextStep()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-red-500" />
            Métodos de Pago y Depósitos
          </h2>
          <p className="text-neutral-400 text-sm">
            Configura las pasarelas para cobrar depósitos de garantía por reserva o déjalo inactivo para reservas gratuitas.
          </p>
        </div>

        {/* Deposit Policy Toggle */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel className="text-base text-white">Garantía de Reserva Requerida</FormLabel>
              <FormDescription className="text-xs text-neutral-400">
                Los clientes deberán realizar un pago previo para confirmar su reserva.
              </FormDescription>
            </div>
            <FormField
              control={form.control}
              name="requireDeposit"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {requireDepositWatch && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-neutral-900">
              {/* Deposit Type */}
              <FormField
                control={form.control}
                name="depositType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Cargo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                          <SelectValue placeholder="Selecciona tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                        <SelectItem value="FIXED">Valor Fijo</SelectItem>
                        <SelectItem value="PERCENTAGE">Porcentaje %</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Deposit Amount */}
              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto de Garantía</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          className="bg-neutral-950 border-neutral-800 text-white pl-9"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                        <DollarSign className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-500" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                          <SelectValue placeholder="Moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                        <SelectItem value="COP">COP ($)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cancellation Policy */}
              <FormField
                control={form.control}
                name="cancellationPolicyDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plazo Cancelación (Días)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        className="bg-neutral-950 border-neutral-800 text-white text-center"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* Gateways */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stripe Config */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm text-white">
                  S
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Pasarela Stripe</h3>
                  <p className="text-xs text-neutral-400">Internacional y tarjetas crédito/débito</p>
                </div>
              </div>
              <FormField
                control={form.control}
                name="stripeEnabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {stripeWatch && (
              <div className="space-y-3 pt-2 border-t border-neutral-900">
                <FormField
                  control={form.control}
                  name="stripePublishableKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clave Pública de Stripe (Publishable Key)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input placeholder="pk_test_..." className="bg-neutral-950 border-neutral-800 text-white pl-9 font-mono text-xs" {...field} />
                          <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stripeSecretKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clave Secreta de Stripe (Secret Key)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="password" placeholder="sk_test_..." className="bg-neutral-950 border-neutral-800 text-white pl-9 font-mono text-xs" {...field} />
                          <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          {/* Wompi Config */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center font-bold text-sm text-white">
                  W
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Pasarela Wompi</h3>
                  <p className="text-xs text-neutral-400">Colombia (PSE, Nequi, Bancolombia)</p>
                </div>
              </div>
              <FormField
                control={form.control}
                name="wompiEnabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {wompiWatch && (
              <div className="space-y-3 pt-2 border-t border-neutral-900">
                <FormField
                  control={form.control}
                  name="wompiPublicKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clave Pública Wompi (Public Key)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input placeholder="pub_test_..." className="bg-neutral-950 border-neutral-800 text-white pl-9 font-mono text-xs" {...field} />
                          <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wompiPrivateKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clave Privada Wompi (Private Key)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="password" placeholder="prv_test_..." className="bg-neutral-950 border-neutral-800 text-white pl-9 font-mono text-xs" {...field} />
                          <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {requireDepositWatch && !stripeWatch && !wompiWatch && (
          <div className="flex gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              <strong>Nota:</strong> Has activado el requerimiento de depósito, pero no has habilitado ni configurado ninguna pasarela. Activa Stripe o Wompi para poder procesar cobros.
            </span>
          </div>
        )}

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
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white px-6"
          >
            Siguiente Paso
          </Button>
        </div>
      </form>
    </Form>
  )
}
