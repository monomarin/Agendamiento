import Link from "next/link"
import { ArrowRight, Sparkles, Calendar, Bot, Shield, CheckCircle, ChefHat } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col antialiased relative overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full bg-red-600/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-600/5 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(220,38,38,0.4)]">
            i
          </div>
          <span className="font-semibold text-lg tracking-tight">
            iAgenda <span className="text-red-500 font-light text-sm">by iAgentes</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-400 font-medium">
          <a href="#features" className="hover:text-white transition-colors">Características</a>
          <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
          <a href="#about" className="hover:text-white transition-colors">Acerca de</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-semibold text-neutral-300 hover:text-white px-4 py-2 transition-colors"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-semibold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center gap-1.5"
          >
            Comenzar Gratis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col justify-center items-center text-center px-4 py-20 md:py-32 max-w-4xl mx-auto z-10 relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-semibold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Nueva Era: Automatización con Inteligencia Artificial
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none text-white mb-6">
          El motor de reservas que tu{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
            Restaurante
          </span>{" "}
          merece.
        </h1>

        <p className="text-neutral-400 text-lg md:text-xl leading-relaxed max-w-2xl mb-10">
          iAgenda es el SaaS definitivo para la gestión inteligente de reservas. Habilita una página pública premium, cobra depósitos seguros y atiende clientes en piloto automático por WhatsApp.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link
            href="/sign-up"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2 text-base"
          >
            Registrar mi Restaurante
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href="#features"
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-850 font-semibold px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
          >
            Ver Características
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-neutral-900/40 border-t border-neutral-900 z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Diseñado para optimizar tu operación diaria
            </h2>
            <p className="text-neutral-400 max-w-xl mx-auto text-sm">
              Olvídate de las planillas de papel. Obtén control total sobre tu salón y aumenta tu ticket promedio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:border-red-500/20 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Portal Público Premium</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Una experiencia de reserva en 6 pasos optimizada para móviles. Conexión directa a la disponibilidad de mesas del local en tiempo real.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:border-red-500/20 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6 group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Agente Virtual por WhatsApp</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Tus clientes pueden chatear con un bot entrenado en GPT-4o. Reserva de mesas de forma autónoma sin intervención humana.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:border-red-500/20 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Garantía de Asistencia</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Reduce el No-Show cobrando depósitos fijos o porcentajes mediante Stripe y Wompi. Devolución automática según tus políticas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-16 text-center max-w-4xl mx-auto border-t border-neutral-900/60 z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <span className="block text-4xl font-extrabold text-white">0%</span>
            <span className="block text-xs text-neutral-500 mt-1">No-Show con depósitos</span>
          </div>
          <div>
            <span className="block text-4xl font-extrabold text-white">24/7</span>
            <span className="block text-xs text-neutral-500 mt-1">Atención automatizada</span>
          </div>
          <div>
            <span className="block text-4xl font-extrabold text-white">&lt; 15m</span>
            <span className="block text-xs text-neutral-500 mt-1">Configuración inicial</span>
          </div>
          <div>
            <span className="block text-4xl font-extrabold text-white">100%</span>
            <span className="block text-xs text-neutral-500 mt-1">Soporte local en Colombia</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-10 px-6 mt-auto text-center text-neutral-500 text-xs z-10">
        <div className="flex justify-center items-center gap-2 mb-4">
          <ChefHat className="w-4 h-4 text-red-500" />
          <span className="font-semibold text-white">iAgenda by iAgentes</span>
        </div>
        <p className="mb-2">El futuro de las reservas gastronómicas en América Latina.</p>
        <p>© {new Date().getFullYear()} iAgentes. Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}
