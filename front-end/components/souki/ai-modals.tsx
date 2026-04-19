"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Mic,
  ShoppingCart,
  Sparkles,
  X,
  Zap,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"
import {
  BasketSelection,
  CatalogueProduct,
  buildSmartBasket,
  formatQuantity,
} from "@/lib/catalogue"
import { cn } from "@/lib/utils"

interface LigneCommandeDTO {
  product_id: number
  nom_produit: string
  quantite_demandee: number
  quantite_effective: number
  prix_unitaire: number
  sous_total: number
  message_ajustement?: string | null
}

interface VoiceBasketResponseDTO {
  status: string
  transcription?: string
  langue_detectee?: string
  produits_non_disponibles: string[]
  lignes_panier: LigneCommandeDTO[]
  total_dh: number
  nombre_articles: number
  commande_id?: number
}

interface AIModalsProps {
  isOpen: boolean
  onClose: () => void
  mode: "voice" | "smart" | null
  products?: CatalogueProduct[]
  onApplySelections?: (selections: BasketSelection[]) => void
}

export function AIModals({
  isOpen,
  onClose,
  mode,
  products = [],
  onApplySelections,
}: AIModalsProps) {
  const router = useRouter()
  const { token } = useAuth()

  const [isListening, setIsListening] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<VoiceBasketResponseDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [budget, setBudget] = useState("150")
  const [duration, setDuration] = useState("1 semaine")
  const [smartSelections, setSmartSelections] = useState<BasketSelection[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (!isOpen) {
      resetState()
    }
  }, [isOpen])

  const resetState = () => {
    setIsListening(false)
    setIsSending(false)
    setResult(null)
    setError(null)
    setSmartSelections([])
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }

  const closeModal = () => {
    resetState()
    onClose()
  }

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setIsListening(false)
  }

  const handleVoiceInteraction = async () => {
    setError(null)
    setResult(null)

    if (!token) {
      setError("Connectez-vous d'abord pour utiliser l'assistant vocal.")
      return
    }

    if (isListening) {
      stopListening()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const options =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
          ? { mimeType: "audio/webm" }
          : undefined
      const mediaRecorder = new MediaRecorder(stream, options)

      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setIsSending(true)

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          const formData = new FormData()
          formData.append("audio", audioBlob, "enregistrement.webm")

          const response = await fetch(`${API_BASE_URL}/api/voice-basket`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}))
            throw new Error(payload.detail || "Erreur lors du traitement vocal.")
          }

          const data = (await response.json()) as VoiceBasketResponseDTO
          setResult(data)
        } catch (voiceError) {
          setError(
            voiceError instanceof Error
              ? voiceError.message
              : "Impossible de contacter l'assistant vocal."
          )
        } finally {
          setIsSending(false)
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsListening(true)
    } catch {
      setError("Microphone non autorise. Veuillez autoriser l'acces dans votre navigateur.")
    }
  }

  const handleSmartGeneration = () => {
    const parsedBudget = Number(budget)
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setError("Entrez un budget valide pour generer le panier.")
      setSmartSelections([])
      return
    }

    const selections = buildSmartBasket(products, parsedBudget, duration)
    setSmartSelections(selections)
    setError(null)
  }

  const handleApplySmartBasket = () => {
    if (smartSelections.length === 0) {
      setError("Generez d'abord un panier intelligent.")
      return
    }
    onApplySelections?.(smartSelections)
    closeModal()
  }

  const smartPreview = smartSelections
    .map((selection) => {
      const product = products.find((item) => item.id === selection.productId)
      if (!product) {
        return null
      }
      return {
        product,
        quantity: selection.quantity,
        total: product.price * selection.quantity,
      }
    })
    .filter(
      (
        item
      ): item is { product: CatalogueProduct; quantity: number; total: number } => item !== null
    )

  if (!isOpen || !mode) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />

      <div
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200",
          mode === "voice" ? "bg-[#111116] text-white" : "bg-white text-[#264129]"
        )}
      >
        {mode === "voice" && (
          <div className="flex max-h-[90vh] flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1E8A3C]/30 bg-gradient-to-br from-[#1E8A3C]/10 to-transparent">
                  <Sparkles className="h-5 w-5 text-[#4CB84A]" />
                </div>
                <div>
                  <span className="text-lg font-bold">IA-SOUKI Vocal</span>
                  <p className="text-xs text-white/60">
                    {isSending
                      ? "Analyse en cours..."
                      : isListening
                        ? "Je vous ecoute..."
                        : "Pret a ecouter"}
                  </p>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="rounded-full bg-white/5 p-2 text-white/50 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/10 py-12 text-center">
              <div
                className={cn(
                  "mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full transition-all duration-700",
                  isSending
                    ? "bg-gradient-to-tr from-[#F07C00] to-[#FF9421] shadow-[0_0_30px_#F07C00]"
                    : isListening
                      ? "bg-gradient-to-tr from-[#1E8A3C] to-[#4CB84A] shadow-[0_0_30px_#1E8A3C]"
                      : "bg-white/10"
                )}
              >
                {isSending ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Mic className="h-6 w-6 text-white" />
                )}
              </div>

              <div className="flex h-8 items-center justify-center gap-1">
                {Array.from({ length: 15 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "w-1.5 rounded-full bg-white/20 transition-all duration-300",
                      isListening ? "animate-pulse" : "h-2"
                    )}
                    style={{
                      height: isListening ? `${Math.max(8, ((index % 5) + 1) * 6)}px` : "8px",
                      animationDelay: `${index * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="p-6 text-center">
              <p className="text-sm font-medium text-white/85">
                {isSending
                  ? "IA-SOUKI analyse votre commande..."
                  : isListening
                    ? "Parlez maintenant puis recliquez pour arreter."
                    : "Appuyez sur le micro et decrivez votre panier."}
              </p>
              <p className="mt-2 text-[11px] text-white/45">
                Darija et francais pris en charge.
              </p>

              <button
                onClick={handleVoiceInteraction}
                disabled={isSending}
                className={cn(
                  "mx-auto mt-8 flex w-full max-w-[220px] flex-col items-center justify-center rounded-3xl bg-white/5 px-6 py-5 transition-all duration-300 hover:bg-white/10",
                  isSending && "cursor-not-allowed opacity-50"
                )}
              >
                <div
                  className={cn(
                    "mb-3 flex h-16 w-16 items-center justify-center rounded-full",
                    isListening
                      ? "bg-gradient-to-tr from-[#1E8A3C] to-[#4CB84A]"
                      : "bg-gradient-to-tr from-[#1E8A3C]/50 to-[#4CB84A]/50"
                  )}
                >
                  <Mic className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-white/70">
                  {isSending ? "Traitement..." : isListening ? "Arreter" : "Commencer a parler"}
                </span>
              </button>
            </div>

            {error && (
              <div className="mx-6 mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="mx-6 mb-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-[#4CB84A]">
                  <ShoppingCart className="h-4 w-4" />
                  <h4 className="text-sm font-bold">
                    Panier detecte ({result.nombre_articles} article
                    {result.nombre_articles > 1 ? "s" : ""})
                  </h4>
                </div>

                {result.transcription && (
                  <p className="mb-3 rounded-xl bg-white/5 p-3 text-xs italic text-white/55">
                    "{result.transcription}"
                  </p>
                )}

                <div className="space-y-2">
                  {result.lignes_panier.map((line) => (
                    <div
                      key={`${line.product_id}-${line.nom_produit}`}
                      className="flex items-center justify-between rounded-2xl bg-white/5 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{line.nom_produit}</p>
                        <p className="text-xs text-white/45">
                          {formatQuantity(line.quantite_effective, "kg")} x{" "}
                          {line.prix_unitaire.toFixed(2)} DH
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#4CB84A]">
                        {line.sous_total.toFixed(2)} DH
                      </span>
                    </div>
                  ))}
                </div>

                {result.produits_non_disponibles.length > 0 && (
                  <p className="mt-3 text-xs text-orange-300">
                    Non trouves: {result.produits_non_disponibles.join(", ")}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="font-semibold text-white/75">Total</span>
                  <span className="text-xl font-black text-[#4CB84A]">
                    {result.total_dh.toFixed(2)} DH
                  </span>
                </div>

                <button
                  onClick={() => {
                    closeModal()
                    router.push(`/checkout?commande_id=${result.commande_id}`)
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E8A3C] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#176B2E]"
                >
                  Aller au checkout
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {mode === "smart" && (
          <div className="flex max-h-[90vh] flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F07C00] to-[#FF9421] text-white shadow-lg shadow-orange-500/20">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#264129]">Panier Intelligent IA-SOUKI</h3>
                  <p className="text-xs text-[#6C7E6E]">Suggestion basee sur votre budget</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#264129]">
                  Quel est votre budget ?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-14 text-[#264129] outline-none transition-all focus:border-[#F07C00]"
                    placeholder="Ex: 150"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6C7E6E]">
                    DH
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#264129]">
                  Pour quelle duree ?
                </label>
                <div className="relative">
                  <select
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                    className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-[#264129] outline-none transition-all focus:border-[#F07C00]"
                  >
                    <option value="3 jours">3 jours</option>
                    <option value="1 semaine">1 semaine</option>
                    <option value="2 semaines">2 semaines</option>
                    <option value="1 mois">1 mois</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6C7E6E]" />
                </div>
              </div>

              <div className="rounded-2xl bg-[#FFF5EB] p-4 text-sm text-[#C96A00]">
                IA-SOUKI compose un panier simple avec les produits les plus utiles du jour
                selon votre budget.
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {error}
                </div>
              )}

              {smartPreview.length > 0 && (
                <div className="rounded-3xl border border-[#F3E2CE] bg-[#FFFBF7] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[#C96A00]">
                    <Check className="h-4 w-4" />
                    <h4 className="text-sm font-bold">Panier suggere</h4>
                  </div>
                  <div className="space-y-2">
                    {smartPreview.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between rounded-2xl bg-white p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#264129]">{item.product.name}</p>
                          <p className="text-xs text-[#6C7E6E]">
                            {formatQuantity(item.quantity, item.product.unit)}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[#F07C00]">
                          {item.total.toFixed(2)} DH
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto border-t border-gray-100 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={handleSmartGeneration}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-[#F5D4AE] bg-[#FFF5EB] px-4 py-3 font-semibold text-[#C96A00] transition-colors hover:bg-[#FFE8CC]"
                >
                  <Zap className="h-4 w-4" />
                  Generer
                </button>
                <button
                  onClick={handleApplySmartBasket}
                  disabled={smartSelections.length === 0}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white transition-colors",
                    smartSelections.length === 0
                      ? "cursor-not-allowed bg-gray-300"
                      : "bg-[#F07C00] hover:bg-[#D66B00]"
                  )}
                >
                  Ajouter au panier
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
