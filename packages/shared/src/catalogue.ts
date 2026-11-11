import { translate, translateUnit, type Locale } from "./i18n"
import type { CatalogueCategoryDTO, CatalogueProductDTO, ProductAvailability, ProduitNiveau } from "./types"

/**
 * Nom affiche : en arabe, le nom darija en lettres arabes (nom_ar) ; sinon, ou s'il manque,
 * le nom francais. La darija en lettres latines (nom_darija) n'est pas affichee dans une
 * interface arabe.
 */
export function productDisplayName(product: Pick<CatalogueProductDTO, "nom_fr" | "nom_ar">, locale: Locale): string {
  const arabic = product.nom_ar?.trim()
  return locale === "ar" && arabic ? arabic : product.nom_fr
}

/** Prix du jour affiche au client : prix_affiche s'il existe, sinon le prix au kilo. */
export function productDisplayPrice(product: Pick<CatalogueProductDTO, "prix_affiche" | "prix_kg">): number {
  return product.prix_affiche ?? product.prix_kg
}

/** "12" ou "12,50" : pas de decimales inutiles, virgule a la francaise. */
export function formatDirhams(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(".", ",")
}

// ---------------------------------------------------------------------------
// Presentation des produits : meme table que apps/client/lib/catalogue.ts
// (rayon historique, photo de repli, unite affichee, pas de quantite).
// ---------------------------------------------------------------------------

export type CatalogueCategory = "legumes" | "fruits" | "herbes" | (string & {})

interface ProductPresentation {
  category: CatalogueCategory
  image: string
  displayUnit?: string
  quantityStep?: number
}

const PIXABAY = "https://cdn.pixabay.com/photo"

const PRODUCT_PRESENTATION: Record<string, ProductPresentation> = {
  "Pommes de terre": { category: "legumes", image: `${PIXABAY}/2017/05/20/19/51/potatoes-2329648_1280.jpg` },
  "Oignons rouge": { category: "legumes", image: `${PIXABAY}/2023/06/03/14/27/red-onion-8037811_1280.jpg` },
  Tomates: { category: "legumes", image: `${PIXABAY}/2022/09/05/09/50/tomatoes-7433786_1280.jpg` },
  Carottes: { category: "legumes", image: `${PIXABAY}/2016/01/25/13/45/carrots-1160683_1280.jpg` },
  Courgettes: { category: "legumes", image: `${PIXABAY}/2014/12/18/15/45/zucchini-572542_1280.jpg` },
  Piments: { category: "legumes", image: `${PIXABAY}/2016/10/30/17/32/chili-pepper-1783761_1280.jpg` },
  Aubergines: { category: "legumes", image: `${PIXABAY}/2023/01/14/23/59/vegetable-7719242_1280.jpg` },
  Concombres: { category: "legumes", image: `${PIXABAY}/2019/07/03/11/41/cucumber-4314342_1280.jpg` },
  "Menthe fraiche": { category: "herbes", image: `${PIXABAY}/2016/06/03/17/09/mint-1433826_1280.jpg`, displayUnit: "lot", quantityStep: 1 },
  Persil: { category: "herbes", image: `${PIXABAY}/2014/02/07/15/32/parsley-261039_1280.jpg`, displayUnit: "lot", quantityStep: 1 },
  Coriandre: { category: "herbes", image: `${PIXABAY}/2021/07/18/17/49/coriander-6476225_1280.jpg`, displayUnit: "lot", quantityStep: 1 },
  Oranges: { category: "fruits", image: `${PIXABAY}/2018/05/20/23/04/orange-3417058_1280.jpg` },
  Citrons: { category: "fruits", image: `${PIXABAY}/2016/01/10/21/31/lemons-1132558_1280.jpg` },
  Poivrons: { category: "legumes", image: `${PIXABAY}/2016/03/05/22/59/bell-pepper-1239424_1280.jpg` },
  "Haricots verts": { category: "legumes", image: `${PIXABAY}/2016/08/07/17/44/beans-1576700_1280.jpg` },
  Laitue: { category: "legumes", image: `${PIXABAY}/2020/09/07/09/39/lettuce-5551349_1280.jpg`, displayUnit: "lot", quantityStep: 1 },
  Epinards: { category: "legumes", image: `${PIXABAY}/2022/08/27/04/00/spinach-7413568_1280.jpg` },
  Ail: { category: "legumes", image: `${PIXABAY}/2018/05/21/21/23/garlic-3419544_1280.jpg`, displayUnit: "250g", quantityStep: 1 },
  Betteraves: { category: "legumes", image: `${PIXABAY}/2015/03/24/08/52/beetroot-687251_1280.jpg` },
  Radis: { category: "legumes", image: `${PIXABAY}/2018/05/30/07/09/radishes-3440869_1280.jpg` },
  Navets: { category: "legumes", image: `${PIXABAY}/2018/02/04/04/45/root-3129065_1280.jpg` },
  Celeri: { category: "legumes", image: `${PIXABAY}/2018/11/17/15/01/celery-3821260_1280.jpg` },
  Brocoli: { category: "legumes", image: `${PIXABAY}/2023/01/25/18/46/broccoli-7744338_1280.jpg` },
  "Chou-fleur": { category: "legumes", image: `${PIXABAY}/2016/06/18/21/56/cauliflower-1465732_1280.jpg` },
  "Petit pois": { category: "legumes", image: `${PIXABAY}/2021/12/08/16/19/green-peas-6856159_1280.jpg` },
}

const PRESENTATION_ALIASES: Record<string, string> = {
  "pomme de terre": "Pommes de terre",
  "pommes de terre": "Pommes de terre",
  pdt: "Pommes de terre",
  "oignon rouge": "Oignons rouge",
  "oignons rouges": "Oignons rouge",
  tomate: "Tomates",
  "tomates marocaines": "Tomates",
  courgette: "Courgettes",
  concombre: "Concombres",
  poivron: "Poivrons",
  poivrons: "Poivrons",
  "haricot vert": "Haricots verts",
  laitues: "Laitue",
  epinard: "Epinards",
  ail: "Ail",
  betterave: "Betteraves",
  radi: "Radis",
  navet: "Navets",
  celeri: "Celeri",
  brocoli: "Brocoli",
  choufleur: "Chou-fleur",
  "chou fleur": "Chou-fleur",
  "petits pois": "Petit pois",
  "petit pois": "Petit pois",
  menthe: "Menthe fraiche",
  "menthe fraiche": "Menthe fraiche",
}

const DEFAULT_PRESENTATION: ProductPresentation = {
  category: "legumes",
  image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop",
}

/** Minuscules, sans accents ni apostrophes : sert a la recherche et a la table de presentation. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const NORMALIZED_PRESENTATION = new Map(
  Object.entries(PRODUCT_PRESENTATION).map(([key, value]) => [normalizeSearchText(key), { key, value }]),
)

function presentationKey(name: string): string | null {
  if (PRODUCT_PRESENTATION[name]) return name
  const normalized = normalizeSearchText(name)
  const alias = PRESENTATION_ALIASES[normalized]
  if (alias && PRODUCT_PRESENTATION[alias]) return alias
  return NORMALIZED_PRESENTATION.get(normalized)?.key ?? null
}

// Descriptions par defaut (memes textes que le site ; traductions dans i18n-produits.ts).
const PRODUCT_DESCRIPTIONS: Record<string, string> = {
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

const GENERIC_PRODUCT_DESCRIPTION =
  "Frais du jour, sélectionné au marché de gros de Fès et livré entre 8h et 15h à la date confirmée, du champ à votre panier sans intermédiaire."

/** Une photo maintenue dans l'admin l'emporte ; les images generiques historiques gardent la photo de presentation. */
export function resolveProductImage(name: string, imageUrl: string | null | undefined): string {
  if (imageUrl && !/\/(placeholder[^/]*|generic[^/]*)\.(svg|png|jpe?g|webp)(?:\?|$)/i.test(imageUrl)) return imageUrl
  const key = presentationKey(name)
  return (key ? PRODUCT_PRESENTATION[key] : DEFAULT_PRESENTATION).image
}

// ---------------------------------------------------------------------------
// Modele affiche par les interfaces
// ---------------------------------------------------------------------------

export interface CatalogueProduct {
  id: number
  name: string
  /** Nom darija en lettres arabes, affiche dans l'interface arabe. */
  nameAr: string | null
  /** Nom darija en lettres latines ("batata"), utile a la recherche. */
  alias: string
  description: string | null
  descriptionAr: string | null
  price: number
  niveau: ProduitNiveau
  /** Unite de vente de l'API (kg, lot, piece…). */
  unit: string
  /** Unite montree au client (ex. "250g" pour l'ail). */
  displayUnit: string
  image: string
  category: CatalogueCategory
  /** Tous les rayons du produit (admin), le premier etant `category`. */
  categories: CatalogueCategory[]
  /** Pas du selecteur de quantite : 0,5 kg ou 1 lot / piece. */
  quantityStep: number
  stock: number
  availability: ProductAvailability
}

export interface CatalogueSection {
  slug: CatalogueCategory
  nom: string
  nomAr: string | null
  icone: string | null
  produitVedetteId: number | null
  productIds: number[]
}

export const LEGACY_CATALOGUE_SECTIONS: CatalogueSection[] = [
  { slug: "legumes", nom: "Légumes", nomAr: null, icone: "carotte", produitVedetteId: null, productIds: [] },
  { slug: "fruits", nom: "Fruits", nomAr: null, icone: "pomme", produitVedetteId: null, productIds: [] },
  { slug: "herbes", nom: "Herbes", nomAr: null, icone: "feuille", produitVedetteId: null, productIds: [] },
]

/** Rayons de l'admin ; sans rayon defini, les trois rayons historiques. */
export function toCatalogueSections(rows: CatalogueCategoryDTO[] | null | undefined): CatalogueSection[] {
  if (!rows || rows.length === 0) return LEGACY_CATALOGUE_SECTIONS
  return [...rows]
    .sort((left, right) => left.ordre - right.ordre)
    .map((row) => ({
      slug: row.slug,
      nom: row.nom,
      nomAr: row.nom_ar ?? null,
      icone: row.icone,
      produitVedetteId: row.produit_vedette_id,
      productIds: row.product_ids,
    }))
}

export function toCatalogueProduct(dto: CatalogueProductDTO): Omit<CatalogueProduct, "categories"> {
  const key = presentationKey(dto.nom_fr)
  const presentation = key ? PRODUCT_PRESENTATION[key] : DEFAULT_PRESENTATION
  return {
    id: dto.id,
    name: dto.nom_fr,
    nameAr: dto.nom_ar?.trim() || null,
    alias: dto.nom_darija ?? "",
    description: dto.description?.trim() || null,
    descriptionAr: dto.description_ar?.trim() || null,
    price: productDisplayPrice(dto),
    niveau: dto.niveau,
    unit: dto.unite,
    displayUnit: presentation.displayUnit || dto.unite,
    image: resolveProductImage(dto.nom_fr, dto.image_url),
    category: presentation.category,
    quantityStep: presentation.quantityStep || (dto.unite === "kg" ? 0.5 : 1),
    stock: dto.stock,
    availability: dto.availability ?? "in_stock",
  }
}

/** Produits actifs, avec les rayons de l'admin ; un produit non classe garde son rayon historique. */
export function buildCatalogue(dtos: CatalogueProductDTO[], sections: CatalogueSection[]): CatalogueProduct[] {
  return dtos
    .filter((dto) => dto.is_active)
    .map((dto) => {
      const product = toCatalogueProduct(dto)
      const assigned = sections.filter((section) => section.productIds.includes(product.id)).map((section) => section.slug)
      const categories = assigned.length > 0 ? assigned : [product.category]
      return { ...product, category: categories[0], categories }
    })
}

export function productInCategory(product: Pick<CatalogueProduct, "categories">, slug: string): boolean {
  return product.categories.includes(slug)
}

export function productName(product: Pick<CatalogueProduct, "name" | "nameAr">, locale: Locale): string {
  return locale === "ar" && product.nameAr ? product.nameAr : product.name
}

export function sectionName(section: Pick<CatalogueSection, "nom" | "nomAr">, locale: Locale): string {
  if (locale !== "ar") return section.nom
  return section.nomAr?.trim() || translate(locale, section.nom)
}

/** Description de la fiche : texte de l'admin, sinon description par defaut (traduite en arabe). */
export function productDescription(
  product: Pick<CatalogueProduct, "name" | "description" | "descriptionAr">,
  locale: Locale,
): string {
  if (locale === "ar" && product.descriptionAr) return product.descriptionAr
  if (locale !== "ar" && product.description) return product.description
  const key = presentationKey(product.name)
  return translate(locale, (key && PRODUCT_DESCRIPTIONS[key]) || GENERIC_PRODUCT_DESCRIPTION)
}

/** Recherche sur le nom francais, le nom darija (latin) et le nom arabe. */
export function productMatches(product: Pick<CatalogueProduct, "name" | "alias" | "nameAr">, query: string): boolean {
  const needle = normalizeSearchText(query)
  if (!needle) return true
  return (
    normalizeSearchText(product.name).includes(needle) ||
    normalizeSearchText(product.alias).includes(needle) ||
    (product.nameAr ?? "").includes(query.trim())
  )
}

export type CatalogueSort = "popular" | "price-asc" | "price-desc" | "name"

export const CATALOGUE_SORTS: { id: CatalogueSort; label: string }[] = [
  { id: "popular", label: "Pertinence" },
  { id: "price-asc", label: "Prix croissant" },
  { id: "price-desc", label: "Prix décroissant" },
  { id: "name", label: "Ordre alphabétique" },
]

export function sortProducts(products: CatalogueProduct[], sort: CatalogueSort, locale: Locale): CatalogueProduct[] {
  const sorted = [...products]
  if (sort === "price-asc") return sorted.sort((left, right) => left.price - right.price)
  if (sort === "price-desc") return sorted.sort((left, right) => right.price - left.price)
  if (sort === "name") {
    return sorted.sort((left, right) => productName(left, locale).localeCompare(productName(right, locale), locale))
  }
  return sorted.sort((left, right) => left.id - right.id)
}

// ---------------------------------------------------------------------------
// Quantites
// ---------------------------------------------------------------------------

/** Arrondi au pas (evite 1.4999999 apres plusieurs ajouts de 0,5 kg). */
export function roundToStep(quantity: number, step: number): number {
  const rounded = Math.round(quantity / step) * step
  return Math.round(rounded * 100) / 100
}

/** "1,5 kg", "2 lots", "3 × 250 g", "1 pièce" ; en arabe, l'unite traduite. */
export function formatQuantity(quantity: number, unit: string, locale: Locale): string {
  // "0,5" et "1,25", sans zero final inutile (contrairement aux prix).
  const value = String(Math.round(quantity * 100) / 100).replace(".", ",")
  if (locale === "ar") {
    if (unit === "250g") return `${value} × 250 ${translateUnit(locale, "g")}`
    return `${value} ${translateUnit(locale, unit)}`
  }
  if (unit === "kg") return `${value} kg`
  if (unit === "lot") return `${value} lot${quantity > 1 ? "s" : ""}`
  if (unit === "250g") return `${value} × 250 g`
  if (unit === "piece" || unit === "pièce") return `${value} pièce${quantity > 1 ? "s" : ""}`
  return `${value} ${unit}`
}

/** Unite apres le prix : "kg", "lot", "250 g". */
export function formatPriceUnit(unit: string, locale: Locale): string {
  if (unit === "250g") return locale === "ar" ? `250 ${translateUnit(locale, "g")}` : "250 g"
  return translateUnit(locale, unit === "piece" ? "pièce" : unit)
}

/** Lien public du produit, identique au site : /produit/tomates-12. */
export function productPath(product: { id: number; name: string }): string {
  const slug = product.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `/produit/${slug || "produit"}-${product.id}`
}

export function productIdFromSlug(slug: string): number | null {
  const match = slug.match(/(?:^|-)(\d+)$/)
  return match ? Number(match[1]) : null
}
