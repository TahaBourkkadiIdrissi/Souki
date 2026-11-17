import type { CatalogueProduct } from "@souki/shared"

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/**
 * Produits des scenes illustrees (entree, onboarding) : les vrais produits et prix du jour du
 * catalogue, cherches par nom ou darija ; a defaut, les premiers produits avec une photo.
 */
export function pickProducts(products: CatalogueProduct[], keys: string[][]): CatalogueProduct[] {
  const used = new Set<number>()
  const picked: CatalogueProduct[] = []
  for (const group of keys) {
    const match = products.find((product) => !used.has(product.id) && product.image && group.some((key) => fold(product.name).includes(key) || fold(product.alias).includes(key)))
    if (match) {
      used.add(match.id)
      picked.push(match)
    }
  }
  for (const product of products) {
    if (picked.length >= keys.length) break
    if (!used.has(product.id) && product.image) {
      used.add(product.id)
      picked.push(product)
    }
  }
  return picked
}

/** Les quatre produits de l'etal du marche (tomates, carottes, oignons, poivrons). */
export const MARKET_KEYS = [["tomate", "maticha"], ["carotte", "khizou"], ["oignon", "besla"], ["poivron", "felfla"]]
