"use client"

import * as React from "react"
import { Sparkles, Phone, MessageSquare, ChevronLeft, Bot, User } from "lucide-react"

import { useOnboardingStore } from "@/lib/onboarding-store"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"

interface ChatMessage {
  sender: "bot" | "user"
  text: string
}

export function StepWhatsapp() {
  const { whatsappConfig, updateWhatsappConfig, nextStep, prevStep } = useOnboardingStore()

  // Local state
  const [enabled, setEnabled] = React.useState(whatsappConfig.agentEnabled)
  const [number, setNumber] = React.useState(whatsappConfig.whatsappNumber || "")
  const [instructions, setInstructions] = React.useState(whatsappConfig.customInstructions || "")

  // Mock chat state
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([
    { sender: "bot", text: "¡Hola! Bienvenido a la Cabrera. ¿En qué puedo ayudarte hoy?" },
  ])
  const [inputMessage, setInputMessage] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)

  const handleToggle = (checked: boolean) => {
    setEnabled(checked)
  }

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const userMsg = inputMessage.trim()
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }])
    setInputMessage("")
    setIsTyping(true)

    // Simulate AI response based on instructions
    setTimeout(() => {
      setIsTyping(false)
      let botResponse = "¡Hola! Estoy analizando tu solicitud de reserva en base a nuestras mesas disponibles."
      
      const lower = userMsg.toLowerCase()
      if (lower.includes("mesa") || lower.includes("reserva") || lower.includes("comer") || lower.includes("cenar")) {
        botResponse = "¡Perfecto! Veo disponibilidad para hoy a las 8:00 PM para 2 o 4 personas. ¿Te gustaría confirmar?"
      } else if (lower.includes("hola") || lower.includes("buenas")) {
        botResponse = `¡Hola! Soy tu asistente virtual de iAgenda. ¿Te gustaría hacer una reserva o consultar los horarios?`
      } else {
        botResponse = `Entendido. Tomo nota de tu instrucción: "${userMsg}". Estoy programado para gestionar reservas siguiendo las reglas del restaurante.`
      }

      setChatMessages((prev) => [...prev, { sender: "bot", text: botResponse }])
    }, 1500)
  }

  const handleNext = () => {
    updateWhatsappConfig({
      agentEnabled: enabled,
      whatsappNumber: number,
      customInstructions: instructions,
    })
    nextStep()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-red-500" />
          Agente de Inteligencia Artificial (Opcional)
        </h2>
        <p className="text-neutral-400 text-sm">
          Configura un bot de WhatsApp inteligente que responda a tus clientes, revise la disponibilidad en Cal.com y complete las reservas 24/7.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-semibold text-white text-sm block">Habilitar Agente de IA</span>
                <span className="text-xs text-neutral-400 block">
                  Activa el flujo automático de reservas por chat de texto de WhatsApp.
                </span>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggle} />
            </div>

            {enabled && (
              <div className="space-y-4 pt-4 border-t border-neutral-900">
                <div className="space-y-2">
                  <span className="font-medium text-xs text-neutral-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Número de WhatsApp Vinculado
                  </span>
                  <Input
                    placeholder="Ej. +57 300 999 8888 (Número de Twilio)"
                    className="bg-neutral-950 border-neutral-800 text-white font-mono text-sm"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                  <p className="text-[10px] text-neutral-500 leading-normal">
                    * Nota: En Fase 1 (MVP) el agente corre en modo simulación. Se vinculará con la API de Twilio en la Fase 3 de desarrollo.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="font-medium text-xs text-neutral-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Instrucciones de Atención para el Agente (Prompt)
                  </span>
                  <Textarea
                    placeholder="Ej. Eres el agente de la Cabrera. Saluda cordialmente. Menciona que nuestro plato estrella es el Ojo de Bife. Las reservas de más de 6 personas requieren llamar directamente."
                    rows={4}
                    className="bg-neutral-950 border-neutral-800 text-white text-sm"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live preview simulated chat */}
        <div className="lg:col-span-5 flex flex-col bg-neutral-900/40 border border-neutral-800/80 rounded-xl overflow-hidden h-[340px]">
          <div className="bg-neutral-900 px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-red-500" />
              </div>
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full absolute bottom-0 right-0 border-2 border-neutral-900" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-white leading-tight">Agente IA Simulación</h4>
              <span className="text-[9px] text-green-500 leading-none">Activo en tiempo real</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 bg-neutral-950 p-4 space-y-3 overflow-y-auto flex flex-col text-xs">
            {chatMessages.map((msg, idx) => {
              const isBot = msg.sender === "bot"
              return (
                <div
                  key={idx}
                  className={`flex gap-2 max-w-[85%] ${isBot ? "self-start" : "self-end flex-row-reverse"}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${
                      isBot ? "bg-red-950/40 border border-red-500/20" : "bg-neutral-800"
                    }`}
                  >
                    {isBot ? <Bot className="w-3.5 h-3.5 text-red-500" /> : <User className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border leading-relaxed ${
                      isBot
                        ? "bg-neutral-900/60 border-neutral-850 text-neutral-300"
                        : "bg-red-600 border-red-500 text-white"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              )
            })}
            
            {isTyping && (
              <div className="flex gap-2 max-w-[85%] self-start items-center">
                <div className="w-6 h-6 rounded-full bg-red-950/40 border border-red-500/20 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                </div>
                <div className="flex gap-1 p-2 bg-neutral-900/40 border border-neutral-850 rounded-xl">
                  <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 bg-neutral-900 border-t border-neutral-850 flex gap-2">
            <Input
              placeholder={enabled ? "Chatea con el agente virtual..." : "Activa el agente para chatear"}
              disabled={!enabled}
              className="bg-neutral-950 border-neutral-800 text-xs text-white"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <Button
              type="button"
              disabled={!enabled || !inputMessage.trim()}
              className="bg-red-600 hover:bg-red-700 text-white px-3 text-xs"
              onClick={handleSendMessage}
            >
              Enviar
            </Button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t border-neutral-900">
        <Button
          type="button"
          variant="outline"
          className="border-neutral-800 text-neutral-300 hover:bg-neutral-900"
          onClick={prevStep}
        >
          <ChevronLeft className="w-4 h-4 mr-1.5" />
          Atrás
        </Button>
        <Button type="button" className="bg-red-600 hover:bg-red-700 text-white px-6" onClick={handleNext}>
          Siguiente Paso
        </Button>
      </div>
    </div>
  )
}
