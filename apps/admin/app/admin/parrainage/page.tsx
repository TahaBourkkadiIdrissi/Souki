"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  RefreshCw,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { getAdminParrainages, type ParrainageAdminOverviewDTO } from "@/lib/api"
import { cn } from "@/lib/utils"

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

function StatutBadge({ statut }: { statut: string }) {
  const value = (statut || "").toUpperCase()
  const map: Record<string, { label: string; className: string }> = {
    EN_ATTENTE: { label: "En attente", className: "border-amber-200 bg-amber-50 text-amber-700" },
    CONVERTI: { label: "Converti", className: "border-emerald-200 bg-[#F0FDF4] text-[#1E8A3C]" },
    REJETE: { label: "Rejeté", className: "border-red-200 bg-red-50 text-red-700" },
  }
  const cfg = map[value] || { label: statut, className: "border-gray-200 bg-gray-50 text-[#6B7280]" }
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", cfg.className)}>{cfg.label}</span>
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-white px-4 py-3 shadow-sm", accent ? "border-emerald-200 bg-[#F0FDF4]" : "border-[#E5E7EB]")}>
      <p className="text-xs font-semibold uppercase text-[#6B7280]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1F2937]">{value}</p>
    </div>
  )
}

export default function AdminParrainagePage() {
  const { token } = useAuth()
  const [data, setData] = useState<ParrainageAdminOverviewDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

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

  return (
    <div>

      <div className="flex">


        <main className="min-w-0 flex-1">
          <div className="sticky top-16 z-30 border-b border-[var(--adm-line)] bg-[var(--adm-paper)]/90 px-4 py-4 backdrop-blur-md lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Parrainage</h1>
                <p className="text-sm text-[#6B7280]">Suivi des parrainages et filleuls convertis</p>
              </div>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4 text-[#1E8A3C]", isLoading && "animate-spin")} />
                Actualiser
              </button>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4 lg:px-6">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
            ) : null}

            {isLoading && !data ? (
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                <RefreshCw className="h-4 w-4 animate-spin text-[#1E8A3C]" /> Chargement...
              </div>
            ) : data ? (
              <>
                <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                  <StatCard label="Filleuls convertis" value={formatNumber(data.convertis)} accent />
                  <StatCard label="En attente" value={formatNumber(data.en_attente)} />
                  <StatCard label="Taux de conversion" value={`${data.taux_conversion.toFixed(1)}%`} />
                  <StatCard label="Crédit distribué" value={formatMoney(data.credit_distribue)} />
                  <StatCard label="Total parrainages" value={formatNumber(data.total)} />
                </section>

                <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">Top parrains</h2>
                    <p className="text-xs text-[#6B7280]">Les meilleurs ambassadeurs</p>
                    <div className="mt-3 space-y-2">
                      {data.top_parrains.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-[#6B7280]">Aucun parrain converti pour le moment.</p>
                      ) : (
                        data.top_parrains.map((parrain, index) => (
                          <div key={parrain.parrain_id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E8A3C] text-xs font-bold text-white">{index + 1}</span>
                              <span className="font-mono text-sm text-[#1F2937]">{parrain.parrain_contact || `#${parrain.parrain_id}`}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#1E8A3C]">{formatNumber(parrain.filleuls_convertis)} filleuls</p>
                              <p className="text-xs text-[#6B7280]">{formatMoney(parrain.credit_genere)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <h2 className="text-base font-bold text-[#1F2937]">Parrainages récents</h2>
                    <p className="text-xs text-[#6B7280]">100 derniers</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-left text-xs uppercase text-[#6B7280]">
                            <th className="px-2 py-2 font-semibold">Code</th>
                            <th className="px-2 py-2 font-semibold">Parrain</th>
                            <th className="px-2 py-2 font-semibold">Filleul</th>
                            <th className="px-2 py-2 font-semibold">Statut</th>
                            <th className="px-2 py-2 text-right font-semibold">Crédit</th>
                            <th className="px-2 py-2 font-semibold">Inscrit</th>
                            <th className="px-2 py-2 font-semibold">Converti</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {data.recent.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-2 py-6 text-center text-[#6B7280]">Aucun parrainage pour le moment.</td>
                            </tr>
                          ) : (
                            data.recent.map((item) => (
                              <tr key={item.id}>
                                <td className="px-2 py-2 font-mono font-semibold text-[#1F2937]">{item.code_utilise}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{item.parrain_contact || `#${item.parrain_id}`}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{item.filleul_contact || `#${item.filleul_id}`}</td>
                                <td className="px-2 py-2"><StatutBadge statut={item.statut} /></td>
                                <td className="px-2 py-2 text-right font-bold text-[#1E8A3C]">{item.credit_total > 0 ? formatMoney(item.credit_total) : "-"}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{formatDate(item.created_at)}</td>
                                <td className="px-2 py-2 text-[#6B7280]">{formatDate(item.converted_at)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[#1E8A3C] hover:text-[#166d30]">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Retour au dashboard
                </Link>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
