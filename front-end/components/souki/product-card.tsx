"use client"

import { useState } from "react"
import Image from "next/image"
import { Plus, Minus, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductCardProps {
  id: string
  name: string
  image: string
  price: number
  originalPrice?: number
  unit: string
  badge?: "promo" | "fresh" | "rupture"
  onAddToCart?: (id: string, quantity: number) => void
}

export function ProductCard({
  id,
  name,
  image,
  price,
  originalPrice,
  unit,
  badge,
  onAddToCart,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(1)
  const [isAdded, setIsAdded] = useState(false)

  const handleAdd = () => {
    onAddToCart?.(id, quantity)
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 300)
  }

  const badgeStyles = {
    promo: "bg-[#F07C00] text-white",
    fresh: "bg-[#F5C400] text-[#3D3D3D]",
    rupture: "bg-red-500 text-white",
  }

  const badgeLabels = {
    promo: "Promo",
    fresh: "Fresh Today",
    rupture: "Rupture",
  }

  return (
    <div className="group relative bg-[#F0FAF1] rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] flex flex-col">
      {badge && (
        <span
          className={cn(
            "absolute top-3 left-3 z-10 px-3 py-1 rounded-full text-xs font-semibold",
            badgeStyles[badge]
          )}
        >
          {badgeLabels[badge]}
        </span>
      )}
      
      <div className="relative h-40 w-full overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      <div className="p-4 flex flex-col">
        <h3 className="font-semibold text-[#3D3D3D] text-lg mb-2">{name}</h3>
        
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-[#F07C00]">
            {price.toFixed(2)} DH
          </span>
          <span className="text-sm text-[#8A8A8A]">/{unit}</span>
          {originalPrice && (
            <span className="text-sm text-[#8A8A8A] line-through">
              {originalPrice.toFixed(2)} DH
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center border border-[#4CB84A] rounded-full overflow-hidden">
            <button
              onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
              className="p-2 hover:bg-[#4CB84A] hover:text-white transition-colors"
              disabled={badge === "rupture"}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-3 min-w-[50px] text-center font-medium">
              {quantity} {unit}
            </span>
            <button
              onClick={() => setQuantity(quantity + 0.5)}
              className="p-2 hover:bg-[#4CB84A] hover:text-white transition-colors"
              disabled={badge === "rupture"}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={badge === "rupture"}
          className={cn(
            "mt-auto self-end w-auto px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all",
            badge === "rupture"
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-[#4CB84A] text-white hover:bg-[#1E8A3C]",
            isAdded && "animate-pop"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          Ajouter au panier
        </button>
      </div>
    </div>
  )
}
