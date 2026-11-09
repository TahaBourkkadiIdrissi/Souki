import { useMemo } from "react"
import { cartTotals, type CartTotals, type CatalogueProduct } from "@souki/shared"

import { useCart, type CartLine } from "@/contexts/cart-context"
import { useCatalogue } from "@/hooks/use-catalogue"

export interface PricedCartLine extends CartLine {
  /** Produit du catalogue du jour, null s'il n'est pas (encore) charge. */
  live: CatalogueProduct | null
  unitPrice: number
  lineTotal: number
  /** Retire du catalogue ou epuise : la ligne ne compte pas dans le total. */
  unavailable: boolean
}

/** Lignes du panier au prix du jour, et totaux annonces (le back-end recalcule a la validation). */
export function useCartSummary(): { lines: PricedCartLine[]; totals: CartTotals } {
  const { lines } = useCart()
  const { productsById, products } = useCatalogue()
  const catalogueLoaded = products.length > 0

  return useMemo(() => {
    const priced = lines.map((line) => {
      const live = productsById.get(line.productId) ?? null
      const unavailable = catalogueLoaded && (!live || live.availability === "out_of_stock")
      const unitPrice = live?.price ?? line.product.price
      return { ...line, live, unitPrice, lineTotal: unitPrice * line.quantity, unavailable }
    })
    const subtotal = priced.reduce((sum, line) => sum + (line.unavailable ? 0 : line.lineTotal), 0)
    return { lines: priced, totals: cartTotals(subtotal) }
  }, [lines, productsById, catalogueLoaded])
}
