"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Mic,
  Plus,
  ShoppingBasket,
  Truck,
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
    <main className="min-h-dvh bg-[#F5F5F0] text-[#3D3D3D]">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-24 md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#F5F5F0]/95 px-5 pb-3 pt-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#3D3D3D]">
                Bonjour{userName ? `, ${userName}` : ""} 👋
              </h1>
              {isAuthenticated && (
                <p className="mt-0.5 text-xs text-[#8A8A8A]">Fès, Maroc</p>
              )}
            </div>
            {isAuthenticated && userName && (
              <button
                onClick={() => router.push("/parametres")}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1B4332] to-[#1E8A3C] text-sm font-bold text-white shadow-lg shadow-[#1E8A3C]/20 ring-2 ring-white/80 transition-all active:scale-95"
                aria-label="Profil et paramètres"
              >
                {userName.charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        </header>

        {/* Hero Section with parallax & layered visuals */}
        <div className="px-4 pt-2">
          <div
            ref={heroRef}
            className="relative overflow-hidden rounded-3xl shadow-xl shadow-[#1E8A3C]/20"
            style={{
              background: "linear-gradient(155deg, #145C28 0%, #1E8A3C 30%, #2DA050 60%, #4CB84A 100%)",
            }}
          >
            {/* Mesh gradient blobs */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#4CB84A]/30 blur-3xl" style={{ transform: `translateY(${scrollY * 0.15}px)` }} />
              <div className="absolute -bottom-12 -right-12 h-56 w-56 rounded-full bg-[#1B4332]/40 blur-3xl" style={{ transform: `translateY(${-scrollY * 0.1}px)` }} />
              <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5C400]/10 blur-2xl" />

              {/* Floating orbs with animation */}
              <div className="absolute left-[15%] top-[20%] h-3 w-3 rounded-full bg-white/25 animate-float-slow" />
              <div className="absolute right-[20%] top-[15%] h-2 w-2 rounded-full bg-white/20 animate-float-slow" style={{ animationDelay: "1s" }} />
              <div className="absolute left-[60%] top-[65%] h-2.5 w-2.5 rounded-full bg-white/15 animate-float-slow" style={{ animationDelay: "2s" }} />
              <div className="absolute left-[30%] top-[70%] h-1.5 w-1.5 rounded-full bg-[#F5C400]/30 animate-float-slow" style={{ animationDelay: "0.5s" }} />
              <div className="absolute right-[35%] top-[40%] h-2 w-2 rounded-full bg-white/20 animate-float-slow" style={{ animationDelay: "1.5s" }} />

              {/* Decorative leaf shapes */}
              <svg className="absolute right-6 top-5 h-10 w-10 text-white/[0.07] drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor" style={{ transform: `rotate(${scrollY * 0.08}deg)` }}>
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" />
              </svg>
              <svg className="absolute bottom-10 left-5 h-8 w-8 text-white/[0.07] drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor" style={{ transform: `rotate(${-scrollY * 0.06}deg)` }}>
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" />
              </svg>
              <svg className="absolute left-[45%] top-4 h-6 w-6 text-white/[0.05]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" />
              </svg>

              {/* Shimmer sweep */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
                style={{
                  transform: `translateX(${-100 + (scrollY * 0.4)}%)`,
                  transition: "transform 0.1s linear",
                }}
              />

              {/* Bottom gradient fade for depth */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 to-transparent" />
            </div>

            {/* Content with parallax */}
            <div
              className="relative z-10 flex flex-col items-center px-6 pb-8 pt-8"
              style={{
                transform: `translateY(${scrollY * 0.25}px) scale(${Math.max(0.92, 1 - scrollY * 0.0004)})`,
                opacity: Math.max(0, 1 - scrollY / 350),
              }}
            >
              {/* Glass text backdrop */}
              <div className="mb-1 rounded-2xl bg-white/[0.08] px-5 py-3 backdrop-blur-sm">
                <h2 className="text-center text-xl font-black leading-tight text-white drop-shadow-sm">
                  Votre marché frais<br />dans la poche
                </h2>
              </div>
              <p className="mt-2 text-center text-sm font-medium text-white/85">
                Produits du jour, prix transparents
              </p>

              {/* Avatar with glow ring */}
              <div className="relative mt-5">
                <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-[#4CB84A]/40 via-[#F5C400]/20 to-[#4CB84A]/30 blur-xl" />
                <div className="absolute -inset-1.5 rounded-full bg-white/10 ring-2 ring-white/20" />
                <FarmerAvatar
                  size="xl"
                  expression="welcome"
                  label="Souki farmer guide"
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI Feature Buttons */}
        <div className="px-4 pt-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push("/catalogue?ai=smart")}
              className="flex flex-col items-start gap-2 rounded-2xl bg-white p-4 shadow-sm transition active:scale-[0.97]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E8A3C]/10">
                <ShoppingBasket className="h-5 w-5 text-[#1E8A3C]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#3D3D3D]">Panier Intelligent</p>
                <p className="mt-0.5 text-xs text-[#8A8A8A]">IA compose pour vous</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => router.push("/catalogue?ai=voice")}
              className="flex flex-col items-start gap-2 rounded-2xl bg-white p-4 shadow-sm transition active:scale-[0.97]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F07C00]/10">
                <Mic className="h-5 w-5 text-[#F07C00]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#3D3D3D]">Commande Vocale</p>
                <p className="mt-0.5 text-xs text-[#8A8A8A]">Parlez, on s'occupe</p>
              </div>
            </button>
          </div>

          {/* Helper speech bubble */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <FarmerAvatar size="sm" expression="explain" />
            <p className="flex-1 text-xs font-medium text-[#3D3D3D]">
              Laissez-moi vous aider à composer votre panier !
            </p>
          </div>
        </div>

        {/* Favorites Section */}
        {(favorites.length > 0 || (!isFetching && products.length > 0)) && (
          <div className="mt-6 px-4">
            <h3 className="text-base font-bold text-[#3D3D3D]">
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
            <h3 className="text-base font-bold text-[#3D3D3D]">Nos sélections pour vous</h3>

            <div className="mt-4 space-y-5">
              {levels.map((level) => {
                if (level.products.length === 0) return null
                return (
                  <div key={level.id}>
                    <p className="mb-2 text-sm font-semibold text-[#8A8A8A]">{level.title}</p>
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
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#1E8A3C]/10 to-[#4CB84A]/10 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1E8A3C]/15">
              <Truck className="h-6 w-6 text-[#1E8A3C]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#3D3D3D]">Livraison gratuite dès 80 DH</p>
              <p className="mt-0.5 text-xs text-[#8A8A8A]">Demain matin, frais et local</p>
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
    <article className="w-36 shrink-0 snap-start rounded-2xl bg-white p-2.5 shadow-sm">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-[#F5F5F0]">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <button
          type="button"
          aria-label={`Ajouter ${product.name}`}
          onClick={() => onQuickAdd(product)}
          className={cn(
            "absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition active:scale-90",
            isAdded
              ? "bg-[#1E8A3C] text-white"
              : "bg-white text-[#1E8A3C]"
          )}
        >
          {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-semibold text-[#3D3D3D]">{product.name}</p>
        <p className="mt-0.5 text-xs font-bold text-[#1E8A3C]">{product.price.toFixed(2)} DH</p>
      </div>
    </article>
  )
}
