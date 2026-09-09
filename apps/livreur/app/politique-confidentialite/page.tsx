"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Shield,
  Lock,
  Eye,
  Database,
  Share2,
  Cookie,
  Mail,
  Clock,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  Phone
} from "lucide-react"
import { cn } from "@/lib/utils"

const sections = [
  {
    id: "introduction",
    icon: Shield,
    label: "Introduction",
    title: "Notre engagement envers votre vie privée",
    content: [
      "Chez SOUKI Fresh Market, la confiance est le fondement de notre relation avec vous. Cette politique de confidentialité explique de manière transparente et claire comment nous collectons, utilisons, protégeons et partageons vos données personnelles lorsque vous utilisez notre application et nos services.",
      "Nous appliquons les principes de minimisation des données, de finalité limitée et de sécurité par conception. Votre vie privée n'est pas une option — c'est une priorité.",
    ],
  },
  {
    id: "donnees",
    icon: Database,
    label: "Données collectées",
    title: "Les données que nous collectons",
    subsections: [
      {
        title: "Informations d'identité",
        items: ["Nom et prénom", "Adresse email", "Numéro de téléphone", "Photo de profil (optionnelle)"],
      },
      {
        title: "Données de livraison",
        items: ["Adresse(s) de livraison", "Préférences de créneaux horaires", "Instructions de livraison"],
      },
      {
        title: "Données de paiement",
        items: [
          "Informations de carte bancaire (traitées de façon sécurisée par CMI)",
          "Historique des transactions Wallet SOUKI",
          "Mode de paiement préféré",
        ],
      },
      {
        title: "Données techniques",
        items: ["Adresse IP et type de navigateur", "Appareil utilisé", "Données de navigation sur l'app"],
      },
    ],
  },
  {
    id: "utilisation",
    icon: Eye,
    label: "Utilisation",
    title: "Comment nous utilisons vos données",
    items: [
      "Traiter et livrer vos commandes avec précision",
      "Gérer votre compte client et votre Wallet SOUKI",
      "Vous envoyer des notifications de livraison et de statut",
      "Améliorer continuellement notre service",
      "Prévenir la fraude et assurer la sécurité des transactions",
      "Respecter nos obligations légales et réglementaires au Maroc",
    ],
  },
  {
    id: "cookies",
    icon: Cookie,
    label: "Cookies",
    title: "Notre politique de cookies",
    types: [
      {
        name: "Cookies essentiels",
        desc: "Indispensables au fonctionnement du site. Maintiennent votre session et votre panier.",
        required: true,
      },
      {
        name: "Cookies analytiques",
        desc: "Nous aident à comprendre comment vous utilisez l'app pour l'améliorer.",
        required: false,
      },
      {
        name: "Cookies de personnalisation",
        desc: "Mémorisent vos préférences d'affichage et de langue.",
        required: false,
      },
    ],
  },
  {
    id: "partage",
    icon: Share2,
    label: "Partage",
    title: "Partage et tiers de confiance",
    content: [
      "Nous ne vendons jamais vos données personnelles. Point final.",
      "Nous pouvons partager des données minimales avec des partenaires de confiance, exclusivement dans le cadre de nos services :",
    ],
    partners: [
      { name: "Livreurs partenaires", scope: "Nom, adresse et créneau — uniquement pour la livraison" },
      { name: "CMI (Centre Monétique Interbancaire)", scope: "Données de paiement sécurisées" },
      { name: "Autorités compétentes", scope: "Si requis par la loi marocaine" },
    ],
  },
  {
    id: "droits",
    icon: Shield,
    label: "Vos droits",
    title: "Vos droits sur vos données",
    rights: [
      { name: "Droit d'accès", desc: "Obtenir une copie complète de vos données personnelles" },
      { name: "Droit de rectification", desc: "Corriger toute donnée inexacte ou incomplète" },
      { name: "Droit à l'effacement", desc: "Demander la suppression de vos données" },
      { name: "Droit d'opposition", desc: "Vous opposer au traitement de vos données" },
      { name: "Droit à la portabilité", desc: "Recevoir vos données dans un format lisible" },
    ],
    note: "Conformément à la loi marocaine 09-08 relative à la protection des données personnelles.",
  },
  {
    id: "contact",
    icon: Mail,
    label: "Contact",
    title: "Nous contacter",
    content: ["Pour toute question relative à cette politique ou pour exercer vos droits, notre équipe dédiée à la protection des données est à votre disposition."],
    contacts: [
      { icon: Mail, label: "Email DPO", value: "privacy@souki.ma", href: "mailto:privacy@souki.ma" },
      { icon: Phone, label: "Téléphone", value: "+212 5 35 XX XX XX", href: "tel:+21253500000" },
      {
        icon: Clock,
        label: "Délai de réponse",
        value: "Sous 30 jours ouvrés",
        href: null,
      },
    ],
  },
]

export default function PolitiqueConfidentialitePage() {
  const [activeSection, setActiveSection] = useState("introduction")
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: "-20% 0% -70% 0%" }
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const jumpToSection = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-white scroll-smooth">
      {/* Top Nav */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm"
            : "bg-white border-b border-gray-100"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 text-[#3D3D3D] hover:text-[#1E8A3C] hover:bg-[#F0FAF1] rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                  <img
                    src="/logo3.png"
                    alt="SOUKI"
                    className="w-[175%] h-full max-w-none object-cover"
                    style={{ objectPosition: "left center" }}
                  />
                </div>
                <span className="font-bold text-[#1E8A3C]">SOUKI</span>
              </Link>
            </div>
            <span className="text-sm text-[#8A8A8A] hidden sm:block">Politique de Confidentialité</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-[#F0FAF1] to-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1E8A3C]/10 mb-6">
            <Shield className="w-8 h-8 text-[#1E8A3C]" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-[#1E8A3C] mb-4 tracking-tight">
            Politique de Confidentialité
          </h1>
          <p className="text-lg text-[#8A8A8A] max-w-2xl mx-auto leading-relaxed">
            Transparence totale sur la façon dont SOUKI Fresh Market collecte, utilise et protège vos données personnelles.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm text-sm text-[#8A8A8A]">
            <Clock className="w-4 h-4 text-[#1E8A3C]" />
            Dernière mise à jour : <strong className="text-[#3D3D3D] ml-1">28 Mars 2026</strong>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-[#F5F5F0] rounded-3xl border border-gray-100">
        <div className="lg:hidden mb-6">
          <label className="block text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider mb-2">Navigation</label>
          <select
            value={activeSection}
            onChange={(e) => jumpToSection(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-12">
          {/* Sticky sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider">Navigation</p>
              </div>
              <nav className="py-2">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      jumpToSection(s.id)
                    }}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 text-sm transition-all",
                      activeSection === s.id
                        ? "text-[#1E8A3C] font-semibold bg-[#F0FAF1] border-r-2 border-[#1E8A3C]"
                        : "text-[#3D3D3D] hover:bg-gray-50 hover:text-[#1E8A3C]"
                    )}
                  >
                    <s.icon className="w-4 h-4 flex-shrink-0" />
                    {s.label}
                    {activeSection === s.id && <ChevronRight className="w-3 h-3 ml-auto" />}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 space-y-16">
            {/* Introduction */}
            <section id="introduction" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAF1] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#1E8A3C]" />
                </div>
                <h2 className="text-3xl font-bold text-[#3D3D3D]">{sections[0].title}</h2>
              </div>
              <div className="space-y-4">
                {sections[0].content?.map((p, i) => (
                  <p key={i} className="text-[#555] leading-7 text-[17px]">
                    {p}
                  </p>
                ))}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Données collectées */}
            <section id="donnees" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAF1] flex items-center justify-center">
                  <Database className="w-5 h-5 text-[#1E8A3C]" />
                </div>
                <h2 className="text-3xl font-bold text-[#3D3D3D]">{sections[1].title}</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {sections[1].subsections?.map((sub, i) => (
                  <div key={i} className="bg-[#F5F5F0] rounded-2xl p-5">
                    <h3 className="font-semibold text-[#3D3D3D] mb-3 text-sm">{sub.title}</h3>
                    <ul className="space-y-1.5">
                      {sub.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-[#555]">
                          <div className="w-4 h-4 rounded-full bg-[#1E8A3C]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#1E8A3C]" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Utilisation */}
            <section id="utilisation" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAF1] flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#1E8A3C]" />
                </div>
                <h2 className="text-3xl font-bold text-[#3D3D3D]">{sections[2].title}</h2>
              </div>
              <div className="space-y-3">
                {sections[2].items?.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-[#F5F5F0]">
                    <CheckCircle className="w-5 h-5 text-[#1E8A3C] flex-shrink-0" />
                    <p className="text-[#555] text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Cookies */}
            <section id="cookies" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAF1] flex items-center justify-center">
                  <Cookie className="w-5 h-5 text-[#1E8A3C]" />
                </div>
                <h2 className="text-3xl font-bold text-[#3D3D3D]">{sections[3].title}</h2>
              </div>
              <div className="space-y-3">
                {sections[3].types?.map((type, i) => (
                  <div key={i} className="flex items-start justify-between p-5 rounded-2xl border-2 border-gray-100 hover:border-[#4CB84A]/30 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[#3D3D3D] text-sm">{type.name}</p>
                        {type.required && (
                          <span className="px-2 py-0.5 bg-[#F0FAF1] text-[#1E8A3C] rounded-full text-[10px] font-semibold uppercase tracking-wide">
                            Requis
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8A8A8A] leading-relaxed">{type.desc}</p>
                    </div>
                    <div className={cn(
                      "ml-6 w-10 h-6 rounded-full flex items-center transition-colors",
                      type.required ? "bg-[#1E8A3C] justify-end pr-1" : "bg-gray-200 justify-start pl-1"
                    )}>
                      <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Partage */}
            <section id="partage" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAF1] flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-[#1E8A3C]" />
                </div>
                <h2 className="text-3xl font-bold text-[#3D3D3D]">{sections[4].title}</h2>
              </div>
              {sections[4].content?.map((p, i) => (
                <p key={i} className={cn("text-[#555] leading-relaxed mb-4", i === 0 && "text-lg font-semibold text-[#3D3D3D]")}>
                  {p}
                </p>
              ))}
              <div className="space-y-3 mt-4">
                {sections[4].partners?.map((p, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-[#F5F5F0] rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-[#1E8A3C] mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-[#3D3D3D] text-sm">{p.name}</p>
                      <p className="text-xs text-[#8A8A8A]">{p.scope}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Droits */}
            <section id="droits" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAF1] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#1E8A3C]" />
                </div>
                <h2 className="text-3xl font-bold text-[#3D3D3D]">{sections[5].title}</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {sections[5].rights?.map((r, i) => (
                  <div key={i} className="bg-white border-2 border-gray-100 rounded-2xl p-5 hover:border-[#4CB84A]/40 hover:shadow-sm transition-all">
                    <div className="w-8 h-8 rounded-xl bg-[#F0FAF1] flex items-center justify-center mb-3">
                      <CheckCircle className="w-4 h-4 text-[#1E8A3C]" />
                    </div>
                    <p className="font-semibold text-[#3D3D3D] text-sm mb-1">{r.name}</p>
                    <p className="text-xs text-[#8A8A8A] leading-relaxed">{r.desc}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-[#FFF5EB] rounded-xl border border-[#F07C00]/20">
                <p className="text-sm text-[#D66B00]">
                  <strong>Base légale :</strong> {sections[5].note}
                </p>
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Contact */}
            <section id="contact" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAF1] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#1E8A3C]" />
                </div>
                <h2 className="text-3xl font-bold text-[#3D3D3D]">{sections[6].title}</h2>
              </div>
              {sections[6].content?.map((p, i) => (
                <p key={i} className="text-[#555] leading-relaxed mb-6">{p}</p>
              ))}
              <div className="grid sm:grid-cols-3 gap-4">
                {sections[6].contacts?.map((c, i) => (
                  <div key={i} className="p-5 bg-[#F5F5F0] rounded-2xl">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm mb-3">
                      <c.icon className="w-4 h-4 text-[#1E8A3C]" />
                    </div>
                    <p className="text-xs text-[#8A8A8A] mb-1">{c.label}</p>
                    {c.href ? (
                      <a href={c.href} className="font-semibold text-[#1E8A3C] text-sm hover:underline">
                        {c.value}
                      </a>
                    ) : (
                      <p className="font-semibold text-[#3D3D3D] text-sm">{c.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Footer within content */}
            <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#8A8A8A]">
              <p>© 2026 SOUKI Fresh Market — Fès, Maroc</p>
              <div className="flex items-center gap-4">
                <Link href="/catalogue" className="hover:text-[#1E8A3C] transition-colors">Nos Légumes</Link>
                <Link href="/" className="hover:text-[#1E8A3C] transition-colors">Accueil</Link>
                <a href="mailto:privacy@souki.ma" className="hover:text-[#1E8A3C] transition-colors">Contact</a>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
