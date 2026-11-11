import { useCallback } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { ArrowRight, ChevronLeft, ShoppingBasket, TriangleAlert } from "lucide-react-native"
import {
  canClaimOrder,
  canManageOrder,
  formatDeliveryDate,
  formatOrderDay,
  isOrderFinished,
  normalizeOrderStatus,
  type OrderHistoryDTO,
} from "@souki/shared"

import { AssistantPills } from "@/components/assistant-cards"
import { BrandButton } from "@/components/brand-button"
import { EmptyState } from "@/components/empty-state"
import { Note } from "@/components/form-fields"
import { OrderCard } from "@/components/order-parts"
import { useDockInset } from "@/components/tab-bar"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOpenAssistant } from "@/hooks/use-open-assistant"
import { orderImages, useOrders, useOrderWindow } from "@/hooks/use-orders"
import { useRefresh } from "@/hooks/use-refresh"
import { palette, SCREEN_PADDING } from "@/theme"

/**
 * Commandes (EcranCommandes, design system 2027) : « En cours » puis « Passées ». Les
 * actions suivent l'etat : en cours, « Gérer » (jusqu'a 01h00) et « Suivre » ; livree depuis
 * moins de 24 h, « Signaler » et « Recommander » ; plus ancienne, « Recommander ».
 * Invite : on propose de se connecter.
 */
export default function CommandesScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const dockInset = useDockInset()
  const openAssistant = useOpenAssistant()
  const { status } = useAuth()
  const { orders, isLoading, isError, refetch } = useOrders()
  const { refreshing, onRefresh } = useRefresh(refetch)

  // Statut en direct : on recharge a chaque retour sur l'onglet.
  useFocusEffect(
    useCallback(() => {
      if (status === "signedIn") void refetch()
    }, [status, refetch]),
  )

  if (status !== "signedIn") {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingBottom: dockInset }}>
        <EmptyState
          art="orders"
          title={t("Aucune commande pour le moment")}
          description={t("Connectez-vous pour retrouver vos commandes et suivre vos livraisons.")}
          action={{ label: t("Se connecter"), onPress: () => router.push("/connexion") }}
        />
      </ScrollView>
    )
  }

  const active = orders.filter((order) => !isOrderFinished(order.statut))
  const past = orders.filter((order) => isOrderFinished(order.statut))

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ direction }}
      contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: SCREEN_PADDING, paddingTop: 4, paddingBottom: dockInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.market600} />}
    >
      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={palette.market600} />
        </View>
      ) : isError ? (
        <View style={{ gap: 12, paddingTop: 12 }}>
          <Note tone="red">{t("Impossible de charger votre historique de commandes pour le moment.")}</Note>
          <BrandButton tone="soft" label={t("Réessayer")} onPress={() => void refetch()} />
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, marginHorizontal: -SCREEN_PADDING }}>
          <EmptyState
            art="orders"
            title={t("Aucune commande validée pour le moment.")}
            description={t("Votre première commande de produits frais apparaîtra ici.")}
            action={{ label: t("Voir le marché"), onPress: () => router.navigate("/marche") }}
          />
          <AssistantPills onVoice={() => openAssistant("voice")} onSmart={() => openAssistant("smart")} />
        </View>
      ) : (
        <>
          <Text variant="footnote" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
            {t("Suivez, modifiez ou recommandez vos commandes.")}
          </Text>
          {active.length > 0 ? <SectionTitle>{t("En cours")}</SectionTitle> : null}
          {active.map((order) => (
            <HistoryCard key={order.id} order={order} />
          ))}
          {past.length > 0 ? <SectionTitle>{t("Passées")}</SectionTitle> : null}
          {past.map((order) => (
            <HistoryCard key={order.id} order={order} />
          ))}
        </>
      )}
    </ScrollView>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" variant="title2" color={palette.ink900} style={{ fontSize: 21, marginTop: 8 }}>
      {children}
    </Text>
  )
}

/** Une commande et ses actions selon son etat (regles du site et du back-end). */
function HistoryCard({ order }: { order: OrderHistoryDTO }) {
  const router = useRouter()
  const { t, dateLocale, isRtl } = useLocale()
  const { productsById } = useCatalogue()
  const orderWindow = useOrderWindow()
  const status = normalizeOrderStatus(order.statut)
  const finished = isOrderFinished(status)
  const manageable = canManageOrder(order, orderWindow.deliveryDate, orderWindow.closed)
  const claimable = canClaimOrder(order)
  const reorderable = finished && !["ANNULE", "ANNULEE", "REFUS"].includes(status)

  const delivery = formatDeliveryDate(order.date_livraison, dateLocale)
  const date =
    status === "LIVRE" && order.delivered_at
      ? t("Livrée le {date}", { date: formatOrderDay(order.delivered_at, dateLocale, true) ?? "" })
      : t("Passée le {date}", { date: formatOrderDay(order.date_commande, dateLocale) ?? "—" })
  const when = !finished && delivery ? t("Livraison {date}, vers {heure}", { date: delivery, heure: (order.creneau_livraison ?? "").replace(":", "h") }) : null

  const track = () => router.push(`/suivi/${order.id}`)
  const actions: React.ReactNode[] = []
  if (!finished) {
    if (manageable) actions.push(<Action key="g" tone="soft" label={t("Gérer")} onPress={() => router.push(`/gerer/${order.id}`)} />)
    actions.push(<Action key="s" label={t("Suivre")} icon={isRtl ? ChevronLeft : ArrowRight} iconPosition="end" onPress={track} />)
  } else if (claimable) {
    actions.push(<Action key="c" tone="soft" icon={TriangleAlert} label={t("Signaler")} onPress={() => router.push(`/reclamation/${order.id}`)} />)
    actions.push(<Action key="r" icon={ShoppingBasket} label={t("Recommander")} onPress={() => router.push(`/recommander/${order.id}`)} />)
  } else if (reorderable) {
    actions.push(<Action key="r" tone="soft" icon={ShoppingBasket} label={t("Recommander")} onPress={() => router.push(`/recommander/${order.id}`)} />)
  }

  // Appui long : les memes actions, plus « Suivre » toujours present.
  const menu = [
    { title: t("Suivre"), icon: "shippingbox" as const, onPress: track },
    ...(manageable ? [{ title: t("Gérer ma commande"), icon: "slider.horizontal.3" as const, onPress: () => router.push(`/gerer/${order.id}`) }] : []),
    ...(claimable ? [{ title: t("Signaler un problème"), icon: "exclamationmark.bubble" as const, onPress: () => router.push(`/reclamation/${order.id}`) }] : []),
    ...(reorderable ? [{ title: t("Recommander"), icon: "basket" as const, onPress: () => router.push(`/recommander/${order.id}`) }] : []),
  ]

  return (
    <OrderCard
      title={t("Commande N-{id}", { id: order.id })}
      date={date}
      total={order.montant_total ?? 0}
      status={order.statut}
      when={when}
      images={orderImages(order, productsById)}
      badge={manageable ? t("Modifiable jusqu'à 01h00") : claimable ? t("Réclamation possible 24 h") : null}
      actions={actions.length > 0 ? actions : null}
      href={`/suivi/${order.id}`}
      menu={menu}
    />
  )
}

function Action(props: React.ComponentProps<typeof BrandButton>) {
  return (
    <View style={{ flex: 1 }}>
      <BrandButton size="md" {...props} />
    </View>
  )
}
