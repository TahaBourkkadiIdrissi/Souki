"use client"

import { useOrderCountdown } from "@/hooks/useOrderCountdown"
import { useOrderLock } from "@/hooks/useOrderLock"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

export function MarketStatus({ todayLabel }: { todayLabel: string }) {
  const { isLocked } = useOrderLock()
  return <span className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-2 pr-3 ring-1 ring-white/15">
    <span className={cn("h-2 w-2 rounded-full", isLocked ? "bg-[#F5C400]" : "bg-[#4CB84A]")} />
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#CDEBD6]">{isLocked ? "Livraison en préparation" : "Marché ouvert"} · {todayLabel}</span>
  </span>
}

export function MarketCountdown() {
  const cutoff = useOrderCountdown()
  return <>
    <div>
      <h2 className="text-[22px] font-black leading-tight text-white drop-shadow-sm">{cutoff?.closed ? "Le marché rouvre à 8h" : "Le marché ferme à 20h"}</h2>
      <p className="mt-1 max-w-[16rem] text-[13px] font-medium leading-snug text-[#D3EEDB]">{cutoff?.closed ? "Validation des commandes de 8h à 20h, heure du Maroc. Vous pouvez préparer votre panier." : "Commandez avant 20h, livré demain entre 8h et 15h — frais du marché de gros."}</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#A7D7B5]">{cutoff?.closed ? "Réouverture dans" : "Clôture dans"}</span>
      <span className="rounded-lg bg-white/15 px-3 py-1 text-[15px] font-black tabular-nums text-white">{cutoff ? `${pad(cutoff.hours)}:${pad(cutoff.minutes)}:${pad(cutoff.seconds)}` : "—"}</span>
    </div>
  </>
}
