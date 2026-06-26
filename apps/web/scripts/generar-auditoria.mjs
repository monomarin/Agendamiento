import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber, Footer, Header, PageBreak } from "docx"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import PDFDocument from "pdfkit"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(__dirname, "..")
const DOCX_PATH = path.join(OUTPUT_DIR, "Auditoria_iAgenda.docx")
const PDF_PATH = path.join(OUTPUT_DIR, "Auditoria_iAgenda.pdf")

const COLORS = {
  primary: "1a1a2e",
  secondary: "dc2626",
  accent: "0f766e",
  bgLight: "f8fafc",
  bgDark: "1e293b",
  textDark: "1e293b",
  textLight: "64748b",
  white: "ffffff",
  critical: "dc2626",
  high: "ea580c",
  medium: "ca8a04",
  suggestion: "6366f1",
  good: "16a34a",
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const FINDINGS = {
  critical: [
    {
      id: 1,
      title: "ignoreBuildErrors: true en next.config.ts",
      file: "next.config.ts:5",
      effort: "Medio",
      desc: "La configuración de Next.js tiene typescript.ignoreBuildErrors: true, desactivando el type-checking en build.",
      why: [
        "Cualquier error de tipo (undefined no manejado, null checks, tipos incorrectos) pasa desapercibido hasta runtime en producción.",
        "En un SaaS multi-tenant que maneja pagos, reservas y datos personales (Ley 1581), un error silencioso puede significar 500s para clientes pagos o reservas perdidas.",
        "Integraciones críticas (Stripe, Wompi, WhatsApp) dependen de tipos correctos para funcionar.",
      ],
      plan: [
        "Cambiar ignoreBuildErrors a false",
        "Ejecutar npx tsc --noEmit para inventariar errores",
        "Corregir errores: primero any types, luego null-checks, luego tipos incorrectos",
        "Integrar tsc --noEmit en CI/CD",
      ],
    },
    {
      id: 2,
      title: "Salt fijo y fallback público en cifrado AES-256-GCM",
      file: "encryption.ts:10-12",
      effort: "Bajo-Medio",
      desc: "PBKDF2 usa salt fijo hardcodeado y la clave por defecto es pública en el código fuente.",
      why: [
        "Salt fijo produce la misma clave derivada siempre. Dos textos iguales producen ciphertexts idénticos, rompiendo AES-GCM.",
        "Clave pública: cualquiera con acceso al código puede descifrar WhatsAppAgent.accessToken, stripeSecretKey y wompiPrivateKey almacenados en BD.",
        "10,000 iteraciones PBKDF2 está muy por debajo del estándar actual (OWASP recomienda 600,000+).",
      ],
      plan: [
        "Hacer ENCRYPTION_KEY obligatoria en producción con lanzamiento de error si falta",
        "Eliminar salt fijo: usar IV aleatorio de 12 bytes (AES-GCM ya lo provee)",
        "Aumentar iteraciones PBKDF2 a 600,000+ o migrar a crypto.scryptSync",
        "Rotar (re-cifrar) todos los datos cifrados actualmente con la clave vieja",
      ],
    },
    {
      id: 3,
      title: "API Keys hasheadas con SHA-256 sin salt",
      file: "api-key.ts:16",
      effort: "Medio",
      desc: "Las API keys se almacenan como SHA-256(rawKey) directo, sin salt aleatorio.",
      why: [
        "SHA-256 sin salt es vulnerable a rainbow tables. Un atacante con acceso a la BD puede precomputar hashes.",
        "Las API keys otorgan acceso completo a: crear/ver/cancelar reservas y datos de clientes.",
        "No hay rate limiting en intentos de autenticación, permitiendo fuerza bruta offline.",
      ],
      plan: [
        "Migrar a crypto.scryptSync(rawKey, salt, 32) con salt aleatorio de 16 bytes",
        "Almacenar en formato salt:hash dentro de keyHash",
        "Implementar backward compatibility para keys existentes (detectar formato antiguo y migrar en caliente)",
        "Agregar rate limiting (5 intentos/segundo/IP) en authenticateApiKey",
      ],
    },
    {
      id: 4,
      title: "Exposición de error.message en respuestas HTTP",
      file: "api/bookings/route.ts:220",
      effort: "Bajo",
      desc: "Los catch handlers devuelven error.message directamente al cliente HTTP en múltiples endpoints.",
      why: [
        "Filtra información interna: stack traces, rutas de servidor, configuraciones, versiones de librerías.",
        "En el contexto colombiano, Ley 1581 y CONPES 3995 recomiendan no exponer información técnica en errores.",
        "Se repite en webhooks, API v1 y dashboard. Es un vector de reconocimiento para atacantes.",
      ],
      plan: [
        "Crear helper createErrorResponse: en producción devuelve mensaje genérico, en desarrollo el original",
        "Reemplazar todos los catch blocks que exponen error.message en el proyecto",
        "Loggear errores reales con console.error estructurado o Sentry",
      ],
    },
    {
      id: 5,
      title: "Uso generalizado de tipo any",
      file: "Múltiples archivos",
      effort: "Alto",
      desc: "Uso extensivo de any en booking route, WhatsApp webhook, dashboard layout, audit y email.",
      why: [
        "Cada any es una desactivación manual del sistema de tipos. El compilador no puede detectar errores.",
        "body: any en booking route acepta payloads malformados sin advertencia.",
        "Record<string, any> en dashboard/layout.tsx para iconos: nombre mal escrito rompe UI sin error.",
        "restaurant: any en WhatsApp webhook obliga a accesos encadenados frágiles sin protección.",
      ],
      plan: [
        "Tipar body con Zod safeParse (los esquemas ya existen en api-schemas.ts)",
        "Reemplazar Record<string, any> con Record<string, LucideIcon>",
        "Tipar restaurant, messages, args con tipos generados por Prisma",
        "Agregar regla ESLint @typescript-eslint/no-explicit-any: error",
      ],
    },
    {
      id: 6,
      title: "Sin tests automatizados",
      file: "Todo el proyecto",
      effort: "Alto",
      desc: "No existe ningún test (unitario, integración, e2e) en todo el proyecto.",
      why: [
        "No hay red de seguridad para refactors. Funciones complejas como parseLocalDateInTimezone, authenticateApiKey y processWithOpenAI no tienen verificación.",
        "El flujo POST /api/bookings es una saga distribuida con 4 sistemas (Redis, Cal.com, PostgreSQL, Stripe) que necesita tests de integración.",
        "Sin tests no se puede implementar CI/CD con confianza. Cada deploy es riesgoso.",
      ],
      plan: [
        "Configurar Vitest con mocks de Prisma, Redis y fetch (msw)",
        "Escribir tests unitarios: encrypt/decrypt, hashApiKey, signPayload, sanitizePayloadForLog",
        "Escribir tests de integración: POST /api/bookings, dispatchWebhookEvent + worker",
        "Integrar en CI: npm run test en cada PR con coverage mínimo 80%",
      ],
    },
  ],
  high: [
    {
      id: 7,
      title: "parseLocalDateInTimezone frágil para DST",
      file: "api/bookings/route.ts:258-293",
      effort: "Bajo",
      desc: "Función de 36 líneas que calcula offsets de zona horaria manualmente, incorrecta para zonas con DST.",
      why: [
        "El approach asume que el offset UTC es bidireccionalmente correcto, pero falla en zonas con Daylight Saving Time.",
        "Un restaurante en Santiago de Chile (DST) podría tener bookings con ±1 hora de error.",
        "date-fns-tz (fromZonedTime) ya podría usarse y resuelve esto con 2 líneas en vez de 36.",
      ],
      plan: [
        "Reemplazar con fromZonedTime de date-fns-tz",
        "Agregar tests con casos borde: DST, medianoche, UTC+5:30",
        "Buscar patrones similares de parsing manual en el proyecto",
      ],
    },
    {
      id: 8,
      title: "Zero validación Zod en endpoint POST /api/bookings",
      file: "api/bookings/route.ts vs api-schemas.ts",
      effort: "Bajo",
      desc: "Existen esquemas Zod en api-schemas.ts pero el endpoint crítico no los usa.",
      why: [
        "Validación manual débil: solo verifica existencia, no formato (email, fecha, partySize).",
        "Código duplicado: los esquemas Zod ya están escritos y completos pero no se sincronizan.",
        "Sin safeParse no hay errores descriptivos para el cliente API.",
      ],
      plan: [
        "Usar CreateBookingSchema.safeParse(body) en POST /api/bookings",
        "Hacer de api-schemas.ts la fuente única de verdad compartida",
        "Agregar tests que verifiquen que el schema rechaza payloads inválidos",
      ],
    },
    {
      id: 9,
      title: "Redis Proxy miente sobre locks NX",
      file: "redis.ts:34-36",
      effort: "Medio",
      desc: "El Proxy de Redis devuelve OK en locks NX aunque Redis esté caído.",
      why: [
        "Si Redis falla, el proxy dice lock adquirido cuando no lo está. Dos reservas simultáneas pueden duplicarse.",
        "Impacto directo en el negocio: cliente llega y su mesa está ocupada. Mala experiencia y posible compensación.",
        "El patrón de Proxy oculta fallos de infraestructura que deberían ser visibles.",
      ],
      plan: [
        "Eliminar el Proxy o implementar fallback consciente con SELECT ... FOR UPDATE NOWAIT en PostgreSQL",
        "Agregar monitoreo de salud de Redis (health check, métricas)",
      ],
    },
    {
      id: 10,
      title: "Rate limiting por restaurantId en vez de por keyId",
      file: "api-auth.ts:135-141",
      effort: "Bajo",
      desc: "Todas las API keys de un restaurante comparten el mismo contador de rate limit.",
      why: [
        "Si un restaurante tiene 3 keys (web, POS, integrador), el límite se agota 3x más rápido.",
        "Una key maliciosa puede hacer rate-limit a las keys legítimas del mismo restaurante.",
        "No hay aislamiento entre environments live y test.",
      ],
      plan: [
        "Cambiar clave de rate limit a key:${apiKey.id} en vez de restaurant:${restaurantId}",
        "Agregar límite agregado secundario por restaurante como soft limit con alerta",
      ],
    },
    {
      id: 11,
      title: "WhatsApp webhook monolítico (428 líneas)",
      file: "api/webhooks/whatsapp/route.ts",
      effort: "Medio",
      desc: "Un solo archivo con 5 responsabilidades: HMAC, rate limiting, DB, agente OpenAI, Meta API.",
      why: [
        "Cambiar el prompt del agente requiere modificar el mismo archivo que la verificación HMAC.",
        "Para testear hay que mockear 5 sistemas simultáneamente: es virtualmente imposible.",
        "args sin tipar (any) + JSON.parse de OpenAI puede producir errores en runtime.",
      ],
      plan: [
        "Extraer buildSystemPrompt -> src/lib/whatsapp/prompts.ts",
        "Extraer processWithOpenAI -> src/lib/whatsapp/agent.ts",
        "Extraer tools -> src/lib/whatsapp/tools.ts",
        "Extraer sendWhatsAppMessage -> src/lib/whatsapp/messenger.ts",
        "Dejar en route.ts solo: orquestación de alto nivel",
      ],
    },
  ],
  medium: [
    {
      id: 12,
      title: "HTML templates inline como strings multilínea",
      file: "email.ts:28-46, 86-143",
      effort: "Medio",
      desc: "Templates de correo en strings HTML multilínea con interpolación directa sin escape.",
      why: [
        "XSS: restaurantName con <script> se inyecta en correos que reciben usuarios legítimos.",
        "Sin syntax highlighting ni validación de cierre de etiquetas. Div abierto rompe layout sin aviso.",
      ],
      plan: [
        "Escapar variables con función escapeHtml() como solución rápida",
        "Migrar a react-email (compatible con Resend, JSX real) como solución definitiva",
      ],
    },
    {
      id: 13,
      title: "Promise.all sin límite de concurrencia",
      file: "webhook-queue.ts:86-103",
      effort: "Bajo",
      desc: "dispatchWebhookEvent lanza todos los webhooks simultáneamente sin límite.",
      why: [
        "50 webhooks en paralelo = 50 conexiones concurrentes. Si el receptor está lento, satura recursos.",
        "Si todos fallan, BullMQ reintenta 5 veces en paralelo con backoff exponencial.",
      ],
      plan: [
        "Usar p-limit para limitar a 5 envíos concurrentes",
        "Configurar concurrency en el worker de BullMQ",
      ],
    },
    {
      id: 14,
      title: "Sin paginación en API routes del dashboard",
      file: "API routes del dashboard",
      effort: "Medio",
      desc: "Los endpoints de listado no implementan paginación (findMany sin take/skip/cursor).",
      why: [
        "Con 10,000+ clientes, la query se vuelve progresivamente más lenta.",
        "Serverless functions de Vercel tienen timeout máximo. Query sin límite puede excederlo.",
        "El usuario espera todos los datos antes de ver algo, o renderiza una lista enorme.",
      ],
      plan: [
        "Agregar take (default 50) y cursor-based pagination en endpoints GET",
        "Devolver metadata: { data, nextCursor, total }",
        "Implementar scroll infinito con React Query + keepPreviousData",
      ],
    },
    {
      id: 15,
      title: "Import dinámico innecesario de OpenAI",
      file: "whatsapp/route.ts:288",
      effort: "Bajo",
      desc: "OpenAI se importa dinámicamente dentro de la función processWithOpenAI.",
      why: [
        "OpenAI está en dependencies, no en devDependencies. El bundle ya lo incluye.",
        "El import dinámico agrega ~50-100ms de latencia a cada mensaje WhatsApp.",
        "En fines de semana con alta rotación, se acumulan segundos de latencia.",
      ],
      plan: [
        "Cambiar a import estático al inicio del archivo",
        "Mover inicialización del cliente a singleton fuera de la función",
      ],
    },
  ],
  suggestions: [
    {
      id: 16,
      title: "ICON_MAP sin tipo correcto",
      file: "dashboard/layout.tsx:20",
      effort: "Bajo",
      desc: "Record<string, any> en vez de Record<string, LucideIcon>.",
      why: ["Pierde type safety: un nombre mal escrito en NAV_ITEMS rompe la UI sin error de compilación."],
      plan: ["Cambiar el tipo a Record<string, LucideIcon>."],
    },
    {
      id: 17,
      title: "Comentarios mixtos español/inglés",
      file: "Varios",
      effort: "Bajo",
      desc: "Comentarios en ambos idiomas, a veces en el mismo archivo.",
      why: ["Los comentarios en inglés tienden a desactualizarse más rápido en un equipo hispanohablante."],
      plan: ["Estandarizar progresivamente a español, priorizando archivos modificados frecuentemente."],
    },
    {
      id: 18,
      title: "Mocks incluidos en src/",
      file: "src/mocks/*",
      effort: "Bajo",
      desc: "Archivos de mock dentro de src/ se incluyen en build de producción.",
      why: ["Pueden empaquetarse accidentalmente en el build de producción, aumentando el bundle size y potencialmente exponiendo datos de prueba."],
      plan: ["Mover a __tests__/mocks/ o excluir del tsconfig."],
    },
  ],
}

const GOOD_PRACTICES = [
  "Singleton de Prisma con globalThis — evita múltiples conexiones en desarrollo",
  "Rate limiting multi-capa en endpoints críticos y API Keys",
  "HMAC-SHA256 para firma de webhooks salientes",
  "Sanitización PII (Ley 1581 Colombia) en webhook deliveries",
  "Idempotencia en webhooks vía idempotencyKey + upsert en BD",
  "Suspensión automática + notificación por email de webhooks caídos",
  "SDK público tipado con retry automático y rate limit handling",
  "AES-256-GCM para cifrado de datos sensibles (algoritmo correcto)",
  "Zod + OpenAPI para documentación de API pública",
  "Fire-and-forget para logging de auditoría sin bloquear flujo principal",
  "Optimistic locking con Redis NX para prevenir double-booking",
  "Clerk middleware para protección de rutas del dashboard",
  "Planes FREE/PRO/ENTERPRISE con límites de rate diferentes",
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const FONT = { name: "Calibri" }
const FONT_SANS = { name: "Calibri" }

function h(text, level, color) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: level === 0 ? 48 : level === 1 ? 36 : level === 2 ? 28 : 24, color: color || COLORS.textDark, font: FONT.name })],
    spacing: { after: level === 0 ? 400 : level === 1 ? 300 : 200 },
    heading: level === 0 ? HeadingLevel.TITLE : level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
  })
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22,
        color: opts.color || COLORS.textDark,
        font: FONT.name,
        bold: opts.bold || false,
        italics: opts.italics || false,
      }),
    ],
    spacing: { after: opts.spacingAfter ?? 120, before: opts.spacingBefore ?? 0 },
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
  })
}

function bullet(text, boldPrefix) {
  const children = []
  if (boldPrefix) {
    children.push(new TextRun({ text: boldPrefix, bold: true, size: 22, font: FONT.name, color: COLORS.textDark }))
  }
  children.push(new TextRun({ text: text, size: 22, font: FONT.name, color: COLORS.textDark }))
  return new Paragraph({
    children,
    bullet: { level: 0 },
    spacing: { after: 60 },
  })
}

function label(text, bgColor, textColor) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 18, color: textColor || COLORS.white, font: FONT.name })],
    shading: { type: ShadingType.CLEAR, fill: bgColor || COLORS.primary },
    spacing: { before: 40, after: 40 },
    indent: { left: 80, right: 80 },
  })
}

function emptyLine() {
  return new Paragraph({ children: [], spacing: { after: 80 } })
}

function horizontalRule() {
  return new Paragraph({
    children: [],
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.textLight } },
  })
}

// ─── BUILD DOCUMENT ──────────────────────────────────────────────────────────

async function buildDocx() {
  const sections = []

  // PORTADA
  sections.push({
    children: [
      emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
      new Paragraph({
        children: [new TextRun({ text: "iAgenda", bold: true, size: 64, color: COLORS.secondary, font: FONT.name })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Auditoría de Código", bold: true, size: 48, color: COLORS.primary, font: FONT.name })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "by iAgentes", size: 28, color: COLORS.textLight, font: FONT.name })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
      horizontalRule(),
      p("Fecha: 26 de junio de 2026", { alignment: AlignmentType.CENTER, color: COLORS.textLight }),
      p("Proyecto: D:\\agendamiento\\apps\\web", { alignment: AlignmentType.CENTER, color: COLORS.textLight }),
      p("Stack: Next.js 16 · React 19 · TypeScript · Prisma · PostgreSQL (Neon) · Upstash Redis · Clerk · Tailwind v4 · Cal.com · OpenAI · WhatsApp API", {
        alignment: AlignmentType.CENTER, color: COLORS.textLight, spacingBefore: 80,
      }),
      p("Propósito: SaaS multi-tenant colombiano para gestión inteligente de reservas de restaurantes.", {
        alignment: AlignmentType.CENTER, color: COLORS.textLight,
      }),
      emptyLine(),
      horizontalRule(),
      emptyLine(),
      new Paragraph({
        children: [new TextRun({ text: "CONFIDENCIAL", bold: true, size: 24, color: COLORS.secondary, font: FONT.name })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    ],
  })

  // RESUMEN EJECUTIVO
  sections.push({
    children: [
      h("Resumen Ejecutivo", 1, COLORS.primary),
      emptyLine(),
      // Tabla resumen
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [p("Métrica", { bold: true, spacingAfter: 40 })], width: { size: 50, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLORS.bgDark }, }),
              new TableCell({ children: [p("Estado", { bold: true, spacingAfter: 40 })], width: { size: 50, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLORS.bgDark }, }),
            ],
          }),
          ...[
            ["Arquitectura general", "✅ Sólida"],
            ["Seguridad", "⚠️ 4 hallazgos críticos"],
            ["Type Safety", "🔴 2 hallazgos críticos"],
            ["Testing", "🔴 0% de cobertura"],
            ["Mantenibilidad", "⚠️ Media"],
            ["Performance", "📌 Mejorable"],
          ].map(([k, v]) => new TableRow({
            children: [
              new TableCell({ children: [p(k, { spacingAfter: 40 })], width: { size: 50, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [p(v, { spacingAfter: 40 })], width: { size: 50, type: WidthType.PERCENTAGE } }),
            ],
          })),
        ],
      }),
      emptyLine(),
      p("La auditoría encontró 6 hallazgos críticos, 5 de alta prioridad, 5 de prioridad media y 3 sugerencias. Se recomienda atender los críticos antes de cualquier despliegue a producción.", { bold: true, spacingAfter: 200 }),
    ],
  })

  // FINDINGS BY PRIORITY
  const categories = [
    { key: "critical", label: "Prioridad Crítica", emoji: "🔥", color: COLORS.critical, items: FINDINGS.critical },
    { key: "high", label: "Prioridad Alta", emoji: "⚠️", color: COLORS.high, items: FINDINGS.high },
    { key: "medium", label: "Prioridad Media", emoji: "📌", color: COLORS.medium, items: FINDINGS.medium },
    { key: "suggestions", label: "Sugerencias", emoji: "💡", color: COLORS.suggestion, items: FINDINGS.suggestions },
  ]

  for (const cat of categories) {
    const secChildren = []
    secChildren.push(h(`${cat.emoji} ${cat.label} (${cat.items.length} hallazgo${cat.items.length > 1 ? "s" : ""})`, 1, cat.color))
    secChildren.push(emptyLine())

    for (const f of cat.items) {
      // Card header
      secChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `#${f.id}  `, bold: true, size: 28, color: cat.color, font: FONT.name }),
            new TextRun({ text: f.title, bold: true, size: 28, color: COLORS.primary, font: FONT.name }),
          ],
          spacing: { before: 200, after: 60 },
        })
      )
      // Metadata line
      secChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Archivo: ", bold: true, size: 20, color: COLORS.textLight, font: FONT.name }),
            new TextRun({ text: f.file, size: 20, color: COLORS.textLight, font: FONT.name, italics: true }),
            new TextRun({ text: "  |  Esfuerzo: ", bold: true, size: 20, color: COLORS.textLight, font: FONT.name }),
            new TextRun({ text: f.effort, size: 20, color: COLORS.textLight, font: FONT.name, italics: true }),
          ],
          spacing: { after: 80 },
        })
      )
      // Description
      secChildren.push(p(f.desc, { spacingAfter: 120 }))

      // Why section
      secChildren.push(p("Por qué importa:", { bold: true, color: cat.color, spacingAfter: 60 }))
      for (const w of f.why) {
        secChildren.push(bullet(w))
      }

      // Plan section
      secChildren.push(p("Plan de acción:", { bold: true, color: cat.color, spacingAfter: 60, spacingBefore: 100 }))
      for (const pl of f.plan) {
        secChildren.push(bullet(pl))
      }

      secChildren.push(horizontalRule())
    }

    sections.push({ children: secChildren })
  }

  // GOOD PRACTICES
  sections.push({
    children: [
      h("✅ Buenas Prácticas Encontradas", 1, COLORS.good),
      emptyLine(),
      ...GOOD_PRACTICES.map(gp => bullet(gp)),
      emptyLine(),
      horizontalRule(),
    ],
  })

  // CRONOGRAMA
  sections.push({
    children: [
      h("📅 Cronograma Sugerido", 1, COLORS.primary),
      emptyLine(),
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [p("Semana", { bold: true, spacingAfter: 40 })], shading: { type: ShadingType.CLEAR, fill: COLORS.bgDark } }),
              new TableCell({ children: [p("Foco", { bold: true, spacingAfter: 40 })], shading: { type: ShadingType.CLEAR, fill: COLORS.bgDark } }),
              new TableCell({ children: [p("Items", { bold: true, spacingAfter: 40 })], shading: { type: ShadingType.CLEAR, fill: COLORS.bgDark } }),
            ],
          }),
          ...([
            ["1", "🔥 Seguridad", "1, 2, 3, 4"],
            ["2", "🔥 Type Safety + Tests", "5, 6 (setup + unitarios)"],
            ["3", "⚠️ Correctitud", "7, 8, 9"],
            ["4", "⚠️ Arquitectura", "10, 11 (refactor WhatsApp)"],
            ["5", "📌 Mejoras", "12, 13, 14, 15"],
            ["6", "📌 + 💡 Final", "16-18 + tests integración"],
          ]).map(([w, f, i]) => new TableRow({
            children: [
              new TableCell({ children: [p(w, { spacingAfter: 40 })] }),
              new TableCell({ children: [p(f, { spacingAfter: 40 })] }),
              new TableCell({ children: [p(i, { spacingAfter: 40 })] }),
            ],
          })),
        ],
      }),
      emptyLine(),
      p("Total estimado: 6 semanas. Cada semana incluye corrección + tests para los items correspondientes.", { spacingAfter: 200 }),
      horizontalRule(),
      emptyLine(),
      p("Documento generado el 26 de junio de 2026", { alignment: AlignmentType.CENTER, color: COLORS.textLight, spacingAfter: 40 }),
      p("Herramienta: opencode-ai · deepseek-v4-flash-free", { alignment: AlignmentType.CENTER, color: COLORS.textLight }),
    ],
  })

  const doc = new Document({
    title: "Auditoria iAgenda",
    description: "Auditoría de código completa del proyecto iAgenda by iAgentes",
    styles: {
      default: {
        document: {
          run: { size: 22, font: FONT.name, color: COLORS.textDark },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    sections: sections.map(s => ({
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: s.children,
    })),
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(DOCX_PATH, buffer)
  console.log(`✅ DOCX generado: ${DOCX_PATH}`)
}

// ─── BUILD PDF ───────────────────────────────────────────────────────────────

function buildPdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: "Auditoria iAgenda",
        Author: "iAgentes",
        Subject: "Auditoría de Código",
      },
    })

    const stream = fs.createWriteStream(PDF_PATH)
    doc.pipe(stream)

    const primary = "#1a1a2e"
    const secondary = "#dc2626"
    const textDark = "#1e293b"
    const textLight = "#64748b"

    function addTitle(text, size, color) {
      doc.font("Helvetica-Bold").fontSize(size).fillColor(color || primary).text(text, { align: "center" })
    }

    function addH1(text) {
      doc.font("Helvetica-Bold").fontSize(18).fillColor(primary).text(text, { underline: false })
      doc.moveDown(0.5)
    }

    function addH2(text) {
      doc.font("Helvetica-Bold").fontSize(14).fillColor(textDark).text(text)
      doc.moveDown(0.3)
    }

    function addBody(text, opts = {}) {
      doc.font("Helvetica").fontSize(opts.size || 10).fillColor(opts.color || textDark).text(text, {
        align: opts.align || "justify",
        indent: opts.indent || 0,
      })
      doc.moveDown(opts.after || 0.3)
    }

    function addBullet(text, boldPrefix) {
      const prefix = boldPrefix ? `${boldPrefix}` : ""
      doc.font("Helvetica").fontSize(10).fillColor(textDark).text(`  • ${prefix}${text}`, { indent: 20 })
      doc.moveDown(0.15)
    }

    function addLine() {
      doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor("#cbd5e1").stroke()
      doc.moveDown(0.5)
    }

    function addLabel(text, color) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("white")
      const w = doc.widthOfString(text) + 16
      const x = doc.x
      doc.roundedRect(x, doc.y, w, 16, 3).fill(color || primary)
      doc.fillColor("white").text(text, x + 8, doc.y + 4, { width: w - 16, align: "center" })
      doc.x = x
      doc.moveDown(0.8)
    }

    function checkPage() {
      if (doc.y > doc.page.height - 100) {
        doc.addPage()
      }
    }

    // ── PORTADA ──
    doc.moveDown(6)
    addTitle("iAgenda", 42, secondary)
    addTitle("Auditoría de Código", 28, primary)
    addTitle("by iAgentes", 16, textLight)
    doc.moveDown(2)
    addLine()
    addBody("Fecha: 26 de junio de 2026", { align: "center", color: textLight, after: 0.2 })
    addBody("Proyecto: D:\\agendamiento\\apps\\web", { align: "center", color: textLight, after: 0.2 })
    addBody("Stack: Next.js 16 · React 19 · TypeScript · Prisma · PostgreSQL (Neon) · Upstash Redis · Clerk · Tailwind v4 · Cal.com · OpenAI · WhatsApp API", { align: "center", color: textLight, size: 8, after: 0.2 })
    addBody("Propósito: SaaS multi-tenant colombiano para gestión inteligente de reservas de restaurantes.", { align: "center", color: textLight, after: 0.5 })
    addLine()
    doc.moveDown(1)
    addBody("CONFIDENCIAL", { align: "center", color: secondary, size: 14, after: 2 })
    doc.addPage()

    // ── RESUMEN EJECUTIVO ──
    addH1("Resumen Ejecutivo")
    const metrics = [
      ["Arquitectura general", "✅ Sólida"],
      ["Seguridad", "⚠️ 4 hallazgos críticos"],
      ["Type Safety", "🔴 2 hallazgos críticos"],
      ["Testing", "🔴 0% de cobertura"],
      ["Mantenibilidad", "⚠️ Media"],
      ["Performance", "📌 Mejorable"],
    ]
    for (const [k, v] of metrics) {
      addBody(`  ${k}:  ${v}`, { size: 9, after: 0.15 })
    }
    doc.moveDown(0.5)
    addBody("La auditoría encontró 6 hallazgos críticos, 5 de alta prioridad, 5 de prioridad media y 3 sugerencias. Se recomienda atender los críticos antes de cualquier despliegue a producción.", { color: textDark, after: 1 })

    // ── FINDINGS ──
    const catConfig = [
      { key: "critical", label: "Prioridad Crítica", color: secondary, items: FINDINGS.critical },
      { key: "high", label: "Prioridad Alta", color: "#ea580c", items: FINDINGS.high },
      { key: "medium", label: "Prioridad Media", color: "#ca8a04", items: FINDINGS.medium },
      { key: "suggestions", label: "Sugerencias", color: "#6366f1", items: FINDINGS.suggestions },
    ]

    for (const cat of catConfig) {
      checkPage()
      doc.addPage()
      addH1(`${cat.label} (${cat.items.length} hallazgo${cat.items.length > 1 ? "s" : ""})`)
      addLine()

      for (const f of cat.items) {
        checkPage()
        addH2(`#${f.id}: ${f.title}`)
        addBody(`Archivo: ${f.file}  |  Esfuerzo: ${f.effort}`, { size: 8, color: textLight, after: 0.3 })
        addBody(f.desc, { after: 0.4 })

        addBody("Por qué importa:", { color: cat.color, after: 0.2 })
        for (const w of f.why) addBullet(w)

        addBody("Plan de acción:", { color: cat.color, after: 0.2 })
        for (const pl of f.plan) addBullet(pl)

        addLine()
      }
    }

    // ── GOOD PRACTICES ──
    checkPage()
    doc.addPage()
    addH1("✅ Buenas Prácticas Encontradas")
    addLine()
    for (const gp of GOOD_PRACTICES) {
      addBullet(gp)
    }
    doc.moveDown(0.5)
    addLine()

    // ── CRONOGRAMA ──
    checkPage()
    doc.addPage()
    addH1("Cronograma Sugerido")
    addLine()
    const schedule = [
      ["Semana 1", "🔥 Seguridad", "Items 1, 2, 3, 4"],
      ["Semana 2", "🔥 Type Safety + Tests", "Items 5, 6 (setup + unitarios)"],
      ["Semana 3", "⚠️ Correctitud", "Items 7, 8, 9"],
      ["Semana 4", "⚠️ Arquitectura", "Items 10, 11"],
      ["Semana 5", "📌 Mejoras", "Items 12, 13, 14, 15"],
      ["Semana 6", "📌 + 💡 Final", "Items 16-18 + tests integración"],
    ]
    for (const [w, f, i] of schedule) {
      addBody(`${w}  —  ${f}`, { bold: true, after: 0.1, size: 10 })
      addBody(`     ${i}`, { size: 9, color: textLight, after: 0.3 })
    }
    doc.moveDown(0.5)
    addBody("Total estimado: 6 semanas. Cada semana incluye corrección + tests para los items correspondientes.", { after: 1 })
    addLine()
    addBody("Documento generado el 26 de junio de 2026", { align: "center", color: textLight, size: 8, after: 0.2 })
    addBody("Herramienta: opencode-ai · deepseek-v4-flash-free", { align: "center", color: textLight, size: 8 })

    doc.end()
    stream.on("finish", () => {
      console.log(`✅ PDF generado: ${PDF_PATH}`)
      resolve()
    })
    stream.on("error", reject)
  })
}

// ─── RUN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Generando documentos de auditoría...\n")
  await buildDocx()
  await buildPdf()
  console.log("\n✅ Documentos generados exitosamente:")
  console.log(`   📄 DOCX: ${DOCX_PATH}`)
  console.log(`   📄 PDF:  ${PDF_PATH}`)
}

main().catch(console.error)
