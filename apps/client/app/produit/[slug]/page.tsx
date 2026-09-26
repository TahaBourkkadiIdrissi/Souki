import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { Navbar } from "@/components/souki/navbar"
import { getProductDescription, isIllustrationImage } from "@/lib/catalogue"
import { getSeoCatalogue } from "@/lib/seo-catalogue"
import { absoluteUrl, productIdFromSlug, productPath } from "@/lib/seo"
import ProductPurchase from "./product-purchase"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

async function findProduct(slug: string) {
  const id = productIdFromSlug(slug)
  if (id === null) return null
  const products = await getSeoCatalogue()
  return products.find((product) => product.id === id) || null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await findProduct(slug)
  if (!product) notFound()

  const canonical = productPath(product)
  if (`/produit/${slug}` !== canonical) permanentRedirect(canonical)

  const title = `${product.name} frais à Fès | SOUKI`
  const description = `${product.name} frais à ${product.price.toFixed(2)} DH/${product.displayUnit}. Commandez en ligne avec SOUKI et faites-vous livrer à Fès.`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical, images: [product.image] },
    twitter: { card: "summary_large_image" },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await findProduct(slug)
  if (!product) notFound()

  const canonical = productPath(product)
  if (`/produit/${slug}` !== canonical) permanentRedirect(canonical)

  const description = getProductDescription(product.name)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    image: [product.image.startsWith("/") ? absoluteUrl(product.image) : product.image],
    sku: String(product.id),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(canonical),
      priceCurrency: "MAD",
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      seller: { "@type": "Organization", name: "SOUKI" },
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Navbar />
      <main className="min-h-screen bg-[#FBFDF9] px-5 pb-20 pt-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Fil d’Ariane" className="mb-8 text-sm text-[#607361]">
            <Link href="/" className="hover:underline">Accueil</Link> <span aria-hidden="true">/</span>{" "}
            <Link href="/catalogue" className="hover:underline">Catalogue</Link> <span aria-hidden="true">/</span>{" "}
            <span aria-current="page">{product.name}</span>
          </nav>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-[#F2F8F2]">
              <Image
                src={product.image}
                alt={`${product.name} frais proposé par SOUKI à Fès`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                className={isIllustrationImage(product.image) ? "object-contain p-8" : "object-cover"}
              />
            </div>
            <div className="flex flex-col justify-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1E8A3C]">Le marché frais de Fès</p>
              <h1 className="text-4xl font-black leading-tight text-[#14301B] sm:text-5xl">{product.name}</h1>
              {product.alias && <p className="mt-2 text-base text-[#607361]">{product.alias}</p>}
              <p className="mt-6 text-lg leading-8 text-[#394C3C]">{description}</p>
              <div className="mt-8 rounded-3xl border border-[#DDEFE0] bg-white p-6 shadow-sm">
                <p className="text-3xl font-black text-[#F07C00]">{product.price.toFixed(2)} DH <span className="text-base font-medium text-[#607361]">/ {product.displayUnit}</span></p>
                <ProductPurchase product={product} />
              </div>
              <Link href="/catalogue" className="mt-7 font-semibold text-[#1E8A3C] underline underline-offset-4">Voir tous les produits</Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
