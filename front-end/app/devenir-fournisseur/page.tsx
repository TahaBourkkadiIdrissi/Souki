"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  type LucideIcon,
  MapPin,
  Navigation,
  Package,
  Search,
  Store,
} from "lucide-react"

import { MapboxLocator } from "@/components/souki/mapbox-locator"
import { SupplierPageHeader } from "@/components/souki/supplier-shell"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Produit {
  id: number
  nom_fr: string
  nom_darija: string
  unite: string
  prix_affiche?: number | null
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-[#607061]">
      {children}
    </label>
  )
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#DDEBDD] bg-background px-4 py-3 dark:border-border dark:bg-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0FAF1] text-primary dark:bg-primary/10">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-black text-[#264129] dark:text-card-foreground">{value}</p>
      </div>
    </div>
  )
}

export default function DevenirFournisseurPage() {
  const { user, token } = useAuth()
  const router = useRouter()

  const [shopName, setShopName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [ville, setVille] = useState("")
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [description, setDescription] = useState("")
  const [mapboxModalOpen, setMapboxModalOpen] = useState(false)

  const [produits, setProduits] = useState<Produit[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [productSearch, setProductSearch] = useState("")

  const [loading, setLoading] = useState(false)
  const [loadingProduits, setLoadingProduits] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user?.roles.includes("FOURNISSEUR")) {
      router.replace("/supplier")
    }
  }, [user, router])

  useEffect(() => {
    const fetchProduits = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/catalogue`)
        if (!res.ok) throw new Error("Erreur catalogue")
        const data = await res.json()
        const items: Produit[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : []
        setProduits(items)
      } catch {
        setProduits([])
      } finally {
        setLoadingProduits(false)
      }
    }
    void fetchProduits()
  }, [])

  const filteredProduits = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase("fr")
    if (!query) return produits
    return produits.filter((produit) =>
      `${produit.nom_fr} ${produit.nom_darija} ${produit.unite}`.toLocaleLowerCase("fr").includes(query)
    )
  }, [produits, productSearch])

  const selectedProducts = useMemo(
    () => produits.filter((produit) => selectedIds.has(produit.id)),
    [produits, selectedIds]
  )

  const hasLocation = latitude !== null && longitude !== null
  const canSubmit = Boolean(token) && selectedIds.size > 0 && hasLocation && !loading

  const toggleProduit = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError("Connectez-vous pour envoyer votre demande fournisseur.")
      return
    }
    if (!hasLocation) {
      setError("Localisez votre boutique sur la carte pour continuer.")
      return
    }
    if (selectedIds.size === 0) {
      setError("Selectionnez au moins un produit.")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shop_name: shopName,
          phone,
          address,
          ville,
          latitude,
          longitude,
          description,
          produit_ids: Array.from(selectedIds),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail || `Erreur ${res.status}`)
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-muted/55 px-4 py-8 text-foreground sm:px-6 lg:py-14">
        <section className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-[#DDEBDD] bg-background px-6 py-12 text-center shadow-sm dark:border-border dark:bg-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF8EC] text-primary dark:bg-primary/10">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-accent">Demande fournisseur</p>
          <h1 className="mt-2 text-3xl font-black text-[#264129] dark:text-card-foreground [font-family:var(--font-poppins)]">
            Demande envoyee
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#6F8070] dark:text-muted-foreground">
            Votre boutique est en attente de validation par l'equipe Souki. Vous serez notifie par email.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-[#176B2E]"
          >
            Retour a l'accueil
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-muted/55 text-foreground dark:bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
        <SupplierPageHeader
          eyebrow="Demande fournisseur"
          title="Ouvrir ma boutique Souki"
          description="Renseignez votre point de collecte, choisissez vos produits et envoyez votre dossier pour validation."
        />

        <section className="overflow-hidden rounded-3xl bg-[#173F27] text-white shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_24rem] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">
                <Store className="h-4 w-4 text-[#8EDD8B]" />
                Futur partenaire Souki
              </div>
              <h2 className="mt-5 max-w-2xl text-2xl font-black tracking-tight sm:text-4xl [font-family:var(--font-poppins)]">
                Une fiche boutique claire aide l'equipe a valider votre demande rapidement.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Les informations saisies ici alimenteront votre futur portail fournisseur apres approbation.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/10 p-3">
              <div className="rounded-xl bg-white/10 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Etape</p>
                <p className="mt-1 text-lg font-black">1/3</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Produits</p>
                <p className="mt-1 text-lg font-black">{selectedIds.size}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Position</p>
                <p className="mt-1 text-lg font-black">{hasLocation ? "OK" : "-"}</p>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-[#DDEBDD] bg-background p-5 shadow-sm dark:border-border dark:bg-card sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FAF1] text-primary dark:bg-primary/10">
                  <Store className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Identite boutique</p>
                  <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-card-foreground [font-family:var(--font-poppins)]">
                    Informations commerciales
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Nom de la boutique *</FieldLabel>
                  <input
                    required
                    minLength={2}
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Ex: Epicerie Al Baraka"
                    className="h-12 w-full rounded-2xl border border-[#DDEBDD] bg-background px-4 text-sm font-semibold text-[#264129] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-border dark:bg-card dark:text-foreground"
                  />
                </div>
                <div>
                  <FieldLabel>Telephone *</FieldLabel>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06XXXXXXXX"
                    className="h-12 w-full rounded-2xl border border-[#DDEBDD] bg-background px-4 text-sm font-semibold text-[#264129] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-border dark:bg-card dark:text-foreground"
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Adresse *</FieldLabel>
                  <input
                    required
                    minLength={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Adresse complete du point de collecte"
                    className="h-12 w-full rounded-2xl border border-[#DDEBDD] bg-background px-4 text-sm font-semibold text-[#264129] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-border dark:bg-card dark:text-foreground"
                  />
                </div>
                <div>
                  <FieldLabel>Ville</FieldLabel>
                  <input
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    placeholder="Ex: Fes"
                    className="h-12 w-full rounded-2xl border border-[#DDEBDD] bg-background px-4 text-sm font-semibold text-[#264129] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-border dark:bg-card dark:text-foreground"
                  />
                </div>
                <div>
                  <FieldLabel>Localisation *</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setMapboxModalOpen(true)}
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
                      hasLocation
                        ? "border-[#BFE2C4] bg-[#EAF8EC] text-primary"
                        : "border-primary bg-background text-primary hover:bg-[#F0FAF1] dark:bg-card"
                    )}
                  >
                    {hasLocation ? <CheckCircle2 className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
                    {hasLocation ? "Position confirmee" : "Me localiser"}
                  </button>
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Decrivez votre activite, vos specialites ou vos horaires de collecte."
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-[#DDEBDD] bg-background px-4 py-3 text-sm font-semibold text-[#264129] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-border dark:bg-card dark:text-foreground"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#DDEBDD] bg-background p-5 shadow-sm dark:border-border dark:bg-card sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FAF1] text-primary dark:bg-primary/10">
                    <Package className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Catalogue</p>
                    <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-card-foreground [font-family:var(--font-poppins)]">
                      Produits proposes
                    </h2>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-full px-3 py-1 text-xs font-black",
                    selectedIds.size === 0 ? "bg-red-50 text-red-600" : "bg-[#EAF8EC] text-primary"
                  )}
                >
                  {selectedIds.size} selectionne{selectedIds.size > 1 ? "s" : ""}
                </span>
              </div>

              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher un produit"
                  className="h-12 w-full rounded-2xl border border-[#DDEBDD] bg-muted/40 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/10 dark:border-border dark:bg-muted/30"
                />
              </div>

              {loadingProduits ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              ) : produits.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DDEBDD] bg-muted/35 px-4 py-8 text-center text-sm font-semibold text-muted-foreground dark:border-border">
                  Aucun produit disponible.
                </div>
              ) : filteredProduits.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DDEBDD] bg-muted/35 px-4 py-8 text-center text-sm font-semibold text-muted-foreground dark:border-border">
                  Aucun resultat pour cette recherche.
                </div>
              ) : (
                <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProduits.map((produit) => {
                    const selected = selectedIds.has(produit.id)
                    return (
                      <button
                        key={produit.id}
                        type="button"
                        onClick={() => toggleProduit(produit.id)}
                        className={cn(
                          "group flex min-h-20 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selected
                            ? "border-primary bg-[#EAF8EC] shadow-sm dark:bg-primary/10"
                            : "border-[#DDEBDD] bg-background hover:border-primary/35 hover:bg-[#F8FCF8] dark:border-border dark:bg-card dark:hover:bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            selected ? "bg-primary text-primary-foreground" : "bg-[#F0FAF1] text-primary"
                          )}
                        >
                          {selected ? <CheckCircle2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-[#264129] dark:text-card-foreground">
                            {produit.nom_fr}
                          </span>
                          <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {produit.unite}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-2xl border border-[#DDEBDD] bg-background p-5 shadow-sm dark:border-border dark:bg-card">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Resume</p>
              <h2 className="mt-1 text-xl font-black text-[#264129] dark:text-card-foreground [font-family:var(--font-poppins)]">
                Votre dossier
              </h2>

              <div className="mt-5 space-y-3">
                <SummaryItem icon={Store} label="Boutique" value={shopName || "Non renseignee"} />
                <SummaryItem icon={MapPin} label="Zone" value={ville || "Ville a confirmer"} />
                <SummaryItem icon={ClipboardList} label="Selection" value={`${selectedIds.size} produit(s)`} />
              </div>

              {hasLocation ? (
                <div className="mt-4 rounded-2xl border border-[#BFE2C4] bg-[#EAF8EC] px-4 py-3 text-sm text-[#176B2E]">
                  <p className="font-black">Point de collecte confirme</p>
                  <p className="mt-1 text-xs font-semibold">
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="font-black">Localisation requise</p>
                  <p className="mt-1 text-xs font-semibold">Elle permet de creer votre zone fournisseur.</p>
                </div>
              )}

              {selectedProducts.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Produits retenus
                  </p>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                    {selectedProducts.map((produit) => (
                      <button
                        key={produit.id}
                        type="button"
                        onClick={() => toggleProduit(produit.id)}
                        className="rounded-full bg-[#F0FAF1] px-3 py-1 text-xs font-bold text-primary transition hover:bg-[#EAF8EC]"
                      >
                        {produit.nom_fr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "Envoi en cours..." : "Envoyer ma demande"}
              </button>
            </section>
          </aside>
        </form>
      </div>

      <MapboxLocator
        isOpen={mapboxModalOpen}
        onClose={() => setMapboxModalOpen(false)}
        confirmSelection
        onAddressDetected={(detectedAddress, detectedCity, coordinates) => {
          setAddress(detectedAddress)
          setVille(detectedCity || ville)
          if (coordinates) {
            setLatitude(coordinates.latitude)
            setLongitude(coordinates.longitude)
          }
        }}
      />
    </main>
  )
}
