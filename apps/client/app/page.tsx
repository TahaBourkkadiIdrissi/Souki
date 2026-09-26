import type { Metadata } from "next"
import HomeClient from "./home-client"

export const metadata: Metadata = {
  title: "Livraison de légumes frais à Fès | SOUKI",
  description: "Commandez légumes, fruits et herbes frais du marché de Fès avec SOUKI. Panier en ligne avant 20h, livraison le lendemain entre 8h et 15h.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Livraison de légumes frais à Fès | SOUKI",
    description: "Votre marché frais livré chez vous à Fès.",
    url: "/",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
}

export default function HomePage() {
  return <HomeClient />
}
