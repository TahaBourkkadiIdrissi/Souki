"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Clock,
  History,
  Leaf,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBasket,
} from "lucide-react"

import { MobileBottomNav } from "@/components/souki/mobile-bottom-nav"
import { useAuth } from "@/hooks/useAuth"
import type { CommandeHistoriqueDTO } from "@/lib/api"
import {
  fetchCatalogueProducts,
  fetchOrderHistory,
  resolveCatalogueImage,
} from "@/lib/catalogue"
import { cn } from "@/lib/utils"

type RecentProduct = {
  id: number
  name: string
  image: string
  price: number
  unit: string
  displayUnit?: string
  viewedAt: string
}

const formatDh = (value: number | string) => `${Number(value || 0).toFixed(2)} DH`

const formatOrderDate = (value?: string | null) => {
  if (!value) {
    return "Date non disponible"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Date non disponible"
  }

  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const getOrderStatusClassName = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase()
  if (normalizedStatus === "LIVRE") {
    return "border-[#BFE6C4] bg-[#EAF8EC] text-[#1E8A3C]"
  }
  if (normalizedStatus === "EN_ROUTE") {
    return "border-[#B9D7F2] bg-[#EEF7FF] text-[#1A5F96]"
  }
  if (normalizedStatus === "ABSENT" || normalizedStatus === "REFUS" || normalizedStatus === "ANNULE") {
    return "border-[#F1C6C6] bg-[#FFF1F1] text-[#B42318]"
  }
  return "border-[#F5D7B8] bg-[#FFF7EE] text-[#9A5C11]"
}

const getOrderStatusLabel = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase()
  const labels: Record<string, string> = {
    EN_ATTENTE: "En attente",
    EN_ROUTE: "En route",
    LIVRE: "Livrée",
    ABSENT: "Absent",
    REFUS: "Refusée",
    ANNULE: "Annulée",
  }
  return labels[normalizedStatus] || status || "Statut inconnu"
}

function HistoriqueContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([])
  const [catalogueImages, setCatalogueImages] = useState<Record<string, string>>({})
  const [orderHistory, setOrderHistory] = useState<CommandeHistoriqueDTO[]>([])
  const [isFetchingOrders, setIsFetchingOrders] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const successOrderId = searchParams.get("commande_validee")

  const loadRecentProducts = () => {
    try {
      const rawHistory = window.localStorage.getItem("souki_recent_products")
      const parsedHistory = rawHistory ? JSON.parse(rawHistory) : []
      setRecentProducts(Array.isArray(parsedHistory) ? parsedHistory.slice(0, 12) : [])
    } catch {
      setRecentProducts([])
    }
  }

  const loadOrderHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setOrderHistory([])
      setHistoryError("")
      return
    }

    try {
      setIsFetchingOrders(true)
      const history = await fetchOrderHistory()
      setOrderHistory(history)
      setHistoryError("")
    } catch {
      setHistoryError("Impossible de charger votre historique de commandes pour le moment.")
    } finally {
      setIsFetchingOrders(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadRecentProducts()
  }, [])

  useEffect(() => {
    let isMounted = true

    fetchCatalogueProducts()
      .then((products) => {
        if (!isMounted) {
          return
        }

        const imageMap = products.reduce<Record<string, string>>((acc, product) => {
          acc[String(product.id)] = product.image
          acc[product.name.toLowerCase()] = product.image
          return acc
        }, {})
        setCatalogueImages(imageMap)
      })
      .catch(() => {
        setCatalogueImages({})
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading) {
      return
    }

    void loadOrderHistory()
  }, [isLoading, loadOrderHistory])

  const resolveOrderProductImage = (product: CommandeHistoriqueDTO["produits"][number]) => {
    const productWithImage = product as CommandeHistoriqueDTO["produits"][number] & { image?: string | null }
    if (productWithImage.image) {
      return productWithImage.image
    }

    return (
      catalogueImages[String(product.product_id)] ||
      catalogueImages[product.nom_fr.toLowerCase()] ||
      resolveCatalogueImage(product.nom_fr)
    )
  }

  return (
    <div className="min-h-screen bg-[#FBFDF9] pb-24 md:pb-0">
      <header className="sticky top-0 z-40 hidden glass-ios26 border-b border-[#E7F0E8] md:block">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/catalogue" className="inline-flex items-center gap-2 rounded-2xl bg-[#F0FAF1] px-4 py-3 text-sm font-bold text-[#1E8A3C]">
            <ArrowLeft className="h-4 w-4" />
            Catalogue
          </Link>
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-sm">
              <img src="/logo3.png" alt="SOUKI" className="h-full w-[175%] max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <span className="text-xl font-bold text-[#1E8A3C]">SOUKI</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-8 lg:px-8">
        {successOrderId && (
          <div className="mb-5 rounded-2xl border border-[#BFE6C4] bg-[#EAF8EC] px-5 py-4 text-sm font-semibold text-[#1E8A3C]">
            Votre commande N-{successOrderId} a été enregistrée avec succès.
          </div>
        )}

        <section className="mb-6 rounded-[28px] border border-[#D7EBD9] bg-[linear-gradient(135deg,#FFFFFF_0%,#F7FCF7_58%,#FFF7EE_100%)] p-5 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.2)] md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#1E8A3C] ring-1 ring-[#D7EBD9]">
                <History className="h-4 w-4" />
                Historique
              </span>
              <h1 className="mt-4 text-3xl font-black leading-tight text-[#1E8A3C] md:text-4xl">
                Retrouvez vos produits consultés et vos commandes.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F735F] md:text-base">
                Le catalogue reste dédié aux produits disponibles. Ici, vous retrouvez le contexte utile pour recommander plus vite.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                loadRecentProducts()
                void loadOrderHistory()
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#CFE6D2] bg-white px-4 py-3 text-sm font-bold text-[#1E8A3C] transition-colors hover:bg-[#F0FAF1]"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[#1E8A3C]">
              <Leaf className="h-5 w-5" />
              <h2 className="text-xl font-black">Produits consultés récemment</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#F07C00] ring-1 ring-[#F5D7B8]">
              {recentProducts.length}
            </span>
          </div>

          {recentProducts.length === 0 ? (
            <div className="rounded-[24px] border border-[#E6EFE7] bg-white p-8 text-center">
              <ShoppingBasket className="mx-auto mb-3 h-10 w-10 text-[#B8C9BA]" />
              <p className="font-semibold text-[#264129]">Aucun produit consulté pour le moment.</p>
              <Link href="/catalogue" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E8A3C] px-5 text-sm font-bold text-white">
                Explorer le catalogue
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentProducts.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-[#E6F0E7] bg-white shadow-[0_16px_45px_-34px_rgba(30,65,41,0.3)]">
                  <img
                    src={resolveCatalogueImage(product.name, product.image)}
                    alt={product.name}
                    className="h-36 w-full object-cover"
                  />
                  <div className="p-4">
                    <h3 className="truncate text-base font-black text-[#264129]">{product.name}</h3>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="font-black text-[#F07C00]">{formatDh(product.price)}</p>
                      <span className="text-xs font-semibold text-[#6F8070]">/ {product.displayUnit || product.unit}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#7B8B7D]">
                      <Clock className="h-4 w-4" />
                      {formatOrderDate(product.viewedAt)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[#1E8A3C]">
              <ReceiptText className="h-5 w-5" />
              <h2 className="text-xl font-black">Historique des commandes</h2>
            </div>
            {isAuthenticated && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#F07C00] ring-1 ring-[#F5D7B8]">
                {orderHistory.length} commande{orderHistory.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {!isAuthenticated && !isLoading ? (
            <div className="rounded-[24px] border border-[#F3D8B2] bg-[#FFF7EE] p-6">
              <p className="text-sm font-semibold text-[#9A5C11]">
                Connectez-vous pour afficher vos commandes validées.
              </p>
              <Link href="/login?redirect=/historique" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#F07C00] px-5 text-sm font-bold text-white">
                Se connecter
              </Link>
            </div>
          ) : isFetchingOrders ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-[24px] bg-gradient-to-br from-[#F3F7F3] to-[#EAF3EB]" />
              ))}
            </div>
          ) : historyError ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-600">
              {historyError}
            </div>
          ) : orderHistory.length === 0 ? (
            <div className="rounded-[24px] border border-[#E6EFE7] bg-white p-8 text-center">
              <PackageCheck className="mx-auto mb-3 h-10 w-10 text-[#B8C9BA]" />
              <p className="font-semibold text-[#264129]">Aucune commande validée pour le moment.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {orderHistory.map((order) => (
                <article key={order.id} className="overflow-hidden rounded-2xl border border-[#E6F0E7] bg-white shadow-[0_18px_55px_-36px_rgba(30,65,41,0.35)]">
                  <div className="h-1.5 bg-gradient-to-r from-[#1E8A3C] via-[#4CB84A] to-[#F07C00]" />
                  <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B8B7D]">Commande N-{order.id}</p>
                      <h3 className="mt-1 text-lg font-black text-[#264129]">{formatOrderDate(order.date_commande)}</h3>
                    </div>
                    <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", getOrderStatusClassName(order.statut))}>
                      {getOrderStatusLabel(order.statut)}
                    </span>
                  </div>
                  <div className="space-y-3 px-5 pb-5">
                    {order.produits.slice(0, 4).map((product, index) => (
                      <div key={`${order.id}-${product.nom_fr}-${index}`} className="flex items-center gap-3 rounded-2xl bg-[#F7FCF7] p-3 text-sm">
                        <img
                          src={resolveOrderProductImage(product)}
                          alt={product.nom_fr}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[#264129]">{product.nom_fr}</p>
                          <p className="text-xs font-semibold text-[#6F8070]">{product.quantite_kg} kg</p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-[#F07C00]">
                          {typeof product.sous_total === "number" ? formatDh(product.sous_total) : ""}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-[#EEF2EE] pt-4">
                      <span className="font-bold text-[#264129]">Total</span>
                      <span className="text-xl font-black text-[#F07C00]">{formatDh(order.montant_total || 0)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <MobileBottomNav />
    </div>
  )
}

export default function HistoriquePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FBFDF9]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1E8A3C] border-t-transparent" />
        </div>
      }
    >
      <HistoriqueContent />
    </Suspense>
  )
}
