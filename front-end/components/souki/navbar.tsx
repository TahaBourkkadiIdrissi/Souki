"use client"

import Link from "next/link"
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
                Nos Légumes
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
                  <>
                    <Link
                      href="/login"
                      className="hidden items-center rounded-xl border-2 border-[#1E8A3C] px-4 py-2 font-semibold text-[#1E8A3C] transition-colors hover:bg-[#1E8A3C] hover:text-white sm:flex"
                    >
                      Connexion
                    </Link>
                    <Link
                      href="/catalogue"
                      className="flex items-center gap-2 rounded-xl bg-[#F07C00] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#D66B00]"
                    >
                      Panier
                    </Link>
                  </>
                ))}
            </div>
          </div>
        </div>
      </nav>

      <MobileBottomNav />
    </>
  )
}
