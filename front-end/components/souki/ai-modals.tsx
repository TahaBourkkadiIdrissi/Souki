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
  Minus,
  Plus,
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
  formatQuantity,
  generateSmartPanier,
  SmartBasketLine,
  SmartBasketProfile,
  SmartBasketResponse,
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
  isOrderLocked?: boolean
  orderLockMessage?: string
}

const AUDIO_TIMEOUT_MS = 15000
const MIN_AUDIO_BYTES = 5000
const personOptions = [1, 2, 3, 4, 5, 6, 7, 8]
const durationOptions = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const profileOptions: Array<{ id: SmartBasketProfile; label: string; helper: string }> = [
  { id: "equilibre", label: "Equilibre", helper: "Panier varie pour la semaine" },
  { id: "legumes_base", label: "Legumes de base", helper: "Essentiels du quotidien" },
  { id: "salade_fraicheur", label: "Salade fraicheur", helper: "Crudites et produits frais" },
  { id: "soupe_hiver", label: "Soupe hiver", helper: "Legumes pour soupes" },
  { id: "cuisine_tajine", label: "Cuisine tajine", helper: "Selection pour plats marocains" },
  { id: "cuisine_couscous", label: "Cuisine couscous", helper: "Profil couscous complet" },
  { id: "fruits_dominant", label: "Fruits dominant", helper: "Plus de fruits dans le panier" },
  { id: "legumes_verts", label: "Legumes verts", helper: "Produits verts et legers" },
  { id: "racines_tubercules", label: "Racines & tubercules", helper: "Pommes de terre, carottes..." },
  { id: "aromates_herbes", label: "Aromates & herbes", helper: "Menthe, persil, coriandre..." },
]

export function AIModals({
  isOpen,
  onClose,
  mode,
  products = [],
  isOrderLocked = false,
  orderLockMessage = "Les commandes sont fermees pour preparer les livraisons. Reouverture a 08h00.",
}: AIModalsProps) {
  const router = useRouter()
  const { token } = useAuth()

  const [isListening, setIsListening] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<VoiceBasketResponseDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [budget, setBudget] = useState("150")
  const [people, setPeople] = useState("3")
  const [duration, setDuration] = useState("7")
  const [profile, setProfile] = useState<SmartBasketProfile>("equilibre")
  const [smartResult, setSmartResult] = useState<SmartBasketResponse | null>(null)
  const [isGeneratingSmart, setIsGeneratingSmart] = useState(false)
  const [smartSelections, setSmartSelections] = useState<BasketSelection[]>([])
  const [editedBasket, setEditedBasket] = useState<LigneCommandeDTO[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timeoutRef = useRef<number | null>(null)

  const clearRecordingTimers = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  useEffect(() => {
    if (!isOpen) {
      resetState()
    }
  }, [isOpen])

  useEffect(() => {
    if (result) {
      setEditedBasket([...result.lignes_panier])
    }
  }, [result])

  const resetState = () => {
    clearRecordingTimers()
    setIsListening(false)
    setIsSending(false)
    setResult(null)
    setError(null)
    setSmartResult(null)
    setSmartSelections([])
    setEditedBasket([])
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }

  const closeModal = () => {
    resetState()
    onClose()
  }

  const handleRemoveItem = (productId: number) => {
    setEditedBasket((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(productId)
      return
    }
    setEditedBasket((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantite_effective: newQuantity,
              sous_total: item.prix_unitaire * newQuantity,
            }
          : item
      )
    )
  }

  const calculateEditedTotal = () => {
    return editedBasket.reduce((sum, item) => sum + item.sous_total, 0)
  }

  const calculateEditedArticles = () => {
    return editedBasket.length
  } // <-- J'AI AJOUTÉ CETTE ACCOLADE MANQUANTE

  const handleVoiceCheckout = () => {
    if (!result?.commande_id || editedBasket.length === 0) {
      return
    }

    const checkoutCart = editedBasket.map((line) => ({
      id: String(line.product_id),
      name: line.nom_produit,
      price: line.prix_unitaire,
      quantity: line.quantite_effective,
      unit: "kg",
    }))
    const encodedCart = encodeURIComponent(JSON.stringify(checkoutCart))

    closeModal()
    router.push(`/checkout?commande_id=${result.commande_id}&cart=${encodedCart}`)
  }

  const stopListening = () => {
    clearRecordingTimers()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setIsListening(false)
  }

  const handleVoiceInteraction = async () => {
    setError(null)
    setResult(null)

    if (isOrderLocked) {
      setError(orderLockMessage)
      return
    }

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
        clearRecordingTimers()
        stream.getTracks().forEach((track) => track.stop())
        setIsSending(true)

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          if (audioBlob.size < MIN_AUDIO_BYTES) {
            setError("Aucune voix detectee. Appuyez et parlez.")
            return
          }

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
      timeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop()
          setIsListening(false)
        }
      }, AUDIO_TIMEOUT_MS)
    } catch {
      clearRecordingTimers()
      setError("Microphone non autorise. Veuillez autoriser l'acces dans votre navigateur.")
    }
  }

  const handleSmartGeneration = async () => {
    const parsedBudget = Number(budget)
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setError("Entrez un budget valide pour generer le panier.")
      setSmartSelections([])
      setSmartResult(null)
      return
    }

    const parsedPeople = Number(people)
    const parsedDuration = Number(duration)
    if (!Number.isInteger(parsedPeople) || parsedPeople < 1 || parsedPeople > 8) {
      setError("Choisissez un nombre de personnes entre 1 et 8.")
      return
    }
    if (!Number.isInteger(parsedDuration) || parsedDuration < 3 || parsedDuration > 14) {
      setError("Choisissez une duree entre 3 et 14 jours.")
      return
    }
    if (!token) {
      setError("Connectez-vous d'abord pour generer un panier intelligent.")
      return
    }

    setIsGeneratingSmart(true)
    setError(null)
    setSmartResult(null)
    setSmartSelections([])
    try {
      const data = await generateSmartPanier(
        {
          budget: parsedBudget,
          personnes: parsedPeople,
          duree: parsedDuration,
          profil: profile,
        },
        token
      )
      setSmartResult(data)
      setSmartSelections(
        data.lignes_panier.map((line) => ({
          productId: line.product_id,
          quantity: line.quantite_kg,
        }))
      )
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Impossible de generer le panier intelligent."
      )
    } finally {
      setIsGeneratingSmart(false)
    }
  }

  const handleApplySmartBasket = () => {
    if (isOrderLocked) {
      setError(orderLockMessage)
      return
    }

    if (!smartResult || smartResult.lignes_panier.length === 0) {
      setError("Generez d'abord un panier intelligent.")
      return
    }

    const checkoutCart = smartResult.lignes_panier.map((line) => ({
      id: String(line.product_id),
      name: line.nom_produit,
      price: line.prix_unitaire,
      quantity: line.quantite_kg,
      unit: line.unite,
      image: line.image,
    }))
    const encodedCart = encodeURIComponent(JSON.stringify(checkoutCart))
    const panierQuery = smartResult.panier_id ? `&panier_id=${smartResult.panier_id}` : ""
    closeModal()
    router.push(`/checkout?source=smart${panierQuery}&cart=${encodedCart}`)
  }

  const smartPreview = (smartResult?.lignes_panier ?? []).map((line: SmartBasketLine) => {
    const product = products.find((item) => item.id === line.product_id)
    return {
      line,
      product,
      name: product?.name ?? line.nom_produit,
      unit: product?.unit ?? line.unite,
      quantity: line.quantite_kg,
      total: line.sous_total,
    }
  })

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

              {isOrderLocked && (
                <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-orange-400/30 bg-orange-400/10 p-3 text-xs font-semibold text-orange-200">
                  {orderLockMessage}
                </div>
              )}

              <button
                onClick={handleVoiceInteraction}
                disabled={isSending || isOrderLocked}
                className={cn(
                  "mx-auto mt-8 flex w-full max-w-[220px] flex-col items-center justify-center rounded-3xl bg-white/5 px-6 py-5 transition-all duration-300 hover:bg-white/10",
                  (isSending || isOrderLocked) && "cursor-not-allowed opacity-50"
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
                    Panier detecte ({calculateEditedArticles()} article
                    {calculateEditedArticles() !== 1 ? "s" : ""})
                  </h4>
                </div>

                {result.transcription && (
                  <p className="mb-3 rounded-xl bg-white/5 p-3 text-xs italic text-white/55">
                    &quot;{result.transcription}&quot;
                  </p>
                )}

                {editedBasket.length === 0 ? (
                  <div className="rounded-2xl bg-red-500/10 p-4 text-center text-sm text-red-300">
                    Aucun article dans le panier. Ajoutez des produits avant de continuer.
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {editedBasket.map((line) => {
                      const unit = line.quantite_effective >= 1 ? "kg" : "kg"
                      return (
                        <div
                          key={`${line.product_id}-${line.nom_produit}`}
                          className="rounded-2xl bg-white/5 p-3 transition-all hover:bg-white/8"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {line.nom_produit}
                              </p>
                              <p className="text-xs text-white/45 mt-1">
                                {line.prix_unitaire.toFixed(2)} DH / {unit}
                              </p>
                            </div>

                            <button
                              onClick={() => handleRemoveItem(line.product_id)}
                              className="shrink-0 rounded-full p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                              title="Supprimer le produit"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleUpdateQuantity(
                                  line.product_id,
                                  Math.max(0.25, line.quantite_effective - 0.25)
                                )
                              }
                              className="rounded-lg bg-white/10 p-1 hover:bg-white/20 transition-colors"
                            >
                              <Minus className="h-3 w-3 text-white" />
                            </button>

                            <input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={line.quantite_effective.toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value)
                                if (!isNaN(val) && val > 0) {
                                  handleUpdateQuantity(line.product_id, val)
                                }
                              }}
                              className="w-14 rounded-lg bg-white/10 px-2 py-1 text-center text-xs text-white outline-none focus:bg-white/20 transition-colors"
                            />

                            <button
                              onClick={() =>
                                handleUpdateQuantity(
                                  line.product_id,
                                  line.quantite_effective + 0.25
                                )
                              }
                              className="rounded-lg bg-white/10 p-1 hover:bg-white/20 transition-colors"
                            >
                              <Plus className="h-3 w-3 text-white" />
                            </button>

                            <span className="text-xs text-white/60 ml-2">
                              {line.quantite_effective.toFixed(2)} {unit}
                            </span>

                            <span className="ml-auto text-sm font-bold text-[#4CB84A]">
                              {line.sous_total.toFixed(2)} DH
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {result.produits_non_disponibles.length > 0 && (
                  <p className="mt-3 text-xs text-orange-300 rounded-xl bg-orange-500/10 p-2">
                    ⚠️ Non trouves: {result.produits_non_disponibles.join(", ")}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="font-semibold text-white/75">Total</span>
                  <span className="text-xl font-black text-[#4CB84A]">
                    {calculateEditedTotal().toFixed(2)} DH
                  </span>
                </div>

                <button
                  onClick={handleVoiceCheckout}
                  disabled={editedBasket.length === 0 || isOrderLocked}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-[#1E8A3C] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#176B2E] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isOrderLocked ? "Commandes fermees" : "Aller au checkout"}
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
                  <p className="text-xs text-[#6C7E6E]">Suggestion ML selon vos criteres</p>
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
                  Nombre de personnes
                </label>
                <div className="relative">
                  <select
                    value={people}
                    onChange={(event) => setPeople(event.target.value)}
                    className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-[#264129] outline-none transition-all focus:border-[#F07C00]"
                  >
                    {personOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} personne{option > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6C7E6E]" />
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
                    {durationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} jours
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6C7E6E]" />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-[#264129]">
                    Profil du panier
                  </label>
                  <span className="rounded-full bg-[#FFF5EB] px-3 py-1 text-xs font-bold text-[#C96A00]">
                    {profileOptions.length} profils
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {profileOptions.map((option) => {
                    const selected = profile === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setProfile(option.id)}
                        className={cn(
                          "min-h-[72px] rounded-2xl border p-3 text-left transition-all",
                          selected
                            ? "border-[#F07C00] bg-[#FFF5EB] shadow-sm"
                            : "border-gray-200 bg-gray-50 hover:border-[#F5D4AE] hover:bg-white"
                        )}
                        aria-pressed={selected}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-[#264129]">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-xs font-medium leading-4 text-[#6C7E6E]">
                              {option.helper}
                            </span>
                          </span>
                          {selected && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F07C00] text-white">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-[#FFF5EB] p-4 text-sm text-[#C96A00]">
                {isOrderLocked
                  ? orderLockMessage
                  : isGeneratingSmart
                    ? "Le modele compose votre panier. Cela peut prendre quelques secondes."
                    : "IA-SOUKI compose un panier avec le modele ML entraine sur les compositions SOUKI."}
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
                        key={item.line.product_id}
                        className="flex items-center justify-between rounded-2xl bg-white p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#264129]">{item.name}</p>
                          <p className="text-xs text-[#6C7E6E]">
                            {formatQuantity(item.quantity, item.unit)}
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
                  disabled={isGeneratingSmart || isOrderLocked}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-[#F5D4AE] bg-[#FFF5EB] px-4 py-3 font-semibold text-[#C96A00] transition-colors hover:bg-[#FFE8CC] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isGeneratingSmart ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {isGeneratingSmart ? "Generation..." : "Generer"}
                </button>
                <button
                  onClick={handleApplySmartBasket}
                  disabled={smartSelections.length === 0 || isOrderLocked || isGeneratingSmart}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white transition-colors",
                    smartSelections.length === 0 || isOrderLocked || isGeneratingSmart
                      ? "cursor-not-allowed bg-gray-300"
                      : "bg-[#F07C00] hover:bg-[#D66B00]"
                  )}
                >
                  {isOrderLocked ? "Commandes fermees" : "Aller au checkout"}
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
