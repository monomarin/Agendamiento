"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser, SignIn } from "@clerk/nextjs"
import { CheckCircle, XCircle, Clock, Loader2, Users } from "lucide-react"

interface InvitationInfo {
  valid: boolean
  email: string
  role: string
  roleLabel: string
  restaurantName: string
  restaurantColor: string
  logoUrl?: string | null
  expiresAt: string
}

type PageState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "valid"; info: InvitationInfo }
  | { status: "needs-auth"; info: InvitationInfo }
  | { status: "accepting" }
  | { status: "success"; restaurantSlug: string; restaurantName: string }
  | { status: "error"; message: string }

export default function InvitePage() {
  return (
    <React.Suspense fallback={<PageShell><LoadingCard /></PageShell>}>
      <InvitePageContent />
    </React.Suspense>
  )
}

function InvitePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const { isLoaded, isSignedIn, user } = useUser()

  const [state, setState] = React.useState<PageState>({ status: "loading" })

  // 1. Validar token al cargar
  React.useEffect(() => {
    if (!token) {
      setState({ status: "invalid", message: "El enlace de invitación no es válido. Verifica el correo que recibiste." })
      return
    }

    fetch(`/api/invitations/${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setState({ status: "invalid", message: data.error ?? "Invitación no válida" })
        } else {
          setState({ status: "valid", info: data })
        }
      })
      .catch(() => {
        setState({ status: "invalid", message: "Error al verificar la invitación. Intenta de nuevo." })
      })
  }, [token])

  // 2. Cuando el token es válido y Clerk cargó, decidir si mostrar login o aceptar
  React.useEffect(() => {
    if (!isLoaded || state.status !== "valid") return

    if (!isSignedIn) {
      setState((prev) =>
        prev.status === "valid" ? { status: "needs-auth", info: prev.info } : prev
      )
    }
    // Si ya está logueado, mantener "valid" para mostrar el botón de aceptar
  }, [isLoaded, isSignedIn, state.status])

  // 3. Aceptar la invitación
  const handleAccept = async () => {
    if (state.status !== "valid" || !token) return
    setState({ status: "accepting" })

    try {
      const res = await fetch(`/api/invitations/${token}`, { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Error al aceptar la invitación" })
      } else {
        setState({
          status: "success",
          restaurantSlug: data.restaurantSlug,
          restaurantName: data.restaurantName ?? "",
        })
        // Redirect to dashboard after 2s
        setTimeout(() => router.push("/dashboard"), 2000)
      }
    } catch {
      setState({ status: "error", message: "Error de conexión. Intenta de nuevo." })
    }
  }

  // ── Renders ──────────────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return <PageShell><LoadingCard /></PageShell>
  }

  if (state.status === "invalid") {
    return <PageShell><ErrorCard message={state.message} /></PageShell>
  }

  if (state.status === "needs-auth") {
    return (
      <PageShell>
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 text-white text-2xl font-bold"
              style={{ backgroundColor: state.info.restaurantColor ?? "#dc2626" }}
            >
              {state.info.restaurantName.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Únete a {state.info.restaurantName}</h1>
            <p className="text-neutral-400 text-sm">
              Inicia sesión o crea una cuenta con <strong className="text-white">{state.info.email}</strong> para aceptar la invitación.
            </p>
          </div>
          <SignIn
            fallbackRedirectUrl={`/invite?token=${token}`}
            appearance={{
              variables: {
                colorPrimary: state.info.restaurantColor ?? "#dc2626",
                colorBackground: "#0a0a0a",
                colorInputBackground: "#171717",
                colorInputText: "#ffffff",
                colorText: "#ffffff",
                colorTextSecondary: "#a3a3a3",
                colorBorder: "#262626",
              },
              elements: {
                card: "bg-transparent border-0 shadow-none",
                headerTitle: "text-xl font-bold text-white",
                headerSubtitle: "text-neutral-400",
                formButtonPrimary: "text-white transition-colors",
                footerActionText: "text-neutral-400",
                footerActionLink: "font-semibold",
              },
            }}
          />
        </div>
      </PageShell>
    )
  }

  if (state.status === "valid" && isSignedIn) {
    const info = state.info
    const hours = Math.max(
      0,
      Math.floor((new Date(info.expiresAt).getTime() - Date.now()) / 3_600_000)
    )
    return (
      <PageShell>
        <div className="w-full max-w-md bg-neutral-900/60 border border-neutral-800 rounded-2xl p-8 backdrop-blur-xl">
          {/* Logo / inicial */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-4"
              style={{ backgroundColor: info.restaurantColor ?? "#dc2626", boxShadow: `0 0 30px ${info.restaurantColor ?? "#dc2626"}40` }}
            >
              {info.restaurantName.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-white text-center">
              Invitación a {info.restaurantName}
            </h1>
            <p className="text-neutral-400 text-sm text-center mt-1">
              Has sido invitado/a a unirte al equipo
            </p>
          </div>

          {/* Info de rol */}
          <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-neutral-700/50">
                <Users className="w-4 h-4 text-neutral-300" />
              </div>
              <div>
                <p className="text-[11px] text-neutral-500 uppercase tracking-wide">Tu rol</p>
                <p className="text-white font-semibold">{info.roleLabel}</p>
              </div>
            </div>
          </div>

          {/* Email de destino */}
          <div className="text-sm text-neutral-400 text-center mb-6">
            Aceptando como <span className="text-white font-medium">{user?.emailAddresses?.[0]?.emailAddress}</span>
          </div>

          {/* Expiry warning */}
          {hours < 12 && (
            <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Este enlace expira en {hours < 1 ? "menos de 1 hora" : `${hours} horas`}
            </div>
          )}

          <button
            onClick={handleAccept}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              backgroundColor: info.restaurantColor ?? "#dc2626",
              boxShadow: `0 0 20px ${info.restaurantColor ?? "#dc2626"}40`,
            }}
          >
            Aceptar invitación
          </button>

          <p className="text-center text-xs text-neutral-600 mt-4">
            Al aceptar, te unirás al equipo de {info.restaurantName} en iAgenda.
          </p>
        </div>
      </PageShell>
    )
  }

  if (state.status === "accepting") {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
          <p className="text-white font-medium">Procesando tu invitación...</p>
        </div>
      </PageShell>
    )
  }

  if (state.status === "success") {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">¡Bienvenido/a al equipo!</h1>
          <p className="text-neutral-400 text-sm">
            Te redirigiremos al dashboard en un momento...
          </p>
        </div>
      </PageShell>
    )
  }

  if (state.status === "error") {
    return <PageShell><ErrorCard message={state.message} /></PageShell>
  }

  return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white antialiased flex flex-col items-center justify-center p-6 relative">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-[30%] w-[40%] h-[40%] rounded-full bg-red-600/5 blur-[120px] pointer-events-none" />

      {/* Logo */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center font-bold text-base shadow-[0_0_15px_rgba(220,38,38,0.4)]">
          i
        </div>
        <span className="font-semibold text-base tracking-tight">
          iAgenda <span className="text-red-500 font-light text-xs">by iAgentes</span>
        </span>
      </div>

      {children}
    </div>
  )
}

function LoadingCard() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
      <p className="text-neutral-400 text-sm">Verificando invitación...</p>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <XCircle className="w-8 h-8 text-red-400" />
      </div>
      <h1 className="text-xl font-bold text-white">Invitación no válida</h1>
      <p className="text-neutral-400 text-sm">{message}</p>
      <a
        href="/"
        className="text-red-400 hover:text-red-300 text-sm underline underline-offset-4 transition-colors"
      >
        Volver al inicio
      </a>
    </div>
  )
}
