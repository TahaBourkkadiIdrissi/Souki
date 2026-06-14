import AsyncStorage from "@react-native-async-storage/async-storage"

import { fetchCatalogueProductsDto } from "@/services/api/endpoints"
import type { CatalogueProductDTO } from "@/types/api"

export type CatalogueCategory = "legumes" | "fruits" | "herbes"

export interface CatalogueProduct {
  id: number
  name: string
  alias: string
  price: number
  prix_khddar_estime?: number | null
  niveau?: CatalogueProductDTO["niveau"]
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

export const CART_STORAGE_KEY = "souki-cart"
export const DELIVERY_FEE = 15

const productPresentation: Record<
  string,
  { category: CatalogueCategory; image: string; displayUnit?: string; quantityStep?: number }
> = {
  "Pommes de terre": {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&h=600&fit=crop"
  },
  "Oignons rouge": {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&h=600&fit=crop"
  },
  Tomates: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&h=600&fit=crop"
  },
  Carottes: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&h=600&fit=crop"
  },
  Courgettes: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1768405741410-71317eceb565?w=800&h=600&fit=crop&auto=format"
  },
  Concombres: {
    category: "legumes",
    image: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=800&h=600&fit=crop"
  },
  "Menthe fraiche": {
    category: "herbes",
    image: "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=800&h=600&fit=crop",
    displayUnit: "lot",
    quantityStep: 1
  },
  Persil: {
    category: "herbes",
    image: "https://images.unsplash.com/photo-1600411833196-7c1f6b1a8b90?w=800&h=600&fit=crop",
    displayUnit: "lot",
    quantityStep: 1
  },
  Oranges: {
    category: "fruits",
    image: "https://images.unsplash.com/photo-1547514701-42782101795e?w=800&h=600&fit=crop"
  },
  Citrons: {
    category: "fruits",
    image: "https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&h=600&fit=crop"
  }
}

const normalizeProductName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const excludedCatalogueNames = new Set(
  [
    "Test Supabase Lag",
    "Panier Essentiel",
    "Panier Essentiel V2",
    "Panier Essentiel V3",
    "Panier Epicerie",
    "Panier Fruits Bio",
    "Panier Test"
  ].map(normalizeProductName)
)

export function getCataloguePresentation(name: string) {
  return (
    productPresentation[name] || {
      category: "legumes",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop"
    }
  )
}

export async function fetchCatalogueProducts(): Promise<CatalogueProduct[]> {
  const data = await fetchCatalogueProductsDto()
  return data
    .filter((product) => !excludedCatalogueNames.has(normalizeProductName(product.nom_fr)))
    .map((product) => {
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
        image: product.image_url || presentation.image,
        category: presentation.category,
        quantityStep: presentation.quantityStep || (product.unite === "kg" ? 0.5 : 1),
        stock: product.stock
      }
    })
}

export async function loadStoredCart(): Promise<CartItem[]> {
  try {
    const rawCart = await AsyncStorage.getItem(CART_STORAGE_KEY)
    return rawCart ? (JSON.parse(rawCart) as CartItem[]) : []
  } catch {
    return []
  }
}

export async function saveStoredCart(cart: CartItem[]) {
  await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
}

export function formatQuantity(quantity: number, unit: string) {
  if (unit === "kg") return `${Number.isInteger(quantity) ? quantity.toFixed(0) : quantity.toFixed(1)} kg`
  if (unit === "lot") return `${quantity.toFixed(0)} lot${quantity > 1 ? "s" : ""}`
  if (unit === "250g") return `${quantity.toFixed(0)} x 250g`
  return `${quantity} ${unit}`
}
