"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Copy, Gift, Link2, Loader2, MessageCircle, Share2, Truck, UserPlus, Wallet } from "lucide-react"

import { Navbar } from "@/components/souki/navbar"
import { useLocale } from "@/contexts/locale-context"
import { useAuth } from "@/hooks/useAuth"
import { generateParrainageCode, getMonParrainage, type MonParrainageDTO } from "@/lib/api"
import { cn } from "@/lib/utils"

type Copied = "code" | "link" | null

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  CONVERTI: { label: "Crédité", className: "bg-[#EAF8EC] text-[#1E8A3C]" },
  EN_ATTENTE: { label: "En attente de livraison", className: "bg-[#FFF4E5] text-[#9A5C11]" },
  REJETE: { label: "Non retenu", className: "bg-[#F4F4F1] text-[#6F6F6F]" },
}

function formatDh(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DH`
}

export default function ParrainagePage() {
  const { token } = useAuth()
  const { t, locale, zoneProps } = useLocale()
  const [data, setData] = useState<MonParrainageDTO | null>(null)
  const [error, setError] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState<Copied>(null)
  const [origin, setOrigin] = useState("")

  useEffect(() => setOrigin(window.location.origin), [])

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token) return
    try {
      setData(await getMonParrainage(token, signal))
      setError("")
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return
      setError(t("Impossible de charger votre parrainage. Réessayez dans un instant."))
    }
  }, [token, t])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const code = data?.code ?? null
  const credit = data?.credit_par_filleul ?? 0
  const link = code && origin ? `${origin}/login/client?ref=${code}` : ""
  const message = useMemo(
    () => (code ? t("Je fais mes courses sur SOUKI : les légumes du marché de gros de Fès, livrés à la maison. Inscris-toi avec mon code {code} : on reçoit chacun {credit} DH dès ta première commande livrée.", { code, credit }) : ""),
    [code, credit, t],
  )

  const flash = (kind: Copied) => {
    setCopied(kind)
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000)
  }

  const copy = async (value: string, kind: Copied) => {
    try {
      await navigator.clipboard.writeText(value)
      flash(kind)
    } catch {
      /* presse-papiers indisponible : rien a faire */
    }
  }

  const shareLink = async () => {
    if (!link) return
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "SOUKI", text: message, url: link })
      } catch {
        /* partage annule */
      }
      return
    }
    await copy(`${message} ${link}`, "link")
  }

  const createCode = async () => {
    if (!token) return
    setIsCreating(true)
    try {
      await generateParrainageCode(token)
      await load()
    } catch {
      setError(t("Impossible de créer votre code. Réessayez dans un instant."))
    } finally {
      setIsCreating(false)
    }
  }

  const whatsappHref = code ? `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}` : undefined
  const dateLocale = locale === "ar" ? "ar-MA" : "fr-FR"

  return (
    <div {...zoneProps} className="min-h-screen bg-[#FBFBF7] pb-28 md:pb-16">
      <Navbar />

      <main className="mx-auto w-full max-w-[1040px] px-4 pt-6 sm:px-6 md:pt-12">
        {/* ── Titre ── */}
        <header className="max-w-[40rem] animate-fade-in-up">
          <p className="inline-flex items-center gap-2 text-[13px] font-bold text-[#1E8A3C]">
            <Gift className="h-4 w-4" aria-hidden="true" />
            {t("Parrainage")}
          </p>
          <h1 className="mt-3 text-[clamp(1.85rem,4.4vw,2.9rem)] font-bold leading-[1.1] tracking-[-0.02em] text-[#14301B] text-balance">
            {t("Invitez un proche, gagnez {credit} DH chacun", { credit: data ? credit : "…" })}
          </h1>
          <p className="mt-3 text-[16px] leading-[1.65] text-[#5F6F61]">
            {t("Votre proche s'inscrit avec votre code. Dès sa première commande livrée, vous recevez chacun {credit} DH sur votre Wallet SOUKI.", { credit: data ? credit : "…" })}
          </p>
        </header>

        {error && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
            <button type="button" onClick={() => void load()} className="rounded-xl bg-white px-3 py-1.5 text-red-700 ring-1 ring-red-200 hover:bg-red-100">
              {t("Réessayer")}
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
          {/* ── Bon SOUKI : le code et les deux credits, detachables ── */}
          <section aria-label={t("Votre code")} className="animate-fade-in-up-delay-2">
            <div className="relative overflow-hidden rounded-[28px] bg-[#14301B] text-white shadow-[0_40px_80px_-46px_rgba(20,48,27,0.75)]">
              <div className="concept-grid absolute inset-0 opacity-25" aria-hidden="true" />
              <div className="relative grid sm:grid-cols-[1.35fr_1fr]">
                <div className="p-6 sm:p-7">
                  <p className="text-[13px] font-semibold text-white/60">{t("Bon SOUKI")}</p>
                  <p className="mt-1 text-sm font-semibold text-[#9FE0AB]">{t("Votre code")}</p>
                  {data === null && !error ? (
                    <div className="mt-3 h-12 w-48 rounded-xl bg-white/10" aria-label={t("Chargement…")} />
                  ) : code ? (
                    <p dir="ltr" className="mt-2 text-[2.6rem] font-black leading-none tracking-[0.18em] text-white sm:text-[3rem]">
                      {code}
                    </p>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm text-white/75">{t("Vous n'avez pas encore de code de parrainage.")}</p>
                      <button
                        type="button"
                        onClick={() => void createCode()}
                        disabled={isCreating}
                        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#F5C400] px-5 text-sm font-bold text-[#14301B] transition-transform active:scale-[0.97] disabled:opacity-60"
                      >
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        {isCreating ? t("Création…") : t("Créer mon code")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Pointilles de decoupe et encoches du ticket */}
                <div className="relative border-t-2 border-dashed border-white/20 sm:border-s-2 sm:border-t-0">
                  <span aria-hidden="true" className="absolute -top-3 start-[-0.75rem] h-6 w-6 rounded-full bg-[#FBFBF7] sm:hidden" />
                  <span aria-hidden="true" className="absolute -top-3 end-[-0.75rem] h-6 w-6 rounded-full bg-[#FBFBF7] sm:hidden" />
                  <span aria-hidden="true" className="absolute -top-3 start-[-0.8rem] hidden h-6 w-6 rounded-full bg-[#FBFBF7] sm:block" />
                  <span aria-hidden="true" className="absolute -bottom-3 start-[-0.8rem] hidden h-6 w-6 rounded-full bg-[#FBFBF7] sm:block" />
                  <dl className="grid h-full grid-cols-2 sm:grid-cols-1">
                    <div className="p-5 sm:px-6 sm:py-5">
                      <dt className="text-[13px] font-semibold text-white/60">{t("Pour vous")}</dt>
                      <dd className="mt-0.5 text-2xl font-black text-[#F5C400]">{data ? formatDh(credit) : "…"}</dd>
                    </div>
                    <div className="border-s border-white/10 p-5 sm:border-s-0 sm:border-t sm:px-6 sm:py-5">
                      <dt className="text-[13px] font-semibold text-white/60">{t("Pour votre proche")}</dt>
                      <dd className="mt-0.5 text-2xl font-black text-[#9FE0AB]">{data ? formatDh(credit) : "…"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {code && (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 text-sm font-bold text-white shadow-[0_14px_30px_-16px_rgba(30,138,60,0.7)] transition-transform hover:bg-[#176B2E] active:scale-[0.97] sm:col-span-3 lg:col-span-1"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  {t("Envoyer sur WhatsApp")}
                </a>
                <button
                  type="button"
                  onClick={() => void shareLink()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#D7E7D9] bg-white px-4 text-sm font-bold text-[#14301B] transition-transform hover:border-[#1E8A3C]/40 active:scale-[0.97]"
                >
                  {copied === "link" ? <Check className="h-4 w-4 text-[#1E8A3C]" /> : <Link2 className="h-4 w-4 text-[#1E8A3C]" />}
                  {copied === "link" ? t("Lien copié") : t("Partager le lien")}
                </button>
                <button
                  type="button"
                  onClick={() => void copy(code, "code")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#D7E7D9] bg-white px-4 text-sm font-bold text-[#14301B] transition-transform hover:border-[#1E8A3C]/40 active:scale-[0.97]"
                >
                  {copied === "code" ? <Check className="h-4 w-4 text-[#1E8A3C]" /> : <Copy className="h-4 w-4 text-[#1E8A3C]" />}
                  <span aria-live="polite">{copied === "code" ? t("Code copié") : t("Copier le code")}</span>
                </button>
              </div>
            )}

            {/* ── Compteurs ── */}
            <dl className="mt-6 grid grid-cols-3 gap-2.5">
              {[
                { label: t("Filleuls crédités"), value: data ? String(data.convertis) : "…" },
                { label: t("En attente de 1re livraison"), value: data ? String(data.en_attente) : "…" },
                { label: t("Gagné"), value: data ? formatDh(data.gains_total) : "…" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-[#E7EFE8] bg-white px-3 py-3.5 sm:px-4">
                  <dt className="text-[12px] font-semibold leading-snug text-[#5F6F61]">{stat.label}</dt>
                  <dd className="mt-1 text-xl font-black tabular-nums text-[#14301B] sm:text-2xl">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Fonctionnement : une vraie sequence, donc numerotee ── */}
          <section className="rounded-[28px] border border-[#E7EFE8] bg-white p-6 animate-fade-in-up-delay-3" aria-labelledby="parrainage-steps">
            <h2 id="parrainage-steps" className="text-lg font-bold text-[#14301B]">{t("Comment ça marche ?")}</h2>
            <ol className="mt-5 space-y-5">
              {[
                { icon: Share2, title: t("Partagez votre code"), text: t("Par WhatsApp, SMS ou de vive voix.") },
                { icon: UserPlus, title: t("Votre proche s'inscrit"), text: t("Il saisit votre code à la création de son compte.") },
                { icon: Truck, title: t("Première commande livrée"), text: t("{credit} DH arrivent sur vos deux Wallets SOUKI.", { credit: data ? credit : "…" }) },
              ].map((step, index) => (
                <li key={step.title} className="relative flex gap-4">
                  {index < 2 && <span aria-hidden="true" className="absolute start-5 top-11 h-[calc(100%-1.5rem)] w-px bg-[#DDEBDD]" />}
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF8EC] text-sm font-black text-[#1E8A3C]">
                    {index + 1}
                  </span>
                  <span className="pt-1">
                    <span className="flex items-center gap-2 text-[15px] font-bold text-[#14301B]">
                      <step.icon className="h-4 w-4 text-[#1E8A3C]" aria-hidden="true" />
                      {step.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-[#5F6F61]">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* ── Filleuls ── */}
          <section className="rounded-[28px] border border-[#E7EFE8] bg-white p-6" aria-labelledby="parrainage-filleuls">
            <h2 id="parrainage-filleuls" className="text-lg font-bold text-[#14301B]">{t("Vos filleuls")}</h2>
            {data === null ? (
              <div className="mt-4 space-y-2" aria-label={t("Chargement…")}>
                {[0, 1].map((index) => <div key={index} className="souki-skeleton h-14 rounded-2xl" />)}
              </div>
            ) : data.filleuls.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[#DDEBDD] px-4 py-6 text-center text-sm leading-relaxed text-[#5F6F61]">
                {t("Personne pour l'instant. Partagez votre code : le premier crédit arrive à sa première livraison.")}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[#EEF2EE]">
                {data.filleuls.map((filleul, index) => {
                  const status = STATUS_STYLES[filleul.statut] ?? STATUS_STYLES.REJETE
                  const date = filleul.created_at ? new Date(filleul.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long" }) : ""
                  return (
                    <li key={`${filleul.prenom}-${index}`} className="flex items-center justify-between gap-3 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F7F3] text-sm font-bold text-[#1E8A3C]">
                          {filleul.prenom.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-[#14301B]">
                            {filleul.prenom === "Un proche" ? t("Un proche") : filleul.prenom}
                          </span>
                          {date && <span className="block text-xs text-[#5F6F61]">{t("Inscrit le {date}", { date })}</span>}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", status.className)}>
                        {filleul.statut === "CONVERTI" && <Check className="me-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                        {t(status.label)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* ── Conditions ── */}
          <section className="rounded-[28px] border border-[#F1E4C8] bg-[#FFF9EB] p-6" aria-labelledby="parrainage-conditions">
            <h2 id="parrainage-conditions" className="text-lg font-bold text-[#14301B]">{t("Bon à savoir")}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#6E6142]">
              {[
                t("Le crédit arrive à la première commande livrée de votre proche, pas à l'inscription."),
                t("Un même numéro de téléphone ne peut pas se parrainer lui-même."),
                t("Jusqu'à {cap} filleuls crédités par compte.", { cap: data?.plafond_filleuls ?? "…" }),
                t("Votre crédit se déduit du montant à payer ; le reste se règle en cash à la livraison."),
                t("Commande refusée à la porte : le crédit offert utilisé est perdu, le trajet du livreur ayant déjà été payé. L'argent remboursé (réclamation, annulation) vous revient toujours."),
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#B07B00]" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <Link href="/wallet" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#14301B] ring-1 ring-[#F1E4C8] transition-colors hover:bg-[#FFF3D6]">
              <Wallet className="h-4 w-4 text-[#1E8A3C]" aria-hidden="true" />
              {t("Voir mon Wallet")}
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}
