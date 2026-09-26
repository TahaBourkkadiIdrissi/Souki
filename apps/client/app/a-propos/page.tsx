import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/souki/navbar"

export const metadata: Metadata = {
  title: "À propos de SOUKI | Marché frais à Fès",
  description: "Découvrez SOUKI, le service de commande de légumes, fruits et herbes frais issus du marché de gros de Fès, livrés chez vous.",
  alternates: { canonical: "/a-propos" },
  openGraph: {
    title: "À propos de SOUKI",
    description: "Le marché frais de Fès, à commander en ligne et à recevoir chez vous avec SOUKI.",
    url: "/a-propos",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#FBFDF9] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#1E8A3C]">SOUKI Fresh Market</p>
          <h1 className="mt-4 text-4xl font-black text-[#14301B] sm:text-5xl">Votre marché frais à Fès</h1>
          <p className="mt-7 text-lg leading-8 text-[#394C3C]">
            SOUKI vous permet de commander en ligne des légumes, fruits et herbes frais du marché de gros de Fès. Vous composez votre panier, puis choisissez votre livraison à domicile.
          </p>
          <section className="mt-12 rounded-3xl border border-[#DDEFE0] bg-white p-7">
            <h2 className="text-2xl font-bold text-[#14301B]">Comment fonctionne SOUKI ?</h2>
            <p className="mt-4 leading-7 text-[#394C3C]">Parcourez le catalogue, ajoutez vos produits au panier et validez votre commande avant 20h. La livraison est prévue le lendemain entre 8h et 15h à Fès.</p>
          </section>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/catalogue" className="rounded-full bg-[#1E8A3C] px-7 py-4 font-bold text-white">Découvrir le catalogue</Link>
            <Link href="/faq" className="rounded-full border border-[#1E8A3C] px-7 py-4 font-bold text-[#1E8A3C]">Questions fréquentes</Link>
          </div>
        </div>
      </main>
    </>
  )
}
