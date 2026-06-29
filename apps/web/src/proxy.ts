import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
  "/api/auth/redirect",
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Si ya está autenticado y va a sign-in o sign-up → redirigir via smart redirect
  const url = req.nextUrl.pathname
  if (userId && (url.startsWith("/sign-in") || url.startsWith("/sign-up"))) {
    return NextResponse.redirect(new URL("/api/auth/redirect", req.url))
  }

  // Rutas protegidas: requieren sesión activa de Clerk
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
  // Todo lo demás es público (landing page, slugs de restaurantes, etc.)
})

export const config = {
  matcher: [
    // Excluir archivos estáticos de Next.js pero procesar todo lo demás
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Siempre correr para rutas API
    "/(api|trpc)(.*)",
  ],
}
