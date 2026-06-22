"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Store, Globe, Tag, MapPin, Phone, Palette, Mail, FileText } from "lucide-react"
import { parsePhoneNumberFromString } from "libphonenumber-js"

import { useOnboardingStore } from "@/lib/onboarding-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"

const basicInfoSchema = z.object({
  name: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  slug: z.string()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  nit: z.string().refine((val) => {
    const cleanNit = val.replace(/\./g, "").trim()
    const colRegex = /^\d{9}-\d$/
    return colRegex.test(cleanNit) || cleanNit.length >= 5
  }, "Formato de NIT inválido. Usa el formato colombiano (ej. 900123456-7) o identificación internacional."),
  type: z.string().min(1, "Selecciona el tipo de establecimiento"),
  address: z.string().min(5, "Ingresa una dirección válida"),
  phone: z.string().refine((val) => {
    try {
      const phoneNumber = parsePhoneNumberFromString(val)
      return phoneNumber ? phoneNumber.isValid() : false
    } catch {
      return false
    }
  }, "Teléfono inválido (debe incluir el código de país, ej: +57 300 123 4567)"),
  email: z.string().email("Correo electrónico inválido"),
  description: z.string().max(250, "La descripción no puede superar los 250 caracteres"),
  logoUrl: z.string().url("URL del logo inválida").or(z.literal("")).optional(),
  bannerUrl: z.string().url("URL de la imagen de fondo inválida").or(z.literal("")).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Formato hex inválido"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Formato hex inválido"),
  timezone: z.string(),
})

type BasicInfoValues = z.infer<typeof basicInfoSchema>

export function StepBasicInfo() {
  const { restaurantInfo, updateRestaurantInfo, nextStep } = useOnboardingStore()
  const [mounted, setMounted] = React.useState(false)
  const autocompleteRef = React.useRef<HTMLInputElement>(null)

  const form = useForm<BasicInfoValues>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: restaurantInfo.name,
      slug: restaurantInfo.slug,
      nit: restaurantInfo.nit || "",
      type: restaurantInfo.type,
      address: restaurantInfo.address,
      phone: restaurantInfo.phone,
      email: restaurantInfo.email || "",
      description: restaurantInfo.description || "",
      logoUrl: restaurantInfo.logoUrl || "",
      bannerUrl: restaurantInfo.bannerUrl || "",
      primaryColor: restaurantInfo.primaryColor,
      secondaryColor: restaurantInfo.secondaryColor,
      timezone: restaurantInfo.timezone,
    },
  })

  // Watch values
  const nameValue = form.watch("name")
  const descValue = form.watch("description") || ""

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-generate slug from name if not manually modified
  React.useEffect(() => {
    if (nameValue && !form.formState.dirtyFields.slug) {
      const generatedSlug = nameValue
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s-]/g, "")    // Remove special characters
        .trim()
        .replace(/\s+/g, "-")            // Spaces to hyphens
        .replace(/-+/g, "-")             // Double hyphens to single
      form.setValue("slug", generatedSlug, { shouldValidate: true })
    }
  }, [nameValue, form])

  // Google Places Autocomplete Script Loader & Setup
  React.useEffect(() => {
    if (!mounted) return

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
    if (!apiKey || apiKey === "placeholder") return

    const setupAutocomplete = () => {
      const gWindow = window as any
      if (!autocompleteRef.current || !gWindow.google) return
      const autocomplete = new gWindow.google.maps.places.Autocomplete(autocompleteRef.current, {
        types: ["address"],
        fields: ["formatted_address", "geometry", "address_components"],
      })

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (place.geometry && place.geometry.location) {
          const address = place.formatted_address || autocompleteRef.current?.value || ""
          form.setValue("address", address, { shouldValidate: true })

          let city = ""
          if (place.address_components) {
            for (const component of place.address_components) {
              if (component.types.includes("locality")) {
                city = component.long_name
                break
              }
            }
          }
          
          if (city) {
            updateRestaurantInfo({ city })
          }
        }
      })
    }

    const gWindow = window as any
    if (gWindow.google) {
      setupAutocomplete()
    } else {
      const existingScript = document.getElementById("google-maps-script")
      if (!existingScript) {
        const script = document.createElement("script")
        script.id = "google-maps-script"
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
        script.async = true
        script.defer = true
        script.onload = () => setupAutocomplete()
        document.head.appendChild(script)
      }
    }
  }, [mounted, form, updateRestaurantInfo])

  // onBlur check for slug
  const handleSlugBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    if (!val || val.length < 2) return
    
    try {
      const res = await fetch(`/api/restaurants/check-slug?slug=${encodeURIComponent(val)}`)
      if (res.ok) {
        const data = await res.json()
        if (!data.available && val !== restaurantInfo.slug) {
          form.setError("slug", { type: "manual", message: "Este enlace de reservas (slug) ya está en uso" })
        } else {
          form.clearErrors("slug")
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  // onBlur check for email
  const handleEmailBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    if (!val) return
    
    try {
      const res = await fetch(`/api/restaurants/check-email?email=${encodeURIComponent(val)}`)
      if (res.ok) {
        const data = await res.json()
        if (!data.available && val !== restaurantInfo.email) {
          form.setError("email", { type: "manual", message: "Este correo electrónico ya está registrado" })
        } else {
          form.clearErrors("email")
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const onSubmit = (values: BasicInfoValues) => {
    updateRestaurantInfo(values)
    nextStep()
  }

  if (!mounted) return null

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-red-500" />
            Información del Restaurante
          </h2>
          <p className="text-neutral-400 text-sm">
            Ingresa los detalles principales y configura los colores de marca de tu portal público.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Restaurante</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input placeholder="Ej. La Cabrera" className="bg-neutral-900 border-neutral-800 text-white pl-9" {...field} />
                    <Store className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-500" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Slug */}
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enlace de Reservas (Slug)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      placeholder="ej-la-cabrera" 
                      className="bg-neutral-900 border-neutral-800 text-white pl-9" 
                      {...field} 
                      onBlur={(e) => {
                        field.onBlur()
                        handleSlugBlur(e)
                      }}
                    />
                    <Globe className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-500" />
                  </div>
                </FormControl>
                <FormDescription className="text-xs text-neutral-500">
                  Tu página pública será: iagenda.vercel.app/r/{field.value || "slug"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* NIT */}
          <FormField
            control={form.control}
            name="nit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIT / RUT (Identificación Fiscal)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input placeholder="Ej. 900123456-7" className="bg-neutral-900 border-neutral-800 text-white pl-9" {...field} />
                    <Tag className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-500" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Establecimiento</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                    <SelectItem value="restaurante">Restaurante</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="cafe">Café</SelectItem>
                    <SelectItem value="fast_food">Fast Food</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Address */}
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección Física (Sede Principal)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      placeholder="Calle 85 # 11-53, Bogotá" 
                      className="bg-neutral-900 border-neutral-800 text-white pl-9" 
                      {...field}
                      ref={(e) => {
                        field.ref(e);
                        autocompleteRef.current = e;
                      }}
                    />
                    <MapPin className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-500" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono de Contacto (con indicativo)</FormLabel>
                <FormControl>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-sm" title="Colombia">🇨🇴</span>
                    <Input placeholder="Ej. +57 300 123 4567" className="bg-neutral-900 border-neutral-800 text-white pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo Electrónico de Contacto</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      placeholder="contacto@restaurante.com" 
                      className="bg-neutral-900 border-neutral-800 text-white pl-9" 
                      {...field} 
                      onBlur={(e) => {
                        field.onBlur()
                        handleEmailBlur(e)
                      }}
                    />
                    <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-500" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex justify-between items-center">
                  <span>Descripción del Establecimiento</span>
                  <span className="text-[10px] text-neutral-500">{250 - descValue.length} caracteres restantes</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Textarea 
                      placeholder="Breve descripción para tus clientes..." 
                      className="bg-neutral-900 border-neutral-800 text-white min-h-[44px] max-h-[120px] pl-9" 
                      {...field} 
                    />
                    <FileText className="absolute left-3 top-3 h-4.5 w-4.5 text-neutral-500" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Branding Colors */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-white">Personalización del Portal</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="primaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between items-center">
                    <span>Color Primario (Botones y Enlaces)</span>
                    <span className="text-xs font-mono text-neutral-400">{field.value}</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-3 items-center">
                      <Input type="color" className="w-12 h-10 p-1 bg-transparent border-neutral-800 rounded-lg cursor-pointer" {...field} />
                      <Input placeholder="#dc2626" className="bg-neutral-900 border-neutral-800 text-white font-mono" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secondaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between items-center">
                    <span>Color Secundario (Fondos y Menús)</span>
                    <span className="text-xs font-mono text-neutral-400">{field.value}</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-3 items-center">
                      <Input type="color" className="w-12 h-10 p-1 bg-transparent border-neutral-800 rounded-lg cursor-pointer" {...field} />
                      <Input placeholder="#171717" className="bg-neutral-900 border-neutral-800 text-white font-mono" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL del Logo (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://ejemplo.com/logo.png" className="bg-neutral-900 border-neutral-800 text-white" {...field} />
                  </FormControl>
                  <FormDescription className="text-[10px] text-neutral-500">
                    Imagen cuadrada del logo de tu marca.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bannerUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de Imagen de Fondo (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://ejemplo.com/banner.jpg" className="bg-neutral-900 border-neutral-800 text-white" {...field} />
                  </FormControl>
                  <FormDescription className="text-[10px] text-neutral-500">
                    Imagen del restaurante para el fondo desvanecido.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-4">
          <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6">
            Siguiente Paso
          </Button>
        </div>
      </form>
    </Form>
  )
}
