import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    
    // Log auto-save payload on the server.
    // In a production scenario, this can be written to a TemporaryDrafts table in Neon.
    // For the MVP, this validates that client-side triggers execute correctly and can be inspected in the Network tab.
    console.log(`[Autosave Server Log] Guardando borrador para usuario ${userId}:`, {
      name: body.restaurantInfo?.name,
      slug: body.restaurantInfo?.slug,
      step: body.currentStep
    })

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error: any) {
    console.error("[Autosave Error]:", error)
    return NextResponse.json({ error: "Server error during autosave" }, { status: 500 })
  }
}
