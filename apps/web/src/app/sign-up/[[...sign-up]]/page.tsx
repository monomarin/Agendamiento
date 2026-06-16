import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-neutral-950 text-white antialiased">
      {/* Visual branding pane */}
      <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-12 overflow-hidden bg-neutral-900 border-r border-neutral-800">
        {/* Glow effect */}
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full bg-red-600/10 blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-neutral-100/5 blur-[120px]" />

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(220,38,38,0.5)]">
            i
          </div>
          <span className="font-semibold text-xl tracking-tight">
            iAgenda <span className="text-red-500 font-light text-sm">by iAgentes</span>
          </span>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
            Empieza a recibir reservas en menos de <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">15 minutos</span>.
          </h1>
          <p className="text-neutral-400 text-lg leading-relaxed">
            Regístrate hoy para configurar las mesas de tu restaurante, establecer tus horarios, habilitar depósitos de garantía y publicar tu enlace público.
          </p>

          <div className="pt-4 flex gap-4">
            <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
              <h3 className="font-semibold text-white">Configuración Fácil</h3>
              <p className="text-sm text-neutral-400 mt-1">Asistente interactivo paso a paso.</p>
            </div>
            <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
              <h3 className="font-semibold text-white">Control Total</h3>
              <p className="text-sm text-neutral-400 mt-1">Dashboard intuitivo para tu equipo.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-neutral-500 text-sm">
          © {new Date().getFullYear()} iAgentes. Todos los derechos reservados.
        </div>
      </div>

      {/* Form pane */}
      <div className="col-span-1 lg:col-span-5 flex flex-col justify-center items-center p-8 bg-neutral-950 relative">
        {/* Glow effect on mobile */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-[200px] bg-red-600/5 blur-[80px]" />

        <div className="w-full max-w-md flex flex-col items-center">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-lg">
              i
            </div>
            <span className="font-semibold text-xl">iAgenda</span>
          </div>

          <SignUp
            appearance={{
              variables: {
                colorPrimary: "#dc2626",
                colorBackground: "#0a0a0a",
                colorInputBackground: "#171717",
                colorInputText: "#ffffff",
                colorText: "#ffffff",
                colorTextSecondary: "#a3a3a3",
                colorBorder: "#262626",
              },
              elements: {
                card: "bg-transparent border-0 shadow-none",
                headerTitle: "text-2xl font-bold text-white text-center",
                headerSubtitle: "text-neutral-400 text-center",
                socialButtonsBlockButton: "bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 transition-colors",
                socialButtonsBlockButtonText: "text-white font-medium",
                formButtonPrimary: "bg-red-600 hover:bg-red-700 text-white transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)]",
                footerActionText: "text-neutral-400",
                footerActionLink: "text-red-500 hover:text-red-400 font-semibold",
                dividerLine: "bg-neutral-800",
                dividerText: "text-neutral-500",
                formFieldLabel: "text-neutral-300 font-medium",
                formFieldInput: "bg-neutral-900 border border-neutral-800 text-white focus:border-red-600 focus:ring-red-600",
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
