import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/souki/navbar"

export const metadata: Metadata = {
  title: "Questions fréquentes sur la livraison | SOUKI Fès",
  description: "Comment commander vos légumes frais avec SOUKI à Fès ? Retrouvez les réponses sur les horaires, les frais de livraison et les produits.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Questions fréquentes | SOUKI",
    description: "Horaires de commande, livraison et frais : les réponses aux questions sur SOUKI à Fès.",
    url: "/faq",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
}

const questions = [
  { question: "Comment commander chez SOUKI ?", answer: "Choisissez vos légumes, fruits et herbes dans le catalogue, ajoutez-les au panier, puis validez votre commande en ligne." },
  { question: "Quand ma commande est-elle livrée ?", answer: "Les commandes passées avant 20h sont livrées le lendemain entre 8h et 15h à Fès." },
  { question: "Quels sont les frais de livraison ?", answer: "La livraison coûte 15 DH. Elle est offerte à partir de 300 DH de commande." },
]

export default function FaqPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Navbar />
      <main className="min-h-screen bg-[#FBFDF9] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-black text-[#14301B] sm:text-5xl">Questions fréquentes</h1>
          <p className="mt-5 text-lg text-[#607361]">Tout savoir pour remplir votre panier frais à Fès.</p>
          <div className="mt-12 space-y-5">
            {questions.map(({ question, answer }) => (
              <section key={question} className="rounded-3xl border border-[#DDEFE0] bg-white p-7">
                <h2 className="text-xl font-bold text-[#14301B]">{question}</h2>
                <p className="mt-3 leading-7 text-[#394C3C]">{answer}</p>
              </section>
            ))}
          </div>
          <Link href="/catalogue" className="mt-10 inline-block rounded-full bg-[#1E8A3C] px-7 py-4 font-bold text-white">Voir le catalogue</Link>
        </div>
      </main>
    </>
  )
}
