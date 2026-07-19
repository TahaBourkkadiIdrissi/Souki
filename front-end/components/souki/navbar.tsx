"use client"

import Link from "next/link"
import { UserRound } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { ProfileDropdown } from "./profile-dropdown"
import { MobileBottomNav } from "./mobile-bottom-nav"

export function Navbar() {
  const { isAuthenticated, user, isLoading } = useAuth()

  return (
    <>
      <nav className="sticky top-0 z-50 hidden bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100/50 transition-all md:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="pointer-events-none flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
                <img
                  src="/logo3.png"
                  alt="SOUKI"
                  className="h-full w-[175%] max-w-none object-cover"
                  style={{ objectPosition: "left center" }}
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-xl font-bold leading-none tracking-tight text-[#1E8A3C]">SOUKI</span>
                <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-[#8A8A8A]">
                  Fresh Market
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              <Link href="/" className="text-sm font-semibold tracking-wide text-[#1E8A3C]">
                Accueil
              </Link>
              <Link
                href="/catalogue"
                className="text-sm font-medium tracking-wide text-[#3D3D3D] transition-colors hover:text-[#1E8A3C]"
              >
                Produits
              </Link>
              <Link
                href="/abonnements"
                className="text-sm font-medium tracking-wide text-[#3D3D3D] transition-colors hover:text-[#1E8A3C]"
              >
                Abonnements
              </Link>
              <Link
                href="#comment-ca-marche"
                className="text-sm font-medium tracking-wide text-[#3D3D3D] transition-colors hover:text-[#1E8A3C]"
              >
                Comment ça marche
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {!isLoading &&
                (isAuthenticated && user ? (
                  <ProfileDropdown user={user} />
                ) : (
                  // Invite : l'icone profil mene a la fenetre de choix du type de compte (/login).
                  <Link
                    href="/login"
                    aria-label="Se connecter ou creer un compte"
                    title="Se connecter ou creer un compte"
                    className="group flex min-h-12 items-center gap-2 rounded-full border border-[#E4EFE5] bg-white py-1.5 pl-4 pr-1.5 shadow-[0_16px_40px_-28px_rgba(18,32,24,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#CDE7D0] hover:shadow-[0_20px_50px_-30px_rgba(18,32,24,0.55)]"
                  >
                    <span className="text-sm font-semibold text-[#3D3D3D] transition-colors group-hover:text-[#1E8A3C]">
                      Se connecter
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] text-white shadow-inner ring-2 ring-white transition-transform group-hover:scale-105">
                      <UserRound size={18} />
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </nav>

      <MobileBottomNav />
    </>
  )
}
