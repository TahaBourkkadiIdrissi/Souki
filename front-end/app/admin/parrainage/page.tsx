"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Gift,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPinned,
  Menu,
  Package,
  RefreshCw,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { getAdminParrainages, type ParrainageAdminOverviewDTO } from "@/lib/api"
import { cn } from "@/lib/utils"

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Package, label: "Commandes du jour", href: "/admin/orders" },
  { icon: Users, label: "Clients", href: "/admin/clients" },
  { icon: AlertTriangle, label: "Blackliste", href: "/admin/blacklist" },
  { icon: Truck, label: "Logistique & Livreurs", href: "/admin/livreur" },
  { icon: ShoppingBasket, label: "Gestion Produits & Prix", href: "/admin/produits" },
  { icon: CircleDollarSign, label: "Pricing", href: "/admin/pricing" },
  { icon: ShoppingCart, label: "Fournisseurs", href: "/admin/fournisseurs" },
  { icon: MapPinned, label: "Zones fournisseurs", href: "/admin/zones" },
  { icon: AlertTriangle, label: "Exceptions / Backlog", href: "/admin/commandes/exceptions" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Users, label: "Abonnements Parentaux", href: "/admin/subscriptions" },
  { icon: Wallet, label: "Transactions Wallet", href: "/admin/wallet" },
  { icon: Gift, label: "Parrainage", href: "/admin/parrainage" },
  { icon: Settings, label: "Paramètres système", href: "/admin/settings" },
]

const adminNavPermissions: Record<string, string> = {
  "/admin": "admin.panel.access",
  "/admin/orders": "orders.read",
  "/admin/clients": "clients.read",
  "/admin/blacklist": "clients.blacklist",
  "/admin/livreur": "admin.panel.access",
  "/admin/produits": "products.manage",
  "/admin/pricing": "admin.panel.access",
  "/admin/fournisseurs": "admin.panel.access",
  "/admin/zones": "admin.panel.access",
  "/admin/commandes/exceptions": "admin.panel.access",
  "/admin/analytics": "stats.read",
  "/admin/subscriptions": "parent.dashboard.access",
  "/admin/wallet": "wallets.read",
  "/admin/parrainage": "admin.panel.access",
  "/admin/settings": "users.manage_roles",
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0 DH"
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DH`
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0"
  return value.toLocaleString("fr-FR")
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function StatutBadge({ statut }: { statut: string }) {
  const value = (statut || "").toUpperCase()
  const map: Record<string, { label: string; className: string }> = {
    EN_ATTENTE: { label: "En attente", className: "border-amber-200 bg-amber-50 text-amber-700" },
    CONVERTI: { label: "Converti", className: "border-emerald-200 bg-[#F0FDF4] text-[#1E8A3C]" },
    REJETE: { label: "Rejeté", className: "border-red-200 bg-red-50 text-red-700" },
  }
  const cfg = map[value] || { label: statut, className: "border-gray-200 bg-gray-50 text-[#6B7280]" }
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", cfg.className)}>{cfg.label}</span>
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-white px-4 py-3 shadow-sm", accent ? "border-emerald-200 bg-[#F0FDF4]" : "border-[#E5E7EB]")}>
      <p className="text-xs font-semibold uppercase text-[#6B7280]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1F2937]">{value}</p>
    </div>
  )
}

export default function AdminParrainagePage() {
  const { token, can, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data, setData] = useState<ParrainageAdminOverviewDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const result = await getAdminParrainages(token, signal)
      setData(result)
      setError("")
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les parrainages.")
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const visibleAdminNavItems = useMemo(
    () => adminNavItems.filter((item) => can(adminNavPermissions[item.href] || "admin.panel.access")),
    [can]
  )

  const handleAdminLogout = async () => {
    await logout()
    window.location.assign("/login?logged_out=1")
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="sticky top-0 z-50 glass-ios26 border-b border-[#E5E7EB]">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-[#1F2937] hover:bg-gray-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-[#F0FDF4] text-[#1E8A3C]">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-[#1E8A3C]">SOUKI</span>
                <span className="ml-1 text-sm text-[#6B7280]">Admin</span>
              </div>
            </Link>
          </div>
          <div className="hidden text-center md:block">
            <p className="text-sm font-bold text-[#1F2937]">Parrainage viral</p>
            <p className="text-xs text-[#6B7280]">Acquisition à coût zéro</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E8A3C] font-bold text-white">A</div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 flex h-screen w-20 flex-col bg-[#1E8A3C] transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button type="button" onClick={() => setSidebarOpen(false)} className="absolute right-4 top-4 rounded-lg p-2 text-white hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
          <nav className="mt-12 flex-1 space-y-2 overflow-y-auto p-3 lg:mt-0">
            {visibleAdminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl font-medium transition-colors",
                  item.href === "/admin/parrainage" ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/20 p-3">
            <button type="button" title="Deconnexion" aria-label="Deconnexion" onClick={handleAdminLogout} className="flex h-11 w-11 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </aside>

        {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

        <main className="min-w-0 flex-1">
          <div className="sticky top-14 z-30 glass-ios26 border-b border-[#E5E7EB] px-4 py-3 lg:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Parrainage</h1>
                <p className="text-sm text-[#6B7280]">Suivi des parrainages et filleuls convertis</p>
              </div>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4 text-[#1E8A3C]", isLoading && "animate-spin")} />
                Actualiser
              </button>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4 lg:px-6">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
            ) : null}

            {isLoading && !data ? (
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                <RefreshCw className="h-4 w-4 animate-spin text-[#1E8A3C]" /> Chargement...
              </div>
            ) : data ? (
              <>
                <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                  <StatCard label="Filleuls convertis" value={formatNumber(data.convertis)} accent />
                  <StatCard label="En attente" value={formatNumber(data.en_attente)} />
                  <StatCard label="Taux de conversion" value={`${data.taux_conversion.toFixed(1)}%`} />
                  <StatCard label="Crédit distribué" value={formatMoney(data.credit_distribue)} />
                  <StatCard label="Total parrainages" value={formatNumber(data.total)} />
                </section>

                <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">Top parrains</h2>
                    <p className="text-xs text-[#6B7280]">Les meilleurs ambassadeurs</p>
                    <div className="mt-3 space-y-2">
                      {data.top_parrains.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-[#6B7280]">Aucun parrain converti pour le moment.</p>
                      ) : (
                        data.top_parrains.map((parrain, index) => (
                          <div key={parrain.parrain_id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E8A3C] text-xs font-bold text-white">{index + 1}</span>
                              <span className="font-mono text-sm text-[#1F2937]">{parrain.parrain_contact || `#${parrain.parrain_id}`}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#1E8A3C]">{formatNumber(parrain.filleuls_convertis)} filleuls</p>
                              <p className="text-xs text-[#6B7280]">{formatMoney(parrain.credit_genere)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">Parrainages récents</h2>
                    <p className="text-xs text-[#6B7280]">100 derniers</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-left text-xs uppercase text-[#6B7280]">
                            <th className="px-2 py-2 font-semibold">Code</th>
                            <th className="px-2 py-2 font-semibold">Parrain</th>
                            <th className="px-2 py-2 font-semibold">Filleul</th>
                            <th className="px-2 py-2 font-semibold">Statut</th>
                            <th className="px-2 py-2 text-right font-semibold">Crédit</th>
                            <th className="px-2 py-2 font-semibold">Inscrit</th>
                            <th className="px-2 py-2 font-semibold">Converti</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {data.recent.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-2 py-6 text-center text-[#6B7280]">Aucun parrainage pour le moment.</td>
                            </tr>
                          ) : (
                            data.recent.map((item) => (
                              <tr key={item.id}>
                                <td className="px-2 py-2 font-mono font-semibold text-[#1F2937]">{item.code_utilise}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{item.parrain_contact || `#${item.parrain_id}`}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{item.filleul_contact || `#${item.filleul_id}`}</td>
                                <td className="px-2 py-2"><StatutBadge statut={item.statut} /></td>
                                <td className="px-2 py-2 text-right font-bold text-[#1E8A3C]">{item.credit_total > 0 ? formatMoney(item.credit_total) : "-"}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{formatDate(item.created_at)}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{formatDate(item.converted_at)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[#1E8A3C] hover:text-[#166d30]">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Retour au dashboard
                </Link>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
