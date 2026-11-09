import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { roundToStep, type CatalogueProduct } from "@souki/shared"

import { readJson, writeJson } from "@/lib/local-store"

/**
 * Panier enregistre sur le telephone (comme le panier invite de la PWA). Chaque ligne garde
 * une copie du produit au moment de l'ajout, pour s'afficher hors connexion ; le prix
 * affiche reprend celui du catalogue du jour quand il est charge (voir useCartLines).
 */
export type CartProductSnapshot = Pick<
  CatalogueProduct,
  "id" | "name" | "nameAr" | "price" | "unit" | "displayUnit" | "image" | "quantityStep"
>

export interface CartLine {
  productId: number
  quantity: number
  product: CartProductSnapshot
}

// Le compte (phase 2) aura son propre panier : la cle porte le proprietaire.
const CART_KEY = "souki_cart_guest_v1"

type CartContextValue = {
  lines: CartLine[]
  /** Nombre de produits differents (pastille de l'onglet Panier). */
  count: number
  quantityOf: (productId: number) => number
  /** Ajoute `quantity` (par defaut un pas) ; renvoie la nouvelle quantite. */
  add: (product: CatalogueProduct, quantity?: number) => number
  /** Fixe la quantite ; 0 ou moins retire la ligne. */
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

/**
 * Abonnement par produit, pour les listes : une carte ne se redessine que si SA quantite change
 * (avec useCart(), chaque ajout redessinait toutes les cartes du catalogue). Les actions sont
 * stables, l'objet ne change jamais.
 */
type CartStore = {
  quantityOf: (productId: number) => number
  subscribe: (listener: () => void) => () => void
  add: (product: CatalogueProduct, quantity?: number) => number
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
}

const CartStoreContext = createContext<CartStore | null>(null)

function snapshotOf(product: CatalogueProduct): CartProductSnapshot {
  const { id, name, nameAr, price, unit, displayUnit, image, quantityStep } = product
  return { id, name, nameAr, price, unit, displayUnit, image, quantityStep }
}

function isCartLine(value: unknown): value is CartLine {
  const line = value as CartLine | null
  return Boolean(line && typeof line.productId === "number" && typeof line.quantity === "number" && line.product)
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => readJson<unknown[]>(CART_KEY, []).filter(isCartLine))

  useEffect(() => {
    writeJson(CART_KEY, lines)
  }, [lines])

  const quantityOf = useCallback(
    (productId: number) => lines.find((line) => line.productId === productId)?.quantity ?? 0,
    [lines],
  )

  const add = useCallback(
    (product: CatalogueProduct, quantity = product.quantityStep) => {
      const existing = lines.find((line) => line.productId === product.id)
      const next = roundToStep((existing?.quantity ?? 0) + quantity, product.quantityStep)
      setLines((current) => {
        const found = current.some((line) => line.productId === product.id)
        if (!found) return [...current, { productId: product.id, quantity: next, product: snapshotOf(product) }]
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: next, product: snapshotOf(product) } : line,
        )
      })
      return next
    },
    [lines],
  )

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) =>
            line.productId === productId
              ? { ...line, quantity: roundToStep(quantity, line.product.quantityStep) }
              : line,
          ),
    )
  }, [])

  const remove = useCallback((productId: number) => {
    setLines((current) => current.filter((line) => line.productId !== productId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartContextValue>(
    () => ({ lines, count: lines.length, quantityOf, add, setQuantity, remove, clear }),
    [lines, quantityOf, add, setQuantity, remove, clear],
  )

  // Magasin stable pour les abonnements par produit (useCartQuantity / useCartActions).
  const linesRef = useRef(lines)
  linesRef.current = lines
  const actionsRef = useRef({ add, setQuantity, remove })
  actionsRef.current = { add, setQuantity, remove }
  const listeners = useRef(new Set<() => void>())
  useEffect(() => {
    listeners.current.forEach((listener) => listener())
  }, [lines])
  const store = useMemo<CartStore>(
    () => ({
      quantityOf: (productId) => linesRef.current.find((line) => line.productId === productId)?.quantity ?? 0,
      subscribe: (listener) => {
        listeners.current.add(listener)
        return () => {
          listeners.current.delete(listener)
        }
      },
      add: (product, quantity) => actionsRef.current.add(product, quantity),
      setQuantity: (productId, quantity) => actionsRef.current.setQuantity(productId, quantity),
      remove: (productId) => actionsRef.current.remove(productId),
    }),
    [],
  )

  return (
    <CartContext value={value}>
      <CartStoreContext value={store}>{children}</CartStoreContext>
    </CartContext>
  )
}

function useCartStore(): CartStore {
  const store = use(CartStoreContext)
  if (!store) throw new Error("useCartQuantity doit etre utilise dans CartProvider")
  return store
}

/** Quantite d'un produit au panier ; le composant ne se redessine que si elle change. */
export function useCartQuantity(productId: number): number {
  const store = useCartStore()
  return useSyncExternalStore(store.subscribe, () => store.quantityOf(productId))
}

/** Actions du panier, stables (n'abonnent a rien). */
export function useCartActions(): Pick<CartStore, "add" | "setQuantity" | "remove"> {
  return useCartStore()
}

export function useCart() {
  const value = use(CartContext)
  if (!value) throw new Error("useCart doit etre utilise dans CartProvider")
  return value
}
