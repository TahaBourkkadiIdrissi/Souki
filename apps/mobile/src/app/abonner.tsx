import { useState } from "react"
import { ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CircleCheck, Info, Repeat } from "lucide-react-native"
import { formatDeliveryDate, formatDirhams, frequencyLabel, type RecurrenceDTO, type RecurrenceFrequency, type RecurrencePayment } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Note } from "@/components/form-fields"
import { FrequencyPicker, Segmented } from "@/components/loyalty-parts"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useSoukiBaskets, useUpdateRecurrenceCache } from "@/hooks/use-loyalty"
import { useOrderWindow } from "@/hooks/use-orders"
import { ApiError, createRecurrenceFromBasket, createRecurrenceFromOrder } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette } from "@/theme"

/**
 * S'abonner (EcranAbonnements > S'abonner) ou « Répéter automatiquement » une commande, en
 * feuille native : les 4 rythmes du site, le paiement (panier SOUKI ; une commande repetee
 * garde son mode de paiement, comme sur le site), le prix d'aujourd'hui livraison comprise,
 * et ce qu'on peut changer jusqu'a 01h00 la veille. Fermee de 01h a 08h, comme sur le site.
 */
export default function AbonnerSheet() {
  const router = useRouter()
  const { t, locale, dateLocale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { panier, commande } = useLocalSearchParams<{ panier?: string; commande?: string }>()
  const baskets = useSoukiBaskets()
  const updateCache = useUpdateRecurrenceCache()
  const { closed } = useOrderWindow()
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("HEBDOMADAIRE")
  const [payment, setPayment] = useState<RecurrencePayment>("cod")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<RecurrenceDTO | null>(null)

  const basket = panier ? baskets.data?.find((entry) => entry.id === Number(panier)) : undefined
  const orderId = commande ? Number(commande) : null
  const basketName = basket ? (locale === "ar" && basket.nom_ar ? basket.nom_ar : basket.nom) : ""
  const title = orderId ? t("Répéter la commande N-{id}", { id: orderId }) : t("S'abonner à « {nom} »", { nom: basketName })

  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const next = orderId ? await createRecurrenceFromOrder(orderId, { frequence: frequency }) : await createRecurrenceFromBasket(Number(panier), { frequence: frequency, mode_paiement: payment })
      haptics.success()
      updateCache(next)
      setCreated(next)
    } catch (caught) {
      haptics.error()
      setError(caught instanceof ApiError ? t(caught.message) : t("Une erreur est survenue. Réessayez."))
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, direction, padding: 20, paddingTop: 28, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 10, padding: 16, borderRadius: 18, backgroundColor: palette.pale50 }}>
          <CircleCheck size={20} color={palette.market700} strokeWidth={2.4} />
          <Text variant="callout" weight="semibold" color={palette.souki900} style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
            {t("C'est fait. {frequence}, prochaine livraison {date} (environ {montant}).", {
              frequence: t(frequencyLabel(created.frequence)),
              date: formatDeliveryDate(created.prochaine_livraison, dateLocale) ?? created.prochaine_livraison,
              montant: `${formatDirhams(created.total_estime)} DH`,
            })}
          </Text>
        </View>
        <BrandButton
          label={t("Gérer mes abonnements")}
          onPress={() => {
            router.back()
            router.navigate("/abonnements")
          }}
        />
        <BrandButton tone="ghost" label={t("Fermer")} onPress={() => router.back()} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 12 }}>
        <Text accessibilityRole="header" variant="title2" weight="black" color={palette.ink900} style={{ fontSize: 22, lineHeight: 28 }}>
          {title}
        </Text>
        {orderId ? (
          <Text variant="footnote" color={palette.ink500} style={{ fontSize: 13, marginTop: -4 }}>
            {t("Elle sera recréée automatiquement, sans rien refaire.")}
          </Text>
        ) : null}
        <Text variant="footnote" weight="bold" color={palette.ink500} style={{ fontSize: 13 }}>
          {t("À quel rythme ?")}
        </Text>
        <FrequencyPicker value={frequency} onChange={setFrequency} />
        {orderId ? null : (
          <>
            <Text variant="footnote" weight="bold" color={palette.ink500} style={{ fontSize: 13 }}>
              {t("Paiement")}
            </Text>
            <Segmented
              value={payment}
              onChange={setPayment}
              options={[
                { value: "cod", label: t("À la livraison") },
                { value: "wallet", label: t("Wallet SOUKI") },
              ]}
            />
          </>
        )}
        {basket ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, borderCurve: "continuous", backgroundColor: palette.souki900 }}>
            <View style={{ width: 52, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.white }}>
              <Text variant="eyebrow" color={palette.orange700} style={{ fontSize: 10 }}>
                ≈
              </Text>
              <Text variant="callout" weight="black" numeric color={palette.souki900} style={{ fontSize: 15 }}>
                {formatDirhams(basket.total_estime)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="callout" weight="heavy" color={palette.white} style={{ fontSize: 15 }}>
                {t("Aujourd'hui, ce panier coûterait {montant} DH", { montant: formatDirhams(basket.total_estime) })}
              </Text>
              <Text variant="footnote" color={palette.mint300} style={{ fontSize: 12, lineHeight: 16 }}>
                {t("Livraison comprise. Chaque commande est créée à 01h00 au prix du jour.")}
              </Text>
            </View>
          </View>
        ) : (
          <Note icon={Repeat}>{t("Chaque commande est créée à 01h00 au prix du jour, livraison comprise.")}</Note>
        )}
        <Note icon={Info}>{t("Vous pourrez modifier le contenu, sauter une livraison ou arrêter jusqu'à 01h00 la veille.")}</Note>
        {error ? <Note tone="red">{error}</Note> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }}>
        <BrandButton
          icon={Repeat}
          label={closed ? t("Disponible dès 8h") : saving ? t("Enregistrement…") : t("Confirmer l'abonnement")}
          disabled={closed || saving || (!orderId && !basket)}
          onPress={() => void confirm()}
        />
      </View>
    </View>
  )
}
