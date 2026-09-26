import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSeoCatalogue } from "@/lib/seo-catalogue"
import { productIdFromSlug, productPath } from "@/lib/seo"

export const config = { matcher: "/produit/:path*" }

export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/produit\/([^/]+)\/?$/)
  const id = match ? productIdFromSlug(match[1]) : null
  if (id === null) {
    return new Response("Produit introuvable", { status: 404 })
  }

  try {
    const products = await getSeoCatalogue()
    const product = products.find((item) => item.id === id)
    if (!product) return new Response("Produit introuvable", { status: 404 })

    const canonical = productPath(product)
    if (request.nextUrl.pathname !== canonical) {
      return NextResponse.redirect(new URL(canonical, request.url), 308)
    }
  } catch {
    // Let the page surface a server error if the catalogue API is unavailable.
    return NextResponse.next()
  }

  return NextResponse.next()
}
