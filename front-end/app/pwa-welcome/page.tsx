"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Mic,
  Plus,
  Search,
  ShoppingBasket,
  Sprout,
  Truck,
  Leaf,
} from "lucide-react"

import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import type { CatalogueProduct } from "@/lib/catalogue"
import {
  fetchCatalogueProducts,
  FREE_DELIVERY_THRESHOLD,
  getCataloguePresentation,
  isIllustrationImage,
  loadStoredCart,
  resolveCatalogueImage,
  saveStoredCart,
  upsertCartItem,
} from "@/lib/catalogue"
import { fetchPersonalizedSuggestions } from "@/lib/api"
import type { CatalogueProductDTO } from "@/lib/api"
import { isPwaStandalone } from "@/lib/pwa"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useFavorites } from "@/hooks/useFavorites"
import { useHaptic } from "@/hooks/useHaptic"
import { useScrollReveal } from "@/hooks/useScrollReveal"
import { shouldShowOnboarding } from "@/lib/onboarding"

type SuggestionLevel = {
  id: 1 | 2 | 3
  title: string
  subtitle: string
  products: CatalogueProduct[]
}

const CATALOGUE_REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Placeholders de recherche qui defilent (effet "marketplace vivante").
const SEARCH_HINTS = [
  "Tomates fraîches…",
  "Pommes de terre…",
  "Menthe & coriandre…",
  "Oranges de saison…",
  "Courgettes du jour…",
]

// Rail de categories facon Glovo, reinterprete pour le marche frais.
// Chaque tuile filtre reellement le catalogue (deep-link ?category=).
const CATEGORY_TILES = [
  { label: "Tout le marché", href: "/catalogue", emoji: "🧺", from: "#1E8A3C", to: "#2DA050" },
  { label: "Légumes", href: "/catalogue?focus=legumes", emoji: "🥬", from: "#2DA050", to: "#7BC96F" },
  { label: "Fruits", href: "/catalogue?focus=fruits", emoji: "🍊", from: "#F07C00", to: "#FFB347" },
  { label: "Herbes", href: "/catalogue?focus=herbes", emoji: "🌿", from: "#1A4F2C", to: "#4CB84A" },
] as const

// Heure de clôture des commandes du jour (20h) : au-delà, on décompte vers
// la clôture du lendemain. 100% présentation — aucun appel réseau.
const DAILY_CUTOFF_HOUR = 20

type Countdown = { hours: number; minutes: number; seconds: number; closed: boolean }

function computeCountdown(): Countdown {
  const now = new Date()
  const target = new Date(now)
  target.setHours(DAILY_CUTOFF_HOUR, 0, 0, 0)
  let closed = false
  if (target.getTime() <= now.getTime()) {
    // Clôture déjà passée : on vise 20h le lendemain.
    target.setDate(target.getDate() + 1)
    closed = true
  }
  const diff = target.getTime() - now.getTime()
  return {
    hours: Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    closed,
  }
}

// Décompte vivant vers la clôture du jour (mis à jour chaque seconde,
// initialisé côté client pour éviter tout écart d'hydratation).
function useDailyCutoff(): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(null)
  useEffect(() => {
    setCountdown(computeCountdown())
    const id = window.setInterval(() => setCountdown(computeCountdown()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return countdown
}

const pad = (value: number) => value.toString().padStart(2, "0")

// Mappe un produit renvoye par l'API vers le modele d'affichage du catalogue
// (image resolue, prix affiche, unite de presentation...).
function mapDtoToCatalogueProduct(dto: CatalogueProductDTO): CatalogueProduct {
  const presentation = getCataloguePresentation(dto.nom_fr)
  return {
    id: dto.id,
    name: dto.nom_fr,
    alias: dto.nom_darija,
    price: dto.prix_affiche ?? dto.prix_kg,
    prix_khddar_estime: dto.prix_khddar_estime,
    niveau: dto.niveau,
    unit: dto.unite,
    displayUnit: presentation.displayUnit || dto.unite,
    image: resolveCatalogueImage(dto.nom_fr, dto.image_url),
    fallbackImage: presentation.image,
    category: presentation.category,
    quantityStep: presentation.quantityStep || (dto.unite === "kg" ? 0.5 : 1),
    stock: dto.stock,
  }
}

export default function PwaWelcomePage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isLoading } = useAuth()
  const [isReady, setIsReady] = useState(false)
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [personalized, setPersonalized] = useState<CatalogueProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [addedProductId, setAddedProductId] = useState<number | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [hintIndex, setHintIndex] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)
  // Reveal au scroll des sections sous la ligne de flottaison (fail-safe :
  // le contenu reste visible si l'observer ne se declenche pas).
  const revealRef = useScrollReveal<HTMLElement>()
  const haptic = useHaptic()
  const { favorites: favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const cutoff = useDailyCutoff()

  // PWA standalone check
  useEffect(() => {
    const canPreviewInDevelopment =
      process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("preview") === "pwa"

    if (!isPwaStandalone() && !canPreviewInDevelopment) {
      router.replace("/")
      return
    }

    setIsReady(true)
  }, [router])

  // Session guard : sans session active, l'entree PWA affiche la page de choix
  // de profil (/login) au lieu de l'accueil. On attend la fin de la resolution
  // de session (isLoading) pour ne pas ejecter un utilisateur connecte.
  useEffect(() => {
    if (isReady && !isLoading && !isAuthenticated) {
      router.replace("/login?redirect=/pwa-welcome")
    }
  }, [isReady, isLoading, isAuthenticated, router])

  // Onboarding guard: redirect authenticated first-time users to onboarding.
  // L'etat vient du compte (serveur), pas de l'appareil : un habitue qui installe
  // l'app sur un nouveau telephone ne repasse plus par l'onboarding.
  useEffect(() => {
    if (isReady && isAuthenticated && shouldShowOnboarding(user)) {
      router.replace("/onboarding")
    }
  }, [isReady, isAuthenticated, user, router])

  const [reduceMotion, setReduceMotion] = useState(false)

  // Respecte prefers-reduced-motion pour tout mouvement piloté en JS (parallax).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduceMotion(mq.matches)
    const handler = (event: MediaQueryListEvent) => setReduceMotion(event.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Parallax scroll listener
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Placeholder de recherche qui change toutes les 2.6s
  useEffect(() => {
    const interval = window.setInterval(
      () => setHintIndex((i) => (i + 1) % SEARCH_HINTS.length),
      2600,
    )
    return () => window.clearInterval(interval)
  }, [])

  // Load catalogue
  useEffect(() => {
    if (!isReady) return

    let isMounted = true

    const loadCatalogue = async (showLoader = false) => {
      try {
        if (showLoader) setIsFetching(true)
        const catalogue = await fetchCatalogueProducts()
        if (!isMounted) return
        setProducts(catalogue.filter((p) => p.stock > 0))
      } catch {
        // silently fail
      } finally {
        if (isMounted && showLoader) setIsFetching(false)
      }
    }

    void loadCatalogue(true)
    const interval = window.setInterval(() => { void loadCatalogue() }, CATALOGUE_REFRESH_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [isReady])

  // Load personalized suggestions (serveur : favoris + achats mis en avant)
  useEffect(() => {
    if (!isReady || !token) return

    let isMounted = true

    const loadPersonalized = async () => {
      const dtos = await fetchPersonalizedSuggestions(token)
      if (!isMounted) return
      setPersonalized(dtos.map(mapDtoToCatalogueProduct))
    }

    void loadPersonalized()
    return () => { isMounted = false }
  }, [isReady, token])

  // Favoris explicites (coeur) presents dans le catalogue courant, reactifs au toggle.
  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteIds.includes(product.id)),
    [products, favoriteIds],
  )

  // Category suggestions
  const levels = useMemo<SuggestionLevel[]>(() => {
    const byLevel = (level: 1 | 2 | 3) =>
      products
        .filter((p) => p.niveau === level)
        .sort((a, b) => b.stock - a.stock || a.price - b.price)
        .slice(0, 10)

    return [
      { id: 1 as const, title: "Essentiels du panier", subtitle: "Les indispensables de la semaine", products: byLevel(1) },
      { id: 2 as const, title: "Les plus commandés", subtitle: "Ce que les familles de Fès adorent", products: byLevel(2) },
      { id: 3 as const, title: "Frais à découvrir", subtitle: "Nouveautés et produits de saison", products: byLevel(3) },
    ]
  }, [products])

  const handleQuickAdd = (product: CatalogueProduct) => {
    const cart = loadStoredCart()
    const updated = upsertCartItem(cart, product, product.quantityStep)
    saveStoredCart(updated)
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(null), 1200)
    haptic("medium")
  }

  // Toucher un produit emmene sur la page Produits, fiche ouverte : l'utilisateur
  // y trouve la description et enchaine ses achats sans revenir a l'accueil.
  const handleOpenProduct = (product: CatalogueProduct) => {
    haptic("light")
    router.push(`/catalogue?product=${product.id}`)
  }

  const handleToggleFavorite = (id: number) => {
    toggleFavorite(id)
    haptic("medium")
  }

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = searchValue.trim()
    router.push(query ? `/catalogue?q=${encodeURIComponent(query)}` : "/catalogue")
  }

  const isReturningUser = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("souki_has_logged_in") === "true"
  }, [])

  const userName = useMemo(() => {
    if (!user) return null
    if (user.email) {
      const name = user.email.split("@")[0]
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
    if (user.phone) return user.phone
    return null
  }, [user])

  // Salutation contextuelle : rythmée par l'heure locale (matin/après-midi/soir)
  // et par le fait que l'utilisateur soit un habitué. Rendu 100% client (post-mount),
  // donc aucun risque d'écart d'hydratation.
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (isReturningUser) return hour < 12 ? "Rebonjour" : hour < 18 ? "Ravis de vous revoir" : "Rebonsoir"
    return hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir"
  }, [isReturningUser])

  // Date du jour formatée (« mardi 20 juillet ») pour ancrer l'en-tête dans le réel.
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    [],
  )

  // Décalage de parallax : neutralisé si l'utilisateur préfère moins d'animations.
  const heroShift = reduceMotion ? 0 : scrollY

  // Splash tant que le mode standalone ou la session ne sont pas confirmes :
  // l'accueil PWA ne doit jamais apparaitre sans session (redirection /login).
  if (!isReady || isLoading || !isAuthenticated) {
    return (
      <main className="min-h-dvh bg-[#F5F5F0]" aria-label="Chargement">
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-[#1E8A3C]" />
        </div>
      </main>
    )
  }

  return (
    <main ref={revealRef} className="min-h-dvh bg-[#F2F6F3] text-[#3D3D3D] font-sans">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-24 md:pb-0">

        {/* ===== HEADER — vitrine « app store » : dégradé profond, texture botanique,
             médaillon-mascotte, salutation contextuelle (panier retiré) ===== */}
        <div
          ref={heroRef}
          className="relative overflow-hidden rounded-b-[40px] bg-gradient-to-br from-[#0A2814] via-[#14522A] to-[#1E8A3C] shadow-[0_22px_50px_-24px_rgba(10,40,20,0.85)]"
        >
          {/* Lumière zénithale (donne du relief au sommet) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/12 to-transparent" />
          {/* Halos colorés — profondeur douce, dérive lente au scroll (parallax) */}
          <div
            className="pointer-events-none absolute inset-0 will-change-transform"
            style={{ transform: `translateY(${heroShift * 0.14}px)` }}
          >
            <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[#5BD174]/30 blur-3xl" />
            <div className="absolute -left-16 top-10 h-48 w-48 rounded-full bg-[#0A2814]/60 blur-3xl" />
            <div className="absolute -bottom-10 right-4 h-40 w-40 rounded-full bg-[#F5C400]/12 blur-3xl" />
          </div>
          {/* Trame de points fins — texture premium quasi imperceptible */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #FFFFFF 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
          {/* Aurore : bande de lumière diagonale qui dérive lentement sur le dégradé */}
          <div className="pointer-events-none absolute -inset-y-10 left-0 z-0 w-1/2 animate-pwa-aurora bg-gradient-to-r from-transparent via-white/20 to-transparent blur-md" />

          {/* Feuilles flottantes — rares, douces, identité Récolte (parallax rapide) */}
          <div
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden will-change-transform"
            style={{ transform: `translateY(${heroShift * 0.3}px)` }}
          >
            {[...Array(3)].map((_, i) => (
              <Leaf
                key={i}
                className="absolute text-[#A7D7B5] animate-falling-leaf motion-reduce:hidden"
                style={{
                  left: `${20 + i * 26}%`,
                  top: "-15%",
                  animationDelay: `${i * 2.2}s`,
                  animationDuration: `${7 + (i % 3) * 2}s`,
                  width: `${13 + (i % 3) * 4}px`,
                  height: `${13 + (i % 3) * 4}px`,
                  opacity: 0.2 + (i % 3) * 0.08,
                }}
                strokeWidth={1.5}
                fill="currentColor"
              />
            ))}
          </div>

          <header
            className="relative z-10 px-5 pb-8 pt-[max(env(safe-area-inset-top),1.25rem)] will-change-transform"
            style={{
              transform: `translateY(${heroShift * 0.12}px)`,
              opacity: reduceMotion ? 1 : Math.max(1 - scrollY / 700, 0.55),
            }}
          >
            {/* Ligne 1 : pilule de localisation (verre dépoli) + favoris + profil */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push("/parametres")}
                className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3.5 ring-1 ring-white/20 backdrop-blur-md transition-transform active:scale-95 animate-slide-in-down"
                aria-label="Adresse de livraison"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <MapPin className="h-4 w-4 text-[#9BE7AE]" />
                </span>
                <span className="flex flex-col items-start leading-none">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#9BE7AE]">Livraison à</span>
                  <span className="mt-1 flex items-center gap-0.5 text-[14px] font-black text-white drop-shadow-sm">
                    Fès, Maroc
                    <ChevronDown className="h-3.5 w-3.5 text-white/80" />
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => router.push("/favoris")}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-md transition-transform active:scale-90 animate-bounce-in"
                  aria-label="Mes favoris"
                >
                  <Heart className="h-5 w-5" />
                  {favoriteIds.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E4405F] px-1 text-[10px] font-black text-white ring-2 ring-[#0F3F21]">
                      {favoriteIds.length}
                    </span>
                  )}
                </button>
                {isAuthenticated && userName && (
                  <button
                    onClick={() => router.push("/parametres")}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#F4FFF6] to-[#C4EBCF] text-[15px] font-black text-[#14522A] shadow-lg ring-2 ring-white/40 transition-transform active:scale-90 animate-bounce-in"
                    aria-label="Profil et paramètres"
                  >
                    {userName.charAt(0).toUpperCase()}
                  </button>
                )}
              </div>
            </div>

            {/* Ligne 2 : salutation contextuelle + médaillon-mascotte (pièce maîtresse) */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 animate-slide-in-up">
                {/* Éyebrow live : statut du marché ancré dans la date du jour */}
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-2 pr-3 ring-1 ring-white/15 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    {!cutoff?.closed && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7BE495] opacity-75 motion-reduce:hidden" />
                    )}
                    <span className={cn("relative inline-flex h-2 w-2 rounded-full", cutoff?.closed ? "bg-[#F5C400]" : "bg-[#4CB84A]")} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#CDEBD6]">
                    {cutoff?.closed ? "Livraison en préparation" : "Marché ouvert"} · {todayLabel}
                  </span>
                </span>

                <h1 className="mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-white drop-shadow-md">
                  {greeting} 👋
                </h1>
                {userName && (
                  <p className="mt-0.5 text-[24px] font-black leading-tight tracking-tight">
                    <span
                      className="animate-pwa-text-sheen bg-clip-text text-transparent"
                      style={{
                        backgroundImage:
                          "linear-gradient(110deg, #7BE495 18%, #FFFFFF 42%, #EAFBEF 50%, #FFFFFF 58%, #7BE495 82%)",
                      }}
                    >
                      {userName}
                    </span>
                  </p>
                )}
                <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-[#CDEBD6] drop-shadow-sm">
                  <Truck className="h-4 w-4 shrink-0 text-[#9BE7AE]" />
                  Vos courses fraîches, livrées demain matin.
                </p>
              </div>

              {/* Médaillon de la mascotte — verre dépoli, halo étagé, accent feuille */}
              <div className="relative shrink-0 animate-bounce-in">
                <span className="pointer-events-none absolute inset-0 -m-2 rounded-full bg-[#7BE495]/25 blur-xl" />
                {/* Anneau conique « comète » qui tourne lentement autour du médaillon */}
                <span
                  className="pointer-events-none absolute inset-0 -m-[3px] rounded-full animate-pwa-ring-spin"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, #7BE495 60deg, transparent 140deg, #F5C400 210deg, transparent 280deg, #4CB84A 330deg, transparent 360deg)",
                    WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                    mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                  }}
                />
                <span className="pointer-events-none absolute inset-0 -m-0.5 rounded-full bg-gradient-to-br from-white/50 to-white/0" />
                <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full bg-gradient-to-b from-white/25 to-white/5 ring-1 ring-white/30 shadow-[0_18px_34px_-16px_rgba(0,0,0,0.55)] backdrop-blur-sm">
                  <FarmerAvatar
                    size="md"
                    expression="welcome"
                    label="Souki farmer guide"
                    className="animate-gentle-float drop-shadow-xl"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FFB347] to-[#F07C00] shadow-md ring-[3px] ring-[#0F3F21]">
                    <Leaf className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                  </span>
                </div>
              </div>
            </div>

            {/* Ligne 3 : BARRE DE RECHERCHE (element cle, absente avant) */}
            <form onSubmit={handleSearchSubmit} className="mt-6 animate-slide-in-up" role="search">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 shadow-[0_14px_34px_-14px_rgba(0,0,0,0.5)] ring-1 ring-black/[0.04] transition-all duration-300 focus-within:ring-2 focus-within:ring-[#1E8A3C]/40 focus-within:shadow-[0_16px_40px_-12px_rgba(30,138,60,0.5)]">
                <Search className="h-5 w-5 shrink-0 text-[#1E8A3C] transition-colors" />
                <div className="relative flex-1">
                  <input
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    aria-label="Rechercher un produit frais"
                    className="peer w-full bg-transparent text-[15px] font-semibold text-[#264129] outline-none placeholder:text-transparent"
                  />
                  {searchValue.length === 0 && (
                    <span
                      key={hintIndex}
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[15px] font-medium text-[#9BB29E] animate-fade-in"
                    >
                      {SEARCH_HINTS[hintIndex]}
                    </span>
                  )}
                </div>
                {searchValue.trim().length > 0 && (
                  <button
                    type="submit"
                    className="rounded-xl bg-[#1E8A3C] px-3 py-1.5 text-xs font-black text-white active:scale-95"
                  >
                    OK
                  </button>
                )}
              </div>
            </form>
          </header>
        </div>

        {/* Hairline signature : filet de lumière qui balaie doucement sous l'en-tête */}
        <div className="mx-auto -mt-px h-[3px] w-32 overflow-hidden rounded-full opacity-80">
          <div
            className="h-full w-full animate-pwa-hairline rounded-full"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent 0%, #4CB84A 35%, #F5C400 50%, #4CB84A 65%, transparent 100%)",
            }}
          />
        </div>

        {/* ===== HERO — OFFRE DU JOUR + DÉCOMPTE DE CLÔTURE (20h) ===== */}
        <div className="mt-5 px-4" data-reveal="up">
          <div className="relative overflow-hidden rounded-[28px] shadow-[0_22px_44px_-24px_rgba(17,59,30,0.55)]">
            <img
              src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900&q=80"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Voile vert : lisibilité du texte, du foncé (gauche) au transparent (droite) */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B2A15]/95 via-[#113B1E]/85 to-[#113B1E]/25" />

            <div className="relative z-10 flex flex-col gap-3.5 p-5">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#F07C00] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-sm">
                <Clock className="h-3.5 w-3.5" />
                Offre du jour
              </span>

              <div>
                <h2 className="text-[22px] font-black leading-tight text-white drop-shadow-sm">
                  Le marché ferme à 20h
                </h2>
                <p className="mt-1 max-w-[16rem] text-[13px] font-medium leading-snug text-[#D3EEDB]">
                  Commandez ce soir, livré demain entre 8h et 13h — frais du marché de gros.
                </p>
              </div>

              {/* Chips de décompte (façon "Flash Deal") — vivant, mis à jour chaque seconde */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#A7D7B5]">
                  {cutoff?.closed ? "Réouverture dans" : "Clôture dans"}
                </span>
                <span className="flex items-center gap-1" aria-hidden="true">
                  {cutoff ? (
                    [pad(cutoff.hours), pad(cutoff.minutes), pad(cutoff.seconds)].map((segment, index) => (
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 && <span className="text-sm font-black text-white/70">:</span>}
                        <span
                          className={cn(
                            "min-w-[26px] rounded-lg bg-white/15 px-1.5 py-1 text-center text-[15px] font-black tabular-nums text-white ring-1 ring-white/20 backdrop-blur",
                            index === 2 && "animate-pwa-tick-pulse",
                          )}
                        >
                          {segment}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="min-w-[26px] rounded-lg bg-white/15 px-3 py-1 text-[15px] font-black text-white/70">—</span>
                  )}
                </span>
              </div>

              <button
                onClick={() => router.push("/catalogue")}
                className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-black text-[#1A4F2C] shadow-[0_12px_26px_-12px_rgba(0,0,0,0.5)] transition-transform active:scale-95"
              >
                Composer mon panier
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ===== RAIL DE CATEGORIES (decouverte facon Glovo) ===== */}
        <div className="mt-6 animate-slide-in-up">
          <div className="flex gap-3.5 overflow-x-auto px-4 pb-1 scrollbar-none snap-x snap-mandatory">
            {CATEGORY_TILES.map((tile) => (
              <button
                key={tile.label}
                type="button"
                onClick={() => router.push(tile.href)}
                className="group flex w-[84px] shrink-0 snap-start flex-col items-center gap-2 transition-transform active:scale-95"
              >
                <span
                  className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[22px] text-[28px] ring-1 ring-white/50 transition-all duration-300 group-active:scale-90 group-active:shadow-inner"
                  style={{
                    background: `linear-gradient(145deg, ${tile.from}, ${tile.to})`,
                    boxShadow: `0 14px 26px -12px ${tile.from}A6, inset 0 1px 1px rgba(255,255,255,0.5)`,
                  }}
                >
                  {/* Reflet en haut — donne le relief d'une vraie icône d'app */}
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
                  <span className="relative drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 group-active:scale-110">
                    {tile.emoji}
                  </span>
                </span>
                <span className="text-center text-[12px] font-bold leading-tight text-[#3D3D3D]">{tile.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== ACTIONS IA (Panier Intelligent + Commande Vocale) ===== */}
        <div className="mt-6 px-4 animate-slide-in-up">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push("/catalogue?assistant=smart")}
              className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-3xl border border-[#1E8A3C]/10 bg-white p-4 shadow-[0_14px_34px_-22px_rgba(30,138,60,0.4)] transition active:scale-[0.97] active:shadow-inner"
            >
              <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#1E8A3C]/[0.07]" />
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E8A3C]/10">
                <ShoppingBasket className="h-6 w-6 text-[#1E8A3C]" />
              </span>
              <span className="relative text-left">
                <span className="block text-[15px] font-black leading-tight text-[#3D3D3D]">Panier Intelligent</span>
                <span className="mt-0.5 block text-[12px] font-medium text-gray-400">L&apos;IA compose pour vous</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/catalogue?assistant=voice")}
              className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-3xl border border-[#F07C00]/10 bg-white p-4 shadow-[0_14px_34px_-22px_rgba(240,124,0,0.4)] transition active:scale-[0.97] active:shadow-inner"
            >
              <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#F07C00]/[0.07]" />
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F07C00]/10">
                <Mic className="h-6 w-6 text-[#F07C00]" />
              </span>
              <span className="relative text-left">
                <span className="block text-[15px] font-black leading-tight text-[#3D3D3D]">Commande Vocale</span>
                <span className="mt-0.5 block text-[12px] font-medium text-gray-400">Dictez votre marché</span>
              </span>
            </button>
          </div>

          {/* Bulle d'aide du fermier */}
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#1E8A3C]/10 bg-gradient-to-r from-[#F0FAF1] to-white px-4 py-3 shadow-[0_10px_28px_-22px_rgba(30,138,60,0.5)] animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <FarmerAvatar size="sm" expression="explain" />
            <p className="flex-1 text-[13px] font-semibold leading-snug text-[#3D3D3D]">
              Appuyez pour laisser notre IA composer votre marché du jour !
            </p>
          </div>
        </div>

        {/* ===== BANNIERE LIVRAISON GRATUITE ===== */}
        <div className="mt-6 px-4" data-reveal="up">
          <div className="relative flex items-center gap-3.5 overflow-hidden rounded-3xl border border-[#FFC244]/40 bg-gradient-to-r from-[#FFF9EB] to-[#FFF3D6] px-4 py-3.5 shadow-[0_12px_30px_-22px_rgba(240,124,0,0.5)]">
            <span className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#FFC244]/20 blur-xl" />
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFC244]/25">
              <Truck className="h-6 w-6 text-[#F07C00]" />
            </div>
            <div className="relative flex-1">
              <p className="text-[15px] font-black leading-tight text-[#3D3D3D]">Livraison gratuite dès {FREE_DELIVERY_THRESHOLD} DH</p>
              <p className="mt-0.5 text-[13px] font-medium text-[#3D3D3D]/70">Demain matin, frais et local</p>
            </div>
          </div>
        </div>

        {/* ===== VOS PRODUITS PREFERES (favoris explicites) ===== */}
        {favoriteProducts.length > 0 && (
          <CarouselSection
            title="Vos produits préférés"
            subtitle="Vos coups de cœur, prêts à ajouter"
            onSeeAll={() => router.push("/favoris")}
          >
            {favoriteProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isAdded={addedProductId === product.id}
                onQuickAdd={handleQuickAdd}
                onOpen={handleOpenProduct}
                isFavorite={isFavorite(product.id)}
                onToggleFavorite={() => handleToggleFavorite(product.id)}
              />
            ))}
          </CarouselSection>
        )}

        {/* ===== RECOMMANDE POUR VOUS (personnalise : favoris + achats) ===== */}
        {personalized.length > 0 && (
          <CarouselSection
            title="Recommandé pour vous"
            subtitle="D'après vos favoris et vos achats"
            onSeeAll={() => router.push("/catalogue")}
          >
            {personalized.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isAdded={addedProductId === product.id}
                onQuickAdd={handleQuickAdd}
                onOpen={handleOpenProduct}
                isFavorite={isFavorite(product.id)}
                onToggleFavorite={() => handleToggleFavorite(product.id)}
              />
            ))}
          </CarouselSection>
        )}

        {/* ===== DECOUVERTE (repli quand aucun favori) ===== */}
        {favoriteProducts.length === 0 && !isFetching && products.length > 0 && (
          <CarouselSection
            title="Découvrez nos produits"
            subtitle="Les frais du jour, prêts à ajouter"
            onSeeAll={() => router.push("/catalogue")}
          >
            {products.slice(0, 8).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isAdded={addedProductId === product.id}
                onQuickAdd={handleQuickAdd}
                onOpen={handleOpenProduct}
                isFavorite={isFavorite(product.id)}
                onToggleFavorite={() => handleToggleFavorite(product.id)}
              />
            ))}
          </CarouselSection>
        )}

        {/* ===== BLOCS DE RECOMMANDATION DYNAMIQUES ===== */}
        {!isFetching &&
          levels.map((level) => {
            if (level.products.length === 0) return null
            return (
              <CarouselSection
                key={level.id}
                title={level.title}
                subtitle={level.subtitle}
                onSeeAll={() => router.push("/catalogue")}
              >
                {level.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isAdded={addedProductId === product.id}
                    onQuickAdd={handleQuickAdd}
                onOpen={handleOpenProduct}
                    isFavorite={isFavorite(product.id)}
                    onToggleFavorite={() => handleToggleFavorite(product.id)}
                  />
                ))}
              </CarouselSection>
            )
          })}

        {/* ===== SKELETON DE CHARGEMENT ===== */}
        {isFetching && (
          <div className="mt-6 px-4">
            <div className="souki-skeleton mb-3 h-5 w-40 rounded-full" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="souki-skeleton h-44 w-36 shrink-0 rounded-3xl" />
              ))}
            </div>
          </div>
        )}

        {/* ===== DEVENIR FOURNISSEUR ===== */}
        <div className="mt-7 px-4" data-reveal="up">
          <button
            type="button"
            onClick={() => router.push("/devenir-fournisseur")}
            className="flex w-full items-center gap-3 rounded-3xl border border-[#1E8A3C]/15 bg-gradient-to-r from-[#F0FAF1] to-white px-5 py-4 shadow-sm shadow-gray-200/50 transition active:scale-[0.98]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E8A3C]/10">
              <Sprout className="h-6 w-6 text-[#1E8A3C]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-black leading-tight text-[#3D3D3D]">Devenir un fournisseur</p>
              <p className="mt-0.5 text-[12px] font-medium text-gray-400">Rejoignez notre réseau de producteurs</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
          </button>
        </div>

        {/* Espace bas pour la barre de navigation */}
        <div className="h-6" />
      </section>
    </main>
  )
}

function CarouselSection({
  title,
  subtitle,
  onSeeAll,
  children,
}: {
  title: string
  subtitle?: string
  onSeeAll?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="mt-7" data-reveal="up">
      <div className="flex items-end justify-between px-6">
        <div>
          <h2 className="text-[18px] font-black leading-tight text-[#3D3D3D]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] font-medium text-[#8A8A8A]">{subtitle}</p>}
        </div>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold text-[#1E8A3C] active:opacity-70"
          >
            Voir tout
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 scrollbar-none">
        {children}
      </div>
    </section>
  )
}

function ProductCard({
  product,
  isAdded,
  onQuickAdd,
  onOpen,
  isFavorite = false,
  onToggleFavorite,
}: {
  product: CatalogueProduct
  isAdded: boolean
  onQuickAdd: (product: CatalogueProduct) => void
  onOpen: (product: CatalogueProduct) => void
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
}) {
  return (
    // Le « + » ajoute au panier sans quitter l'accueil ; toucher la carte emmene
    // sur la page Produits, ou l'utilisateur poursuit ses achats.
    <article
      role="button"
      tabIndex={0}
      aria-label={`Voir ${product.name}`}
      onClick={() => onOpen(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(product)
        }
      }}
      className="w-[148px] shrink-0 cursor-pointer snap-start rounded-3xl bg-white p-2 shadow-sm shadow-gray-200/50 border border-gray-100 transition hover:shadow-md active:scale-[0.98]"
    >
      <div className="group relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-b from-[#EFF7F0] to-[#F7FBF7]">
        <img
          src={product.image}
          alt={product.name}
          className={cn(
            "h-full w-full transition-transform duration-300 ease-out group-active:scale-[1.07]",
            isIllustrationImage(product.image)
              ? "object-contain p-2 mix-blend-multiply"
              : "object-cover",
          )}
          loading="lazy"
        />
        {onToggleFavorite && (
          <button
            type="button"
            aria-label={isFavorite ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`}
            aria-pressed={isFavorite}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite(product.id)
            }}
            className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition-transform active:scale-90"
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                isFavorite ? "fill-[#E4405F] text-[#E4405F]" : "text-[#7C8B7D]",
              )}
            />
          </button>
        )}
        <button
          type="button"
          aria-label={`Ajouter ${product.name}`}
          onClick={(event) => {
            event.stopPropagation()
            onQuickAdd(product)
          }}
          className={cn(
            "absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-all active:scale-90",
            isAdded
              ? "bg-[#1E8A3C] text-white scale-110"
              : "bg-white text-[#1E8A3C] hover:bg-[#F0FAF1]"
          )}
        >
          {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-2.5 px-1 pb-1">
        <p className="truncate text-[14px] font-bold text-[#3D3D3D]">{product.name}</p>
        <p className="mt-0.5 text-[13px] font-black text-[#1E8A3C]">
          {product.price.toFixed(2)} DH <span className="text-[10px] font-medium text-gray-400">/ {product.displayUnit}</span>
        </p>
      </div>
    </article>
  )
}
