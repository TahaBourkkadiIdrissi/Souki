import { useCallback, useState } from "react"
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, View } from "react-native"
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MessageCircle, Phone, RefreshCw, ShieldCheck, ShoppingBasket, SlidersHorizontal, TriangleAlert } from "lucide-react-native"
import {
  canClaimOrder,
  canManageOrder,
  formatDeliveryDate,
  formatDirhams,
  formatOrderDay,
  formatOrderMoment,
  formatQuantity,
  isCodPayment,
  isOrderFinished,
  normalizeOrderStatus,
  productName,
  SOUKI_PHONE_DISPLAY,
  soukiCallUrl,
  soukiWhatsAppUrl,
} from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { BrandEmptyState } from "@/components/brand-empty-state"
import { CheckoutCard, ThumbStack } from "@/components/checkout-parts"
import { Note } from "@/components/form-fields"
import { InfoGrid, OrderTrack } from "@/components/order-parts"
import { ProductImage } from "@/components/product-image"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { orderImages, orderLineImage, useOrder, useOrderWindow } from "@/hooks/use-orders"
import { useRefresh } from "@/hooks/use-refresh"
import { haptics } from "@/lib/haptics"
import { colors, palette } from "@/theme"

/**
 * Suivi de commande (EcranCommandes > Suivi, design system 2027) : le camion sur le « S »
 * avec les 4 etapes et leurs heures, les informations et les produits. Livree : rappel de la
 * reclamation sous 24 h, « Recommander » et « Signaler un problème ». Rafraichi au retour sur
 * l'ecran, en tirant la liste et par le bouton en haut.
 */
export default function SuiviScreen() {
  const router = useRouter()
  const { t, locale, dateLocale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const orderId = Number(id)
  const { order, isLoading, refetch } = useOrder(orderId)
  const { productsById } = useCatalogue()
  const orderWindow = useOrderWindow()
  const { refreshing, onRefresh } = useRefresh(refetch)
  const [showAll, setShowAll] = useState(false)

  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  const header = (
    <Stack.Screen
      options={{
        title: t("Suivi de commande"),
        headerRight: () => (
          <Pressable
            onPress={() => {
              haptics.selection()
              void refetch()
            }}
            accessibilityRole="button"
            accessibilityLabel={t("Actualiser")}
            hitSlop={8}
            style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <RefreshCw size={20} color={palette.souki900} strokeWidth={2.4} />
          </Pressable>
        ),
      }}
    />
  )

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        {isLoading ? (
          <View style={{ paddingTop: 120, alignItems: "center" }}>
            <ActivityIndicator color={palette.market600} />
          </View>
        ) : (
          <BrandEmptyState
            art="orders"
            title={t("Commande introuvable")}
            description={t("Cette commande est introuvable dans votre compte.")}
            action={{ label: t("Voir mes commandes"), onPress: () => router.back() }}
          />
        )}
      </View>
    )
  }

  const status = normalizeOrderStatus(order.statut)
  const delivered = status === "LIVRE"
  const finished = isOrderFinished(status)
  const claimable = canClaimOrder(order)
  const manageable = canManageOrder(order, orderWindow.deliveryDate, orderWindow.closed)
  const reorderable = finished && !["ANNULE", "ANNULEE", "REFUS"].includes(status)
  const heure = (order.creneau_livraison ?? "").replace(":", "h")
  const delivery = formatDeliveryDate(order.date_livraison, dateLocale)
  const date = delivered
    ? t("Livrée le {date}", { date: formatOrderDay(order.delivered_at, dateLocale, true) ?? "" })
    : delivery
      ? t("{date}, vers {heure}", { date: delivery.charAt(0).toUpperCase() + delivery.slice(1), heure })
      : null
  const times = [formatOrderMoment(order.date_commande, dateLocale), null, formatOrderMoment(order.enroute_at, dateLocale), formatOrderMoment(order.delivered_at, dateLocale)]
  const payment = (order.mode_paiement || "").toLowerCase() === "wallet" ? t("Wallet SOUKI") : isCodPayment(order.mode_paiement) ? t("À la livraison") : t(order.mode_paiement || "—")
  const commandedOn = formatOrderDay(order.date_commande, dateLocale)
  // Incident de livraison : le message du site invite a contacter l'equipe (E14).
  const needsContact = ["ABSENT", "REFUS", "RETOUR_DEPOT"].includes(status)

  const actions: React.ReactNode[] = []
  if (!finished && manageable) actions.push(<BrandButton key="g" tone="soft" icon={SlidersHorizontal} label={t("Gérer ma commande")} onPress={() => router.push(`/gerer/${order.id}`)} />)
  if (reorderable) actions.push(<BrandButton key="r" icon={ShoppingBasket} label={t("Recommander")} onPress={() => router.push(`/recommander/${order.id}`)} />)
  if (claimable) actions.push(<BrandButton key="c" tone="soft" icon={TriangleAlert} label={t("Signaler un problème")} onPress={() => router.push(`/reclamation/${order.id}`)} />)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction }}>
      {header}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.market600} />}
      >
        <OrderTrack status={order.statut} title={t("Commande N-{id}", { id: order.id })} date={date} times={times} />
        {needsContact ? (
          <CheckoutCard title={t("Contacter SOUKI")}>
            <View style={{ gap: 10 }}>
              <Text variant="footnote" color={palette.ink500} style={{ fontSize: 13 }}>
                {`${t("Notre équipe répond par téléphone et sur WhatsApp.")} ${SOUKI_PHONE_DISPLAY}`}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <BrandButton
                    tone="soft"
                    icon={Phone}
                    label={t("Appeler")}
                    onPress={() => {
                      haptics.selection()
                      void Linking.openURL(soukiCallUrl()).catch(() => undefined)
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <BrandButton
                    icon={MessageCircle}
                    label="WhatsApp"
                    onPress={() => {
                      haptics.selection()
                      void Linking.openURL(soukiWhatsAppUrl(t("Bonjour SOUKI, j'ai une question sur ma commande N-{id}.", { id: order.id }))).catch(() => undefined)
                    }}
                  />
                </View>
              </View>
            </View>
          </CheckoutCard>
        ) : null}
        {delivered && claimable ? (
          <Note icon={ShieldCheck}>{t("Un produit abîmé ? Signalez-le dans les 24 h après la livraison : le montant est recrédité sur votre Wallet SOUKI.")}</Note>
        ) : null}
        <CheckoutCard title={t("Informations de la commande")}>
          <InfoGrid
            items={[
              { label: t("Commandée le"), value: commandedOn ? commandedOn.charAt(0).toUpperCase() + commandedOn.slice(1) : "—" },
              { label: t("Créneau"), value: heure ? t("Vers {heure}", { heure }) : "—" },
              { label: t("Total du panier"), value: `${formatDirhams(order.montant_total ?? 0)} DH` },
              { label: t("Paiement"), value: payment },
            ]}
          />
        </CheckoutCard>
        <CheckoutCard title={t("Produits")} editLabel={showAll ? t("Réduire") : t("Tout voir")} onEdit={() => setShowAll((value) => !value)}>
          {showAll ? (
            <View style={{ gap: 10 }}>
              {order.produits.map((line, index) => {
                const live = line.product_id ? productsById.get(line.product_id) : undefined
                const name = live ? productName(live, locale) : locale === "ar" && line.nom_ar ? line.nom_ar : line.nom_fr
                return (
                  <View key={`${line.ligne_panier_id ?? index}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", backgroundColor: palette.photoBg }}>
                      <ProductImage uri={orderLineImage(line, productsById)} variant="inset" style={{ width: 44, height: 44 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 15 }}>
                        {name}
                      </Text>
                      <Text variant="footnote" numeric color={palette.ink500} style={{ fontSize: 12 }}>
                        {formatQuantity(line.quantite_kg, live?.unit ?? "kg", locale)}
                      </Text>
                    </View>
                    {typeof line.sous_total === "number" ? (
                      <Text variant="callout" weight="heavy" numeric color={palette.ink900} style={{ fontSize: 14 }}>
                        {`${formatDirhams(line.sous_total)} DH`}
                      </Text>
                    ) : null}
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <ThumbStack images={orderImages(order, productsById)} />
              <View style={{ alignItems: "flex-end" }}>
                <Text variant="callout" weight="bold" color={palette.ink900} style={{ fontSize: 15 }}>
                  {t(order.produits.length === 1 ? "{n} produit" : "{n} produits", { n: order.produits.length })}
                </Text>
                <Text variant="footnote" color={palette.ink500} style={{ fontSize: 12 }}>
                  {t("Prix du jour à la commande")}
                </Text>
              </View>
            </View>
          )}
        </CheckoutCard>
      </ScrollView>
      {actions.length > 0 ? <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>{actions}</View> : null}
    </View>
  )
}
