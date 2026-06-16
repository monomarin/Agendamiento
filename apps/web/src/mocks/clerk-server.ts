import { NextRequest, NextResponse } from "next/server"

// The mock user ID. We should sync this with what is in the seeded database or onboarding
// Let's use a standard clerk-like mock user id
export const MOCK_USER_ID = "user_2P9Jz2kGzYw1t4Xz5y7w1t8x3y9"

export async function auth() {
  return {
    userId: MOCK_USER_ID,
    protect: async () => {},
  }
}

// Attach protect method to auth function so it can be called as auth.protect() as well
auth.protect = async () => {}

export async function currentUser() {
  return {
    id: MOCK_USER_ID,
    firstName: "Administrador",
    lastName: "iAgenda",
    emailAddresses: [
      {
        emailAddress: "admin@iagenda.com",
      },
    ],
  }
}

export function createRouteMatcher(patterns: string[]) {
  return (req: NextRequest) => {
    const pathname = req.nextUrl.pathname
    return patterns.some((pattern) => {
      // Simple wildcard to regex replacement
      const regexStr = pattern.replace(/\(\.\*\)/g, ".*").replace(/\*/g, ".*")
      const regex = new RegExp(`^${regexStr}$`)
      return regex.test(pathname)
    })
  }
}

type ClerkMiddlewareCallback = (
  auth: { protect: () => Promise<void> },
  req: NextRequest
) => Promise<NextResponse | void>

export function clerkMiddleware(callback?: ClerkMiddlewareCallback) {
  return async (req: NextRequest) => {
    if (callback) {
      const authObj = {
        protect: async () => {
          // No-op for mock, allowing all protected routes to load without redirecting
        },
      }
      const res = await callback(authObj, req)
      if (res) return res
    }
    return NextResponse.next()
  }
}
