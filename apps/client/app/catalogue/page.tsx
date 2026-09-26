import type { Metadata } from "next"
import { getSeoCatalogue } from "@/lib/seo-catalogue"
import CatalogueClient from "./catalogue-client"

// The backend is unavailable during Docker image build. Render each request on
// the server while caching the catalogue API response for one hour.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Catalogue de légumes frais à Fès | SOUKI",
  description:
    "Découvrez les légumes, fruits et herbes frais de SOUKI à Fès. Commandez en ligne avant 20h et recevez votre panier le lendemain.",
  alternates: { canonical: "/catalogue" },
  openGraph: {
    title: "Catalogue de légumes frais à Fès | SOUKI",
    description: "Légumes, fruits et herbes frais livrés à Fès avec SOUKI.",
    url: "/catalogue",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
}

export default async function CataloguePage() {
  const products = await getSeoCatalogue()
  return <CatalogueClient initialProducts={products} />
}
