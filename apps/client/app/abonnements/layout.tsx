import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Abonnement panier frais à Fès | SOUKI",
  description: "Découvrez les abonnements SOUKI pour recevoir des produits frais du marché de Fès et simplifier vos courses.",
  alternates: { canonical: "/abonnements" },
  openGraph: {
    title: "Abonnements SOUKI à Fès",
    description: "Découvrez les abonnements SOUKI pour simplifier vos courses de produits frais à Fès.",
    url: "/abonnements",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
