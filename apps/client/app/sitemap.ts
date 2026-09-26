import type { MetadataRoute } from "next"
import { getSeoCatalogue } from "@/lib/seo-catalogue"
import { absoluteUrl, productPath } from "@/lib/seo"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getSeoCatalogue()
  const staticPaths = ["/", "/catalogue", "/a-propos", "/faq", "/abonnements", "/politique-confidentialite"]

  return [
    ...staticPaths.map((path) => ({ url: absoluteUrl(path), changeFrequency: "weekly" as const })),
    ...products.map((product) => ({ url: absoluteUrl(productPath(product)), changeFrequency: "weekly" as const })),
  ]
}
