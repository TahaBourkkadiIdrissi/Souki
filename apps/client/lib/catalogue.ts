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
  fallbackImage?: string
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

export interface SmartBasketRequest {
  budget: number
  personnes: number
  duree: number
  // Sélection: dish_id d'un plat marocain, ou "equilibre"/undefined pour un
  // panier équilibré (tous fruits & légumes). Les deux passent par l'IA Groq.
  plat?: string
}

export interface SmartBasketLine {
  product_id: number
  nom_produit: string
  quantite_kg: number
  prix_unitaire: number
  sous_total: number
  unite: string
  image?: string
}

export interface SmartBasketResponse {
  status: string
  source: string
  panier_id?: number | null
  criteres: Record<string, unknown>
  lignes_panier: SmartBasketLine[]
  total_dh: number
  nombre_articles: number
  model_warning?: string | null
}

export const CART_STORAGE_KEY = "souki-cart"
export const FREE_DELIVERY_THRESHOLD = 300
export const DELIVERY_FEE = 15
// Photos réalistes haute définition (Pixabay CDN, variante _1280) — une image
// nette et fidèle par produit, affichée en pleine qualité dans la fiche détail.
// Chaque URL a été vérifiée (HTTP 200, image/jpeg) et son sujet contrôlé.
const productPresentation: Record<
  string,
  { category: CatalogueCategory; image: string; displayUnit?: string; quantityStep?: number }
> = {
  "Pommes de terre": {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2017/05/20/19/51/potatoes-2329648_1280.jpg",
  },
  "Oignons rouge": {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2023/06/03/14/27/red-onion-8037811_1280.jpg",
  },
  Tomates: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2022/09/05/09/50/tomatoes-7433786_1280.jpg",
  },
  Carottes: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2016/01/25/13/45/carrots-1160683_1280.jpg",
  },
  Courgettes: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2014/12/18/15/45/zucchini-572542_1280.jpg",
  },
  Piments: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2016/10/30/17/32/chili-pepper-1783761_1280.jpg",
  },
  Aubergines: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2023/01/14/23/59/vegetable-7719242_1280.jpg",
  },
  Concombres: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2019/07/03/11/41/cucumber-4314342_1280.jpg",
  },
  "Menthe fraiche": {
    category: "herbes",
    image: "https://cdn.pixabay.com/photo/2016/06/03/17/09/mint-1433826_1280.jpg",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Persil: {
    category: "herbes",
    image: "https://cdn.pixabay.com/photo/2014/02/07/15/32/parsley-261039_1280.jpg",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Coriandre: {
    category: "herbes",
    image: "https://cdn.pixabay.com/photo/2021/07/18/17/49/coriander-6476225_1280.jpg",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Oranges: {
    category: "fruits",
    image: "https://cdn.pixabay.com/photo/2018/05/20/23/04/orange-3417058_1280.jpg",
  },
  Citrons: {
    category: "fruits",
    image: "https://cdn.pixabay.com/photo/2016/01/10/21/31/lemons-1132558_1280.jpg",
  },
  Poivrons: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2016/03/05/22/59/bell-pepper-1239424_1280.jpg",
  },
  "Haricots verts": {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2016/08/07/17/44/beans-1576700_1280.jpg",
  },
  Laitue: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2020/09/07/09/39/lettuce-5551349_1280.jpg",
    displayUnit: "lot",
    quantityStep: 1,
  },
  Epinards: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2022/08/27/04/00/spinach-7413568_1280.jpg",
  },
  Ail: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2018/05/21/21/23/garlic-3419544_1280.jpg",
    displayUnit: "250g",
    quantityStep: 1,
  },
  Betteraves: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2015/03/24/08/52/beetroot-687251_1280.jpg",
  },
  Radis: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2018/05/30/07/09/radishes-3440869_1280.jpg",
  },
  Navets: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2018/02/04/04/45/root-3129065_1280.jpg",
  },
  Celeri: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2018/11/17/15/01/celery-3821260_1280.jpg",
  },
  Brocoli: {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2023/01/25/18/46/broccoli-7744338_1280.jpg",
  },
  "Chou-fleur": {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2016/06/18/21/56/cauliflower-1465732_1280.jpg",
  },
  "Petit pois": {
    category: "legumes",
    image: "https://cdn.pixabay.com/photo/2021/12/08/16/19/green-peas-6856159_1280.jpg",
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

// Descriptions courtes et uniques par produit (usage culinaire + atout), pensées
// pour la fiche détail. On garde le même système de résolution de nom que la
// présentation (nom direct → alias → normalisé) et un repli générique pour les
// produits inconnus (ex. images hors catalogue de référence).
const productDescriptions: Record<string, string> = {
  "Pommes de terre": "Polyvalente et fondante, parfaite pour les tajines, les frites maison et les purées onctueuses.",
  "Oignons rouge": "Doux et parfumés, la base incontournable de vos tajines, salades et sauces mijotées.",
  Tomates: "Charnues et juteuses, idéales en salade, en sauce ou pour une chakchouka généreuse.",
  Carottes: "Croquantes et sucrées, riches en vitamine A, délicieuses crues, en tajine ou à la vapeur.",
  Courgettes: "Tendres et légères, parfaites vapeur, farcies ou fondues dans un bon couscous.",
  Piments: "Petits mais relevés, pour donner du peps à vos plats et à une harissa maison.",
  Aubergines: "Fondantes à la cuisson, sublimes en zaalouk, grillées ou mijotées en tajine.",
  Concombres: "Frais et gorgés d'eau, ultra désaltérants en salade ou en raïta à la menthe.",
  Poivrons: "Charnus et légèrement sucrés, parfaits grillés, en salade taktouka ou poêlés.",
  "Haricots verts": "Fins et croquants, riches en fibres, délicieux vapeur ou sautés à l'ail.",
  Laitue: "Feuilles tendres et croquantes, la base fraîche de toutes vos salades.",
  Epinards: "Riches en fer et fondants à la cuisson, parfaits en bkoula ou sautés à l'ail.",
  Ail: "Le condiment roi : quelques gousses suffisent à parfumer tajines, marinades et sauces.",
  Betteraves: "Sucrées et colorées, excellentes en salade cuite, relevées de cumin et de citron.",
  Radis: "Croquants et légèrement piquants, parfaits crus, en salade ou à la croque-au-sel.",
  Navets: "Doux et fondants, incontournables dans un couscous ou une tajine d'hiver.",
  Celeri: "Parfumé et croquant, il relève bouillons, soupes et tajines de sa fraîcheur.",
  Brocoli: "Riche en vitamines, savoureux à la vapeur ou sauté pour garder tout son croquant.",
  "Chou-fleur": "Doux et polyvalent, délicieux gratiné, vapeur ou mijoté en tajine.",
  "Petit pois": "Tendres et sucrés, parfaits mijotés avec des artichauts ou dans un tajine de saison.",
  "Menthe fraiche": "Le parfum du thé marocain : vivifiante, aussi parfaite en salade ou en taboulé.",
  Persil: "Aromate essentiel, il relève salades, chermoula et tajines d'une touche verte et fraîche.",
  Coriandre: "Parfum incontournable de la cuisine marocaine, indispensable dans la chermoula et les tajines.",
  Oranges: "Juteuses et sucrées, gorgées de vitamine C, parfaites en jus frais ou en salade à la cannelle.",
  Citrons: "Acidulés et parfumés, pour relever poissons et tajines ou confire à la marocaine.",
}

const normalizedDescriptionEntries = new Map(
  Object.entries(productDescriptions).map(([key, value]) => [normalizeProductName(key), value])
)

const GENERIC_PRODUCT_DESCRIPTION =
  "Frais du jour, sélectionné au marché de gros de Fès et livré demain matin, du champ à votre panier sans intermédiaire."

export function getProductDescription(name: string): string {
  const directMatch = productDescriptions[name]
  if (directMatch) {
    return directMatch
  }

  const normalizedName = normalizeProductName(name)
  const alias = productPresentationAliases[normalizedName]
  if (alias && productDescriptions[alias]) {
    return productDescriptions[alias]
  }

  const normalizedMatch = normalizedDescriptionEntries.get(normalizedName)
  if (normalizedMatch) {
    return normalizedMatch
  }

  return GENERIC_PRODUCT_DESCRIPTION
}

/**
 * Les visuels locaux (`/images/...`) sont des illustrations 512px sur fond
 * blanc : on les affiche en `object-contain` + `mix-blend-multiply` (le blanc
 * se fond dans l'arriere-plan) pour un rendu net et premium. Les URLs distantes
 * sont des photos réelles (fruits/herbes, images importées) → `object-cover`
 * sans blend, sinon le multiply les assombrirait.
 */
export function isIllustrationImage(image?: string | null): boolean {
  return typeof image === "string" && image.startsWith("/images/")
}

export function resolveCatalogueImage(name: string, imageUrl?: string | null) {
  const presentation = getCataloguePresentation(name)
  // Produits du catalogue de référence : on impose toujours la photo curatée
  // (Pixabay HD), en ignorant une éventuelle image distante en base, pour
  // garantir un visuel net et fidèle (comme l'ancien forçage des illustrations).
  if (presentation.image.startsWith("https://cdn.pixabay.com/")) {
    return presentation.image
  }
  return imageUrl || presentation.image
}

export async function fetchCatalogueProducts(): Promise<CatalogueProduct[]> {
  const data = (await apiCall("/api/catalogue")) as ApiCatalogueProduct[]
  return data
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
      image: resolveCatalogueImage(product.nom_fr, product.image_url),
      fallbackImage: presentation.image,
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
  // Maps produits/panier construites une fois : un seul passage sur les sélections
  // au lieu de products.find + réécriture du panier pour chacune.
  const productsById = new Map(products.map((product) => [product.id, product]))
  const cartById = new Map(currentCart.map((item) => [item.id, item]))

  for (const selection of selections) {
    const product = productsById.get(selection.productId)
    if (!product) {
      continue
    }
    const existing = cartById.get(product.id)
    if (existing) {
      cartById.set(product.id, { ...existing, quantity: existing.quantity + selection.quantity })
    } else {
      cartById.set(product.id, { ...product, quantity: selection.quantity })
    }
  }

  return [...cartById.values()]
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

  // VULN-010 : authentification via cookie httpOnly (envoye par apiCall avec
  // credentials: "include"), plus aucun token lu depuis le localStorage.
  const payload = { items }

  return apiCall("/api/manual-basket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,  // ← PAS de JSON.stringify! apiCall le fera
  }) as Promise<ManualBasketResponse>
}

export async function generateSmartPanier(
  payload: SmartBasketRequest,
  token: string
): Promise<SmartBasketResponse> {
  return apiCall("/api/paniers/generer", {
    method: "POST",
    token,
    body: payload,
  }) as Promise<SmartBasketResponse>
}

export interface DishSummary {
  dish_id: string
  name_fr: string
  name_darija: string
  category: string
}

export interface DishCompositionResponse {
  status: string
  dish_id: string
  name_fr: string
  name_darija: string
  category: string
  personnes: number
  default_servings: number
  lignes_panier: SmartBasketLine[]
  ingredients_manquants: string[]
  total_dh: number
  nombre_articles: number
}

export async function fetchDishList(token: string): Promise<DishSummary[]> {
  return apiCall("/api/paniers/plats", { token }) as Promise<DishSummary[]>
}

export async function fetchDishComposition(
  dishId: string,
  personnes: number,
  token: string
): Promise<DishCompositionResponse> {
  return apiCall(`/api/paniers/plats/${encodeURIComponent(dishId)}?personnes=${personnes}`, {
    token,
  }) as Promise<DishCompositionResponse>
}

export async function fetchPanierDetails(panierId: number): Promise<PanierDetailsResponse> {
  return apiCall(`/api/paniers/${panierId}`) as Promise<PanierDetailsResponse>
}

export async function fetchCommandeCheckout(commandeId: number): Promise<CommandeCheckoutResponse> {
  return apiCall(`/api/commandes/${commandeId}`) as Promise<CommandeCheckoutResponse>
}

export async function fetchOrderHistory(): Promise<CommandeHistoriqueDTO[]> {
  return apiCall("/api/commandes/historique") as Promise<CommandeHistoriqueDTO[]>
}

export async function deleteOrderFromHistory(commandeId: number): Promise<{ success: boolean; message?: string }> {
  return apiCall(`/api/commandes/historique/${commandeId}`, {
    method: "DELETE",
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
  return apiCall("/api/v1/claims", {
    method: "POST",
    body: payload,
  }) as Promise<ClaimResponse>
}
