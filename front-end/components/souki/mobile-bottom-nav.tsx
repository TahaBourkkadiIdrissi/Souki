"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Crown,
  Home,
  Leaf,
  Menu,
  PackageCheck,
  Settings,
  ShoppingCart,
  Store,
  User,
  Wallet,
  X,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

interface MobileBottomNavProps {
  cartCount?: number
  onCartClick?: () => void
  onMenuClick?: () => void
}

export function MobileBottomNav({ cartCount = 0, onCartClick, onMenuClick }: MobileBottomNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  const isFournisseur = user?.roles.includes("FOURNISSEUR") ?? false

  const linkItems = [
    { label: "Accueil", href: "/", icon: Home },
    { label: "Catalogue", href: "/catalogue", icon: Leaf },
  ]

  const secondaryItems = [
    { label: "Historique", href: "/historique", icon: PackageCheck },
    { label: "Abonnements", href: "/abonnements", icon: Crown },
    { label: "Mon Wallet", href: "/wallet", icon: Wallet },
    { label: "Mon profil", href: "/parametres/compte", icon: User },
    { label: "Paramètres", href: "/parametres/notifications", icon: Settings },
    ...(!isFournisseur ? [{ label: "Devenir fournisseur", href: "/devenir-fournisseur", icon: Store }] : [])
  ]

  const gridCols = isFournisseur ? "grid-cols-5" : "grid-cols-4"

  // Actif si la route correspond exactement ("/") ou en prefixe (sous-routes,
  // query string). Sans cela, "/catalogue?..." n'allumait jamais l'onglet.
  const isActiveLink = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

  const openDrawer = () => {
    if (onMenuClick) {
      onMenuClick()
      return
    }
    setDrawerOpen(true)
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#DDEBDD] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 md:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.04)]"
        aria-label="Navigation mobile principale"
      >
        <div className={cn("mx-auto grid max-w-md gap-1", gridCols)}>
          {linkItems.map((item) => {
            const Icon = item.icon
            const isActive = isActiveLink(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-bold transition-colors",
                  isActive ? "bg-[#EAF8EC] text-[#1E8A3C]" : "text-[#607061] hover:bg-[#F7FCF7]"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {isFournisseur && (
            <Link
              href="/supplier"
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-bold transition-colors",
                pathname.startsWith("/supplier") ? "bg-[#FFF0DC] text-[#F07C00]" : "text-[#607061] hover:bg-[#FFF7EE]"
              )}
            >
              <Store className="h-5 w-5" />
              <span>Vendre</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onCartClick ?? (() => {
              if (typeof window !== "undefined") {
                sessionStorage.setItem("souki_open_cart", "true")
              }
              router.push("/catalogue")
            })}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-bold transition-colors",
              pathname === "/checkout" ? "bg-[#FFF7EE] text-[#F07C00]" : "text-[#607061] hover:bg-[#F7FCF7]"
            )}
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Panier</span>
            {cartCount > 0 && (
              <span className="absolute right-4 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F07C00] px-1 text-[10px] font-black text-white">
                {cartCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={openDrawer}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-bold text-[#607061] transition-colors hover:bg-[#F7FCF7]"
          >
            <Menu className="h-5 w-5" />
            <span>Plus</span>
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-[70] bg-[#122018]/45 backdrop-blur-sm md:hidden">
          <div className="absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-white/95 backdrop-blur-md p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-8px_32px_rgba(0,0,0,0.1)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-[#264129]">SOUKI</p>
                <p className="text-xs font-semibold text-[#7B8B7D]">Options secondaires</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#DDEBDD] text-[#607061]"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {secondaryItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#EEF2EE] bg-[#FBFDF9] px-4 text-sm font-bold text-[#264129]"
                  >
                    <Icon className="h-5 w-5 text-[#1E8A3C]" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
