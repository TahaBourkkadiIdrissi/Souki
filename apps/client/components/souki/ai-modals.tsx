"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  X,
  Zap,
} from "lucide-react"

import { CartLoadingAnimation } from "@/components/cart/CartLoadingAnimation"
import { SoukiSelect, type SoukiSelectOption } from "@/components/souki/souki-select"
import { VoiceOrb, type VoiceOrbPhase } from "@/components/souki/voice-orb"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"
import {
  BasketSelection,
  CatalogueProduct,
  DishSummary,
  fetchDishList,
  formatQuantity,
  generateSmartPanier,
  SmartBasketLine,
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
// Génération via Groq (rapide, ~1-3 s). ETA affiché quand la barre atteint 100 %
// avant que la réponse n'arrive — évite l'impression de gel.
const SMART_GENERATION_ETA_SECONDS = 8
const EQUILIBRE_VALUE = "equilibre"
const personOptions = [1, 2, 3, 4, 5, 6, 7, 8]
const durationOptions = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

const personSelectOptions: SoukiSelectOption[] = personOptions.map((option) => ({
  value: String(option),
  label: `${option} personne${option > 1 ? "s" : ""}`,
}))
const durationSelectOptions: SoukiSelectOption[] = durationOptions.map((option) => ({
  value: String(option),
  label: `${option} jours`,
}))

const dishCategoryLabels: Record<string, string> = {
  tajine: "Tajines",
  couscous: "Couscous",
  soupe: "Soupes",
  salade: "Salades",
  jus: "Jus & boissons",
  plat_mijote: "Plats mijotes",
  grillade: "Grillades",
  poisson: "Poissons",
  pain_patisserie: "Pains & patisseries",
  autre: "Autres",
}

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
  // Sélection unique: "equilibre" (panier auto) ou un dish_id de plat marocain.
  const [selectedPlat, setSelectedPlat] = useState<string>(EQUILIBRE_VALUE)
  const [smartResult, setSmartResult] = useState<SmartBasketResponse | null>(null)
  const [isGeneratingSmart, setIsGeneratingSmart] = useState(false)
  const [dishes, setDishes] = useState<DishSummary[]>([])
  const [cartProgress, setCartProgress] = useState(0)
  // Secondes restantes estimées, affichées quand la barre atteint 100 % alors que
  // la génération ML tourne encore (~26 s à froid) — évite l'impression de gel.
  const [smartEta, setSmartEta] = useState<number | null>(null)
  const [smartSelections, setSmartSelections] = useState<BasketSelection[]>([])
  const [editedBasket, setEditedBasket] = useState<LigneCommandeDTO[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timeoutRef = useRef<number | null>(null)
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null)

  // Derived phase that drives the reactive orb + transitions.
  const orbPhase: VoiceOrbPhase = isSending ? "processing" : isListening ? "listening" : "idle"

  // Charge la liste des plats marocains a l'ouverture du panier intelligent.
  useEffect(() => {
    if (!isOpen || mode !== "smart" || !token || dishes.length > 0) return
    fetchDishList(token)
      .then(setDishes)
      .catch(() => setDishes([]))
  }, [isOpen, mode, token, dishes.length])

  // Un plat est un repas unique: la durée en jours ne s'applique qu'au panier
  // équilibré (approvisionnement sur plusieurs jours).
  const isDishSelected = selectedPlat !== EQUILIBRE_VALUE

  // Sélecteur unifié: "Équilibré" en tête, puis les plats groupés par catégorie
  // (le nom darija en sous-titre). La génération passe toujours par l'IA Groq.
  const platOptions: SoukiSelectOption[] = [
    {
      value: EQUILIBRE_VALUE,
      label: "Équilibré",
      subtitle: "Tous fruits & légumes variés",
      group: "Panier automatique",
    },
    ...Object.entries(dishCategoryLabels).flatMap(([category, label]) =>
      dishes
        .filter((dish) => dish.category === category)
        .map((dish) => ({
          value: dish.dish_id,
          label: dish.name_fr,
          subtitle: dish.name_darija,
          group: label,
        }))
    ),
  ]

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
    setSelectedPlat(EQUILIBRE_VALUE)
    setCartProgress(0)
    setSmartEta(null)
    setVoiceStream(null)
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

  // Light haptic feedback on supported mobile devices (progressive enhancement).
  const haptic = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern)
    }
  }

  const stopListening = () => {
    clearRecordingTimers()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setIsListening(false)
    haptic(12)
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
      setVoiceStream(stream)
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
        setVoiceStream(null)
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
            // Le JWT reel vit dans le cookie httpOnly : il faut l'envoyer.
            // (token vaut ici le sentinelle "cookie-session", non decodable cote back ;
            // le backend privilegie le cookie.)
            credentials: "include",
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
      haptic([8, 30, 8])
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
    // Pour un plat, le budget est ignoré (quantités selon le nombre de personnes):
    // on envoie une valeur neutre haute pour ne jamais contraindre la composition.
    const effectiveBudget = isDishSelected ? 5000 : parsedBudget
    if (!isDishSelected && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
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
    setCartProgress(0)
    setError(null)
    setSmartResult(null)
    setSmartSelections([])

    // Simulate incremental progress while the API call is in flight.
    // Progress rises quickly to ~85 % then slows, so the last jump to 100 %
    // feels satisfying when the call resolves.
    const progressIntervalId = window.setInterval(() => {
      setCartProgress((prev) => {
        if (prev >= 85) return prev + 0.5   // slow crawl near the end
        return prev + 3                      // fast progress at the start
      })
    }, 120)

    // Compte à rebours estimé : quand la barre plafonne à 100 % alors que le
    // modèle ML calcule encore, on affiche le temps restant au lieu d'un écran figé.
    const generationStartedAt = Date.now()
    setSmartEta(SMART_GENERATION_ETA_SECONDS)
    const etaIntervalId = window.setInterval(() => {
      const elapsedSeconds = (Date.now() - generationStartedAt) / 1000
      setSmartEta(Math.max(0, Math.ceil(SMART_GENERATION_ETA_SECONDS - elapsedSeconds)))
    }, 1000)

    try {
      const data = await generateSmartPanier(
        {
          budget: effectiveBudget,
          personnes: parsedPeople,
          duree: parsedDuration,
          plat: selectedPlat,
        },
        token
      )
      // Jump to 100 % to signal completion (le compte à rebours disparaît : terminé)
      window.clearInterval(progressIntervalId)
      window.clearInterval(etaIntervalId)
      setSmartEta(null)
      setCartProgress(100)
      // Small delay so the user sees 100 % before the result renders
      await new Promise((resolve) => window.setTimeout(resolve, 800))

      setSmartResult(data)
      setSmartSelections(
        data.lignes_panier.map((line) => ({
          productId: line.product_id,
          quantity: line.quantite_kg,
        }))
      )

      // Auto redirect to checkout
      const checkoutCart = data.lignes_panier.map((line) => ({
        id: String(line.product_id),
        name: line.nom_produit,
        price: line.prix_unitaire,
        quantity: line.quantite_kg,
        unit: line.unite,
        image: line.image,
      }))
      const encodedCart = encodeURIComponent(JSON.stringify(checkoutCart))
      const panierQuery = data.panier_id ? `&panier_id=${data.panier_id}` : ""
      closeModal()
      router.push(`/checkout?source=smart${panierQuery}&cart=${encodedCart}`)
    } catch (generationError) {
      window.clearInterval(progressIntervalId)
      window.clearInterval(etaIntervalId)
      setSmartEta(null)
      setCartProgress(0)
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
          mode === "voice"
            ? "bg-[radial-gradient(circle_at_50%_28%,#1d2630_0%,#11131a_45%,#070709_100%)] text-white"
            : "bg-white text-[#264129]"
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

            <div className="relative flex flex-col items-center border-b border-white/10 px-6 pb-8 pt-10">
              {/* The orb itself is the control: tap to start, tap again to stop. */}
              <button
                type="button"
                onClick={handleVoiceInteraction}
                disabled={isSending || isOrderLocked}
                aria-label={isListening ? "Arreter l'ecoute" : "Commencer a parler"}
                className={cn(
                  "group relative rounded-full outline-none transition-transform duration-200 active:scale-95",
                  (isSending || isOrderLocked) ? "cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"
                )}
              >
                <VoiceOrb phase={orbPhase} stream={voiceStream} size={220} />
              </button>

              {/* Dynamic status pill — tells the user what the system is doing */}
              <div
                className={cn(
                  "mt-5 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-500",
                  isSending
                    ? "bg-[#4CB84A]/15 text-[#7FE07C]"
                    : isListening
                      ? "bg-[#4CB84A]/10 text-[#9BE99A]"
                      : "bg-white/5 text-white/50"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isSending
                      ? "animate-pulse bg-[#4CB84A]"
                      : isListening
                        ? "animate-ping bg-[#4CB84A]"
                        : "bg-white/40"
                  )}
                />
                {isSending
                  ? "Composition du panier…"
                  : isListening
                    ? "À l'écoute — touchez la sphère pour arrêter"
                    : "Touchez la sphère pour parler"}
              </div>

              <p className="mt-2 text-[11px] text-white/40">
                Darija et français pris en charge.
              </p>

              {isOrderLocked && (
                <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-orange-400/30 bg-orange-400/10 p-3 text-xs font-semibold text-orange-200">
                  {orderLockMessage}
                </div>
              )}
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
              <div className="mx-6 mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 animate-slide-in-up">
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
                    {editedBasket.map((line, lineIndex) => {
                      const unit = line.quantite_effective >= 1 ? "kg" : "kg"
                      return (
                        <div
                          key={`${line.product_id}-${line.nom_produit}`}
                          className="rounded-2xl bg-white/5 p-3 transition-all hover:bg-white/8 animate-cascade"
                          style={{ "--cascade-i": lineIndex } as CSSProperties}
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
            {/* ── Cart-loading animation overlay ── */}
            {isGeneratingSmart && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-3xl bg-white/95 backdrop-blur-sm">
                <CartLoadingAnimation progress={cartProgress} remainingSeconds={smartEta} />
              </div>
            )}
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
                <label
                  className={cn(
                    "mb-2 block text-sm font-semibold",
                    isDishSelected ? "text-[#9AA79B]" : "text-[#264129]"
                  )}
                >
                  Quel est votre budget ?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    disabled={isDishSelected}
                    className={cn(
                      "w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-14 text-[#264129] outline-none transition-all focus:border-[#F07C00]",
                      isDishSelected && "cursor-not-allowed opacity-60"
                    )}
                    placeholder="Ex: 150"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6C7E6E]">
                    DH
                  </span>
                </div>
                {isDishSelected && (
                  <p className="mt-1 text-[11px] text-[#9AA79B]">
                    Non applicable pour un plat — quantites selon le nombre de personnes
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#264129]">
                    Personnes
                  </label>
                  <SoukiSelect
                    value={people}
                    onChange={setPeople}
                    options={personSelectOptions}
                    ariaLabel="Nombre de personnes"
                  />
                </div>

                <div>
                  <label
                    className={cn(
                      "mb-2 block text-sm font-semibold",
                      isDishSelected ? "text-[#9AA79B]" : "text-[#264129]"
                    )}
                  >
                    Duree
                  </label>
                  <SoukiSelect
                    value={duration}
                    onChange={setDuration}
                    options={durationSelectOptions}
                    disabled={isDishSelected}
                    ariaLabel="Duree du panier"
                  />
                  {isDishSelected && (
                    <p className="mt-1 text-[11px] text-[#9AA79B]">Non applicable pour un plat</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-[#264129]">
                    Que voulez-vous preparer ?
                  </label>
                  {dishes.length > 0 && (
                    <span className="rounded-full bg-[#FFF5EB] px-3 py-1 text-xs font-bold text-[#C96A00]">
                      {dishes.length} plats
                    </span>
                  )}
                </div>
                <SoukiSelect
                  value={selectedPlat}
                  onChange={setSelectedPlat}
                  options={platOptions}
                  loading={dishes.length === 0}
                  ariaLabel="Choix du panier ou du plat marocain"
                  leadingIcon={<Sparkles className="h-4 w-4" />}
                />
                <p className="mt-2 text-xs text-[#6C7E6E]">
                  {selectedPlat === EQUILIBRE_VALUE
                    ? "Panier equilibre : l'IA choisit des fruits & legumes varies selon vos criteres."
                    : "L'IA compose le panier autour de ce plat, adapte aux personnes, a la duree et au budget."}
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF5EB] p-4 text-sm text-[#C96A00]">
                {isOrderLocked
                  ? orderLockMessage
                  : isGeneratingSmart
                    ? (
                      <div className="space-y-3">
                        <p className="font-semibold">Generation de votre panier en cours...</p>
                        <div className="h-4 w-full overflow-hidden rounded-full bg-[#FFE8CC]">
                          <div
                            className="h-full bg-[#F07C00] transition-all duration-300 ease-out flex items-center justify-end px-2"
                            style={{ width: `${Math.min(cartProgress, 100)}%` }}
                          >
                          </div>
                        </div>
                        <p className="text-right text-xs font-bold text-[#F07C00]">
                          {cartProgress >= 100 && smartEta !== null
                            ? smartEta > 0
                              ? `Finalisation par l'IA… ~${smartEta}s`
                              : "Encore quelques instants…"
                            : `${Math.round(Math.min(cartProgress, 100))}%`}
                        </p>
                      </div>
                    )
                    : "IA-SOUKI compose votre panier avec l'IA Groq selon vos criteres et votre choix."}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {error}
                </div>
              )}

              {smartPreview.length > 0 && (
                <div className="rounded-3xl border border-[#F3E2CE] bg-[#FFFBF7] p-4 animate-slide-in-up">
                  <div className="mb-3 flex items-center gap-2 text-[#C96A00]">
                    <Check className="h-4 w-4" />
                    <h4 className="text-sm font-bold">Panier suggere</h4>
                  </div>
                  <div className="space-y-2">
                    {smartPreview.map((item, itemIndex) => (
                      <div
                        key={item.line.product_id}
                        className="flex items-center justify-between rounded-2xl bg-white p-3 animate-cascade"
                        style={{ "--cascade-i": itemIndex } as CSSProperties}
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
