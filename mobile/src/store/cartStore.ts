import { create } from "zustand"

import type { CartItem, CatalogueProduct } from "@/lib/catalogue"
import { loadStoredCart, saveStoredCart } from "@/lib/catalogue"

interface CartStore {
  cart: CartItem[]
  hydrate: () => Promise<void>
  addItem: (product: CatalogueProduct, quantity: number) => Promise<void>
  updateQuantity: (productId: number, quantity: number) => Promise<void>
  removeItem: (productId: number) => Promise<void>
  clear: () => Promise<void>
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: [],
  hydrate: async () => {
    set({ cart: await loadStoredCart() })
  },
  addItem: async (product, quantity) => {
    const current = get().cart
    const existing = current.find((item) => item.id === product.id)
    const next = existing
      ? current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        )
      : [...current, { ...product, quantity }]
    set({ cart: next })
    await saveStoredCart(next)
  },
  updateQuantity: async (productId, quantity) => {
    const next = get().cart
      .map((item) => (item.id === productId ? { ...item, quantity } : item))
      .filter((item) => item.quantity > 0)
    set({ cart: next })
    await saveStoredCart(next)
  },
  removeItem: async (productId) => {
    const next = get().cart.filter((item) => item.id !== productId)
    set({ cart: next })
    await saveStoredCart(next)
  },
  clear: async () => {
    set({ cart: [] })
    await saveStoredCart([])
  }
}))
