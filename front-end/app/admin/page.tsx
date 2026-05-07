"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bike,
  CheckCircle2,
  CircleDollarSign,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Settings,
  ShoppingBasket,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useAuth } from "@/hooks/useAuth"
import {
  getAdminDashboard,
  type DashboardCurvePointDTO,
  type DashboardDTO,
  type DashboardPaymentDTO,
  type DashboardPeriod,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin", active: true },
  { icon: Package, label: "Commandes du jour", href: "/admin/orders" },
  { icon: Users, label: "Clients", href: "/admin/clients" },
  { icon: AlertTriangle, label: "Blacklisté", href: "/admin/blacklist" },
  { icon: Truck, label: "Logistique & Livreurs", href: "/admin/livreur" },
  { icon: ShoppingBasket, label: "Gestion Produits & Prix", href: "/admin/produits" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Users, label: "Abonnements Parentaux", href: "/admin/subscriptions" },
  { icon: Wallet, label: "Transactions Wallet", href: "/admin/wallet" },
  { icon: Settings, label: "Paramètres Système", href: "/admin/settings" },
]

const adminNavPermissions: Record<string, string> = {
  "/admin": "admin.panel.access",
  "/admin/orders": "orders.read",
  "/admin/clients": "clients.read",
  "/admin/blacklist": "clients.blacklist",
  "/admin/livreur": "admin.panel.access",
  "/admin/produits": "products.manage",
  "/admin/analytics": "stats.read",
  "/admin/subscriptions": "parent.dashboard.access",
  "/admin/wallet": "wallets.read",
  "/admin/settings": "users.manage_roles",
}

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "month", label: "Ce mois" },
]

const statusColors: Record<string, string> = {
  LIVRE: "#1E8A3C",
  EN_ROUTE: "#2563EB",
  ANNULEE: "#DC2626",
  ABSENT: "#F97316",
  INCONNU: "#6B7280",
}

const paymentColors: Record<string, string> = {
  COD: "#F97316",
  WALLET: "#1E8A3C",
  CMI: "#2563EB",
  INCONNU: "#6B7280",
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.00 DH"
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} DH`
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0"
  }
  return value.toLocaleString("fr-FR")
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function currentDateLabel() {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function normalizeLabel(value: string) {
  return value.replace(/_/g, " ")
}

function getStatusColor(status: string) {
  return statusColors[status.toUpperCase()] || "#6B7280"
}

function getPaymentColor(mode: string) {
  return paymentColors[mode.toUpperCase()] || "#6B7280"
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="mt-4 h-8 w-32 rounded bg-gray-200" />
      <div className="mt-4 h-3 w-20 rounded bg-gray-100" />
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  helper,
  highlight = false,
}: {
  label: string
  value: string | number
  icon: typeof Package
  helper: string
  highlight?: boolean
}) {
  return (
    <div className={cn("rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm", highlight && "border-emerald-100 bg-[#F0FDF4]")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 truncate text-3xl font-bold tracking-tight text-gray-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-[#F0FDF4] text-[#1E8A3C]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-xs font-medium text-gray-400">{helper}</p>
    </div>
  )
}

function StatusBadge({ value }: { value: string | null }) {
  const normalized = (value || "INCONNU").toUpperCase()
  const isSuccess = normalized.includes("SUCC") || normalized === "SUCCES"
  const isError = normalized.includes("ERREUR")
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        isSuccess && "border-emerald-200 bg-[#F0FDF4] text-[#1E8A3C]",
        isError && "border-red-200 bg-red-50 text-red-700",
        !isSuccess && !isError && "border-gray-200 bg-gray-50 text-gray-600"
      )}
    >
      {value || "Aucun JIT"}
    </span>
  )
}

function AreaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: DashboardCurvePointDTO }>
  label?: string
}) {
  if (!active || !payload?.length) {
    return null
  }
  const point = payload[0]?.payload
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold text-gray-950">{label}</p>
      <p className="text-[#1E8A3C]">CA: {formatMoney(point?.ca)}</p>
      <p className="text-gray-500">Commandes: {formatNumber(point?.nb_commandes)}</p>
    </div>
  )
}

function PaymentTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: DashboardPaymentDTO }>
}) {
  if (!active || !payload?.length) {
    return null
  }
  const point = payload[0]?.payload
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold text-gray-950">{point?.mode}</p>
      <p className="text-[#1E8A3C]">{formatMoney(point?.montant)}</p>
      <p className="text-gray-500">{formatNumber(point?.count)} commande(s)</p>
    </div>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-gray-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-950">{value}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { token, can } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [periode, setPeriode] = useState<DashboardPeriod>("today")
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  const loadDashboard = useCallback(async (showLoader = true, signal?: AbortSignal) => {
    if (!token) {
      setIsLoading(false)
      return
    }

    if (showLoader) {
      setIsLoading(true)
    }

    try {
      const result = await getAdminDashboard(token, periode, signal)
      setDashboard(result)
      setError("")
      setLastRefresh(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") {
        return
      }
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le dashboard.")
    } finally {
      if (showLoader) {
        setIsLoading(false)
      }
    }
  }, [periode, token])

  useEffect(() => {
    const controller = new AbortController()
    void loadDashboard(true, controller.signal)

    const intervalId = window.setInterval(() => {
      void loadDashboard(false)
    }, 300000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [loadDashboard])

  const visibleAdminNavItems = adminNavItems.filter((item) =>
    can(adminNavPermissions[item.href] || "admin.panel.access")
  )

  const codTotal = (dashboard?.cod_confirmes ?? 0) + (dashboard?.cod_annules ?? 0)
  const codRate = codTotal > 0 ? ((dashboard?.cod_confirmes ?? 0) / codTotal) * 100 : 0
  const mainStatus = dashboard?.repartition_statuts
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .at(0)

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden">
              <Menu className="h-6 w-6" />
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-[#F0FDF4] text-[#1E8A3C]">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold text-[#1E8A3C]">SOUKI</span>
                <span className="ml-1 text-sm text-gray-500">Admin</span>
              </div>
            </Link>
          </div>

          <div className="hidden min-w-0 text-center md:block">
            <p className="truncate text-sm font-semibold capitalize text-gray-700">{currentDateLabel()}</p>
            {lastRefresh ? <p className="text-xs text-gray-400">Dernière MAJ {lastRefresh}</p> : null}
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="relative rounded-xl p-2 text-gray-700 hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E8A3C] font-bold text-white">
              A
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 flex h-screen w-20 flex-col bg-[#1E8A3C] transition-transform lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:translate-x-0",
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
                  item.active ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/20 p-3">
            <button type="button" title="Déconnexion" aria-label="Déconnexion" className="flex h-11 w-11 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </aside>

        {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

        <main className="min-w-0 flex-1">
          <div className="sticky top-16 z-30 border-b border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-950">Dashboard opérationnel</h1>
                <p className="text-sm text-gray-500">Lecture rapide des ventes, commandes et signaux du jour.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriode(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                      periode === option.value
                        ? "border-[#1E8A3C] bg-[#1E8A3C] text-white"
                        : "border-[#E5E7EB] bg-white text-gray-700 hover:bg-[#F0FDF4] hover:text-[#1E8A3C]"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={cn("h-4 w-4 text-[#1E8A3C]", isLoading && "animate-spin")} />
                  Actualiser
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            {isLoading && !dashboard ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="h-96 animate-pulse rounded-xl border border-[#E5E7EB] bg-white lg:col-span-2" />
                  <div className="h-96 animate-pulse rounded-xl border border-[#E5E7EB] bg-white" />
                </div>
              </>
            ) : dashboard ? (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="CA total" value={formatMoney(dashboard.ca_total)} icon={CircleDollarSign} helper="Commandes livrées" highlight />
                  <MetricCard label="Commandes" value={formatNumber(dashboard.total_commandes)} icon={Package} helper={`${dashboard.taux_livraison.toFixed(1)}% livrées`} />
                  <MetricCard label="Clients actifs" value={formatNumber(dashboard.total_clients_actifs)} icon={Users} helper={`${formatNumber(dashboard.nouveaux_clients)} nouveaux`} />
                  <MetricCard label="Livreurs" value={formatNumber(dashboard.livreurs_disponibles)} icon={Bike} helper={`${formatNumber(dashboard.tournees_actives)} tournée(s) active(s)`} />
                </section>

                <section className="grid gap-6 lg:grid-cols-3">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-2">
                    <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-950">CA sur 30 jours</h2>
                        <p className="text-sm text-gray-500">Tendance globale, indépendante du filtre de période.</p>
                      </div>
                      <span className="text-sm font-semibold text-[#1E8A3C]">{formatMoney(dashboard.ca_total)}</span>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboard.courbe_ca} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<AreaTooltip />} />
                          <Area type="monotone" dataKey="ca" stroke="#1E8A3C" strokeWidth={2} fill="#1E8A3C20" name="CA" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-950">Statuts commandes</h2>
                    <p className="text-sm text-gray-500">Répartition de la période.</p>
                    <div className="mt-4 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={dashboard.repartition_statuts} dataKey="count" nameKey="statut" innerRadius={58} outerRadius={84} paddingAngle={3}>
                            {dashboard.repartition_statuts.map((entry) => (
                              <Cell key={entry.statut} fill={getStatusColor(entry.statut)} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {mainStatus ? (
                      <div className="rounded-lg border border-[#E5E7EB] bg-gray-50 px-4 py-3 text-sm">
                        <span className="text-gray-500">Statut dominant</span>
                        <p className="mt-1 font-bold text-gray-950">{normalizeLabel(mainStatus.statut)} · {formatNumber(mainStatus.count)}</p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-3">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-2">
                    <div className="mb-5">
                      <h2 className="text-lg font-bold text-gray-950">Paiements</h2>
                      <p className="text-sm text-gray-500">Montant par mode de paiement.</p>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.repartition_paiements} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="mode" tick={{ fill: "#6B7280", fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<PaymentTooltip />} />
                          <Bar dataKey="montant" radius={[8, 8, 0, 0]}>
                            {dashboard.repartition_paiements.map((entry) => (
                              <Cell key={entry.mode} fill={getPaymentColor(entry.mode)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-950">JIT</h2>
                          <p className="text-sm text-gray-500">{dashboard.dernier_jit_volume.toFixed(2)} kg · {formatDate(dashboard.dernier_jit_date)}</p>
                        </div>
                        <StatusBadge value={dashboard.dernier_jit_statut} />
                      </div>
                      <Link href="/admin/orders#jit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1E8A3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166d30]">
                        Voir JIT
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                      <h2 className="text-lg font-bold text-gray-950">COD</h2>
                      <p className="mt-1 text-sm text-gray-500">{formatNumber(dashboard.cod_confirmes)} confirmés · {formatNumber(dashboard.cod_annules)} annulés</p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-[#1E8A3C]" style={{ width: `${Math.min(100, codRate)}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#1E8A3C]">{codRate.toFixed(1)}% confirmation</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                  <MiniStat label="Wallets" value={formatMoney(dashboard.total_soldes_wallets)} />
                  <MiniStat label="Blacklistés période" value={formatNumber(dashboard.nouveaux_blacklistes)} />
                  <MiniStat label="Blacklist levées" value={formatNumber(dashboard.blacklists_leves)} />
                </section>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
