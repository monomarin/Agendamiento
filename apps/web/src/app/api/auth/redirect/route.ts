import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"

/**
 * GET /api/auth/redirect
 * Smart post-auth redirect: routes users to the correct page after login.
 * - SUPER_ADMIN → /admin
 * - User with restaurant → /dashboard
 * - New user → /onboarding
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? ""

  // 1. Buscar por clerkUserId (caso normal)
  let user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: { restaurantId: true, role: true },
  })

  // 2. Si no existe por clerkUserId, buscar por email (admin pre-creado o primer login)
  if (!user && email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true, restaurantId: true, role: true, clerkUserId: true },
    })

    if (byEmail) {
      // Vincular clerkUserId real al registro existente (ej: SUPER_ADMIN pre-creado)
      await prisma.user.update({
        where: { email },
        data: { clerkUserId: userId! },
      })
      user = { restaurantId: byEmail.restaurantId, role: byEmail.role }
    }
  }

  // 3. Si aún no existe, crear como OWNER nuevo
  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: userId!,
        email,
        name: `${clerkUser?.firstName ?? ""} ${clerkUser?.lastName ?? ""}`.trim() || "Usuario",
        role: "OWNER",
      },
      select: { restaurantId: true, role: true },
    })
  }

  // Routing según rol y estado
  if (user.role === "SUPER_ADMIN") redirect("/admin")
  if (user.restaurantId) redirect("/dashboard")
  redirect("/onboarding")
}
