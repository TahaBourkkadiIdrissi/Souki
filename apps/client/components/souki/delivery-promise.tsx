"use client"

import { useOrderLock } from "@/hooks/useOrderLock"
import { formatDeliveryDate } from "@/lib/order-hours"
import { useLocale } from "@/contexts/locale-context"

export function DeliveryPromise() {
  const { isLocked, deliveryDate } = useOrderLock()
  const { t, dateLocale } = useLocale()
  return <span suppressHydrationWarning>{isLocked
    ? t("Commandes et modifications fermées. Réouverture à 8h.")
    : t("Livraison le {date}, entre 8h et 15h.", { date: t(formatDeliveryDate(deliveryDate, dateLocale)) })}</span>
}
