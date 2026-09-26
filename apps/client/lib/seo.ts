export const SITE_URL = "https://souki.io"

export function productPath(product: { id: number; name: string }): string {
  const slug = product.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `/produit/${slug || "produit"}-${product.id}`
}

export function productIdFromSlug(slug: string): number | null {
  const match = slug.match(/-(\d+)$/)
  return match ? Number(match[1]) : null
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}
