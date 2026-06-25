"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { 
  Leaf, 
  CheckCircle,
  Clock,
  Truck,
  Users,
  Star,
  ArrowRight,
  Shield,
  CreditCard,
  Menu,
  X
} from "lucide-react"

export default function AbonnementsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  return (
    <div className="min-h-screen bg-[#F5F5F0] mobile-native-surface">
      {/* Navbar Minimaliste */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-xl font-bold text-[#1E8A3C] leading-none tracking-tight">SOUKI</span>
                <span className="text-[11px] font-medium text-[#8A8A8A] mt-0.5 uppercase tracking-wider">Fresh Market</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-[#3D3D3D] hover:text-[#1E8A3C] transition-colors">Accueil</Link>
              <Link href="/catalogue" className="text-[#3D3D3D] hover:text-[#1E8A3C] transition-colors">Nos Légumes</Link>
              <Link href="/abonnements" className="text-[#1E8A3C] font-medium transition-colors">Abonnements</Link>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link 
                href="/login" 
                className="hidden sm:flex items-center px-4 py-2 border-2 border-[#1E8A3C] text-[#1E8A3C] rounded-xl font-semibold hover:bg-[#1E8A3C] hover:text-white transition-colors"
              >
                Espace Client
              </Link>
              
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-[#3D3D3D]"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24 text-center px-4">
        {/* Background photo */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1518843875459-f738682238a6?w=1600&q=80"
            alt="Panier de légumes frais de saison"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1E8A3C]/20 via-transparent to-[#F07C00]/10" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-white space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full font-medium text-sm backdrop-blur-sm">
            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
            SOUKI Premium
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
            La sérénité d'un frigo toujours plein
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto font-medium">
            Des paniers de légumes extra-frais, sourcés chaque matin du marché de gros, livrés automatiquement chez vous ou vos proches selon votre rythme.
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 -mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            
            {/* Solo/Couple Pack */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 relative hover:-translate-y-2 transition-transform duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-[#3D3D3D] mb-2">Pack Essentiel</h3>
                <p className="text-[#8A8A8A]">Parfait pour 1 à 2 personnes</p>
              </div>
              <div className="mb-6 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-[#1E8A3C]">199</span>
                <span className="text-xl font-bold text-[#8A8A8A]">DH</span>
                <span className="text-[#8A8A8A]">/ semaine</span>
              </div>
              
              <div className="h-px bg-gray-100 w-full mb-6"></div>
              
              <ul className="space-y-4 mb-8">
                {[
                  "8 à 10 kg de de légumes assortis",
                  "Choix des légumes via l'application",
                  "Livraison incluse chaque semaine",
                  "Support client prioritaire"
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#4CB84A] shrink-0 mt-0.5" />
                    <span className="text-[#3D3D3D] font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button className="w-full py-4 rounded-xl border-2 border-[#1E8A3C] text-[#1E8A3C] font-bold text-lg hover:bg-[#1E8A3C] hover:text-white transition-colors">
                Choisir ce plan
              </button>
            </div>

            {/* Family Pack (Popular) */}
            <div className="bg-[#1E8A3C] rounded-3xl p-8 shadow-xl shadow-green-900/10 relative hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute top-0 right-8 transform -translate-y-1/2">
                <span className="bg-[#F5C400] text-[#3D3D3D] font-bold px-4 py-1.5 rounded-full text-sm shadow-sm">
                  LE PLUS POPULAIRE
                </span>
              </div>
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Pack Familial</h3>
                <p className="text-white/80">Idéal pour 4 à 5 personnes</p>
              </div>
              <div className="mb-6 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-white">299</span>
                <span className="text-xl font-bold text-white/80">DH</span>
                <span className="text-white/80">/ semaine</span>
              </div>
              
              <div className="h-px bg-white/20 w-full mb-6"></div>
              
              <ul className="space-y-4 mb-8">
                {[
                  "15 à 18 kg de de légumes assortis",
                  "Fruits de saison inclus",
                  "Livraison gratuite et prioritaire (Dès 8h)",
                  "Garantie fraîcheur absolue ou remplacé"
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#F5C400] shrink-0 mt-0.5" />
                    <span className="text-white font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button className="w-full py-4 rounded-xl bg-[#F07C00] text-white font-bold text-lg hover:bg-[#D66B00] transition-colors shadow-lg">
                Choisir ce plan
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#1E8A3C] mb-12">Pourquoi choisir l'abonnement ?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#F0FAF1]">
              <div className="w-14 h-14 bg-[#1E8A3C] text-white rounded-xl flex items-center justify-center mx-auto mb-6">
                <CreditCard className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[#3D3D3D] mb-3">Économique</h3>
              <p className="text-[#8A8A8A]">
                Profitez des prix de gros directement du marché. Aucune marge intermédiaire.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-[#F0FAF1]">
              <div className="w-14 h-14 bg-[#1E8A3C] text-white rounded-xl flex items-center justify-center mx-auto mb-6">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[#3D3D3D] mb-3">Gain de Temps</h3>
              <p className="text-[#8A8A8A]">
                Fini la corvée du marché. Vos légumes sont sélectionnés et livrés avant que vous ne vous réveillez.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-[#F0FAF1]">
              <div className="w-14 h-14 bg-[#1E8A3C] text-white rounded-xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[#3D3D3D] mb-3">Soutien aux Parents</h3>
              <p className="text-[#8A8A8A]">
                Gérez l'approvisionnement de vos parents âgés à distance, en toute fiabilité.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Action Finale */}
      <section className="py-20 bg-[#F5F5F0]">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 border border-gray-200 rounded-full shadow-sm">
              <CheckCircle className="w-4 h-4 text-[#4CB84A] animate-pulse" />
              <span className="text-sm font-semibold text-[#3D3D3D]">Confiance garantie</span>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-[#3D3D3D] mb-4">
            Sans engagement — Annulable à tout moment
          </h2>
          <p className="text-[#8A8A8A] text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Vous partez en vacances ? Mettez votre abonnement en pause d'un simple clic depuis votre espace client.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            <div className="bg-white/80 border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FAF1] flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E8A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="#D6F5DE" stroke="#1E8A3C"/>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="#4CB84A" fill="none"/>
                  <circle cx="12" cy="16" r="1.5" fill="#1E8A3C"/>
                </svg>
              </div>
              <h3 className="font-bold text-[#3D3D3D] text-lg mb-1">Sans engagement</h3>
              <p className="text-sm text-[#8A8A8A]">Pause ou arrêt quand vous voulez, sans pression.</p>
            </div>

            <div className="bg-white/80 border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FAF1] flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E8A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="#D6F5DE" stroke="#1E8A3C"/>
                  <polyline points="9 14 7 12 9 10" stroke="#4CB84A" strokeWidth="2" fill="none"/>
                  <path d="M7 12h6a3 3 0 0 0 0-6h-1" stroke="#1E8A3C" fill="none"/>
                </svg>
              </div>
              <h3 className="font-bold text-[#3D3D3D] text-lg mb-1">Annulation facile</h3>
              <p className="text-sm text-[#8A8A8A]">Un parcours simple, clair et sécurisé côté client.</p>
            </div>

            <div className="bg-white/80 border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FAF1] flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E8A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="5" width="20" height="14" rx="2" fill="#D6F5DE" stroke="#1E8A3C"/>
                  <line x1="2" y1="10" x2="22" y2="10" stroke="#4CB84A" strokeWidth="2"/>
                  <line x1="6" y1="15" x2="9" y2="15" stroke="#1E8A3C" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="11" y1="15" x2="14" y2="15" stroke="#1E8A3C" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="font-bold text-[#3D3D3D] text-lg mb-1">Aucun frais caché</h3>
              <p className="text-sm text-[#8A8A8A]">Le prix est clair dès le départ, comme chez un pro.</p>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1E8A3C] text-white rounded-xl font-bold text-lg hover:bg-[#176B2E] transition-colors shadow-lg"
          >
            Créer un compte pour s'abonner <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
      
      {/* Footer Minimaliste */}
      <footer className="bg-white py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 text-center text-[#8A8A8A] text-sm font-medium">
          © 2026 SOUKI Fresh Market — Fès, Maroc. 
        </div>
      </footer>
    </div>
  )
}
