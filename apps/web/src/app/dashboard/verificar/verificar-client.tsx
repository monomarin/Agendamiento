"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ScanQrCode, Search, CheckCircle2, XCircle, AlertCircle, Loader2,
  Users, CalendarDays, Clock, User, Phone, Mail, ClipboardList, RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface BookingDetails {
  id: string
  confirmationCode: string | null
  dateTime: string
  partySize: number
  specialRequests: string | null
  status: string
  customer: {
    name: string
    email: string
    phone: string | null
  }
  branchName: string
  restaurantName: string
  restaurantSlug: string
  tableTypeName: string
}

declare global {
  interface Window {
    jsQR: any
  }
}

export default function VerificarClient({ restaurantId }: { restaurantId: string }) {
  const [activeTab, setActiveTab] = React.useState<"scanner" | "manual">("scanner")
  const [code, setCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [booking, setBooking] = React.useState<BookingDetails | null>(null)

  // Scanner states
  const [scanning, setScanning] = React.useState(false)
  const [scannerError, setScannerError] = React.useState<string | null>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const animationFrameId = React.useRef<number | null>(null)
  const [jsqrLoaded, setJsqrLoaded] = React.useState(false)

  // Load jsQR dynamically
  React.useEffect(() => {
    if (window.jsQR) {
      setJsqrLoaded(true)
      return
    }
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"
    script.async = true
    script.onload = () => setJsqrLoaded(true)
    document.body.appendChild(script)

    return () => {
      // clean up if necessary, but scripts can persist
    }
  }, [])

  // Start/Stop camera depending on scanner tab status
  React.useEffect(() => {
    if (activeTab === "scanner" && jsqrLoaded && scanning) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [activeTab, jsqrLoaded, scanning])

  const startCamera = async () => {
    setScannerError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute("playsinline", "true") // required for iOS
        videoRef.current.play()
        animationFrameId.current = requestAnimationFrame(tick)
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err)
      setScannerError("No se pudo acceder a la cámara. Por favor otorga permisos o usa la búsqueda manual.")
      setScanning(false)
    }
  }

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }

  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")
      if (context) {
        canvas.height = videoRef.current.videoHeight
        canvas.width = videoRef.current.videoWidth
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        
        if (window.jsQR) {
          const codeResult = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          })

          if (codeResult) {
            // Found a QR code! Let's parse it
            const dataUrl = codeResult.data
            console.log("QR Code Scanned:", dataUrl)
            
            // Try to extract ref (bookingId) or code
            try {
              const urlObj = new URL(dataUrl)
              const refId = urlObj.searchParams.get("ref")
              const codeParam = urlObj.searchParams.get("code")
              
              if (refId) {
                stopCamera()
                setScanning(false)
                fetchBooking(refId, null)
                return
              } else if (codeParam) {
                stopCamera()
                setScanning(false)
                fetchBooking(null, codeParam)
                return
              } else {
                // Check if the path ends with a UUID
                const segments = urlObj.pathname.split("/")
                const lastSegment = segments[segments.length - 1]
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                if (uuidRegex.test(lastSegment)) {
                  stopCamera()
                  setScanning(false)
                  fetchBooking(lastSegment, null)
                  return
                }
              }
            } catch (e) {
              // Not a valid URL. Let's parse structured text details or fallback
              const urlMatch = dataUrl.match(/Enlace de Verificaci[oó]n:\s*(https?:\/\/[^\s]+)/)
              const codeMatch = dataUrl.match(/Reserva:\s*([^\s\n]+)/)
              
              if (urlMatch) {
                try {
                  const urlObj = new URL(urlMatch[1])
                  const refId = urlObj.searchParams.get("ref")
                  if (refId) {
                    stopCamera()
                    setScanning(false)
                    fetchBooking(refId, null)
                    return
                  }
                } catch (_) {}
              }
              
              if (codeMatch) {
                stopCamera()
                setScanning(false)
                fetchBooking(null, codeMatch[1].trim())
                return
              }

              // Fallback: check for UUID or raw code format
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
              if (uuidRegex.test(dataUrl.trim())) {
                stopCamera()
                setScanning(false)
                fetchBooking(dataUrl.trim(), null)
                return
              } else if (dataUrl.trim().length >= 6 && dataUrl.trim().length <= 15) {
                stopCamera()
                setScanning(false)
                fetchBooking(null, dataUrl.trim())
                return
              }
            }
          }  // end if (codeResult)
        }  // end if (window.jsQR)
      }  // end if (context)
    }  // end if (videoRef...)
    if (scanning) {
      animationFrameId.current = requestAnimationFrame(tick)
    }
  }

  const fetchBooking = async (id: string | null, codeStr: string | null) => {
    setLoading(true)
    setError(null)
    setBooking(null)
    
    try {
      const query = id ? `id=${id}` : `code=${encodeURIComponent(codeStr || "")}`
      const res = await fetch(`/api/bookings/lookup?${query}`)
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "No se pudo encontrar la reserva")
      }
      
      setBooking(data.data)
    } catch (err: any) {
      setError(err.message || "Error al buscar la reserva")
    } finally {
      setLoading(false)
    }
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    fetchBooking(null, code.trim())
  }

  const handleUpdateStatus = async (newStatus: "CHECKED_IN" | "NO_SHOW") => {
    if (!booking) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/dashboard/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar la reserva")
      }
      
      // Update local state
      setBooking(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (err: any) {
      alert(err.message || "Error al actualizar el estado")
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONFIRMED":
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Confirmada ✅</span>
      case "CHECKED_IN":
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Ingresado 🚪</span>
      case "NO_SHOW":
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">Inasistencia (No Show) ❌</span>
      case "CANCELLED":
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Cancelada 🚫</span>
      default:
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-neutral-700 text-neutral-300">{status}</span>
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="p-2 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20">
            <ScanQrCode className="w-7 h-7 animate-pulse" />
          </span>
          Verificar Reservas
        </h1>
        <p className="text-sm text-neutral-400 mt-2">
          Escanea el código QR del cliente o busca su código de confirmación de 8 caracteres.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => {
            setActiveTab("scanner")
            setBooking(null)
            setError(null)
          }}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "scanner"
              ? "border-red-600 text-white"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <ScanQrCode className="w-4 h-4" />
          Escanear Código QR
        </button>
        <button
          onClick={() => {
            setActiveTab("manual")
            setBooking(null)
            setError(null)
            stopCamera()
            setScanning(false)
          }}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "manual"
              ? "border-red-600 text-white"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Search className="w-4 h-4" />
          Búsqueda Manual
        </button>
      </div>

      {/* Content Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          {activeTab === "scanner" && (
            <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-4 flex flex-col items-center">
              <h2 className="font-semibold text-white self-start">Lector QR de Cámara</h2>
              
              {!jsqrLoaded ? (
                <div className="flex flex-col items-center justify-center p-12 text-neutral-500 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                  <p className="text-xs text-center">Cargando motor de escaneo...</p>
                </div>
              ) : !scanning ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4 w-full">
                  <div className="w-36 h-36 rounded-2xl bg-neutral-950 border border-dashed border-neutral-800 flex items-center justify-center text-neutral-600">
                    <ScanQrCode className="w-12 h-12" />
                  </div>
                  <Button
                    onClick={() => {
                      setScanning(true)
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-red-900/10"
                  >
                    Encender Cámara
                  </Button>
                </div>
              ) : (
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-neutral-800 max-w-[280px]">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Scanning Overlay Lines */}
                  <div className="absolute inset-x-6 top-1/2 h-0.5 bg-red-500 shadow-md shadow-red-500/80 animate-[bounce_2s_infinite]" />
                  <div className="absolute inset-0 border-[3px] border-red-600/30 rounded-2xl pointer-events-none" />
                  
                  <button
                    onClick={() => {
                      setScanning(false)
                      stopCamera()
                    }}
                    className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/80 hover:bg-black text-[10px] text-white font-bold rounded-lg border border-neutral-700"
                  >
                    Apagar
                  </button>
                </div>
              )}

              {scannerError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scannerError}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "manual" && (
            <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-4">
              <h2 className="font-semibold text-white">Ingresar Código</h2>
              
              <form onSubmit={handleManualSearch} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Código de Confirmación</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ej. G8SZMUT3"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-red-600 uppercase font-mono tracking-widest text-center"
                    maxLength={15}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!code.trim() || loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Buscar Reserva"
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="md:col-span-2 space-y-4">
          {loading && (
            <div className="p-12 border border-neutral-800 bg-neutral-900/20 rounded-2xl flex flex-col items-center justify-center space-y-3 text-neutral-400">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              <p className="text-sm">Buscando detalles de la reserva...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-8 border border-red-500/20 bg-red-500/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
              <XCircle className="w-12 h-12 text-red-500" />
              <h3 className="font-bold text-white text-lg">Reserva No Encontrada</h3>
              <p className="text-sm text-neutral-400 max-w-sm">
                {error}. Verifica que el código sea correcto e inténtalo de nuevo.
              </p>
              {activeTab === "manual" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    setCode("")
                  }}
                  className="border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:bg-neutral-800"
                >
                  Reintentar
                </Button>
              )}
            </div>
          )}

          {!booking && !loading && !error && (
            <div className="p-12 border border-neutral-800 bg-neutral-900/20 rounded-2xl text-center space-y-3 text-neutral-500">
              <ClipboardList className="w-12 h-12 mx-auto text-neutral-700" />
              <h3 className="font-semibold text-white">Esperando Reserva</h3>
              <p className="text-sm max-w-xs mx-auto">
                {activeTab === "scanner"
                  ? "Apunta la cámara del celular al código QR de la confirmación del cliente."
                  : "Ingresa el código alfanumérico para ver los detalles del evento."}
              </p>
            </div>
          )}

          {booking && !loading && !error && (
            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-6">
              {/* Header Status & Code */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold block">Código de Reserva</span>
                  <span className="text-2xl font-mono font-bold text-white tracking-widest">{booking.confirmationCode || "S/N"}</span>
                </div>
                <div>
                  {getStatusBadge(booking.status)}
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Section Left: What, When, Where */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Información del Evento</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CalendarDays className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-neutral-500 block">Fecha</span>
                        <span className="text-sm text-white font-medium capitalize">
                          {format(new Date(booking.dateTime), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-neutral-500 block">Hora</span>
                        <span className="text-sm text-white font-medium">
                          {format(new Date(booking.dateTime), "HH:mm 'hs'", { locale: es })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-neutral-500 block">Cantidad de Asistentes</span>
                        <span className="text-sm text-white font-medium">
                          {booking.partySize} {booking.partySize === 1 ? "persona" : "personas"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <ClipboardList className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-neutral-500 block">Detalles / Evento</span>
                        <span className="text-sm text-white font-medium">
                          {booking.specialRequests || "Reserva estándar"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Right: Customer Data */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Datos del Cliente</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-neutral-500 block">Nombre del Cliente</span>
                        <span className="text-sm text-white font-medium">{booking.customer.name}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-neutral-500 block">Correo Electrónico</span>
                        <span className="text-sm text-neutral-400 break-all">{booking.customer.email}</span>
                      </div>
                    </div>

                    {booking.customer.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs text-neutral-500 block">Teléfono / WhatsApp</span>
                          <span className="text-sm text-white font-medium">{booking.customer.phone}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded bg-neutral-800 text-neutral-500 text-[10px] font-bold flex items-center justify-center shrink-0">📍</div>
                      <div>
                        <span className="text-xs text-neutral-500 block">Mesa y Sede</span>
                        <span className="text-sm text-white font-medium">{booking.tableTypeName} · Sede: {booking.branchName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Action Buttons (Check-in / No Show) */}
              <div className="pt-6 border-t border-neutral-800 flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <Button
                    onClick={() => {
                      setBooking(null)
                      setError(null)
                      setCode("")
                      if (activeTab === "scanner") {
                        setScanning(true)
                      }
                    }}
                    variant="outline"
                    className="border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Verificar otra
                  </Button>
                </div>

                {booking.status.toUpperCase() === "CONFIRMED" && (
                  <div className="flex gap-3">
                    <Button
                      id="btn-no-show"
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus("NO_SHOW")}
                      variant="outline"
                      className="border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-semibold px-4 py-2"
                    >
                      Inasistencia (No Show)
                    </Button>
                    <Button
                      id="btn-check-in"
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus("CHECKED_IN")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 shadow-lg shadow-emerald-950/20"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Registrar Llegada"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
