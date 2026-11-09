import { useCallback } from "react"
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Pause, Play, Repeat, SkipForward, SlidersHorizontal } from "lucide-react-native"
import { formatDirhams, resolveProductImage, type RecurrenceDTO } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { ThumbStack } from "@/components/checkout-parts"
import { Note } from "@/components/form-fields"
import { HowTo, LoyaltyCard } from "@/components/loyalty-parts"
import { recurrenceName, SubscriptionCard } from "@/components/subscription-card"
import { useDockInset } from "@/components/tab-bar"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useRecurrences, useSoukiBaskets, useUpdateRecurrenceCache } from "@/hooks/use-loyalty"
import { useRefresh } from "@/hooks/use-refresh"
import { ApiError, resumeRecurrence, skipRecurrence } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius, shadows } from "@/theme"

/**
 * Abonnements (EcranAbonnements, design system 2027) : sans gain ni perte, prix du site au
 * moment ou la commande est creee (01h00), memes regles qu'une commande. « Mes abonnements »
 * (Sauter, Pause ; Reprendre), « Paniers proposés » par SOUKI au prix du jour, « Comment ça marche ».
 */
export default function AbonnementsScreen() {
  const router = useRouter()
  const { t, locale, dateLocale, direction } = useLocale()
  const dockInset = useDockInset()
  const { status } = useAuth()
  const signedIn = status === "signedIn"
  const { recurrences, isLoading, refetch } = useRecurrences()
  const baskets = useSoukiBaskets()
  const updateCache = useUpdateRecurrenceCache()
  const refreshAll = useCallback(async () => {
    await Promise.all([refetch(), baskets.refetch()])
  }, [refetch, baskets])
  const { refreshing, onRefresh } = useRefresh(refreshAll)

  useFocusEffect(
    useCallback(() => {
      if (signedIn) void refetch()
    }, [signedIn, refetch]),
  )

  const run = (action: () => Promise<RecurrenceDTO>, success: string) => {
    action()
      .then((next) => {
        haptics.success()
        updateCache(next)
        Alert.alert(t(success))
      })
      .catch((caught) => Alert.alert(t("Une erreur est survenue. Réessayez."), caught instanceof ApiError ? t(caught.message) : undefined))
  }

  const subscribe = (basketId: number) => {
    if (!signedIn) return router.push("/connexion")
    router.push(`/abonner?panier=${basketId}`)
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ direction, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: dockInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.market600} />}
    >
      <Text variant="body" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
        {t("Vos courses reviennent toutes seules, au prix du jour, modifiables jusqu'à 01h00 la veille.")}
      </Text>

      {signedIn ? (
        <>
          <SectionTitle>{t("Mes abonnements")}</SectionTitle>
          {isLoading ? (
            <ActivityIndicator color={palette.market600} style={{ paddingVertical: 20 }} />
          ) : recurrences.length === 0 ? (
            <View style={{ gap: 10, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
              <Text variant="footnote" color={palette.ink500} style={{ fontSize: 14, lineHeight: 20 }}>
                {t("Vous n'avez pas encore d'abonnement. Dans « Recommander », touchez « Répéter automatiquement » pour recevoir une commande automatiquement.")}
              </Text>
              <BrandButton tone="soft" size="md" label={t("Voir mes commandes")} onPress={() => router.navigate("/commandes")} />
            </View>
          ) : (
            recurrences.map((item) => {
              const open = () => router.push(`/abonnement/${item.id}`)
              const actions =
                item.statut === "ACTIVE" ? (
                  <>
                    <Action tone="soft" icon={SkipForward} label={t("Sauter")} disabled={!item.modifiable} onPress={() => run(() => skipRecurrence(item.id), "Livraison sautée.")} />
                    <Action tone="soft" icon={Pause} label={t("Pause")} disabled={!item.modifiable} onPress={() => router.push(`/abonnement-pause/${item.id}`)} />
                  </>
                ) : item.statut === "EN_PAUSE" ? (
                  <>
                    <Action icon={Play} label={t("Reprendre")} disabled={!item.modifiable} onPress={() => run(() => resumeRecurrence(item.id), "Abonnement repris.")} />
                    <Action tone="soft" icon={SlidersHorizontal} label={t("Modifier")} onPress={open} />
                  </>
                ) : null
              return <SubscriptionCard key={item.id} item={item} name={recurrenceName(item, baskets.data, t, locale)} actions={actions} onPress={open} />
            })
          )}
        </>
      ) : null}

      <SectionTitle>{t("Paniers proposés")}</SectionTitle>
      <Text variant="footnote" color={palette.ink500} style={{ fontSize: 13, marginTop: -8 }}>
        {t("Composés par l'équipe SOUKI. Après l'abonnement, vous ajustez le contenu à votre goût.")}
      </Text>
      {baskets.isLoading ? (
        <ActivityIndicator color={palette.market600} style={{ paddingVertical: 20 }} />
      ) : baskets.isError && !baskets.data ? (
        <Note tone="red">{t("Impossible de charger les paniers proposés. Réessayez dans un instant.")}</Note>
      ) : (baskets.data ?? []).length === 0 ? (
        <Note>{t("Pas encore de panier proposé.")}</Note>
      ) : (
        (baskets.data ?? []).map((basket) => {
          const available = basket.lignes.filter((line) => line.disponible)
          const name = locale === "ar" && basket.nom_ar ? basket.nom_ar : basket.nom
          return (
            <View key={basket.id} style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ThumbStack images={available.map((line) => line.image_url || resolveProductImage(line.nom_produit, null))} />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={2} align="end" style={{ fontSize: 15 }}>
                    {name}
                  </Text>
                  <Text variant="footnote" color={palette.ink500} style={{ fontSize: 12 }}>
                    {t(available.length === 1 ? "{n} produit" : "{n} produits", { n: available.length })}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="callout" color={palette.ink700} style={{ fontSize: 15 }}>
                    {t("Au prix du jour")}
                  </Text>
                  <Text variant="footnote" color={palette.ink500} style={{ fontSize: 12 }}>
                    {basket.frais_livraison_estimes > 0
                      ? t("par livraison, dont {montant} DH de livraison", { montant: formatDirhams(basket.frais_livraison_estimes) })
                      : t("par livraison, livraison offerte")}
                  </Text>
                </View>
                <Text variant="title2" weight="black" numeric color={palette.souki900} style={{ fontSize: 22 }}>
                  {`${formatDirhams(basket.total_estime)} DH`}
                </Text>
              </View>
              <BrandButton icon={Repeat} label={t("S'abonner à ce panier")} onPress={() => subscribe(basket.id)} />
            </View>
          )
        })
      )}

      <LoyaltyCard title={t("Comment ça marche")}>
        <HowTo
          steps={[
            { title: t("Choisissez un panier ou une commande"), detail: t("Un panier SOUKI, ou « Répéter automatiquement » depuis une commande.") },
            { title: t("Créée à 01h00, au prix du jour"), detail: t("Livraison 15 DH, offerte dès 300 DH, comme une commande normale.") },
            { title: t("Vous gardez la main"), detail: t("Modifiez, sautez ou mettez en pause jusqu'à 01h00 la veille.") },
          ]}
        />
      </LoyaltyCard>
    </ScrollView>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" variant="title2" color={palette.ink900} style={{ fontSize: 21, marginTop: 6 }}>
      {children}
    </Text>
  )
}

function Action(props: React.ComponentProps<typeof BrandButton>) {
  return (
    <View style={{ flex: 1 }}>
      <BrandButton size="md" {...props} />
    </View>
  )
}
