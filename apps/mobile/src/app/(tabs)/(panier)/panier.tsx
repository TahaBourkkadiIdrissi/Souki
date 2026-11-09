import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Pressable, ScrollView, View } from "react-native"
import Animated, { FadeInDown, FadeOutDown, LinearTransition, useReducedMotion } from "react-native-reanimated"
import { Stack, useFocusEffect, useRouter } from "expo-router"
import { ShieldCheck, Wallet } from "lucide-react-native"
import { formatDirhams, PANIER_MINIMUM_DH, productName } from "@souki/shared"

import { AssistantPills } from "@/components/assistant-cards"
import { BrandButton } from "@/components/brand-button"
import { CartLineRow } from "@/components/cart-line-row"
import { DeliveryPath } from "@/components/delivery-path"
import { EmptyState } from "@/components/empty-state"
import { type LevelGroup, LevelSuggestions } from "@/components/level-suggestions"
import { OrderSummary } from "@/components/order-summary"
import { useDockBottom, useDockInset } from "@/components/tab-bar"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { type PricedCartLine, useCartSummary } from "@/hooks/use-cart-summary"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOpenAssistant } from "@/hooks/use-open-assistant"
import { useOrderHours } from "@/hooks/use-order-hours"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, EASE_OUT, EASE_OUT_2027 } from "@/lib/motion"
import { palette, SCREEN_PADDING, sizes } from "@/theme"

const ROW_REFLOW = LinearTransition.duration(220).easing(EASE_OUT)

/** Produits par etagere de suggestions. */
const SHELF_SIZE = 6
/** Duree du bandeau « Annuler » apres une suppression. */
const UNDO_MS = 4000

/**
 * Panier SOUKI (EcranPanier, design system 2027) : chemin en « S » vers la livraison offerte,
 * lignes a balayer, etal « Complétez votre panier » par niveau, recapitulatif, et bouton
 * « Valider la commande | total » colle au-dessus des onglets (desactive sous le minimum de
 * 50 DH livraison comprise, « Validation dès 8h » la nuit). Vide : Souki et les deux assistants.
 * « Valider la commande » ouvre le checkout en 4 etapes (app/checkout.tsx).
 */
export default function PanierScreen() {
  const router = useRouter()
  const { t, locale, direction } = useLocale()
  const dockInset = useDockInset()
  const dockBottom = useDockBottom()
  const openAssistant = useOpenAssistant()
  const { clear, add } = useCart()
  const { status } = useAuth()
  const { lines, totals } = useCartSummary()
  const { products } = useCatalogue()
  const [removed, setRemoved] = useState<PricedCartLine | null>(null)

  // Les produits deja au panier quand l'ecran s'affiche sortent des etageres ; ceux ajoutes
  // ensuite restent visibles (contour vert) jusqu'a la sortie de l'ecran.
  const cartIds = useRef<number[]>([])
  cartIds.current = lines.map((line) => line.productId)
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set(cartIds.current))
  useFocusEffect(
    useCallback(() => {
      setExcluded(new Set(cartIds.current))
    }, []),
  )

  const shelves = useMemo<LevelGroup[]>(
    () =>
      ([1, 2, 3] as const).map((level) => ({
        level,
        products: products
          .filter((product) => product.niveau === level && !excluded.has(product.id) && product.availability !== "out_of_stock")
          .sort((left, right) => right.stock - left.stock || left.price - right.price)
          .slice(0, SHELF_SIZE),
      })),
    [products, excluded],
  )

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  const confirmClear = () => {
    Alert.alert(t("Vider le panier ?"), t("Tous les produits seront retirés du panier."), [
      { text: t("Annuler"), style: "cancel" },
      {
        text: t("Vider"),
        style: "destructive",
        onPress: () => {
          haptics.remove()
          clear()
        },
      },
    ])
  }

  // Checkout en plein ecran modal ; un invite se connecte d'abord (comme sur le site).
  const checkout = () => {
    haptics.medium()
    router.push(status === "signedIn" ? "/checkout" : "/connexion")
  }

  if (lines.length === 0) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingBottom: dockInset }}>
        <EmptyState
          art="basket"
          title={t("Votre panier est vide")}
          description={t("Les prix du jour sont en ligne. Composez votre panier ou laissez le panier intelligent le faire selon votre budget.")}
          action={{ label: t("Voir le marché"), onPress: () => router.navigate("/marche") }}
        />
        <View style={{ marginTop: 4 }}>
          <AssistantPills onVoice={() => openAssistant("voice")} onSmart={() => openAssistant("smart")} />
        </View>
      </ScrollView>
    )
  }

  const count = lines.length

  return (
    <>
      <Animated.FlatList
        data={lines}
        keyExtractor={(line) => String(line.productId)}
        renderItem={({ item }) => <CartLineRow line={item} onRemoved={setRemoved} />}
        itemLayoutAnimation={ROW_REFLOW}
        contentInsetAdjustmentBehavior="automatic"
        style={{ direction }}
        contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: dockInset }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 6 }}>
            <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ paddingHorizontal: SCREEN_PADDING }}>
              {t(count === 1 ? "{n} produit · livraison demain, 8h–15h" : "{n} produits · livraison demain, 8h–15h", { n: count })}
            </Text>
            <View style={{ marginHorizontal: SCREEN_PADDING }}>
              <DeliveryPath subtotal={totals.subtotal} />
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={{ marginTop: 22, gap: 8, paddingHorizontal: SCREEN_PADDING }}>
            <LevelSuggestions groups={shelves} remaining={totals.missingForFreeDelivery} title={t("Complétez votre panier")} />
            <View style={{ marginTop: 8 }}>
              <OrderSummary totals={totals} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
              <Wallet size={16} color={palette.market600} strokeWidth={2.2} />
              <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
                {t("Paiement à la livraison ou par Wallet SOUKI.")}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <ShieldCheck size={14} color={palette.market600} strokeWidth={2.4} />
              <Text variant="footnote" color={palette.ink500} align="center" style={{ flexShrink: 1, fontSize: 12, lineHeight: 16 }}>
                {t("Montant indicatif : le total est recalculé au prix du jour à la validation.")}
              </Text>
            </View>
          </View>
        }
      />

      {/* Bouton colle au-dessus des onglets (le dock du prototype) */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom: dockBottom + sizes.tabBar + 8, gap: 8 }}>
        {removed?.live ? (
          <UndoBanner
            name={productName(removed.live, locale)}
            onUndo={() => {
              if (removed.live) add(removed.live, removed.quantity)
              haptics.add()
              setRemoved(null)
            }}
          />
        ) : null}
        <View style={{ borderRadius: 999, boxShadow: "0 0 0 6px rgba(251, 251, 247, 0.8)" }}>
          <CheckoutButton meetsMinimum={totals.meetsMinimum} onPress={checkout} />
        </View>
      </View>

      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button tintColor={palette.market700} onPress={confirmClear}>
          {t("Vider")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  )
}

/**
 * Bouton « Valider la commande », sans montant comme sur le site et la PWA : le total est
 * dans le recapitulatif juste au-dessus. Isole : seul lui suit l'horloge des commandes
 * (« Validation dès 8h » de 01h a 08h) sans redessiner tout le panier chaque seconde.
 */
function CheckoutButton({ meetsMinimum, onPress }: { meetsMinimum: boolean; onPress: () => void }) {
  const { t } = useLocale()
  const { closed } = useOrderHours()
  const label = closed ? t("Validation dès 8h") : meetsMinimum ? t("Valider la commande") : t("Minimum {min} DH", { min: PANIER_MINIMUM_DH })
  return (
    <BrandButton
      label={label}
      disabled={!meetsMinimum || closed}
      onPress={onPress}
    />
  )
}

/** Bandeau « Annuler » apres une suppression (4 s). */
function UndoBanner({ name, onUndo }: { name: string; onUndo: () => void }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(DUR_BASE).easing(EASE_OUT_2027)}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(160)}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        paddingStart: 16,
        paddingEnd: 6,
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: palette.ink900,
        boxShadow: "0 16px 36px -14px rgba(10, 40, 20, 0.38)",
      }}
    >
      <Text variant="footnote" weight="semibold" color={palette.white} numberOfLines={1} style={{ flex: 1 }}>
        {t("{name} retiré du panier", { name })}
      </Text>
      <Pressable onPress={onUndo} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
        <Text variant="callout" weight="heavy" color={palette.mint300}>
          {t("Annuler")}
        </Text>
      </Pressable>
    </Animated.View>
  )
}
