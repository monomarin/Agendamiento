import { z } from "zod"
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"

extendZodWithOpenApi(z)

export const AvailabilityQuerySchema = z.object({
  eventTypeId: z.coerce.number().openapi({ description: "ID del tipo de evento en Cal.com", example: 1234 }),
  startTime: z.string().datetime().openapi({ description: "Fecha de inicio del rango (ISO 8601)", example: "2026-06-15T00:00:00Z" }),
  endTime: z.string().datetime().openapi({ description: "Fecha de fin del rango (ISO 8601)", example: "2026-06-16T00:00:00Z" }),
  timezone: z.string().optional().openapi({ description: "Zona horaria preferida", example: "America/Bogota" }),
})

export const CreateBookingSchema = z.object({
  eventTypeId: z.number().openapi({ description: "ID del tipo de evento en Cal.com", example: 1234 }),
  startTime: z.string().datetime().openapi({ description: "Hora de la reserva (ISO 8601)", example: "2026-06-15T18:00:00Z" }),
  partySize: z.number().min(1).max(50).openapi({ description: "Número de comensales", example: 4 }),
  customer: z.object({
    name: z.string().openapi({ description: "Nombre completo del cliente", example: "Juan Pérez" }),
    email: z.string().email().openapi({ description: "Correo electrónico del cliente", example: "juan@example.com" }),
    phone: z.string().optional().openapi({ description: "Teléfono celular (opcional)", example: "+573001234567" }),
  }),
  specialRequests: z.string().optional().openapi({ description: "Peticiones especiales", example: "Mesa cerca a la ventana" }),
  timezone: z.string().optional().openapi({ description: "Zona horaria del cliente", example: "America/Bogota" }),
})

export const UpdateBookingSchema = z.object({
  startTime: z.string().datetime().optional().openapi({ description: "Nueva hora de la reserva (ISO 8601)", example: "2026-06-15T19:00:00Z" }),
  partySize: z.number().min(1).max(50).optional().openapi({ description: "Nuevo número de comensales", example: 6 }),
  specialRequests: z.string().optional().openapi({ description: "Peticiones especiales actualizadas", example: "Mesa VIP" }),
})

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "validation_error" }),
  message: z.string().openapi({ example: "Name is required" }),
})

export const BookingResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: "d290f1ee-6c54-4b01-90e6-d701748f0851" }),
  calcomBookingId: z.string().nullable().openapi({ example: "123" }),
  calcomUid: z.string().nullable().openapi({ example: "abc" }),
  status: z.enum(["CONFIRMED", "PENDING_PAYMENT", "CANCELLED", "CHECKED_IN", "NO_SHOW"]).openapi({ example: "CONFIRMED" }),
  dateTime: z.string().datetime().openapi({ example: "2026-06-15T18:00:00Z" }),
  partySize: z.number().openapi({ example: 4 }),
  duration: z.number().openapi({ example: 90 }),
  specialRequests: z.string().nullable().openapi({ example: "Mesa cerca a la ventana" }),
  source: z.string().openapi({ example: "API" }),
  customer: z.object({
    name: z.string().openapi({ example: "Juan Pérez" }),
    email: z.string().openapi({ example: "juan@example.com" }),
    phone: z.string().nullable().openapi({ example: "+573001234567" }),
  }),
})
