import { NextResponse, type NextRequest } from "next/server"
import { isCampaignPath } from "@/lib/campaign-links"
import { getSeoCatalogue } from "@/lib/seo-catalogue"
import { productIdFromSlug, productPath } from "@/lib/seo"

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  // Preserve product canonical URLs and invalid-product handling.
  if (path.startsWith("/produit/")) {
    const match = path.match(/^\/produit\/([^/]+)\/?$/)
    const id = match ? productIdFromSlug(match[1]) : null
    if (id === null) return new Response("Produit introuvable", { status: 404 })
    try {
      const products = await getSeoCatalogue()
      const product = products.find(item => item.id === id)
      if (!product) return new Response("Produit introuvable", { status: 404 })
      const canonical = productPath(product)
      if (path !== canonical) return NextResponse.redirect(new URL(canonical, request.url), 308)
    } catch {
      // Let the product page surface catalogue availability errors.
      return NextResponse.next()
    }
  }
  // Campaign variants go directly to the 302 handler: no permanent slash redirect.
  if (path !== "/" && path.endsWith("/") && !isCampaignPath(path) && !path.startsWith("/.well-known/")) {
    const url = request.nextUrl.clone()
    url.pathname = path.replace(/\/+$/, "")
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] }
