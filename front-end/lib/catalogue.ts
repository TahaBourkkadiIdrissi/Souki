import { apiCall } from "@/lib/api"

export type CatalogueCategory = "legumes" | "fruits" | "herbes"

export interface ApiCatalogueProduct {
  id: number
  nom_fr: string
  nom_darija: string
  prix_kg: number
  unite: string
  stock: number
}

export interface CatalogueProduct {
  id: number
  name: string
  alias: string
  price: number
  unit: string
  displayUnit: string
  image: string
  category: CatalogueCategory
  quantityStep: number
  stock: number
}

export interface CartItem extends CatalogueProduct {
  quantity: number
}

export interface BasketSelection {
  productId: number
  quantity: number
}

export const CART_STORAGE_KEY = "souki-cart"
export const DELIVERY_FEE = 10

const productPresentation: Record<
  string,
  { category: CatalogueCategory; image: string; displayUnit?: string; quantityStep?: number }
> = {
  "Pommes de terre": {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&h=600&fit=crop",
  },
  "Oignons rouge": {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&h=600&fit=crop",
  },
  Tomates: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&h=600&fit=crop",
  },
  Carottes: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&h=600&fit=crop",
  },
  Courgettes: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1768405741410-71317eceb565?w=800&h=600&fit=crop&auto=format",
  },
  Piments: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=800&h=600&fit=crop",
  },
  Aubergines: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1603048719539-9ecb4b2fb0e1?w=800&h=600&fit=crop",
  },
  Concombres: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=800&h=600&fit=crop",
  },
  "Menthe fraiche": {
    category: "herbes",
    image: "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=800&h=600&fit=crop",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Persil: {
    category: "herbes",
    image: "https://images.unsplash.com/photo-1600411833196-7c1f6b1a8b90?w=800&h=600&fit=crop",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Coriandre: {
    category: "herbes",
    image: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800&h=600&fit=crop",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Oranges: {
    category: "fruits",
    image: "https://images.unsplash.com/photo-1547514701-42782101795e?w=800&h=600&fit=crop",
  },
  Citrons: {
    category: "fruits",
    image: "https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&h=600&fit=crop",
  },
  Poivrons: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=800&h=600&fit=crop",
  },
  "Haricots verts": {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=800&h=600&fit=crop",
  },
  Laitue: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1622205313162-be1d5712a43d?w=800&h=600&fit=crop",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Epinards: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&h=600&fit=crop",
  },
  Ail: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=800&h=600&fit=crop",
    displayUnit: "250g",
    quantityStep: 1,
  },
  Betteraves: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1639402480805-ea8ef529e028?w=800&h=600&fit=crop",
  },
  Radis: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1638116282510-128dd635bbf7?w=800&h=600&fit=crop",
  },
  Navets: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1615485020845-601a6d2971a5?w=800&h=600&fit=crop",
  },
  Celeri: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1638034370936-7c8d00dcdf70?w=800&h=600&fit=crop",
  },
  Brocoli: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=800&h=600&fit=crop",
  },
  "Chou-fleur": {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1613743983303-b3e89f8a2b80?w=800&h=600&fit=crop",
  },
  "Petit pois": {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=800&h=600&fit=crop",
  },
}

export async function fetchCatalogueProducts(): Promise<CatalogueProduct[]> {
  const data = (await apiCall("/api/catalogue")) as ApiCatalogueProduct[]
  return data.map((product) => {
    const presentation = productPresentation[product.nom_fr] || {
      category: "legumes" as const,
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop",
    }

    return {
      id: product.id,
      name: product.nom_fr,
      alias: product.nom_darija,
      price: product.prix_kg,
      unit: product.unite,
      displayUnit: presentation.displayUnit || product.unite,
      image: presentation.image,
      category: presentation.category,
      quantityStep: presentation.quantityStep || (product.unite === "kg" ? 0.5 : 1),
      stock: product.stock,
    }
  })
}

export function loadStoredCart(): CartItem[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY)
    return rawCart ? (JSON.parse(rawCart) as CartItem[]) : []
  } catch {
    return []
  }
}

export function saveStoredCart(cart: CartItem[]) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
}

export function formatQuantity(quantity: number, unit: string) {
  if (unit === "kg") {
    return `${Number.isInteger(quantity) ? quantity.toFixed(0) : quantity.toFixed(1)} kg`
  }
  if (unit === "lot") {
    return `${quantity.toFixed(0)} lot${quantity > 1 ? "s" : ""}`
  }
  if (unit === "250g") {
    return `${quantity.toFixed(0)} x 250g`
  }
  return `${quantity} ${unit}`
}

export function upsertCartItem(
  currentCart: CartItem[],
  product: CatalogueProduct,
  quantity: number
) {
  const existingItem = currentCart.find((item) => item.id === product.id)
  if (existingItem) {
    return currentCart.map((item) =>
      item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
    )
  }

  return [...currentCart, { ...product, quantity }]
}

export function mergeSelectionsIntoCart(
  currentCart: CartItem[],
  products: CatalogueProduct[],
  selections: BasketSelection[]
) {
  return selections.reduce((nextCart, selection) => {
    const product = products.find((item) => item.id === selection.productId)
    if (!product) {
      return nextCart
    }
    return upsertCartItem(nextCart, product, selection.quantity)
  }, currentCart)
}

export function buildSmartBasket(
  products: CatalogueProduct[],
  budget: number,
  duration: string
): BasketSelection[] {
  const durationFactor: Record<string, number> = {
    "3 jours": 0.8,
    "1 semaine": 1,
    "2 semaines": 1.6,
    "1 mois": 2.4,
  }

  const preferredNames = [
    "Tomates",
    "Pommes de terre",
    "Oignons rouge",
    "Carottes",
    "Courgettes",
    "Concombres",
    "Poivrons",
    "Haricots verts",
    "Laitue",
    "Oranges",
    "Citrons",
    "Menthe fraiche",
  ]

  const factor = durationFactor[duration] || 1
  const baseSelections: BasketSelection[] = []
  let total = 0

  for (const name of preferredNames) {
    const product = products.find((item) => item.name === name)
    if (!product) {
      continue
    }

    const quantity =
      product.unit === "kg"
        ? Math.max(0.5, Math.round(factor * 2) / 2)
        : Math.max(1, Math.round(factor))
    const nextTotal = total + product.price * quantity

    if (nextTotal > budget && baseSelections.length > 0) {
      continue
    }

    baseSelections.push({ productId: product.id, quantity })
    total = nextTotal
  }

  if (baseSelections.length === 0 && products[0]) {
    return [{ productId: products[0].id, quantity: products[0].quantityStep }]
  }

  return baseSelections
}
