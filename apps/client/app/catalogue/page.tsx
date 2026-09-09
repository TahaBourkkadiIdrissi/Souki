"use client"

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock,
  AlertCircle,
  Filter,
  History,
  Leaf,
  Menu,
  MessageCircle,
  Mic,
  PackageCheck,
  ReceiptText,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
  Zap,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react"

import { AIModals } from "@/components/souki/ai-modals"
import { MobileBottomNav } from "@/components/souki/mobile-bottom-nav"
import { ScrollProgressBar } from "@/components/souki/scroll-progress-bar"
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { ProductCard } from "@/components/souki/product-card"
import { ProductDetailSheet, StickyBottomBar } from "@/components/souki/pwa"
import { useAuth } from "@/hooks/useAuth"
import { useFavorites } from "@/hooks/useFavorites"
import { useHaptic } from "@/hooks/useHaptic"
import { useScrollReveal } from "@/hooks/useScrollReveal"
import type { CommandeHistoriqueDTO, ProduitSuggestionDTO } from "@/lib/api"
import { getCatalogueSuggestions } from "@/lib/api"
import {
  BasketSelection,
  CatalogueCategory,
  CatalogueProduct,
  ClaimReason,
  CartItem,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  deleteOrderFromHistory,
  fetchCommandeCheckout,
  fetchCatalogueProducts,
  fetchOrderHistory,
  fetchPanierDetails,
  formatQuantity,
  getCataloguePresentation,
  loadStoredCart,
  mergeSelectionsIntoCart,
  resolveCatalogueImage,
  saveStoredCart,
  submitClaim,
  submitManualBasket,
  upsertCartItem,
} from "@/lib/catalogue"
import { cn } from "@/lib/utils"

const CATALOGUE_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000
const SEUIL = FREE_DELIVERY_THRESHOLD
const FRAIS = DELIVERY_FEE
const DEFAULT_CATALOGUE_IMAGE = getCataloguePresentation("").image

const applyImageFallback = (
  event: SyntheticEvent<HTMLImageElement>,
  fallbackImage?: string
) => {
  const resolvedFallback = fallbackImage || DEFAULT_CATALOGUE_IMAGE
  event.currentTarget.onerror = null
  event.currentTarget.src = resolvedFallback
}

// Viewport mobile = en dessous du breakpoint `md` (768px), la ou vivent la barre
// de recherche sticky, la barre panier sticky et la navigation basse. Sert a
// differencier le comportement natif mobile du comportement web/tablette/desktop.
const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches

const categories = [
  { id: "tous", label: "Tous" },
  { id: "legumes", label: "Légumes" },
  { id: "fruits", label: "Fruits" },
  { id: "herbes", label: "Herbes" },
] as const

const sortOptions = [
  { id: "popular", label: "Pertinence" },
  { id: "price-asc", label: "Prix croissant" },
  { id: "price-desc", label: "Prix décroissant" },
  { id: "name", label: "Ordre alphabétique" },
] as const

const claimReasonOptions: Array<{ id: ClaimReason; label: string }> = [
  { id: "abime", label: "Produit abîmé" },
  { id: "poids_incorrect", label: "Poids incorrect" },
  { id: "erreur_produit", label: "Erreur de produit" },
  { id: "produit_manquant", label: "Produit manquant" },
  { id: "qualite", label: "Qualité insuffisante" },
  { id: "autre", label: "Autre problème" },
]

const formatOrderDate = (value?: string | null) => {
  if (!value) {
    return "Date non disponible"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Date non disponible"
  }

  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const getOrderStatusLabel = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase()
  const labels: Record<string, string> = {
    EN_ATTENTE: "En attente",
    EN_ROUTE: "En route",
    LIVRE: "Livrée",
    ABSENT: "Absent",
    REFUS: "Refusée",
    ANNULE: "Annulée",
  }
  return labels[normalizedStatus] || status || "Statut inconnu"
}

const getOrderStatusClassName = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase()
  if (normalizedStatus === "LIVRE") {
    return "border-[#BFE6C4] bg-[#EAF8EC] text-[#1E8A3C]"
  }
  if (normalizedStatus === "EN_ROUTE") {
    return "border-[#B9D7F2] bg-[#EEF7FF] text-[#1A5F96]"
  }
  if (normalizedStatus === "ABSENT" || normalizedStatus === "REFUS" || normalizedStatus === "ANNULE") {
    return "border-[#F1C6C6] bg-[#FFF1F1] text-[#B42318]"
  }
  return "border-[#F5D7B8] bg-[#FFF7EE] text-[#9A5C11]"
}

const formatPaymentMode = (mode?: string | null) => {
  const normalizedMode = (mode || "").toLowerCase()
  const labels: Record<string, string> = {
    cod: "Cash à la livraison",
    cash: "Cash à la livraison",
    wallet: "Wallet SOUKI",
    cmi: "Carte bancaire CMI",
  }
  return labels[normalizedMode] || mode || "Paiement non précisé"
}

const formatDh = (value: string | number) => `${Number(value || 0).toFixed(2)} DH`

const parseDate = (value?: string | null) => {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const canClaimOrder = (order: CommandeHistoriqueDTO) => {
  if ((order.statut || "").toUpperCase() !== "LIVRE") {
    return false
  }
  const deliveredAt = parseDate(order.delivered_at)
  if (!deliveredAt) {
    return false
  }
  const elapsedMs = Date.now() - deliveredAt.getTime()
  return elapsedMs >= 0 && elapsedMs <= CLAIM_WINDOW_MS
}

const getClaimWindowLabel = (order: CommandeHistoriqueDTO) => {
  const deliveredAt = parseDate(order.delivered_at)
  if (!deliveredAt) {
    return "Disponible après livraison"
  }
  const deadline = new Date(deliveredAt.getTime() + CLAIM_WINDOW_MS)
  if (Date.now() > deadline.getTime()) {
    return "Délai SAV expiré"
  }
  return `SAV ouvert jusqu'au ${formatOrderDate(deadline.toISOString())}`
}

type FarmerExpression = "welcome" | "explain" | "celebrate"
type FeedbackTone = "success" | "info" | "warning" | "error"

type FeedbackMessage = {
  tone: FeedbackTone
  title: string
  message: string
}

const feedbackToneStyles: Record<
  FeedbackTone,
  { shell: string; icon: string; Icon: LucideIcon }
> = {
  success: {
    shell: "border-[#BFE6C4] bg-[#EAF8EC] text-[#1E8A3C]",
    icon: "bg-white text-[#1E8A3C]",
    Icon: BadgeCheck,
  },
  info: {
    shell: "border-[#B9D7F2] bg-[#EEF7FF] text-[#1A5F96]",
    icon: "bg-white text-[#1A5F96]",
    Icon: Sparkles,
  },
  warning: {
    shell: "border-[#F3D8B2] bg-[#FFF7EE] text-[#9A5C11]",
    icon: "bg-white text-[#F07C00]",
    Icon: AlertCircle,
  },
  error: {
    shell: "border-red-200 bg-red-50 text-red-700",
    icon: "bg-white text-red-600",
    Icon: AlertCircle,
  },
}

function CatalogueFeedback({
  feedback,
  onDismiss,
}: {
  feedback: FeedbackMessage
  onDismiss: () => void
}) {
  const tone = feedbackToneStyles[feedback.tone]
  const Icon = tone.Icon

  return (
    <div
      role="status"
      className={cn(
        "mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_45px_-34px_rgba(30,65,41,0.35)]",
        tone.shell
      )}
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone.icon)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black leading-tight">{feedback.title}</p>
        <p className="mt-1 text-sm font-semibold leading-5 opacity-85">{feedback.message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-full p-1 opacity-70 transition-colors hover:bg-white/45 hover:opacity-100"
        aria-label="Fermer le message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function RecolteWarmWelcome() {
  return (
    <div className="pointer-events-none hidden xl:absolute xl:right-5 xl:top-5 xl:z-20 xl:block xl:w-36 2xl:w-44">
      <div className="relative pt-7 sm:pt-8">
        <div className="absolute right-12 top-0 z-30 max-w-[10rem] rounded-2xl border border-[#F3D8B2] bg-white px-3 py-1.5 text-center text-[11px] font-black leading-tight text-[#9A5C11] shadow-[0_12px_30px_-22px_rgba(154,92,17,0.55)] 2xl:right-20 2xl:max-w-none 2xl:text-base">
          Ach heb lkhater ?
        </div>
        <FarmerAvatar
          size="lg"
          expression="welcome"
          className="relative z-10 h-auto w-full"
          label="Souki farmer guide greets customers"
        />
      </div>
    </div>
  )
}

/* Compte a rebours vers la cloture JIT de 20h00. Rendu uniquement apres
   montage (le serveur rend la phrase statique) pour eviter tout mismatch
   d'hydratation ; une seule ligne dans les deux cas, donc pas de CLS. */
function JitCutoffBanner() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const cutoff = now ? new Date(now) : null
  cutoff?.setHours(20, 0, 0, 0)
  const beforeCutoff = now && cutoff && now < cutoff

  if (!beforeCutoff) {
    return (
      <div className="bg-[#F07C00] px-4 py-3 text-center text-sm font-semibold text-white">
        Paniers ouverts après 20h - Livraison demain, prix recalculés au moment de la validation
      </div>
    )
  }

  const diffMs = cutoff.getTime() - now.getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000)
  const seconds = Math.floor((diffMs % 60_000) / 1000)
  const pad = (value: number) => String(value).padStart(2, "0")
  const urgent = diffMs < 3_600_000

  return (
    <div className="bg-[#F07C00] px-4 py-3 text-center text-sm font-semibold text-white">
      Clôture des paniers à 20h00 —{" "}
      <span
        className={cn("souki-tabular-nums", urgent && "animate-countdown-urgent")}
        aria-label={`Temps restant avant la clôture : ${hours} heures ${minutes} minutes`}
      >
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>{" "}
      pour être livré demain matin
    </div>
  )
}

function SoukiGuideAvatar({
  cartCount,
  cartSubtotal,
  remainingForFreeDelivery,
  compact = false,
  expressionOverride,
}: {
  cartCount: number
  cartSubtotal: number
  remainingForFreeDelivery: number
  compact?: boolean
  expressionOverride?: FarmerExpression
}) {
  const guideMessage =
    cartCount === 0
      ? "Salam, je peux te composer un panier frais en moins d'une minute."
      : remainingForFreeDelivery > 0
        ? `Encore ${remainingForFreeDelivery.toFixed(0)} DH pour profiter de la livraison offerte.`
        : "Ton panier est bien parti. Tu peux valider ou ajouter quelques favoris."

  const avatarExpression: FarmerExpression =
    expressionOverride ?? (cartCount > 0 ? "celebrate" : "welcome")

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#D7EBD9] bg-white/85 p-3 shadow-[0_14px_40px_-34px_rgba(30,65,41,0.35)]">
        <FarmerAvatar
          size="md"
          expression={avatarExpression}
          className={cn("shrink-0", avatarExpression === "celebrate" && "animate-avatar-celebrate")}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#1E8A3C]">
            Recolte de Souki
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-[#264129]">{guideMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#D7EBD9] bg-white p-4 shadow-[0_18px_50px_-36px_rgba(30,65,41,0.35)]">
      <div className="absolute right-4 top-4 rounded-full bg-[#F0FAF1] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E8A3C]">
        Recolte Souki
      </div>
      <div className="flex items-end justify-center pt-5">
        <FarmerAvatar
          size="lg"
          expression={avatarExpression}
          className={avatarExpression === "celebrate" ? "animate-avatar-celebrate" : undefined}
        />
      </div>
      <div className="mt-2 rounded-2xl bg-[#F7FCF7] p-4">
        <p className="text-sm font-bold text-[#264129]">{guideMessage}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#6F8070]">
          <span>{cartCount} article{cartCount > 1 ? "s" : ""}</span>
          <span>{cartSubtotal.toFixed(2)} DH</span>
        </div>
      </div>
    </div>
  )
}

type InterludeTone = "green" | "orange" | "neutral"

const interludeToneStyles: Record<
  InterludeTone,
  { shell: string; iconWrap: string; icon: string; eyebrow: string; glow: string }
> = {
  green: {
    shell: "border-[#CFE6D2] bg-[linear-gradient(125deg,#FFFFFF_0%,#F0FAF1_52%,#EAF8EC_100%)]",
    iconWrap: "bg-white ring-[#D7EBD9] text-[#1E8A3C]",
    icon: "text-[#1E8A3C]",
    eyebrow: "text-[#1E8A3C]",
    glow: "bg-[#4CB84A]/15",
  },
  orange: {
    shell: "border-[#F3D8B2] bg-[linear-gradient(125deg,#FFFFFF_0%,#FFF7EE_55%,#FFEFD9_100%)]",
    iconWrap: "bg-white ring-[#F3D8B2] text-[#F07C00]",
    icon: "text-[#F07C00]",
    eyebrow: "text-[#9A5C11]",
    glow: "bg-[#F07C00]/12",
  },
  neutral: {
    shell: "border-[#DDEBDD] bg-[linear-gradient(125deg,#FFFFFF_0%,#F7FCF7_55%,#F0F4F0_100%)]",
    iconWrap: "bg-white ring-[#DDEBDD] text-[#607061]",
    icon: "text-[#607061]",
    eyebrow: "text-[#7B8B7D]",
    glow: "bg-[#264129]/8",
  },
}

function CatalogueTrustInterlude({
  icon: Icon,
  eyebrow,
  title,
  description,
  tone,
  delay = "1",
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  tone: InterludeTone
  delay?: string
}) {
  const styles = interludeToneStyles[tone]

  return (
    <div
      data-reveal="fade"
      data-delay={delay}
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border p-4 shadow-[0_20px_50px_-36px_rgba(30,65,41,0.35)] sm:p-5",
        styles.shell
      )}
    >
      <div className={cn("pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full blur-2xl", styles.glow)} />
      <div className="relative flex items-start gap-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1",
            styles.iconWrap
          )}
        >
          <Icon className={cn("h-6 w-6", styles.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", styles.eyebrow)}>{eyebrow}</p>
          <p className="mt-1 text-base font-black leading-snug text-[#264129] sm:text-lg">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#6F8070]">{description}</p>
        </div>
      </div>
    </div>
  )
}

function CatalogueStatInterlude({
  label,
  value,
  tone,
  delay = "2",
}: {
  label: string
  value: string
  tone: InterludeTone
  delay?: string
}) {
  const styles = interludeToneStyles[tone]

  return (
    <div
      data-reveal="up"
      data-delay={delay}
      className={cn(
        "flex min-h-[5.5rem] flex-col justify-center rounded-[1.75rem] border px-5 py-4 text-center shadow-[0_16px_40px_-32px_rgba(30,65,41,0.28)] sm:min-h-[6rem]",
        styles.shell
      )}
    >
      <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", styles.eyebrow)}>{label}</p>
      <p className="mt-1 text-base font-black leading-tight text-[#264129] sm:text-lg">{value}</p>
    </div>
  )
}

function CatalogueContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()

  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof categories)[number]["id"]>("tous")
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]["id"]>("popular")
  const [searchQuery, setSearchQuery] = useState("")
  // Categorie ciblee depuis l'accueil PWA : on garde TOUS les produits affiches
  // (pas de filtre) et on regroupe par categorie pour scroller vers la bonne.
  const [categoryFocus, setCategoryFocus] = useState<CatalogueCategory | null>(null)
  const hasScrolledToFocusRef = useRef(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [activeModal, setActiveModal] = useState<"voice" | "smart" | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState("")
  const [isSubmittingCart, setIsSubmittingCart] = useState(false)
  const [orderHistory, setOrderHistory] = useState<CommandeHistoriqueDTO[]>([])
  const [isFetchingHistory, setIsFetchingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)
  const [claimOrder, setClaimOrder] = useState<CommandeHistoriqueDTO | null>(null)
  const [claimLineId, setClaimLineId] = useState<number | null>(null)
  const [claimQuantity, setClaimQuantity] = useState("1")
  const [claimReason, setClaimReason] = useState<ClaimReason>("abime")
  const [claimError, setClaimError] = useState("")
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false)
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null)
  const [pendingDeleteOrderId, setPendingDeleteOrderId] = useState<number | null>(null)
  const [pricingSuggestions, setPricingSuggestions] = useState<CatalogueProduct[]>([])
  const [addedSuggestionIds, setAddedSuggestionIds] = useState<number[]>([])
  const [avatarExpression, setAvatarExpression] = useState<FarmerExpression>("welcome")
  const avatarResetTimerRef = useRef<number | null>(null)
  const revealRef = useScrollReveal()
  const haptic = useHaptic()
  const { isFavorite, toggleFavorite } = useFavorites()
  // Produit ouvert dans la fiche détaillée (clic sur une carte produit).
  const [detailProduct, setDetailProduct] = useState<CatalogueProduct | null>(null)

  const showFeedback = useCallback((nextFeedback: FeedbackMessage) => {
    setFeedback(nextFeedback)
  }, [])

  const triggerAvatarCelebrate = useCallback(() => {
    setAvatarExpression("celebrate")
    if (avatarResetTimerRef.current) {
      window.clearTimeout(avatarResetTimerRef.current)
    }
    avatarResetTimerRef.current = window.setTimeout(() => {
      setAvatarExpression("welcome")
    }, 2400)
  }, [])

  useEffect(() => {
    return () => {
      if (avatarResetTimerRef.current) {
        window.clearTimeout(avatarResetTimerRef.current)
      }
    }
  }, [])

  const toCatalogueProduct = (product: ProduitSuggestionDTO): CatalogueProduct => {
    const presentation = getCataloguePresentation(product.nom_fr)
    return {
      id: product.id,
      name: product.nom_fr,
      alias: product.nom_darija,
      price: product.prix_affiche ?? product.prix_kg,
      prix_khddar_estime: product.prix_khddar_estime,
      niveau: product.niveau,
      unit: product.unite,
      displayUnit: presentation.displayUnit || product.unite,
      image: resolveCatalogueImage(product.nom_fr, product.image_url),
      fallbackImage: presentation.image,
      category: presentation.category,
      quantityStep: presentation.quantityStep || (product.unite === "kg" ? 0.5 : 1),
      stock: product.stock,
    }
  }

  const loadOrderHistory = useCallback(async (showLoader = true) => {
    if (!isAuthenticated) {
      setOrderHistory([])
      setHistoryError("")
      return
    }

    try {
      if (showLoader) {
        setIsFetchingHistory(true)
      }
      const history = await fetchOrderHistory()
      setOrderHistory(history)
      setHistoryError("")
    } catch (fetchError) {
      setHistoryError("Impossible de charger votre historique pour le moment.")
    } finally {
      if (showLoader) {
        setIsFetchingHistory(false)
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    let isMounted = true

    const loadCatalogue = async (showLoader = false) => {
      try {
        if (showLoader && isMounted) {
          setIsFetching(true)
        }
        const catalogue = await fetchCatalogueProducts()
        if (!isMounted) {
          return
        }
        setError("")
        setProducts(catalogue)
        setCart((currentCart) =>
          currentCart.map((item) => {
            const updated = catalogue.find((product) => product.id === item.id)
            return updated ? { ...item, price: updated.price } : item
          })
        )
      } catch (fetchError) {
        if (isMounted && showLoader) {
          setError("Impossible de charger le catalogue pour le moment.")
        }
      } finally {
        if (showLoader && isMounted) {
          setIsFetching(false)
        }
      }
    }

    loadCatalogue(true)
    setCart(loadStoredCart())
    const interval = window.setInterval(() => {
      loadCatalogue()
    }, CATALOGUE_REFRESH_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    saveStoredCart(cart)
    window.dispatchEvent(new Event("souki:cart-updated"))
  }, [cart])

  useEffect(() => {
    const isParamSet = searchParams.get("open_cart") === "1"
    const isSessionSet = typeof window !== "undefined" && sessionStorage.getItem("souki_open_cart") === "true"

    if (isParamSet || isSessionSet) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("souki_open_cart")
      }
      setShowCart(true)
      if (isParamSet) {
        router.replace("/catalogue")
      }
    }
  }, [router, searchParams])

  useEffect(() => {
    if (isLoading || !isAuthenticated || cart.length === 0) {
      setPricingSuggestions([])
      return
    }

    const controller = new AbortController()
    const excludeIds = cart.map((item) => item.id)
    const panierTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

    getCatalogueSuggestions(excludeIds, panierTotal, controller.signal)
      .then((suggestions) => {
        setPricingSuggestions(suggestions.map(toCatalogueProduct))
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setPricingSuggestions([])
      })

    return () => controller.abort()
  }, [cart, isAuthenticated, isLoading])

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isAuthenticated) {
      setOrderHistory([])
      setHistoryError("")
      return
    }

    void loadOrderHistory()
  }, [isAuthenticated, isLoading, loadOrderHistory])

  useEffect(() => {
    const validatedOrderId = searchParams.get("commande_validee")
    if (!validatedOrderId) {
      return
    }

    router.replace(`/historique?commande_validee=${validatedOrderId}`)
  }, [router, searchParams])

  useEffect(() => {
    const assistantMode = searchParams.get("assistant")
    if (!assistantMode || isLoading || !isAuthenticated) {
      return
    }

    if (assistantMode === "voice" || assistantMode === "smart") {
      setActiveModal(assistantMode)
    }
  }, [isAuthenticated, isLoading, searchParams])

  // Deep-link depuis l'accueil PWA.
  // - ?q=   : recherche
  // - ?focus= : categorie ciblee, SANS filtrer (tous les produits restent visibles),
  //            on regroupe par categorie et on scrolle vers la section choisie.
  useEffect(() => {
    const query = searchParams.get("q")
    if (query) setSearchQuery(query)

    const focus = searchParams.get("focus")
    if (focus === "legumes" || focus === "fruits" || focus === "herbes") {
      setCategoryFocus(focus)
      hasScrolledToFocusRef.current = false
    } else {
      setCategoryFocus(null)
    }
  }, [searchParams])

  useEffect(() => {
    const panierIdParam = searchParams.get("panier_id")
    const commandeIdParam = searchParams.get("commande_id")

    if (!isAuthenticated || products.length === 0 || (!panierIdParam && !commandeIdParam)) {
      return
    }

    const syncExistingOrderToCart = async () => {
      try {
        let remoteLines:
          | Array<{
              product_id: number
              quantite_kg?: number
              quantite_effective?: number
            }>
          | null = null

        if (panierIdParam) {
          const panierId = Number(panierIdParam)
          if (!Number.isFinite(panierId)) {
            return
          }
          const panierDetails = await fetchPanierDetails(panierId)
          remoteLines = panierDetails.lignes
        } else if (commandeIdParam) {
          const commandeId = Number(commandeIdParam)
          if (!Number.isFinite(commandeId)) {
            return
          }
          const commandeDetails = await fetchCommandeCheckout(commandeId)
          remoteLines = commandeDetails.lignes
        }

        if (!remoteLines || remoteLines.length === 0) {
          return
        }

        const rebuiltCart = remoteLines.reduce<CartItem[]>((acc, line) => {
          const product = products.find((item) => item.id === line.product_id)
          if (!product) {
            return acc
          }
          const quantity = Number(line.quantite_kg ?? line.quantite_effective ?? 0)
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return acc
          }
          return upsertCartItem(acc, product, quantity)
        }, [])

        if (rebuiltCart.length > 0) {
          setCart(rebuiltCart)
          setShowCart(true)
        }
      } catch (error) {
        console.error("Impossible de recharger la commande à modifier:", error)
      } finally {
        router.replace("/catalogue")
      }
    }

    void syncExistingOrderToCart()
  }, [isAuthenticated, products, searchParams, router])

  useEffect(() => {
    const addProductName = searchParams.get("add_product")
    const qtyStr = searchParams.get("qty")
    if (addProductName && qtyStr && products.length > 0 && isAuthenticated) {
      const qty = Number(qtyStr)
      const product = products.find((p) => p.name === addProductName)
      if (product && !Number.isNaN(qty)) {
        setCart((currentCart) => upsertCartItem(currentCart, product, qty))
        setShowCart(true)
        router.replace("/catalogue")
      }
    }
  }, [searchParams, products, isAuthenticated, router])

  // Arrivee depuis l'accueil PWA (?product=<id>) : on ouvre directement la fiche
  // du produit touche, description comprise, puis on nettoie l'URL pour qu'un
  // retour arriere ne la rouvre pas.
  useEffect(() => {
    const productIdParam = searchParams.get("product")
    if (!productIdParam || products.length === 0) {
      return
    }

    const product = products.find((item) => item.id === Number(productIdParam))
    if (product) {
      setDetailProduct(product)
      handleProductView(product.id)
    }
    router.replace("/catalogue", { scroll: false })
  }, [searchParams, products, router])

  const redirectToLogin = (redirectTarget: string) => {
    router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
  }

  const requireAuth = (redirectTarget: string, action: () => void) => {
    if (isLoading) {
      return
    }
    if (!isAuthenticated) {
      redirectToLogin(redirectTarget)
      return
    }
    action()
  }

  const handleAddToCart = (id: number | string, quantity: number) => {
    requireAuth("/catalogue", () => {
      const normalizedId = Number(id)
      const product = products.find((item) => item.id === normalizedId)
      if (!product) {
        return
      }
      setCart((currentCart) => upsertCartItem(currentCart, product, quantity))
      triggerAvatarCelebrate()
      haptic("medium")
      // Mobile : on n'ouvre plus le tiroir panier a chaque ajout (trop intrusif).
      // La barre panier sticky basse suffit ; un toast discret confirme l'ajout.
      // Web/tablette/desktop : comportement inchange (ouverture du panier).
      if (isMobileViewport()) {
        toast.success(`${product.name} ajouté au panier`)
      } else {
        setShowCart(true)
      }
    })
  }

  const handleProductView = (id: number | string) => {
    if (typeof window === "undefined") {
      return
    }

    const normalizedId = Number(id)
    const product = products.find((item) => item.id === normalizedId)
    if (!product) {
      return
    }

    const viewedProduct = {
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      unit: product.unit,
      displayUnit: product.displayUnit,
      viewedAt: new Date().toISOString(),
    }

    try {
      const rawHistory = window.localStorage.getItem("souki_recent_products")
      const currentHistory = rawHistory ? JSON.parse(rawHistory) : []
      const nextHistory = [
        viewedProduct,
        ...(Array.isArray(currentHistory) ? currentHistory : []).filter(
          (item: { id?: number }) => item.id !== product.id
        ),
      ].slice(0, 12)
      window.localStorage.setItem("souki_recent_products", JSON.stringify(nextHistory))
    } catch {
      window.localStorage.setItem("souki_recent_products", JSON.stringify([viewedProduct]))
    }
  }

  // Clic sur une carte produit : on enregistre la vue récente puis on ouvre la
  // fiche détaillée (fenêtre avec infos, quantité, favori et ajout au panier).
  const openProductDetail = (id: number | string) => {
    handleProductView(id)
    const product = products.find((item) => item.id === Number(id))
    if (product) {
      haptic("light")
      setDetailProduct(product)
    }
  }

  const handleAddSuggestionToCart = (product: CatalogueProduct) => {
    requireAuth("/catalogue", () => {
      setAddedSuggestionIds((currentIds) =>
        currentIds.includes(product.id) ? currentIds : [...currentIds, product.id]
      )
      setCart((currentCart) => upsertCartItem(currentCart, product, product.quantityStep))
      triggerAvatarCelebrate()
      haptic("medium")
      if (isMobileViewport()) {
        toast.success(`${product.name} ajouté au panier`)
      } else {
        setShowCart(true)
      }
    })
  }

  const handleApplySelections = (selections: BasketSelection[]) => {
    requireAuth("/catalogue", () => {
      setCart((currentCart) => mergeSelectionsIntoCart(currentCart, products, selections))
      setShowCart(true)
    })
  }

  const updateCartQuantity = (id: number, delta: number) => {
    haptic("light")
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== id) {
            return item
          }
          const nextQuantity = Number((item.quantity + delta).toFixed(2))
          if (nextQuantity <= 0) {
            return null
          }
          return { ...item, quantity: nextQuantity }
        })
        .filter((item): item is CartItem => item !== null)
    )
  }

  const removeFromCart = (id: number) => {
    haptic("light")
    setCart((currentCart) => currentCart.filter((item) => item.id !== id))
  }

  const openClaimModal = (order: CommandeHistoriqueDTO) => {
    const claimableLines = order.produits.filter(
      (product) => typeof product.ligne_panier_id === "number" && product.quantite_kg > 0
    )
    if (!canClaimOrder(order)) {
      showFeedback({
        tone: "warning",
        title: "SAV indisponible",
        message: getClaimWindowLabel(order),
      })
      return
    }
    if (claimableLines.length === 0) {
      showFeedback({
        tone: "warning",
        title: "Aucun produit eligible",
        message: "Cette commande ne contient aucune ligne eligible au SAV.",
      })
      return
    }
    const firstLine = claimableLines[0]
    setClaimOrder(order)
    setClaimLineId(firstLine.ligne_panier_id ?? null)
    setClaimQuantity(String(Math.min(1, firstLine.quantite_kg)))
    setClaimReason("abime")
    setClaimError("")
  }

  const closeClaimModal = () => {
    if (isSubmittingClaim) {
      return
    }
    setClaimOrder(null)
    setClaimLineId(null)
    setClaimError("")
  }

  const handleSubmitClaim = async () => {
    if (!claimOrder || claimLineId === null) {
      return
    }
    const selectedLine = claimOrder.produits.find((product) => product.ligne_panier_id === claimLineId)
    if (!selectedLine || typeof selectedLine.ligne_panier_id !== "number") {
      setClaimError("Selection de produit invalide.")
      return
    }
    const normalizedQuantity = Number(claimQuantity.replace(",", "."))
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      setClaimError("La quantité réclamée doit être positive.")
      return
    }
    if (normalizedQuantity > selectedLine.quantite_kg) {
      setClaimError("La quantité réclamée dépasse la quantité commandée.")
      return
    }

    setIsSubmittingClaim(true)
    setClaimError("")
    try {
      const result = await submitClaim({
        commande_id: claimOrder.id,
        items: [
          {
            ligne_panier_id: selectedLine.ligne_panier_id,
            quantity_claimed: normalizedQuantity,
            reason: claimReason,
          },
        ],
      })
      setSuccessMessage(
        `Réclamation envoyée. ${formatDh(result.amount_refunded)} ont été crédités sur votre wallet SOUKI. Nouveau solde : ${formatDh(result.new_wallet_balance)}.`
      )
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("souki-wallet-updated", {
            detail: { balance: result.new_wallet_balance },
          })
        )
      }
      setClaimOrder(null)
      await loadOrderHistory(false)
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Impossible d'envoyer la reclamation.")
    } finally {
      setIsSubmittingClaim(false)
    }
  }

  const handleDeleteOrderHistory = (commandeId: number) => {
    setPendingDeleteOrderId(commandeId)
  }

  const confirmDeleteOrderHistory = async () => {
    if (pendingDeleteOrderId === null) {
      return
    }

    const commandeId = pendingDeleteOrderId
    setDeletingOrderId(commandeId)
    try {
      const result = await deleteOrderFromHistory(commandeId)
      setOrderHistory((currentHistory) => currentHistory.filter((order) => order.id !== commandeId))
      setSuccessMessage(result.message || `Commande N-${commandeId} supprimee de l'historique.`)
      setPendingDeleteOrderId(null)
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Impossible de supprimer cette commande de l'historique."
      )
    } finally {
      setDeletingOrderId(null)
    }
  }

  const handleCheckout = () => {
    requireAuth("/checkout", async () => {
      if (cart.length === 0) {
        showFeedback({
          tone: "info",
          title: "Panier vide",
          message: "Ajoutez au moins un produit frais avant de valider la commande.",
        })
        return
      }

      setIsSubmittingCart(true)
      try {
        const result = await submitManualBasket(cart)

        if (result && result.panier_id) {
          // Rediriger vers checkout avec panier_id
          router.push(`/checkout?panier_id=${result.panier_id}`)
          // Vider le panier local après succès
          saveStoredCart([])
        } else {
          showFeedback({
            tone: "error",
            title: "Commande non creee",
            message: "Le serveur a repondu sans identifiant de panier. Reessayez dans un instant.",
          })
        }
      } catch (error: any) {
        const errorMsg =
          error?.message ||
          error?.detail ||
          "Erreur lors de la création du panier"
        showFeedback({
          tone: "error",
          title: "Commande impossible",
          message: errorMsg,
        })
      } finally {
        setIsSubmittingCart(false)
      }
    })
  }

  const filteredProducts = products
    .filter((product) => {
      if (selectedCategory !== "tous" && product.category !== selectedCategory) {
        return false
      }

      if (!searchQuery.trim()) {
        return true
      }

      const normalizedQuery = searchQuery.toLowerCase()
      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.alias.toLowerCase().includes(normalizedQuery)
      )
    })
    .sort((left, right) => {
      if (sortBy === "price-asc") {
        return left.price - right.price
      }
      if (sortBy === "price-desc") {
        return right.price - left.price
      }
      if (sortBy === "name") {
        return left.name.localeCompare(right.name)
      }
      return left.id - right.id
    })

  // Vue ciblee par categorie (depuis l'accueil) : tous les produits restent
  // visibles, regroupes par categorie. Prioritaire sur le regroupement par niveau.
  const productsByCategory = useMemo(() => {
    if (!categoryFocus) return null
    if (searchQuery.trim() !== "" || selectedCategory !== "tous") return null
    return {
      legumes: filteredProducts.filter((p) => p.category === "legumes"),
      fruits: filteredProducts.filter((p) => p.category === "fruits"),
      herbes: filteredProducts.filter((p) => p.category === "herbes"),
    }
  }, [categoryFocus, filteredProducts, searchQuery, selectedCategory])

  const productsByLevel = useMemo(() => {
    if (categoryFocus) return null // la vue par categorie prend le dessus
    const hasSearchOrFilter = searchQuery.trim() !== "" || selectedCategory !== "tous"
    if (hasSearchOrFilter) return null // skip level grouping when filtering
    return {
      level1: filteredProducts.filter((p) => p.niveau === 1),
      level2: filteredProducts.filter((p) => p.niveau === 2),
      level3: filteredProducts.filter((p) => p.niveau === 3),
    }
  }, [categoryFocus, filteredProducts, searchQuery, selectedCategory])

  // Scroll doux vers la section de la categorie choisie une fois les produits charges.
  useEffect(() => {
    if (!categoryFocus || isFetching || hasScrolledToFocusRef.current) return
    const target = document.getElementById(`catalogue-cat-${categoryFocus}`)
    if (!target) return
    hasScrolledToFocusRef.current = true
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [categoryFocus, isFetching, productsByCategory])

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const reste = Math.max(0, SEUIL - cartSubtotal)
  const progression = Math.min(100, (cartSubtotal / SEUIL) * 100)
  const cartDeliveryFee = cartSubtotal >= SEUIL ? 0 : FRAIS
  const cartTotal = cartSubtotal + cartDeliveryFee
  const firstLevelTwoSuggestionId = pricingSuggestions.find(
    (suggestion) => suggestion.niveau === 2
  )?.id
  const addedSuggestionItems = cart.filter((item) => addedSuggestionIds.includes(item.id))
  const suggestionSavings = addedSuggestionItems.reduce(
    (sum, item) =>
      sum +
      Math.max(0, Number(item.prix_khddar_estime || 0) - item.price) * item.quantity,
    0
  )
  const claimableLines =
    claimOrder?.produits.filter(
      (product) => typeof product.ligne_panier_id === "number" && product.quantite_kg > 0
    ) ?? []
  const selectedClaimLine = claimableLines.find((product) => product.ligne_panier_id === claimLineId)
  const resolveOrderProductImage = (product: CommandeHistoriqueDTO["produits"][number]) => {
    if (product.image) {
      return product.image
    }
    const catalogueProduct = products.find((item) => item.id === product.product_id)
    return catalogueProduct?.image || getCataloguePresentation(product.nom_fr).image
  }

  const sectionBreaks = useMemo(
    () =>
      [
        {
          trust: {
            icon: BadgeCheck,
            eyebrow: "Qualité marché",
            title: "Produits frais du marché",
            description: "Une sélection renouvelée chaque matin auprès de nos producteurs partenaires.",
            tone: "green" as const,
          },
          stat: {
            label: "Seuil confort",
            value: `${SEUIL} DH livraison offerte`,
            tone: "green" as const,
          },
        },
        {
          trust: {
            icon: Clock,
            eyebrow: "Logistique Souki",
            title: "Livraison demain matin",
            description: "Commande validée aujourd'hui, panier livré demain pour garantir la fraîcheur.",
            tone: "orange" as const,
          },
          stat: {
            label: "Après 20h",
            value: "En attente pour demain",
            tone: "orange" as const,
          },
        },
        {
          trust: {
            icon: MessageCircle,
            eyebrow: "Accompagnement",
            title: "Aide à chaque étape",
            description: "Assistant vocal, panier malin ou parcours libre selon ton humeur du moment.",
            tone: "green" as const,
          },
          stat: {
            label: "Prix transparents",
            value: "Recalculés à validation",
            tone: "neutral" as const,
          },
        },
      ] as const,
    []
  )

  return (
    <div
      className={cn(
        "min-h-screen bg-[#FBFDF9] md:pb-0",
        // Réserve l'espace bas : barre de nav mobile seule (pb-24) ou barre de nav
        // + barre panier sticky quand le panier est rempli (pb-44), pour que le
        // dernier contenu ne soit jamais masqué au bas du scroll.
        isAuthenticated && cart.length > 0 ? "pb-44" : "pb-24",
      )}
    >
      {/* Avancement du scroll : l'utilisateur voit quand il approche de la fin */}
      <ScrollProgressBar />
      <JitCutoffBanner />

      {/* ===== BARRE MOBILE NATIVE : recherche + categories (masquee des md:) =====
          Sur mobile, la recherche et les categories etaient enfouies dans le
          tiroir lateral. On les remonte en tete d'ecran, a portee de pouce, facon
          app native. Desktop (md:+) inchange : cette barre est md:hidden. */}
      <div className="sticky top-0 z-40 border-b border-[#E7F0E8] bg-[#FBFDF9]/95 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.6rem)] backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-[#E7F0E8] transition-all duration-300 focus-within:ring-2 focus-within:ring-[#1E8A3C]/40 focus-within:shadow-[0_10px_28px_-12px_rgba(30,138,60,0.45)]">
            <Search className="h-5 w-5 shrink-0 text-[#1E8A3C]" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher un produit frais…"
              aria-label="Rechercher un produit"
              className="w-full bg-transparent text-[15px] font-semibold text-[#264129] outline-none placeholder:font-medium placeholder:text-[#9BB29E]"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
                className="shrink-0 text-[#9BB29E] active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex gap-2 overflow-x-auto scrollbar-none">
          {categories.map((category) => {
            const isActive = selectedCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  haptic("light")
                  setSelectedCategory(category.id)
                }}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-bold transition-all duration-200 active:scale-95",
                  isActive
                    ? "scale-105 bg-[#1E8A3C] text-white shadow-[0_8px_18px_-8px_rgba(30,138,60,0.65)]"
                    : "bg-white text-[#607061] ring-1 ring-[#E7F0E8]",
                )}
              >
                {category.label}
              </button>
            )
          })}
        </div>
      </div>

      <nav className="sticky top-0 z-40 hidden glass-ios26 border-b border-[#E7F0E8] md:block">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar((value) => !value)}
              className="rounded-xl p-2 text-[#264129] xl:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-sm">
                <img
                  src="/logo3.png"
                  alt="SOUKI"
                  className="h-full w-[175%] max-w-none object-cover"
                  style={{ objectPosition: "left center" }}
                />
              </div>
              <div className="hidden sm:block">
                <span className="block text-xl font-bold leading-none text-[#1E8A3C]">SOUKI</span>
                <span className="text-[11px] uppercase tracking-widest text-[#7B8B7D]">
                  Fresh market
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCart((value) => !value)}
              className="relative rounded-xl p-2 text-[#264129] xl:hidden"
            >
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                // key={cart.length} : remonte le badge a chaque changement pour rejouer le pop
                <span
                  key={cart.length}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#F07C00] text-xs font-bold text-white animate-badge-pop"
                >
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex max-w-[1680px]">
        <aside
          className={cn(
            "fixed left-0 top-0 z-50 h-[100dvh] w-[min(100vw,18rem)] overflow-y-auto border-r border-[#E6F0E7] bg-[#F2FAF2] p-6 transition-transform xl:sticky xl:top-20 xl:h-[calc(100vh-80px)] xl:translate-x-0",
            showSidebar ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
          )}
        >
          <button
            onClick={() => setShowSidebar(false)}
            className="absolute right-4 top-4 rounded-xl p-2 text-[#264129] xl:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="space-y-8">
            <div className="glass-ios26 rounded-3xl p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7B8B7D]" />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-2xl border border-[#DDE7DE] bg-[#FAFCFA] py-3 pl-10 pr-4 text-sm text-[#264129] outline-none transition-colors focus:border-[#4CB84A]"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#264129]">
                <Filter className="h-4 w-4" />
                Categories
              </h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors",
                      selectedCategory === category.id
                        ? "bg-[#1E8A3C] text-white"
                        : "glass-ios26 text-[#264129] hover:bg-white/45"
                    )}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-ios26 rounded-3xl border border-[#D7EBD9] p-5">
              <div className="flex items-center gap-3 text-[#1E8A3C]">
                <Clock className="h-5 w-5" />
                <span className="font-semibold">Commandes ouvertes</span>
              </div>
              <p className="mt-2 text-sm text-[#718272]">
                Livraison demain pour garantir la fraîcheur.
              </p>
            </div>

            {isAuthenticated && (
              <Link
                href="/historique"
                className="glass-ios26 flex w-full items-center justify-between rounded-3xl border border-[#D7EBD9] px-5 py-4 text-left text-[#264129] transition-colors hover:bg-white/45"
              >
                <span className="flex items-center gap-3 font-semibold">
                  <History className="h-5 w-5" />
                  Historique
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#F07C00]">
                  {orderHistory.length}
                </span>
              </Link>
            )}

            {!isAuthenticated && !isLoading && (
              <div className="rounded-3xl border border-[#F3D8B2] bg-[#FFF7EE] p-5">
                <p className="text-sm font-semibold text-[#9A5C11]">
                  Connectez-vous pour ajouter des produits au panier et valider votre commande.
                </p>
                <button
                  onClick={() => redirectToLogin("/catalogue")}
                  className="mt-4 w-full rounded-2xl bg-[#F07C00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D66B00]"
                >
                  Se connecter
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-8">
          {/* ===== ACCUEIL CATALOGUE MOBILE (rebuild façon référence Avora, md:hidden) =====
              Bannière promo + actions IA compactes + compteur/tri. Remplace la grande
              carte hero desktop (masquée en dessous de md). Desktop inchangé. */}
          {!showOrderHistory && (
            <div className="mb-5 md:hidden">
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("catalogue-products")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="relative flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A4F2C] via-[#1E8A3C] to-[#2DA050] p-5 text-left text-white shadow-[0_8px_20px_-14px_rgba(17,59,30,0.45)] active:scale-[0.98]"
              >
                <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
                <span className="pointer-events-none absolute -bottom-12 right-12 h-24 w-24 rounded-full bg-white/10" />
                <span className="relative min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    <Leaf className="h-3 w-3" /> Frais du jour
                  </span>
                  <span className="mt-2 block text-[19px] font-black leading-tight">
                    Livraison offerte dès {SEUIL.toFixed(0)} DH
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-black text-[#1E8A3C]">
                    Je commande <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </span>
                <FarmerAvatar
                  size="md"
                  expression="welcome"
                  label="Souki, votre guide du marché"
                  className="relative shrink-0 drop-shadow-[0_12px_20px_rgba(0,0,0,0.28)]"
                />
              </button>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => requireAuth("/catalogue", () => setActiveModal("smart"))}
                  className="flex items-center gap-2.5 rounded-2xl bg-white p-3 text-left shadow-[0_10px_24px_-16px_rgba(17,59,30,0.55)] ring-1 ring-[#E7F0E8] active:scale-[0.97]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F07C00]/10 text-[#F07C00]">
                    <Zap className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black leading-tight text-[#264129]">Panier malin</span>
                    <span className="block text-[11px] font-medium text-gray-400">L&apos;IA compose</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => requireAuth("/catalogue", () => setActiveModal("voice"))}
                  className="flex items-center gap-2.5 rounded-2xl bg-white p-3 text-left shadow-[0_10px_24px_-16px_rgba(17,59,30,0.55)] ring-1 ring-[#E7F0E8] active:scale-[0.97]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E8A3C]/10 text-[#1E8A3C]">
                    <Mic className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black leading-tight text-[#264129]">Assistant vocal</span>
                    <span className="block text-[11px] font-medium text-gray-400">Dictez votre marché</span>
                  </span>
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#607061]">
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
                </p>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as (typeof sortOptions)[number]["id"])
                    }
                    aria-label="Trier les produits"
                    className="appearance-none rounded-full border border-[#E7F0E8] bg-white py-1.5 pl-3 pr-8 text-[12px] font-bold text-[#264129] outline-none"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7B8B7D]" />
                </div>
              </div>
            </div>
          )}

          <div className="relative mb-6 hidden overflow-hidden rounded-2xl border border-[#D7EBD9] bg-[linear-gradient(135deg,#FFFFFF_0%,#F7FCF7_58%,#FFF7EE_100%)] p-5 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.2)] md:block lg:p-6">
            <RecolteWarmWelcome />
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-w-0 xl:pr-40 2xl:pr-0">
                <div className="mb-4 flex flex-wrap items-center gap-3 pr-24 sm:pr-32 xl:pr-0">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#1E8A3C] ring-1 ring-[#D7EBD9]">
                    <Leaf className="h-4 w-4" />
                    Produits du jour
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF7EE] px-3 py-1.5 text-xs font-bold text-[#9A5C11] ring-1 ring-[#F3D8B2]">
                    <Sparkles className="h-4 w-4" />
                    Guide d'achat actif
                  </span>
                </div>

                <h1 className="max-w-4xl pr-24 text-2xl font-black leading-tight text-[#1E8A3C] sm:pr-32 lg:text-3xl xl:pr-0">
                  Salam, je t'aide a composer un panier frais sans perdre de temps
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F735F] sm:pr-28 lg:text-base xl:pr-0">
                  Choisis toi-même tes produits, parle à l'assistant vocal, ou laisse Souki composer
                  un panier malin selon ton budget.
                </p>

                <div className="mt-4 2xl:hidden">
                  <SoukiGuideAvatar
                    cartCount={cart.length}
                    cartSubtotal={cartSubtotal}
                    remainingForFreeDelivery={reste}
                    compact
                    expressionOverride={avatarExpression}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() =>
                      document
                        .getElementById("catalogue-products")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className="glass-ios26 group flex w-full min-h-[72px] items-center gap-3 rounded-xl border border-[#E6F0E7] p-3 text-left text-[#264129] transition-transform hover:-translate-y-0.5 hover:bg-white/45"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF7EE] text-[#F07C00]">
                      <ShoppingCart className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black leading-tight">Commander moi-même</span>
                      <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-[#6F8070]">
                        Parcours les produits et choisis librement.
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#9AB49C] transition-transform group-hover:translate-x-1" />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => requireAuth("/catalogue", () => setActiveModal("smart"))}
                      className="group flex min-h-[6.75rem] flex-col items-center justify-center gap-1 rounded-xl bg-[#F07C00] p-2.5 text-white shadow-[0_12px_28px_-20px_rgba(240,124,0,0.75)] transition-transform hover:-translate-y-0.5 hover:bg-[#D66B00]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/18">
                        <Zap className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-black leading-tight">Panier intelligent</span>
                      <span className="px-1 text-center text-[10px] font-semibold leading-snug text-white/85">
                        Budget, durée et foyer : Souki compose pour toi.
                      </span>
                    </button>

                    <button
                      onClick={() => requireAuth("/catalogue", () => setActiveModal("voice"))}
                      className="glass-ios26 group flex min-h-[6.75rem] flex-col items-center justify-center gap-1 rounded-xl border border-[#CFE6D2] p-2.5 text-[#264129] transition-transform hover:-translate-y-0.5 hover:bg-white/45"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0FAF1] text-[#1E8A3C]">
                        <Mic className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-black leading-tight">Assistant IA</span>
                      <span className="px-1 text-center text-[10px] font-semibold leading-snug text-[#6F8070]">
                        Dis tes produits à voix haute, on prépare le panier.
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="hidden 2xl:block">
                <SoukiGuideAvatar
                  cartCount={cart.length}
                  cartSubtotal={cartSubtotal}
                  remainingForFreeDelivery={reste}
                  expressionOverride={avatarExpression}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#EEF2EE] pt-5">
              <p className="text-sm text-[#6F8070]">
                {showOrderHistory
                  ? `${orderHistory.length} commande${orderHistory.length > 1 ? "s" : ""} dans l'historique`
                  : `${filteredProducts.length} produit${filteredProducts.length > 1 ? "s" : ""} affiche${filteredProducts.length > 1 ? "s" : ""}`}
              </p>
              {!showOrderHistory && (
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as (typeof sortOptions)[number]["id"])
                    }
                    className="appearance-none rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 pr-10 text-sm font-medium text-[#264129] outline-none transition-colors focus:border-[#4CB84A]"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8B7D]" />
                </div>
              )}
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-[#BFE6C4] bg-[#EAF8EC] px-5 py-4 text-sm font-semibold text-[#1E8A3C]">
              {successMessage}
            </div>
          )}

          {feedback && (
            <CatalogueFeedback
              feedback={feedback}
              onDismiss={() => setFeedback(null)}
            />
          )}

          {isAuthenticated && showOrderHistory && (
            <div className="mb-6 flex items-center gap-2 border-b border-[#DDEBDD]">
              <button
                onClick={() => setShowOrderHistory(false)}
                className="rounded-t-2xl border border-b-0 border-[#DDEBDD] bg-[#F7FCF7] px-4 py-3 text-sm font-bold text-[#607061] transition-colors hover:bg-white"
              >
                Produits
              </button>
              <div className="flex items-center gap-3 rounded-t-2xl border border-b-0 border-[#1E8A3C] bg-[#1E8A3C] px-4 py-3 text-sm font-bold text-white">
                <span className="inline-flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historique commandes
                </span>
                <button
                  onClick={() => setShowOrderHistory(false)}
                  className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                  aria-label="Fermer l'onglet historique"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {isAuthenticated && showOrderHistory && (
            <section className="mb-8">
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E6F0E7] bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7B8B7D]">Commandes</p>
                  <p className="mt-1 text-2xl font-black text-[#264129]">{orderHistory.length}</p>
                </div>
                <div className="rounded-2xl border border-[#E6F0E7] bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7B8B7D]">Depense totale</p>
                  <p className="mt-1 text-2xl font-black text-[#F07C00]">
                    {orderHistory.reduce((sum, order) => sum + Number(order.montant_total || 0), 0).toFixed(2)} DH
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E6F0E7] bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7B8B7D]">SAV</p>
                  <p className="mt-1 text-2xl font-black text-[#1E8A3C]">
                    {orderHistory.filter(canClaimOrder).length} ouvert
                  </p>
                </div>
              </div>

              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-[#1E8A3C]">
                    <ReceiptText className="h-5 w-5" />
                    <h2 className="text-xl font-black">Historique des commandes</h2>
                  </div>
                  <p className="mt-1 text-sm text-[#6F8070]">
                    Retrouvez les commandes validées depuis le checkout.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void loadOrderHistory()}
                    disabled={isFetchingHistory}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#CFE6D2] bg-white px-4 py-3 text-sm font-semibold text-[#1E8A3C] transition-colors hover:bg-[#F0FAF1] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <History className="h-4 w-4" />
                    {isFetchingHistory ? "Actualisation..." : "Actualiser"}
                  </button>
                  <button
                    onClick={() => setShowOrderHistory(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E5E8E3] bg-white px-4 py-3 text-sm font-semibold text-[#607061] transition-colors hover:bg-[#F7F8F5]"
                  >
                    <X className="h-4 w-4" />
                    Fermer
                  </button>
                </div>
              </div>

              {isFetchingHistory && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-44 animate-pulse rounded-[24px] bg-gradient-to-br from-[#F3F7F3] to-[#EAF3EB]"
                    />
                  ))}
                </div>
              )}

              {!isFetchingHistory && historyError && (
                <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-600">
                  {historyError}
                </div>
              )}

              {!isFetchingHistory && !historyError && orderHistory.length === 0 && (
                <div className="rounded-[24px] border border-[#E6EFE7] bg-white p-8 text-center">
                  <PackageCheck className="mx-auto mb-3 h-10 w-10 text-[#B8C9BA]" />
                  <p className="font-semibold text-[#264129]">Aucune commande validée pour le moment.</p>
                  <p className="mt-1 text-sm text-[#6F8070]">
                    Vos prochaines commandes apparaîtront ici après validation.
                  </p>
                </div>
              )}

              {!isFetchingHistory && !historyError && orderHistory.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {orderHistory.map((order) => (
                    <article
                      key={order.id}
                      className="overflow-hidden rounded-2xl border border-[#E6F0E7] bg-white shadow-[0_18px_55px_-36px_rgba(30,65,41,0.35)]"
                    >
                      <div className="h-1.5 bg-gradient-to-r from-[#1E8A3C] via-[#4CB84A] to-[#F07C00]" />
                      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B8B7D]">
                            Commande N-{order.id}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-[#264129]">
                            {formatOrderDate(order.date_commande)}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-bold",
                              getOrderStatusClassName(order.statut)
                            )}
                          >
                            {getOrderStatusLabel(order.statut)}
                          </span>
                          <button
                            onClick={() => void handleDeleteOrderHistory(order.id)}
                            disabled={deletingOrderId === order.id}
                            className="rounded-full border border-red-100 bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Supprimer de l'historique"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 px-5">
                        {order.produits.map((product, index) => (
                          <div
                            key={`${order.id}-${product.nom_fr}-${index}`}
                            className="flex items-center gap-3 rounded-2xl bg-[#F7FCF7] p-3 text-sm"
                          >
                            <img
                              src={resolveOrderProductImage(product)}
                              alt={product.nom_fr}
                              onError={(event) => applyImageFallback(event, getCataloguePresentation(product.nom_fr).image)}
                              className="h-12 w-12 shrink-0 rounded-xl object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[#264129]">
                                {product.nom_fr}
                              </p>
                              <p className="text-xs font-semibold text-[#6F8070]">
                                {formatQuantity(product.quantite_kg, "kg")}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-bold text-[#F07C00]">
                              {typeof product.sous_total === "number"
                                ? `${product.sous_total.toFixed(2)} DH`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 px-5 text-sm sm:grid-cols-2">
                        <div className="rounded-2xl bg-[#FBFDF9] p-3">
                          <p className="text-[#7B8B7D]">Paiement</p>
                          <p className="mt-1 font-bold text-[#264129]">
                            {formatPaymentMode(order.mode_paiement)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#6F8070]">
                            {order.payment_validated ? "Paiement valide" : "Paiement non valide"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#FFF7EE] p-3">
                          <p className="text-[#9A5C11]">Total</p>
                          <p className="mt-1 text-lg font-black text-[#F07C00]">
                            {(order.montant_total || 0).toFixed(2)} DH
                          </p>
                          {order.montant_a_encaisser ? (
                            <p className="mt-1 text-xs font-semibold text-[#9A5C11]">
                              A encaisser: {order.montant_a_encaisser.toFixed(2)} DH
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 px-5 text-xs font-semibold text-[#6F8070] sm:grid-cols-2">
                        {order.creneau_livraison && (
                          <p>
                            Creneau: <span className="text-[#264129]">{order.creneau_livraison}</span>
                          </p>
                        )}
                        {order.enroute_at && (
                          <p>
                            En route: <span className="text-[#264129]">{formatOrderDate(order.enroute_at)}</span>
                          </p>
                        )}
                        {order.delivered_at && (
                          <p>
                            Livrée : <span className="text-[#264129]">{formatOrderDate(order.delivered_at)}</span>
                          </p>
                        )}
                        {order.absent_at && (
                          <p>
                            Absent: <span className="text-[#264129]">{formatOrderDate(order.absent_at)}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-4 space-y-2 bg-[#FBFDF9] p-5">
                        <button
                          onClick={() => openClaimModal(order)}
                          disabled={!canClaimOrder(order)}
                          className={cn(
                            "inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors",
                            canClaimOrder(order)
                              ? "border-[#F3D8B2] bg-[#FFF7EE] text-[#9A5C11] hover:bg-[#FFEBD6]"
                              : "cursor-not-allowed border-[#E5E8E3] bg-[#F7F8F5] text-[#9AA49B]"
                          )}
                        >
                          <AlertCircle className="h-4 w-4" />
                          Signaler un problème
                        </button>
                        <p className="text-center text-xs font-semibold text-[#7B8B7D]">
                          {getClaimWindowLabel(order)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {!showOrderHistory && isFetching && (
            <div className="space-y-12">
              {Array.from({ length: 2 }).map((_, sectionIndex) => (
                <div key={sectionIndex} className="space-y-6">
                  <div className="souki-skeleton h-6 w-40 rounded-xl" />
                  <div className="grid grid-cols-3 gap-2 md:flex md:gap-4 md:overflow-hidden">
                    {Array.from({ length: 6 }).map((__, index) => (
                      <div
                        key={index}
                        className="souki-skeleton h-[220px] w-full rounded-2xl md:h-[390px] md:w-[12rem] md:shrink-0 md:rounded-[28px]"
                      />
                    ))}
                  </div>
                  <div className="souki-skeleton h-24 rounded-[1.75rem]" />
                </div>
              ))}
            </div>
          )}

          {!showOrderHistory && !isFetching && error && (
            <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-600">
              {error}
            </div>
          )}

          {!showOrderHistory && !isFetching && !error && (
            <>
              {productsByCategory ? (
                <div
                  ref={revealRef}
                  id="catalogue-products"
                  className="space-y-12 scroll-mt-28"
                >
                  {([
                    { key: "legumes" as const, label: "Légumes", subtitle: "Frais du marché de gros" },
                    { key: "fruits" as const, label: "Fruits", subtitle: "Sucrés et de saison" },
                    { key: "herbes" as const, label: "Herbes", subtitle: "Aromates et fraîcheur" },
                  ] as const).map((section, sectionIndex) => {
                    const items = productsByCategory[section.key]
                    if (items.length === 0) return null
                    return (
                      <section key={section.key} id={`catalogue-cat-${section.key}`} className="scroll-mt-28">
                        <div
                          data-reveal="up"
                          data-delay={String((sectionIndex % 4) + 1)}
                          className="mb-4 flex items-end justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-[#5BD174] to-[#1E8A3C] md:hidden" />
                            <div>
                              <h3 className="text-lg font-bold text-[#264129]">{section.label}</h3>
                              <p className="text-sm text-[#6F8070]">{section.subtitle}</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-[#F0FAF1] px-3 py-1 text-xs font-bold text-[#1E8A3C]">
                            {items.length} produit{items.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:-mx-1 md:flex md:snap-x md:snap-mandatory md:gap-4 md:overflow-x-auto md:px-1 md:pb-3 md:scrollbar-none">
                          {items.map((product, index) => (
                            <div
                              key={product.id}
                              data-reveal="scale"
                              data-delay={String(((sectionIndex * 3 + index) % 4) + 1)}
                              className="w-full md:w-[12rem] md:shrink-0 md:snap-start"
                            >
                              <ProductCard
                                id={product.id}
                                name={product.name}
                                image={product.image}
                                price={product.price}
                                prixKhddarEstime={product.prix_khddar_estime}
                                niveau={product.niveau}
                                unit={product.unit}
                                displayUnit={product.displayUnit}
                                quantityStep={product.quantityStep}
                                stock={product.stock}
                                onView={openProductDetail}
                                variant="minimal"
                                isFavorite={isFavorite(product.id)}
                                onToggleFavorite={() => toggleFavorite(product.id)}
                                onAddToCart={handleAddToCart}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  })}

                  {filteredProducts.length === 0 && (
                    <div className="rounded-[28px] border border-[#E6EFE7] bg-white p-12 text-center">
                      <p className="text-[#6F8070]">Aucun produit disponible pour le moment.</p>
                    </div>
                  )}
                </div>
              ) : productsByLevel ? (
                <div
                  ref={revealRef}
                  id="catalogue-products"
                  className="space-y-12 scroll-mt-28"
                >
                  {([
                    { key: "level1" as const, label: "Essentiels", subtitle: "Les indispensables du quotidien" },
                    { key: "level2" as const, label: "Populaires", subtitle: "Les préférés de nos clients" },
                    { key: "level3" as const, label: "À découvrir", subtitle: "Des pépites à essayer" },
                  ] as const).map((section, sectionIndex) => {
                    const items = productsByLevel[section.key]
                    if (items.length === 0) return null
                    const interlude = sectionBreaks[sectionIndex]
                    return (
                      <Fragment key={section.key}>
                        <section>
                          <div
                            data-reveal="up"
                            data-delay={String((sectionIndex % 4) + 1)}
                            className="mb-4 flex items-end justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-[#5BD174] to-[#1E8A3C] md:hidden" />
                              <div>
                                <h3 className="text-lg font-bold text-[#264129]">{section.label}</h3>
                                <p className="text-sm text-[#6F8070]">{section.subtitle}</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-[#F0FAF1] px-3 py-1 text-xs font-bold text-[#1E8A3C]">
                              {items.length} produit{items.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:-mx-1 md:flex md:snap-x md:snap-mandatory md:gap-4 md:overflow-x-auto md:px-1 md:pb-3 md:scrollbar-none">
                            {items.map((product, index) => {
                              const delay = ((sectionIndex * 3 + index) % 4) + 1
                              return (
                                <div
                                  key={product.id}
                                  data-reveal="scale"
                                  data-delay={String(delay)}
                                  className="w-full md:w-[12rem] md:shrink-0 md:snap-start"
                                >
                                  <ProductCard
                                    id={product.id}
                                    name={product.name}
                                    image={product.image}
                                    price={product.price}
                                    prixKhddarEstime={product.prix_khddar_estime}
                                    niveau={product.niveau}
                                    unit={product.unit}
                                    displayUnit={product.displayUnit}
                                    quantityStep={product.quantityStep}
                                    stock={product.stock}
                                    onView={openProductDetail}
                                    variant="minimal"
                                    isFavorite={isFavorite(product.id)}
                                    onToggleFavorite={() => toggleFavorite(product.id)}
                                    onAddToCart={handleAddToCart}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </section>

                        {interlude && (
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-4">
                            <CatalogueTrustInterlude
                              icon={interlude.trust.icon}
                              eyebrow={interlude.trust.eyebrow}
                              title={interlude.trust.title}
                              description={interlude.trust.description}
                              tone={interlude.trust.tone}
                              delay={String((sectionIndex % 3) + 1)}
                            />
                            <CatalogueStatInterlude
                              label={interlude.stat.label}
                              value={interlude.stat.value}
                              tone={interlude.stat.tone}
                              delay={String((sectionIndex % 3) + 2)}
                            />
                          </div>
                        )}
                      </Fragment>
                    )
                  })}

                  {filteredProducts.length === 0 && (
                    <div className="rounded-[28px] border border-[#E6EFE7] bg-white p-12 text-center">
                      <p className="text-[#6F8070]">Aucun produit disponible pour le moment.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={revealRef}
                  id="catalogue-products"
                  className="scroll-mt-28"
                >
                  <div className="grid grid-cols-2 gap-3 md:-mx-1 md:flex md:snap-x md:snap-mandatory md:gap-4 md:overflow-x-auto md:px-1 md:pb-3 md:scrollbar-none">
                    {filteredProducts.map((product, index) => {
                      const delay = (index % 4) + 1
                      return (
                        <div
                          key={product.id}
                          data-reveal="scale"
                          data-delay={String(delay)}
                          className="w-full md:w-[12rem] md:shrink-0 md:snap-start"
                        >
                          <ProductCard
                            id={product.id}
                            name={product.name}
                            image={product.image}
                            price={product.price}
                            prixKhddarEstime={product.prix_khddar_estime}
                            niveau={product.niveau}
                            unit={product.unit}
                            displayUnit={product.displayUnit}
                            quantityStep={product.quantityStep}
                            stock={product.stock}
                            onView={openProductDetail}
                            variant="minimal"
                            isFavorite={isFavorite(product.id)}
                            onToggleFavorite={() => toggleFavorite(product.id)}
                            onAddToCart={handleAddToCart}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {filteredProducts.length === 0 && !productsByLevel && (
                <div className="rounded-[28px] border border-[#E6EFE7] bg-white p-12 text-center">
                  <p className="text-[#6F8070]">Aucun produit ne correspond à votre recherche.</p>
                </div>
              )}
            </>
          )}
        </main>

        <aside
          className={cn(
            "fixed right-0 top-0 z-50 flex h-[100dvh] w-[min(100vw,22rem)] flex-col border-l border-[#E6F0E7] bg-white will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] xl:sticky xl:top-20 xl:h-[calc(100vh-80px)] xl:w-[20rem] xl:translate-x-0 2xl:w-[22rem]",
            showCart
              ? "translate-x-0 shadow-[0_24px_70px_-20px_rgba(18,32,24,0.4)] xl:shadow-none"
              : "translate-x-full xl:translate-x-0"
          )}
        >
          <button
            onClick={() => setShowCart(false)}
            className="absolute right-4 top-4 rounded-xl p-2 text-[#264129] xl:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="border-b border-[#EEF2EE] p-4 xl:p-5">
            <div className="flex items-center gap-2 text-[#1E8A3C]">
              <ShoppingCart className="h-5 w-5" />
              <h2 className="text-xl font-black">Votre panier</h2>
            </div>
            <p className="mt-2 text-sm text-[#6F8070]">
              {isAuthenticated
                ? "Ajustez vos quantités puis validez votre commande."
                : "Le panier est réservé aux utilisateurs connectés."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 xl:p-4">
            {!isAuthenticated && !isLoading ? (
              <div className="rounded-[28px] border border-[#F3D8B2] bg-[#FFF7EE] p-5">
                <p className="text-sm font-semibold text-[#9A5C11]">
                  Connectez-vous pour utiliser le panier, modifier les quantités et commander.
                </p>
                <button
                  onClick={() => redirectToLogin("/catalogue")}
                  className="mt-4 w-full rounded-2xl bg-[#F07C00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D66B00]"
                >
                  Aller à la connexion
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="py-10 text-center animate-fade-in-up">
                <img
                  src="/illustrations/empty-basket.webp"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={144}
                  height={144}
                  aria-hidden="true"
                  className="mx-auto mb-3 h-36 w-36 object-contain animate-gentle-float"
                />
                <p className="text-[#6F8070]">Votre panier est vide.</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 shadow-sm">
                  {reste > 0 ? (
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold leading-snug text-[#264129]">
                        Plus que {reste.toFixed(2)} DH pour la livraison gratuite 🎁
                      </p>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#9A5C11]">
                        Livraison {FRAIS.toFixed(0)} DH
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[#1E8A3C]">Livraison offerte ✅</p>
                      <span className="shrink-0 rounded-full bg-[#F0FDF4] px-2.5 py-1 text-xs font-bold text-[#1E8A3C]">
                        Gratuite
                      </span>
                    </div>
                  )}

                  <div className="mt-3 w-full rounded-full bg-white h-2 ring-1 ring-gray-200">
                    <div
                      className="h-2 rounded-full bg-[#1E8A3C] transition-all duration-300"
                      style={{
                        width: `${progression}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-right text-[11px] font-semibold text-[#6F8070]">
                    {cartSubtotal.toFixed(2)} / {SEUIL.toFixed(0)} DH
                  </p>
                </div>

                {/* Produits deja selectionnes : toujours affiches en premier (haut du panier). */}
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-2xl border border-[#E6F0E7] bg-[#F7FCF7] p-3"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      onError={(event) => applyImageFallback(event, item.fallbackImage)}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover 2xl:h-16 2xl:w-16 2xl:rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[#264129]">{item.name}</h3>
                          <p className="text-xs text-[#6F8070]">
                            {item.price.toFixed(2)} DH / {item.displayUnit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="rounded-full p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex shrink-0 items-center rounded-full border border-[#CDE8D0] bg-white">
                          <button
                            onClick={() => updateCartQuantity(item.id, -item.quantityStep)}
                            className="p-1.5 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] disabled:cursor-not-allowed disabled:opacity-40 2xl:p-2"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[72px] px-2 text-center text-xs font-semibold text-[#264129] 2xl:min-w-[90px] 2xl:px-3">
                            {formatQuantity(item.quantity, item.unit)}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantityStep)}
                            className="p-1.5 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] disabled:cursor-not-allowed disabled:opacity-40 2xl:p-2"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="ml-auto shrink-0 text-sm font-bold text-[#F07C00]">
                          {(item.price * item.quantity).toFixed(2)} DH
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Suggestions / upsell : section du bas, apres les produits choisis. */}
                {pricingSuggestions.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 shadow-sm">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="h-px flex-1 bg-gray-200" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        À ne pas manquer
                      </span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {pricingSuggestions.map((suggestion) => {
                        const niveau = suggestion.niveau || 2
                        const isInCart = cart.some((item) => item.id === suggestion.id)
                        const isFeaturedLevelTwo = niveau === 2 && suggestion.id === firstLevelTwoSuggestionId
                        const resteSuggestions = Math.max(0, SEUIL - cartSubtotal)
                        const suffitPourSeuil = resteSuggestions > 0 && suggestion.price >= resteSuggestions

                        return (
                        <div
                          key={suggestion.id}
                          className={cn(
                            "overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
                            niveau === 3
                              ? "border-2 border-amber-400"
                              : isFeaturedLevelTwo
                                ? "border-2 border-[#1E8A3C]"
                                : "border-gray-200"
                          )}
                        >
                          <div className="relative flex aspect-square items-center justify-center bg-gray-50">
                            <img
                              src={suggestion.image}
                              alt={suggestion.name}
                              onError={(event) => applyImageFallback(event, suggestion.fallbackImage)}
                              className="h-full w-full object-cover"
                            />
                            <span className={cn(
                              "absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold",
                              suffitPourSeuil
                                ? "bg-amber-100 text-amber-700"
                                : "hidden"
                            )}>
                              Suffit pour livraison gratuite
                            </span>
                            {suggestion.prix_khddar_estime && (
                              <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-gray-400 line-through">
                                {suggestion.prix_khddar_estime.toFixed(2)} DH
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="truncate text-[13px] font-medium text-[#264129]">
                              {suggestion.name}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-gray-400">
                              Ajout malin pour compléter ton panier
                            </p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="text-[15px] font-medium text-[#1E8A3C]">
                                {suggestion.price.toFixed(2)} DH
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddSuggestionToCart(suggestion)}
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                                  isInCart
                                    ? "border-[#1E8A3C] bg-[#1E8A3C] text-white"
                                    : "border-gray-300 bg-white text-[#264129] hover:border-[#1E8A3C] hover:text-[#1E8A3C]"
                                )}
                                aria-label={`Ajouter ${suggestion.name}`}
                              >
                                {isInCart ? "✓" : "+"}
                              </button>
                            </div>
                          </div>
                        </div>
                        )
                      })}
                    </div>

                    {cart.length > 0 && addedSuggestionItems.length > 0 && (
                      <div className="mt-4 flex items-center gap-3 rounded-xl border border-green-200 bg-[#F0FDF4] px-4 py-3">
                        <Leaf className="h-5 w-5 shrink-0 text-[#1E8A3C]" />
                        <p className="text-sm font-semibold text-[#264129]">
                          Tu économises {suggestionSavings.toFixed(2)} DH vs le khddar sur cette sélection 🌿
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isAuthenticated && cart.length > 0 && (
            <div className="border-t border-[#EEF2EE] p-4 xl:p-5">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-[#6F8070]">
                  <span>Sous-total</span>
                  <span className="font-semibold text-[#264129]">{cartSubtotal.toFixed(2)} DH</span>
                </div>
                <div className="flex items-center justify-between text-[#6F8070]">
                  <span>Livraison</span>
                  <span className="font-semibold text-[#264129]">
                    {cartDeliveryFee > 0 ? `${cartDeliveryFee.toFixed(2)} DH` : "Offerte ✅"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#EEF2EE] pt-4">
                <span className="text-lg font-black text-[#264129]">Total</span>
                <span className="text-xl font-black text-[#F07C00] 2xl:text-2xl">{cartTotal.toFixed(2)} DH</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isSubmittingCart}
                className="mt-5 w-full rounded-2xl bg-[#F07C00] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#D66B00] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmittingCart ? "Validation en cours..." : "Valider la commande"}
              </button>

              <p className="mt-3 text-center text-xs text-[#6F8070]">
                Livraison demain pour garantir la fraîcheur.
              </p>
            </div>
          )}
        </aside>
      </div>

      {(showSidebar || showCart) && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-300 xl:hidden"
          onClick={() => {
            setShowSidebar(false)
            setShowCart(false)
          }}
        />
      )}

      {/* ===== BARRE PANIER STICKY (mobile) : acces checkout a portee de pouce =====
          Visible quand le panier contient des articles et que le tiroir panier est
          ferme. Remonte au-dessus de la barre de navigation. md:hidden via le
          primitif StickyBottomBar (desktop inchange). */}
      {isAuthenticated && cart.length > 0 && !showCart && (
        <StickyBottomBar aboveNav>
          <button
            type="button"
            onClick={() => {
              haptic("medium")
              setShowCart(true)
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#F07C00] px-4 py-3.5 text-white shadow-[0_12px_28px_-14px_rgba(240,124,0,0.8)] active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-1.5 text-[13px] font-black">
                {cart.length}
              </span>
              <span className="text-[15px] font-black">Voir le panier</span>
            </span>
            <span className="flex items-center gap-1.5 text-[15px] font-black souki-tabular-nums">
              {cartTotal.toFixed(2)} DH
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </StickyBottomBar>
      )}

      {/* Pas de onMenuClick ici : le bouton « Plus » ouvre le tiroir standard
          (Historique, Wallet, Profil…) au lieu de l'ancienne barre latérale
          gauche, redondante sur mobile (recherche + catégories déjà en tête). */}
      <MobileBottomNav
        cartCount={cart.length}
        onCartClick={() => setShowCart(true)}
      />

      <ProductDetailSheet
        product={detailProduct}
        open={detailProduct !== null}
        onClose={() => setDetailProduct(null)}
        onAddToCart={handleAddToCart}
        isFavorite={detailProduct ? isFavorite(detailProduct.id) : false}
        onToggleFavorite={() => detailProduct && toggleFavorite(detailProduct.id)}
      />

      <AIModals
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        mode={activeModal}
        products={products}
        onApplySelections={handleApplySelections}
      />

      {pendingDeleteOrderId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122018]/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[#F3D8B2] bg-white p-5 shadow-[0_30px_90px_rgba(18,32,24,0.25)]">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7EE] text-[#F07C00]">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-[#264129]">Supprimer cette commande ?</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#6F8070]">
                  La commande N-{pendingDeleteOrderId} sera retiree de votre historique local. Vos donnees de paiement et de livraison ne changent pas.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteOrderId(null)}
                disabled={deletingOrderId === pendingDeleteOrderId}
                className="rounded-2xl border border-[#DDE7DE] px-5 py-3 text-sm font-bold text-[#607061] transition-colors hover:bg-[#F7FCF7] disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteOrderHistory()}
                disabled={deletingOrderId === pendingDeleteOrderId}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deletingOrderId === pendingDeleteOrderId ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {claimOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122018]/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-[#DDEBDD] bg-white p-5 shadow-[0_30px_90px_rgba(18,32,24,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F07C00]">
                  SAV Wallet
                </p>
                <h3 className="mt-1 text-2xl font-black text-[#264129]">
                  Signaler un problème
                </h3>
                <p className="mt-1 text-sm text-[#6F8070]">
                  Commande N-{claimOrder.id} · remboursement crédité sur votre wallet SOUKI.
                </p>
              </div>
              <button
                onClick={closeClaimModal}
                disabled={isSubmittingClaim}
                className="rounded-2xl border border-[#E4ECE4] p-2 text-[#6F8070] transition-colors hover:bg-[#F7FCF7] disabled:opacity-60"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-[#264129]">Produit concerné</span>
                <select
                  value={claimLineId ?? ""}
                  onChange={(event) => {
                    const nextLineId = Number(event.target.value)
                    const nextLine = claimableLines.find((line) => line.ligne_panier_id === nextLineId)
                    setClaimLineId(Number.isFinite(nextLineId) ? nextLineId : null)
                    setClaimQuantity(nextLine ? String(Math.min(1, nextLine.quantite_kg)) : "1")
                  }}
                  className="mt-2 w-full rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#264129] outline-none focus:border-[#4CB84A]"
                >
                  {claimableLines.map((line) => (
                    <option key={line.ligne_panier_id} value={line.ligne_panier_id ?? ""}>
                      {line.nom_fr} · {formatQuantity(line.quantite_kg, "kg")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-[#264129]">Quantité à rembourser</span>
                  <input
                    type="number"
                    min="0.001"
                    max={selectedClaimLine?.quantite_kg ?? undefined}
                    step="0.001"
                    value={claimQuantity}
                    onChange={(event) => setClaimQuantity(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#264129] outline-none focus:border-[#4CB84A]"
                  />
                  {selectedClaimLine && (
                    <p className="mt-1 text-xs font-semibold text-[#7B8B7D]">
                      Maximum: {formatQuantity(selectedClaimLine.quantite_kg, "kg")}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-[#264129]">Raison</span>
                  <select
                    value={claimReason}
                    onChange={(event) => setClaimReason(event.target.value as ClaimReason)}
                    className="mt-2 w-full rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#264129] outline-none focus:border-[#4CB84A]"
                  >
                    {claimReasonOptions.map((reason) => (
                      <option key={reason.id} value={reason.id}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-[#F3D8B2] bg-[#FFF7EE] p-4 text-sm text-[#7A4C0E]">
                Le remboursement est automatiquement crédité sur votre wallet SOUKI. Aucun remboursement CB ou cash
                n'est propose pour ce parcours.
              </div>

              {claimError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {claimError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={closeClaimModal}
                  disabled={isSubmittingClaim}
                  className="rounded-2xl border border-[#DDE7DE] px-5 py-3 text-sm font-bold text-[#607061] transition-colors hover:bg-[#F7FCF7] disabled:opacity-60"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void handleSubmitClaim()}
                  disabled={isSubmittingClaim || !selectedClaimLine}
                  className="rounded-2xl bg-[#1E8A3C] px-5 py-3 text-sm font-black text-white transition-colors hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmittingClaim ? "Envoi en cours..." : "Crediter mon wallet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CataloguePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FBFDF9] flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1E8A3C] border-t-transparent" />
        </div>
      }
    >
      <CatalogueContent />
    </Suspense>
  )
}
