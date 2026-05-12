import type { CatalogueProductDTO, CommandeHistoriqueDTO } from "@/lib/api"
import { apiCall } from "@/lib/api"

export type CatalogueCategory = "legumes" | "fruits" | "herbes"

export type ApiCatalogueProduct = CatalogueProductDTO

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

export interface BasketSelection {
  productId: number
  quantity: number
}

export const CART_STORAGE_KEY = "souki-cart"
export const FREE_DELIVERY_THRESHOLD = 80
export const DELIVERY_FEE = 10
export const POTATO_IMAGE_URL =
  "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&h=600&fit=crop"

const productPresentation: Record<
  string,
  { category: CatalogueCategory; image: string; displayUnit?: string; quantityStep?: number }
> = {
  "Pommes de terre": {
    category: "legumes",
    image: POTATO_IMAGE_URL,
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
    image: "https://images.unsplash.com/photo-1639428134238-b548770d4b77?w=800&h=600&fit=crop&auto=format",
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
    image: "https://images.unsplash.com/photo-1691546327195-01ac1055a870?w=800&h=600&fit=crop&auto=format",
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
    image: "https://images.unsplash.com/photo-1760368104744-bca7a41e0315?w=800&h=600&fit=crop&auto=format",
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

const normalizeProductName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const productPresentationAliases: Record<string, string> = {
  "pomme de terre": "Pommes de terre",
  "pommes de terre": "Pommes de terre",
  "pdt": "Pommes de terre",
  "oignon rouge": "Oignons rouge",
  "oignons rouges": "Oignons rouge",
  "tomate": "Tomates",
  "tomates marocaines": "Tomates",
  "courgette": "Courgettes",
  "concombre": "Concombres",
  "poivron": "Poivrons",
  "poivrons": "Poivrons",
  "haricot vert": "Haricots verts",
  "laitues": "Laitue",
  epinard: "Epinards",
  ail: "Ail",
  betterave: "Betteraves",
  radi: "Radis",
  navet: "Navets",
  celeri: "Celeri",
  céleri: "Celeri",
  brocoli: "Brocoli",
  choufleur: "Chou-fleur",
  "chou fleur": "Chou-fleur",
  "petits pois": "Petit pois",
  "petit pois": "Petit pois",
  menthe: "Menthe fraiche",
  "menthe fraiche": "Menthe fraiche",
}

const normalizedPresentationEntries = new Map(
  Object.entries(productPresentation).map(([key, value]) => [normalizeProductName(key), value])
)

const excludedCatalogueNames = new Set(
  [
    "Tomate test",
    "Taha",
    "Hamza",
    "Test Supabase Lag",
    "Panier Essentiel",
    "Panier Essentiel V2",
    "Panier Essentiel V3",
    "Panier Epicerie",
    "Panier Épicerie",
    "Panier Ã‰picerie",
    "Panier Ãƒâ€°picerie",
    "Panier Fruits Bio",
    "Panier Test",
  ].map(normalizeProductName)
)

export function getCataloguePresentation(name: string) {
  const directMatch = productPresentation[name]
  if (directMatch) {
    return directMatch
  }

  const normalizedName = normalizeProductName(name)
  const alias = productPresentationAliases[normalizedName]
  if (alias && productPresentation[alias]) {
    return productPresentation[alias]
  }

  const normalizedMatch = normalizedPresentationEntries.get(normalizedName)
  if (normalizedMatch) {
    return normalizedMatch
  }

  return (
    {
      category: "legumes" as const,
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop",
    }
  )
}

export function resolveCatalogueImage(name: string, imageUrl?: string | null) {
  const presentation = getCataloguePresentation(name)
  if (normalizeProductName(name) === "pommes de terre") {
    return presentation.image
  }
  return imageUrl || presentation.image
}

export async function fetchCatalogueProducts(): Promise<CatalogueProduct[]> {
  const data = (await apiCall("/api/catalogue")) as ApiCatalogueProduct[]
  return data.filter((product) => !excludedCatalogueNames.has(normalizeProductName(product.nom_fr))).map((product) => {
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

  const levelOne = products.filter((product) => product.niveau === 1)
  const levelTwo = products.filter((product) => product.niveau === 2)
  const levelThree = products.filter((product) => product.niveau === 3)
  const preferredProducts = [
    ...levelOne.slice(0, 4),
    ...levelTwo.slice(0, 5),
    ...levelThree.slice(0, 4),
    ...products.filter((product) => ![1, 2, 3].includes(Number(product.niveau))),
  ]

  const factor = durationFactor[duration] || 1
  const baseSelections: BasketSelection[] = []
  let total = 0

  for (const product of preferredProducts) {
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

export interface ManualBasketResponse {
  status: string
  panier_id: number
  lignes_panier: Array<{
    product_id: number
    nom_produit: string
    quantite_kg: number
    prix_unitaire: number
    sous_total: number
    unite: string
  }>
  total_dh: number
  nombre_articles: number
  frais_livraison: number
}

export interface PanierDetailsResponse {
  panier_id: number
  lignes: Array<{
    product_id: number
    nom_produit: string
    quantite_kg: number
    prix_unitaire: number
    sous_total: number
    unite: string
    image?: string
  }>
  total_legumes: number
  sous_total: number
  frais_livraison: number
  montant_total: number
}

export interface CommandeCheckoutResponse {
  commande_id: number
  transcription?: string
  lignes: Array<{
    product_id: number
    nom_produit: string
    quantite_effective: number
    prix_unitaire: number
    sous_total: number
    unite: string
    image?: string
  }>
  total_dh: number
}

export async function submitManualBasket(cart: CartItem[]): Promise<ManualBasketResponse> {
  const items = cart.map((item) => ({
    product_id: typeof item.id === "string" ? parseInt(item.id) : item.id,
    quantity: typeof item.quantity === "string" ? parseFloat(item.quantity) : item.quantity,
    prix_unitaire: item.price,
  }))

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  
  const payload = { items }
  console.log("Sending payload:", payload)

  return apiCall("/api/manual-basket", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    },
    body: payload,  // ← PAS de JSON.stringify! apiCall le fera
  }) as Promise<ManualBasketResponse>
}

export async function fetchPanierDetails(panierId: number): Promise<PanierDetailsResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return apiCall(`/api/paniers/${panierId}`, {
    ...(token ? { token } : {}),
  }) as Promise<PanierDetailsResponse>
}

export async function fetchCommandeCheckout(commandeId: number): Promise<CommandeCheckoutResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return apiCall(`/api/commandes/${commandeId}`, {
    ...(token ? { token } : {}),
  }) as Promise<CommandeCheckoutResponse>
}

export async function fetchOrderHistory(): Promise<CommandeHistoriqueDTO[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return apiCall("/api/commandes/historique", {
    ...(token ? { token } : {}),
  }) as Promise<CommandeHistoriqueDTO[]>
}

export async function deleteOrderFromHistory(commandeId: number): Promise<{ success: boolean; message?: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return apiCall(`/api/commandes/historique/${commandeId}`, {
    method: "DELETE",
    ...(token ? { token } : {}),
  }) as Promise<{ success: boolean; message?: string }>
}

export type ClaimReason =
  | "abime"
  | "poids_incorrect"
  | "erreur_produit"
  | "produit_manquant"
  | "qualite"
  | "autre"

export interface ClaimCreatePayload {
  commande_id: number
  items: Array<{
    ligne_panier_id: number
    quantity_claimed: number
    reason: ClaimReason
  }>
}

export interface ClaimResponse {
  status: string
  amount_refunded: string | number
  new_wallet_balance: string | number
}

export async function submitClaim(payload: ClaimCreatePayload): Promise<ClaimResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return apiCall("/api/v1/claims", {
    method: "POST",
    ...(token ? { token } : {}),
    body: payload,
  }) as Promise<ClaimResponse>
}
