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
import { useHaptic } from "@/hooks/useHaptic"
import { useSupplierLiveRefresh } from "@/hooks/useSupplierLiveRefresh"
import { API_BASE_URL } from "@/lib/api"
import { cn } from "@/lib/utils"

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

/**
 * Cases cochees de la liste de picking, conservees localement et remises a zero
 * chaque jour. Purement cote client : c'est un pense-bete d'atelier, il ne
 * modifie aucune donnee de commande.
 */
function usePickingChecklist(date: string | undefined) {
  const storageKey = date ? `souki-supplier-picking:${date}` : null
  const [picked, setPicked] = useState<number[]>([])

  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = window.localStorage.getItem(storageKey)
      setPicked(stored ? (JSON.parse(stored) as number[]) : [])
    } catch {
      setPicked([])
    }
  }, [storageKey])

  const toggle = useCallback(
    (productId: number) => {
      setPicked((current) => {
        const next = current.includes(productId)
          ? current.filter((id) => id !== productId)
          : [...current, productId]
        if (storageKey) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(next))
          } catch {
            // Quota plein ou mode prive : la case reste cochee pour la session.
          }
        }
        return next
      })
    },
    [storageKey],
  )

  return { picked, toggle }
}

export default function SupplierPreparationPage() {
  const { token } = useAuth()
  const [data, setData] = useState<PreparationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const haptic = useHaptic()
  const { picked, toggle } = usePickingChecklist(data?.date)

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

  // Ne compte que les produits encore au programme du jour : une ligne disparue
  // du picking ne doit pas gonfler l'avancement.
  const pickedCount = data
    ? data.picking.filter((item) => picked.includes(item.product_id)).length
    : 0
  const pickingProgress = data && data.picking.length > 0
    ? Math.round((pickedCount / data.picking.length) * 100)
    : 0

  return (
    <main className="souki-portal-reveal mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
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
            <div className="relative overflow-hidden bg-[#173F27] p-5 text-white sm:p-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_15%,rgba(76,184,74,0.35),transparent_32%)]" />
              <div className="pointer-events-none absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-[#F5C400]/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/8 to-transparent" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#8EDD8B]">
                    <ClipboardList className="h-4 w-4" />
                    Liste de picking agrégée
                  </div>
                  <h2 className="mt-2.5 text-xl font-black sm:mt-3 sm:text-2xl [font-family:var(--font-poppins)]">
                    Tout prélever en un passage
                  </h2>
                  <p className="mt-2 hidden max-w-lg text-sm leading-6 text-white/70 sm:block">
                    Les quantités ci-dessous regroupent uniquement les commandes actives d’aujourd’hui.
                  </p>
                </div>
                <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 px-3 text-lg font-black tabular-nums">
                  {data.picking.length}
                </span>
              </div>

              {/* Avancement du prelevement : lisible d'un coup d'oeil depuis l'atelier. */}
              {data.picking.length > 0 && (
                <div className="relative mt-4">
                  <div className="flex items-center justify-between text-xs font-bold text-white/80">
                    <span>
                      {pickedCount} / {data.picking.length} prélevé{pickedCount > 1 ? "s" : ""}
                    </span>
                    <span className="tabular-nums">{pickingProgress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-[#8EDD8B] transition-[width] duration-300"
                      style={{ width: `${pickingProgress}%` }}
                    />
                  </div>
                </div>
              )}
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
                  {data.picking.map((item, index) => {
                    const isPicked = picked.includes(item.product_id)
                    return (
                      // Pense-bete d'atelier : on coche au fur et a mesure du
                      // prelevement, sans lacher le cageot des yeux.
                      <button
                        key={item.product_id}
                        type="button"
                        aria-pressed={isPicked}
                        onClick={() => {
                          haptic(isPicked ? "light" : "success")
                          toggle(item.product_id)
                        }}
                        className={cn(
                          "group flex min-h-16 w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:shadow-sm",
                          isPicked
                            ? "border-primary/35 bg-[#EAF8EC] dark:border-primary/30 dark:bg-primary/10"
                            : "border-[#DDEBDD] bg-[#F8FCF8] hover:border-primary/30 hover:bg-[#F0FAF1] dark:border-border dark:bg-muted/30 dark:hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-sm transition-transform sm:group-hover:scale-110",
                            isPicked
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-primary dark:bg-card",
                          )}
                        >
                          {isPicked ? <ClipboardCheck className="h-5 w-5" /> : String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate font-black text-[#264129] dark:text-foreground",
                              isPicked && "line-through opacity-60",
                            )}
                          >
                            {item.nom_fr}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {isPicked ? "Prélevé" : `Produit #${item.product_id}`}
                          </p>
                        </div>
                        <div className={cn("shrink-0 text-right", isPicked && "opacity-60")}>
                          <p className="text-lg font-black tabular-nums text-primary">{item.quantite_kg}</p>
                          <p className="text-xs font-bold text-muted-foreground">{item.unite}</p>
                        </div>
                      </button>
                    )
                  })}
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
                    className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 shadow-sm transition active:scale-[0.98] sm:hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md dark:border-border dark:bg-card"
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
