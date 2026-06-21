"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Mic,
  Plus,
  ShoppingBasket,
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
  products: CatalogueProduct[]
}

const CATALOGUE_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export default function PwaWelcomePage() {
  const router = useRouter()
  const { user, token, isAuthenticated } = useAuth()
  const [isReady, setIsReady] = useState(false)
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [favorites, setFavorites] = useState<CatalogueProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [addedProductId, setAddedProductId] = useState<number | null>(null)
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
      { id: 1 as const, title: "Essentiels", products: byLevel(1) },
      { id: 2 as const, title: "Populaires", products: byLevel(2) },
      { id: 3 as const, title: "À découvrir", products: byLevel(3) },
    ]
  }, [products])

  const handleQuickAdd = (product: CatalogueProduct) => {
    const cart = loadStoredCart()
    saveStoredCart(upsertCartItem(cart, product, product.quantityStep))
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(null), 1200)
    navigator.vibrate?.(20)
  }

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
        
        {/* Cinematic Nature Header - Agressif & Thématique */}
        <div className="relative bg-gradient-to-br from-[#113B1E] via-[#1A4F2C] to-[#2DA050] pb-6 rounded-b-[32px] shadow-lg mb-4 overflow-hidden">
          
          {/* SVG Background Elements - Arbres et Aliments */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {/* Arbres à gauche */}
            <TreeDeciduous className="absolute -left-6 bottom-4 w-32 h-32 text-[#8EDD8B]" strokeWidth={1} />
            <TreePine className="absolute -left-2 top-0 w-24 h-24 text-[#A7D7B5]" strokeWidth={1} />
            
            {/* Arbres à droite */}
            <TreeDeciduous className="absolute -right-8 top-10 w-40 h-40 text-[#8EDD8B]" strokeWidth={1} />
            <TreePine className="absolute -right-4 bottom-0 w-28 h-28 text-[#A7D7B5]" strokeWidth={1} />

            {/* Fruits et Légumes flottants / doodles */}
            <Apple className="absolute left-[15%] top-[40%] w-8 h-8 text-white rotate-12" strokeWidth={1.5} />
            <Carrot className="absolute left-[40%] top-[15%] w-10 h-10 text-white -rotate-45" strokeWidth={1.5} />
            <Cherry className="absolute right-[30%] top-[30%] w-8 h-8 text-white rotate-12" strokeWidth={1.5} />
            <Grape className="absolute right-[20%] top-[60%] w-10 h-10 text-white -rotate-12" strokeWidth={1.5} />
          </div>

          {/* Falling Leaves Animation (Vraies feuilles) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {[...Array(8)].map((_, i) => (
              <Leaf 
                key={i}
                className={`absolute text-[#A7D7B5] animate-falling-leaf`}
                style={{
                  left: `${10 + i * 12}%`,
                  top: '-15%',
                  animationDelay: `${i * 1.2}s`,
                  animationDuration: `${5 + (i % 4) * 2}s`,
                  width: `${14 + (i % 3) * 6}px`,
                  height: `${14 + (i % 3) * 6}px`,
                  opacity: 0.6 + (i % 3) * 0.2
                }}
                strokeWidth={1.5}
                fill="currentColor"
              />
            ))}
          </div>

          <header className="relative z-10 px-5 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col animate-slide-in-down">
                <span className="text-xs font-bold text-[#A7D7B5] uppercase tracking-wider">Livraison à</span>
                <div className="flex items-center gap-1">
                  <h1 className="text-xl font-black text-white truncate max-w-[200px] drop-shadow-sm">
                    Fès, Maroc
                  </h1>
                  <svg className="w-4 h-4 text-white drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              {isAuthenticated && userName && (
                <button
                  onClick={() => router.push("/parametres")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF8EC] text-sm font-black text-[#1A4F2C] shadow-lg ring-2 ring-transparent transition-transform active:scale-90 animate-bounce-in"
                  aria-label="Profil et paramètres"
                >
                  {userName.charAt(0).toUpperCase()}
                </button>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between">
               <div className="animate-slide-in-up">
                 <h2 className="text-2xl font-black text-white leading-tight drop-shadow-md">
                   Bonjour {userName ? userName : "!"} 👋
                 </h2>
                 <p className="text-sm font-medium text-[#D3EEDB] mt-1 drop-shadow-sm">Vos courses fraîches en un clic.</p>
               </div>
               <div className="mr-2">
                 <FarmerAvatar size="md" expression="welcome" label="Souki farmer guide" className="animate-gentle-float drop-shadow-xl ring-4 ring-white/20 rounded-full bg-[#EAF8EC]" />
               </div>
            </div>
          </header>
        </div>

        {/* AI Feature Buttons - Glovo style cards */}
        <div className="px-4 -mt-8 relative z-10 animate-slide-in-up">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push("/catalogue?ai=smart")}
              className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-white p-5 shadow-sm shadow-gray-200/50 transition active:scale-[0.95] active:shadow-inner"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1E8A3C]/10 mb-1">
                <ShoppingBasket className="h-7 w-7 text-[#1E8A3C]" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-black text-[#3D3D3D] leading-tight">Panier<br/>Intelligent</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => router.push("/catalogue?ai=voice")}
              className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-white p-5 shadow-sm shadow-gray-200/50 transition active:scale-[0.95] active:shadow-inner"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F07C00]/10 mb-1">
                <Mic className="h-7 w-7 text-[#F07C00]" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-black text-[#3D3D3D] leading-tight">Commande<br/>Vocale</p>
              </div>
            </button>
          </div>

          {/* Helper speech bubble */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm shadow-gray-200/50 border border-gray-100 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <FarmerAvatar size="sm" expression="explain" />
            <p className="flex-1 text-[13px] font-semibold text-[#3D3D3D] leading-tight">
              Appuyez pour laisser notre IA composer votre marché du jour !
            </p>
          </div>
        </div>

        {/* Favorites Section */}
        {(favorites.length > 0 || (!isFetching && products.length > 0)) && (
          <div className="mt-6 px-4">
            <h3 className="text-[17px] font-black text-[#3D3D3D] mb-1">
              {favorites.length > 0
                ? `${userName || "Vos"}, vos produits préférés`
                : "Découvrez nos produits"}
            </h3>
            <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-none">
              {(favorites.length > 0 ? favorites : products.slice(0, 8)).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isAdded={addedProductId === product.id}
                  onQuickAdd={handleQuickAdd}
                />
              ))}
            </div>
          </div>
        )}

        {/* Category Suggestions */}
        {!isFetching && levels.some((l) => l.products.length > 0) && (
          <div className="mt-6 px-4">
            <h3 className="text-[17px] font-black text-[#3D3D3D] mb-1">Nos sélections pour vous</h3>

            <div className="mt-4 space-y-5">
              {levels.map((level) => {
                if (level.products.length === 0) return null
                return (
                  <div key={level.id}>
                    <p className="mb-2 text-[14px] font-bold text-[#8A8A8A] uppercase tracking-wide">{level.title}</p>
                    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {level.products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          isAdded={addedProductId === product.id}
                          onQuickAdd={handleQuickAdd}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isFetching && (
          <div className="mt-6 px-4">
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-44 w-36 shrink-0 animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          </div>
        )}

        {/* Promotional Banner */}
        <div className="mt-6 px-4">
          <div className="flex items-center gap-4 rounded-3xl bg-[#FFF9EB] p-4 border border-[#FFC244]/30 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFC244]/20">
              <Truck className="h-6 w-6 text-[#F07C00]" />
            </div>
            <div>
              <p className="text-[15px] font-black text-[#3D3D3D]">Livraison gratuite dès 80 DH</p>
              <p className="mt-0.5 text-[13px] font-medium text-[#3D3D3D]/70">Demain matin, frais et local</p>
            </div>
          </div>
        </div>

        {/* Bottom spacing for nav shell */}
        <div className="h-6" />
      </section>
    </main>
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
    <article className="w-[140px] shrink-0 snap-start rounded-3xl bg-white p-2 shadow-sm shadow-gray-200/50 border border-gray-100 transition hover:shadow-md">
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
            "absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all active:scale-90",
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
