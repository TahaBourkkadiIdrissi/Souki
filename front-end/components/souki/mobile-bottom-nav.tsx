"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  Leaf,
  Menu,
  PackageCheck,
  Settings,
  ShoppingCart,
  Store,
  User,
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

  const navItems = [
    { label: "Accueil", href: "/", icon: Home },
    { label: "Catalogue", href: "/catalogue", icon: Leaf },
  ]

  const secondaryItems = [
    { label: "Historique", href: "/historique", icon: PackageCheck },
    { label: "Mon profil", href: "/parametres/compte", icon: User },
    { label: "Paramètres", href: "/parametres/notifications", icon: Settings },
  ]

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
        className="fixed inset-x-0 bottom-0 z-30 glass-ios26 border-t border-[#DDEBDD] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 md:hidden"
        aria-label="Navigation mobile principale"
      >
        <div className={cn("mx-auto grid max-w-md gap-0.5", isFournisseur ? "grid-cols-5" : "grid-cols-4")}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 text-[10px] font-bold transition-colors",
                  isActive ? "bg-[#EAF8EC] text-[#1E8A3C]" : "text-[#607061] hover:bg-[#F7FCF7]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate w-full text-center">{item.label}</span>
              </Link>
            )
          })}

          {isFournisseur && (
            <Link
              href="/supplier"
              className={cn(
                "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 text-[10px] font-bold transition-colors",
                pathname.startsWith("/supplier") ? "bg-[#FFF0DC] text-[#F07C00]" : "text-[#607061] hover:bg-[#FFF7EE]"
              )}
            >
              <Store className="h-4 w-4" />
              <span className="truncate w-full text-center">Vendre</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onCartClick ?? (() => router.push("/catalogue"))}
            className={cn(
              "relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 text-[10px] font-bold transition-colors",
              pathname === "/checkout" ? "bg-[#FFF7EE] text-[#F07C00]" : "text-[#607061] hover:bg-[#F7FCF7]"
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="truncate w-full text-center">Panier</span>
            {cartCount > 0 && (
              <span className="absolute right-2 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F07C00] px-1 text-[9px] font-black text-white">
                {cartCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={openDrawer}
            className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 text-[10px] font-bold text-[#607061] transition-colors hover:bg-[#F7FCF7]"
          >
            <Menu className="h-4 w-4" />
            <span className="truncate w-full text-center">Plus</span>
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-[70] bg-[#122018]/45 backdrop-blur-sm md:hidden">
          <div className="absolute bottom-0 left-0 right-0 rounded-t-[28px] glass-ios26 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
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
