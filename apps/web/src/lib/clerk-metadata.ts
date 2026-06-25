/**
 * Metadata pública del usuario en Clerk.
 * Está disponible en el JWT y en sessionClaims sin llamadas extra.
 */
export interface ClerkPublicMetadata {
  role?: "SUPER_ADMIN" | "OWNER" | "MANAGER" | "HOSTESS" | "WAITER"
  restaurantId?: string
  restaurantSlug?: string
}

/**
 * Escribe la metadata pública en el usuario de Clerk via REST API.
 * Esto actualiza el JWT en la próxima sesión del usuario.
 */
export async function setUserPublicMetadata(
  clerkUserId: string,
  metadata: ClerkPublicMetadata
): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey || secretKey === "sk_test_placeholder") {
    console.log(`[Clerk Mock] setUserPublicMetadata(${clerkUserId}):`, metadata)
    return
  }

  const res = await fetch(
    `https://api.clerk.com/v1/users/${clerkUserId}/metadata`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_metadata: metadata }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    console.error(`[Clerk] Error actualizando metadata: ${res.status} — ${text}`)
    throw new Error(`Failed to update Clerk user metadata: ${res.statusText}`)
  }
}

/**
 * Lee la metadata pública de un usuario de Clerk via REST API.
 */
export async function getUserPublicMetadata(
  clerkUserId: string
): Promise<ClerkPublicMetadata> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey || secretKey === "sk_test_placeholder") {
    return {}
  }

  const res = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })

  if (!res.ok) return {}

  const user = await res.json()
  return (user.public_metadata as ClerkPublicMetadata) ?? {}
}
