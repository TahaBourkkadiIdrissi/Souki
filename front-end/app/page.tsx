"use client"

import { useState, useEffect, useRef } from "react"    
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
  Users, 
  Banknote,
  Star,
  ArrowRight,
  MessageCircle,
  Instagram,
  CheckCircle,
  Shield,
  Zap,
  Lightbulb,
  Globe,
  Heart
} from "lucide-react"     
import { ProductCard } from "@/components/souki/product-card"
import { Navbar } from "@/components/souki/navbar"
import { AIModals } from "@/components/souki/ai-modals"
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { useScrollReveal } from "@/hooks/useScrollReveal"

const BACKEND_URL = "http://localhost:8000"

// Liste des produits (données uniques)
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

// Testimonials (données uniques)
const testimonials = [
  { name: "Fatima B.", city: "Fès", rating: 5, text: "Service exceptionnel ! Les légumes sont toujours frais et la livraison est ponctuelle. Je recommande vivement.", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop" },
  { name: "Ahmed M.", city: "Fès", rating: 5, text: "Depuis que j'utilise SOUKI, je ne vais plus au marché. Qualité impeccable et prix imbattables.", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop" },
  { name: "Khadija EL", city: "Fès", rating: 4, text: "Très pratique pour les familles occupées. L'abonnement premium est une excellente idée !", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop" },
]

// Piliers de la mission
const missionPillars = [
  {
    icon: Lightbulb,
    title: "Innovation",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=520&fit=crop&auto=format",
    imageAlt: "Tableau de bord digital pour suivre les données du marché",
    description: "Technologie blockchain & IA pour une transparence totale du marché à votre table."
  },
  {
    icon: Globe,
    title: "Accessibilité",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=520&fit=crop&auto=format",
    imageAlt: "Étal de légumes frais accessible aux familles",
    description: "Rendre les produits frais accessibles à toutes les familles de Fès, peu importe leur budget."
  },
  {
    icon: Heart,
    title: "Impact",
    image: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800&h=520&fit=crop&auto=format",
    imageAlt: "Agriculture locale et production responsable",
    description: "Soutenir les agriculteurs locaux et réduire les déchets par une chaîne logistique optimisée."
  }
]

export default function HomePage() {
  const { isAuthenticated, validateToken } = useAuth()
  const router = useRouter()
  const [activeModal, setActiveModal] = useState<"voice" | "smart" | null>(null)
  const [isPwa, setIsPwa] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const revealRef = useScrollReveal<HTMLDivElement>()

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined" && isPwaStandalone()) {
      router.replace("/pwa-welcome")
    } else {
      setIsPwa(false)
    }
  }, [router])

  // Block render until hydration completes (prevents hydration mismatch)
  if (!mounted || isPwa === null) {
    return (
      <div className="min-h-dvh bg-[#F5F5F0] flex items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-[#DDE7DE] bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6E8B73]">SOUKI</p>
          <h1 className="mt-3 text-2xl font-bold text-[#1E8A3C]">Chargement...</h1>
          <p className="mt-3 text-sm leading-6 text-[#677669]">Préparation de votre expérience marché</p>
        </div>
      </div>
    )
  }

  // Fonction helper pour protéger les actions
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
        let backendName = product.name;
        if (backendName === "Tomates Marocaines") backendName = "Tomates";
        if (backendName === "Pommes de Terre") backendName = "Pommes de terre";
        if (backendName === "Oignons") backendName = "Oignons rouge";
        if (backendName === "Herbes Fraîches") backendName = "Persil";

        router.push(`/catalogue?add_product=${encodeURIComponent(backendName)}&qty=${quantity}`)
      } else {
        router.push("/catalogue")
      }
    })
  }

  const handleOpenVoiceModal = () => requireAuth(() => setActiveModal("voice"))
  const handleOpenSmartModal = () => requireAuth(() => setActiveModal("smart"))

  return (
    <div ref={revealRef} className="min-h-screen bg-white pb-24 md:pb-0" suppressHydrationWarning>
      <Navbar />

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden">
        {/* Background Image with Zoom Animation */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80"
            alt="SOUKI Fresh Market"
            fill
            className="object-cover animate-slow-zoom"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/45 to-black/75" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <div className="space-y-10">
            {/* Badge with animation */}
            <div className="inline-flex items-center gap-3 px-5 py-2.5 glass-ios26 rounded-2xl mx-auto animate-scale-up">
              <FarmerAvatar
                size="sm"
                expression="welcome"
                className="block animate-gentle-float"
                label="Souki farmer guide welcomes families"
              />
              <span className="text-sm font-semibold text-white tracking-wide">+250 familles à Fès commandent déjà avec SOUKI</span>
            </div>
            
            {/* Hero Title */}
            <h1 className="mx-auto max-w-4xl text-4xl font-black leading-[1.06] tracking-tight text-white text-balance transition-all sm:text-5xl md:text-7xl animate-slide-up">
              Vos légumes frais de Fès,
              <span className="block text-[#4CB84A] drop-shadow-[0_0_20px_rgba(76,184,74,0.4)] mt-2">livrés demain matin.</span>
            </h1>
            
            {/* Hero Subtitle */}
            <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-white/90 drop-shadow-lg md:text-2xl animate-slide-up stagger-1">
              SOUKI achète au marché de gros à l'aube, prépare votre panier et livre des produits frais sans détour ni perte de temps.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col items-center gap-6 pt-4 animate-slide-up stagger-2">
              {/* Primary CTA */}
              <button
                onClick={() => requireAuth(() => router.push("/catalogue"))}
                className="group relative inline-flex min-h-14 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#1E8A3C] px-10 py-5 text-xl font-black text-white shadow-[0_20px_50px_-10px_rgba(30,138,60,0.5)] transition-all hover:scale-105 hover:bg-[#176B2E] animate-pulse-glow"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                Composer mon panier
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Secondary Info */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F5C400]/30 bg-black/30 px-5 py-2 text-sm font-bold text-white/90 backdrop-blur">
                <Clock className="h-4 w-4 text-[#F5C400]" />
                Commande avant 20h, livraison dès 8h demain
              </div>

              {/* AI Features */}
              <div className="grid w-full max-w-2xl grid-cols-2 gap-3 px-2 sm:gap-4 sm:px-4">
                <button 
                  onClick={handleOpenVoiceModal}
                  className="glass-ios26 group flex min-h-[148px] flex-col items-start justify-between rounded-3xl p-4 text-left text-white transition-all hover:bg-white/20 active:scale-95 sm:min-h-[164px] sm:p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 transition-colors group-hover:bg-[#4CB84A]/30">
                    <MessageCircle className="h-5 w-5 text-[#4CB84A]" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-base font-black leading-tight sm:text-lg">Assistant vocal</span>
                    <span className="block text-xs font-semibold leading-snug text-white/78 sm:text-sm">
                      Dictez vos produits, Souki prépare le panier.
                    </span>
                  </div>
                </button>
                <button 
                  onClick={handleOpenSmartModal}
                  className="glass-ios26 group flex min-h-[148px] flex-col items-start justify-between rounded-3xl p-4 text-left text-white transition-all hover:bg-white/20 active:scale-95 sm:min-h-[164px] sm:p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 transition-colors group-hover:bg-[#F07C00]/30">
                    <Zap className="h-5 w-5 text-[#F07C00]" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-base font-black leading-tight sm:text-lg">Panier intelligent</span>
                    <span className="block text-xs font-semibold leading-snug text-white/78 sm:text-sm">
                      Budget, durée, foyer : l'IA compose pour vous.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-16 animate-slide-up stagger-3">
              {[
                { label: "Livraison dès 8h", icon: Clock },
                { label: "Prix de gros", icon: Banknote },
                { label: "100% Frais", icon: Leaf },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2 glass-ios26 rounded-full text-white font-semibold tracking-wide shadow-md">
                  <item.icon className="w-4 h-4 text-[#4CB84A]" />
                  <span className="text-xs sm:text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BANNER ===== */}
      <section className="bg-[#1E8A3C] border-y border-[#176B2E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
            <div data-reveal="up" data-delay="1" className="flex items-center gap-3 justify-center md:justify-start">
              <Truck className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">Livraison dès 8h</p>
                <p className="text-xs text-white/70">Fès et environs</p>
              </div>
            </div>
            <div data-reveal="up" data-delay="2" className="flex items-center gap-3 justify-center md:justify-start">
              <Leaf className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">100% Frais</p>
                <p className="text-xs text-white/70">Du marché de gros</p>
              </div>
            </div>
            <div data-reveal="up" data-delay="3" className="flex items-center gap-3 justify-center md:justify-start">
              <Shield className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">Paiement Sécurisé</p>
                <p className="text-xs text-white/70">Cash et CMI</p>
              </div>
            </div>
            <div data-reveal="up" data-delay="4" className="flex items-center gap-3 justify-center md:justify-start">
              <CheckCircle className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">Qualité Garantie</p>
                <p className="text-xs text-white/70">Satisfait ou remboursé</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="comment-ca-marche" className="bg-[#F9F9F6] py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#EAF8EC] text-[#1E8A3C] rounded-full text-xs font-bold tracking-wide uppercase">
              Fonctionnement
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1E8A3C] tracking-tight">
              Du marché à votre table, sans friction
            </h2>
            <p className="text-base sm:text-lg text-[#8A8A8A] max-w-2xl mx-auto">
              Le problème du marché traditionnel résolu en toute transparence par SOUKI.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "01", icon: ShoppingCart, time: "Le problème", title: "Le marché prend du temps", desc: "Files, transport, qualité variable et prix difficiles à comparer au quotidien." },
              { num: "02", icon: Leaf, time: "La solution", title: "SOUKI achète à l'aube", desc: "Notre équipe sélectionne les meilleurs produits frais au marché de gros de Fès." },
              { num: "03", icon: Truck, time: "Le bénéfice", title: "Vous recevez demain matin", desc: "Un panier de légumes fabriqués impeccablement, livré directement à domicile à votre réveil." },
            ].map((step, index) => (
              <div 
                key={index}
                data-reveal="up"
                data-delay={String(index + 1)}
                className="bg-white rounded-3xl p-8 border border-gray-100/80 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500 hover:-translate-y-2 animate-slide-up glovo-card"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="absolute -right-4 -top-8 text-8xl font-black text-green-700/5 select-none pointer-events-none transition-transform group-hover:translate-y-2 group-hover:scale-105 duration-500">
                  {step.num}
                </div>
                <div className="flex flex-col gap-5 mb-6">
                  <div className="w-14 h-14 bg-[#1E8A3C] rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-green-950/10">
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-black tracking-widest text-[#F07C00] uppercase">{step.time}</span>
                </div>
                <h3 className="text-xl font-bold text-[#3D3D3D] mb-3 group-hover:text-[#1E8A3C] transition-colors">{step.title}</h3>
                <p className="text-sm text-[#8A8A8A] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRODUCTS OF THE DAY ===== */}
      <section className="py-16 lg:py-24">
        <div data-reveal="fade" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-6 h-6 text-[#1E8A3C]" />
                <h2 className="text-3xl lg:text-4xl font-bold text-[#1E8A3C]">Produits Frais du Jour</h2>
              </div>
              <p className="text-[#8A8A8A]">Prix de gros mis à jour quotidiennement</p>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5C400] text-[#3D3D3D] rounded-full font-medium text-sm">
              <Clock className="w-4 h-4" />
              Prix du jour
            </span>
          </div>

          {/* Horizontal scroll on mobile, grid on desktop */}
          <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-none snap-x snap-mandatory md:gap-6 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:pb-0">
            {products.map((product) => (
              <div key={product.id} data-reveal="scale" data-delay={String(Math.min((products.indexOf(product) % 3) + 1, 3))} className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-start flex-shrink-0 md:flex-shrink glovo-card rounded-2xl">
                <ProductCard
                  {...product}
                  onAddToCart={handleAddToCart}
                />
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button 
              onClick={() => requireAuth(() => router.push("/catalogue"))}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1E8A3C] text-white rounded-xl font-semibold hover:bg-[#176B2E] transition-colors"
            >
              Voir tous les produits
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== OUR MISSION SECTION (CENTERED) ===== */}
      <section className="bg-gradient-to-b from-[#F9F9F6] to-white py-24 lg:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#EAF8EC] text-[#1E8A3C] rounded-full text-xs font-bold tracking-wide uppercase mx-auto">
              <Heart className="w-4 h-4" />
              Notre Mission
            </div>

            {/* Title */}
            <div className="space-y-4">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1E8A3C] tracking-tight leading-tight">
                Révolutionner le marché des légumes frais
              </h2>
              <p className="text-lg sm:text-xl text-[#8A8A8A] max-w-2xl mx-auto leading-relaxed">
                SOUKI existe pour simplifier l'accès aux produits frais de qualité, soutenir les agriculteurs locaux et bâtir une communauté engagée autour de la fraîcheur.
              </p>
            </div>

            {/* Pillars - Centered Grid */}
            <div className="grid md:grid-cols-3 gap-8 pt-8">
              {missionPillars.map((pillar, index) => (
                <div 
                  key={index}
                  data-reveal="up"
                  data-delay={String(index + 1)}
                  className="group overflow-hidden rounded-3xl border border-gray-100/80 bg-white text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl glovo-card"
                >
                  <div className="relative h-36 w-full overflow-hidden bg-[#EAF8EC]">
                    <Image
                      src={pillar.image}
                      alt={pillar.imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 260px"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#17301E]/55 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-2xl border border-white/40 bg-white/85 text-[#1E8A3C] shadow-[0_14px_35px_-18px_rgba(18,32,24,0.5)] backdrop-blur-xl">
                      <pillar.icon className="h-7 w-7" />
                    </div>
                  </div>
                  
                  <div className="space-y-3 p-6 pt-7">
                    <h3 className="text-xl font-black text-[#1E8A3C]">{pillar.title}</h3>
                    <p className="text-sm leading-relaxed text-[#6F8070]">{pillar.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="pt-8">
              <button 
                onClick={() => requireAuth(() => router.push("/abonnements"))}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#1E8A3C] text-white rounded-xl font-bold hover:bg-[#176B2E] transition-colors shadow-lg hover:shadow-xl"
              >
                En savoir plus sur notre vision
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PREMIUM SUBSCRIPTION ===== */}
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
            
            <h2 data-reveal="up" className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight text-balance transition-all drop-shadow-2xl">
              Abonnement Premium <br className="hidden md:block" /> — L'essentiel pour vos proches
            </h2>
            
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-lg">
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

            <div className="flex flex-col items-center gap-6 pt-6 animate-fade-in stagger-3">
              <button 
                onClick={() => requireAuth(() => router.push("/abonnements"))}
                className="group relative inline-flex items-center justify-center gap-4 px-12 py-5 bg-[#F07C00] text-white rounded-2xl font-black text-2xl hover:bg-[#D66B00] transition-all hover:scale-105 shadow-[0_20px_50px_-10px_rgba(240,124,0,0.5)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                Découvrir l'abonnement
                <ArrowRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
                <Shield className="w-4 h-4" />
                Paiement 100% sécurisé via CMI & Visa
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PAYMENT METHODS ===== */}
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

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#EAF8EC] text-[#1E8A3C] rounded-full text-xs font-bold tracking-wide uppercase mb-4">
              Avis Clients
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1E8A3C] tracking-tight mb-4">
              Ce que nos clients disent de nous
            </h2>
            <p className="text-lg text-[#8A8A8A] max-w-2xl mx-auto">
              Des familles satisfaites qui font confiance à SOUKI pour leurs courses quotidiennes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                data-reveal={index % 2 === 0 ? "left" : "right"}
                data-delay={String(index + 1)}
                className="bg-[#F9F9F6] rounded-2xl p-8 border border-gray-100/80 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 glovo-card"
              >
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {Array(testimonial.rating).fill(0).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#F5C400] text-[#F5C400]" />
                  ))}
                </div>

                {/* Testimonial Text */}
                <p className="text-[#3D3D3D] font-medium mb-6 leading-relaxed">"{testimonial.text}"</p>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-bold text-[#3D3D3D]">{testimonial.name}</p>
                    <p className="text-sm text-[#8A8A8A]">{testimonial.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer data-reveal="fade" className="bg-[#1E8A3C] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                  <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-2xl font-bold leading-none tracking-tight">SOUKI</span>
                  <span className="text-xs font-medium text-white/80 mt-1 uppercase tracking-wider">Fresh Market</span>
                </div>
              </div>
              <p className="text-white/80 mb-4 max-w-sm">Du champ au panier, le matin même. Légumes frais du marché de gros de Fès livrés chez vous.</p>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><MessageCircle className="w-5 h-5" /></a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><Instagram className="w-5 h-5" /></a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Liens utiles</h3>
              <ul className="space-y-2 text-white/80">
                <li><Link href="/catalogue" className="hover:text-white transition-colors">Nos Légumes</Link></li>
                <li><Link href="/abonnements" className="hover:text-white transition-colors">Abonnements</Link></li>
                <li><Link href="#comment-ca-marche" className="hover:text-white transition-colors">Comment ça marche</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Légal</h3>
              <ul className="space-y-2 text-white/80">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Politique de confidentialité</Link></li>
                <li><Link href="/cgu" className="hover:text-white transition-colors">Conditions générales</Link></li>
                <li><Link href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 text-center text-white/60 text-sm">
            <p>© 2026 SOUKI Fresh Market — Fès, Maroc — "Du champ au panier, le matin même."</p>
          </div>
        </div>
      </footer>

      {/* ===== AI MODALS ===== */}
      {activeModal && (
        <AIModals
          isOpen={activeModal !== null}
          onClose={() => setActiveModal(null)}
          mode={activeModal}
        />
      )}
    </div>
  )
}
