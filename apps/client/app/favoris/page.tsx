"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, Sprout } from "lucide-react"

import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { MobileBottomNav } from "@/components/souki/mobile-bottom-nav"
import { ProductCard } from "@/components/souki/product-card"
import { PwaHeader, PwaScreen, ProductDetailSheet } from "@/components/souki/pwa"
import type { CatalogueProduct } from "@/lib/catalogue"
import {
  fetchCatalogueProducts,
  loadStoredCart,
  saveStoredCart,
  upsertCartItem,
} from "@/lib/catalogue"
import { isPwaStandalone } from "@/lib/pwa"
import { useAuth } from "@/hooks/useAuth"
import { useFavorites } from "@/hooks/useFavorites"
import { useHaptic } from "@/hooks/useHaptic"

/**
 * Ecran « Mes favoris » (PWA). Liste les produits marques en favori (coeur),
 * source de verite serveur via useFavorites. Retirer un favori le fait
 * disparaitre de la grille ; clic sur une carte ouvre la fiche detail.
 *
 * Ecran mobile/PWA uniquement : en dehors du mode standalone, on renvoie vers
 * l'accueil web (comme app/pwa-welcome).
 */
export default function FavorisPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const { favorites: favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const haptic = useHaptic()

  const [isReady, setIsReady] = useState(false)
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [detailProduct, setDetailProduct] = useState<CatalogueProduct | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  // Garde standalone (identique a l'accueil PWA).
  useEffect(() => {
    const canPreview =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("preview") === "pwa"
    if (!isPwaStandalone() && !canPreview) {
      router.replace("/")
      return
    }
    setIsReady(true)
  }, [router])

  // Garde de session.
  useEffect(() => {
    if (isReady && !isLoading && !isAuthenticated) {
      router.replace("/login?redirect=/favoris")
    }
  }, [isReady, isLoading, isAuthenticated, router])

  // Chargement catalogue (les produits favoris en sont derives).
  useEffect(() => {
    if (!isReady) return
    let isMounted = true
    void (async () => {
      try {
        const catalogue = await fetchCatalogueProducts()
        if (isMounted) setProducts(catalogue)
      } catch {
        // silencieux
      } finally {
        if (isMounted) setIsFetching(false)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [isReady])

  useEffect(() => {
    setCartCount(loadStoredCart().length)
  }, [])

  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteIds.includes(product.id)),
    [products, favoriteIds],
  )

  const handleAddToCart = (id: number | string, quantity: number) => {
    const product = products.find((item) => item.id === Number(id))
    if (!product) return
    saveStoredCart(upsertCartItem(loadStoredCart(), product, quantity))
    setCartCount(loadStoredCart().length)
    haptic("success")
  }

  const openDetail = (id: number | string) => {
    const product = products.find((item) => item.id === Number(id))
    if (!product) return
    setDetailProduct(product)
    setDetailOpen(true)
    haptic("light")
  }

  const handleToggleFavorite = (id: number | string) => {
    toggleFavorite(Number(id))
    haptic("medium")
  }

  if (!isReady || isLoading || !isAuthenticated) {
    return (
      <PwaScreen>
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-[#1E8A3C]" />
        </div>
      </PwaScreen>
    )
  }

  return (
    <PwaScreen>
      <PwaHeader
        title="Mes favoris"
        subtitle={
          favoriteProducts.length > 0
            ? `${favoriteProducts.length} produit${favoriteProducts.length > 1 ? "s" : ""}`
            : "Vos coups de cœur"
        }
        onBack={() => router.push("/pwa-welcome")}
      />

      {isFetching ? (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="souki-skeleton h-56 rounded-3xl" />
          ))}
        </div>
      ) : favoriteProducts.length === 0 ? (
        <div className="flex flex-col items-center px-8 pt-14 text-center">
          <div className="relative mb-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#EAF8EC]">
              <FarmerAvatar size="md" expression="explain" />
            </div>
            <span className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md">
              <Heart className="h-5 w-5 text-[#E4405F]" />
            </span>
          </div>
          <h2 className="text-lg font-black text-[#233127]">Aucun favori pour l&apos;instant</h2>
          <p className="mt-1.5 max-w-[16rem] text-[13px] font-medium leading-relaxed text-[#6F8070]">
            Touchez le cœur sur un produit pour le retrouver ici et recevoir de meilleures suggestions.
          </p>
          <button
            type="button"
            onClick={() => router.push("/catalogue")}
            className="mt-6 flex items-center gap-2 rounded-2xl bg-[#1E8A3C] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_-16px_rgba(30,138,60,0.9)] active:scale-[0.98]"
          >
            <Sprout className="h-4 w-4" />
            Découvrir le marché
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2">
          {favoriteProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              image={product.image}
              fallbackImage={product.fallbackImage}
              price={product.price}
              prixKhddarEstime={product.prix_khddar_estime}
              niveau={product.niveau}
              unit={product.unit}
              displayUnit={product.displayUnit}
              quantityStep={product.quantityStep}
              stock={product.stock}
              isFavorite={isFavorite(product.id)}
              onToggleFavorite={handleToggleFavorite}
              onView={openDetail}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      )}

      <ProductDetailSheet
        product={detailProduct}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAddToCart={handleAddToCart}
        isFavorite={detailProduct ? isFavorite(detailProduct.id) : false}
        onToggleFavorite={() => detailProduct && toggleFavorite(detailProduct.id)}
      />

      <MobileBottomNav cartCount={cartCount} />
    </PwaScreen>
  )
}
