"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  Archive,
  BadgeCheck,
  CircleDollarSign,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { SupplierPageHeader } from "@/components/souki/supplier-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface ProductOffer {
  produit_id: number
  nom_fr: string
  nom_darija: string
  unite: string
  prix_affiche: number | null
  prix_gros: number | null
  stock: number
  is_active: boolean
}

interface CatalogueItem {
  produit_id: number
  nom_fr: string
  nom_darija: string
  unite: string
  prix_affiche: number | null
  deja_propose: boolean
}

export default function SupplierProduitsPage() {
  const { token } = useAuth()
  const [offres, setOffres] = useState<ProductOffer[]>([])
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalogueSearch, setCatalogueSearch] = useState("")

  const fetchData = async () => {
    if (!token) return
    try {
      const [offresRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/supplier/products`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/supplier/products/catalogue`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (offresRes.ok) {
        const data = await offresRes.json()
        setOffres(data.items ?? [])
      }
      if (catRes.ok) {
        setCatalogue(await catRes.json())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [token]) // eslint-disable-line

  const handleAdd = async (produitId: number) => {
    if (!token) return
    setAddingId(produitId)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ produit_id: produitId, stock: 0 }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      setShowAddModal(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout")
    } finally {
      setAddingId(null)
    }
  }

  const handleToggle = async (offre: ProductOffer) => {
    if (!token) return
    setTogglingId(offre.produit_id)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/products/${offre.produit_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !offre.is_active }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (produitId: number) => {
    if (!token) return
    setDeletingId(produitId)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/products/${produitId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression")
    } finally {
      setDeletingId(null)
    }
  }

  const availableToAdd = catalogue.filter((item) => !item.deja_propose)
  const filteredCatalogue = availableToAdd.filter((item) => {
    const query = catalogueSearch.trim().toLocaleLowerCase("fr")
    if (!query) return true
    return `${item.nom_fr} ${item.nom_darija}`.toLocaleLowerCase("fr").includes(query)
  })
  const activeCount = offres.filter((offre) => offre.is_active).length

  return (
    <main className="souki-portal-reveal mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
      <SupplierPageHeader
        eyebrow="Catalogue fournisseur"
        title="Mes produits"
        description="Pilotez la visibilité de vos offres et enrichissez votre sélection depuis le catalogue Souki."
        action={
          <Button
            onClick={() => setShowAddModal(true)}
            disabled={availableToAdd.length === 0}
            className="h-11 rounded-xl bg-accent px-5 font-black text-accent-foreground hover:bg-[#D66B00]"
          >
            <Plus />
            Ajouter un produit
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle />
          <AlertTitle>Action impossible</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl" />
            ))}
          </div>
        </>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3" aria-label="Résumé du catalogue">
            <Card className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 transition-all duration-300 active:scale-[0.98] sm:hover:-translate-y-0.5 hover:shadow-md dark:border-border dark:bg-card">
              <CardContent className="p-4 sm:p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF8EC] text-primary dark:bg-primary/10">
                  <Package className="h-5 w-5" />
                </span>
                <p className="mt-3 text-2xl font-black tabular-nums text-[#264129] dark:text-card-foreground">{offres.length}</p>
                <p className="mt-1 text-[11px] font-bold text-muted-foreground sm:text-xs">Produits proposés</p>
              </CardContent>
            </Card>
            <Card className="gap-0 rounded-2xl border-[#BFE2C4] bg-[#F0FAF1] py-0 transition-all duration-300 active:scale-[0.98] sm:hover:-translate-y-0.5 hover:shadow-md dark:border-border dark:bg-card">
              <CardContent className="p-4 sm:p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <BadgeCheck className="h-5 w-5" />
                </span>
                <p className="mt-3 text-2xl font-black tabular-nums text-[#264129] dark:text-card-foreground">{activeCount}</p>
                <p className="mt-1 text-[11px] font-bold text-muted-foreground sm:text-xs">Produits actifs</p>
              </CardContent>
            </Card>
            <Card className="gap-0 rounded-2xl border-[#DDEBDD] bg-background py-0 transition-all duration-300 active:scale-[0.98] sm:hover:-translate-y-0.5 hover:shadow-md dark:border-border dark:bg-card">
              <CardContent className="p-4 sm:p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0DC] text-accent dark:bg-accent/10">
                  <Plus className="h-5 w-5" />
                </span>
                <p className="mt-3 text-2xl font-black tabular-nums text-[#264129] dark:text-card-foreground">{availableToAdd.length}</p>
                <p className="mt-1 text-[11px] font-bold text-muted-foreground sm:text-xs">Encore disponibles</p>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-9 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#5BD174] to-primary" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Offres actuelles</p>
                  <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-foreground [font-family:var(--font-poppins)]">
                    Mon assortiment
                  </h2>
                </div>
              </div>
              <Badge variant="secondary" className="hidden rounded-full px-3 py-1 sm:inline-flex">
                {activeCount} actif{activeCount > 1 ? "s" : ""} sur {offres.length}
              </Badge>
            </div>

            {offres.length === 0 ? (
              <Empty className="min-h-80 rounded-3xl border border-dashed border-[#DDEBDD] bg-background dark:border-border dark:bg-card">
                <EmptyHeader>
                  <img
                    src="/illustrations/empty-supplier.webp"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={144}
                    height={144}
                    aria-hidden="true"
                    className="mx-auto h-36 w-36 object-contain animate-gentle-float"
                  />
                  <EmptyTitle className="text-[#264129] dark:text-foreground">Aucun produit proposé</EmptyTitle>
                  <EmptyDescription>
                    Ajoutez vos premiers produits depuis le catalogue disponible.
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  onClick={() => setShowAddModal(true)}
                  disabled={availableToAdd.length === 0}
                  className="rounded-xl bg-accent text-accent-foreground hover:bg-[#D66B00]"
                >
                  <Plus />
                  Ajouter
                </Button>
              </Empty>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {offres.map((offre) => (
                  <Card
                    key={offre.produit_id}
                    className="group gap-0 overflow-hidden rounded-2xl border-[#DDEBDD] bg-background py-0 shadow-sm transition active:scale-[0.98] sm:hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md dark:border-border dark:bg-card"
                  >
                    <div className={`h-1.5 ${offre.is_active ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                              offre.is_active
                                ? "bg-[#EAF8EC] text-primary dark:bg-primary/10"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Package className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-black text-[#264129] dark:text-card-foreground">{offre.nom_fr}</h3>
                            {offre.nom_darija && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{offre.nom_darija}</p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${
                            offre.is_active
                              ? "border-[#BFE2C4] bg-[#EAF8EC] text-primary dark:border-primary/30 dark:bg-primary/10"
                              : "text-muted-foreground"
                          }`}
                        >
                          {offre.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-muted/65 p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            <CircleDollarSign className="h-3.5 w-3.5" />
                            Prix
                          </div>
                          <p className="mt-1.5 text-sm font-black text-[#264129] dark:text-foreground">
                            {offre.prix_gros != null ? `${offre.prix_gros} DH` : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">par {offre.unite}</p>
                        </div>
                        <div className="rounded-xl bg-muted/65 p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            <Archive className="h-3.5 w-3.5" />
                            Stock
                          </div>
                          <p className="mt-1.5 text-sm font-black text-[#264129] dark:text-foreground">{offre.stock}</p>
                          <p className="text-[10px] text-muted-foreground">{offre.unite}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#DDEBDD] pt-4 dark:border-border">
                        <label
                          htmlFor={`active-${offre.produit_id}`}
                          className="flex min-w-0 items-center gap-3 text-sm font-bold text-[#264129] dark:text-foreground"
                        >
                          <Switch
                            id={`active-${offre.produit_id}`}
                            checked={offre.is_active}
                            onCheckedChange={() => void handleToggle(offre)}
                            disabled={togglingId === offre.produit_id}
                            aria-label={`${offre.is_active ? "Désactiver" : "Activer"} ${offre.nom_fr}`}
                          />
                          <span className="truncate">
                            {togglingId === offre.produit_id
                              ? "Mise à jour…"
                              : offre.is_active
                                ? "Visible"
                                : "Masqué"}
                          </span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(offre.produit_id)}
                          disabled={
                            deletingId === offre.produit_id ||
                            (offre.is_active && activeCount <= 1)
                          }
                          className="rounded-xl text-destructive hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/30"
                          aria-label={`Supprimer ${offre.nom_fr}`}
                          title={
                            offre.is_active && activeCount <= 1
                              ? "La boutique doit conserver au moins un produit actif"
                              : "Supprimer"
                          }
                        >
                          {deletingId === offre.produit_id ? <Spinner /> : <Trash2 />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[85vh] overflow-hidden rounded-3xl border-[#DDEBDD] p-0 dark:border-border sm:max-w-xl">
          <DialogHeader className="border-b border-[#DDEBDD] bg-[#F0FAF1] px-6 py-5 text-left dark:border-border dark:bg-muted/40">
            <DialogTitle className="text-xl font-black text-[#264129] dark:text-foreground [font-family:var(--font-poppins)]">
              Ajouter un produit
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un produit du catalogue Souki qui n’est pas encore dans votre assortiment.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 p-4 sm:p-6">
            {availableToAdd.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={catalogueSearch}
                  onChange={(event) => setCatalogueSearch(event.target.value)}
                  placeholder="Rechercher dans le catalogue…"
                  className="h-11 rounded-xl border-[#DDEBDD] bg-background pl-10 dark:border-border"
                />
              </div>
            )}

            {availableToAdd.length === 0 ? (
              <Empty className="min-h-56">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-[#EAF8EC] text-primary dark:bg-primary/10">
                    <BadgeCheck />
                  </EmptyMedia>
                  <EmptyTitle className="text-[#264129] dark:text-foreground">Catalogue complet</EmptyTitle>
                  <EmptyDescription>Vous proposez déjà tous les produits disponibles.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : filteredCatalogue.length === 0 ? (
              <Empty className="min-h-48">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle>Aucun résultat</EmptyTitle>
                  <EmptyDescription>Essayez un autre nom de produit.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {filteredCatalogue.map((item) => (
                  <button
                    key={item.produit_id}
                    type="button"
                    onClick={() => void handleAdd(item.produit_id)}
                    disabled={addingId === item.produit_id}
                    className="group flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[#DDEBDD] bg-background px-4 py-3 text-left transition hover:border-primary/35 hover:bg-[#F8FCF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 dark:border-border dark:hover:bg-muted"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EC] text-primary dark:bg-primary/10">
                      <Package className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#264129] dark:text-foreground">
                        {item.nom_fr}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {item.nom_darija || `Vendu par ${item.unite}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-black text-primary">
                      {addingId === item.produit_id ? <Spinner /> : "+ Ajouter"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
