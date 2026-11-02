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

import { SoukiLogoLink } from "@/components/souki/souki-logo"
import { AiAgentCards } from "@/components/souki/ai-agent-cards"
import { useState, useEffect, type CSSProperties } from "react"
import Link from "next/link"
import Image from "@/components/souki/optimized-image"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useClientCollection, useClientStorageOwner } from "@/hooks/useClientCollection"
import { upsertCartItem, type CartItem } from "@/lib/catalogue"
import { trackEvent } from "@/lib/analytics"
import { isPwaStandalone } from "@/lib/pwa"
import {
  ShoppingCart,
  Leaf,
  Clock,
  Truck,
  Banknote,
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Shield,
  Sparkles,
  Sunrise,
  PackageCheck,
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
import { PolicyLink } from "@/components/souki/policy-link"
import { SocialLinks } from "@/components/souki/social-links"
import dynamic from "next/dynamic"
import type { CatalogueProduct } from "@/lib/catalogue"
import { productPath } from "@/lib/seo"
const AIModals = dynamic(() => import("@/components/souki/ai-modals").then((module) => module.AIModals))
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { LetterReveal } from "@/components/souki/letter-reveal"
import { useScrollReveal } from "@/hooks/useScrollReveal"
import { useLocale } from "@/contexts/locale-context"

/* ── Données (identiques à l'accueil actuel — parité fonctionnelle) ─────── */

/* Engagements reels du service, verifiables des la premiere commande (aucun avis invente). */
const commitments = [
  {
    icon: Banknote,
    title: "Prix du kilo affiché = prix du kilo payé",
    text: "Vous payez le poids commandé, au prix du jour affiché. Livraison 15 DH, offerte dès 300 DH d'achats.",
    proof: "Visible dans votre panier avant de valider",
  },
  {
    icon: Clock,
    title: "Votre commande reste modifiable",
    text: "Ajoutez, retirez ou annulez vos produits jusqu'à 01h00, la veille de la livraison.",
    proof: "Depuis votre historique de commandes",
  },
  {
    icon: Shield,
    title: "Un produit abîmé ? On rembourse",
    text: "Signalez-le dans les 24 h après la livraison : le montant est recrédité aussitôt sur votre Wallet SOUKI.",
    proof: "Bouton « Signaler un problème » sur la commande",
  },
]

/* Étapes du parcours — copie resserrée, une idée par étape. */
const steps = [
  {
    num: "01",
    icon: Clock,
    kicker: "De 8h à 1h du matin",
    title: "Vous commandez",
    desc: "Panier manuel, vocal ou composé par l'IA — en moins de trois minutes.",
  },
  {
    num: "02",
    icon: Sunrise,
    kicker: "À l'aube de la livraison",
    title: "SOUKI achète au gros",
    desc: "Notre équipe sélectionne les meilleurs produits du marché de gros de Fès.",
  },
  {
    num: "03",
    icon: PackageCheck,
    kicker: "Entre 8h et 15h",
    title: "Vous êtes livré",
    desc: "Un panier frais, pesé et contrôlé, remis en main propre à votre porte.",
  },
]

/* Police d'affichage (Poppins) — appliquée via la variable next/font. */
const display = { fontFamily: "var(--font-poppins), sans-serif" }

export default function HomePage({ products }: { products: CatalogueProduct[] }) {
  const owner = useClientStorageOwner()
  const [, setCart] = useClientCollection<CartItem>("cart")
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [activeModal, setActiveModal] = useState<"voice" | "smart" | null>(null)
  const revealRef = useScrollReveal<HTMLDivElement>()
  const { t, zoneProps } = useLocale()

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
    if (owner === undefined) return
    const product = products.find(item => item.id === Number(id))
    if (!product || product.availability === "out_of_stock") return
    setCart(current => upsertCartItem(current, product, quantity))
    trackEvent("add_to_cart", { currency: "MAD", value: product.price * quantity,
      items: [{ item_id: String(product.id), item_name: product.name, price: product.price, quantity }] })
    router.push("/catalogue?open_cart=1")
  }

  /* Anneau focus commun (accessibilité clavier). */
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A3C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBFBF7]"

  return (
    <div ref={revealRef} {...zoneProps} className="min-h-screen overflow-x-hidden bg-[#FBFBF7] pb-24 md:pb-0" suppressHydrationWarning>
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
              {t("Marché de gros de Fès — acheté à l'aube")}
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
                { text: t("Le vrai goût du marché,") },
                { text: t("livré entre 8h et 15h à la date confirmée."), block: true, className: "text-[#1E8A3C]" },
              ]}
            />

            <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.65] text-[#5F6F61] animate-fade-in-up-delay-2">
              {t("SOUKI sélectionne vos légumes au marché de gros de Fès, prépare votre panier et le livre entre 8h et 15h.")}{" "}
              <span className="font-semibold text-[#3D3D3D]">{t("Commandez de 8h à 1h du matin.")}</span>
            </p>

            {/* CTA — une action dominante, puis les deux agents IA à poids égal */}
            <div className="mt-9 animate-fade-in-up-delay-2">
              <Link href="/catalogue"
                className={`group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#1E8A3C] px-8 text-[16px] font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,138,60,0.55)] transition-transform hover:scale-[1.03] hover:bg-[#176B2E] active:scale-[0.98] ${focusRing}`}
              >
                <ShoppingCart className="h-5 w-5" />
                {t("Composer mon panier")}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
              </Link>

              <p className="mt-6 text-[14px] font-semibold text-[#5F6F61]">{t("Ou laissez Souki le faire pour vous :")}</p>
              <AiAgentCards
                variant="inline"
                className="mt-3"
                onVoice={() => requireAuth(() => setActiveModal("voice"))}
                onSmart={() => requireAuth(() => setActiveModal("smart"))}
              />
            </div>

            {/* Preuve sociale rattachée à l'action */}
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#E7EFE8] pt-6 animate-fade-in-up-delay-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-[#14301B]">
                <Clock className="h-4 w-4 text-[#1E8A3C]" aria-hidden="true" />
                {t("Commande jusqu'à 01h00")}
              </span>
              <span className="h-4 w-px bg-[#DDE8DE]" aria-hidden="true" />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-[#5F6F61]">
                <Banknote className="h-4 w-4 text-[#1E8A3C]" aria-hidden="true" />
                {t("Paiement à la livraison")}
              </span>
              <span className="hidden h-4 w-px bg-[#DDE8DE] sm:block" aria-hidden="true" />
              <span className="hidden items-center gap-1.5 text-sm font-semibold text-[#5F6F61] sm:flex">
                <Shield className="h-4 w-4 text-[#1E8A3C]" />
                {t("Satisfait ou remboursé")}
              </span>
            </div>
          </div>

          {/* ── Colonne visuelle : image composée + cartes flottantes ── */}
          <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none" data-reveal="scale">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] shadow-[0_40px_80px_-40px_rgba(20,48,27,0.45)]">
              <Image
                src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1000&q=80"
                alt={t("Étal de légumes frais du marché de Fès")}
                fill
                sizes="(max-width: 1024px) 90vw, 460px"
                className="object-cover"
              />
              {/* Voile bas pour asseoir la carte livraison */}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#14301B]/55 to-transparent" aria-hidden="true" />
            </div>

            {/* Carte prix flottante — haut gauche */}
            <div className="absolute -left-4 top-8 hidden items-center gap-3 rounded-2xl border border-white/60 bg-white/95 py-3 pl-3 pr-5 shadow-[0_24px_50px_-24px_rgba(20,48,27,0.5)] backdrop-blur animate-gentle-float sm:-left-8 sm:flex">
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
                <span className="block text-[13px] font-bold text-[#14301B]">{t("Tomates du jour")}</span>
                <span className="block text-[15px] font-black text-[#F07C00]">
                  7,00 DH <span className="text-[11px] font-semibold text-[#8A9A8C]">/ kg</span>
                </span>
              </span>
            </div>

            {/* Badge économie — haut droite */}
            <div
              className="absolute -right-2 top-[-1.25rem] hidden rounded-full bg-[#F5C400] px-4 py-2 text-[13px] font-black text-[#14301B] shadow-[0_16px_35px_-18px_rgba(20,48,27,0.6)] animate-gentle-float sm:-right-5 sm:block"
              style={{ animationDelay: "1.1s" }}
            >
              {t("Prix du jour, achetés au gros")}
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
                <span className="block text-[13px] font-bold text-[#14301B]">{t("Livraison de produits frais")}</span>
                <span className="flex items-center gap-1 text-[13px] font-semibold text-[#1E8A3C]">
                  8h – 15h <Check className="h-3.5 w-3.5" />
                </span>
              </span>
            </div>

            {/* Mascotte Récolte — ancrage marque, bas gauche */}
            <div className="absolute -left-2 bottom-[-1.5rem] sm:-left-6">
              <FarmerAvatar
                size="md"
                expression="welcome"
                label={t("Récolte, la mascotte SOUKI")}
                className="drop-shadow-[0_18px_30px_rgba(12,26,16,0.35)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TICKER PRIX DU JOUR (marquee) ═══════════════ */}
      <section className="border-y border-[#0F2E17] bg-[#14301B] py-4" aria-label={t("Prix du jour")}>
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
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">{t("Fonctionnement")}</p>
            <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
              {t("Du marché à votre table, en trois temps")}
            </h2>
            <p className="mx-auto mt-4 max-w-[32rem] text-[17px] leading-[1.65] text-[#5F6F61]">
              {t("Une seule promesse : la fraîcheur du gros, sans les files, le transport ni les prix opaques.")}
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
                  <p className="relative mt-6 text-[12px] font-bold uppercase tracking-[0.14em] text-[#F07C00]">{t(step.kicker)}</p>
                  <h3 className="relative mt-2 text-[1.25rem] font-bold tracking-[-0.01em] text-[#14301B]" style={display}>
                    {t(step.title)}
                  </h3>
                  <p className="relative mt-2.5 text-[15px] leading-[1.6] text-[#5F6F61]">{t(step.desc)}</p>
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
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">{t("Prix du gros, chaque matin")}</p>
              <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
                {t("Les produits frais du jour")}
              </h2>
            </div>
            <button
              onClick={() => requireAuth(() => router.push("/catalogue"))}
              className={`inline-flex min-h-12 items-center gap-2 rounded-full border border-[#D7E7D9] bg-white px-6 text-[15px] font-bold text-[#14301B] transition-colors hover:border-[#1E8A3C]/40 hover:bg-[#F3FAF4] ${focusRing}`}
            >
              {t("Tout le catalogue")}
              <ArrowUpRight className="h-5 w-5 text-[#1E8A3C] rtl:-scale-x-100" />
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
                <ProductCard {...product} href={productPath(product)} compactImage disabled={product.availability === "out_of_stock"} onAddToCart={handleAddToCart} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ POURQUOI SOUKI — bento ═══════════════ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-[42rem] text-center" data-reveal="up">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">{t("Notre mission")}</p>
            <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
              {t("Pourquoi les familles choisissent SOUKI")}
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Tuile image — span 2 */}
            <div className="group relative min-h-[280px] overflow-hidden rounded-3xl md:col-span-2" data-reveal="up" data-delay="1">
              <Image
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80"
                alt={t("Marché de gros de Fès à l'aube")}
                fill
                sizes="(max-width: 768px) 100vw, 760px"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14301B]/85 via-[#14301B]/25 to-transparent" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 p-8">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#A7D7B5]">{t("Sourcing direct")}</p>
                <p className="mt-2 max-w-[26rem] text-[1.35rem] font-bold leading-[1.25] text-white" style={display}>
                  {t("Acheté à l'aube au marché de gros, sans intermédiaire.")}
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
                label={t("Récolte, la mascotte SOUKI, garante de la qualité")}
                className="relative z-10 animate-gentle-float drop-shadow-[0_18px_30px_rgba(12,26,16,0.45)]"
              />
              <p className="relative z-10 mt-5 text-[1.1rem] font-bold text-white" style={display}>
                {t("Récolte veille au grain")}
              </p>
              <p className="relative z-10 mt-1.5 text-[14px] leading-[1.55] text-white/85">
                {t("IA & traçabilité : chaque panier est contrôlé du marché à votre porte.")}
              </p>
            </div>

            {/* Tuile stat économie */}
            <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[#F1E4C8] bg-[#FFF9EB] p-8" data-reveal="up" data-delay="1">
              <Banknote className="h-6 w-6 text-[#B07B00]" aria-hidden="true" />
              <div>
                <p className="text-[1.9rem] font-black leading-[1.05] tracking-[-0.02em] text-[#14301B]" style={display}>{t("Prix du jour affichés")}</p>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-[#6E6142]">
                  {t("achetés au marché de gros de Fès, le matin même de votre livraison.")}
                </p>
              </div>
            </div>

            {/* Tuile impact */}
            <div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-[#E7EFE8] bg-white p-8" data-reveal="up" data-delay="2">
              <Recycle className="h-6 w-6 text-[#1E8A3C]" aria-hidden="true" />
              <div>
                <p className="text-[1.2rem] font-bold text-[#14301B]" style={display}>{t("Zéro gaspillage")}</p>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-[#5F6F61]">
                  {t("Acheté à la commande : rien ne dort en entrepôt, tout part le matin même.")}
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
                <p className="text-[1.2rem] font-bold text-[#14301B]" style={display}>{t("Paiement à votre façon")}</p>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-[#5F6F61]">
                  {t("Cash à la porte, Wallet SOUKI ou carte CMI — 100% sécurisé.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ ABONNEMENT PREMIUM — carte éditoriale vert de marque ═══════════════ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-[36px] border border-[#173D24] shadow-[0_50px_100px_-52px_rgba(12,39,20,0.7)]"
            data-reveal="up"
          >
            {/* Fond : photo premium sublimée par un voile VERT de marque (plus de noir cinématique) */}
            <div className="absolute inset-0 z-0" aria-hidden="true">
              <Image
                src="https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1920&q=80"
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 1200px"
                className="object-cover animate-slow-zoom"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-[#0C2714]/96 via-[#14301B]/82 to-[#1E8A3C]/72" />
              <div className="concept-grid absolute inset-0 opacity-40" />
            </div>

            <div className="relative z-10 grid gap-10 px-7 py-14 sm:px-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:px-14 lg:py-20">
              {/* ── Colonne copy ── */}
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5 text-[#7BC96F]" />
                  {t("Abonnements")}
                </span>

                <LetterReveal
                  as="h2"
                  trigger="view"
                  stagger={26}
                  className="mt-6 font-[family-name:var(--font-poppins)] text-[clamp(2rem,3.6vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white text-balance"
                  segments={[
                    { text: t("Vos paniers frais,") },
                    { text: t("en pilote automatique."), block: true, className: "text-[#7BC96F]" },
                  ]}
                />

                <p className="mt-5 max-w-[32rem] text-[16px] leading-[1.65] text-white/85">
                  {t("Abonnez-vous à un panier préparé par SOUKI ou répétez une commande : elle revient toute seule, au rythme que vous choisissez.")}
                </p>

                <div className="mt-8 flex flex-col items-start gap-4">
                  <button
                    onClick={() => requireAuth(() => router.push("/abonnements"))}
                    className={`group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#F07C00] px-8 text-[16px] font-bold text-white shadow-[0_20px_45px_-16px_rgba(240,124,0,0.65)] transition-transform hover:scale-[1.03] hover:bg-[#D66B00] active:scale-[0.98] ${focusRing}`}
                  >
                    {t("Découvrir l'abonnement")}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
                  </button>
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/70">
                    <Shield className="h-4 w-4 text-[#7BC96F]" />
                    {t("Paiement à la livraison ou par Wallet SOUKI")}
                  </span>
                </div>
              </div>

              {/* ── Colonne bénéfices — chips de verre ── */}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { icon: Users, title: "Vous gardez la main", desc: "Modifiez, sautez ou mettez en pause jusqu'à 01h00 la veille." },
                  { icon: Truck, title: "Au prix du jour", desc: "Pas de prix figé, pas de frais d'abonnement." },
                  { icon: Clock, title: "Commande automatique", desc: "Créée toute seule à 01h00, chaque jour, tous les 3 jours ou chaque semaine." },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="flex items-start gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition-colors hover:bg-white/[0.16]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-white">{t(item.title)}</span>
                      <span className="mt-0.5 block text-[13px] leading-[1.5] text-white/75">{t(item.desc)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ MOYENS DE PAIEMENT — bandeau de confiance éditorial ═══════════════ */}
      <section className="pb-20 lg:pb-24">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div
            data-reveal="fade"
            className="rounded-[28px] border border-[#E7EFE8] bg-white px-6 py-8 shadow-[0_28px_60px_-46px_rgba(20,48,27,0.4)] sm:px-10"
          >
            <p className="text-center text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">
              {t("Paiements 100% sécurisés")}
            </p>
            {/* Grille 3 colonnes égales : les trois cartes partagent la même
                largeur et la même hauteur, contenu centré — alignement net. */}
            <div className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-3 sm:gap-4">
              {/* Cash */}
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E7EFE8] bg-[#FBFBF7] px-5 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EC]">
                  <Banknote className="h-5 w-5 text-[#1E8A3C]" />
                </span>
                <span className="text-[14px] font-semibold text-[#14301B]">{t("Cash à la livraison")}</span>
              </div>
              {/* Carte bancaire */}
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E7EFE8] bg-[#FBFBF7] px-5 py-3.5">
                <span className="flex h-10 shrink-0 items-center gap-2">
                  <span className="text-[15px] font-extrabold tracking-tighter text-[#14301B]">CMI</span>
                  <span className="h-5 w-px bg-[#DDE8DE]" aria-hidden="true" />
                  <span className="flex flex-col leading-none">
                    <span className="text-[11px] font-black italic tracking-tight text-[#1A1F71]">VISA</span>
                    <span className="ml-1 mt-0.5 flex items-center -space-x-1.5" aria-hidden="true">
                      <span className="h-3 w-3 rounded-full bg-[#EB001B] opacity-90 mix-blend-multiply" />
                      <span className="h-3 w-3 rounded-full bg-[#F79E1B] opacity-90 mix-blend-multiply" />
                    </span>
                  </span>
                </span>
                <span className="text-[14px] font-semibold text-[#14301B]">{t("Carte bancaire")}</span>
              </div>
              {/* Abonnement */}
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E7EFE8] bg-[#FBFBF7] px-5 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A]">
                  <Wallet className="h-5 w-5 text-white" />
                </span>
                <span className="text-[14px] font-semibold text-[#14301B]">{t("Wallet SOUKI")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ ENGAGEMENTS — ce que le client peut verifier ═══════════════ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-[42rem] text-center lg:mb-14" data-reveal="up">
            <p className="text-[13px] font-bold text-[#1E8A3C]">{t("Nos engagements")}</p>
            <h2 className="mt-3 text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B]" style={display}>
              {t("Ce que vous pouvez vérifier dès la première commande")}
            </h2>
            <p className="mx-auto mt-4 max-w-[34rem] text-[15px] leading-[1.6] text-[#5F6F61]">
              {t("Pas d'avis inventés ni de chiffres gonflés : les avis de nos clients seront publiés tels quels, après leurs livraisons.")}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {commitments.map((item, index) => (
              <figure
                key={item.title}
                data-reveal="up"
                data-delay={String(index + 1)}
                className="relative flex flex-col rounded-3xl border border-[#E7EFE8] bg-[#FBFBF7] p-8"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF8EC]">
                  <item.icon className="h-6 w-6 text-[#1E8A3C]" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-[1.15rem] font-bold leading-snug text-[#14301B]" style={display}>{t(item.title)}</h3>
                <p className="mt-2.5 flex-1 text-[15px] leading-[1.65] text-[#3D3D3D]">{t(item.text)}</p>
                <figcaption className="mt-6 flex items-center gap-2 border-t border-[#E7EFE8] pt-5 text-[13px] font-semibold text-[#1E8A3C]">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t(item.proof)}
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
                alt={t("Panier de légumes frais du marché de Fès")}
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                className="object-cover"
              />
              {/* Fondu de l'image vers la colonne texte : bas en mobile, droite en desktop */}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-white" />
              {/* Badge flottant — charme & réassurance */}
              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-[0_14px_30px_-14px_rgba(20,48,27,0.5)] backdrop-blur">
                <Leaf className="h-4 w-4 text-[#1E8A3C]" />
                <span className="text-[13px] font-bold text-[#14301B]">{t("100% frais du jour")}</span>
              </div>
            </div>

            {/* ── Texte + CTA ── */}
            <div className="relative flex flex-col justify-center gap-5 px-7 py-10 sm:px-10 lg:py-14 lg:pr-14">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1E8A3C]">{t("Votre marché vous attend")}</p>
              <h2 className="text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#14301B] text-balance" style={display}>
                {t("Prêt à goûter la différence du marché ?")}
              </h2>
              <p className="max-w-[34rem] text-[17px] leading-[1.65] text-[#5F6F61]">
                {t("Commandez avant 1h du matin — vos légumes arrivent entre 8h et 15h à la date confirmée.")}
              </p>
              <div className="mt-2 flex flex-col items-start gap-4">
                <button
                  onClick={() => requireAuth(() => router.push("/catalogue"))}
                  className={`group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#1E8A3C] px-9 text-[16px] font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,138,60,0.55)] transition-transform hover:scale-[1.03] hover:bg-[#176B2E] active:scale-[0.98] ${focusRing}`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {t("Commencer mes courses")}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
                </button>
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#5F6F61]">
                  <Clock className="h-4 w-4 text-[#F5C400]" />
                  {t("Commande avant 1h du matin, livraison entre 8h et 15h")}
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
              <SoukiLogoLink height={40} support className="mb-4" />
              <p className="mb-5 max-w-sm text-[15px] leading-[1.6] text-white/70">
                {t("Du champ au panier, le matin même. Légumes frais du marché de gros de Fès livrés chez vous.")}
              </p>
              <div className="flex gap-3">
                <a href="#" aria-label="WhatsApp SOUKI" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20">
                  <MessageCircle className="h-5 w-5" />
                </a>
                <SocialLinks tone="dark" />
              </div>
            </div>
            <div>
              <h3 className="mb-4 text-[15px] font-semibold">{t("Liens utiles")}</h3>
              <ul className="space-y-2.5 text-[15px] text-white/70">
                <li><Link href="/catalogue" className="transition-colors hover:text-white">{t("Nos légumes")}</Link></li>
                <li><Link href="/a-propos" className="transition-colors hover:text-white">{t("À propos")}</Link></li>
                <li><Link href="/abonnements" className="transition-colors hover:text-white">{t("Abonnements")}</Link></li>
                <li><Link href="/faq" className="transition-colors hover:text-white">{t("Questions fréquentes")}</Link></li>
                <li><Link href="#comment-ca-marche" className="transition-colors hover:text-white">{t("Comment ça marche")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-[15px] font-semibold">{t("Légal")}</h3>
              <ul className="space-y-2.5 text-[15px] text-white/70">
                <li><PolicyLink className="transition-colors hover:text-white">{t("Politique de confidentialité")}</PolicyLink></li>
                <li><Link href="/mentions-legales" className="transition-colors hover:text-white">{t("Mentions légales")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/15 pt-7 text-center text-sm text-white/50">
            <p>{t("© 2026 SOUKI Fresh Market — Fès, Maroc — « Du champ au panier, le matin même. »")}</p>
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
