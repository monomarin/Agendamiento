"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import {
  MessageSquare, Search, Send, Bot, User, CheckCircle2,
  RefreshCw, Phone, Mail, Calendar, Sparkles, UserCheck,
  AlertCircle, XCircle, ArrowRight
} from "lucide-react"
import { toast } from "sonner"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: string
  sender?: string // "human" or bot
}

interface Conversation {
  id: string
  clientPhone: string
  messages: Message[]
  bookingId: string | null
  status: string // active | resolved | transferring | human
  createdAt: string
  updatedAt: string
  customer: {
    name: string
    phone: string
    email: string
  }
}

interface ConversacionesClientProps {
  restaurantId: string
}

export default function ConversacionesClient({ restaurantId }: ConversacionesClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  // Selected Chat
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState<string>("")
  const [sending, setSending] = useState<boolean>(false)

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  // Auto-scroll to bottom of chat on selection or new messages
  useEffect(() => {
    scrollToBottom()
  }, [activeConversationId, conversations])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/dashboard/conversations")
      const json = await res.json()
      if (json.status === "success") {
        setConversations(json.data || [])
        // Set first active if none
        if (json.data?.length > 0 && !activeConversationId) {
          setActiveConversationId(json.data[0].id)
        }
      } else {
        toast.error("Error al cargar chats.")
      }
    } catch (err) {
      toast.error("Error al conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id: string, nextStatus: string) => {
    try {
      const res = await fetch(`/api/dashboard/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (json.status === "success") {
        toast.success(`Chat cambiado a: ${nextStatus === "human" ? "Control Humano" : nextStatus === "resolved" ? "Resuelto" : "Bot de IA"}`)
        setConversations(prev =>
          prev.map(c => (c.id === id ? { ...c, status: nextStatus } : c))
        )
      } else {
        toast.error("No se pudo cambiar el estado.")
      }
    } catch (err) {
      toast.error("Error de red.")
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !activeConversationId || sending) return

    setSending(true)
    const content = messageInput.trim()
    setMessageInput("")

    try {
      const res = await fetch(`/api/dashboard/conversations/${activeConversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (json.status === "success") {
        // Optimistically update conversation messages in state
        setConversations(prev =>
          prev.map(c => {
            if (c.id !== activeConversationId) return c
            const updatedMsgs = Array.isArray(c.messages) ? [...c.messages] : []
            updatedMsgs.push({
              role: "assistant",
              content,
              timestamp: new Date().toISOString(),
              sender: "human",
            })
            return {
              ...c,
              messages: updatedMsgs,
              status: "human", // Auto-change to human state
            }
          })
        )
      } else {
        toast.error("No se pudo enviar el mensaje.")
      }
    } catch (err) {
      toast.error("Error de red al enviar.")
    } finally {
      setSending(false)
    }
  }

  // Active Chat Computations
  const activeChat = conversations.find(c => c.id === activeConversationId)
  const messages = activeChat?.messages || []

  // Filters
  const filteredConversations = conversations.filter(c => {
    const matchesSearch =
      c.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      c.clientPhone.includes(search)
    
    if (statusFilter === "ALL") return matchesSearch
    if (statusFilter === "BOT") return matchesSearch && c.status === "active"
    if (statusFilter === "HUMAN") return matchesSearch && c.status === "human"
    if (statusFilter === "RESOLVED") return matchesSearch && c.status === "resolved"
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-red-500" />
            Consola de Conversaciones
          </h1>
          <p className="text-neutral-400 text-sm">
            Audita las interacciones del agente de IA y toma el control humano cuando sea necesario.
          </p>
        </div>
        <button
          onClick={fetchConversations}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white hover:bg-neutral-800 transition-all shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refrescar Chats
        </button>
      </div>

      {/* Main split-screen chats console layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 border border-neutral-800 rounded-3xl bg-neutral-950 overflow-hidden shadow-2xl h-[650px] items-stretch">
        
        {/* Left column (Chats list & Filters) */}
        <div className="md:col-span-1 border-r border-neutral-800/80 flex flex-col bg-neutral-900/10 min-w-0">
          {/* Search bar */}
          <div className="p-4 border-b border-neutral-800/60 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-600" />
              <input
                type="text"
                placeholder="Buscar por cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Segment status tabs filters */}
            <div className="flex gap-1 bg-neutral-950 p-1 border border-neutral-850 rounded-xl text-[10px]">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`flex-1 text-center py-1 rounded-lg font-medium transition-all ${
                  statusFilter === "ALL" ? "bg-neutral-800 text-white" : "text-neutral-500"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter("BOT")}
                className={`flex-1 text-center py-1 rounded-lg font-medium transition-all ${
                  statusFilter === "BOT" ? "bg-emerald-500/15 text-emerald-400" : "text-neutral-500"
                }`}
              >
                Bot
              </button>
              <button
                onClick={() => setStatusFilter("HUMAN")}
                className={`flex-1 text-center py-1 rounded-lg font-medium transition-all ${
                  statusFilter === "HUMAN" ? "bg-blue-500/15 text-blue-400" : "text-neutral-500"
                }`}
              >
                Humano
              </button>
            </div>
          </div>

          {/* Conversations scroll area */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-900 pr-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-500" />
                Cargando bandeja de entrada...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No hay chats correspondientes a este filtro.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const lastMsg = Array.isArray(conv.messages) && conv.messages.length > 0
                  ? conv.messages[conv.messages.length - 1]
                  : null
                
                const isActive = conv.id === activeConversationId

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`p-3.5 hover:bg-neutral-900/30 transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isActive ? "bg-neutral-900/50" : ""
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-white text-xs shrink-0">
                      {conv.customer.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-xs text-white truncate">
                          {conv.customer.name}
                        </p>
                        <span className="text-[9px] text-neutral-600 shrink-0">
                          {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-neutral-400 truncate">
                        {lastMsg ? lastMsg.content : "Iniciado chat..."}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${
                          conv.status === "human"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : conv.status === "resolved"
                            ? "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {conv.status === "human" ? "HUMANO" : conv.status === "resolved" ? "RESUELTO" : "BOT IA"}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Center Panel (Message Area) */}
        <div className="md:col-span-2 flex flex-col bg-neutral-950/40 relative">
          {activeChat ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-neutral-800/60 bg-neutral-900/30 flex items-center justify-between z-10">
                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-white truncate">{activeChat.customer.name}</h3>
                  <p className="text-[10px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                    {activeChat.status === "human" ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        Atendiendo en Control Humano (Bot en pausa)
                      </>
                    ) : activeChat.status === "resolved" ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                        Conversación Resuelta
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Agente de IA atendiendo automáticamente
                      </>
                    )}
                  </p>
                </div>

                {/* Status Toggles */}
                <div className="flex items-center gap-2">
                  {activeChat.status === "human" ? (
                    <button
                      onClick={() => handleStatusChange(activeChat.id, "active")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow transition-all"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Activar Bot
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(activeChat.id, "human")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold border border-neutral-800 transition-all"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      Tomar Control
                    </button>
                  )}
                  
                  {activeChat.status !== "resolved" && (
                    <button
                      onClick={() => handleStatusChange(activeChat.id, "resolved")}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
                      title="Marcar como resuelto"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages viewport */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500 italic">
                    Sin historial de mensajes en esta conversación.
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isUser = msg.role === "user"
                    const sentByHuman = msg.sender === "human"

                    return (
                      <div
                        key={index}
                        className={`flex flex-col ${isUser ? "items-start" : "items-end"}`}
                      >
                        <div
                          className={`max-w-[75%] p-3 rounded-2xl text-xs space-y-1 ${
                            isUser
                              ? "bg-neutral-900 text-white rounded-tl-none border border-neutral-850"
                              : sentByHuman
                              ? "bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-600/10"
                              : "bg-red-950/70 border border-red-900/30 text-white rounded-tr-none shadow-lg shadow-red-950/10"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <div className="flex items-center justify-end gap-1.5 text-[8px] opacity-60">
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isUser && (
                              <span className="font-semibold uppercase tracking-wider font-mono">
                                · {sentByHuman ? "Staff" : "BOT IA"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Messaging input pane */}
              <div className="p-4 border-t border-neutral-800/60 bg-neutral-900/10">
                {activeChat.status === "active" ? (
                  <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-center text-neutral-500 text-[10px] flex items-center justify-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>El Bot de IA está operando este chat. Haz click en <b>Tomar Control</b> para responder manualmente.</span>
                  </div>
                ) : activeChat.status === "resolved" ? (
                  <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-center text-neutral-500 text-[10px] flex items-center justify-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Esta conversación está resuelta. Cambia su estado para reabrirla.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <textarea
                      placeholder="Escribe un mensaje en nombre del staff para enviarlo a WhatsApp..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage(e)
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 resize-none h-10 min-h-[40px] max-h-[120px]"
                    />
                    <button
                      type="submit"
                      disabled={sending || !messageInput.trim()}
                      className="p-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-850 text-white disabled:text-neutral-500 shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition-all shrink-0 flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 space-y-2 text-xs text-neutral-500">
              <MessageSquare className="w-12 h-12 text-neutral-800" />
              <p className="text-white font-medium">Bandeja de entrada vacía</p>
              <p>Selecciona una conversación del menú izquierdo para auditar la charla.</p>
            </div>
          )}
        </div>

        {/* Right Sidebar Panel (Customer Profile context) */}
        <div className="md:col-span-1 border-t md:border-t-0 md:border-l border-neutral-800/80 bg-neutral-900/10 p-4 flex flex-col gap-4 overflow-y-auto">
          {activeChat ? (
            <div className="space-y-5 text-xs">
              {/* Contact info card */}
              <div className="space-y-3">
                <h4 className="font-bold text-[10px] text-neutral-500 uppercase tracking-wider">Detalles del Comensal</h4>
                <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-neutral-500 shrink-0" />
                    <span className="font-bold text-white truncate">{activeChat.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-neutral-500 shrink-0" />
                    <span className="text-neutral-400 font-mono select-all truncate">{activeChat.clientPhone}</span>
                  </div>
                  {activeChat.customer.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-neutral-500 shrink-0" />
                      <span className="text-neutral-400 truncate">{activeChat.customer.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Associated Booking info */}
              {activeChat.bookingId && (
                <div className="space-y-3">
                  <h4 className="font-bold text-[10px] text-neutral-500 uppercase tracking-wider">Reserva Activa</h4>
                  <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="font-semibold text-white">Reserva Asociada</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Código de reserva: <span className="font-mono text-white bg-neutral-900 px-1 py-0.5 rounded">{activeChat.bookingId.slice(0,8).toUpperCase()}</span>
                    </p>
                    <a
                      href={`/dashboard`}
                      className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 pt-1.5 group/link"
                    >
                      Ver en listado de reservas
                      <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                    </a>
                  </div>
                </div>
              )}

              {/* Bot Prompt Rules notice */}
              <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-850 text-[10px] text-neutral-500 leading-relaxed space-y-1.5">
                <span className="font-bold text-neutral-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Orquestación IA
                </span>
                <p>
                  El Agente de IA está programado para interactuar utilizando GPT-4o y cal.com. Lee disponibilidades y confirma agendas automáticamente en menos de 2 minutos.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-neutral-600 text-xs py-8">
              Sin perfil cargado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
