"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  MapPin,
  PackageCheck,
  Phone,
  Scale,
  ShoppingBasket,
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
import { useSupplierLiveRefresh } from "@/hooks/useSupplierLiveRefresh"
import { API_BASE_URL } from "@/lib/api"

type PreparationLine = {
  product_id: number
  nom_fr: string
  quantite_kg: number
  unite: string
}

type PreparationOrder = {
  id: number
  statut: string
  creneau_livraison: string | null
  montant_total: number
  client_nom: string
  client_phone: string | null
  adresse: string | null
  produits: PreparationLine[]
}

type PreparationResponse = {
  date: string
  nombre_commandes: number
  picking: PreparationLine[]
  commandes: PreparationOrder[]
}

const STATUS_LABELS: Record<string, string> = {
  VERROUILLEE: "À préparer",
  EN_ATTENTE_LIVREUR: "En attente du livreur",
  A_LIVRER: "Ramassée",
}

function PreparationStatus({ status }: { status: string }) {
  if (status === "VERROUILLEE") return <StatusBadge status="preparing" size="sm" />
  if (status === "EN_ATTENTE_LIVREUR") return <StatusBadge status="pending" size="sm" />
  if (status === "A_LIVRER") return <StatusBadge status="enroute" size="sm" />
  return (
    <Badge variant="outline" className="rounded-full text-muted-foreground">
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

export default function SupplierPreparationPage() {
  const { token } = useAuth()
  const [data, setData] = useState<PreparationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/supplier/preparation`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      if (!response.ok) throw new Error(`Erreur ${response.status}`)
      setData(await response.json())
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement impossible.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useSupplierLiveRefresh(load, Boolean(token))

  return (
    <main className="souki-portal-reveal mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
      <SupplierPageHeader
        eyebrow="Atelier du jour"
        title="Préparation des commandes"
        description="La liste agrégée à prélever, puis chaque commande active du jour avec son détail."
        action={
          data ? (
            <Badge
              variant="outline"
              className="h-9 rounded-full border-[#BFE2C4] bg-[#EAF8EC] px-3 font-bold text-primary dark:border-primary/30 dark:bg-primary/10"
            >
              <CalendarDays className="h-4 w-4" />
              {new Date(`${data.date}T12:00:00`).toLocaleDateString("fr-MA", {
                day: "2-digit",
                month: "long",
              })}
            </Badge>
          ) : undefined
        }
      />

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle />
          <AlertTitle>Impossible de charger l’atelier</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Skeleton className="h-[28rem] rounded-3xl" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : data ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="overflow-hidden rounded-3xl border border-[#BFE2C4] bg-background shadow-sm dark:border-primary/25 dark:bg-card">
            <div className="relative overflow-hidden bg-[#173F27] p-6 text-white sm:p-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_15%,rgba(76,184,74,0.35),transparent_32%)]" />
              <div className="pointer-events-none absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-[#F5C400]/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/8 to-transparent" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#8EDD8B]">
                    <ClipboardList className="h-4 w-4" />
                    Liste de picking agrégée
                  </div>
                  <h2 className="mt-3 text-2xl font-black [font-family:var(--font-poppins)]">
                    Tout prélever en un passage
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">
                    Les quantités ci-dessous regroupent uniquement les commandes actives d’aujourd’hui.
                  </p>
                </div>
                <span className="flex h-12 min-w-12 items-center justify-center rounded-2xl bg-white/10 px-3 text-lg font-black">
                  {data.picking.length}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {data.picking.length === 0 ? (
                <Empty className="min-h-64 border border-dashed border-[#DDEBDD] dark:border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="bg-[#EAF8EC] text-primary dark:bg-primary/10">
                      <ClipboardCheck />
                    </EmptyMedia>
                    <EmptyTitle className="text-[#264129] dark:text-foreground">Atelier à jour</EmptyTitle>
                    <EmptyDescription>Rien à préparer pour le moment.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.picking.map((item, index) => (
                    <article
                      key={item.product_id}
                      className="group flex items-center gap-4 rounded-2xl border border-[#DDEBDD] bg-[#F8FCF8] p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-[#F0FAF1] hover:shadow-sm dark:border-border dark:bg-muted/30 dark:hover:bg-muted"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-xs font-black text-primary shadow-sm transition-transform group-hover:scale-110 dark:bg-card">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-[#264129] dark:text-foreground">{item.nom_fr}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Produit #{item.product_id}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-black text-primary">{item.quantite_kg}</p>
                        <p className="text-xs font-bold text-muted-foreground">{item.unite}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#FFF0DC] px-4 py-3 text-sm text-[#8B5108] dark:bg-accent/10 dark:text-orange-300">
                <Scale className="h-5 w-5 shrink-0 text-accent" />
                <span className="font-semibold">Pesez et contrôlez chaque produit avant de répartir par commande.</span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#5BD174] to-primary" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Répartition</p>
                  <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-foreground [font-family:var(--font-poppins)]">
                    Détail des commandes
                  </h2>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {data.nombre_commandes} commande{data.nombre_commandes > 1 ? "s" : ""}
              </Badge>
            </div>

            {data.commandes.length === 0 ? (
              <Empty className="min-h-72 rounded-3xl border border-dashed border-[#DDEBDD] bg-background dark:border-border dark:bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-[#EAF8EC] text-primary dark:bg-primary/10">
                    <ShoppingBasket />
                  </EmptyMedia>
                  <EmptyTitle className="text-[#264129] dark:text-foreground">Aucune commande active</EmptyTitle>
                  <EmptyDescription>Les commandes du jour apparaîtront ici.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {data.commandes.map((order) => (
                  <Card
                    key={order.id}
                    className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md dark:border-border dark:bg-card"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            Commande #{order.id}
                          </p>
                          <h3 className="mt-1 truncate font-black text-[#264129] dark:text-card-foreground">
                            {order.client_nom}
                          </h3>
                        </div>
                        <PreparationStatus status={order.statut} />
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-[#6F8070] dark:text-muted-foreground">
                        {order.client_phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            {order.client_phone}
                          </p>
                        )}
                        {order.adresse && (
                          <p className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{order.adresse}</span>
                          </p>
                        )}
                        {order.creneau_livraison && (
                          <p className="flex items-center gap-2">
                            <Clock3 className="h-3.5 w-3.5 text-accent" />
                            Créneau : {order.creneau_livraison}
                          </p>
                        )}
                      </div>

                      <Separator className="my-4 bg-[#DDEBDD] dark:bg-border" />

                      <div className="space-y-2">
                        {order.produits.map((line) => (
                          <div
                            key={line.product_id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-muted/70 px-3 py-2.5"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-[#264129] dark:text-foreground">
                              <PackageCheck className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate">{line.nom_fr}</span>
                            </span>
                            <span className="shrink-0 text-xs font-black text-primary">
                              {line.quantite_kg} {line.unite}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#DDEBDD] pt-3 text-xs dark:border-border">
                        <span className="text-muted-foreground">Montant commande</span>
                        <span className="font-black text-[#264129] dark:text-card-foreground">
                          {order.montant_total.toFixed(2)} DH
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  )
}
