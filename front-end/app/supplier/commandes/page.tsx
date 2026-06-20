"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CircleDollarSign,
  Package,
  ReceiptText,
  ShoppingCart,
  UserRound,
} from "lucide-react"

import { StatusBadge } from "@/components/souki/status-badge"
import { SupplierPageHeader } from "@/components/souki/supplier-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface SupplierOrder {
  id: number
  date_commande: string | null
  statut: string
  montant_total: number
  client_nom?: string
  produits?: { nom_fr: string; quantite_kg: number }[]
}

type BadgeStatus = "pending" | "confirmed" | "preparing" | "enroute" | "delivered" | "cancelled"

const STATUS_MAP: Record<string, BadgeStatus> = {
  EN_ATTENTE: "pending",
  CONFIRMEE: "confirmed",
  VERROUILLEE: "preparing",
  EN_COURS: "preparing",
  EN_ATTENTE_LIVREUR: "pending",
  A_LIVRER: "enroute",
  LIVREE: "delivered",
  ANNULEE: "cancelled",
}

function OrderStatus({ status }: { status: string }) {
  const mapped = STATUS_MAP[status]
  if (mapped) return <StatusBadge status={mapped} size="sm" />
  return (
    <Badge variant="outline" className="rounded-full text-muted-foreground">
      {status}
    </Badge>
  )
}

export default function SupplierCommandesPage() {
  const { token } = useAuth()
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/supplier/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
        const data = await res.json()
        setOrders(data.orders ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        setLoading(false)
      }
    }
    void fetchOrders()
  }, [token])

  const totalRevenue = orders.reduce((sum, order) => sum + order.montant_total, 0)
  const activeOrders = orders.filter((order) => !["LIVREE", "ANNULEE"].includes(order.statut)).length

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
      <SupplierPageHeader
        eyebrow="Suivi commercial"
        title="Commandes"
        description="Consultez les ventes associées à vos produits, leur statut et leur composition."
      />

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle />
          <AlertTitle>Chargement impossible</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className={`h-28 rounded-2xl ${index === 2 ? "col-span-2 lg:col-span-1" : ""}`} />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        </>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Résumé des commandes">
            <Card className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 dark:border-border dark:bg-card">
              <CardContent className="p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF8EC] text-primary dark:bg-primary/10">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <p className="mt-4 text-2xl font-black text-[#264129] dark:text-card-foreground">{orders.length}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">Commandes au total</p>
              </CardContent>
            </Card>
            <Card className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 dark:border-border dark:bg-card">
              <CardContent className="p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0DC] text-accent dark:bg-accent/10">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <p className="mt-4 text-2xl font-black text-[#264129] dark:text-card-foreground">{activeOrders}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">À suivre actuellement</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 gap-0 rounded-2xl border-[#DDEBDD] bg-[#173F27] py-0 text-white lg:col-span-1 dark:border-border">
              <CardContent className="p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#F5C400]">
                  <CircleDollarSign className="h-5 w-5" />
                </div>
                <p className="mt-4 text-2xl font-black">{totalRevenue.toFixed(2)} DH</p>
                <p className="mt-1 text-xs font-bold text-white/60">Montant cumulé affiché</p>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Historique visible</p>
                <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-foreground [font-family:var(--font-poppins)]">
                  Liste des ventes
                </h2>
              </div>
              {orders.length > 0 && (
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {orders.length} résultat{orders.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {orders.length === 0 ? (
              <Empty className="min-h-80 rounded-3xl border border-dashed border-[#DDEBDD] bg-background dark:border-border dark:bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="h-14 w-14 rounded-2xl bg-[#EAF8EC] text-primary dark:bg-primary/10">
                    <ShoppingCart />
                  </EmptyMedia>
                  <EmptyTitle className="text-[#264129] dark:text-foreground">Aucune commande pour l’instant</EmptyTitle>
                  <EmptyDescription>
                    Les ventes liées à vos produits apparaîtront ici dès leur création.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card
                    key={order.id}
                    className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 shadow-sm transition hover:border-primary/25 hover:shadow-md dark:border-border dark:bg-card"
                  >
                    <CardContent className="p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FAF1] text-primary dark:bg-primary/10">
                            <ReceiptText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black text-[#264129] dark:text-card-foreground">
                                Commande #{order.id}
                              </h3>
                              <OrderStatus status={order.statut} />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {order.client_nom && (
                                <span className="flex items-center gap-1.5">
                                  <UserRound className="h-3.5 w-3.5" />
                                  {order.client_nom}
                                </span>
                              )}
                              {order.date_commande && (
                                <span className="flex items-center gap-1.5">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {new Date(order.date_commande).toLocaleDateString("fr-MA", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#FFF0DC] px-4 py-2.5 text-right dark:bg-accent/10">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A681F] dark:text-orange-300">
                            Montant
                          </p>
                          <p className="mt-0.5 font-black text-[#264129] dark:text-foreground">
                            {order.montant_total.toFixed(2)} DH
                          </p>
                        </div>
                      </div>

                      {order.produits && order.produits.length > 0 && (
                        <>
                          <Separator className="my-4 bg-[#DDEBDD] dark:bg-border" />
                          <div className="flex flex-wrap gap-2">
                            {order.produits.map((product, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center gap-2 rounded-xl border border-[#DDEBDD] bg-muted/60 px-3 py-2 text-xs font-bold text-[#264129] dark:border-border dark:text-foreground"
                              >
                                <Package className="h-3.5 w-3.5 text-primary" />
                                {product.nom_fr}
                                <span className="text-muted-foreground">{product.quantite_kg} kg</span>
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
