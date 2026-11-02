"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { CheckCircle2, Repeat } from "lucide-react"

import { Sheet } from "@/components/souki/pwa/sheet"
import { useOrderLock } from "@/hooks/useOrderLock"
import { ApiError, creerCommandeRecurrente, type CommandeRecurrenteDTO, type FrequenceRecurrente } from "@/lib/api"
import { FREQUENCES_RECURRENTES, formatDateCourte, formatDh, frequenceLabel } from "@/lib/commandes-recurrentes"
import { cn } from "@/lib/utils"

export function RepeatOrderButton({ orderId, variant = "outline" }: { orderId: number; variant?: "outline" | "solid" }) {
  const { isLocked, message } = useOrderLock()
  const [open, setOpen] = useState(false)
  const [frequence, setFrequence] = useState<FrequenceRecurrente>("HEBDOMADAIRE")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<CommandeRecurrenteDTO | null>(null)

  const close = () => {
    setOpen(false)
    setError("")
  }

  const confirm = async () => {
    setBusy(true)
    setError("")
    try {
      setCreated(await creerCommandeRecurrente(orderId, { frequence }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de répéter cette commande pour le moment.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isLocked}
        title={isLocked ? message : undefined}
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          variant === "solid"
            ? "bg-[#1E8A3C] text-white hover:bg-[#176B2E]"
            : "border border-[#F5D7B8] bg-white text-[#C26100] hover:bg-[#FFF7EE]",
        )}
      >
        <Repeat className="h-4 w-4" aria-hidden="true" /> Répéter cette commande
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <Sheet open={open} onClose={close} title="Répéter cette commande"
          subtitle="Elle sera recréée automatiquement, sans rien refaire.">
          {created ? (
            <div className="space-y-4 pb-2">
              <div className="flex items-start gap-3 rounded-2xl border border-[#BFE6C4] bg-[#EAF8EC] p-4 text-sm text-[#1E8A3C]">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="font-semibold">
                  C&apos;est fait. {frequenceLabel(created.frequence)}, prochaine livraison {formatDateCourte(created.prochaine_livraison)}
                  {" "}(environ {formatDh(created.total_estime)}).
                </p>
              </div>
              <Link href="/abonnements#mes-abonnements"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#1E8A3C] px-5 text-sm font-bold text-white">
                Gérer mes abonnements
              </Link>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-bold text-[#264129]">À quel rythme ?</legend>
                {FREQUENCES_RECURRENTES.map((option) => (
                  <label key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-sm",
                      frequence === option.value ? "border-[#1E8A3C] bg-[#F0FAF1]" : "border-[#E6F0E7] bg-white",
                    )}>
                    <span>
                      <span className="block font-bold text-[#264129]">{option.label}</span>
                      <span className="block text-xs text-[#6F8070]">{option.detail}</span>
                    </span>
                    <input type="radio" name={`frequence-${orderId}`} value={option.value}
                      checked={frequence === option.value} onChange={() => setFrequence(option.value)}
                      className="h-4 w-4 accent-[#1E8A3C]" />
                  </label>
                ))}
              </fieldset>
              <ul className="space-y-1 rounded-2xl bg-[#F7FCF7] p-4 text-xs leading-5 text-[#5F735F]">
                <li>Les prix sont ceux du site au moment où la commande est créée.</li>
                <li>Livraison 15 DH, offerte dès 300 DH, comme une commande normale.</li>
                <li>Vous pouvez modifier, sauter ou arrêter jusqu&apos;à 01h00 la veille.</li>
              </ul>
              {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
              <button type="button" onClick={() => void confirm()} disabled={busy || isLocked}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#F07C00] px-5 text-sm font-bold text-white disabled:opacity-60">
                {busy ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          )}
        </Sheet>,
        document.body,
      )}
    </>
  )
}
