import type { Metadata } from "next"
import { localizedMetadata } from "@/lib/i18n-metadata"
const metadata: Metadata = {
  title: "Abonnement panier frais à Fès | SOUKI",
  description: "Abonnez-vous à un panier SOUKI ou répétez une commande : livré à Fès au rythme choisi, au prix du jour, modifiable jusqu'à 01h00 la veille.",
  alternates: { canonical: "/abonnements" },
  openGraph: {
    title: "Abonnements SOUKI à Fès",
    description: "Découvrez les abonnements SOUKI pour simplifier vos courses de produits frais à Fès.",
    url: "/abonnements",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
}

export function generateMetadata() {
  return localizedMetadata(metadata)
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
