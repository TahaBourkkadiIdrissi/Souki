"use client"

/**
 * ACCUEIL SOUKI — "Éditorial Frais"
 * ---------------------------------------------------------------------------
 * Page d'accueil web principale (route `/`).
 * Direction : éditorial clair et premium — fond papier, typographie Poppins
 * oversize, rythme vertical 8pt, grille 1200px, accents disciplinés
 * (vert = marque, orange = conversion uniquement), contrastes AA,
 * animations 100% CSS avec reduced-motion.
 * En PWA standalone, redirige vers l'accueil dédié /pwa-welcome.
 */

import { useState, useEffect, type CSSProperties } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { isPwaStandalone } from "@/lib/pwa"
import {
  ShoppingCart,
  Leaf,
  Clock,
  Truck,
  Banknote,
  Star,
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Instagram,
  Shield,
  Sparkles,
  Mic,
  Sunrise,
  PackageCheck,
  BadgeCheck,
  Quote,
  Wallet,
  CreditCard,
  Recycle,
  Check,
  Carrot,
  Apple,
  Cherry,
  Grape,
  Sprout,
  Users,
} from "lucide-react"
import { ProductCard } from "@/components/souki/product-card"
import { Navbar } from "@/components/souki/navbar"
import { AIModals } from "@/components/souki/ai-modals"
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { LetterReveal } from "@/components/souki/letter-reveal"
import { useScrollReveal } from "@/hooks/useScrollReveal"

/* ── Données (identiques à l'accueil actuel — parité fonctionnelle) ─────── */

const products = [
  { id: "1", name: "Tomates Marocaines", price: 7, unit: "kg", image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop", badge: "fresh" as const },
  { id: "2", name: "Pommes de Terre", price: 6, unit: "kg", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop" },
  { id: "3", name: "Oignons", price: 9, unit: "kg", image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400&h=300&fit=crop" },
  { id: "4", name: "Carottes", price: 8.5, unit: "kg", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop", badge: "promo" as const, originalPrice: 10 },
  { id: "5", name: "Courgettes", price: 13, unit: "kg", image: "https://images.unsplash.com/photo-1768405741410-71317eceb565?w=1200&h=900&fit=crop&auto=format" },
  { id: "6", name: "Piments", price: 12, unit: "kg", image: "https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=400&h=300&fit=crop", badge: "fresh" as const },
  { id: "7", name: "Aubergines", price: 8, unit: "kg", image: "https://images.unsplash.com/photo-1736831969575-f8c0a1f1ed67?w=1200&h=900&fit=crop&auto=format" },
  { id: "8", name: "Concombres", price: 11, unit: "kg", image: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400&h=300&fit=crop" },
  { id: "9", name: "Herbes Fraîches", price: 3, unit: "lot", image: "https://images.unsplash.com/photo-1466637574441-749b8f19452f", badge: "promo" as const, originalPrice: 5 },
]

const testimonials = [
  { name: "Fatima B.", city: "Fès", rating: 5, text: "Service exceptionnel ! Les légumes sont toujours frais et la livraison est ponctuelle. Je recommande vivement.", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop" },
  { name: "Ahmed M.", city: "Fès", rating: 5, text: "Depuis que j'utilise SOUKI, je ne vais plus au marché. Qualité impeccable et prix imbattables.", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop" },
  { name: "Khadija EL", city: "Fès", rating: 4, text: "Très pratique pour les familles occupées. L'abonnement premium est une excellente idée !", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop" },
]

/* Étapes du parcours — copie resserrée, une idée par étape. */
const steps = [
  {
    num: "01",
    icon: Clock,
    kicker: "Ce soir, avant 20h",
    title: "Vous commandez",
    desc: "Panier manuel, vocal ou composé par l'IA — en moins de trois minutes.",
  },
  {
    num: "02",
    icon: Sunrise,
    kicker: "Demain, à l'aube",
    title: "SOUKI achète au gros",
    desc: "Notre équipe sélectionne les meilleurs produits du marché de gros de Fès.",
  },
  {
    num: "03",
    icon: PackageCheck,
    kicker: "Entre 8h et 13h",
    title: "Vous êtes livré",
    desc: "Un panier frais, pesé et contrôlé, remis en main propre à votre porte.",
  },
]

/* Police d'affichage (Poppins) — appliquée via la variable next/font. */
const display = { fontFamily: "var(--font-poppins), sans-serif" }

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [activeModal, setActiveModal] = useState<"voice" | "smart" | null>(null)
  const revealRef = useScrollReveal<HTMLDivElement>()

  // Parité PWA : en standalone, l'accueil dédié reste /pwa-welcome.
  useEffect(() => {
    if (isPwaStandalone()) {
      router.replace("/pwa-welcome")
    }
  }, [router])

  const requireAuth = (callback: () => void) => {
    if (!isAuthenticated) {
      router.push("/login?redirect=/")
    } else {
      callback()
    }
  }

  const handleAddToCart = (id: number | string, quantity: number) => {
    requireAuth(() => {
      const normalizedId = String(id)
      const product = products.find((item) => item.id === normalizedId)
      if (product) {
        let backendName = product.name
        if (backendName === "Tomates Marocaines") backendName = "Tomates"
        if (backendName === "Pommes de Terre") backendName = "Pommes de terre"
        if (backendName === "Oignons") backendName = "Oignons rouge"
        if (backendName === "Herbes Fraîches") backendName = "Persil"
        router.push(`/catalogue?add_product=${encodeURIComponent(backendName)}&qty=${quantity}`)
      } else {
        router.push("/catalogue")
      }
    })
  }

  /* Anneau focus commun (accessibilité clavier). */
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A3C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBFBF7]"

  return (
    <div ref={revealRef} className="min-h-screen overflow-x-hidden bg-[#FBFBF7] pb-24 md:pb-0" suppressHydrationWarning>
      <Navbar />

      {/* ═══════════════ HERO — éditorial clair, split 7/5 ═══════════════ */}
      <section className="relative overflow-hidden">
        {/* ── Fond du hero : dégradé vert doux → papier (haut vers le bas),
             sublimé par la photo du marché de la v1, fondue pour le charme.
             Aucun aplat blanc : le texte reste lisible grâce au voile papier. ── */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
          {/* Dégradé de base, du haut vers le bas */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#E2F2E6] via-[#EEF7ED] to-[#FBFBF7]" />

          {/* Photo « étal du marché de Fès » (v1), fondue et masquée vers le bas */}
          <div className="absolute inset-x-0 top-0 h-[82%]">
            <Image
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-[0.16]"
            />
            {/* Voile papier : transparent en haut → opaque en bas (fond le texte) */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#FBFBF7]/5 via-[#FBFBF7]/55 to-[#FBFBF7]" />
          </div>

          {/* Halos d'accent de marque */}
          <div
            className="absolute -top-32 right-[-16rem] h-[36rem] w-[36rem] rounded-full opacity-70"
            style={{ background: "radial-gradient(closest-side, #D6EDDB 0%, rgba(214,237,219,0) 72%)" }}
          />
          <div
            className="absolute bottom-[-10rem] left-[-14rem] h-[30rem] w-[30rem] rounded-full opacity-60"
            style={{ background: "radial-gradient(closest-side, #FFF1DE 0%, rgba(255,241,222,0) 70%)" }}
          />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-[1200px] items-center gap-14 px-6 pb-16 pt-14 lg:grid-cols-[7fr_5fr] lg:gap-12 lg:px-8 lg:pb-24 lg:pt-20">
          {/* ── Colonne copy ── */}
          <div className="max-w-[38rem]">
            {/* Overline */}
            <p className="inline-flex items-center gap-2 rounded-full border border-[#DCEEDE] bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#1E8A3C] shadow-sm animate-fade-in-up">
              <Sunrise className="h-3.5 w-3.5" />
              Marché de gros de Fès — acheté à l&apos;aube
            </p>

            {/* H1 — écriture lettre par lettre (signature SOUKI) */}
            <LetterReveal
              as="h1"
              trigger="mount"
              caret
              stagger={40}
              startDelay={220}
              className="mt-7 font-[family-name:var(--font-poppins)] text-[clamp(2.75rem,5.2vw,4.35rem)] font-bold leading-[1.05] tracking-[-0.03em] text-[#14301B] text-balance"
              segments={[
                { text: "Le vrai goût du marché," },
                { text: "livré demain matin.", block: true, className: "text-[#1E8A3C]" },
              ]}
            />

            <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.65] text-[#5F6F61] animate-fade-in-up-delay-2">
              SOUKI sélectionne vos légumes au marché de gros de Fès, prépare
              votre panier et le livre entre 8h et 13h.{" "}
              <span className="font-semibold text-[#3D3D3D]">Commandez ce soir avant 20h.</span>
            </p>

            {/* CTA — une action dominante, deux chemins IA secondaires */}
            <div className="mt-9 flex flex-wrap items-center gap-4 animate-fade-in-up-delay-2">
              <button
                onClick={() => requireAuth(() => router.push("/catalogue"))}
                className={`group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#1E8A3C] px-8 text-[16px] font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,138,60,0.55)] transition-transform hover:scale-[1.03] hover:bg-[#176B2E] active:scale-[0.98] ${focusRing}`}
              >
                <ShoppingCart className="h-5 w-5" />
                Composer mon panier
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => requireAuth(() => setActiveModal("smart"))}
                className={`inline-flex min-h-14 items-center justify-center gap-2.5 rounded-full border border-[#D7E7D9] bg-white px-7 text-[15px] font-bold text-[#14301B] shadow-sm transition-colors hover:border-[#1E8A3C]/40 hover:bg-[#F3FAF4] ${focusRing}`}
              >
                <Sparkles className="h-5 w-5 text-[#1E8A3C]" />
                Panier IA
              </button>
            </div>

            {/* Chemin vocal — tertiaire, discret mais accessible */}
            <button
              onClick={() => requireAuth(() => setActiveModal("voice"))}
              className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-[14px] font-semibold text-[#5F6F61] underline-offset-4 transition-colors hover:text-[#1E8A3C] hover:underline ${focusRing}`}
            >
              <Mic className="h-4 w-4" />
              ou dictez votre panier à l&apos;assistant vocal
            </button>

            {/* Preuve sociale rattachée à l'action */}
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#E7EFE8] pt-6 animate-fade-in-up-delay-3">
              <span className="flex items-center gap-1.5">
                <span className="flex gap-0.5" aria-hidden="true">
                  {Array(5).fill(0).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#F5C400] text-[#F5C400]" />
                  ))}
                </span>
                <span className="text-sm font-bold text-[#14301B]">4,9/5</span>
              </span>
              <span className="h-4 w-px bg-[#DDE8DE]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#5F6F61]">+250 familles livrées à Fès</span>
              <span className="hidden h-4 w-px bg-[#DDE8DE] sm:block" aria-hidden="true" />
              <span className="hidden items-center gap-1.5 text-sm font-semibold text-[#5F6F61] sm:flex">
                <Shield className="h-4 w-4 text-[#1E8A3C]" />
                Satisfait ou remboursé
              </span>
            </div>
          </div>

          {/* ── Colonne visuelle : image composée + cartes flottantes ── */}
          <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none" data-reveal="scale">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] shadow-[0_40px_80px_-40px_rgba(20,48,27,0.45)]">
              <Image
                src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1000&q=80"
                alt="Étal de légumes frais du marché de Fès"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 460px"
                className="object-cover"
              />
              {/* Voile bas pour asseoir la carte livraison */}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#14301B]/55 to-transparent" aria-hidden="true" />
            </div>

            {/* Carte prix flottante — haut gauche */}
            <div className="absolute -left-4 top-8 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/95 py-3 pl-3 pr-5 shadow-[0_24px_50px_-24px_rgba(20,48,27,0.5)] backdrop-blur animate-gentle-float sm:-left-8">
              <span className="relative h-12 w-12 overflow-hidden rounded-xl">
                <Image
                  src="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200&h=200&fit=crop"
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </span>
              <span>
                <span className="block text-[13px] font-bold text-[#14301B]">Tomates du jour</span>
                <span className="block text-[15px] font-black text-[#F07C00]">
                  7,00 DH <span className="text-[11px] font-semibold text-[#8A9A8C]">/ kg</span>
                </span>
              </span>
            </div>

            {/* Badge économie — haut droite */}
            <div
              className="absolute -right-2 top-[-1.25rem] rounded-full bg-[#F5C400] px-4 py-2 text-[13px] font-black text-[#14301B] shadow-[0_16px_35px_-18px_rgba(20,48,27,0.6)] animate-gentle-float sm:-right-5"
              style={{ animationDelay: "1.1s" }}
            >
              −25% vs épicier
            </div>

            {/* Carte livraison — bas droite */}
            <div
              className="absolute -right-3 bottom-8 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/95 px-4 py-3.5 shadow-[0_24px_50px_-24px_rgba(20,48,27,0.5)] backdrop-blur animate-gentle-float sm:-right-8"
              style={{ animationDelay: "0.55s" }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF8EC]">
                <Truck className="h-5 w-5 text-[#1E8A3C]" />
              </span>
              <span>
                <span className="block text-[13px] font-bold text-[#14301B]">Livraison demain</span>
                <span className="flex items-center gap-1 text-[13px] font-semibold text-[#1E8A3C]">
                  8h – 13h <Check className="h-3.5 w-3.5" />
                </span>
              </span>
            </div>

            {/* Mascotte Récolte — ancrage marque, bas gauche */}
            <div className="absolute -left-2 bottom-[-1.5rem] sm:-left-6">
              <FarmerAvatar
                size="md"
                expression="welcome"
                label="Récolte, la mascotte SOUKI"
                className="drop-shadow-[0_18px_30px_rgba(12,26,16,0.35)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TICKER PRIX DU JOUR (marquee) ═══════════════ */}
      <section className="border-y border-[#0F2E17] bg-[#14301B] py-4" aria-label="Prix du jour">
        <div className="marquee" style={{ "--marquee-gap": "3rem", "--marquee-duration": "36s" } as CSSProperties}>
          <div className="marquee__track">
            {[0, 1].flatMap((copy) =>
              products.map((p, i) => (
                <span key={`${copy}-${i}`} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-2.5 text-white">
                  <Leaf className="h-3.5 w-3.5 text-[#7BC96F]" aria-hidden="true" />
                  <span className="text-[13px] font-semibold tracking-wide">{p.name}</span>
                  <span className="text-[13px] font-black text-[#F5C400]">
                    {p.price.toFixed(2).replace(".", ",")} DH<span className="font-semibold text-white/50">/{p.unit}</span>
                  </span>
                </span>
              )),
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMMENT ÇA MARCHE ═══════════════ */}
      <section id="comment-ca-marche" className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-[42rem] text-center lg:mb-16" data-reveal="up">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">Fonctionnement</p>
            <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
              Du marché à votre table, en trois temps
            </h2>
            <p className="mx-auto mt-4 max-w-[32rem] text-[17px] leading-[1.65] text-[#5F6F61]">
              Une seule promesse : la fraîcheur du gros, sans les files, le transport ni les prix opaques.
            </p>
          </div>

          <div className="relative">
            {/* Connecteur reliant les étapes (desktop) */}
            <div className="pointer-events-none absolute left-14 right-14 top-[3.35rem] z-0 hidden md:block">
              <div className="step-connector" />
            </div>

            <ol className="relative z-10 grid gap-5 md:grid-cols-3 md:gap-8">
              {steps.map((step, index) => (
                <li
                  key={step.num}
                  data-reveal="up"
                  data-delay={String(index + 1)}
                  className="group relative overflow-hidden rounded-3xl border border-[#E7EFE8] bg-white p-8 transition-shadow duration-300 hover:shadow-[0_28px_60px_-32px_rgba(30,138,60,0.35)]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -right-3 -top-7 select-none text-[6.5rem] font-black leading-none text-[#1E8A3C]/[0.06]"
                    style={display}
                  >
                    {step.num}
                  </span>
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF8EC] text-[#1E8A3C] transition-transform duration-300 group-hover:scale-105">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <p className="relative mt-6 text-[12px] font-bold uppercase tracking-[0.14em] text-[#F07C00]">{step.kicker}</p>
                  <h3 className="relative mt-2 text-[1.25rem] font-bold tracking-[-0.01em] text-[#14301B]" style={display}>
                    {step.title}
                  </h3>
                  <p className="relative mt-2.5 text-[15px] leading-[1.6] text-[#5F6F61]">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ═══════════════ PRODUITS DU JOUR ═══════════════ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5 lg:mb-12" data-reveal="up">
            <div className="max-w-[34rem]">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">Prix du gros, chaque matin</p>
              <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
                Les produits frais du jour
              </h2>
            </div>
            <button
              onClick={() => requireAuth(() => router.push("/catalogue"))}
              className={`inline-flex min-h-12 items-center gap-2 rounded-full border border-[#D7E7D9] bg-white px-6 text-[15px] font-bold text-[#14301B] transition-colors hover:border-[#1E8A3C]/40 hover:bg-[#F3FAF4] ${focusRing}`}
            >
              Tout le catalogue
              <ArrowUpRight className="h-5 w-5 text-[#1E8A3C]" />
            </button>
          </div>

          {/* Scroll horizontal mobile, grille 3 colonnes desktop */}
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-6 scrollbar-none md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
            {products.map((product, index) => (
              <div
                key={product.id}
                data-reveal="scale"
                data-delay={String((index % 3) + 1)}
                className="min-w-[270px] shrink-0 snap-start sm:min-w-[300px] md:min-w-0 md:shrink"
              >
                <ProductCard {...product} compactImage onAddToCart={handleAddToCart} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ POURQUOI SOUKI — bento ═══════════════ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-[42rem] text-center" data-reveal="up">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">Notre mission</p>
            <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
              Pourquoi les familles choisissent SOUKI
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Tuile image — span 2 */}
            <div className="group relative min-h-[280px] overflow-hidden rounded-3xl md:col-span-2" data-reveal="up" data-delay="1">
              <Image
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80"
                alt="Marché de gros de Fès à l'aube"
                fill
                sizes="(max-width: 768px) 100vw, 760px"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14301B]/85 via-[#14301B]/25 to-transparent" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 p-8">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#A7D7B5]">Sourcing direct</p>
                <p className="mt-2 max-w-[26rem] text-[1.35rem] font-bold leading-[1.25] text-white" style={display}>
                  Acheté à l&apos;aube au marché de gros, sans intermédiaire.
                </p>
              </div>
            </div>

            {/* Tuile mascotte — Récolte au milieu du souk qui explique */}
            <div className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#1B4332] via-[#1E8A3C] to-[#4CB84A] p-8 text-center" data-reveal="up" data-delay="2">
              <div className="concept-grid absolute inset-0 opacity-50" aria-hidden="true" />

              {/* Étal de produits frais éparpillés autour de Récolte */}
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                {/* Halo « projecteur » qui met Récolte au centre de la scène */}
                <div
                  className="absolute left-1/2 top-[40%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.20), rgba(255,255,255,0))" }}
                />
                <Grape className="absolute left-5 top-6 h-9 w-9 -rotate-12 text-[#CFE7F0] opacity-70 animate-gentle-float" strokeWidth={1.5} />
                <Apple className="absolute right-6 top-7 h-8 w-8 rotate-12 text-[#FFD9D2] opacity-70 animate-gentle-float" style={{ animationDelay: "0.6s" }} strokeWidth={1.5} />
                <Leaf className="absolute left-1/2 top-3 h-6 w-6 -translate-x-1/2 text-[#C6ECCD] opacity-60 animate-gentle-float" style={{ animationDelay: "1s" }} strokeWidth={1.5} />
                <Carrot className="absolute left-6 top-[46%] h-9 w-9 -rotate-[28deg] text-[#FFE0B0] opacity-70 animate-gentle-float" style={{ animationDelay: "1.2s" }} strokeWidth={1.5} />
                <Cherry className="absolute right-7 top-[44%] h-8 w-8 rotate-6 text-[#FFCFC9] opacity-70 animate-gentle-float" style={{ animationDelay: "0.3s" }} strokeWidth={1.5} />
                <Sprout className="absolute bottom-[5.5rem] left-8 h-6 w-6 text-[#C6ECCD] opacity-55 animate-gentle-float" style={{ animationDelay: "0.9s" }} strokeWidth={1.5} />
                <Leaf className="absolute bottom-[5rem] right-9 h-5 w-5 rotate-[18deg] text-[#C6ECCD] opacity-50 animate-gentle-float" style={{ animationDelay: "1.4s" }} strokeWidth={1.5} />
              </div>

              <FarmerAvatar
                size="lg"
                expression="explain"
                label="Récolte, la mascotte SOUKI, garante de la qualité"
                className="relative z-10 animate-gentle-float drop-shadow-[0_18px_30px_rgba(12,26,16,0.45)]"
              />
              <p className="relative z-10 mt-5 text-[1.1rem] font-bold text-white" style={display}>
                Récolte veille au grain
              </p>
              <p className="relative z-10 mt-1.5 text-[14px] leading-[1.55] text-white/85">
                IA &amp; traçabilité : chaque panier est contrôlé du marché à votre porte.
              </p>
            </div>

            {/* Tuile stat économie */}
            <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[#F1E4C8] bg-[#FFF9EB] p-8" data-reveal="up" data-delay="1">
              <Banknote className="h-6 w-6 text-[#B07B00]" aria-hidden="true" />
              <div>
                <p className="text-[3rem] font-black leading-none tracking-[-0.02em] text-[#14301B]" style={display}>−25%</p>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-[#6E6142]">
                  en moyenne face à l&apos;épicier de quartier, à qualité supérieure.
                </p>
              </div>
            </div>

            {/* Tuile impact */}
            <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[#E7EFE8] bg-white p-8" data-reveal="up" data-delay="2">
              <Recycle className="h-6 w-6 text-[#1E8A3C]" aria-hidden="true" />
              <div>
                <p className="text-[1.2rem] font-bold text-[#14301B]" style={display}>Zéro gaspillage</p>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-[#5F6F61]">
                  Acheté à la commande : rien ne dort en entrepôt, tout part le matin même.
                </p>
              </div>
            </div>

            {/* Tuile paiement */}
            <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[#E7EFE8] bg-white p-8" data-reveal="up" data-delay="3">
              <div className="flex items-center gap-2.5" aria-hidden="true">
                <Banknote className="h-6 w-6 text-[#1E8A3C]" />
                <Wallet className="h-6 w-6 text-[#1E8A3C]" />
                <CreditCard className="h-6 w-6 text-[#1E8A3C]" />
              </div>
              <div>
                <p className="text-[1.2rem] font-bold text-[#14301B]" style={display}>Paiement à votre façon</p>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-[#5F6F61]">
                  Cash à la porte, Wallet SOUKI ou carte CMI — 100% sécurisé.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ ABONNEMENT PREMIUM (version d'origine restaurée) ═══════════════ */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-[#1E8A3C]/10">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1920&q=80"
            alt="SOUKI Premium Merchandise"
            fill
            className="object-cover animate-slow-zoom"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/80" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="space-y-10 animate-fade-in">
            <div data-reveal="fade" className="glass-morphism inline-flex items-center gap-2 px-6 py-2 border border-white/20 rounded-full shadow-2xl mx-auto">
              <Users className="w-5 h-5 text-white" />
              <span className="text-sm font-bold text-white tracking-widest uppercase">Nouveau</span>
            </div>

            <LetterReveal
              as="h2"
              trigger="view"
              stagger={30}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight text-balance drop-shadow-2xl"
              segments={[
                { text: "Abonnement Premium" },
                { text: "— L'essentiel pour vos proches", block: true, className: "mt-2 text-[#4CB84A]" },
              ]}
            />

            <p className="text-base sm:text-xl md:text-2xl text-white/90 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-lg">
              Une souscription mensuelle simplifiée pour garantir des paniers de légumes <span className="text-[#4CB84A] font-bold">frais et premium</span> livrés directement chaque semaine.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 py-8">
              {[
                { icon: Users, text: "Souscription Flexible" },
                { icon: Truck, text: "Livraison Priority" },
                { icon: Clock, text: "Gestion Automatique" },
              ].map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-4 group cursor-pointer transition-all">
                  <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all duration-500 shadow-xl overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <item.icon className="w-10 h-10 text-white relative z-10" />
                  </div>
                  <span className="text-white font-bold text-base tracking-wide drop-shadow-md">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-6 pt-6 w-full max-w-sm sm:max-w-none mx-auto animate-fade-in stagger-3">
              <button
                onClick={() => requireAuth(() => router.push("/abonnements"))}
                className="group relative inline-flex items-center justify-center gap-4 px-6 py-4 sm:px-12 sm:py-5 bg-[#F07C00] text-white rounded-2xl font-black text-lg sm:text-2xl hover:bg-[#D66B00] transition-all hover:scale-105 shadow-[0_20px_50px_-10px_rgba(240,124,0,0.5)] overflow-hidden w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                Découvrir l&apos;abonnement
                <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
                <Shield className="w-4 h-4" />
                Paiement 100% sécurisé via CMI &amp; Visa
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ MOYENS DE PAIEMENT (version d'origine) ═══════════════ */}
      <section className="py-12 bg-[#F5F5F0]">
        <div data-reveal="fade" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[#8A8A8A] mb-8 font-medium">Paiements 100% sécurisés</p>
          <div className="flex flex-wrap justify-center gap-6 lg:gap-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-14 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center">
                <Banknote className="w-8 h-8 text-[#1E8A3C]" />
              </div>
              <span className="text-sm font-medium text-[#3D3D3D]">Cash à la livraison</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-14 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center gap-3 px-3">
                <span className="font-extrabold text-[#3D3D3D] tracking-tighter text-lg">CMI</span>
                <div className="w-px h-6 bg-gray-200"></div>
                <div className="flex flex-col leading-none">
                  <span className="font-black text-[12px] text-[#1A1F71] italic tracking-tight">VISA</span>
                  <div className="flex items-center mt-0.5 -space-x-1.5 ml-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#EB001B] mix-blend-multiply opacity-90"></div>
                    <div className="w-3.5 h-3.5 rounded-full bg-[#F79E1B] mix-blend-multiply opacity-90"></div>
                  </div>
                </div>
              </div>
              <span className="text-sm font-medium text-[#3D3D3D]">Carte Bancaire</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-14 bg-[#1E8A3C] rounded-lg shadow-sm flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-medium text-[#3D3D3D]">Abonnement Premium</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TÉMOIGNAGES ═══════════════ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-[42rem] text-center lg:mb-14" data-reveal="up">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">Avis clients</p>
            <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
              Ce que disent les familles de Fès
            </h2>
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-[#E7EFE8] bg-[#FBFBF7] px-5 py-2.5">
              <span className="flex gap-0.5" aria-hidden="true">
                {Array(5).fill(0).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#F5C400] text-[#F5C400]" />
                ))}
              </span>
              <span className="text-sm font-black text-[#14301B]">4,9/5</span>
              <span className="h-4 w-px bg-[#DDE8DE]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#5F6F61]">+250 familles à Fès</span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {testimonials.map((t, index) => (
              <figure
                key={t.name}
                data-reveal="up"
                data-delay={String(index + 1)}
                className="relative flex flex-col rounded-3xl border border-[#E7EFE8] bg-[#FBFBF7] p-8 transition-shadow duration-300 hover:shadow-[0_28px_60px_-32px_rgba(30,138,60,0.3)]"
              >
                <Quote className="absolute right-6 top-6 h-10 w-10 text-[#1E8A3C]/[0.08]" aria-hidden="true" />
                <span className="flex gap-1" aria-label={`Note : ${t.rating} sur 5`}>
                  {Array(t.rating).fill(0).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#F5C400] text-[#F5C400]" />
                  ))}
                </span>
                <blockquote className="mt-4 flex-1 text-[15px] leading-[1.65] text-[#3D3D3D]">
                  «&nbsp;{t.text}&nbsp;»
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3.5 border-t border-[#E7EFE8] pt-5">
                  <img src={t.avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white" />
                  <span>
                    <span className="flex items-center gap-1.5 text-[14px] font-bold text-[#14301B]">
                      {t.name}
                      <BadgeCheck className="h-4 w-4 text-[#1E8A3C]" aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-medium text-[#5F6F61]">Client vérifié · {t.city}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA FINAL — vitrine avec visuel ═══════════════ */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div
            className="relative grid overflow-hidden rounded-[36px] border border-[#E3EFE4] bg-white shadow-[0_40px_90px_-50px_rgba(20,48,27,0.55)] lg:grid-cols-2"
            data-reveal="up"
          >
            {/* ── Visuel : panier de légumes frais du marché ── */}
            <div className="relative min-h-[260px] lg:min-h-[440px]">
              <Image
                src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&q=80"
                alt="Panier de légumes frais du marché de Fès"
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                className="object-cover"
              />
              {/* Fondu de l'image vers la colonne texte : bas en mobile, droite en desktop */}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-white" />
              {/* Badge flottant — charme & réassurance */}
              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-[0_14px_30px_-14px_rgba(20,48,27,0.5)] backdrop-blur">
                <Leaf className="h-4 w-4 text-[#1E8A3C]" />
                <span className="text-[13px] font-bold text-[#14301B]">100% frais du jour</span>
              </div>
            </div>

            {/* ── Texte + CTA ── */}
            <div className="relative flex flex-col justify-center gap-5 px-7 py-10 sm:px-10 lg:py-14 lg:pr-14">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">Votre marché vous attend</p>
              <h2 className="text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B] text-balance" style={display}>
                Prêt à goûter la différence du marché&nbsp;?
              </h2>
              <p className="max-w-[34rem] text-[17px] leading-[1.65] text-[#5F6F61]">
                Commandez ce soir avant 20h — vos légumes arrivent demain entre 8h et 13h.
              </p>
              <div className="mt-2 flex flex-col items-start gap-4">
                <button
                  onClick={() => requireAuth(() => router.push("/catalogue"))}
                  className={`group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#1E8A3C] px-9 text-[16px] font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,138,60,0.55)] transition-transform hover:scale-[1.03] hover:bg-[#176B2E] active:scale-[0.98] ${focusRing}`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Commencer mes courses
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#5F6F61]">
                  <Clock className="h-4 w-4 text-[#F5C400]" />
                  Commande avant 20h, livraison dès 8h demain
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="bg-[#14301B] py-14 text-white">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div className="mb-10 grid gap-10 md:grid-cols-4 md:gap-8">
            <div className="md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="pointer-events-none flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
                  <img src="/logo3.png" alt="SOUKI" className="h-full w-[175%] max-w-none object-cover" style={{ objectPosition: "left center" }} />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-2xl font-bold leading-none tracking-tight" style={display}>SOUKI</span>
                  <span className="mt-1 text-xs font-medium uppercase tracking-wider text-white/70">Fresh Market</span>
                </div>
              </div>
              <p className="mb-5 max-w-sm text-[15px] leading-[1.6] text-white/70">
                Du champ au panier, le matin même. Légumes frais du marché de gros de Fès livrés chez vous.
              </p>
              <div className="flex gap-3">
                <a href="#" aria-label="WhatsApp SOUKI" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20">
                  <MessageCircle className="h-5 w-5" />
                </a>
                <a href="#" aria-label="Instagram SOUKI" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20">
                  <Instagram className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="mb-4 text-[15px] font-semibold">Liens utiles</h3>
              <ul className="space-y-2.5 text-[15px] text-white/70">
                <li><Link href="/catalogue" className="transition-colors hover:text-white">Nos légumes</Link></li>
                <li><Link href="/abonnements" className="transition-colors hover:text-white">Abonnements</Link></li>
                <li><Link href="#comment-ca-marche" className="transition-colors hover:text-white">Comment ça marche</Link></li>
                <li><Link href="/devenir-fournisseur" className="transition-colors hover:text-white">Devenir fournisseur</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-[15px] font-semibold">Légal</h3>
              <ul className="space-y-2.5 text-[15px] text-white/70">
                <li><Link href="/politique-confidentialite" className="transition-colors hover:text-white">Politique de confidentialité</Link></li>
                <li><Link href="/cgu" className="transition-colors hover:text-white">Conditions générales</Link></li>
                <li><Link href="/mentions-legales" className="transition-colors hover:text-white">Mentions légales</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/15 pt-7 text-center text-sm text-white/50">
            <p>© 2026 SOUKI Fresh Market — Fès, Maroc — «&nbsp;Du champ au panier, le matin même.&nbsp;»</p>
          </div>
        </div>
      </footer>

      {/* ═══════════════ MODALES IA ═══════════════ */}
      {activeModal && (
        <AIModals isOpen={activeModal !== null} onClose={() => setActiveModal(null)} mode={activeModal} />
      )}
    </div>
  )
}
