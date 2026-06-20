"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CircleDollarSign,
  Package,
  ShoppingCart,
  Sparkles,
  Store,
} from "lucide-react"

import { SupplierPageHeader } from "@/components/souki/supplier-shell"
import { KPICard } from "@/components/souki/kpi-card"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { useSupplierLiveRefresh } from "@/hooks/useSupplierLiveRefresh"
import { API_BASE_URL } from "@/lib/api"

interface SupplierStats {
  products_count: number
  active_products_count: number
  orders_count: number
  revenue_total: number
}

const shortcuts = [
  {
    href: "/supplier/preparation",
    label: "Ouvrir l’atelier",
    description: "Voir la liste de picking et les commandes du jour.",
    icon: ClipboardList,
    tone: "bg-[#FFF0DC] text-[#D66B00]",
  },
  {
    href: "/supplier/produits",
    label: "Gérer le catalogue",
    description: "Activer, ajouter ou retirer vos produits.",
    icon: Package,
    tone: "bg-[#EAF8EC] text-primary",
  },
  {
    href: "/supplier/commandes",
    label: "Suivre les ventes",
    description: "Consulter les commandes liées à vos produits.",
    icon: ShoppingCart,
    tone: "bg-[#EAF2FF] text-[#1A4F8A]",
  },
  {
    href: "/supplier/profil",
    label: "Mettre à jour la boutique",
    description: "Vérifier vos coordonnées et votre présentation.",
    icon: Store,
    tone: "bg-[#FFF9D9] text-[#8C7000]",
  },
]

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value)} DH`
}

export default function SupplierDashboardPage() {
  const { token } = useAuth()
  const [stats, setStats] = useState<SupplierStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (res.ok) setStats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  useSupplierLiveRefresh(fetchStats, Boolean(token))

  const activationRate =
    stats && stats.products_count > 0
      ? Math.round((stats.active_products_count / stats.products_count) * 100)
      : 0

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
      <SupplierPageHeader
        eyebrow="Vue d’ensemble"
        title="Pilotez votre activité"
        description="Vos indicateurs essentiels et vos actions quotidiennes, réunis dans un espace clair."
      />

      <section className="relative overflow-hidden rounded-3xl bg-[#173F27] p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(76,184,74,0.32),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(245,196,0,0.16),transparent_30%)]" />
        <div className="relative grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">
              <Sparkles className="h-4 w-4 text-[#F5C400]" />
              Espace partenaire Souki
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-4xl [font-family:var(--font-poppins)]">
              Une journée bien préparée commence ici.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
              Vérifiez le picking, gardez votre catalogue disponible et suivez vos commandes sans perdre le fil.
            </p>
          </div>
          <Link
            href="/supplier/preparation"
            className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-accent px-5 text-sm font-black text-accent-foreground shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#D66B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Préparation du jour
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <section aria-label="Indicateurs clés">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KPICard
              title="Produits référencés"
              value={stats?.products_count ?? "—"}
              icon={Package}
              className="border-[#DDEBDD] bg-background dark:border-border dark:bg-card dark:[&_p]:text-foreground"
            />
            <KPICard
              title="Produits actifs"
              value={stats?.active_products_count ?? "—"}
              icon={CheckCircle2}
              variant="success"
              className="border-[#DDEBDD] dark:border-border dark:bg-card dark:[&_p]:text-foreground"
            />
            <KPICard
              title="Commandes du jour"
              value={stats?.orders_count ?? "—"}
              icon={ShoppingCart}
              className="border-[#DDEBDD] bg-background dark:border-border dark:bg-card dark:[&_p]:text-foreground"
            />
            <KPICard
              title="CA du jour"
              value={stats ? formatMoney(stats.revenue_total) : "—"}
              icon={CircleDollarSign}
              variant="warning"
              className="border-[#DDEBDD] dark:border-border dark:bg-card dark:[&_p]:text-foreground"
            />
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Accès rapides</p>
            <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-foreground [font-family:var(--font-poppins)]">
              Gérer mon activité
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon
              return (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  className="group rounded-2xl border border-[#DDEBDD] bg-background p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-border dark:bg-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${shortcut.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <h3 className="mt-5 font-black text-[#264129] dark:text-card-foreground">{shortcut.label}</h3>
                  <p className="mt-2 text-sm leading-5 text-[#6F8070] dark:text-muted-foreground">
                    {shortcut.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">État du catalogue</p>
            <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-foreground [font-family:var(--font-poppins)]">
              Disponibilité actuelle
            </h2>
          </div>
          <Card className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 dark:border-border dark:bg-card">
            <CardContent className="p-5">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-black text-[#264129] dark:text-card-foreground">{activationRate}%</p>
                      <p className="mt-1 text-sm text-muted-foreground">du catalogue est actif</p>
                    </div>
                    <span className="rounded-full bg-[#EAF8EC] px-3 py-1 text-xs font-bold text-primary dark:bg-primary/10">
                      {stats?.active_products_count ?? 0}/{stats?.products_count ?? 0}
                    </span>
                  </div>
                  <Progress value={activationRate} className="mt-5 h-2 bg-[#E7F0E8] dark:bg-muted" />
                  <div className="mt-5 rounded-xl border border-[#DDEBDD] bg-[#F0FAF1] p-4 dark:border-border dark:bg-muted/50">
                    <p className="text-sm font-bold text-[#264129] dark:text-foreground">
                      {activationRate === 100 && (stats?.products_count ?? 0) > 0
                        ? "Tout votre catalogue est visible."
                        : "Vérifiez les produits inactifs avant le prochain cycle."}
                    </p>
                    <Link
                      href="/supplier/produits"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-black text-primary hover:underline"
                    >
                      Voir mes produits <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
