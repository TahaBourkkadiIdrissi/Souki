import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Politique de confidentialité | SOUKI",
  description: "Consultez la politique de confidentialité de SOUKI et la gestion des données liées à vos commandes.",
  alternates: { canonical: "/politique-confidentialite" },
  openGraph: {
    title: "Politique de confidentialité | SOUKI",
    description: "La politique de confidentialité et la gestion des données personnelles chez SOUKI.",
    url: "/politique-confidentialite",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
