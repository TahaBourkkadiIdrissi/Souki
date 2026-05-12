"use client"

import { useState } from "react"
import { Minus, Plus, ShoppingCart } from "lucide-react"

import { formatQuantity } from "@/lib/catalogue"
import { cn } from "@/lib/utils"

interface ProductCardProps {
  id: number | string
  name: string
  image: string
  price: number
  prixKhddarEstime?: number | null
  niveau?: 1 | 2 | 3
  unit: string
  displayUnit?: string
  quantityStep?: number
  stock?: number
  disabled?: boolean
  disabledLabel?: string
  onAddToCart?: (id: number | string, quantity: number) => void
}

export function ProductCard({
  id,
  name,
  image,
  price,
  prixKhddarEstime,
  niveau,
  unit,
  displayUnit,
  quantityStep = unit === "kg" ? 0.5 : 1,
  stock,
  disabled = false,
  disabledLabel = "Indisponible",
  onAddToCart,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(quantityStep)
  const [isAdded, setIsAdded] = useState(false)
  const resolvedDisplayUnit = displayUnit || unit

  const isOutOfStock = typeof stock === "number" && stock <= 0
  const isUnavailable = isOutOfStock || disabled
  const levelLabel = niveau ? `Niveau ${niveau}` : "Catalogue"
  const savings =
    typeof prixKhddarEstime === "number" && prixKhddarEstime > price
      ? prixKhddarEstime - price
      : 0

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
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-[#DDEFE0] bg-white shadow-[0_18px_45px_-22px_rgba(30,138,60,0.25)] transition-all duration-300",
        isUnavailable
          ? "opacity-65 grayscale-[0.55]"
          : "hover:-translate-y-1 hover:shadow-[0_22px_55px_-20px_rgba(30,138,60,0.28)]"
      )}
    >
      <div className="relative h-40 w-full overflow-hidden bg-[#F4FAF3] sm:h-44 2xl:h-48">
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {isOutOfStock && (
          <span className="absolute left-4 top-4 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
            Rupture totale
          </span>
        )}
        {!isOutOfStock && (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur",
              niveau === 1 && "border-[#BFE6C4] bg-white/90 text-[#1E8A3C]",
              niveau === 2 && "border-[#F3D8B2] bg-white/90 text-[#9A5C11]",
              niveau === 3 && "border-amber-300 bg-white/90 text-amber-700",
              !niveau && "border-[#DDE7DE] bg-white/90 text-[#607061]"
            )}
          >
            {levelLabel}
          </span>
        )}
        {isOutOfStock && <div className="absolute inset-0 bg-white/35" />}
      </div>

      <div className="flex flex-1 flex-col p-3 2xl:p-4">
        <div className="mb-3 min-w-0">
          <h3 className="truncate text-base font-bold text-[#264129]">{name}</h3>
          <p className="mt-1 text-xs text-[#6C7E6E] 2xl:text-sm">{getUnitHint()}</p>
        </div>

        <div className="mb-3 flex items-end justify-between gap-3 2xl:mb-4">
          <span className="text-xl font-black leading-none text-[#F07C00] 2xl:text-2xl">
            {price.toFixed(2)} DH
          </span>
          <span className="shrink-0 whitespace-nowrap pb-1 text-sm text-[#6C7E6E]">
            / {resolvedDisplayUnit}
          </span>
        </div>

        {savings > 0 && (
          <div className="mb-3 rounded-xl border border-[#E6F0E7] bg-[#F7FCF7] px-3 py-2 text-xs font-semibold text-[#607061] 2xl:mb-4">
            Khddar estime {prixKhddarEstime?.toFixed(2)} DH, economie {savings.toFixed(2)} DH
          </div>
        )}

        <div className="mb-3 space-y-2 2xl:mb-4">
          <div className="flex w-full items-center overflow-hidden rounded-full border border-[#CDE8D0] bg-[#F7FCF7]">
            <button
              onClick={decrement}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] 2xl:h-11 2xl:w-11"
              disabled={isUnavailable}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-0 flex-1 px-2 text-center text-sm font-semibold text-[#264129]">
              {formatQuantity(quantity, unit)}
            </span>
            <button
              onClick={increment}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] 2xl:h-11 2xl:w-11"
              disabled={isUnavailable}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={isUnavailable}
          className={cn(
            "mt-auto flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all 2xl:py-3 2xl:text-base",
            isUnavailable
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-[#1E8A3C] text-white hover:bg-[#176B2E]",
            isAdded && "animate-pop"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          {disabled ? disabledLabel : "Ajouter au panier"}
        </button>
      </div>
    </article>
  )
}
