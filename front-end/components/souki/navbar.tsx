"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, X, Leaf } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { ProfileDropdown } from "./profile-dropdown"

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, user, isLoading } = useAuth()
  const router = useRouter()

  return (
    <nav className="sticky top-0 z-50 bg-white/50 backdrop-blur-lg border-b border-gray-100/30 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
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
            <Link href="/" className="text-[#1E8A3C] font-semibold text-sm tracking-wide">Accueil</Link>
            <Link href="/catalogue" className="text-[#3D3D3D] hover:text-[#1E8A3C] font-medium text-sm tracking-wide transition-colors">Nos Légumes</Link>
            <Link href="/abonnements" className="text-[#3D3D3D] hover:text-[#1E8A3C] font-medium text-sm tracking-wide transition-colors">Abonnements</Link>
            <Link href="#comment-ca-marche" className="text-[#3D3D3D] hover:text-[#1E8A3C] font-medium text-sm tracking-wide transition-colors">Comment ça marche</Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {!isLoading && (
              isAuthenticated && user ? (
                <ProfileDropdown user={user} />
              ) : (
                <>
                  <Link 
                    href="/login/client" 
                    className="hidden sm:flex items-center px-4 py-2 border-2 border-[#1E8A3C] text-[#1E8A3C] rounded-xl font-semibold hover:bg-[#1E8A3C] hover:text-white transition-colors"
                  >
                    Connexion
                  </Link>
                  <Link 
                    href="/catalogue" 
                    className="flex items-center gap-2 px-4 py-2 bg-[#F07C00] text-white rounded-xl font-semibold hover:bg-[#D66B00] transition-colors"
                  >
                    Panier
                  </Link>
                </>
              )
            )}

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100">
            <Link href="/" className="block px-4 py-2 text-[#1E8A3C] font-semibold">Accueil</Link>
            <Link href="/catalogue" className="block px-4 py-2 text-[#3D3D3D] hover:text-[#1E8A3C]">Nos Légumes</Link>
            <Link href="/abonnements" className="block px-4 py-2 text-[#3D3D3D] hover:text-[#1E8A3C]">Abonnements</Link>
          </div>
        )}
      </div>
    </nav>
  )
}
