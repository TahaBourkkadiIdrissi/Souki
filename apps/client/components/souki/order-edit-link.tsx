"use client"

import Link from "next/link"
import { Pencil } from "lucide-react"
import { useOrderLock } from "@/hooks/useOrderLock"
import type { CommandeHistoriqueDTO } from "@/lib/api"

export function OrderEditLink({ order }: { order: CommandeHistoriqueDTO }) {
  const { isLocked, deliveryDate } = useOrderLock()
  const mode = (order.mode_paiement || "").toLowerCase()
  const cod = ["cod", "cash", "especes", "especes_livraison", "cash_on_delivery"].includes(mode)
  if (isLocked || order.date_livraison !== deliveryDate ||
      !["EN_ATTENTE", "CONFIRMEE"].includes((order.statut || "").toUpperCase()) ||
      (!cod && mode !== "wallet") || (cod && (order.payment_validated || order.paiement?.valide))) return null
  return <Link href={`/commandes/${order.id}/modifier`}
    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#CFE6D2] bg-white px-4 text-sm font-bold text-[#176B2E] hover:bg-[#F0FAF1]">
    <Pencil className="h-4 w-4" aria-hidden="true" /> Modifier ou annuler
  </Link>
}
