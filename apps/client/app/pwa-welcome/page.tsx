"use client"

import { DeliveryPromise } from "@/components/souki/delivery-promise"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Apple,
  ArrowRight,
  Carrot,
  ChevronRight,
  Clock,
  Search,
  ShoppingBasket,
  Tag,
  Truck,
  Leaf,
  type LucideIcon,
} from "lucide-react"

import Image from "@/components/souki/optimized-image"
import { SuggestionCard } from "@/components/souki/suggestion-card"
import { AiAgentCards } from "@/components/souki/ai-agent-cards"
import { SocialLinks } from "@/components/souki/social-links"
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { MascotChatSheet } from "@/components/souki/pwa/mascot-chat-sheet"
import { PwaHomeHeader } from "@/components/souki/pwa/pwa-home-header"
import { MarketStatus, MarketCountdown } from "@/components/souki/market-clock"
import { SearchHint } from "@/components/souki/search-hint"
import { useHomeParallax } from "@/hooks/useHomeParallax"
import { MOROCCO_TIME_ZONE } from "@/lib/order-hours"
import { useClientCollection } from "@/hooks/useClientCollection"
import type { CartItem, CatalogueProduct, CatalogueSection } from "@/lib/catalogue"
import {
  LEGACY_CATALOGUE_SECTIONS,
  fetchCatalogueSections,
  fetchCatalogueProducts,
  FREE_DELIVERY_THRESHOLD,
  getCataloguePresentation,
  isIllustrationImage,
  resolveCatalogueImage,
  upsertCartItem,
} from "@/lib/catalogue"
import { categoryIcon } from "@/lib/category-icons"
import { fetchPersonalizedSuggestions } from "@/lib/api"
import type { CatalogueProductDTO } from "@/lib/api"
import { isPwaStandalone } from "@/lib/pwa"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useFavorites } from "@/hooks/useFavorites"
import { useProfile } from "@/hooks/useProfile"
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

// Rail de categories facon Glovo, reinterprete pour le marche frais.
// Chaque tuile filtre reellement le catalogue (deep-link ?category=).
const CATEGORY_TILES = [
  { label: "Tout le marché", href: "/catalogue", icon: ShoppingBasket, from: "#1E8A3C", to: "#2DA050" },
  { label: "Légumes", href: "/catalogue?focus=legumes", icon: Carrot, from: "#2DA050", to: "#7BC96F" },
  { label: "Fruits", href: "/catalogue?focus=fruits", icon: Apple, from: "#F07C00", to: "#FFB347" },
  { label: "Herbes", href: "/catalogue?focus=herbes", icon: Leaf, from: "#1A4F2C", to: "#4CB84A" },
] as const

type CategoryTile = { label: string; href: string; icon: LucideIcon; from: string; to: string; image?: string }
// Degrades des tuiles historiques, reutilises en boucle pour les rayons crees dans l'admin.
const TILE_GRADIENTS = CATEGORY_TILES.slice(1).map(({ from, to }) => ({ from, to }))

// Tuile d'un rayon : photo du produit phare choisi dans l'admin, sinon son icone,
// sinon l'icone historique du rayon, sinon une etiquette generique.
function buildCategoryTiles(sections: CatalogueSection[], products: CatalogueProduct[]): CategoryTile[] {
  return [
    CATEGORY_TILES[0],
    ...sections.map((section, index) => {
      const href = `/catalogue?focus=${encodeURIComponent(section.slug)}`
      const legacy = CATEGORY_TILES.find((tile) => tile.href === href)
      const featured = section.produitVedetteId === null
        ? undefined
        : products.find((product) => product.id === section.produitVedetteId)
      return {
        ...(legacy ?? TILE_GRADIENTS[index % TILE_GRADIENTS.length]),
        label: section.nom,
        href,
        icon: categoryIcon(section.icone) ?? legacy?.icon ?? Tag,
        image: featured?.image || undefined,
      }
    }),
  ]
}

// Mappe un produit renvoye par l'API vers le modele d'affichage du catalogue
// (image resolue, prix affiche, unite de presentation...).
function mapDtoToCatalogueProduct(dto: CatalogueProductDTO): CatalogueProduct {
  const presentation = getCataloguePresentation(dto.nom_fr)
  return {
    id: dto.id,
    name: dto.nom_fr,
    description: dto.description,
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
  const [chatOpen, setChatOpen] = useState(false)
  const [chatHint, setChatHint] = useState(false)
  const { user, token, isAuthenticated, isLoading } = useAuth()
  const userId = user?.id
  const [, setCart] = useClientCollection<CartItem>("cart")
  const [isReady, setIsReady] = useState(false)
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [personalizedState, setPersonalized] = useState<{ userId: number; products: CatalogueProduct[] } | null>(null)
  const personalized = personalizedState && personalizedState.userId === userId ? personalizedState.products : []
  const [isFetching, setIsFetching] = useState(true)
  const [addedProductId, setAddedProductId] = useState<number | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const heroRef = useRef<HTMLDivElement>(null)
  // Reveal au scroll des sections sous la ligne de flottaison (fail-safe :
  // le contenu reste visible si l'observer ne se declenche pas).
  const revealRef = useScrollReveal<HTMLElement>()
  const haptic = useHaptic()
  const { favorites: favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  // Tuiles de rayons : rayons de l'admin, repli sur Légumes / Fruits / Herbes.
  const [sections, setSections] = useState<CatalogueSection[]>(LEGACY_CATALOGUE_SECTIONS)
  const categoryTiles = useMemo(() => buildCategoryTiles(sections, products), [sections, products])

  useEffect(() => {
    let active = true
    void fetchCatalogueSections().then((value) => {
      if (active) setSections(value)
    })
    return () => {
      active = false
    }
  }, [products])

  // Photo de profil (televersee dans Parametres) : le bouton profil du header
  // l'affiche des qu'elle existe, initiale en repli. Meme mecanique que
  // ProfileAvatar : version en localStorage (souki_photo_version) pour casser
  // le cache, et evenement souki:photo-updated pour refleter immediatement un
  // televersement fait pendant la session.
  const { getProfile } = useProfile()
  const [profileAddress, setProfileAddress] = useState<{ userId: number; text: string } | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<{ userId: number; name: string } | null>(null)
  const [profileVersion, setProfileVersion] = useState(0)
  const [photoVersion, setPhotoVersion] = useState(() =>
    typeof window !== "undefined" ? Number(localStorage.getItem("souki_photo_version") || "0") : 0
  )

  useEffect(() => {
    const onPhotoUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.version) setPhotoVersion(detail.version)
    }
    window.addEventListener("souki:photo-updated", onPhotoUpdated)
    return () => window.removeEventListener("souki:photo-updated", onPhotoUpdated)
  }, [])

  useEffect(() => {
    const refreshProfile = () => setProfileVersion((version) => version + 1)
    window.addEventListener("souki:profile-updated", refreshProfile)
    return () => window.removeEventListener("souki:profile-updated", refreshProfile)
  }, [])

  useEffect(() => {
    if (!isAuthenticated || userId === undefined) return
    let isMounted = true
    getProfile()
      .then((profile) => {
        if (isMounted) {
          setProfilePhotoUrl(profile.photo_url ?? profile.avatar_url ?? null)
          setProfileName({ userId, name: profile.prenom.trim() || profile.nom.trim() })
          setProfileAddress({ userId, text: profile.address?.adresse?.trim() ? [profile.address.adresse, profile.address.ville].filter(Boolean).join(", ") : "" })
        }
      })
      .catch(() => {
        if (isMounted) setProfilePhotoUrl(null)
      })
    return () => {
      isMounted = false
    }
  }, [isAuthenticated, userId, getProfile, photoVersion, profileVersion])

  useEffect(() => {
    if (!isReady || !isAuthenticated) return
    try {
      if (localStorage.getItem("souki-chat-hint")) return
      localStorage.setItem("souki-chat-hint", "seen")
    } catch { /* The hint can still appear without storage. */ }
    setChatHint(true)
    const timer = window.setTimeout(() => setChatHint(false), 6000)
    return () => clearTimeout(timer)
  }, [isReady, isAuthenticated])

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

  // The PWA storefront is public; authentication is required only at checkout.

  // Onboarding guard: redirect authenticated first-time users to onboarding.
  // L'etat vient du compte (serveur), pas de l'appareil : un habitue qui installe
  // l'app sur un nouveau telephone ne repasse plus par l'onboarding.
  useEffect(() => {
    if (isReady && isAuthenticated && shouldShowOnboarding(user)) {
      router.replace("/onboarding")
    }
  }, [isReady, isAuthenticated, user, router])

  useHomeParallax(heroRef, isReady && !isLoading)

  // Load catalogue
  useEffect(() => {
    if (!isReady) return

    let isMounted = true

    const loadCatalogue = async (showLoader = false) => {
      try {
        if (showLoader) setIsFetching(true)
        const catalogue = await fetchCatalogueProducts()
        if (!isMounted) return
        setProducts(catalogue)
      } catch {
        // silently fail
      } finally {
        if (isMounted && showLoader) setIsFetching(false)
      }
    }

    void loadCatalogue(true)
    const interval = window.setInterval(() => { if (!document.hidden) void loadCatalogue() }, CATALOGUE_REFRESH_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [isReady])

  // Load personalized suggestions (serveur : favoris + achats mis en avant)
  useEffect(() => {
    if (!isReady || !token || userId === undefined) return

    let isMounted = true

    const loadPersonalized = async () => {
      const dtos = await fetchPersonalizedSuggestions(token)
      if (!isMounted) return
      setPersonalized({ userId, products: dtos.map(mapDtoToCatalogueProduct) })
    }

    void loadPersonalized()
    return () => { isMounted = false }
  }, [isReady, token, userId])

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
    setCart((current) => upsertCartItem(current, product, product.quantityStep))
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
    if (profileName?.userId === user.id && profileName.name) return profileName.name
    if (user.email) {
      const name = user.email.split("@")[0]
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
    if (user.phone) return user.phone
    return null
  }, [user, profileName])

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
    () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: MOROCCO_TIME_ZONE }),
    [],
  )

  // Décalage de parallax : neutralisé si l'utilisateur préfère moins d'animations.


  // Wait for local storage ownership before allowing cart writes.
  if (!isReady || isLoading) {
    return (
      <main className="min-h-dvh bg-[#F5F5F0]" aria-label="Chargement">
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-[#1E8A3C]" />
        </div>
      </main>
    )
  }

  return (
    <main ref={revealRef} className="min-h-dvh bg-[#F2F6F3] text-[#3D3D3D] font-sans pwa-home-motion">
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
            style={{ transform: "translateY(var(--hero-slow, 0px))" }}
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
            style={{ transform: "translateY(var(--hero-fast, 0px))" }}
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
            className="relative z-10 px-5 pb-8 pt-[max(env(safe-area-inset-top),1.25rem)]"

          >
            <PwaHomeHeader address={profileAddress?.userId === userId ? profileAddress?.text ?? "" : ""} name={userName ?? ""} photo={profileName?.userId === userId && profilePhotoUrl ? `${profilePhotoUrl}${profilePhotoUrl.includes("?") ? "&" : "?"}v=${photoVersion}` : null} favorites={favoriteIds.length} />

            {/* Ligne 2 : salutation contextuelle + médaillon-mascotte (pièce maîtresse) */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 animate-slide-in-up">
                {/* Éyebrow live : statut du marché ancré dans la date du jour */}
                <MarketStatus todayLabel={todayLabel} />

                <h1 className="mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-white drop-shadow-md">
                  {greeting} 👋
                </h1>
                {userName && (
                  <p className="mt-0.5 text-[24px] font-black leading-tight tracking-tight [overflow-wrap:anywhere]">
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
                  <DeliveryPromise />
                </p>
              </div>

              {/* Médaillon de la mascotte — verre dépoli, halo étagé, accent feuille */}
              <button type="button" onClick={() => { setChatOpen(true); setChatHint(false) }} aria-label="Discuter avec Souki" className="relative shrink-0 animate-bounce-in focus-visible:outline-2 focus-visible:outline-white">
                {chatHint && <span className="absolute -top-9 right-0 whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-bold text-[#14522A]">Une question ? 👋</span>}
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
              </button>
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
                  {searchValue.length === 0 && <SearchHint />}
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

        {/* ===== HERO — OFFRE DU JOUR + DÉCOMPTE DE CLÔTURE (1h) ===== */}
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

              <MarketCountdown />

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
          <div className="flex gap-3.5 overflow-x-auto px-4 pb-1 scroll-px-4 scrollbar-none snap-x snap-mandatory">
            {categoryTiles.map((tile) => (
              <button
                key={tile.label}
                type="button"
                onClick={() => router.push(tile.href)}
                className="group flex w-[84px] shrink-0 snap-start flex-col items-center gap-2 transition-transform active:scale-95"
              >
                <span
                  className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[22px] text-white ring-1 ring-white/50 transition-all duration-300 group-active:scale-90 group-active:shadow-inner"
                  style={{
                    background: `linear-gradient(145deg, ${tile.from}, ${tile.to})`,
                    boxShadow: `0 14px 26px -12px ${tile.from}A6, inset 0 1px 1px rgba(255,255,255,0.5)`,
                  }}
                >
                  {/* Reflet en haut — donne le relief d'une vraie icône d'app */}
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
                  {tile.image ? (
                    <Image
                      src={tile.image}
                      alt=""
                      fill
                      sizes="72px"
                      className={
                        isIllustrationImage(tile.image)
                          ? "bg-white object-contain p-2 transition-transform duration-300 group-active:scale-110"
                          : "object-cover transition-transform duration-300 group-active:scale-110"
                      }
                    />
                  ) : (
                    <tile.icon
                      aria-hidden="true"
                      strokeWidth={2.2}
                      className="relative h-8 w-8 drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 group-active:scale-110"
                    />
                  )}
                </span>
                <span className="text-center text-[12px] font-bold leading-tight text-[#3D3D3D]">{tile.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== ACTIONS IA (Panier Intelligent + Commande Vocale) ===== */}
        <div className="mt-6 px-4 animate-slide-in-up">
          <AiAgentCards
            onSmart={() => router.push("/catalogue?assistant=smart")}
            onVoice={() => router.push("/catalogue?assistant=voice")}
          />

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
              <p className="mt-0.5 text-[13px] font-medium text-[#3D3D3D]/70"><DeliveryPromise /></p>
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

        {/* ===== RESEAUX SOCIAUX ===== */}
        <div className="mt-8 px-4" data-reveal="up">
          <div className="flex items-center justify-between gap-3 rounded-3xl border border-[#1E8A3C]/10 bg-white px-4 py-3.5 shadow-[0_10px_28px_-22px_rgba(30,138,60,0.5)]">
            <div className="min-w-0">
              <p className="text-[15px] font-black leading-tight text-[#3D3D3D]">Suivez Souki</p>
              <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#647366]">Arrivages, recettes et coulisses du marché</p>
            </div>
            <SocialLinks tone="light" className="shrink-0 gap-2" />
          </div>
        </div>

        {/* Espace bas pour la barre de navigation */}
        <div className="h-6" />
      </section>
      {userId !== undefined && <MascotChatSheet key={userId} open={chatOpen} onClose={() => setChatOpen(false)} userId={userId} />}
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
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-[18px] font-black leading-tight text-[#3D3D3D]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] font-medium text-[#647366]">{subtitle}</p>}
        </div>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-1 text-[13px] font-bold text-[#176B2E] focus-visible:outline-2 focus-visible:outline-[#1E8A3C] active:opacity-70"
          >
            Voir tout
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* scroll-px-5 : les cartes snap-start se posent a 20px du bord au lieu de
          coller aux extremites de l'ecran (le snap ignore le padding seul). */}
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 scroll-px-5 scrollbar-none">
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
    <div className="w-[172px] shrink-0 snap-start">
      <SuggestionCard
        product={product}
        isAdded={isAdded}
        onAdd={onQuickAdd}
        onOpen={onOpen}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(product.id) : undefined}
      />
    </div>
  )
}
