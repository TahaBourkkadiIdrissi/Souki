"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { type CatalogueProduct, loadStoredCart, saveStoredCart, upsertCartItem } from "@/lib/catalogue"
import { trackEvent } from "@/lib/analytics"

export default function ProductPurchase({ product }: { product: CatalogueProduct }) {
  useEffect(() => {
    trackEvent("view_item", {
      currency: "MAD",
      value: product.price,
      items: [{ item_id: String(product.id), item_name: product.name, price: product.price }],
    })
  }, [product.id, product.name, product.price])

  const addToCart = () => {
    saveStoredCart(upsertCartItem(loadStoredCart(), product, product.quantityStep))
    window.dispatchEvent(new Event("souki:cart-updated"))
    trackEvent("add_to_cart", {
      currency: "MAD",
      value: product.price * product.quantityStep,
      items: [{ item_id: String(product.id), item_name: product.name, price: product.price, quantity: product.quantityStep }],
    })
    toast.success(`${product.name} ajouté au panier`)
  }

  return (
    <button type="button" onClick={addToCart} className="mt-6 w-full rounded-2xl bg-[#1E8A3C] px-6 py-4 text-base font-bold text-white hover:bg-[#176B2E]">
      Ajouter au panier
    </button>
  )
}
