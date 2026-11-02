"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Eye, EyeOff, Home, RefreshCw, ShieldAlert, UserRound, Wifi, X } from "lucide-react"
import { toast } from "sonner"

import { FicheClientPanel, type ClientBlockKey } from "@/components/admin/client-fiche-panel"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/useAuth"
import {
  getAdminParrainages,
  getFicheClient,
  revealParrainageContacts,
  type FicheClientDTO,
  type ParrainageAdminOverviewDTO,
  type ParrainageContactsDTO,
  type ParrainageSignal,
} from "@/lib/api"
import { cn } from "@/lib/utils"

// Les numeros affiches en clair redeviennent masques apres ce delai.
const REVEAL_DURATION_MS = 60_000

const SIGNALS: Record<ParrainageSignal, { label: string; help: string; icon: typeof Home }> = {
  MEME_ADRESSE: { label: "Même adresse", help: "Le parrain et le filleul ont une adresse à moins de 30 m. Normal pour une famille, suspect pour des inconnus.", icon: Home },
  MEME_CONNEXION: { label: "Même connexion", help: "Le filleul s'est inscrit depuis une IP déjà utilisée par le parrain. Les opérateurs mobiles partagent parfois une IP : c'est un indice, pas une preuve.", icon: Wifi },
  IP_PARTAGEE: { label: "IP partagée", help: "Plusieurs filleuls de ce parrain se sont inscrits depuis la même IP.", icon: ShieldAlert },
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0 DH"
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DH`
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0"
  return value.toLocaleString("fr-FR")
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** +212612345678 -> 06 12 34 56 78 ; un e-mail reste tel quel. */
function formatContact(value: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, "")
  const national = digits.startsWith("212") && digits.length === 12 ? `0${digits.slice(3)}` : digits
  return national.length === 10 && !value.includes("@") ? national.replace(/(\d{2})(?=\d)/g, "$1 ") : value
}

function StatutBadge({ statut }: { statut: string }) {
  const value = (statut || "").toUpperCase()
  const map: Record<string, { label: string; className: string }> = {
    EN_ATTENTE: { label: "En attente", className: "bg-[var(--adm-saffron-soft)] text-[#9A5C11]" },
    CONVERTI: { label: "Converti", className: "bg-[var(--adm-green-soft)] text-[var(--adm-green)]" },
    REJETE: { label: "Rejeté", className: "bg-red-50 text-[var(--adm-danger)]" },
  }
  const cfg = map[value] || { label: statut, className: "bg-gray-100 text-[var(--adm-muted)]" }
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", cfg.className)}>{cfg.label}</span>
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

function SignalChips({ signaux }: { signaux: ParrainageSignal[] }) {
  if (!signaux.length) return <span className="text-xs text-[var(--adm-muted)]">Aucun</span>
  return (
    <div className="flex flex-wrap gap-1">
      {signaux.map((code) => {
        const signal = SIGNALS[code]
        if (!signal) return null
        return (
          <span key={code} title={signal.help} className="inline-flex cursor-help items-center gap-1 rounded-full bg-[var(--adm-saffron-soft)] px-2 py-0.5 text-[11px] font-semibold text-[#9A5C11]">
            <signal.icon className="h-3 w-3" aria-hidden="true" />
            {signal.label}
          </span>
        )
      })}
    </div>
  )
}

/** Personne d'un parrainage : contact masque ou revele, et acces a sa fiche. */
function PersonCell({ id, masked, revealed, canOpenFiche, onOpenFiche }: {
  id: number
  masked: string | null
  revealed: string | null | undefined
  canOpenFiche: boolean
  onOpenFiche: (id: number) => void
}) {
  const shown = revealed !== undefined ? formatContact(revealed) : masked
  return (
    <div className="min-w-[150px]">
      <p className={cn(
        "whitespace-nowrap text-sm tabular-nums transition-colors duration-300",
        revealed !== undefined ? "font-semibold text-[var(--adm-text)]" : "text-[var(--adm-muted)]",
      )}>
        {shown || "Sans contact"}
      </p>
      {canOpenFiche ? (
        <button type="button" onClick={() => onOpenFiche(id)} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--adm-green)] hover:underline">
          <UserRound className="h-3 w-3" aria-hidden="true" /> Fiche #{id}
        </button>
      ) : (
        <p className="mt-0.5 text-xs text-[var(--adm-muted)]">Client #{id}</p>
      )}
    </div>
  )
}

export default function AdminParrainagePage() {
  const { token, can } = useAuth()
  const canSeeClients = can("clients.read")
  const [data, setData] = useState<ParrainageAdminOverviewDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [suspectsOnly, setSuspectsOnly] = useState(false)
  const [revealed, setRevealed] = useState<Record<number, ParrainageContactsDTO>>({})
  const [revealingId, setRevealingId] = useState<number | null>(null)
  const hideTimers = useRef<Record<number, number>>({})
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
      const result = await getAdminParrainages(token, signal)
      setData(result)
      setError("")
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les parrainages.")
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  useEffect(() => {
    const timers = hideTimers.current
    return () => Object.values(timers).forEach((timer) => window.clearTimeout(timer))
  }, [])

  const hide = useCallback((id: number) => {
    window.clearTimeout(hideTimers.current[id])
    delete hideTimers.current[id]
    setRevealed((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])

  const reveal = async (id: number) => {
    if (!token) return
    setRevealingId(id)
    try {
      const contacts = await revealParrainageContacts(token, id)
      setRevealed((current) => ({ ...current, [id]: contacts }))
      window.clearTimeout(hideTimers.current[id])
      hideTimers.current[id] = window.setTimeout(() => hide(id), REVEAL_DURATION_MS)
    } catch (revealError) {
      toast.error(revealError instanceof Error ? revealError.message : "Impossible d'afficher les numéros.")
    } finally {
      setRevealingId(null)
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

  const suspectsCount = useMemo(() => data?.recent.filter((item) => item.signaux?.length).length ?? 0, [data])
  const rows = useMemo(
    () => (data?.recent ?? []).filter((item) => !suspectsOnly || item.signaux?.length),
    [data, suspectsOnly],
  )

  return (
    <div>
      <div className="sticky top-16 z-30 border-b border-[var(--adm-line)] bg-[var(--adm-paper)]/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--adm-text)]">Parrainage</h1>
            <p className="text-sm text-[var(--adm-muted)]">Suivi des parrainages, des crédits et des inscriptions suspectes</p>
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
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Chargement">
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className="souki-skeleton h-[76px] rounded-2xl" />)}
          </div>
        ) : data ? (
          <>
            <section className="adm-stagger grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Filleuls convertis" value={formatNumber(data.convertis)} tone="green" />
              <StatCard label="En attente" value={formatNumber(data.en_attente)} />
              <StatCard label="Taux de conversion" value={`${data.taux_conversion.toFixed(1)} %`} />
              <StatCard label="Crédit distribué" value={formatMoney(data.credit_distribue)} />
              <StatCard label="Total parrainages" value={formatNumber(data.total)} />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
              <div className="rounded-2xl border border-[var(--adm-line)] bg-white p-4">
                <h2 className="text-base font-semibold text-[var(--adm-text)]">Meilleurs parrains</h2>
                <p className="text-xs text-[var(--adm-muted)]">Classés par filleuls convertis</p>
                <ol className="mt-3 space-y-1.5">
                  {data.top_parrains.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-[var(--adm-line)] px-3 py-4 text-sm text-[var(--adm-muted)]">Aucun parrain converti pour le moment.</li>
                  ) : (
                    data.top_parrains.map((parrain, index) => (
                      <li key={parrain.parrain_id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--adm-paper)] px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            index === 0 ? "bg-[var(--adm-saffron)] text-white" : "bg-white text-[var(--adm-text)]",
                          )}>{index + 1}</span>
                          <PersonCell
                            id={parrain.parrain_id}
                            masked={parrain.parrain_contact}
                            revealed={undefined}
                            canOpenFiche={canSeeClients}
                            onOpenFiche={(id) => void openFiche(id)}
                          />
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-[var(--adm-green)]">{formatNumber(parrain.filleuls_convertis)} filleuls</p>
                          <p className="text-xs tabular-nums text-[var(--adm-muted)]">{formatMoney(parrain.credit_genere)}</p>
                        </div>
                      </li>
                    ))
                  )}
                </ol>
              </div>

              <div className="rounded-2xl border border-[var(--adm-line)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--adm-text)]">Parrainages récents</h2>
                    <p className="text-xs text-[var(--adm-muted)]">
                      100 derniers. Numéros masqués par défaut{canSeeClients ? " ; « Afficher » les révèle 1 minute et l'action est journalisée." : "."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuspectsOnly((value) => !value)}
                    aria-pressed={suspectsOnly}
                    disabled={!suspectsCount && !suspectsOnly}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
                      suspectsOnly
                        ? "border-[var(--adm-saffron)] bg-[var(--adm-saffron)] text-white"
                        : "border-[var(--adm-line)] bg-white text-[var(--adm-text)] hover:border-[var(--adm-saffron)]",
                    )}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    {suspectsOnly ? "Voir tous les parrainages" : `À vérifier (${suspectsCount})`}
                  </button>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--adm-line)] text-left text-xs">
                        <th className="px-2 py-2 font-semibold">Code</th>
                        <th className="px-2 py-2 font-semibold">Parrain</th>
                        <th className="px-2 py-2 font-semibold">Filleul</th>
                        <th className="px-2 py-2 font-semibold">Indices</th>
                        <th className="px-2 py-2 font-semibold">Statut</th>
                        <th className="px-2 py-2 text-right font-semibold">Crédit</th>
                        <th className="px-2 py-2 font-semibold">Inscrit</th>
                        <th className="px-2 py-2 font-semibold">Converti</th>
                        {canSeeClients && <th className="px-2 py-2 font-semibold"><span className="sr-only">Numéros</span></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-line)]">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={canSeeClients ? 9 : 8} className="px-2 py-8 text-center text-[var(--adm-muted)]">
                            {suspectsOnly ? "Aucun parrainage à vérifier." : "Aucun parrainage pour le moment."}
                          </td>
                        </tr>
                      ) : (
                        rows.map((item) => {
                          const contacts = revealed[item.id]
                          return (
                            <tr key={item.id} className={cn(item.signaux?.length ? "bg-[var(--adm-saffron-soft)]/40" : "")}>
                              <td className="px-2 py-2.5 font-mono text-xs font-semibold text-[var(--adm-text)]">{item.code_utilise}</td>
                              <td className="px-2 py-2.5">
                                <PersonCell id={item.parrain_id} masked={item.parrain_contact} revealed={contacts?.parrain_contact}
                                  canOpenFiche={canSeeClients} onOpenFiche={(id) => void openFiche(id)} />
                              </td>
                              <td className="px-2 py-2.5">
                                <PersonCell id={item.filleul_id} masked={item.filleul_contact} revealed={contacts?.filleul_contact}
                                  canOpenFiche={canSeeClients} onOpenFiche={(id) => void openFiche(id)} />
                              </td>
                              <td className="px-2 py-2.5"><SignalChips signaux={item.signaux ?? []} /></td>
                              <td className="px-2 py-2.5"><StatutBadge statut={item.statut} /></td>
                              <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-[var(--adm-green)]">{item.credit_total > 0 ? formatMoney(item.credit_total) : "-"}</td>
                              <td className="px-2 py-2.5 tabular-nums text-[var(--adm-muted)]">{formatDate(item.created_at)}</td>
                              <td className="px-2 py-2.5 tabular-nums text-[var(--adm-muted)]">{formatDate(item.converted_at)}</td>
                              {canSeeClients && (
                                <td className="px-2 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => (contacts ? hide(item.id) : void reveal(item.id))}
                                    disabled={revealingId === item.id}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--adm-line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--adm-text)] hover:border-[var(--adm-line-strong)] disabled:opacity-60"
                                  >
                                    {revealingId === item.id ? <Spinner className="size-3.5" /> : contacts ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    {contacts ? "Masquer" : "Afficher"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <Dialog open={ficheId !== null} onOpenChange={(open) => { if (!open) setFicheId(null) }}>
        <DialogContent
          showCloseButton={false}
          className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-y-0 border-r-0 bg-[var(--adm-paper)] p-0 data-[state=open]:slide-in-from-right-8 data-[state=closed]:slide-out-to-right-8 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:max-w-2xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--adm-line)] bg-[var(--adm-paper)]/95 px-5 py-3 backdrop-blur">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--adm-text)]">Client #{ficheId}</DialogTitle>
              <DialogDescription className="text-xs text-[var(--adm-muted)]">Fiche complète, sans quitter le parrainage</DialogDescription>
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
