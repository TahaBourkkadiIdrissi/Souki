"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronRight,
  Mic,
  Plus,
  Search,
  ShoppingBasket,
  Sprout,
  Truck,
  Leaf,
  TreeDeciduous,
  TreePine,
  Apple,
  Carrot,
  Cherry,
  Grape,
} from "lucide-react"

import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import type { CatalogueProduct } from "@/lib/catalogue"
import {
  fetchCatalogueProducts,
  getCataloguePresentation,
  loadStoredCart,
  resolveCatalogueImage,
  saveStoredCart,
  upsertCartItem,
} from "@/lib/catalogue"
import { fetchUserFavorites } from "@/lib/api"
import type { CatalogueProductDTO } from "@/lib/api"
import { isPwaStandalone } from "@/lib/pwa"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
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

export default function PwaWelcomePage() {
  const router = useRouter()
  const { user, token, isAuthenticated } = useAuth()
  const [isReady, setIsReady] = useState(false)
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [favorites, setFavorites] = useState<CatalogueProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [addedProductId, setAddedProductId] = useState<number | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [hintIndex, setHintIndex] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)

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

  // Onboarding guard: redirect authenticated first-time users to onboarding
  useEffect(() => {
    if (isReady && isAuthenticated && shouldShowOnboarding()) {
      router.replace("/onboarding")
    }
  }, [isReady, isAuthenticated, router])

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

  // Load favorites from order history
  useEffect(() => {
    if (!isReady || !token) return

    let isMounted = true

    const loadFavorites = async () => {
      const favDTOs = await fetchUserFavorites(token)
      if (!isMounted) return
      const mapped: CatalogueProduct[] = favDTOs.map((dto: CatalogueProductDTO) => {
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
          category: presentation.category,
          quantityStep: presentation.quantityStep || (dto.unite === "kg" ? 0.5 : 1),
          stock: dto.stock,
        }
      })
      setFavorites(mapped)
    }

    void loadFavorites()
    return () => { isMounted = false }
  }, [isReady, token])

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
    saveStoredCart(upsertCartItem(cart, product, product.quantityStep))
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(null), 1200)
    navigator.vibrate?.(20)
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

  if (!isReady) {
    return (
      <main className="min-h-dvh bg-[#F5F5F0]" aria-label="Chargement">
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-[#1E8A3C]" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[#F2F6F3] text-[#3D3D3D] font-sans">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-24 md:pb-0">

        {/* ===== HEADER CINEMATIQUE (safe-area + theme nature) ===== */}
        <div
          ref={heroRef}
          className="relative bg-gradient-to-br from-[#113B1E] via-[#1A4F2C] to-[#2DA050] rounded-b-[36px] shadow-[0_18px_40px_-20px_rgba(17,59,30,0.7)] overflow-hidden"
        >
          {/* Decor SVG (arbres + aliments) */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.18]">
            <TreeDeciduous className="absolute -left-6 bottom-4 w-32 h-32 text-[#8EDD8B]" strokeWidth={1} />
            <TreePine className="absolute -left-2 top-0 w-24 h-24 text-[#A7D7B5]" strokeWidth={1} />
            <TreeDeciduous className="absolute -right-8 top-10 w-40 h-40 text-[#8EDD8B]" strokeWidth={1} />
            <TreePine className="absolute -right-4 bottom-0 w-28 h-28 text-[#A7D7B5]" strokeWidth={1} />
            <Apple className="absolute left-[15%] top-[40%] w-8 h-8 text-white rotate-12" strokeWidth={1.5} />
            <Carrot className="absolute left-[40%] top-[15%] w-10 h-10 text-white -rotate-45" strokeWidth={1.5} />
            <Cherry className="absolute right-[30%] top-[30%] w-8 h-8 text-white rotate-12" strokeWidth={1.5} />
            <Grape className="absolute right-[20%] top-[60%] w-10 h-10 text-white -rotate-12" strokeWidth={1.5} />
          </div>

          {/* Feuilles qui tombent */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {[...Array(8)].map((_, i) => (
              <Leaf
                key={i}
                className="absolute text-[#A7D7B5] animate-falling-leaf"
                style={{
                  left: `${10 + i * 12}%`,
                  top: "-15%",
                  animationDelay: `${i * 1.2}s`,
                  animationDuration: `${5 + (i % 4) * 2}s`,
                  width: `${14 + (i % 3) * 6}px`,
                  height: `${14 + (i % 3) * 6}px`,
                  opacity: 0.6 + (i % 3) * 0.2,
                }}
                strokeWidth={1.5}
                fill="currentColor"
              />
            ))}
          </div>

          <header className="relative z-10 px-5 pb-7 pt-[max(env(safe-area-inset-top),1.25rem)]">
            {/* Ligne 1 : localisation + avatar profil */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push("/parametres")}
                className="flex flex-col items-start text-left animate-slide-in-down active:scale-95"
                aria-label="Adresse de livraison"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A7D7B5]">Livraison à</span>
                <span className="flex items-center gap-1">
                  <span className="text-lg font-black text-white drop-shadow-sm">Fès, Maroc</span>
                  <svg className="w-4 h-4 text-white drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </span>
              </button>
              {isAuthenticated && userName && (
                <button
                  onClick={() => router.push("/parametres")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF8EC] text-sm font-black text-[#1A4F2C] shadow-lg ring-2 ring-white/30 transition-transform active:scale-90 animate-bounce-in"
                  aria-label="Profil et paramètres"
                >
                  {userName.charAt(0).toUpperCase()}
                </button>
              )}
            </div>

            {/* Ligne 2 : salutation + avatar fermier */}
            <div className="mt-5 flex items-end justify-between">
              <div className="animate-slide-in-up">
                <h1 className="text-[26px] font-black leading-tight text-white drop-shadow-md">
                  {isReturningUser ? "Rebonjour" : "Bonjour"} {userName ? userName : ""} 👋
                </h1>
                <p className="mt-1 text-sm font-medium text-[#D3EEDB] drop-shadow-sm">
                  Vos courses fraîches, livrées demain matin.
                </p>
              </div>
              <FarmerAvatar
                size="md"
                expression="welcome"
                label="Souki farmer guide"
                className="shrink-0 animate-gentle-float drop-shadow-xl ring-4 ring-white/20 rounded-full bg-[#EAF8EC]"
              />
            </div>

            {/* Ligne 3 : BARRE DE RECHERCHE (element cle, absente avant) */}
            <form onSubmit={handleSearchSubmit} className="mt-5 animate-slide-in-up" role="search">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.45)]">
                <Search className="h-5 w-5 shrink-0 text-[#1E8A3C]" />
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

        {/* ===== RAIL DE CATEGORIES (decouverte facon Glovo) ===== */}
        <div className="mt-5 animate-slide-in-up">
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none snap-x snap-mandatory">
            {CATEGORY_TILES.map((tile) => (
              <button
                key={tile.label}
                type="button"
                onClick={() => router.push(tile.href)}
                className="group flex w-[88px] shrink-0 snap-start flex-col items-center gap-2 active:scale-95"
              >
                <span
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl text-3xl shadow-[0_10px_24px_-12px_rgba(17,59,30,0.5)] ring-1 ring-black/5 transition group-active:shadow-inner"
                  style={{ background: `linear-gradient(135deg, ${tile.from}1A, ${tile.to}33)` }}
                >
                  {tile.emoji}
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
              className="relative flex flex-col items-start gap-2 overflow-hidden rounded-3xl bg-white p-4 shadow-sm shadow-gray-200/60 transition active:scale-[0.97] active:shadow-inner"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E8A3C]/10">
                <ShoppingBasket className="h-6 w-6 text-[#1E8A3C]" />
              </span>
              <span className="text-left">
                <span className="block text-[15px] font-black leading-tight text-[#3D3D3D]">Panier Intelligent</span>
                <span className="mt-0.5 block text-[12px] font-medium text-gray-400">L&apos;IA compose pour vous</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/catalogue?assistant=voice")}
              className="relative flex flex-col items-start gap-2 overflow-hidden rounded-3xl bg-white p-4 shadow-sm shadow-gray-200/60 transition active:scale-[0.97] active:shadow-inner"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F07C00]/10">
                <Mic className="h-6 w-6 text-[#F07C00]" />
              </span>
              <span className="text-left">
                <span className="block text-[15px] font-black leading-tight text-[#3D3D3D]">Commande Vocale</span>
                <span className="mt-0.5 block text-[12px] font-medium text-gray-400">Dictez votre marché</span>
              </span>
            </button>
          </div>

          {/* Bulle d'aide du fermier */}
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm shadow-gray-200/50 border border-gray-100 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <FarmerAvatar size="sm" expression="explain" />
            <p className="flex-1 text-[13px] font-semibold leading-tight text-[#3D3D3D]">
              Appuyez pour laisser notre IA composer votre marché du jour !
            </p>
          </div>
        </div>

        {/* ===== BANNIERE LIVRAISON GRATUITE ===== */}
        <div className="mt-6 px-4 animate-slide-in-up">
          <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-r from-[#FFF9EB] to-[#FFF3D6] p-4 border border-[#FFC244]/40 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFC244]/25">
              <Truck className="h-6 w-6 text-[#F07C00]" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-black text-[#3D3D3D]">Livraison gratuite dès 80 DH</p>
              <p className="mt-0.5 text-[13px] font-medium text-[#3D3D3D]/70">Demain matin, frais et local</p>
            </div>
          </div>
        </div>

        {/* ===== PRODUITS PREFERES ===== */}
        {(favorites.length > 0 || (!isFetching && products.length > 0)) && (
          <CarouselSection
            title={favorites.length > 0 ? "Vos produits préférés" : "Découvrez nos produits"}
            subtitle={favorites.length > 0 ? "Recommandés d'après vos commandes" : "Les frais du jour, prêts à ajouter"}
            onSeeAll={() => router.push("/catalogue")}
          >
            {(favorites.length > 0 ? favorites : products.slice(0, 8)).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isAdded={addedProductId === product.id}
                onQuickAdd={handleQuickAdd}
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
                  />
                ))}
              </CarouselSection>
            )
          })}

        {/* ===== SKELETON DE CHARGEMENT ===== */}
        {isFetching && (
          <div className="mt-6 px-4">
            <div className="mb-3 h-5 w-40 animate-pulse rounded-full bg-white" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-44 w-36 shrink-0 animate-pulse rounded-3xl bg-white" />
              ))}
            </div>
          </div>
        )}

        {/* ===== DEVENIR FOURNISSEUR ===== */}
        <div className="mt-7 px-4">
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
    <section className="mt-7 animate-slide-in-up">
      <div className="flex items-end justify-between px-4">
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
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
        {children}
      </div>
    </section>
  )
}

function ProductCard({
  product,
  isAdded,
  onQuickAdd,
}: {
  product: CatalogueProduct
  isAdded: boolean
  onQuickAdd: (product: CatalogueProduct) => void
}) {
  return (
    <article className="w-[148px] shrink-0 snap-start rounded-3xl bg-white p-2 shadow-sm shadow-gray-200/50 border border-gray-100 transition hover:shadow-md">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#F9F9F9]">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover mix-blend-multiply"
          loading="lazy"
        />
        <button
          type="button"
          aria-label={`Ajouter ${product.name}`}
          onClick={() => onQuickAdd(product)}
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
