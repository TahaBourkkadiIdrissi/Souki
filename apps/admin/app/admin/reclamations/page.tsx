"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Camera, ExternalLink, ImageOff, RefreshCw, ShieldAlert, UserRound, X } from "lucide-react"

import { FicheClientPanel, type ClientBlockKey } from "@/components/admin/client-fiche-panel"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/useAuth"
import {
  ApiError,
  getAdminClaimPhoto,
  getAdminClaims,
  getFicheClient,
  type AdminClaimDTO,
  type AdminClaimsOverviewDTO,
  type FicheClientDTO,
} from "@/lib/api"
import { cn } from "@/lib/utils"

/** Les 6 motifs du back-end (claim_service.py), comme dans l'app et le site. */
const REASONS: Record<string, string> = {
  abime: "Produit abîmé",
  poids_incorrect: "Poids incorrect",
  erreur_produit: "Erreur de produit",
  produit_manquant: "Produit manquant",
  qualite: "Qualité insuffisante",
  autre: "Autre problème",
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0 DH"
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DH`
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-"
  return value.toLocaleString("fr-FR")
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function formatQuantity(value: number, unit: string) {
  const number = value.toLocaleString("fr-FR", { maximumFractionDigits: 3 })
  return unit ? `${number} ${unit}` : number
}

function StatCard({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "green" }) {
  return (
    <div className={cn(
      "rounded-2xl border px-4 py-3",
      tone === "green" ? "border-transparent bg-[var(--adm-ink)] text-white" : "border-[var(--adm-line)] bg-white",
    )}>
      <p className={cn("text-xs font-medium", tone === "green" ? "text-white/65" : "text-[var(--adm-muted)]")}>{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "green" ? "text-white" : "text-[var(--adm-text)]")}>{value}</p>
    </div>
  )
}

function ReasonBadge({ reason }: { reason: string }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--adm-paper)] px-2.5 py-1 text-xs font-semibold text-[var(--adm-text)]">
      {REASONS[reason] ?? reason}
    </span>
  )
}

function FilterChip({ active, disabled, onClick, icon: Icon, children }: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: typeof ShieldAlert
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
        active
          ? "border-[var(--adm-saffron)] bg-[var(--adm-saffron)] text-white"
          : "border-[var(--adm-line)] bg-white text-[var(--adm-text)] hover:border-[var(--adm-saffron)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </button>
  )
}

type PhotoState = { claim: AdminClaimDTO; url: string | null; error: string; loading: boolean }

export default function AdminReclamationsPage() {
  const { token, can } = useAuth()
  const canSeeClients = can("clients.read")
  const [data, setData] = useState<AdminClaimsOverviewDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [suspectsOnly, setSuspectsOnly] = useState(false)
  const [photosOnly, setPhotosOnly] = useState(false)
  const [photo, setPhoto] = useState<PhotoState | null>(null)
  const [ficheId, setFicheId] = useState<number | null>(null)
  const [fiche, setFiche] = useState<FicheClientDTO | null>(null)
  const [ficheError, setFicheError] = useState("")
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({})

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      setData(await getAdminClaims(token, signal))
      setError("")
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les réclamations.")
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  // Lien signe de 5 minutes, demande a chaque ouverture : jamais garde dans la page.
  const openPhoto = async (claim: AdminClaimDTO) => {
    if (!token) return
    setPhoto({ claim, url: null, error: "", loading: true })
    try {
      const result = await getAdminClaimPhoto(token, claim.id)
      setPhoto({ claim, url: result.url, error: "", loading: false })
    } catch (photoError) {
      const message = photoError instanceof ApiError && photoError.status === 404
        ? "Aucune photo pour cette réclamation."
        : photoError instanceof Error ? photoError.message : "Photo indisponible pour le moment."
      setPhoto({ claim, url: null, error: message, loading: false })
    }
  }

  const openFiche = async (clientId: number) => {
    if (!token) return
    setFicheId(clientId)
    setFiche(null)
    setFicheError("")
    try {
      setFiche(await getFicheClient(token, clientId))
    } catch (loadError) {
      setFicheError(loadError instanceof Error ? loadError.message : "Impossible de charger la fiche client.")
    }
  }

  const toggleBlock = (clientId: number, blockKey: ClientBlockKey) => {
    const key = `${clientId}:${blockKey}`
    setOpenBlocks((current) => ({ ...current, [key]: !(current[key] ?? blockKey === "identity") }))
  }

  const suspectsCount = useMemo(() => data?.items.filter((item) => item.is_suspect).length ?? 0, [data])
  const photosCount = useMemo(() => data?.items.filter((item) => item.has_photo).length ?? 0, [data])
  const storageReadable = useMemo(() => (data?.items ?? []).every((item) => item.has_photo !== null), [data])
  const rows = useMemo(
    () => (data?.items ?? []).filter((item) => (!suspectsOnly || item.is_suspect) && (!photosOnly || item.has_photo)),
    [data, suspectsOnly, photosOnly],
  )

  return (
    <div>
      <div className="sticky top-16 z-30 border-b border-[var(--adm-line)] bg-[var(--adm-paper)]/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--adm-text)]">Réclamations</h1>
            <p className="text-sm text-[var(--adm-muted)]">Produits signalés par les clients, remboursés sur le Wallet, et leurs photos</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--adm-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--adm-text)] hover:border-[var(--adm-line-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4 text-[var(--adm-green)]", isLoading && "animate-spin")} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 lg:px-8">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--adm-danger)]">{error}</div>
        ) : null}

        {isLoading && !data ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Chargement">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="souki-skeleton h-[76px] rounded-2xl" />)}
          </div>
        ) : data ? (
          <>
            <section className="adm-stagger grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Réclamations (30 jours)" value={formatNumber(data.total_30j)} tone="green" />
              <StatCard label="Remboursé sur le Wallet (30 jours)" value={formatMoney(data.montant_30j)} />
              <StatCard label="Suspectes (30 jours)" value={formatNumber(data.suspects_30j)} />
              <StatCard label="Avec photo (30 jours)" value={formatNumber(data.avec_photo_30j)} />
            </section>

            <section className="rounded-2xl border border-[var(--adm-line)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--adm-text)]">Réclamations récentes</h2>
                  <p className="text-xs text-[var(--adm-muted)]">
                    100 dernières. Les photos sont privées : chaque ouverture crée un lien valable 5 minutes.
                    {storageReadable ? "" : " Présence des photos inconnue (stockage illisible) : « Photo » vérifie à la demande."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={suspectsOnly} disabled={!suspectsCount && !suspectsOnly} onClick={() => setSuspectsOnly((value) => !value)} icon={ShieldAlert}>
                    {suspectsOnly ? "Toutes les réclamations" : `À vérifier (${suspectsCount})`}
                  </FilterChip>
                  {storageReadable ? (
                    <FilterChip active={photosOnly} disabled={!photosCount && !photosOnly} onClick={() => setPhotosOnly((value) => !value)} icon={Camera}>
                      {photosOnly ? "Avec ou sans photo" : `Avec photo (${photosCount})`}
                    </FilterChip>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--adm-line)] text-left text-xs">
                      <th className="px-2 py-2 font-semibold">Date</th>
                      <th className="px-2 py-2 font-semibold">Commande</th>
                      <th className="px-2 py-2 font-semibold">Client</th>
                      <th className="px-2 py-2 font-semibold">Produit</th>
                      <th className="px-2 py-2 font-semibold">Motif</th>
                      <th className="px-2 py-2 text-right font-semibold">Quantité</th>
                      <th className="px-2 py-2 text-right font-semibold">Remboursé</th>
                      <th className="px-2 py-2 font-semibold">Indice</th>
                      <th className="px-2 py-2 font-semibold"><span className="sr-only">Photo</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--adm-line)]">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-2 py-8 text-center text-[var(--adm-muted)]">
                          {suspectsOnly || photosOnly ? "Aucune réclamation pour ce filtre." : "Aucune réclamation pour le moment."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((item) => (
                        <tr key={item.id} className={cn(item.is_suspect ? "bg-[var(--adm-saffron-soft)]/40" : "")}>
                          <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-[var(--adm-muted)]">{formatDateTime(item.created_at)}</td>
                          <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs font-semibold text-[var(--adm-text)]">N-{item.commande_id}</td>
                          <td className="px-2 py-2.5">
                            <div className="min-w-[140px]">
                              <p className="text-sm text-[var(--adm-text)]">{item.client_nom || "Client sans nom"}</p>
                              {canSeeClients ? (
                                <button type="button" onClick={() => void openFiche(item.client_id)} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--adm-green)] hover:underline">
                                  <UserRound className="h-3 w-3" aria-hidden="true" /> Fiche #{item.client_id}
                                </button>
                              ) : (
                                <p className="mt-0.5 text-xs text-[var(--adm-muted)]">Client #{item.client_id}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 font-semibold text-[var(--adm-text)]">{item.produit}</td>
                          <td className="px-2 py-2.5"><ReasonBadge reason={item.reason} /></td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-[var(--adm-text)]">{formatQuantity(item.quantity_claimed, item.unite)}</td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums text-[var(--adm-green)]">{formatMoney(item.amount_refunded)}</td>
                          <td className="px-2 py-2.5">
                            {item.is_suspect ? (
                              <span
                                title="Ce client a beaucoup réclamé ces 30 derniers jours (seuil du back-end). C'est un indice, pas une preuve."
                                className="inline-flex cursor-help items-center gap-1 rounded-full bg-[var(--adm-saffron-soft)] px-2 py-0.5 text-[11px] font-semibold text-[#9A5C11]"
                              >
                                <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Fréquent
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--adm-muted)]">Aucun</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            {item.has_photo === false ? (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[var(--adm-muted)]">
                                <ImageOff className="h-3.5 w-3.5" aria-hidden="true" /> Sans photo
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void openPhoto(item)}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--adm-line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--adm-text)] hover:border-[var(--adm-line-strong)]"
                              >
                                <Camera className="h-3.5 w-3.5 text-[var(--adm-green)]" /> Photo
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {/* Photo de la reclamation : lien signe de 5 minutes. */}
      <Dialog open={photo !== null} onOpenChange={(open) => { if (!open) setPhoto(null) }}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-[var(--adm-line)] bg-[var(--adm-paper)] p-0 sm:max-w-xl">
          <div className="flex items-center justify-between border-b border-[var(--adm-line)] px-5 py-3">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--adm-text)]">
                {photo ? `${photo.claim.produit} · N-${photo.claim.commande_id}` : "Photo"}
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--adm-muted)]">
                {photo ? `${REASONS[photo.claim.reason] ?? photo.claim.reason} · ${formatQuantity(photo.claim.quantity_claimed, photo.claim.unite)} · ${formatMoney(photo.claim.amount_refunded)} remboursés` : ""}
              </DialogDescription>
            </div>
            <button type="button" onClick={() => setPhoto(null)} aria-label="Fermer la photo" className="rounded-lg p-2 text-[var(--adm-muted)] hover:bg-white hover:text-[var(--adm-text)]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4">
            {photo?.loading ? (
              <div className="flex items-center gap-2 px-1 py-10 text-sm text-[var(--adm-muted)]">
                <Spinner className="size-4 text-[var(--adm-green)]" /> Chargement de la photo…
              </div>
            ) : photo?.error ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--adm-line)] px-4 py-8 text-sm text-[var(--adm-muted)]">
                <ImageOff className="h-4 w-4" aria-hidden="true" /> {photo.error}
              </div>
            ) : photo?.url ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- lien signe externe et ephemere */}
                <img
                  src={photo.url}
                  alt={`Photo envoyée par le client pour ${photo.claim.produit}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[70vh] w-full rounded-xl bg-white object-contain"
                />
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--adm-muted)]">
                  <span>Lien privé valable 5 minutes.</span>
                  <a href={photo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--adm-green)] hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Ouvrir en grand
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ficheId !== null} onOpenChange={(open) => { if (!open) setFicheId(null) }}>
        <DialogContent
          showCloseButton={false}
          className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-y-0 border-r-0 bg-[var(--adm-paper)] p-0 data-[state=open]:slide-in-from-right-8 data-[state=closed]:slide-out-to-right-8 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:max-w-2xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--adm-line)] bg-[var(--adm-paper)]/95 px-5 py-3 backdrop-blur">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--adm-text)]">Client #{ficheId}</DialogTitle>
              <DialogDescription className="text-xs text-[var(--adm-muted)]">Fiche complète, sans quitter les réclamations</DialogDescription>
            </div>
            <button type="button" onClick={() => setFicheId(null)} aria-label="Fermer la fiche" className="rounded-lg p-2 text-[var(--adm-muted)] hover:bg-white hover:text-[var(--adm-text)]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4">
            {ficheError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--adm-danger)]">{ficheError}</div>
            ) : fiche ? (
              <FicheClientPanel fiche={fiche} openBlocks={openBlocks} onToggleBlock={(blockKey) => toggleBlock(fiche.id, blockKey)} />
            ) : (
              <div className="flex items-center gap-2 px-1 py-6 text-sm text-[var(--adm-muted)]">
                <Spinner className="size-4 text-[var(--adm-green)]" /> Chargement de la fiche…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
