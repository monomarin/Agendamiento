"use client"

import dynamic from "next/dynamic"
import "swagger-ui-react/swagger-ui.css"

// Cargamos SwaggerUI solo en cliente (no SSR compatible)
// Usamos `any` props porque el @types/swagger-ui-react usa CommonJS `export =`
// que no es compatible con next/dynamic sin una capa de adaptación.
const SwaggerUI = dynamic(
  () =>
    import("swagger-ui-react").then((mod) => {
      // mod puede ser { default: Component } o el Component directamente
      const Component = "default" in mod ? (mod as { default: React.ComponentType<unknown> }).default : (mod as unknown as React.ComponentType<unknown>)
      return { default: Component }
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    ),
  }
)

import React from "react"

const swaggerProps = {
  url: "/api/docs",
  docExpansion: "list",
  defaultModelsExpandDepth: 1,
  displayRequestDuration: true,
  tryItOutEnabled: true,
  persistAuthorization: true,
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">API Reference</h1>
          <p className="mt-2 text-gray-600">
            Documentación interactiva de la API pública de iAgenda v1.
            Usa tu API Key para autenticarte y probar los endpoints en tiempo real.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <SwaggerUI {...(swaggerProps as any)} />
        </div>
      </div>
    </div>
  )
}
