"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ClipboardList, Home, LayoutDashboard, Leaf, LogOut, Package, ShoppingBasket, ShoppingCart, Store } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { useSupplierLiveRefresh } from "@/hooks/useSupplierLiveRefresh"
import { API_BASE_URL } from "@/lib/api"
import { isPwaStandalone } from "@/lib/pwa"
import { cn } from "@/lib/utils"

type SupplierIdentity = {
  shop_name: string
  statut: string
  logo_url: string | null
  ville: string | null
}

const supplierNav = [
  { href: "/supplier", label: "Vue d’ensemble", shortLabel: "Accueil", icon: LayoutDashboard },
  { href: "/supplier/preparation", label: "Préparation", shortLabel: "Atelier", icon: ClipboardList },
  { href: "/supplier/produits", label: "Mes produits", shortLabel: "Produits", icon: Package },
  { href: "/supplier/commandes", label: "Commandes", shortLabel: "Commandes", icon: ShoppingCart },
  { href: "/supplier/profil", label: "Ma boutique", shortLabel: "Boutique", icon: Store },
]

// Liens vers l'espace client : le fournisseur peut revenir a l'accueil / au
// catalogue depuis son portail (web comme PWA standalone). Le href "/" est
// resolu au rendu : en standalone il pointe directement sur /pwa-welcome
// (une navigation client vers "/" afficherait l'accueil web un instant avant
// la redirection React).
const customerNav = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/catalogue", label: "Catalogue", icon: Leaf },
]

const statusLabels: Record<string, string> = {
  APPROVED: "Boutique active",
  PENDING: "Validation en cours",
  REJECTED: "Demande refusée",
  SUSPENDED: "Boutique suspendue",
}

function SupplierIdentityBadge({ status }: { status?: string | null }) {
  const normalized = status?.toUpperCase() || "PENDING"
  const className =
    normalized === "APPROVED"
      ? "border-[#BFE2C4] bg-[#EAF8EC] text-[#176B2E] dark:border-[#4CB84A]/30 dark:bg-[#4CB84A]/10 dark:text-[#8EDD8B]"
      : normalized === "SUSPENDED" || normalized === "REJECTED"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"

  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          normalized === "APPROVED"
            ? "bg-[#4CB84A]"
            : normalized === "SUSPENDED" || normalized === "REJECTED"
              ? "bg-red-500"
              : "bg-amber-500",
        )}
      />
      {statusLabels[normalized] ?? normalized}
    </Badge>
  )
}

function isActiveRoute(pathname: string, href: string) {
  const normPath = pathname.replace("/fournisseur", "/supplier")
  return href === "/supplier" ? normPath === href : normPath.startsWith(href)
}

export function SupplierShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { token, logout } = useAuth()
  const [identity, setIdentity] = useState<SupplierIdentity | null>(null)
  const [identityLoading, setIdentityLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  // Commandes du jour, affichees en pastille sur l'onglet Commandes : le
  // fournisseur voit qu'il a du travail sans ouvrir l'ecran.
  const [ordersCount, setOrdersCount] = useState(0)
  // Accueil client : /pwa-welcome en standalone, / sur le web. Resolu apres
  // montage (SSR rend "/") — le display-mode ne change pas en cours de session.
  const [homeHref, setHomeHref] = useState("/")

  useEffect(() => {
    if (isPwaStandalone()) setHomeHref("/pwa-welcome")
  }, [])

  const resolveHref = (href: string) => {
    const base = pathname.startsWith("/fournisseur") ? "/fournisseur" : "/supplier"
    return href.replace("/supplier", base)
  }

  const activeItem = supplierNav.find((item) => isActiveRoute(pathname, item.href)) || supplierNav[0]

  useEffect(() => {
    if (!token) return

    const loadIdentity = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/supplier/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) setIdentity(await response.json())
      } finally {
        setIdentityLoading(false)
      }
    }

    void loadIdentity()
  }, [token, pathname])

  const loadOrdersCount = useCallback(async () => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/supplier/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (response.ok) {
        const stats = await response.json()
        setOrdersCount(Number(stats?.orders_count) || 0)
      }
    } catch {
      // Pastille purement indicative : un echec ne doit rien casser.
    }
  }, [token])

  useEffect(() => {
    void loadOrdersCount()
  }, [loadOrdersCount, pathname])

  useSupplierLiveRefresh(loadOrdersCount, Boolean(token))

  const shopInitial = identity?.shop_name?.trim().charAt(0).toUpperCase() || "S"
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      router.replace("/login?logged_out=1")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/55 text-foreground dark:bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-[#DDEBDD] bg-background lg:flex dark:border-border">
        <div className="flex h-24 items-center gap-3 border-b border-[#DDEBDD] px-6 dark:border-border">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[#DDEBDD] bg-white p-0.5 shadow-sm dark:border-border">
            <img
              src="/logo3.png"
              alt="SOUKI"
              className="h-full w-[175%] max-w-none object-cover"
              style={{ objectPosition: "left center" }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black leading-none text-primary [font-family:var(--font-poppins)]">SOUKI</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Portail fournisseur
            </p>
          </div>
        </div>

        <div className="px-4 py-5">
          <div className="rounded-2xl border border-[#DDEBDD] bg-[#F0FAF1] p-4 dark:border-border dark:bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-sm font-black text-primary-foreground">
                {identity?.logo_url ? (
                  <img src={identity.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  shopInitial
                )}
              </div>
              <div className="min-w-0 flex-1">
                {identityLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ) : (
                  <>
                    <p className="truncate text-sm font-black text-[#264129] dark:text-card-foreground">
                      {identity?.shop_name || "Ma boutique"}
                    </p>
                    <p className="truncate text-xs text-[#6F8070] dark:text-muted-foreground">
                      {identity?.ville || "Partenaire Souki"}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3">
              {identityLoading ? (
                <Skeleton className="h-6 w-28 rounded-full" />
              ) : (
                <SupplierIdentityBadge status={identity?.statut} />
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4" aria-label="Navigation fournisseur">
          {supplierNav.map((item) => {
            const Icon = item.icon
            const active = isActiveRoute(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={resolveHref(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active
                    ? "bg-gradient-to-r from-primary to-[#25994A] text-primary-foreground shadow-md shadow-primary/25"
                    : "text-[#607061] hover:translate-x-0.5 hover:bg-[#EAF8EC] hover:text-primary dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                    active ? "bg-white/15" : "bg-[#F0FAF1] text-primary group-hover:bg-white dark:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            )
          })}

          <div className="my-3 border-t border-[#EAF8EC] dark:border-border" />
          <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Espace client
          </p>
          {customerNav.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href === "/" ? homeHref : item.href}
                className="group flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-sm font-bold text-[#607061] transition-all hover:bg-[#EAF8EC] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F0FAF1] text-primary transition-colors group-hover:bg-white dark:bg-muted">
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="m-4 space-y-3">
          <div className="rounded-2xl bg-[#173F27] p-4 text-white">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8EDD8B]">Souki partenaire</p>
            <p className="mt-2 text-xs leading-5 text-white/70">
              Produits, préparation et commandes réunis dans votre espace métier.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 text-sm font-black text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        {/*
          En-tete mobile : identite de la boutique uniquement. La navigation
          vivait dans un menu deroulant — un tap pour ouvrir, un tap pour choisir,
          et aucune vue d'ensemble ; elle est passee en barre d'onglets basse,
          atteignable au pouce. La deconnexion, elle, vit sur l'ecran Boutique.
        */}
        <header className="sticky top-0 z-30 border-b border-[#DDEBDD] bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden dark:border-border">
          <div className="flex h-16 items-center gap-3 px-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-sm font-black text-primary-foreground">
              {identity?.logo_url ? (
                <img src={identity.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                shopInitial
              )}
            </div>
            <div className="min-w-0 flex-1">
              {identityLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <>
                  <p className="truncate text-sm font-black text-[#264129] dark:text-foreground">
                    {identity?.shop_name || "Ma boutique"}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-muted-foreground">
                    {activeItem.label}
                  </p>
                </>
              )}
            </div>
            {!identityLoading && <SupplierIdentityBadge status={identity?.statut} />}
            {/* Retour a l'espace client pour faire ses achats : la barre basse
                est reservee au metier (5 onglets), l'entree achat vit ici. */}
            <Link
              href={homeHref}
              aria-label="Faire mes achats sur SOUKI"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EC] text-primary transition-transform active:scale-90 dark:bg-primary/10"
            >
              <ShoppingBasket className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <div className="mobile-native-surface min-h-screen pb-20 lg:pb-8">{children}</div>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DDEBDD] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md lg:hidden dark:border-border dark:bg-card/95"
          aria-label="Navigation fournisseur"
        >
          <div className="mx-auto grid max-w-md grid-cols-5 gap-0.5">
            {supplierNav.map((item) => {
              const Icon = item.icon
              const active = isActiveRoute(pathname, item.href)
              const badge = item.href === "/supplier/commandes" ? ordersCount : 0
              return (
                <Link
                  key={item.href}
                  href={resolveHref(item.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // min-h-14 : cible tactile confortable, bien au-dessus des 44 px.
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold transition-colors active:scale-95",
                    active
                      ? "bg-[#EAF8EC] text-primary dark:bg-primary/10"
                      : "text-[#607061] dark:text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="w-full truncate text-center">{item.shortLabel}</span>
                  {badge > 0 && (
                    <span
                      key={badge}
                      className="animate-badge-pop absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-accent-foreground"
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}

export function SupplierPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-stretch gap-4">
        <span
          aria-hidden="true"
          className="mt-0.5 hidden w-1.5 shrink-0 rounded-full bg-gradient-to-b from-[#5BD174] via-primary to-[#173F27] sm:block"
        />
        <div className="max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent sm:text-xs">{eyebrow}</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-[#264129] sm:text-3xl dark:text-foreground [font-family:var(--font-poppins)]">
            {title}
          </h1>
          {/* La description mange un tiers de l'ecran sur mobile pour une
              information de confort : reservee aux grands ecrans. */}
          <p className="mt-2 hidden text-sm leading-6 text-[#6F8070] sm:block dark:text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {action}
    </header>
  )
}

export function SupplierStatusBadge({ status }: { status: string }) {
  return <SupplierIdentityBadge status={status} />
}
