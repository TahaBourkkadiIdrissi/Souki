"use client"

import { useOrderLock } from "@/hooks/useOrderLock"
import { formatDeliveryDate } from "@/lib/order-hours"

export function DeliveryPromise() {
  const { isLocked, deliveryDate } = useOrderLock()
  return <span suppressHydrationWarning>{isLocked
    ? "Commandes et modifications fermées. Réouverture à 8h."
    : `Livraison le ${formatDeliveryDate(deliveryDate)}, entre 8h et 15h.`}</span>
}
