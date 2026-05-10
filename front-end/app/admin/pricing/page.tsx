"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  ShoppingBasket,
  TrendingDown,
  Truck,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/useAuth"
import {
  getProduitsPricing,
  recalculerTousPrix,
  updateProduitPricing,
  type ProduitAlerte,
  type ProduitNiveau,
  type ProduitPricingDTO,
  type ProduitPricingListDTO,
  type ProduitPricingUpdateDTO,
  type ProduitVolatilite,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const adminNavItems: Array<{ icon: LucideIcon; label: string; href: string; active?: boolean }> = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Package, label: "Commandes du jour", href: "/admin/orders" },
  { icon: Users, label: "Clients", href: "/admin/clients" },
  { icon: AlertTriangle, label: "Blackliste", href: "/admin/blacklist" },
  { icon: Truck, label: "Logistique & Livreurs", href: "/admin/livreur" },
  { icon: ShoppingBasket, label: "Gestion Produits & Prix", href: "/admin/produits" },
  { icon: CircleDollarSign, label: "Pricing", href: "/admin/pricing", active: true },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Users, label: "Abonnements Parentaux", href: "/admin/subscriptions" },
  { icon: Wallet, label: "Transactions Wallet", href: "/admin/wallet" },
  { icon: Settings, label: "Parametres Systeme", href: "/admin/settings" },
]

const adminNavPermissions: Record<string, string> = {
  "/admin": "admin.panel.access",
  "/admin/orders": "orders.read",
  "/admin/clients": "clients.read",
  "/admin/blacklist": "clients.blacklist",
  "/admin/livreur": "admin.panel.access",
  "/admin/produits": "products.manage",
  "/admin/pricing": "admin.panel.access",
  "/admin/analytics": "stats.read",
  "/admin/subscriptions": "parent.dashboard.access",
  "/admin/wallet": "wallets.read",
  "/admin/settings": "users.manage_roles",
}

const niveauOptions: ProduitNiveau[] = [1, 2, 3]
const volatiliteOptions: ProduitVolatilite[] = ["STABLE", "VARIABLE", "SAISONNIER"]

interface EditValues {
  prix_gros_saisi: string
  marge_cible: string
  coussin_securite: string
  niveau: ProduitNiveau
  volatilite: ProduitVolatilite
}

function countAlerts(items: ProduitPricingDTO[]) {
  return items.filter((item) => item.alerte !== null).length
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-"
  }

  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-"
  }

  return `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`
}

function percentInputValue(value: number) {
  return (value * 100).toFixed(2).replace(/\.?0+$/, "")
}

function getNumberFromInput(value: string) {
  const normalized = value.trim().replace(",", ".")
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function getPricingError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Impossible de charger les prix produits."
}

function niveauBadge(niveau: ProduitNiveau) {
  if (niveau === 1) {
    return {
      label: "N1 Appel",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    }
  }

  if (niveau === 2) {
    return {
      label: "N2 Volume",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }

  return {
    label: "N3 Profit",
    className: "border-emerald-200 bg-[#F0FDF4] text-[#1E8A3C]",
  }
}

function alerteBadge(alerte: ProduitAlerte) {
  if (alerte === "PRIX_GROS_MANQUANT") {
    return {
      icon: ShieldAlert,
      label: "Prix gros manquant",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }

  if (alerte === "PRIX_DEPASSE_KHDDAR") {
    return {
      icon: AlertTriangle,
      label: "Depasse khddar",
      className: "border-red-200 bg-red-50 text-red-700",
    }
  }

  return {
    icon: CheckCircle2,
    label: "OK",
    className: "border-emerald-200 bg-[#F0FDF4] text-[#1E8A3C]",
  }
}

function khddarComparison(produit: ProduitPricingDTO) {
  if (
    typeof produit.prix_affiche !== "number" ||
    typeof produit.prix_khddar_estime !== "number" ||
    !Number.isFinite(produit.prix_affiche) ||
    !Number.isFinite(produit.prix_khddar_estime)
  ) {
    return <span className="text-gray-400">-</span>
  }

  const diff = produit.prix_affiche - produit.prix_khddar_estime
  const formatted = `${diff > 0 ? "+" : ""}${diff.toFixed(2)} DH`

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-red-700">
        <AlertTriangle className="h-4 w-4" />
        {formatted}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[#1E8A3C]">
      <CheckCircle2 className="h-4 w-4" />
      {formatted}
    </span>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "green",
}: {
  icon: LucideIcon
  label: string
  value: string | number
  helper: string
  tone?: "green" | "red" | "amber"
}) {
  const tones = {
    green: "border-emerald-100 bg-[#F0FDF4] text-[#1E8A3C]",
    red: "border-red-100 bg-red-50 text-red-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{helper}</p>
        </div>
        <div className={cn("rounded-lg border p-2.5", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 7 }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-10 gap-3">
          {Array.from({ length: 10 }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-9 rounded-lg bg-gray-200" />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#1E8A3C]">
        <CircleDollarSign className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-gray-950">Aucun produit pricing</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
        Aucun produit n'est disponible pour le parametrage pricing.
      </p>
    </div>
  )
}

export default function AdminPricingPage() {
  const { token, isLoading: isAuthLoading, can } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pricingList, setPricingList] = useState<ProduitPricingListDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<EditValues | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [isRecalculateOpen, setIsRecalculateOpen] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)

  const produits = pricingList?.items ?? []
  const totalProduits = pricingList?.total ?? 0
  const nbAlertes = pricingList?.nb_alertes ?? 0
  const produitsSansPrixGros = produits.filter((produit) => produit.prix_gros_saisi === null).length

  const visibleAdminNavItems = useMemo(
    () => adminNavItems.filter((item) => can(adminNavPermissions[item.href] || "admin.panel.access")),
    [can]
  )

  const loadPricing = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await getProduitsPricing(token, signal)
      setPricingList(result)
      setError("")
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") {
        return
      }
      setError(getPricingError(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!token) {
      setIsLoading(false)
      setError("Session admin requise.")
      return
    }

    const controller = new AbortController()
    void loadPricing(controller.signal)

    return () => controller.abort()
  }, [isAuthLoading, loadPricing, token])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => setToast(""), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function startEdit(produit: ProduitPricingDTO) {
    setEditingId(produit.id)
    setEditValues({
      prix_gros_saisi: produit.prix_gros_saisi === null ? "" : String(produit.prix_gros_saisi),
      marge_cible: percentInputValue(produit.marge_cible),
      coussin_securite: percentInputValue(produit.coussin_securite),
      niveau: produit.niveau,
      volatilite: produit.volatilite,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues(null)
  }

  function updateEditValue<Key extends keyof EditValues>(key: Key, value: EditValues[Key]) {
    setEditValues((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveEdit(produit: ProduitPricingDTO) {
    if (!token || !editValues) {
      return
    }

    const prixGros = getNumberFromInput(editValues.prix_gros_saisi)
    const marge = getNumberFromInput(editValues.marge_cible)
    const coussin = getNumberFromInput(editValues.coussin_securite)

    if (editValues.prix_gros_saisi.trim() && prixGros === null) {
      setError("Prix gros saisi invalide.")
      return
    }

    if (marge === null || marge < 0 || marge > 100) {
      setError("Marge invalide. Valeur attendue entre 0 et 100.")
      return
    }

    if (coussin === null || coussin < 0 || coussin > 20) {
      setError("Coussin invalide. Valeur attendue entre 0 et 20.")
      return
    }

    const payload: ProduitPricingUpdateDTO = {
      prix_gros_saisi: prixGros,
      marge_cible: marge / 100,
      coussin_securite: coussin / 100,
      niveau: editValues.niveau,
      volatilite: editValues.volatilite,
    }

    setSavingId(produit.id)
    try {
      const updatedProduit = await updateProduitPricing(token, produit.id, payload)
      setPricingList((current) => {
        if (!current) {
          return current
        }

        const items = current.items.map((item) => item.id === updatedProduit.id ? updatedProduit : item)
        return {
          items,
          total: current.total,
          nb_alertes: countAlerts(items),
        }
      })
      setError("")
      setToast(`${updatedProduit.nom_fr} mis a jour.`)
      cancelEdit()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de sauvegarder le produit.")
    } finally {
      setSavingId(null)
    }
  }

  async function confirmRecalculate() {
    if (!token) {
      return
    }

    setIsRecalculating(true)
    try {
      const result = await recalculerTousPrix(token)
      const refreshed = await getProduitsPricing(token)
      setPricingList(refreshed)
      setToast(`${result.recalcules} prix recalcules - ${result.alertes} alertes detectees`)
      setError("")
      setIsRecalculateOpen(false)
    } catch (recalculateError) {
      setError(recalculateError instanceof Error ? recalculateError.message : "Impossible de recalculer les prix.")
    } finally {
      setIsRecalculating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {toast ? (
        <div className="fixed right-4 top-20 z-50 rounded-xl border border-emerald-200 bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#1E8A3C] shadow-lg">
          {toast}
        </div>
      ) : null}

      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-sm">
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
            <p className="text-sm font-bold text-[#1F2937]">Gestion des Prix Produits</p>
            <p className="text-xs text-[#6B7280]">Pricing catalogue</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="relative rounded-xl p-2 text-[#1F2937] hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              {nbAlertes > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" /> : null}
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E8A3C] font-bold text-white">
              A
            </div>
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
                  item.active ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/20 p-3">
            <button type="button" title="Deconnexion" aria-label="Deconnexion" className="flex h-11 w-11 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </aside>

        {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

        <main className="min-w-0 flex-1">
          <div className="sticky top-14 z-30 border-b border-[#E5E7EB] bg-white px-4 py-3 lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#1F2937]">Gestion des Prix Produits</h1>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold",
                      nbAlertes > 0
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-[#F0FDF4] text-[#1E8A3C]"
                    )}
                  >
                    {nbAlertes > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {nbAlertes} alertes actives
                  </span>
                </div>
                <p className="text-sm text-[#6B7280]">Niveaux de marge, coussins de securite, prix affiches</p>
              </div>

              <AlertDialog open={isRecalculateOpen} onOpenChange={setIsRecalculateOpen}>
                <button
                  type="button"
                  onClick={() => setIsRecalculateOpen(true)}
                  disabled={!token || isRecalculating || isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E8A3C] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#166d30] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRecalculating ? <Spinner className="size-4 text-white" /> : <RefreshCw className="h-4 w-4" />}
                  Recalculer tous les prix
                </button>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Recalculer les prix pour tous les produits ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action met a jour prix_affiche selon les marges et coussins configures.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl" disabled={isRecalculating}>
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault()
                        void confirmRecalculate()
                      }}
                      disabled={isRecalculating}
                      className="rounded-xl bg-[#1E8A3C] hover:bg-[#166d30]"
                    >
                      {isRecalculating ? <Spinner className="size-4 text-white" /> : <RefreshCw className="h-4 w-4" />}
                      Recalculer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4 lg:px-6">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : null}

            <section className="grid gap-3 md:grid-cols-3">
              <KpiCard icon={Package} label="Total produits" value={totalProduits} helper="Catalogue pricing" tone="green" />
              <KpiCard icon={AlertTriangle} label="Alertes prix" value={nbAlertes} helper="A traiter par admin" tone={nbAlertes > 0 ? "red" : "green"} />
              <KpiCard icon={TrendingDown} label="Produits sans prix gros" value={produitsSansPrixGros} helper="Prix catalogue utilise" tone={produitsSansPrixGros > 0 ? "amber" : "green"} />
            </section>

            <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">Tableau pricing</h2>
                  <p className="text-sm text-gray-500">Parametrage par produit et controle vs khddar estime.</p>
                </div>
              </div>

              {isLoading ? (
                <TableSkeleton />
              ) : produits.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Produit</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Darija</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Niveau</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Prix gros saisi</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Marge %</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Coussin %</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Prix affiche</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">vs Khddar</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Alerte</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {produits.map((produit) => {
                        const isEditing = editingId === produit.id
                        const niveau = niveauBadge(produit.niveau)
                        const alerte = alerteBadge(produit.alerte)
                        const AlerteIcon = alerte.icon

                        return (
                          <tr key={produit.id} className={cn("transition-colors hover:bg-gray-50", isEditing && "bg-[#F0FDF4]/40")}>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-gray-950">{produit.nom_fr}</p>
                              <p className="text-xs text-gray-500">#{produit.id} - {formatMoney(produit.prix_kg)} / {produit.unite}</p>
                            </td>
                            <td className="px-4 py-4 text-sm text-[#3D3D3D]">{produit.nom_darija}</td>
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <select
                                  value={editValues.niveau}
                                  onChange={(event) => updateEditValue("niveau", Number(event.target.value) as ProduitNiveau)}
                                  className="w-24 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm font-semibold outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                                >
                                  {niveauOptions.map((option) => (
                                    <option key={option} value={option}>N{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-bold", niveau.className)}>
                                  {niveau.label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={editValues.prix_gros_saisi}
                                  onChange={(event) => updateEditValue("prix_gros_saisi", event.target.value)}
                                  className="w-28 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-[#3D3D3D]">{formatMoney(produit.prix_gros_saisi)}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={editValues.marge_cible}
                                  onChange={(event) => updateEditValue("marge_cible", event.target.value)}
                                  className="w-24 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-[#3D3D3D]">{formatPercent(produit.marge_cible)}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.1"
                                  value={editValues.coussin_securite}
                                  onChange={(event) => updateEditValue("coussin_securite", event.target.value)}
                                  className="w-24 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-[#3D3D3D]">{formatPercent(produit.coussin_securite)}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 font-bold text-[#1E8A3C]">{formatMoney(produit.prix_affiche)}</td>
                            <td className="px-4 py-4 text-sm">{khddarComparison(produit)}</td>
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <select
                                  value={editValues.volatilite}
                                  onChange={(event) => updateEditValue("volatilite", event.target.value as ProduitVolatilite)}
                                  className="w-36 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm font-semibold outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                                >
                                  {volatiliteOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold", alerte.className)}>
                                  <AlerteIcon className="h-3.5 w-3.5" />
                                  {alerte.label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void saveEdit(produit)}
                                    disabled={savingId === produit.id}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E8A3C] text-white hover:bg-[#166d30] disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Sauvegarder"
                                    aria-label="Sauvegarder"
                                  >
                                    {savingId === produit.id ? <Spinner className="size-4 text-white" /> : <Save className="h-4 w-4" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    disabled={savingId === produit.id}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Annuler"
                                    aria-label="Annuler"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(produit)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#1E8A3C] hover:bg-[#F0FDF4]"
                                  title="Modifier"
                                  aria-label="Modifier"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
