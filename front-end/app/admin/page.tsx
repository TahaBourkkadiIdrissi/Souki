"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
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
  Gift,
  Percent,
  X,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Jour precis" },
]

const statusColors: Record<string, string> = {
  LIVRE: "#1E8A3C",
  EN_ROUTE: "#3B82F6",
  ANNULEE: "#EF4444",
  ABSENT: "#F97316",
  CONFIRMEE: "#10B981",
  INCONNU: "#9CA3AF",
}

const paymentColors: Record<string, string> = {
  COD: "#F59E0B",
  WALLET: "#8B5CF6",
  CMI: "#3B82F6",
  CASH: "#10B981",
  INCONNU: "#9CA3AF",
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0 DH"
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} DH`
}

function formatPreciseMoney(value: number | null | undefined) {
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

function formatDateTime(value: string | null | undefined) {
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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatKg(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.00 kg"
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} kg`
}

function normalizeLabel(value: string) {
  return value.replace(/_/g, " ")
}

function getStatusColor(status: string) {
  return statusColors[status.toUpperCase()] || "#9CA3AF"
}

function getPaymentColor(mode: string) {
  return paymentColors[mode.toUpperCase()] || "#9CA3AF"
}

function variation(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return null
  }
  return ((current - previous) / previous) * 100
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("souki-skeleton rounded-xl border border-[#E5E7EB] shadow-sm", className)} />
}

function graphTitle(periode: DashboardPeriod, customDate: string) {
  if (periode === "today") {
    return "Activite du jour - heure par heure"
  }
  if (periode === "7d") {
    return "CA 7 derniers jours (DH)"
  }
  if (periode === "30d") {
    return "CA 30 derniers jours (DH)"
  }
  if (periode === "month") {
    return "CA ce mois (DH)"
  }
  return `CA — 30 jours autour du ${customDate} (DH)`
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    return null
  }
  return new Date(year, month - 1, day)
}

function formatGraphDate(value: Date) {
  return value.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function graphSubtitle(periode: DashboardPeriod, customDate: string) {
  if (periode !== "custom") {
    return null
  }

  const endDate = parseInputDate(customDate)
  if (!endDate) {
    return null
  }

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 29)
  return `Fenêtre : ${formatGraphDate(startDate)} → ${formatGraphDate(endDate)}`
}

function JitExecutionBadge({ executed }: { executed: boolean }) {
  return (
    <div
      className={cn(
        "mt-2 border-t border-[#E5E7EB] pt-2 text-xs font-bold",
        executed ? "text-[#1E8A3C]" : "text-amber-700"
      )}
    >
      {executed ? "● JIT execute" : "⏳ JIT en attente"}
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  colorClass,
  variationValue,
  footer,
  highlight = false,
}: {
  label: string
  value: string
  helper: string
  icon: LucideIcon
  colorClass: string
  variationValue?: number | null
  footer?: React.ReactNode
  highlight?: boolean
}) {
  const positive = typeof variationValue === "number" && variationValue > 0
  const negative = typeof variationValue === "number" && variationValue < 0
  const neutral = variationValue === null || variationValue === 0

  return (
    <div className={cn("min-h-[116px] rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 shadow-sm", highlight && "border-emerald-200 bg-[#F0FDF4]")}>
      <div className="flex items-start gap-2.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase text-[#6B7280]">{label}</p>
          <p className="mt-1 break-words text-[1.28rem] font-bold leading-tight text-[#1F2937] 2xl:text-[1.38rem]">{value}</p>
        </div>
      </div>
      <div className="mt-2 flex min-h-5 items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-[#6B7280]">{helper}</span>
        {variationValue !== undefined ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-bold",
              positive && "bg-[#F0FDF4] text-[#1E8A3C]",
              negative && "bg-red-50 text-red-600",
              neutral && "bg-gray-100 text-[#6B7280]"
            )}
          >
            {positive ? `▲ +${variationValue.toFixed(1)}%` : null}
            {negative ? `▼ ${variationValue.toFixed(1)}%` : null}
            {neutral ? (variationValue === 0 ? "— 0%" : "—") : null}
          </span>
        ) : null}
      </div>
      {footer}
    </div>
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
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-bold text-[#1F2937]">{label}</p>
      <p className="text-[#1E8A3C]">CA: {formatPreciseMoney(point?.ca)}</p>
      <p className="text-[#6B7280]">Commandes: {formatNumber(point?.nb_commandes)}</p>
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
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-bold text-[#1F2937]">{point?.mode}</p>
      <p className="text-[#1E8A3C]">{formatPreciseMoney(point?.montant)}</p>
      <p className="text-[#6B7280]">{formatNumber(point?.count)} commande(s)</p>
    </div>
  )
}

function StatusBadge({ value }: { value: string | null }) {
  const normalized = (value || "INCONNU").toUpperCase()
  const success = normalized.includes("SUCC")
  const error = normalized.includes("ERREUR")
  const empty = normalized.includes("AUCUNE")

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
        success && "border-emerald-200 bg-[#F0FDF4] text-[#1E8A3C]",
        error && "border-red-200 bg-red-50 text-red-700",
        empty && "border-amber-200 bg-amber-50 text-amber-700",
        !success && !error && !empty && "border-gray-200 bg-gray-50 text-[#6B7280]"
      )}
    >
      {value || "Aucun JIT"}
    </span>
  )
}

export default function AdminDashboard() {
  const { token, can, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [periode, setPeriode] = useState<DashboardPeriod>("today")
  const [customDate, setCustomDate] = useState(todayInputValue())
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadDashboard = useCallback(async (showLoader = true, signal?: AbortSignal) => {
    if (!token) {
      setIsLoading(false)
      return
    }

    if (showLoader) {
      setIsLoading(true)
    }

    try {
      const result = await getAdminDashboard(token, periode, periode === "custom" ? customDate : undefined, signal)
      setDashboard(result)
      setError("")
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
  }, [customDate, periode, token])

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

  const visibleAdminNavItems = useMemo(
    () => adminNavItems.filter((item) => can(adminNavPermissions[item.href] || "admin.panel.access")),
    [can]
  )

  const handleAdminLogout = async () => {
    await logout()
    window.location.assign("/login?logged_out=1")
  }

  const metrics = dashboard
    ? [
        {
          label: "CA Total",
          value: formatMoney(dashboard.ca_total),
          helper: "Livrées uniquement",
          icon: CircleDollarSign,
          colorClass: "bg-[#F0FDF4] text-[#1E8A3C]",
          variationValue: variation(dashboard.ca_total, dashboard.ca_total_precedent),
          highlight: true,
        },
        {
          label: "Marge brute",
          value: formatMoney(dashboard.marge_brute),
          helper: `${dashboard.taux_marge.toFixed(1)}% de marge`,
          icon: Percent,
          colorClass: "bg-emerald-50 text-emerald-700",
          variationValue: variation(dashboard.marge_brute, dashboard.marge_brute_precedent),
        },
        {
          label: "Commandes",
          value: formatNumber(dashboard.total_commandes),
          helper: `${formatNumber(dashboard.commandes_en_route)} en route`,
          icon: Package,
          colorClass: "bg-blue-50 text-blue-600",
          variationValue: variation(dashboard.total_commandes, dashboard.total_commandes_precedent),
          footer: periode === "today" ? <JitExecutionBadge executed={dashboard.jit_execute_aujourdhui} /> : undefined,
        },
        {
          label: "Livrées",
          value: `${formatNumber(dashboard.commandes_livrees)} (${dashboard.taux_livraison.toFixed(1)}%)`,
          helper: `${formatNumber(dashboard.commandes_absentes)} absentes`,
          icon: CheckCircle2,
          colorClass: "bg-[#F0FDF4] text-[#1E8A3C]",
          variationValue: variation(dashboard.commandes_livrees, dashboard.commandes_livrees_precedent),
        },
        {
          label: "Panier moyen",
          value: formatMoney(dashboard.panier_moyen),
          helper: "Par commande livrée",
          icon: ShoppingCart,
          colorClass: "bg-teal-50 text-teal-600",
          variationValue: variation(dashboard.panier_moyen, dashboard.panier_moyen_precedent),
        },
        {
          label: "Nouveaux clients",
          value: formatNumber(dashboard.nouveaux_clients),
          helper: "Période sélectionnée",
          icon: Users,
          colorClass: "bg-[#F0FDF4] text-[#1E8A3C]",
          variationValue: variation(dashboard.nouveaux_clients, dashboard.nouveaux_clients_precedent),
        },
      ]
    : []

  const netBlacklist = (dashboard?.nouveaux_blacklistes ?? 0) - (dashboard?.blacklists_leves ?? 0)
  const panierPhysique = dashboard && dashboard.dernier_jit_nb_commandes > 0
    ? dashboard.dernier_jit_volume / dashboard.dernier_jit_nb_commandes
    : 0
  const courbeCaSubtitle = graphSubtitle(periode, customDate)

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-[#1F2937] hover:bg-gray-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded-xl bg-white p-1">
                <img src="/logo3.png" alt="SOUKI" className="h-8 w-auto object-contain" />
              </div>
              <div className="hidden sm:block">
                <span className="ml-1 text-sm font-bold text-[#6B7280]">Admin</span>
              </div>
            </Link>
          </div>

          <div className="hidden text-center md:block">
            <p className="text-sm font-bold text-[#1F2937]">SOUKI Dashboard</p>
            <p className="text-xs text-[#6B7280]">Suivi global des performances</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E8A3C] font-bold text-white">
              A
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-[#1E8A3C] transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] lg:translate-x-0",
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
                  "flex h-11 w-full items-center gap-3 rounded-xl px-3 font-medium transition-colors",
                  item.active ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/20 p-3">
            <button type="button" title="Deconnexion" aria-label="Deconnexion" onClick={handleAdminLogout} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Déconnexion</span>
            </button>
          </div>
        </aside>

        {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

        <main className="min-w-0 flex-1">
          <div className="sticky top-14 z-30 bg-white border-b border-[#E5E7EB] px-4 py-3 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">SOUKI Dashboard</h1>
                  <span className="text-xs font-semibold text-[#6B7280]">
                    Dernière maj : {formatDateTime(dashboard?.derniere_maj)}
                  </span>
                </div>
                <p className="text-sm text-[#6B7280]">Suivi global des performances</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriode(option.value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors",
                      periode === option.value
                        ? "border-[#1E8A3C] bg-[#1E8A3C] text-white"
                        : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F0FDF4] hover:text-[#1E8A3C]"
                    )}
                  >
                    {option.value === "custom" ? <CalendarDays className="h-4 w-4" /> : null}
                    {option.label}
                  </button>
                ))}
                {periode === "custom" ? (
                  <input
                    type="date"
                    value={customDate}
                    max={todayInputValue()}
                    onChange={(event) => setCustomDate(event.target.value)}
                    className="rounded-lg border border-[#1E8A3C] bg-white px-3 py-2 text-sm font-bold text-[#1F2937] outline-none focus:ring-2 focus:ring-[#1E8A3C]/20"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={cn("h-4 w-4 text-[#1E8A3C]", isLoading && "animate-spin")} />
                  Actualiser
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4 lg:px-6">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : null}

            {isLoading && !dashboard ? (
              <>
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-28" />
                  ))}
                </section>
                <section className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr]">
                  <SkeletonBlock className="h-[340px]" />
                  <SkeletonBlock className="h-[340px]" />
                  <SkeletonBlock className="h-[340px]" />
                </section>
                <section className="grid gap-4 xl:grid-cols-3">
                  <SkeletonBlock className="h-40" />
                  <SkeletonBlock className="h-40" />
                  <SkeletonBlock className="h-40" />
                </section>
              </>
            ) : dashboard ? (
              <>
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  {metrics.map((metric) => (
                    <MetricCard key={metric.label} {...metric} />
                  ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr]">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-[#1F2937]">{graphTitle(periode, customDate)}</h2>
                        <p className="text-xs text-[#6B7280]">{periode === "custom" ? "Fenêtre fixe de 30 jours" : "Période sélectionnée"}</p>
                      </div>
                      <span className="text-sm font-bold text-[#1E8A3C]">{formatPreciseMoney(dashboard.ca_total)}</span>
                    </div>
                    <div className="h-[270px]">
                      {periode === "today" ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={dashboard.courbe_ca} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                            <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={10} />
                            <YAxis yAxisId="left" tick={{ fill: "#6B7280", fontSize: 11 }} tickLine={false} axisLine={false} width={38} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6B7280", fontSize: 11 }} tickFormatter={(value) => `${value} DH`} tickLine={false} axisLine={false} width={58} />
                            <Tooltip content={<AreaTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar yAxisId="left" dataKey="nb_commandes" name="Commandes" fill="#1E8A3C" opacity={0.8} radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="ca" name="CA (DH)" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", r: 3 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dashboard.courbe_ca} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                            <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
                            <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} tickFormatter={(value) => `${value} DH`} tickLine={false} axisLine={false} width={58} />
                            <Tooltip content={<AreaTooltip />} />
                            <Area type="monotone" dataKey="ca" stroke="#1E8A3C" strokeWidth={2} fill="#1E8A3C26" name="CA" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">Statuts commandes</h2>
                    <div className="mt-2 h-[170px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={dashboard.repartition_statuts} dataKey="count" nameKey="statut" innerRadius={55} outerRadius={78} paddingAngle={3}>
                            {dashboard.repartition_statuts.map((entry) => (
                              <Cell key={entry.statut} fill={getStatusColor(entry.statut)} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 max-h-28 overflow-hidden rounded-lg border border-[#E5E7EB]">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {dashboard.repartition_statuts.slice(0, 4).map((row) => (
                            <tr key={row.statut}>
                              <td className="px-2 py-1.5 font-semibold text-[#1F2937]">{normalizeLabel(row.statut)}</td>
                              <td className="px-2 py-1.5 text-right text-[#6B7280]">{formatNumber(row.count)}</td>
                              <td className="px-2 py-1.5 text-right font-bold text-[#1E8A3C]">{row.pourcentage.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">CA par mode paiement</h2>
                    <div className="mt-4 h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.repartition_paiements} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#6B7280", fontSize: 11 }} tickFormatter={(value) => `${value} DH`} tickLine={false} axisLine={false} />
                          <YAxis dataKey="mode" type="category" tick={{ fill: "#6B7280", fontSize: 11 }} tickLine={false} axisLine={false} width={62} />
                          <Tooltip content={<PaymentTooltip />} />
                          <Bar dataKey="montant" radius={[0, 8, 8, 0]} barSize={18}>
                            {dashboard.repartition_paiements.map((entry) => (
                              <Cell key={entry.mode} fill={getPaymentColor(entry.mode)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {dashboard.repartition_paiements.slice(0, 4).map((row) => (
                        <div key={row.mode} className="rounded-lg bg-gray-50 px-2 py-1.5">
                          <p className="font-bold text-[#1F2937]">{row.mode}</p>
                          <p className="text-[#6B7280]">{formatMoney(row.montant)} · {formatNumber(row.count)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-[#1F2937]">Clients actifs</h2>
                        <p className="mt-1 text-xs text-[#6B7280]">Base clients totale</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#1E8A3C]">
                        <Users className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-[#1F2937]">{formatNumber(dashboard.total_clients_actifs)}</p>
                    <p className="mt-1 text-sm font-semibold text-[#1E8A3C]">+{formatNumber(dashboard.nouveaux_clients)} nouveaux sur la période</p>
                    <Link href="/admin/clients" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1E8A3C] hover:text-[#166d30]">
                      Voir les clients
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-[#F0FDF4] p-4 shadow-sm xl:col-span-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E8A3C] text-white">
                          <Gift className="h-4 w-4" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-[#1F2937]">Parrainage viral</h2>
                          <p className="text-xs text-[#6B7280]">Croissance — coût d'acquisition ≈ 0 DH</p>
                        </div>
                      </div>
                      <Link href="/admin/parrainage" className="inline-flex items-center gap-1 text-sm font-bold text-[#1E8A3C] hover:text-[#166d30]">
                        Détails
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-[#6B7280]">Filleuls convertis</p>
                        <p className="mt-1 text-2xl font-bold text-[#1E8A3C]">{formatNumber(dashboard.filleuls_convertis)}</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-[#6B7280]">En attente</p>
                        <p className="mt-1 text-2xl font-bold text-[#1F2937]">{formatNumber(dashboard.parrainages_en_attente)}</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-[#6B7280]">Crédit distribué</p>
                        <p className="mt-1 text-2xl font-bold text-[#1F2937]">{formatMoney(dashboard.credit_parrainage_distribue)}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-[#1F2937]">JIT</h2>
                        <p className="mt-1 text-sm text-[#6B7280]">Tournees actives : {formatNumber(dashboard.tournees_actives)}</p>
                      </div>
                      <StatusBadge value={dashboard.dernier_jit_statut} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6B7280]">Volume</p>
                        <p className="text-xl font-bold text-[#1F2937]">{formatKg(dashboard.dernier_jit_volume)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6B7280]">Commandes</p>
                        <p className="text-xl font-bold text-[#1F2937]">{formatNumber(dashboard.dernier_jit_nb_commandes)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6B7280]">Panier physique</p>
                        <p className="text-sm font-bold text-[#1F2937]">{formatKg(panierPhysique)}/commande</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6B7280]">Dernier job</p>
                        <p className="text-sm font-bold text-[#1F2937]">{formatDateTime(dashboard.dernier_jit_date)}</p>
                      </div>
                    </div>
                    <Link href="/admin/orders#jit" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1E8A3C] hover:text-[#166d30]">
                      Gerer JIT
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">COD</h2>
                    <p className="mt-3 text-3xl font-bold text-[#1F2937]">{dashboard.taux_confirmation_cod.toFixed(1)}%</p>
                    <p className="text-xs font-semibold uppercase text-[#6B7280]">Taux confirmation</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-red-100">
                      <div className="h-full rounded-full bg-[#1E8A3C]" style={{ width: `${Math.min(100, dashboard.taux_confirmation_cod)}%` }} />
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#6B7280]">
                      {formatNumber(dashboard.cod_confirmes)} confirmées | {formatNumber(dashboard.cod_annules)} annulées
                    </p>
                    <Link href="/admin/orders" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1E8A3C] hover:text-[#166d30]">
                      Gerer COD
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">Blacklist periode</h2>
                    <p className="mt-3 text-3xl font-bold text-[#1F2937]">{formatNumber(dashboard.clients_blacklistes)}</p>
                    <p className="text-xs font-semibold uppercase text-[#6B7280]">Blacklistes actifs</p>
                    <p className="mt-1 text-xs text-gray-400">Basé sur le statut compte</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <p className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-700">Nouveaux : +{formatNumber(dashboard.nouveaux_blacklistes)}</p>
                      <p className="rounded-lg bg-[#F0FDF4] px-3 py-2 font-bold text-[#1E8A3C]">Leves : -{formatNumber(dashboard.blacklists_leves)}</p>
                    </div>
                    <p
                      className={cn(
                        "mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-bold",
                        netBlacklist > 0 && "bg-red-50 text-red-700",
                        netBlacklist < 0 && "bg-[#F0FDF4] text-[#1E8A3C]",
                        netBlacklist === 0 && "text-[#6B7280]"
                      )}
                    >
                      Solde net : {netBlacklist > 0 ? "+" : ""}{formatNumber(netBlacklist)}
                    </p>
                    <Link href="/admin/blacklist" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1E8A3C] hover:text-[#166d30]">
                      Voir blacklist
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
