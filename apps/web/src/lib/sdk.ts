/**
 * iAgenda SDK — Node.js / Browser
 *
 * Cliente oficial para interactuar con la API pública de iAgenda v1.
 * Compatible con Node.js 18+ y entornos de navegador modernos.
 *
 * @example
 * import { IAgendaClient } from "@/lib/sdk"
 *
 * const client = new IAgendaClient({
 *   apiKey: "res_live_...",
 *   baseUrl: "https://tu-dominio.com/api/v1",
 * })
 *
 * const slots = await client.availability.list({
 *   eventTypeId: 42,
 *   startTime: "2025-01-15T00:00:00Z",
 *   endTime: "2025-01-16T00:00:00Z",
 * })
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface IAgendaClientOptions {
  /** API Key de autenticación (formato: res_live_... o res_test_...) */
  apiKey: string
  /** URL base de la API. Por defecto: https://app.iagenda.co/api/v1 */
  baseUrl?: string
  /** Timeout en ms. Por defecto: 30000 */
  timeout?: number
  /** Número máximo de reintentos en errores 429/5xx. Por defecto: 3 */
  maxRetries?: number
}

export interface AvailabilityListParams {
  eventTypeId: number
  startTime: string
  endTime: string
  timezone?: string
}

export interface CreateBookingParams {
  eventTypeId: number
  startTime: string
  partySize: number
  customer: {
    name: string
    email: string
    phone?: string
  }
  specialRequests?: string
  timezone?: string
}

export interface UpdateBookingParams {
  startTime?: string
  partySize?: number
  specialRequests?: string
}

export interface Booking {
  id: string
  calcomUid: string
  status: "CONFIRMED" | "PENDING_PAYMENT" | "CANCELLED" | "CHECKED_IN" | "NO_SHOW"
  dateTime: string
  partySize: number
  duration: number
  specialRequests?: string
  source: string
  customer: {
    name: string
    email: string
    phone?: string
  }
  branch?: string
  restaurant?: string
  tableType?: string
  createdAt?: string
}

export interface ApiResponse<T> {
  status: "success"
  data: T
}

// ─── Errores ─────────────────────────────────────────────────────────────────

export class IAgendaError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = "IAgendaError"
  }
}

export class RateLimitError extends IAgendaError {
  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      429,
      "rate_limit_exceeded",
      retryAfter
    )
    this.name = "RateLimitError"
  }
}

export class AuthenticationError extends IAgendaError {
  constructor(message: string) {
    super(message, 401, "authentication_error")
    this.name = "AuthenticationError"
  }
}

export class NotFoundError extends IAgendaError {
  constructor(message: string) {
    super(message, 404, "not_found")
    this.name = "NotFoundError"
  }
}

// ─── Cliente HTTP interno ─────────────────────────────────────────────────────

class HttpClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly maxRetries: number

  constructor(options: Required<IAgendaClientOptions>) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl.replace(/\/$/, "")
    this.timeout = options.timeout
    this.maxRetries = options.maxRetries
  }

  async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    options: {
      query?: Record<string, string | number | boolean | undefined>
      body?: unknown
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        const res = await fetch(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "iAgenda-SDK/1.0 (Node.js)",
          },
          ...(options.body ? { body: JSON.stringify(options.body) } : {}),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Manejar rate limiting con retry automático
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10)

          if (attempt < this.maxRetries) {
            await sleep(retryAfter * 1000)
            continue
          }

          throw new RateLimitError(retryAfter)
        }

        // Parsear respuesta
        const contentType = res.headers.get("content-type") ?? ""
        const data = contentType.includes("application/json") ? await res.json() : null

        // Manejar errores HTTP
        if (!res.ok) {
          const message = data?.message ?? `HTTP ${res.status}`
          const code = data?.error ?? "unknown_error"

          if (res.status === 401) throw new AuthenticationError(message)
          if (res.status === 404) throw new NotFoundError(message)

          // Retry en errores 5xx
          if (res.status >= 500 && attempt < this.maxRetries) {
            const backoff = Math.pow(2, attempt) * 1000
            await sleep(backoff)
            continue
          }

          throw new IAgendaError(message, res.status, code)
        }

        // 204 No Content
        if (res.status === 204) return undefined as T

        return data as T
      } catch (err) {
        if (err instanceof IAgendaError) throw err

        // Error de red / timeout
        lastError = err instanceof Error ? err : new Error(String(err))

        if (attempt < this.maxRetries) {
          await sleep(Math.pow(2, attempt) * 500)
          continue
        }
      }
    }

    throw lastError ?? new Error("Unknown error")
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Sub-clientes de recursos ─────────────────────────────────────────────────

class AvailabilityClient {
  constructor(private readonly http: HttpClient) {}

  async list(
    params: AvailabilityListParams
  ): Promise<ApiResponse<Record<string, Array<{ time: string }>>>> {
    return this.http.request("GET", "/availability", {
      query: {
        eventTypeId: params.eventTypeId,
        startTime: params.startTime,
        endTime: params.endTime,
        timezone: params.timezone,
      },
    })
  }
}

class BookingsClient {
  constructor(private readonly http: HttpClient) {}

  async create(params: CreateBookingParams): Promise<ApiResponse<Booking>> {
    return this.http.request("POST", "/bookings", { body: params })
  }

  async get(id: string): Promise<ApiResponse<Booking>> {
    return this.http.request("GET", `/bookings/${encodeURIComponent(id)}`)
  }

  async update(id: string, params: UpdateBookingParams): Promise<ApiResponse<Booking>> {
    return this.http.request("PUT", `/bookings/${encodeURIComponent(id)}`, {
      body: params,
    })
  }

  async cancel(id: string, reason?: string): Promise<void> {
    await this.http.request("DELETE", `/bookings/${encodeURIComponent(id)}`, {
      body: reason ? { reason } : undefined,
    })
  }
}

// ─── Cliente principal ────────────────────────────────────────────────────────

export class IAgendaClient {
  public readonly availability: AvailabilityClient
  public readonly bookings: BookingsClient

  constructor(options: IAgendaClientOptions) {
    const opts: Required<IAgendaClientOptions> = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl ?? "https://app.iagenda.co/api/v1",
      timeout: options.timeout ?? 30_000,
      maxRetries: options.maxRetries ?? 3,
    }

    const http = new HttpClient(opts)
    this.availability = new AvailabilityClient(http)
    this.bookings = new BookingsClient(http)
  }
}

// Exportación por defecto para mayor comodidad
export default IAgendaClient
