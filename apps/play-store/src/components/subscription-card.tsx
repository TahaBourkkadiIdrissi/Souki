import type { ReactNode } from "react"
import { Alert, Pressable, View } from "react-native"
import { ActionSheet } from "@/components/action-sheet"
import { CalendarDays, Info, Repeat } from "lucide-react-native"
import {
  formatDeliveryDate,
  formatDirhams,
  formatVariation,
  frequencyLabel,
  isoDatePlusDays,
  RECURRENCE_STATUS_LABELS,
  resolveProductImage,
  type RecurrenceDTO,
  type SoukiBasketDTO,
} from "@souki/shared"

import { ThumbStack } from "@/components/checkout-parts"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, pauseRecurrence } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { palette, radius, shadows , scene, m3 } from "@/theme"

/** Nom affiche d'un abonnement : le panier SOUKI, ou la commande repetee. */
export function recurrenceName(item: RecurrenceDTO, baskets: SoukiBasketDTO[] | undefined, t: (french: string, vars?: Record<string, string | number>) => string, locale: string): string {
  if (item.type === "PANIER") {
    const basket = baskets?.find((entry) => entry.id === item.panier_souki_id)
    if (basket) return locale === "ar" && basket.nom_ar ? basket.nom_ar : basket.nom
    return t("Panier Souki")
  }
  return item.commande_origine_id ? t("Commande N-{id} répétée", { id: item.commande_origine_id }) : t("Commande récurrente")
}

export function recurrencePayment(item: Pick<RecurrenceDTO, "mode_paiement">, t: (french: string) => string): string {
  return item.mode_paiement === "wallet" ? t("Wallet SOUKI") : t("Paiement à la livraison")
}

/** Photos des lignes : celle de l'abonnement, sinon la photo du produit par son nom. */
export function recurrenceImages(item: RecurrenceDTO): string[] {
  return item.lignes.map((line) => line.image_url || resolveProductImage(line.nom_produit, null))
}

/** Teinte de l'etat (sk-sub-ok / sk-sub-wait / suspendue). */
function statusTone(status: string) {
  if (status === "ACTIVE") return { pill: palette.pale50, ink: palette.market700, icon: palette.souki900, iconInk: palette.white, next: palette.pale50, nextInk: palette.souki900 }
  if (status === "SUSPENDUE") return { pill: m3.errorContainer, ink: m3.onErrorContainer, icon: m3.error, iconInk: m3.onError, next: m3.errorContainer, nextInk: m3.onErrorContainer }
  return { pill: palette.orange50, ink: palette.orange700, icon: palette.orange500, iconInk: scene.ink900, next: palette.orange50, nextInk: palette.orange700 }
}

type SubscriptionCardProps = {
  item: RecurrenceDTO
  name: string
  actions?: ReactNode
  onPress: () => void
}

/**
 * Carte d'un abonnement (SubscriptionCard) : nom, rythme et paiement, etat, prochaine
 * livraison ou date de reprise, estimation au prix du jour, ecart de prix depuis la derniere
 * livraison. Aucune promesse d'economie : le montant exact est fixe a 01h00.
 */
export function SubscriptionCard({ item, name, actions, onPress }: SubscriptionCardProps) {
  const { t, dateLocale } = useLocale()
  const tone = statusTone(item.statut)
  const paused = item.statut === "EN_PAUSE"
  const date = formatDeliveryDate(paused ? item.pause_jusqu_au : item.prochaine_livraison, dateLocale) ?? "—"
  return (
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: tone.icon }}>
            <Repeat size={20} color={tone.iconInk} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="heavy" color={palette.ink900} numberOfLines={1} style={{ fontSize: 15 }}>
              {name}
            </Text>
            <Text variant="footnote" weight="semibold" color={palette.ink500} numberOfLines={1} style={{ fontSize: 12 }}>
              {`${t(frequencyLabel(item.frequence))} · ${recurrencePayment(item, t)}`}
            </Text>
          </View>
          <View style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center", backgroundColor: tone.pill }}>
            <Text variant="footnote" weight="heavy" color={tone.ink} style={{ fontSize: 12 }}>
              {t(RECURRENCE_STATUS_LABELS[item.statut] ?? item.statut)}
            </Text>
          </View>
        </View>
        {item.statut === "ARRETEE" ? null : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: tone.next }}>
            <CalendarDays size={16} color={tone.nextInk} strokeWidth={2.2} />
            <Text variant="footnote" weight="bold" color={tone.nextInk} style={{ flex: 1, fontSize: 13 }}>
              {paused ? t("En pause jusqu'au {date}", { date }) : t("Prochaine livraison : {date}", { date })}
            </Text>
            {!paused && item.total_estime > 0 ? (
              <Text variant="footnote" weight="black" numeric color={tone.nextInk} style={{ fontSize: 13 }}>
                {`≈ ${formatDirhams(item.total_estime)} DH`}
              </Text>
            ) : null}
          </View>
        )}
        {Math.abs(item.variation_prix) >= 0.01 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <Info size={14} color={palette.ink500} strokeWidth={2.2} />
            <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 12 }}>
              {t("Prix mis à jour :")}{" "}
              <Text variant="footnote" weight="heavy" numeric color={palette.orange700} style={{ fontSize: 12 }}>
                {formatVariation(item.variation_prix)}
              </Text>{" "}
              {t("depuis votre dernière livraison")}
            </Text>
          </View>
        ) : null}
        <ThumbStack images={recurrenceImages(item)} />
      </Pressable>
      {actions ? <View style={{ flexDirection: "row", gap: 8 }}>{actions}</View> : null}
    </View>
  )
}

/** Duree de pause proposee (le site accepte une reprise entre J+2 et J+90). */
const PAUSE_WEEKS = [1, 2, 3, 4]

/**
 * « Mettre en pause » : feuille d'actions iOS avec la date de reprise (1 a 4 semaines).
 * Aucune commande n'est creee pendant la pause.
 */
export function askPause(item: RecurrenceDTO, t: (french: string, vars?: Record<string, string | number>) => string, dateLocale: string, onDone: (next: RecurrenceDTO) => void) {
  const dates = PAUSE_WEEKS.map((weeks) => isoDatePlusDays(weeks * 7))
  const labels = dates.map((date, index) => t(PAUSE_WEEKS[index] === 1 ? "Reprendre le {date} (dans 1 semaine)" : "Reprendre le {date} (dans {n} semaines)", { date: formatDeliveryDate(date, dateLocale) ?? date, n: PAUSE_WEEKS[index] }))
  ActionSheet.showActionSheetWithOptions(
    { title: t("Mettre en pause"), message: t("Aucune commande n'est créée pendant la pause."), options: [...labels, t("Annuler")], cancelButtonIndex: labels.length },
    (index) => {
      if (index >= labels.length) return
      pauseRecurrence(item.id, dates[index])
        .then((next) => {
          haptics.success()
          onDone(next)
        })
        .catch((caught) => Alert.alert(t("Une erreur est survenue. Réessayez."), caught instanceof ApiError ? t(caught.message) : undefined))
    },
  )
}
