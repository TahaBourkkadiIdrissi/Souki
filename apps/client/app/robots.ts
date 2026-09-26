import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private pages use a crawlable noindex tag instead.
      disallow: ["/backend/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
