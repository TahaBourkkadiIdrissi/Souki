"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Image as ImageIcon,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  ShoppingBasket,
  Trash2,
  TrendingDown,
  Truck,
  Upload,
  Users,
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
  createProduit,
  deleteProduit,
  getProduitsPricing,
  recalculerTousPrix,
  updateProduitImageUrl,
  updateProduitPricing,
  uploadProduitImage,
  type ProductCreateDTO,
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
]

const adminNavPermissions: Record<string, string> = {
  "/admin": "admin.panel.access",
  "/admin/orders": "orders.read",
  "/admin/clients": "clients.read",
  "/admin/blacklist": "clients.blacklist",
  "/admin/livreur": "admin.panel.access",
  "/admin/produits": "products.manage",
  "/admin/pricing": "admin.panel.access",
}

const niveauOptions: ProduitNiveau[] = [1, 2, 3]
const volatiliteOptions: ProduitVolatilite[] = ["STABLE", "VARIABLE", "SAISONNIER"]

interface EditValues {
  prix_gros_saisi: string
  prix_khddar_reel: string
  prix_vente_manuel: string
  promo_pct: string
  marge_cible: string
  coussin_securite: string
  niveau: ProduitNiveau
  volatilite: ProduitVolatilite
}

interface CreateValues {
  nom_fr: string
  nom_darija: string
  prix_kg: string
  unite: string
  niveau: ProduitNiveau
  marge_cible: string
  coussin_securite: string
  volatilite: ProduitVolatilite
  prix_gros_saisi: string
  prix_khddar_reel: string
  prix_vente_manuel: string
}

const defaultCreateValues: CreateValues = {
  nom_fr: "",
  nom_darija: "",
  prix_kg: "",
  unite: "kg",
  niveau: 2,
  marge_cible: "25",
  coussin_securite: "10",
  volatilite: "STABLE",
  prix_gros_saisi: "",
  prix_khddar_reel: "",
  prix_vente_manuel: "",
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

// Promotion affichée aux clients (badge -X% sur les cartes produits) :
// pct = 1 - prix_vente / prix_khddar. Même arrondi que le front client.
function derivePromoPct(prixVente: number, prixKhddar: number | null | undefined) {
  if (
    typeof prixKhddar !== "number" ||
    !Number.isFinite(prixKhddar) ||
    prixKhddar <= 0 ||
    prixKhddar <= prixVente
  ) {
    return 0
  }

  return Math.round((1 - prixVente / prixKhddar) * 100)
}

function produitPromoPct(produit: ProduitPricingDTO) {
  const prixVente =
    typeof produit.prix_affiche === "number" ? produit.prix_affiche : produit.prix_kg
  return derivePromoPct(prixVente, produit.prix_khddar_estime)
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
  const { token, isLoading: isAuthLoading, can, logout } = useAuth()
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createValues, setCreateValues] = useState<CreateValues>(defaultCreateValues)
  const [isCreating, setIsCreating] = useState(false)
  const [imageTarget, setImageTarget] = useState<ProduitPricingDTO | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageSavingId, setImageSavingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProduitPricingDTO | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const produits = pricingList?.items ?? []
  const totalProduits = pricingList?.total ?? 0
  const nbAlertes = pricingList?.nb_alertes ?? 0
  const produitsSansPrixGros = produits.filter((produit) => produit.prix_gros_saisi === null).length

  const visibleAdminNavItems = useMemo(
    () => adminNavItems.filter((item) => can(adminNavPermissions[item.href] || "admin.panel.access")),
    [can]
  )

  const handleAdminLogout = async () => {
    await logout()
    window.location.assign("/login?logged_out=1")
  }

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
      prix_khddar_reel: produit.prix_khddar_reel == null ? "" : String(produit.prix_khddar_reel),
      prix_vente_manuel: produit.prix_vente_manuel == null ? "" : String(produit.prix_vente_manuel),
      promo_pct: String(produitPromoPct(produit)),
      marge_cible: percentInputValue(produit.marge_cible),
      coussin_securite: percentInputValue(produit.coussin_securite),
      niveau: produit.niveau,
      volatilite: produit.volatilite,
    })
  }

  // Prix de vente effectif pendant l'édition : prix manuel saisi, sinon prix affiché.
  function effectiveSalePrice(values: EditValues, produit: ProduitPricingDTO) {
    const manuel = getNumberFromInput(values.prix_vente_manuel)
    if (manuel !== null && manuel > 0) {
      return manuel
    }
    return typeof produit.prix_affiche === "number" ? produit.prix_affiche : produit.prix_kg
  }

  // Le champ "Promo client" pilote prix_khddar_reel : le badge -X% côté client vaut
  // 1 - prix_vente / prix_khddar_estime, et prix_khddar_reel écrase l'estimation.
  function updatePromoPct(produit: ProduitPricingDTO, value: string) {
    setEditValues((current) => {
      if (!current) {
        return current
      }

      const next = { ...current, promo_pct: value }
      const pct = getNumberFromInput(value)
      if (pct !== null && pct >= 0 && pct < 100) {
        const prixVente = effectiveSalePrice(next, produit)
        next.prix_khddar_reel =
          pct === 0 ? prixVente.toFixed(2) : (prixVente / (1 - pct / 100)).toFixed(2)
      }
      return next
    })
  }

  // Édition directe du prix khddar réel ou du prix de vente : la promo affichée
  // est resynchronisée pour rester cohérente avec le badge client.
  function updatePriceLinkedValue(
    produit: ProduitPricingDTO,
    key: "prix_khddar_reel" | "prix_vente_manuel",
    value: string,
  ) {
    setEditValues((current) => {
      if (!current) {
        return current
      }

      const next = { ...current, [key]: value }
      const prixVente = effectiveSalePrice(next, produit)
      const khddar = getNumberFromInput(next.prix_khddar_reel) ?? produit.prix_khddar_estime
      next.promo_pct = String(derivePromoPct(prixVente, khddar))
      return next
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues(null)
  }

  function updateEditValue<Key extends keyof EditValues>(key: Key, value: EditValues[Key]) {
    setEditValues((current) => current ? { ...current, [key]: value } : current)
  }

  function updateCreateValue<Key extends keyof CreateValues>(key: Key, value: CreateValues[Key]) {
    setCreateValues((current) => ({ ...current, [key]: value }))
  }

  function updateProduitInList(updatedProduit: ProduitPricingDTO) {
    setPricingList((current) => {
      if (!current) {
        return current
      }

      const items = current.items.map((item) => item.id === updatedProduit.id ? updatedProduit : item)
      return {
        items,
        total: items.length,
        nb_alertes: countAlerts(items),
      }
    })
  }

  async function saveEdit(produit: ProduitPricingDTO) {
    if (!token || !editValues) {
      return
    }

    const prixGros = getNumberFromInput(editValues.prix_gros_saisi)
    const prixKhddarReel = getNumberFromInput(editValues.prix_khddar_reel)
    const prixVenteManuel = getNumberFromInput(editValues.prix_vente_manuel)
    const marge = getNumberFromInput(editValues.marge_cible)
    const coussin = getNumberFromInput(editValues.coussin_securite)

    if (editValues.prix_gros_saisi.trim() && prixGros === null) {
      setError("Prix gros saisi invalide.")
      return
    }

    if (editValues.prix_khddar_reel.trim() && prixKhddarReel === null) {
      setError("Prix khddar reel invalide.")
      return
    }

    if (editValues.prix_vente_manuel.trim() && (prixVenteManuel === null || prixVenteManuel < 0)) {
      setError("Prix de vente manuel invalide.")
      return
    }

    const promoPct = getNumberFromInput(editValues.promo_pct)
    if (editValues.promo_pct.trim() && (promoPct === null || promoPct < 0 || promoPct >= 100)) {
      setError("Promotion invalide. Valeur attendue entre 0 et 99.")
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
      prix_khddar_reel: prixKhddarReel,
      prix_vente_manuel: prixVenteManuel,
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

  async function createProduct() {
    if (!token || isCreating) {
      return
    }

    const prixKg = getNumberFromInput(createValues.prix_kg)
    const marge = getNumberFromInput(createValues.marge_cible)
    const coussin = getNumberFromInput(createValues.coussin_securite)
    const prixGros = getNumberFromInput(createValues.prix_gros_saisi)
    const prixKhddarReel = getNumberFromInput(createValues.prix_khddar_reel)
    const prixVenteManuel = getNumberFromInput(createValues.prix_vente_manuel)

    if (!createValues.nom_fr.trim() || !createValues.nom_darija.trim() || !createValues.unite.trim()) {
      setError("Nom FR, nom Darija et unite sont obligatoires.")
      return
    }

    if (prixKg === null || prixKg <= 0) {
      setError("Prix kg invalide.")
      return
    }

    if (createValues.prix_gros_saisi.trim() && (prixGros === null || prixGros < 0)) {
      setError("Prix gros saisi invalide.")
      return
    }

    if (createValues.prix_khddar_reel.trim() && (prixKhddarReel === null || prixKhddarReel < 0)) {
      setError("Prix khddar reel invalide.")
      return
    }

    if (createValues.prix_vente_manuel.trim() && (prixVenteManuel === null || prixVenteManuel < 0)) {
      setError("Prix de vente manuel invalide.")
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

    const payload: ProductCreateDTO = {
      nom_fr: createValues.nom_fr.trim(),
      nom_darija: createValues.nom_darija.trim(),
      prix_kg: prixKg,
      unite: createValues.unite.trim(),
      niveau: createValues.niveau,
      marge_cible: marge / 100,
      coussin_securite: coussin / 100,
      volatilite: createValues.volatilite,
      prix_gros_saisi: prixGros,
      prix_khddar_reel: prixKhddarReel,
      prix_vente_manuel: prixVenteManuel,
    }

    setIsCreating(true)
    try {
      const createdProduit = await createProduit(token, payload)
      setPricingList((current) => {
        if (!current) {
          return { items: [createdProduit], total: 1, nb_alertes: countAlerts([createdProduit]) }
        }

        const items = [...current.items, createdProduit].sort((a, b) => a.id - b.id)
        return {
          items,
          total: items.length,
          nb_alertes: countAlerts(items),
        }
      })
      setCreateValues(defaultCreateValues)
      setShowCreateModal(false)
      setError("")
      setToast(`${createdProduit.nom_fr} créé. Stock initialisé à 0.`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Impossible de créer le produit.")
    } finally {
      setIsCreating(false)
    }
  }

  function openImageModal(produit: ProduitPricingDTO) {
    setImageTarget(produit)
    setImageUrlInput(produit.image_url || "")
    setImageFile(null)
  }

  async function saveImageUrl() {
    if (!token || !imageTarget || imageSavingId !== null) {
      return
    }

    const imageUrl = imageUrlInput.trim()
    if (!imageUrl) {
      setError("URL image obligatoire.")
      return
    }
    if (imageUrl.toLowerCase().startsWith("data:image/")) {
      setError("Utilise l'upload fichier pour une image locale, ou colle une URL publique.")
      return
    }
    if (imageUrl.length > 500) {
      setError("L'URL image ne doit pas dépasser 500 caractères.")
      return
    }
    if (!/^https?:\/\/[^/]+\S*$/i.test(imageUrl)) {
      setError("L'URL image doit commencer par http:// ou https://.")
      return
    }

    setImageSavingId(imageTarget.id)
    try {
      const updatedProduit = await updateProduitImageUrl(token, imageTarget.id, imageUrl)
      updateProduitInList(updatedProduit)
      setImageTarget(null)
      setImageUrlInput("")
      setError("")
      setToast(`Image de ${updatedProduit.nom_fr} mise a jour.`)
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Impossible de sauvegarder l'image.")
    } finally {
      setImageSavingId(null)
    }
  }

  async function uploadImageFile() {
    if (!token || !imageTarget || !imageFile || imageSavingId !== null) {
      return
    }

    setImageSavingId(imageTarget.id)
    try {
      const updatedProduit = await uploadProduitImage(token, imageTarget.id, imageFile)
      updateProduitInList(updatedProduit)
      setImageTarget(null)
      setImageFile(null)
      setImageUrlInput("")
      setError("")
      setToast(`Photo de ${updatedProduit.nom_fr} televersee.`)
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Impossible de televerser l'image.")
    } finally {
      setImageSavingId(null)
    }
  }

  async function confirmDeleteProduct() {
    if (!token || !deleteTarget || deletingId !== null) {
      return
    }

    setDeletingId(deleteTarget.id)
    try {
      await deleteProduit(token, deleteTarget.id)
      setPricingList((current) => {
        if (!current) {
          return current
        }

        const items = current.items.filter((item) => item.id !== deleteTarget.id)
        return {
          items,
          total: items.length,
          nb_alertes: countAlerts(items),
        }
      })
      setToast(`${deleteTarget.nom_fr} masque du catalogue.`)
      setDeleteTarget(null)
      setError("")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer le produit.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {toast ? (
        <div className="fixed right-4 top-20 z-50 rounded-xl border border-emerald-200 bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#1E8A3C] shadow-lg">
          {toast}
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">Nouveau produit</h2>
                <p className="mt-1 text-sm text-gray-500">Le stock initial sera cree a 999.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                aria-label="Fermer"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Nom FR
                <input
                  value={createValues.nom_fr}
                  onChange={(event) => updateCreateValue("nom_fr", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Nom Darija
                <input
                  value={createValues.nom_darija}
                  onChange={(event) => updateCreateValue("nom_darija", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Prix kg
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={createValues.prix_kg}
                  onChange={(event) => updateCreateValue("prix_kg", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Unite
                <input
                  value={createValues.unite}
                  onChange={(event) => updateCreateValue("unite", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Niveau
                <select
                  value={createValues.niveau}
                  onChange={(event) => updateCreateValue("niveau", Number(event.target.value) as ProduitNiveau)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                >
                  {niveauOptions.map((option) => (
                    <option key={option} value={option}>N{option}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Volatilite
                <select
                  value={createValues.volatilite}
                  onChange={(event) => updateCreateValue("volatilite", event.target.value as ProduitVolatilite)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                >
                  {volatiliteOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Marge %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={createValues.marge_cible}
                  onChange={(event) => updateCreateValue("marge_cible", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Coussin %
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={createValues.coussin_securite}
                  onChange={(event) => updateCreateValue("coussin_securite", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Prix gros saisi (DH) <span className="text-xs font-normal text-gray-400">optionnel</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Ex: 6.50"
                  value={createValues.prix_gros_saisi}
                  onChange={(event) => updateCreateValue("prix_gros_saisi", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Prix khddar reel (DH) <span className="text-xs font-normal text-gray-400">optionnel</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Ex: 7.50"
                  value={createValues.prix_khddar_reel}
                  onChange={(event) => updateCreateValue("prix_khddar_reel", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Prix de vente final (DH) <span className="text-xs font-normal text-gray-400">optionnel, sinon calcule</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Vide = calcule depuis le gros"
                  value={createValues.prix_vente_manuel}
                  onChange={(event) => updateCreateValue("prix_vente_manuel", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-600 md:col-span-2">
                Photo ajoutable apres creation via le bouton photo dans le tableau.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void createProduct()}
                disabled={isCreating}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1E8A3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166d30] disabled:opacity-60"
              >
                {isCreating ? <Spinner className="size-4 text-white" /> : <Plus className="h-4 w-4" />}
                Creer le produit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imageTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">Photo produit</h2>
                <p className="mt-1 text-sm text-gray-500">{imageTarget.nom_fr}</p>
              </div>
              <button
                type="button"
                onClick={() => setImageTarget(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                aria-label="Fermer"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                URL externe
                <input
                  value={imageUrlInput}
                  onChange={(event) => setImageUrlInput(event.target.value)}
                  placeholder="https://..."
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
              <button
                type="button"
                onClick={() => void saveImageUrl()}
                disabled={imageSavingId === imageTarget.id}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              >
                {imageSavingId === imageTarget.id ? <Spinner className="size-4 text-[#1E8A3C]" /> : <ImageIcon className="h-4 w-4" />}
                Enregistrer l'URL
              </button>

              <div className="border-t border-gray-100 pt-5">
                <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                  Upload fichier local
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-[#F0FDF4] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#1E8A3C]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void uploadImageFile()}
                  disabled={!imageFile || imageSavingId === imageTarget.id}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E8A3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166d30] disabled:opacity-60"
                >
                  {imageSavingId === imageTarget.id ? <Spinner className="size-4 text-white" /> : <Upload className="h-4 w-4" />}
                  Televerser
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Il sera masque du catalogue et de la page pricing. Cette action ne supprime pas l'historique existant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deletingId !== null}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteProduct()
              }}
              disabled={deletingId !== null}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              {deletingId !== null ? <Spinner className="size-4 text-white" /> : <Trash2 className="h-4 w-4" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-sm">
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

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  disabled={!token || isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau produit
                </button>

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
                  <table className="w-full min-w-[1360px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Produit</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Darija</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Niveau</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Prix gros saisi</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Marge %</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Coussin %</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Prix affiche</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Promo client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">vs Khddar</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Prix khddar reel</th>
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
                              <div className="flex items-center gap-3">
                                {produit.image_url ? (
                                  <img
                                    src={produit.image_url}
                                    alt={produit.nom_fr}
                                    className="h-9 w-9 rounded-lg object-cover"
                                  />
                                ) : (
                                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0FDF4] text-lg">
                                    🥬
                                  </span>
                                )}
                                <div>
                                  <p className="font-semibold text-gray-950">{produit.nom_fr}</p>
                                  <p className="text-xs text-gray-500">#{produit.id} - {formatMoney(produit.prix_kg)} / {produit.unite}</p>
                                </div>
                              </div>
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
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="Auto"
                                  value={editValues.prix_vente_manuel}
                                  onChange={(event) => updatePriceLinkedValue(produit, "prix_vente_manuel", event.target.value)}
                                  className="w-28 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm font-bold text-[#1E8A3C] outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                                />
                              ) : (
                                <span className="font-bold text-[#1E8A3C]">{formatMoney(produit.prix_affiche)}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    step="1"
                                    value={editValues.promo_pct}
                                    onChange={(event) => updatePromoPct(produit, event.target.value)}
                                    className="w-20 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm font-bold text-[#F07C00] outline-none focus:border-[#F07C00] focus:ring-2 focus:ring-[#F07C00]/10"
                                  />
                                  <span className="text-sm font-semibold text-gray-500">%</span>
                                </div>
                              ) : produitPromoPct(produit) > 0 ? (
                                <span className="inline-flex rounded-full bg-[#F07C00] px-2.5 py-1 text-xs font-black text-white">
                                  -{produitPromoPct(produit)}%
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm">{khddarComparison(produit)}</td>
                            <td className="px-4 py-4">
                              {isEditing && editValues ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="Optionnel"
                                  value={editValues.prix_khddar_reel}
                                  onChange={(event) => updatePriceLinkedValue(produit, "prix_khddar_reel", event.target.value)}
                                  className="w-28 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                                />
                              ) : (
                                <span className="text-sm text-gray-600">{formatMoney(produit.prix_khddar_reel)}</span>
                              )}
                            </td>
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
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(produit)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#1E8A3C] hover:bg-[#F0FDF4]"
                                    title="Modifier"
                                    aria-label="Modifier"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openImageModal(produit)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-gray-700 hover:bg-gray-50"
                                    title="Photo"
                                    aria-label="Photo"
                                  >
                                    <Camera className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(produit)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                    title="Supprimer"
                                    aria-label="Supprimer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
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
