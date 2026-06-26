import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/[^/]+(.*)", // public restaurant pages e.g. /:slug
])

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
  "/api/auth/redirect",
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Si ya está autenticado y quiere ir a sign-in o sign-up → redirigir vía smart redirect
  const url = req.nextUrl.pathname
  if (userId && (url.startsWith("/sign-in") || url.startsWith("/sign-up"))) {
    return NextResponse.redirect(new URL("/api/auth/redirect", req.url))
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
  ],
}
