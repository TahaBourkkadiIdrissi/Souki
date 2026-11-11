import type { Metadata } from "next"
import Image from "@/components/souki/optimized-image"
import Link from "next/link"
import { cookies } from "next/headers"
import { notFound, permanentRedirect } from "next/navigation"
import { Navbar } from "@/components/souki/navbar"
import { getProductDescription, isIllustrationImage, productDescriptionFor } from "@/lib/catalogue"
import { getSeoCatalogue } from "@/lib/seo-catalogue"
import { LOCALE_COOKIE, parseLocale, translate, unitAr } from "@/lib/i18n"
import { absoluteUrl, productIdFromSlug, productPath } from "@/lib/seo"
import ProductPurchase from "./product-purchase"
import { requestLocale } from "@/lib/i18n-metadata"

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

  const locale = await requestLocale()
  const name = locale === "ar" && product.nameAr ? product.nameAr : product.name
  const unit = locale === "ar" ? unitAr(product.displayUnit) : product.displayUnit
  const title = translate(locale, "{name} frais à Fès | SOUKI", { name })
  const description = (locale === "ar" ? product.descriptionAr : product.description) ?? translate(locale, "{name} frais à {price} DH/{unit}. Commandez en ligne avec SOUKI et faites-vous livrer à Fès.", { name, price: product.price.toFixed(2), unit })
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

  const description = product.description ?? getProductDescription(product.name)
  // Langue choisie par le visiteur (cookie) : nom du produit en darija et page de droite a gauche en arabe.
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value)
  const t = (french: string, vars?: Record<string, string | number>) => translate(locale, french, vars)
  const name = locale === "ar" && product.nameAr ? product.nameAr : product.name
  const zone = locale === "ar" ? { lang: "ar-MA", dir: "rtl" as const } : {}
  // Texte affiche dans la langue du visiteur ; les donnees structurees (SEO) gardent la description francaise.
  const displayedDescription = productDescriptionFor(locale, product)
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
      availability: product.availability === "in_stock" ? "https://schema.org/InStock"
        : product.availability === "preorder" ? "https://schema.org/PreOrder" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "SOUKI" },
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Navbar />
      <main {...zone} className="min-h-screen bg-[#FBFDF9] px-5 pb-20 pt-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <nav aria-label={t("Fil d’Ariane")} className="mb-8 text-sm text-[#607361]">
            <Link href="/" className="hover:underline">{t("Accueil")}</Link> <span aria-hidden="true">/</span>{" "}
            <Link href="/catalogue" className="hover:underline">{t("Catalogue")}</Link> <span aria-hidden="true">/</span>{" "}
            <span aria-current="page">{name}</span>
          </nav>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-[#F2F8F2]">
              <Image
                src={product.image}
                fallbackImage={product.fallbackImage}
                alt={t("{name} frais proposé par SOUKI à Fès", { name })}
                fill
                sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1024px) calc(100vw - 64px), 544px"
                priority
                className={isIllustrationImage(product.image) ? "object-contain p-8" : "object-cover"}
              />
            </div>
            <div className="flex flex-col justify-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1E8A3C]">{t("Le marché frais de Fès")}</p>
              <h1 className="text-4xl font-black leading-tight text-[#14301B] sm:text-5xl">{name}</h1>
              {locale === "ar" ? <p className="mt-2 text-base text-[#607361]" lang="fr" dir="ltr">{product.name}</p>
                : product.alias && <p className="mt-2 text-base text-[#607361]">{product.alias}</p>}
              <p className="mt-6 text-lg leading-8 text-[#394C3C]" lang={locale === "ar" ? "ar-MA" : "fr"} dir="auto">{displayedDescription}</p>
              <div className="mt-8 rounded-3xl border border-[#DDEFE0] bg-white p-6 shadow-sm">
                <p className="text-3xl font-black text-[#F07C00]">{product.price.toFixed(2)} DH <span className="text-base font-medium text-[#607361]">/ {locale === "ar" ? unitAr(product.displayUnit) : product.displayUnit}</span></p>
                <p className="mt-3 text-sm text-[#607361]">{product.availability === "in_stock" ? t("En stock") : product.availability === "preorder" ? t("Disponible en précommande") : t("Indisponible")}</p>
                <ProductPurchase product={product} />
              </div>
              <Link href="/catalogue" className="mt-7 font-semibold text-[#1E8A3C] underline underline-offset-4">{t("Voir tous les produits")}</Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
