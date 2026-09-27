import "server-only"
import { cache } from "react"

import type { CatalogueProductDTO } from "@/lib/api"
import {
  type CatalogueProduct,
  getCataloguePresentation,
  getCatalogueFallbackImage,
  resolveCatalogueImage,
} from "@/lib/catalogue"

const backendUrl =
  process.env.BACKEND_INTERNAL_URL ||
  (process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://127.0.0.1:8000")

export const getSeoCatalogue = cache(async function getSeoCatalogue(): Promise<CatalogueProduct[]> {
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/catalogue`, {
    // Prices and availability must match checkout; React deduplicates requests
    // within a render without retaining stale catalogue data across requests.
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`Catalogue API returned ${response.status}`)
  }

  const data: CatalogueProductDTO[] = await response.json()
  return data.filter((product) => product.is_active).map((product) => {
    const presentation = getCataloguePresentation(product.nom_fr)
    return {
      id: product.id,
      name: product.nom_fr,
      alias: product.nom_darija,
      price: product.prix_affiche ?? product.prix_kg,
      prix_khddar_estime: product.prix_khddar_estime,
      niveau: product.niveau,
      unit: product.unite,
      displayUnit: presentation.displayUnit || product.unite,
      image: resolveCatalogueImage(product.nom_fr, product.image_url),
      fallbackImage: getCatalogueFallbackImage(product.nom_fr),
      category: presentation.category,
      quantityStep: presentation.quantityStep || (product.unite === "kg" ? 0.5 : 1),
      stock: product.stock,
      updatedAt: product.updated_at,
      availability: product.availability ?? (product.stock > 0 ? "in_stock" : "out_of_stock"),
    }
  })
})
