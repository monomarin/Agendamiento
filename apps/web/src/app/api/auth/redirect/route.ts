import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"

/**
 * GET /api/auth/redirect
 * Smart post-auth redirect: checks if authenticated user has a restaurant.
 * Used as afterSignInUrl so the app routes correctly after login.
 */
export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  // Upsert user to ensure they exist in the DB (webhook may not have fired yet)
  const clerkUser = await currentUser()

  const user = await prisma.user.upsert({
    where: { clerkUserId: userId },
    update: {},
    create: {
      clerkUserId: userId,
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? "",
      name:
        `${clerkUser?.firstName ?? ""} ${clerkUser?.lastName ?? ""}`.trim() || "Usuario",
      role: "OWNER",
    },
    select: { restaurantId: true },
  })

  if (user.restaurantId) {
    redirect("/dashboard")
  } else {
    redirect("/onboarding")
  }
}
