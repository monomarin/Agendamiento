import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi"
import { z } from "zod"
import {
  AvailabilityQuerySchema,
  CreateBookingSchema,
  UpdateBookingSchema,
  ErrorResponseSchema,
  BookingResponseSchema,
} from "@/lib/api-schemas"

/**
 * GET /api/docs
 *
 * Devuelve la especificación OpenAPI 3.0 de la API pública v1 generada dinámicamente desde Zod.
 * Protegido por Clerk: solo usuarios autenticados pueden acceder.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`

  const registry = new OpenAPIRegistry()

  // 1. Registrar esquemas reutilizables en componentes
  const ErrorSchema = registry.register("Error", ErrorResponseSchema)
  const BookingSchema = registry.register("Booking", BookingResponseSchema)
  const CreateBookingReq = registry.register("CreateBookingRequest", CreateBookingSchema)
  const UpdateBookingReq = registry.register("UpdateBookingRequest", UpdateBookingSchema)

  // 2. Registrar esquema de seguridad BearerAuth
  const bearerAuth = registry.registerComponent("securitySchemes", "BearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "API Key",
    description: "API Key con formato `res_live_<32 bytes hex>` o `res_test_<32 bytes hex>`",
  })

  // 3. Registrar endpoint GET /availability
  registry.registerPath({
    method: "get",
    path: "/availability",
    summary: "Obtener disponibilidad",
    description: "Retorna los slots disponibles para un tipo de evento en un rango de fechas.",
    tags: ["Disponibilidad"],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      query: AvailabilityQuerySchema,
    },
    responses: {
      200: {
        description: "Slots disponibles",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string().openapi({ example: "success" }),
              data: z.record(
                z.string(),
                z.array(
                  z.object({
                    time: z.string().datetime().openapi({ example: "2026-06-15T18:00:00Z" }),
                    attendees: z.number().openapi({ example: 4 }),
                  })
                )
              ),
            }),
          },
        },
      },
      400: {
        description: "Parámetros inválidos",
        content: { "application/json": { schema: ErrorSchema } },
      },
      401: { description: "No autenticado" },
      429: { description: "Rate limit excedido" },
    },
  })

  // 4. Registrar endpoint POST /bookings
  registry.registerPath({
    method: "post",
    path: "/bookings",
    summary: "Crear reserva",
    description: "Crea una nueva reserva vía API. Requiere scope `bookings:write`.",
    tags: ["Reservas"],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateBookingReq,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Reserva creada exitosamente",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string().openapi({ example: "success" }),
              data: BookingSchema,
            }),
          },
        },
      },
      400: { description: "Datos inválidos", content: { "application/json": { schema: ErrorSchema } } },
      401: { description: "No autenticado" },
      403: { description: "Scope insuficiente", content: { "application/json": { schema: ErrorSchema } } },
    },
  })

  // 5. Registrar endpoint GET /bookings/{id}
  registry.registerPath({
    method: "get",
    path: "/bookings/{id}",
    summary: "Obtener reserva",
    description: "Retorna los detalles de una reserva específica. Requiere scope `bookings:read`.",
    tags: ["Reservas"],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ id: z.string().uuid().openapi({ description: "ID de la reserva" }) }),
    },
    responses: {
      200: {
        description: "Detalle de la reserva",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string().openapi({ example: "success" }),
              data: BookingSchema,
            }),
          },
        },
      },
      401: { description: "No autenticado" },
      403: { description: "Acceso denegado o scope insuficiente", content: { "application/json": { schema: ErrorSchema } } },
      404: { description: "Reserva no encontrada", content: { "application/json": { schema: ErrorSchema } } },
    },
  })

  // 6. Registrar endpoint PUT /bookings/{id}
  registry.registerPath({
    method: "put",
    path: "/bookings/{id}",
    summary: "Actualizar reserva",
    description: "Actualiza los detalles de una reserva activa. Requiere scope `bookings:write`.",
    tags: ["Reservas"],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ id: z.string().uuid().openapi({ description: "ID de la reserva" }) }),
      body: {
        content: {
          "application/json": {
            schema: UpdateBookingReq,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Reserva actualizada",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string().openapi({ example: "success" }),
              data: BookingSchema,
            }),
          },
        },
      },
      400: { description: "Datos inválidos", content: { "application/json": { schema: ErrorSchema } } },
      401: { description: "No autenticado" },
      403: { description: "Acceso denegado o scope insuficiente", content: { "application/json": { schema: ErrorSchema } } },
      404: { description: "Reserva no encontrada", content: { "application/json": { schema: ErrorSchema } } },
      409: { description: "No se puede modificar una reserva cancelada o completada", content: { "application/json": { schema: ErrorSchema } } },
    },
  })

  // 7. Registrar endpoint DELETE /bookings/{id}
  registry.registerPath({
    method: "delete",
    path: "/bookings/{id}",
    summary: "Cancelar reserva",
    description: "Cancela una reserva activa en iAgenda y Cal.com. Requiere scope `bookings:write`.",
    tags: ["Reservas"],
    security: [{ [bearerAuth.name]: [] }],
    request: {
      params: z.object({ id: z.string().uuid().openapi({ description: "ID de la reserva" }) }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              reason: z.string().optional().openapi({ description: "Razón de la cancelación", example: "Cliente solicitó cambio" }),
            }),
          },
        },
      },
    },
    responses: {
      204: { description: "Reserva cancelada exitosamente" },
      401: { description: "No autenticado" },
      403: { description: "Acceso denegado o scope insuficiente", content: { "application/json": { schema: ErrorSchema } } },
      404: { description: "Reserva no encontrada", content: { "application/json": { schema: ErrorSchema } } },
      409: { description: "La reserva ya ha sido cancelada o completada", content: { "application/json": { schema: ErrorSchema } } },
    },
  })

  // Generar el documento OpenAPI v3
  const generator = new OpenApiGeneratorV3(registry.definitions)
  const openApiDoc = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "iAgenda API Pública",
      version: "1.0.0",
      description:
        "API pública de iAgenda para integrar disponibilidad y reservas con sistemas externos (POS, CRM, etc.). Sincronizado automáticamente mediante esquemas Zod.",
      contact: {
        name: "Soporte iAgenda",
        email: "soporte@iagenda.co",
      },
    },
    servers: [
      {
        url: `${baseUrl}/api/v1`,
        description: "Servidor de Producción / Desarrollo",
      },
    ],
  })

  return NextResponse.json(openApiDoc, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}
