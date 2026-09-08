"use client"

import { useEffect, useState } from "react"
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
  User,
  Wallet,
  X,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { isPwaStandalone } from "@/lib/pwa"
import { cn } from "@/lib/utils"

interface MobileBottomNavProps {
  cartCount?: number
  onCartClick?: () => void
  onMenuClick?: () => void
}

/**
 * Navigation mobile :
 * - PWA installee (standalone) : barre d'onglets en bas d'ecran (look natif).
 * - Version web : navbar haute fixe (logo SOUKI a gauche, profil + burger a
 *   droite) ; le burger regroupe tous les liens de l'ancienne barre basse.
 *   Aucune barre en bas de page sur le web.
 */
export function MobileBottomNav({ cartCount = 0, onCartClick, onMenuClick }: MobileBottomNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()


  // Accueil : /pwa-welcome en standalone (navigation directe, sans passer par
  // la redirection React de "/" qui fait flasher l'accueil web), "/" sur le web.
  // Resolu apres montage : le SSR rend "/" et le display-mode ne change pas
  // en cours de session.
  const [homeHref, setHomeHref] = useState("/")
  // null tant que le display-mode n'est pas resolu cote client : on ne rend
  // rien pour eviter le flash barre basse <-> navbar haute.
  const [isStandalone, setIsStandalone] = useState<boolean | null>(null)

  useEffect(() => {
    const standalone = isPwaStandalone()
    setIsStandalone(standalone)
    if (standalone) setHomeHref("/pwa-welcome")
  }, [])

  // Version web : pousse le contenu sous la navbar haute fixe et decale les
  // en-tetes sticky des pages (regles dans globals.css).
  useEffect(() => {
    if (isStandalone !== false) return
    document.body.classList.add("souki-web-topnav")
    return () => document.body.classList.remove("souki-web-topnav")
  }, [isStandalone])

  const linkItems = [
    { label: "Accueil", href: homeHref, icon: Home },
    { label: "Produits", href: "/catalogue", icon: Leaf },
  ]

  const secondaryItems = [
    { label: "Historique", href: "/historique", icon: PackageCheck },
    { label: "Abonnements", href: "/abonnements", icon: Crown },
    { label: "Mon Wallet", href: "/wallet", icon: Wallet },
    { label: "Mon profil", href: "/parametres/compte", icon: User },
    { label: "Paramètres", href: "/parametres/notifications", icon: Settings },
  ]

  const gridCols = "grid-cols-4"

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

  const handleCartClick = onCartClick ?? (() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("souki_open_cart", "true")
    }
    router.push("/catalogue")
  })

  if (isStandalone === null) return null

  if (!isStandalone) {
    return (
      <>
        <nav
          className="fixed inset-x-0 top-0 z-40 border-b border-[#DDEBDD] bg-white/95 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:hidden"
          aria-label="Navigation principale"
        >
          <div className="flex h-14 items-center justify-between px-4">
            <Link href={homeHref} className="flex items-center gap-2.5">
              <span className="pointer-events-none flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
                <img
                  src="/logo3.png"
                  alt="SOUKI"
                  className="h-full w-[175%] max-w-none object-cover"
                  style={{ objectPosition: "left center" }}
                />
              </span>
              <span className="flex flex-col justify-center">
                <span className="text-lg font-bold leading-none tracking-tight text-[#1E8A3C]">SOUKI</span>
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-[#8A8A8A]">
                  Fresh Market
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href={user ? "/parametres/compte" : "/login"}
                aria-label={user ? "Mon profil" : "Se connecter"}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] text-white shadow-sm ring-2 ring-white transition-transform active:scale-90"
              >
                <User className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={openDrawer}
                aria-label="Ouvrir le menu"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDEBDD] bg-white text-[#264129] transition-transform active:scale-90"
              >
                <Menu className="h-5 w-5" />
                {cartCount > 0 && (
                  <span
                    key={cartCount}
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F07C00] px-1 text-[10px] font-black text-white animate-badge-pop"
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </nav>

        {drawerOpen && (
          <div className="fixed inset-0 z-[70] bg-[#122018]/45 backdrop-blur-sm md:hidden" onClick={() => setDrawerOpen(false)}>
            <div
              className="absolute inset-x-0 top-0 max-h-[85dvh] overflow-y-auto rounded-b-[28px] bg-white/95 p-4 pt-[max(env(safe-area-inset-top),1rem)] shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-md"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-[#264129]">SOUKI</p>
                  <p className="text-xs font-semibold text-[#7B8B7D]">Menu de navigation</p>
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
                {linkItems.map((item) => {
                  const Icon = item.icon
                  const isActive = isActiveLink(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-sm font-bold",
                        isActive
                          ? "border-[#CDE8D0] bg-[#EAF8EC] text-[#1E8A3C]"
                          : "border-[#EEF2EE] bg-[#FBFDF9] text-[#264129]",
                      )}
                    >
                      <Icon className="h-5 w-5 text-[#1E8A3C]" />
                      {item.label}
                    </Link>
                  )
                })}

                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false)
                    handleCartClick()
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#EEF2EE] bg-[#FBFDF9] px-4 text-sm font-bold text-[#264129]"
                >
                  <ShoppingCart className="h-5 w-5 text-[#1E8A3C]" />
                  Panier
                  {cartCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F07C00] px-1.5 text-[10px] font-black text-white">
                      {cartCount}
                    </span>
                  )}
                </button>

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

          <button
            type="button"
            onClick={handleCartClick}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-bold transition-colors",
              pathname === "/checkout" ? "bg-[#FFF7EE] text-[#F07C00]" : "text-[#607061] hover:bg-[#F7FCF7]"
            )}
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Panier</span>
            {cartCount > 0 && (
              // key={cartCount} : rejoue le pop a chaque changement de quantite
              <span
                key={cartCount}
                className="absolute right-4 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F07C00] px-1 text-[10px] font-black text-white animate-badge-pop"
              >
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
