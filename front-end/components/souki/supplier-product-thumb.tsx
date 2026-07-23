"use client"

import { useState } from "react"
import { Package } from "lucide-react"

import { isIllustrationImage, resolveCatalogueImage } from "@/lib/catalogue"
import { cn } from "@/lib/utils"

interface SupplierProductThumbProps {
  /** Nom FR du produit : sert a resoudre la photo curatee du catalogue Souki. */
  name: string
  /** Image distante eventuelle (upload fournisseur) — sinon photo curatee. */
  imageUrl?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  /** Produit inactif/masque : la vignette passe en niveaux de gris attenues. */
  muted?: boolean
  className?: string
}

// Vignette produit reutilisant la meme resolution d'image que le catalogue
// client (`resolveCatalogueImage`) : le fournisseur voit ses produits avec les
// memes photos que ses clients, au lieu d'une icone generique. Repli sur l'icone
// Package si l'image distante echoue (produit hors catalogue de reference).
const sizeConfig = {
  xs: { box: "h-6 w-6 rounded-md", icon: "h-3.5 w-3.5" },
  sm: { box: "h-9 w-9 rounded-lg", icon: "h-4 w-4" },
  md: { box: "h-11 w-11 rounded-xl", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: "h-6 w-6" },
}

export function SupplierProductThumb({
  name,
  imageUrl,
  size = "md",
  muted = false,
  className,
}: SupplierProductThumbProps) {
  const resolved = resolveCatalogueImage(name, imageUrl)
  // Reinitialisation d'etat au rendu (pattern React officiel) : si le produit
  // change, on repart sur sa photo sans effet ni cascade de rendus.
  const [src, setSrc] = useState(resolved)
  const [failed, setFailed] = useState(false)
  const [trackedSrc, setTrackedSrc] = useState(resolved)
  if (trackedSrc !== resolved) {
    setTrackedSrc(resolved)
    setSrc(resolved)
    setFailed(false)
  }

  const config = sizeConfig[size]
  // Les visuels locaux (`/images/...`) sont des illustrations sur fond blanc :
  // contain + multiply pour fondre le cadre. Les photos distantes → object-cover.
  const isIllustration = isIllustrationImage(src)

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-[#F0FAF1] text-primary dark:bg-primary/10",
        config.box,
        muted && "opacity-70 grayscale",
        className,
      )}
    >
      {failed ? (
        <Package className={config.icon} />
      ) : (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full",
            isIllustration ? "object-contain p-1 mix-blend-multiply" : "object-cover",
          )}
        />
      )}
    </span>
  )
}
