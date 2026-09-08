"use client"

import { useEffect, useState } from "react"
import { Heart, Minus, Plus, Share2, ShoppingBasket, X } from "lucide-react"

import type { CatalogueProduct } from "@/lib/catalogue"
import { formatQuantity, getProductDescription, isIllustrationImage } from "@/lib/catalogue"
import { cn } from "@/lib/utils"
import { useHaptic } from "@/hooks/useHaptic"

/**
 * Fiche produit en feuille plein écran (mobile) / modale centrée (desktop),
 * inspirée des références (image hero, note, prix + prix barré + remise,
 * stepper de quantité, favori en cœur, CTA "Ajouter au panier" collant en bas).
 *
 * L'ajout referme la feuille : l'utilisateur revient au catalogue et poursuit
 * ses achats. Le favori est piloté par le parent (localStorage via useFavorites).
 */
export function ProductDetailSheet({
  product,
  open,
  onClose,
  onAddToCart,
  isFavorite,
  onToggleFavorite,
}: {
  product: CatalogueProduct | null
  open: boolean
  onClose: () => void
  onAddToCart: (id: number, quantity: number) => void
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  const haptic = useHaptic()
  const step = product?.quantityStep ?? (product?.unit === "kg" ? 0.5 : 1)
  const [quantity, setQuantity] = useState(step)

  // Réinitialise la quantité à chaque produit ouvert.
  useEffect(() => {
    if (product) setQuantity(product.quantityStep ?? (product.unit === "kg" ? 0.5 : 1))
  }, [product])

  // Verrou du scroll de fond + fermeture au clavier.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open || !product) return null

  const displayUnit = product.displayUnit || product.unit
  const isOutOfStock = false
  const oldPrice =
    typeof product.prix_khddar_estime === "number" && product.prix_khddar_estime > product.price
      ? product.prix_khddar_estime
      : null
  const discountPct = oldPrice ? Math.round((1 - product.price / oldPrice) * 100) : 0
  const lineTotal = product.price * quantity

  const increment = () => {
    haptic("light")
    setQuantity((value) => Number((value + step).toFixed(2)))
  }
  const decrement = () => {
    haptic("light")
    setQuantity((value) => Math.max(step, Number((value - step).toFixed(2))))
  }

  const handleFavorite = () => {
    haptic("medium")
    onToggleFavorite()
  }

  const handleShare = async () => {
    haptic("light")
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: product.name, text: `${product.name} sur SOUKI` })
      }
    } catch {
      // partage annulé : rien à faire
    }
  }

  const handleAdd = () => {
    if (isOutOfStock) return
    haptic("success")
    onAddToCart(product.id, quantity)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-[#122018]/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche produit ${product.name}`}
    >
      <div
        className="animate-slide-up flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:max-w-md sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {/* Image hero + actions superposées */}
          <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-[#EAF6EC] via-[#F3FAF4] to-white">
            {/* halo lumineux derriere le produit (profondeur, effet studio) */}
            <div className="pointer-events-none absolute left-1/2 top-[44%] h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-2xl" />
            <img
              src={product.image}
              alt={product.name}
              className={cn(
                "relative h-full w-full",
                isIllustrationImage(product.image)
                  ? "object-contain p-7 mix-blend-multiply"
                  : "object-cover",
              )}
              onError={(event) => {
                if (product.fallbackImage) {
                  ;(event.currentTarget as HTMLImageElement).src = product.fallbackImage
                }
              }}
            />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#264129] shadow-md backdrop-blur active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Partager"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#264129] shadow-md backdrop-blur active:scale-90"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleFavorite}
                  aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  aria-pressed={isFavorite}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur active:scale-90"
                >
                  <Heart
                    className={cn("h-5 w-5 transition-colors", isFavorite ? "fill-[#E4405F] text-[#E4405F]" : "text-[#264129]")}
                  />
                </button>
              </div>
            </div>
            {isOutOfStock ? (
              <span className="absolute bottom-3 left-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                Rupture de stock
              </span>
            ) : (
              discountPct > 0 && (
                <span className="absolute bottom-3 left-3 rounded-full bg-[#F07C00] px-3 py-1 text-xs font-black text-white shadow-[0_6px_16px_-6px_rgba(240,124,0,0.8)]">
                  -{discountPct}%
                </span>
              )
            )}
          </div>

          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-black leading-tight text-[#233127]">{product.name}</h2>
            </div>
            {product.alias && (
              <p className="mt-1 text-sm font-semibold text-[#6F8070]">« {product.alias} »</p>
            )}

            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-2xl font-black text-[#F07C00]">{product.price.toFixed(2)} DH</span>
              <span className="text-sm font-semibold text-[#6C7E6E]">/ {displayUnit}</span>
              {oldPrice && (
                <span className="text-sm font-semibold text-[#9AA49B] line-through">{oldPrice.toFixed(2)} DH</span>
              )}
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-[#264129]">Description</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5F735F]">
                {getProductDescription(product.name)}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#264129]">Quantité</p>
                <p className="mt-0.5 text-xs font-medium text-[#8A8A8A]">{formatQuantity(quantity, product.unit)}</p>
              </div>
              <div className="flex items-center overflow-hidden rounded-full border border-[#CDE8D0] bg-[#F7FCF7]">
                <button
                  type="button"
                  onClick={decrement}
                  disabled={isOutOfStock}
                  className="flex h-11 w-11 items-center justify-center text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] disabled:opacity-40"
                  aria-label="Diminuer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[3.5rem] px-1 text-center text-sm font-black text-[#264129]">
                  {formatQuantity(quantity, product.unit)}
                </span>
                <button
                  type="button"
                  onClick={increment}
                  disabled={isOutOfStock}
                  className="flex h-11 w-11 items-center justify-center text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] disabled:opacity-40"
                  aria-label="Augmenter"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CTA collant : total + ajouter au panier */}
        <div className="border-t border-[#EEF2EE] bg-white px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button
            type="button"
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-white transition-all active:scale-[0.98]",
              isOutOfStock
                ? "cursor-not-allowed bg-gray-300"
                : "bg-[#1E8A3C] shadow-[0_14px_30px_-16px_rgba(30,138,60,0.9)]",
            )}
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-semibold text-white/80">Total</span>
              <span className="souki-tabular-nums text-[17px] font-black">{lineTotal.toFixed(2)} DH</span>
            </span>
            <span className="flex items-center gap-2 text-[15px] font-black">
              {isOutOfStock ? (
                "Indisponible"
              ) : (
                <>
                  <ShoppingBasket className="h-4 w-4" />
                  Ajouter au panier
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
