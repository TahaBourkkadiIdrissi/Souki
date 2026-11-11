"use client"

import { Check, Heart, Plus } from "lucide-react"
import Image from "@/components/souki/optimized-image"
import { isIllustrationImage, type CatalogueProduct } from "@/lib/catalogue"
import { useLocale } from "@/contexts/locale-context"
import { cn } from "@/lib/utils"

type SuggestionCardProps = {
  product: CatalogueProduct
  onAdd: (product: CatalogueProduct) => void
  onOpen?: (product: CatalogueProduct) => void
  isAdded?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
  compact?: boolean
  featured?: boolean
  badge?: string
  showReferencePrice?: boolean
}

/** Presentation only: selection, order and cart mutations belong to the caller. */
export function SuggestionCard({
  product, onAdd, onOpen, isAdded = false, isFavorite = false,
  onToggleFavorite, compact = false, featured = false, badge, showReferencePrice = false,
}: SuggestionCardProps) {
  const { t, productName, unitLabel, quantityLabel } = useLocale()
  const name = productName(product)
  const quantity = quantityLabel(product.quantityStep, product.unit)
  const image = (
    <Image
      src={product.image}
      fallbackImage={product.fallbackImage || "/placeholder.svg"}
      fill
      sizes={compact ? "76px" : "(max-width: 640px) 160px, 240px"}
      alt={onOpen ? t("Voir {name}", { name }) : name}
      loading="lazy"
      className={cn("h-full w-full", isIllustrationImage(product.image) ? "object-contain p-2 mix-blend-multiply" : "object-cover")}
    />
  )

  return (
    <article className={cn(
      "relative overflow-hidden rounded-2xl border bg-white shadow-sm",
      compact ? "grid grid-cols-[76px_minmax(0,1fr)] gap-3 p-3" : "flex h-full flex-col p-2.5",
      product.niveau === 3 ? "border-amber-300" : featured ? "border-[#1E8A3C]" : "border-[#E3EBE4]",
    )}>
      <div className={cn("relative overflow-hidden rounded-xl bg-[#F1F6EF]", compact ? "h-[76px]" : "aspect-square")}>
        {onOpen ? <button type="button" onClick={() => onOpen(product)} className="relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#1E8A3C]">{image}</button> : image}
        {onToggleFavorite && (
          <button type="button" onClick={onToggleFavorite} aria-label={isFavorite ? t("Retirer {name} des favoris", { name }) : t("Ajouter {name} aux favoris", { name })} aria-pressed={isFavorite}
            className="absolute end-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#526A55] shadow-sm focus-visible:outline-2 focus-visible:outline-[#1E8A3C]">
            <Heart className={cn("h-5 w-5", isFavorite && "fill-[#D73857] text-[#D73857]")} />
          </button>
        )}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col", !compact && "px-1 pb-1 pt-3")}>
        {badge && <span className="mb-1.5 self-start rounded-md bg-[#FFF3D6] px-2 py-1 text-[11px] font-semibold leading-snug text-[#795018]">{badge}</span>}
        {onOpen ? (
          <button type="button" onClick={() => onOpen(product)} className="text-start text-sm font-bold leading-snug text-[#264129] focus-visible:outline-2 focus-visible:outline-[#1E8A3C]">{name}</button>
        ) : <h3 className="text-sm font-bold leading-snug text-[#264129]">{name}</h3>}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-base font-extrabold tabular-nums text-[#176B2E]"><bdi dir="ltr">{product.price.toFixed(2)} DH</bdi></span>
          <span className="text-xs text-[#596D5C]">/ {unitLabel(product.displayUnit)}</span>
          {showReferencePrice && Boolean(product.prix_khddar_estime) && <span className="text-xs text-[#6F8070] line-through"><bdi dir="ltr">{product.prix_khddar_estime!.toFixed(2)} DH</bdi></span>}
        </div>
        <div className="mt-auto pt-3">
          <button type="button" onClick={() => onAdd(product)} aria-label={t("Ajouter {quantity} de {name}", { quantity, name })}
            className={cn("flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E8A3C]", isAdded ? "bg-[#E7F5E8] text-[#176B2E]" : "bg-[#1E8A3C] text-white hover:bg-[#176B2E]")}>
            {isAdded ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
            <span>{isAdded ? t("Ajouté") : t("Ajouter")} · {quantity}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
