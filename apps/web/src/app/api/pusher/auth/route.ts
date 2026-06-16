import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import Pusher from "pusher"

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
  useTLS: true,
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const socketId = formData.get("socket_id") as string
  const channel = formData.get("channel_name") as string

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 })
  }

  // Private channels require auth: private-restaurant-{restaurantId}
  if (channel.startsWith("private-")) {
    // TODO: verify user belongs to this restaurant via Clerk org or DB lookup
    const authResponse = pusher.authorizeChannel(socketId, channel)
    return NextResponse.json(authResponse)
  }

  // Presence channels
  if (channel.startsWith("presence-")) {
    const authResponse = pusher.authorizeChannel(socketId, channel, {
      user_id: userId,
      user_info: { name: userId },
    })
    return NextResponse.json(authResponse)
  }

  return NextResponse.json({ error: "Unauthorized channel" }, { status: 403 })
}
