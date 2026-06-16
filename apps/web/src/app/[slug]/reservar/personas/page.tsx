"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Users, ChevronRight, Minus, Plus, MessageSquare } from "lucide-react"

import { useBookingStore } from "@/lib/booking-store"
import { Button } from "@/components/ui/button"

const EVENT_TYPES = [
  { emoji: "🍽️", label: "Cena casual", trigger: null },
  { emoji: "💑", label: "Cena romántica", trigger: null },
  { emoji: "🎂", label: "Cumpleaños", trigger: "birthday" },
  { emoji: "🥂", label: "Aniversario", trigger: "anniversary" },
  { emoji: "💼", label: "Reunión de negocios", trigger: null },
  { emoji: "🎉", label: "Celebración especial", trigger: null },
  { emoji: "👨‍👩‍👧", label: "Comida familiar", trigger: null },
  { emoji: "✏️", label: "Otro", trigger: "other" },
]

const SPECIAL_CHIPS = [
  "Silla alta para bebé",
  "Accesibilidad wheelchair",
  "Mesa tranquila",
  "Vista panorámica",
  "Alergias alimentarias",
]

const PARTY_MESSAGES: Record<string, string> = {
  "1": "Mesa íntima para uno",
  "2": "Mesa íntima para dos",
  "3": "Mesa para grupo pequeño",
  "4": "Mesa para grupo pequeño",
  "5": "Mesa para grupo",
  "6": "Mesa para grupo",
  "7": "Mesa grande",
  "8": "Mesa grande",
}

interface PersonasPageProps {
  params: Promise<{ slug: string }>
}

export default function PersonasPage({ params }: PersonasPageProps) {
  const router = useRouter()
  const { slug } = React.use(params)

  const {
    partySize,
    eventType,
    specialRequests,
    setPartySize,
    setEventType,
    setSpecialRequests,
    setStep,
  } = useBookingStore()

  const [showMoreInput, setShowMoreInput] = React.useState(partySize > 8)
  const [birthdayName, setBirthdayName] = React.useState("")
  const [wantsDecoration, setWantsDecoration] = React.useState(false)
  const [allergyText, setAllergyText] = React.useState("")
  const [showAllergyInput, setShowAllergyInput] = React.useState(false)

  const selectedEvent = EVENT_TYPES.find((e) => e.label === eventType) || EVENT_TYPES[0]

  const handlePartySizeClick = (size: number) => {
    if (size <= 8) {
      setPartySize(size)
      setShowMoreInput(false)
    }
  }

  const handleMoreClick = () => {
    setShowMoreInput(true)
  }

  const addChip = (chip: string) => {
    if (chip === "Alergias alimentarias") {
      setShowAllergyInput(true)
      return
    }
    const current = specialRequests.trim()
    const newText = current ? `${current}, ${chip}` : chip
    setSpecialRequests(newText.slice(0, 500))
  }

  const handleAllergySubmit = () => {
    if (!allergyText.trim()) return
    const current = specialRequests.trim()
    const allergyStr = `Alergias: ${allergyText.trim()}`
    const newText = current ? `${current}, ${allergyStr}` : allergyStr
    setSpecialRequests(newText.slice(0, 500))
    setShowAllergyInput(false)
    setAllergyText("")
  }

  const handleContinue = () => {
    // Build special requests with event-specific extras
    let extras = specialRequests
    if (selectedEvent.trigger === "birthday" && birthdayName) {
      const str = `Cumpleaños de: ${birthdayName}`
      extras = extras ? `${extras}, ${str}` : str
    }
    if (selectedEvent.trigger === "anniversary" && wantsDecoration) {
      const str = "Decoración especial para aniversario"
      extras = extras ? `${extras}, ${str}` : str
    }
    setSpecialRequests(extras)
    setStep(2)
    router.push(`/${slug}/reservar/fecha`)
  }

  const partyMessage = partySize > 8
    ? "Evento especial — te contactaremos"
    : PARTY_MESSAGES[String(partySize)] || "Mesa para grupo"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--primary)]" />
          ¿Cuántas personas?
        </h2>
        <p className="text-neutral-400 text-sm">
          Selecciona el tamaño de tu grupo y el tipo de ocasión.
        </p>
      </div>

      {/* Party Size Selector */}
      <div className="space-y-3">
        <div className="grid grid-cols-4 sm:grid-cols-9 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
            <button
              key={size}
              id={`party-size-${size}`}
              onClick={() => handlePartySizeClick(size)}
              className={`h-12 w-full rounded-xl font-bold text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-neutral-950 ${
                partySize === size && !showMoreInput
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_0_20px_var(--primary)/30]"
                  : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/60"
              }`}
              aria-label={`${size} ${size === 1 ? "persona" : "personas"}`}
            >
              {size}
            </button>
          ))}
          <button
            id="party-size-more"
            onClick={handleMoreClick}
            className={`h-12 col-span-1 rounded-xl font-bold text-xs transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-neutral-950 ${
              showMoreInput
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-600"
            }`}
            aria-label="Más de 8 personas"
          >
            + Más
          </button>
        </div>

        {showMoreInput && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/60 border border-[var(--primary)]/30">
            <span className="text-neutral-400 text-sm flex-1">Número de personas</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPartySize(Math.max(9, partySize - 1))}
                className="w-8 h-8 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-white hover:bg-neutral-700 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center font-bold text-white">{partySize}</span>
              <button
                onClick={() => setPartySize(partySize + 1)}
                className="w-8 h-8 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-white hover:bg-neutral-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {partySize > 10 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            <span>Para grupos de +10 personas, te contactaremos para coordinar.</span>
            <a
              href="https://wa.me/"
              className="shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-semibold transition-colors"
            >
              WhatsApp
            </a>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
            {partyMessage}
          </p>
        )}
      </div>

      {/* Event Type */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-300">Tipo de ocasión</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EVENT_TYPES.map((event) => (
            <button
              key={event.label}
              id={`event-type-${event.label.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => setEventType(event.label)}
              className={`p-3 rounded-xl text-left border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 focus:ring-offset-neutral-950 ${
                eventType === event.label
                  ? "border-[var(--primary)]/50 bg-[var(--primary)]/10 text-white"
                  : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800/40"
              }`}
            >
              <span className="block text-lg mb-0.5">{event.emoji}</span>
              <span className="text-xs font-medium leading-tight">{event.label}</span>
            </button>
          ))}
        </div>

        {/* Event-specific extras */}
        {selectedEvent.trigger === "birthday" && (
          <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <label className="text-xs font-medium text-neutral-300">¿Para quién es el cumpleaños?</label>
            <input
              id="birthday-name"
              type="text"
              placeholder="Nombre del festejado/a"
              value={birthdayName}
              onChange={(e) => setBirthdayName(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[var(--primary)]/60"
            />
          </div>
        )}

        {selectedEvent.trigger === "anniversary" && (
          <label className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
            <input
              id="anniversary-decoration"
              type="checkbox"
              checked={wantsDecoration}
              onChange={(e) => setWantsDecoration(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800 checked:bg-[var(--primary)] checked:border-[var(--primary)]"
            />
            <span className="text-sm text-neutral-300">¿Desea decoración especial?</span>
          </label>
        )}
      </div>

      {/* Special Requests */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
          Solicitudes especiales
          <span className="text-neutral-600 font-normal">(opcional)</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {SPECIAL_CHIPS.map((chip) => (
            <button
              key={chip}
              id={`chip-${chip.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => addChip(chip)}
              className="px-3 py-1.5 rounded-full text-xs border border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 hover:text-white transition-all duration-200"
            >
              + {chip}
            </button>
          ))}
        </div>

        {showAllergyInput && (
          <div className="flex gap-2">
            <input
              id="allergy-text"
              type="text"
              placeholder="Especifica las alergias (ej: gluten, mariscos)"
              value={allergyText}
              onChange={(e) => setAllergyText(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[var(--primary)]/60"
            />
            <Button size="sm" onClick={handleAllergySubmit} className="bg-[var(--primary)] hover:opacity-90 text-white">
              Agregar
            </Button>
          </div>
        )}

        {specialRequests && (
          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-300">
            <span className="text-neutral-500 block mb-1">Solicitudes agregadas:</span>
            <span>{specialRequests}</span>
            <button
              onClick={() => setSpecialRequests("")}
              className="ml-2 text-red-400 hover:text-red-300 text-[10px] underline"
            >
              Limpiar
            </button>
          </div>
        )}

        <textarea
          id="special-requests-text"
          placeholder="Escribe otras solicitudes aquí (máx. 500 caracteres)..."
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value.slice(0, 500))}
          rows={2}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[var(--primary)]/60 resize-none"
        />
        <p className="text-[10px] text-neutral-600 text-right">{specialRequests.length}/500</p>
      </div>

      {/* CTA */}
      <div className="flex justify-end pt-2 border-t border-neutral-900">
        <Button
          id="personas-continue"
          onClick={handleContinue}
          disabled={partySize > 10}
          className="px-8 py-2.5 font-semibold gap-2 bg-[var(--primary)] hover:opacity-90 text-white shadow-[0_0_20px_var(--primary)/25] transition-all duration-200"
        >
          Elegir fecha y hora
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
