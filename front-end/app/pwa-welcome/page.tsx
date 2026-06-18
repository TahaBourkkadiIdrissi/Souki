"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Bot,
  Clock3,
  Leaf,
  LogIn,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBasket,
  Truck,
} from "lucide-react"

import { RecolteAvatar } from "@/components/avatar/recolte-avatar"
import type { CatalogueProduct } from "@/lib/catalogue"
import {
  fetchCatalogueProducts,
  loadStoredCart,
  saveStoredCart,
  upsertCartItem,
} from "@/lib/catalogue"
import { isPwaStandalone } from "@/lib/pwa"
import { cn } from "@/lib/utils"

type SuggestionLevel = {
  id: 1 | 2 | 3
  title: string
  subtitle: string
  products: CatalogueProduct[]
}

const CATALOGUE_REFRESH_INTERVAL_MS = 5 * 60 * 1000

const trustItems = [
  { icon: Leaf, label: "Marche frais" },
  { icon: ShieldCheck, label: "Prix clairs" },
  { icon: Truck, label: "Demain matin" },
  { icon: Bot, label: "Panier IA" },
]

const levelMeta = {
  1: {
    title: "Essentiels",
    subtitle: "La base du panier familial.",
    badge: "Essentiel",
    badgeClassName: "bg-green-market text-white",
    softClassName: "bg-green-50 text-green-market",
    accentClassName: "text-green-market",
  },
  2: {
    title: "Populaires",
    subtitle: "Les choix qui partent vite.",
    badge: "Populaire",
    badgeClassName: "bg-orange-cta text-white",
    softClassName: "bg-orange-50 text-orange-700",
    accentClassName: "text-orange-cta",
  },
  3: {
    title: "A decouvrir",
    subtitle: "Pour varier les repas.",
    badge: "Decouverte",
    badgeClassName: "bg-indigo-600 text-white",
    softClassName: "bg-indigo-50 text-indigo-700",
    accentClassName: "text-indigo-700",
  },
} as const

export default function PwaWelcomePage() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState("")
  const [addedProductId, setAddedProductId] = useState<number | null>(null)

  useEffect(() => {
    const canPreviewInDevelopment =
      process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("preview") === "pwa"

    if (!isPwaStandalone() && !canPreviewInDevelopment) {
      router.replace("/")
      return
    }

    setIsReady(true)
  }, [router])

  useEffect(() => {
    if (!isReady) {
      return
    }

    let isMounted = true

    const loadCatalogue = async (showLoader = false) => {
      try {
        if (showLoader) {
          setIsFetching(true)
        }
        const catalogue = await fetchCatalogueProducts()
        if (!isMounted) {
          return
        }
        setProducts(catalogue.filter((product) => product.stock > 0))
        setError("")
      } catch {
        if (isMounted) {
          setError("Catalogue indisponible pour le moment.")
        }
      } finally {
        if (isMounted && showLoader) {
          setIsFetching(false)
        }
      }
    }

    void loadCatalogue(true)
    const interval = window.setInterval(() => {
      void loadCatalogue()
    }, CATALOGUE_REFRESH_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [isReady])

  const levels = useMemo<SuggestionLevel[]>(() => {
    const byLevel = (level: 1 | 2 | 3) =>
      products
        .filter((product) => product.niveau === level)
        .sort((a, b) => {
          const stockScore = Math.min(Number(b.stock || 0), 100) - Math.min(Number(a.stock || 0), 100)
          if (stockScore !== 0) {
            return stockScore
          }
          return a.price - b.price
        })
        .slice(0, 8)

    return ([1, 2, 3] as const).map((level) => ({
      id: level,
      title: levelMeta[level].title,
      subtitle: levelMeta[level].subtitle,
      products: byLevel(level),
    }))
  }, [products])

  const featuredProducts = useMemo(() => products.slice(0, 3), [products])
  const featuredCount = products.length
  const lowestPrice = products.length ? Math.min(...products.map((product) => product.price)) : 0
  const totalStock = products.reduce((total, product) => total + Number(product.stock || 0), 0)

  const handleQuickAdd = (product: CatalogueProduct) => {
    const cart = loadStoredCart()
    saveStoredCart(upsertCartItem(cart, product, product.quantityStep))
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(null), 1200)
    navigator.vibrate?.(20)
  }

  if (!isReady) {
    return (
      <main className="min-h-dvh bg-bg-section" aria-label="Chargement de SOUKI">
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-green-market" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-bg-section text-text-body">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 border-b border-green-100 bg-bg-section px-4 pb-3 pt-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
                <Image
                  src="/logo3.png"
                  alt="SOUKI"
                  width={84}
                  height={48}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "left center" }}
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black leading-none tracking-tight">SOUKI</p>
                <p className="mt-1 truncate text-xs font-bold uppercase text-text-muted">
                  Fresh Market Fes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/catalogue")}
              className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-xs font-black text-green-market shadow-sm"
            >
              <ShoppingBasket className="h-4 w-4" />
              Catalogue
            </button>
          </div>
        </header>

        <div className="flex-1 px-4 pb-4">
          <section className="pt-4">
            <HeroScene
              featuredCount={featuredCount}
              lowestPrice={lowestPrice}
              totalStock={totalStock}
            />
          </section>

          <section className="mt-3 grid grid-cols-4 gap-2">
            {trustItems.map((item) => (
              <div key={item.label} className="flex min-h-20 flex-col items-center justify-center rounded-2xl bg-white px-1.5 text-center shadow-sm">
                <item.icon className="h-5 w-5 text-green-market" />
                <p className="mt-2 text-xs font-black leading-3 text-text-body">{item.label}</p>
              </div>
            ))}
          </section>

          {featuredProducts.length > 0 && (
            <section className="mt-4 rounded-3xl bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black leading-tight">Disponibles maintenant</h2>
                  <p className="text-xs font-semibold text-text-muted">Selection selon le stock catalogue</p>
                </div>
                <Clock3 className="h-5 w-5 text-orange-cta" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {featuredProducts.map((product) => (
                  <MiniProduct key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-5">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight">Suggestions</h2>
                <p className="mt-1 text-xs font-semibold text-text-muted">Essentiels, populaires et decouvertes du catalogue.</p>
              </div>
              <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-market">
                Live
              </span>
            </div>

            {isFetching ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-40 animate-pulse rounded-2xl bg-white" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-bold leading-6 text-orange-800">
                {error}
              </div>
            ) : (
              <div className="space-y-5">
                {levels.map((level) => (
                  <SuggestionSection
                    key={level.id}
                    level={level}
                    addedProductId={addedProductId}
                    onQuickAdd={handleQuickAdd}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="sticky bottom-0 z-20 mt-auto border-t border-green-100 bg-bg-section px-4 pb-3 pt-3 backdrop-blur">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/catalogue")}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-green-market px-4 text-sm font-black text-white shadow-lg transition active:scale-95"
            >
              Explorer
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              aria-label="Se connecter"
              onClick={() => router.push("/login/client")}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-green-200 bg-white text-green-market shadow-sm transition active:scale-95"
            >
              <LogIn className="h-5 w-5" />
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-xs font-black uppercase text-current opacity-50">{label}</p>
      <p className="mt-1 text-sm font-black text-current">{value}</p>
    </div>
  )
}

function HeroScene({
  featuredCount,
  lowestPrice,
  totalStock,
}: {
  featuredCount: number
  lowestPrice: number
  totalStock: number
}) {
  return (
    <div className="pwa-hero-scene relative overflow-hidden rounded-3xl text-white shadow-lg">
      <div className="pwa-word pwa-word-top">SOUKI</div>
      <div className="pwa-word pwa-word-bottom">FRESH MARKET</div>

      <div className="pwa-tree pwa-tree-left" />
      <div className="pwa-tree pwa-tree-right" />
      <div className="pwa-leaf pwa-leaf-one" />
      <div className="pwa-leaf pwa-leaf-two" />
      <div className="pwa-leaf pwa-leaf-three" />
      <div className="pwa-leaf pwa-leaf-four" />

      <div className="relative z-10 px-5 pt-5 text-center">
        <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase text-green-100">
          PWA SOUKI
        </p>
        <h1 className="mx-auto mt-3 max-w-xs text-3xl font-black leading-tight tracking-tight">
          Votre marche frais dans la poche.
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-white/80">
          Produits du jour, prix transparents et panier intelligent selon le stock reel.
        </p>
      </div>

      <div className="relative z-10 flex justify-center pt-1">
        <RecolteAvatar
          size="xl"
          expression="welcome"
          className="pwa-hero-avatar"
          label="Recolte accueille les utilisateurs de l'application SOUKI"
        />
      </div>

      <div className="relative z-20 mx-4 -mt-2 mb-4 grid grid-cols-3 overflow-hidden rounded-3xl bg-white/92 text-text-body shadow-lg">
        <HeroStat label="Actifs" value={featuredCount ? `${featuredCount}` : "..."} />
        <HeroStat label="Stock" value={totalStock ? formatStock(totalStock) : "..."} />
        <HeroStat label="Des" value={lowestPrice ? `${lowestPrice.toFixed(0)} DH` : "..."} />
      </div>
    </div>
  )
}

function MiniProduct({ product }: { product: CatalogueProduct }) {
  return (
    <article className="min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-bg-card">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        <StockPill stock={product.stock} compact />
      </div>
      <p className="mt-2 truncate text-xs font-black text-text-body">{product.name}</p>
      <p className="truncate text-xs font-bold text-green-market">{product.price.toFixed(2)} DH</p>
    </article>
  )
}

function SuggestionSection({
  level,
  addedProductId,
  onQuickAdd,
}: {
  level: SuggestionLevel
  addedProductId: number | null
  onQuickAdd: (product: CatalogueProduct) => void
}) {
  const tone = levelMeta[level.id]

  if (level.products.length === 0) {
    return null
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${tone.badgeClassName}`}>
            {level.id}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-text-body">{level.title}</h3>
            <p className="truncate text-xs font-semibold text-text-muted">{level.subtitle}</p>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-black ${tone.accentClassName}`}>{level.products.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {level.products.slice(0, 4).map((product) => (
          <ProductTile
            key={product.id}
            product={product}
            badge={tone.badge}
            tone={tone}
            isAdded={addedProductId === product.id}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>
    </section>
  )
}

function ProductTile({
  product,
  badge,
  tone,
  isAdded,
  onQuickAdd,
}: {
  product: CatalogueProduct
  badge: string
  tone: (typeof levelMeta)[1]
  isAdded: boolean
  onQuickAdd: (product: CatalogueProduct) => void
}) {
  return (
    <article className="min-w-0 rounded-2xl bg-white p-2 shadow-sm">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-bg-card">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        <span className={`absolute left-2 top-2 max-w-28 truncate rounded-full px-2 py-1 text-xs font-black uppercase ${tone.badgeClassName}`}>
          {badge}
        </span>
        <StockPill stock={product.stock} />
        <button
          type="button"
          aria-label={`Ajouter ${product.name}`}
          onClick={() => onQuickAdd(product)}
          className={cn(
            "absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-green-market shadow-md transition active:scale-90",
            isAdded && "bg-green-market text-white"
          )}
        >
          {isAdded ? <PackageCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      <div className="px-1 pt-2">
        <h4 className="truncate text-sm font-black text-text-body">{product.name}</h4>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-xs font-black text-green-market">{product.price.toFixed(2)} DH</p>
          <p className="shrink-0 text-xs font-black text-text-muted">/{product.displayUnit}</p>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <span className={`min-w-0 truncate rounded-full px-2 py-1 text-xs font-black ${tone.softClassName}`}>
            Disponible
          </span>
          <span className="shrink-0 rounded-full bg-bg-section px-2 py-1 text-xs font-black text-text-muted">
            N{product.niveau}
          </span>
        </div>
      </div>
    </article>
  )
}

function StockPill({ stock, compact = false }: { stock: number; compact?: boolean }) {
  return (
    <span
      className={cn(
        "absolute right-2 top-2 rounded-full bg-white px-2 py-1 font-black text-green-market shadow-md",
        compact ? "text-xs" : "text-sm"
      )}
    >
      Stock {formatStock(stock)}
    </span>
  )
}

function formatStock(stock: number) {
  const normalized = Number(stock || 0)
  if (normalized >= 1000) {
    return `${(normalized / 1000).toFixed(1)}k`
  }
  if (Number.isInteger(normalized)) {
    return normalized.toFixed(0)
  }
  return normalized.toFixed(1)
}
