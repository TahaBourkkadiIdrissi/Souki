import { DELIVERY_WINDOW, formatDeliveryDate, type OrderHours } from "@souki/shared"

import { useLocale } from "@/contexts/locale-context"

/** Promesse de livraison de la PWA (components/souki/delivery-promise.tsx). */
export function useDeliveryPromise(hours: OrderHours): string {
  const { t, dateLocale } = useLocale()
  if (hours.closed) return t("Commandes et modifications fermées. Réouverture à 8h.")
  const date = formatDeliveryDate(hours.deliveryDate, dateLocale)
  return date
    ? t("Livraison le {date}, entre {from}h et {to}h.", { date, from: DELIVERY_WINDOW.from, to: DELIVERY_WINDOW.to })
    : t("Livraison entre {from}h et {to}h à la date confirmée.", { from: DELIVERY_WINDOW.from, to: DELIVERY_WINDOW.to })
}
