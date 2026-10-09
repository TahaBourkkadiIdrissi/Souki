"use client"

import { formatDeliveryDate } from "@/lib/order-hours"

import { SoukiLogoLink } from "@/components/souki/souki-logo"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarDays, MapPin, ReceiptText, RefreshCw, ShoppingBasket } from "lucide-react"

import { OrderProgress } from "@/components/order/order-progress"
import { SoukiEmptyState } from "@/components/souki/empty-state"
import { useAuth } from "@/hooks/useAuth"
import type { CommandeHistoriqueDTO } from "@/lib/api"
import { fetchOrderHistory } from "@/lib/catalogue"

function formatDh(value?: number | null) {
  return `${Number(value || 0).toFixed(2)} DH`
}

function formatOrderDate(value?: string | null) {
  if (!value) return "Date non disponible"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date non disponible"
  return new Intl.DateTimeFormat("fr-MA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function TrackingContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const orderId = useMemo(() => {
    const raw = searchParams.get("commande")
    return raw && /^\d+$/.test(raw) ? Number(raw) : null
  }, [searchParams])

  const [order, setOrder] = useState<CommandeHistoriqueDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadOrder = useCallback(async () => {
    if (!isAuthenticated || !orderId) {
      setOrder(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const history = await fetchOrderHistory()
      const selectedOrder = history.find((item) => item.id === orderId) || null
      setOrder(selectedOrder)
      setError(selectedOrder ? "" : "Cette commande est introuvable dans votre compte.")
    } catch {
      setError("Impossible de charger l'avancement pour le moment. Réessayez dans quelques instants.")
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, orderId])

  useEffect(() => {
    if (isAuthLoading) return
    const timeoutId = window.setTimeout(() => void loadOrder(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [isAuthLoading, loadOrder])

  return (
    <div className="min-h-[100dvh] bg-[#FBFDF9] pb-12">
      <header className="border-b border-[#E7F0E8] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/historique" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#F0FAF1] px-4 text-sm font-bold text-[#176B2E] transition-colors hover:bg-[#E4F5E7] active:translate-y-px">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Mes commandes
          </Link>
          <SoukiLogoLink height={36} priority />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-7 max-w-2xl">
          <p className="text-sm font-bold text-[#F07C00]">Suivi de commande</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-[#1E8A3C] sm:text-4xl">Suivez votre livraison en temps réel</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[#5F735F] sm:text-base">Retrouvez chaque étape, de la confirmation jusqu’à la remise de votre panier.</p>
        </div>

        {loading || isAuthLoading ? (
          <div aria-label="Chargement de la commande" className="rounded-[28px] border border-[#D7EBD9] bg-white p-6">
            <div className="souki-skeleton h-8 w-56 rounded-xl" />
            <div className="mt-7 grid gap-5 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-3">
                  <div className="souki-skeleton h-12 w-12 rounded-2xl" />
                  <div className="souki-skeleton h-4 w-28 rounded-lg" />
                  <div className="souki-skeleton h-3 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : error || !order ? (
          <SoukiEmptyState
            icon={ReceiptText}
            illustrationSrc="/illustrations/empty-orders.webp"
            title={orderId ? "Commande introuvable" : "Lien de suivi incomplet"}
            description={error || "Ouvrez le lien reçu par email ou choisissez une commande dans votre historique."}
            action={
              <Link href="/historique" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E8A3C] px-5 text-sm font-bold text-white transition-colors hover:bg-[#176B2E] active:translate-y-px">
                Voir mes commandes
              </Link>
            }
          />
        ) : (
          <div className="space-y-5">
            <OrderProgress order={order} />

            <section className="grid gap-4 rounded-[28px] border border-[#E6F0E7] bg-white p-5 sm:grid-cols-3 sm:p-6" aria-label="Informations de la commande">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#1E8A3C]" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-[#7B8B7D]">Commandée le</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-[#264129]">{formatOrderDate(order.date_commande)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#1E8A3C]" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-[#7B8B7D]">Créneau de livraison</p>
                  <p className="mt-1 text-sm font-semibold text-[#264129]">{formatDeliveryDate(order.date_livraison)} · {order.creneau_livraison || "À confirmer"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShoppingBasket className="mt-0.5 h-5 w-5 shrink-0 text-[#F07C00]" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-[#7B8B7D]">Total du panier</p>
                  <p className="mt-1 text-lg font-black text-[#F07C00]">{formatDh(order.montant_total)}</p>
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => void loadOrder()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#CFE6D2] bg-white px-5 text-sm font-bold text-[#176B2E] transition-colors hover:bg-[#F0FAF1] active:translate-y-px">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Actualiser
              </button>
              <Link href="/catalogue" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E8A3C] px-5 text-sm font-bold text-white transition-colors hover:bg-[#176B2E] active:translate-y-px">
                Retour au marché
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#FBFDF9]" />}>
      <TrackingContent />
    </Suspense>
  )
}
