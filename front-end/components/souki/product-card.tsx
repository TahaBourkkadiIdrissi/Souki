"use client"

import { useEffect, useState } from "react"
import { Heart, Minus, Plus, ShoppingCart } from "lucide-react"

import { formatQuantity, isIllustrationImage } from "@/lib/catalogue"
import { cn } from "@/lib/utils"

interface ProductCardProps {
  id: number | string
  name: string
  image: string
  fallbackImage?: string
  price: number
  prixKhddarEstime?: number | null
  niveau?: 1 | 2 | 3
  unit: string
  displayUnit?: string
  quantityStep?: number
  stock?: number
  disabled?: boolean
  disabledLabel?: string
  featured?: boolean
  /**
   * Affiche le visuel avec les proportions compactes d'origine (bandeau court)
   * au lieu du carre plein. Utilise sur l'accueil pour retrouver l'ancien rendu
   * des cartes produits tout en gardant les nouvelles images.
   */
  compactImage?: boolean
  /**
   * Favori (coeur). Affiche uniquement en overlay sur mobile/PWA (`md:hidden`) :
   * le catalogue desktop reste pixel-identique. Fourni par le parent (useFavorites).
   */
  isFavorite?: boolean
  onToggleFavorite?: (id: number | string) => void
  onView?: (id: number | string) => void
  onAddToCart?: (id: number | string, quantity: number) => void
}

export function ProductCard({
  id,
  name,
  image,
  fallbackImage,
  price,
  prixKhddarEstime,
  niveau,
  unit,
  displayUnit,
  quantityStep = unit === "kg" ? 0.5 : 1,
  stock,
  disabled = false,
  disabledLabel = "Indisponible",
  featured = false,
  compactImage = false,
  isFavorite = false,
  onToggleFavorite,
  onView,
  onAddToCart,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(quantityStep)
  const [isAdded, setIsAdded] = useState(false)
  const [resolvedImage, setResolvedImage] = useState(image)
  const resolvedDisplayUnit = displayUnit || unit

  useEffect(() => {
    setResolvedImage(image)
  }, [image])

  const isOutOfStock = typeof stock === "number" && stock <= 0
  const isUnavailable = isOutOfStock || disabled
  // Illustration locale (fond blanc) : rendu poli `contain`+`multiply` UNIQUEMENT
  // sur mobile/PWA (< md). Le desktop web (md:) est reinitialise a l'identique
  // (object-cover, sans padding ni blend) pour rester pixel-identique.
  const isIllustration = isIllustrationImage(resolvedImage)

  // Remise vs prix "khddar" estimé (marché de gros) : badge -X% + prix barré,
  // façon référence e-commerce. Affiché seulement si le prix khddar est plus élevé.
  const oldPrice =
    typeof prixKhddarEstime === "number" && prixKhddarEstime > price ? prixKhddarEstime : null
  const discountPct = oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0

  const getUnitHint = () => {
    if (resolvedDisplayUnit === "250g") {
      return "Prix affiche par portion de 250g"
    }
    if (resolvedDisplayUnit === "lot") {
      return "Vente par lot"
    }
    if (unit === "kg") {
      return "Vente au kg"
    }
    return `Vente a l'unite ${resolvedDisplayUnit}`
  }

  const handleAdd = () => {
    if (isUnavailable) {
      return
    }
    onAddToCart?.(id, quantity)
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 300)
  }

  const increment = () => {
    setQuantity((currentQuantity) => currentQuantity + quantityStep)
  }

  const decrement = () => {
    setQuantity((currentQuantity) => Math.max(quantityStep, currentQuantity - quantityStep))
  }

  return (
    <article
      onClick={() => onView?.(id)}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-[#DDEFE0] bg-white shadow-[0_18px_45px_-22px_rgba(30,138,60,0.25)] transition-all duration-300",
        isUnavailable
          ? "opacity-65 grayscale-[0.55]"
          : "hover:-translate-y-1 hover:shadow-[0_22px_55px_-20px_rgba(30,138,60,0.28)]"
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden",
          // Illustration sur mobile : fond degrade doux. md: revient au fond plat
          // d'origine (pixel-identique web).
          isIllustration
            ? "bg-gradient-to-b from-[#EFF7F0] to-[#F7FBF7] md:bg-none md:bg-[#F4FAF3]"
            : "bg-[#F4FAF3]",
          // Accueil : proportions compactes d'origine. Sinon : visuel carre
          // (look e-commerce moderne) conserve pour le catalogue.
          compactImage
            ? (featured ? "h-40 sm:h-52 md:h-56 2xl:h-64" : "h-28 sm:h-44 2xl:h-48")
            : (featured ? "aspect-square sm:aspect-[4/3]" : "aspect-square")
        )}
      >
        <img
          src={resolvedImage}
          alt={name}
          onError={() => {
            if (fallbackImage && resolvedImage !== fallbackImage) {
              setResolvedImage(fallbackImage)
            }
          }}
          className={cn(
            "h-full w-full transition-transform duration-500 group-hover:scale-105",
            // Mobile : contain + multiply (cadre blanc efface). md: object-cover
            // sans padding ni blend → rendu web d'origine inchange.
            isIllustration
              ? "object-contain p-2 mix-blend-multiply md:object-cover md:p-0 md:mix-blend-normal"
              : "object-cover",
          )}
        />
        {isOutOfStock ? (
          <>
            <span className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Rupture
            </span>
            <div className="absolute inset-0 bg-white/35" />
          </>
        ) : (
          discountPct > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-[#F07C00] px-2.5 py-1 text-[11px] font-black text-white shadow-[0_6px_16px_-6px_rgba(240,124,0,0.8)]">
              -{discountPct}%
            </span>
          )
        )}
        {onToggleFavorite && (
          <button
            type="button"
            aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={isFavorite}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite(id)
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition-transform active:scale-90 md:hidden"
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                isFavorite ? "fill-[#E4405F] text-[#E4405F]" : "text-[#7C8B7D]",
              )}
            />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3 2xl:p-4">
        <div className="mb-2 min-w-0">
          <h3 className="truncate text-sm font-bold text-[#264129] sm:text-base">{name}</h3>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-[#6C7E6E] sm:text-xs">
            {getUnitHint()}
          </p>
        </div>

        <div className="mb-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-base font-black leading-none text-[#F07C00] sm:text-lg 2xl:text-xl">
            {price.toFixed(2)} DH
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-[#6C7E6E]">
            / {resolvedDisplayUnit}
          </span>
          {oldPrice && (
            <span className="shrink-0 text-[11px] font-semibold text-[#9AA49B] line-through">
              {oldPrice.toFixed(2)} DH
            </span>
          )}
        </div>

        <div className="mb-2 space-y-2 sm:mb-2.5">
          <div className="flex w-full items-center overflow-hidden rounded-full border border-[#CDE8D0] bg-[#F7FCF7]">
          <button
              onClick={(event) => {
                event.stopPropagation()
                decrement()
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] sm:h-10 sm:w-10 2xl:h-11 2xl:w-11"
              disabled={isUnavailable}
            >
              <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
            <span className="min-w-0 flex-1 px-1 text-center text-xs font-semibold text-[#264129] sm:px-2 sm:text-sm">
              {formatQuantity(quantity, unit)}
            </span>
          <button
              onClick={(event) => {
                event.stopPropagation()
                increment()
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] sm:h-10 sm:w-10 2xl:h-11 2xl:w-11"
              disabled={isUnavailable}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation()
            handleAdd()
          }}
          disabled={isUnavailable}
          className={cn(
            "mt-auto flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-all sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm 2xl:py-3 2xl:text-base",
            isUnavailable
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-[#1E8A3C] text-white hover:bg-[#176B2E]",
            isAdded && "animate-pop"
          )}
        >
          <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {disabled ? (
            <span className="truncate">{disabledLabel}</span>
          ) : (
            <>
              <span className="sm:hidden">Ajouter</span>
              <span className="hidden sm:inline">Ajouter au panier</span>
            </>
          )}
        </button>
      </div>
    </article>
  )
}
