"use client"

import { useState, useEffect, useRef } from "react"    
import Link from "next/link"        
import Image from "next/image"      
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
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
  Zap
} from "lucide-react"     
import { ProductCard } from "@/components/souki/product-card"
import { Navbar } from "@/components/souki/navbar"
import { AIModals } from "@/components/souki/ai-modals"

const BACKEND_URL = "http://localhost:8000" // METTEZ VOTRE VRAIE URL ICI

/*liste d'objets products*/
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

export default function HomePage() {
  const { isAuthenticated, validateToken } = useAuth()
  const router = useRouter()

  const [activeModal, setActiveModal] = useState<"voice" | "smart" | null>(null)

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
    <div className="min-h-screen bg-white">
      <Navbar />
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Image with Zoom Animation */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80"
            alt="SOUKI Fresh Market"
            fill
            className="object-cover animate-slow-zoom"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/70" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="space-y-10 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-2xl mx-auto">
              <span className="text-sm font-medium text-white tracking-wide">+250 familles à Fès font confiance à SOUKI</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[1.1] tracking-tight text-balance transition-all">
              La fraîcheur du champ, <br />
              <span className="text-[#4CB84A] drop-shadow-[0_0_20px_rgba(76,184,74,0.3)]">en un seul clic.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-lg">
              Qualité premium aux prix du marché de gros. <br className="hidden md:block" />
              Commandez avant 20h00, savourez demain dès 08h00.
            </p>

            <div className="flex flex-col items-center gap-8 pt-4">
              <button
                onClick={() => requireAuth(() => router.push("/catalogue"))}
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-[#1E8A3C] text-white rounded-2xl font-bold text-2xl hover:bg-[#176B2E] transition-all hover:scale-105 shadow-[0_20px_50px_-10px_rgba(30,138,60,0.5)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                Commander maintenant
                <ArrowRight className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="grid sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                <button 
                  onClick={handleOpenVoiceModal}
                  className="glass-morphism group flex items-center justify-center gap-3 px-6 py-4 text-white rounded-2xl font-bold text-lg hover:bg-white/40 border-2 border-white/50 transition-all active:scale-95"
                >
                  <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center group-hover:bg-[#4CB84A]/30 transition-colors">
                    <MessageCircle className="w-6 h-6 text-[#4CB84A]" />
                  </div>
                  Assistant Vocal
                </button>
                <button 
                  onClick={handleOpenSmartModal}
                  className="bg-white/20 backdrop-blur-xl border-2 border-white/50 group flex items-center justify-center gap-3 px-6 py-4 text-white rounded-2xl font-bold text-lg hover:bg-white/40 transition-all active:scale-95 shadow-xl"
                >
                  <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center group-hover:bg-[#F07C00]/30 transition-colors">
                    <Zap className="w-6 h-6 text-[#F07C00]" />
                  </div>
                  Panier Intelligent
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 pt-12 opacity-80">
              {[
                { label: "Livraison dès 8h", icon: Clock },
                { label: "Prix de gros", icon: Banknote },
                { label: "100% Frais", icon: Leaf },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-white font-semibold tracking-wide drop-shadow-md">
                  <item.icon className="w-5 h-5 text-[#4CB84A]" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Banner (Bannière de réassurance) */}
      <section className="bg-[#1E8A3C] border-y border-[#176B2E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Truck className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">Livraison dès 8h</p>
                <p className="text-xs text-white/70">Fès et environs</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Leaf className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">100% Frais</p>
                <p className="text-xs text-white/70">Du marché de gros</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Shield className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">Paiement Sécurisé</p>
                <p className="text-xs text-white/70">Cash et CMI</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <CheckCircle className="w-6 h-6 shrink-0 opacity-80" />
              <div>
                <p className="font-bold text-sm leading-tight">Qualité Garantie</p>
                <p className="text-xs text-white/70">Satisfait ou remboursé</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="bg-[#F5F5F0] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1E8A3C] mb-4">Comment ça marche ?</h2>
            <p className="text-lg text-[#8A8A8A]">Du champ au panier, le matin même</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: ShoppingCart, time: "Précommander avant 20h00", title: "Composez votre panier", desc: "Choisissez vos légumes préférés en ligne" },
              { icon: Leaf, time: "Achat des produits à 06h00 du matin", title: "On achète frais au marché", desc: "Notre équipe s'approvisionne au marché de gros de Fès" },
              { icon: Truck, time: "Livraison à l’heure exacte (08h00 - 13h00)", title: "Livraison à votre porte", desc: "Recevez vos légumes ultra-frais le matin même" },
            ].map((step, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex flex-col gap-4 mb-4">
                  <div className="w-14 h-14 bg-[#1E8A3C] rounded-2xl flex items-center justify-center shrink-0">
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xl font-bold text-[#F07C00]">{step.time}</span>
                </div>
                <h3 className="text-xl font-bold text-[#3D3D3D] mb-2">{step.title}</h3>
                <p className="text-[#8A8A8A]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Produits du jour */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                onAddToCart={handleAddToCart}
              />
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

      {/* Abonnement Parental — Revolution Redesign */}
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
            <div className="glass-morphism inline-flex items-center gap-2 px-6 py-2 border border-white/20 rounded-full shadow-2xl mx-auto">
              <Users className="w-5 h-5 text-white" />
              <span className="text-sm font-bold text-white tracking-widest uppercase">Nouveau</span>
            </div>
            
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight text-balance transition-all drop-shadow-2xl">
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

      {/* Paiements acceptés */}
      <section className="py-12 bg-[#F5F5F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

      {/* Testimonials */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1E8A3C] mb-4">Ce que disent nos clients</h2>
            <p className="text-[#8A8A8A]">La satisfaction de nos clients est notre priorité</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < testimonial.rating ? 'text-[#F5C400] fill-[#F5C400]' : 'text-gray-200'}`} />
                  ))}
                </div>
                <p className="text-[#3D3D3D] mb-4">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F0FAF1] rounded-full flex flex-shrink-0 items-center justify-center overflow-hidden">
                    {testimonial.avatar ? (
                      <Image src={testimonial.avatar} alt={testimonial.name} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-semibold text-[#1E8A3C]">{testimonial.name[0]}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[#3D3D3D]">{testimonial.name}</p>
                    <p className="text-sm text-[#8A8A8A]">{testimonial.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nos Engagements */}
      <section className="py-16 lg:py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="md:w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-white relative">
                <Image src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80" alt="Légumes frais et biologiques" fill className="object-cover transform hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl hidden md:block border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F0FAF1] rounded-full flex items-center justify-center">
                    <Leaf className="w-6 h-6 text-[#1E8A3C]" />
                  </div>
                  <div>
                    <p className="font-bold text-2xl text-[#3D3D3D]">0</p>
                    <p className="text-sm font-medium text-[#8A8A8A]">Intermédiaire</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-8">
              <div>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#F0FAF1] text-[#1E8A3C] rounded-full text-sm font-bold tracking-wide uppercase mb-4">Notre Mission</span>
                <h2 className="text-3xl lg:text-4xl font-bold text-[#3D3D3D] leading-tight">Redonner du sens à vos achats quotidiens</h2>
              </div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#F0FAF1] text-[#1E8A3C] flex items-center justify-center shrink-0"><Zap className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-bold text-[#3D3D3D] mb-2">Innovation Continue</h3>
                    <p className="text-[#8A8A8A]">Nous intégrons les dernières technologies comme IA-SOUKI pour simplifier vos achats et optimiser notre chaîne d'approvisionnement.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F07C00] flex items-center justify-center shrink-0"><Users className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-bold text-[#3D3D3D] mb-2">Accessibilité pour Tous</h3>
                    <p className="text-[#8A8A8A]">Nous garantissons des prix justes, équivalents à ceux du marché de gros, pour que la qualité premium soit accessible à toutes les familles.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#e6f3ea] text-[#1E8A3C] flex items-center justify-center shrink-0"><Leaf className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-bold text-[#3D3D3D] mb-2">Impact Local Positif</h3>
                    <p className="text-[#8A8A8A]">En supprimant les intermédiaires, nous soutenons directement l'économie locale et réduisons drastiquement le gaspillage alimentaire.</p>
                  </div>
                </div>
              </div>
              <button onClick={() => requireAuth(() => router.push("/catalogue"))} className="inline-flex items-center justify-center px-8 py-4 bg-[#1E8A3C] text-white rounded-xl font-bold text-lg hover:bg-[#176B2E] transition-all shadow-lg shadow-green-900/20">Découvrir nos produits</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1E8A3C] text-white py-12">
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

      {/* --- MODAL IA INTÉGRÉ --- */}
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