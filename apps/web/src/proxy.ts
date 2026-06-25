import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
])

const isAdminRoute = createRouteMatcher(["/admin(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // Rutas de admin: requieren sesión activa (el chequeo de rol SUPER_ADMIN
  // se realiza en el layout/page de /admin, donde tenemos acceso completo a auth())
  if (isAdminRoute(req)) {
    await auth.protect()
  }

  // Rutas protegidas: requieren sesión activa de Clerk
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk proxy path (required for Clerk auth in Next.js 15)
    "/__clerk/:path*",
  ],
}
