import { useCallback, useMemo, useState, type ReactNode } from "react"
import { RefreshControl, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, { FadeInDown, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, interpolate, Extrapolation } from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { useFocusEffect, useRouter } from "expo-router"
import { setStatusBarStyle } from "expo-status-bar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Store, Truck, Wallet, type LucideIcon } from "lucide-react-native"
import { DELIVERY_FEE_DH, DELIVERY_WINDOW, FREE_DELIVERY_THRESHOLD_DH, PANIER_MINIMUM_DH, type CatalogueProduct } from "@souki/shared"

import { CategoryRail } from "@/components/category-rail"
import { EmptyState } from "@/components/empty-state"
import { AssistantRow, HomeHeader, MarketCard, useMarketMoment } from "@/components/home-android"
import { VoiceFab } from "@/components/m3"
import { ProductRail } from "@/components/product-rail"
import { SectionHeader } from "@/components/section-header"
import { ProductCardSkeleton, Skeleton } from "@/components/skeleton"
import { Text } from "@/components/text"
import { useDockBottom, useDockInset } from "@/components/tab-bar"
import { useCart } from "@/contexts/cart-context"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { statusBarStyleFor, useAppTheme } from "@/contexts/theme-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOpenAssistant } from "@/hooks/use-open-assistant"
import { useRefresh } from "@/hooks/use-refresh"
import { DUR_SLOW, DUR_STAGGER, EASE_OUT_2027 } from "@/lib/motion"
import { colors, m3, palette, radius, SCREEN_PADDING, sizes } from "@/theme"

/** Nombre de produits dans un rail de l'accueil. */
const RAIL_SIZE = 10
/** Au-delà, l'en-tête est sorti de l'écran : barre d'état sur la surface, FAB réduit. */
const SCROLLED_AT = 220

/**
 * Accueil SOUKI Android (ScreenHome du design system) : en-tête qui suit l'horloge du marché,
 * les deux assistants juste dessous, carte « Marché du jour » et son compte à rebours, rayons,
 * livraison offerte, favoris, essentiels et « Comment ça marche ». Bouton vocal flottant étendu,
 * réduit au défilement. Sections en cascade au premier affichage, squelettes au chargement.
 */
export default function MarcheScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const { scheme } = useAppTheme()
  const insets = useSafeAreaInsets()
  const dockInset = useDockInset()
  const dockBottom = useDockBottom()
  const { count } = useCart()
  const catalogue = useCatalogue()
  const { favoriteIds } = useFavorites()
  const { refreshing, onRefresh } = useRefresh(catalogue.refetch)
  const { moment, countdown } = useMarketMoment()
  const openAssistant = useOpenAssistant()
  const [scrolled, setScrolled] = useState(false)
  const scrollY = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y)
  })
  useAnimatedReaction(
    () => scrollY.get() > SCROLLED_AT,
    (next, previous) => {
      if (next !== previous) scheduleOnRN(setScrolled, next)
    },
  )
  // Barre d'état posée sur la surface une fois l'en-tête sorti (bord à bord).
  const statusScrim = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [SCROLLED_AT - 60, SCROLLED_AT], [0, 1], Extrapolation.CLAMP) }))

  const headerStatusStyle = moment === "last" ? "dark" : "light"
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(scrolled ? statusBarStyleFor(scheme) : headerStatusStyle)
      return () => setStatusBarStyle(statusBarStyleFor(scheme))
    }, [scrolled, scheme, headerStatusStyle]),
  )

  const available = useMemo(() => catalogue.products.filter((product) => product.availability !== "out_of_stock"), [catalogue.products])
  const favorites = useMemo(
    () => favoriteIds.map((id) => catalogue.productsById.get(id)).filter((product): product is CatalogueProduct => Boolean(product)),
    [favoriteIds, catalogue.productsById],
  )
  // « Les essentiels » = produits de niveau 1 (champ `niveau` du back-end).
  const essentials = useMemo(
    () =>
      available
        .filter((product) => product.niveau === 1)
        .sort((left, right) => right.stock - left.stock || left.price - right.price)
        .slice(0, RAIL_SIZE),
    [available],
  )

  const openProducts = (params?: { rayon?: string; focus?: string }) => router.navigate({ pathname: "/produits", params })

  let index = 0
  const next = () => index++

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ direction }}
        contentContainerStyle={{ paddingBottom: dockInset + sizes.controlLg + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[m3.primary]} progressBackgroundColor={m3.surfaceContainerHigh} progressViewOffset={insets.top} />}
      >
        <HomeHeader
          moment={moment}
          search=""
          onSearch={() => openProducts({ focus: "1" })}
          onSubmitSearch={() => openProducts({ focus: "1" })}
          onVoice={() => openAssistant("voice")}
          onFavorites={() => router.navigate("/favoris", { withAnchor: true })}
        />

        <View style={{ paddingTop: 16 }}>
          <Reveal index={next()}>
            <AssistantRow onVoice={() => openAssistant("voice")} onSmart={() => openAssistant("smart")} />
          </Reveal>
          <Reveal index={next()} style={{ marginTop: 8 }}>
            <MarketCard moment={moment} countdown={countdown} onPress={() => (moment === "last" ? router.navigate("/panier") : openProducts())} />
          </Reveal>

          {catalogue.isLoading ? (
            <View style={{ marginTop: 24 }}>
              <HomeSkeleton />
            </View>
          ) : catalogue.isError ? (
            <EmptyState
              art="offline"
              title={t("Marché indisponible")}
              description={t("Impossible de charger le catalogue. Vérifiez votre connexion.")}
              action={{ label: t("Réessayer"), onPress: () => void catalogue.refetch() }}
            />
          ) : (
            <>
              <Reveal index={next()} style={{ marginTop: 24, gap: 4 }}>
                <SectionHeader title={t("Rayons")} actionLabel={t("Tout voir")} onAction={() => openProducts()} />
                <CategoryRail sections={catalogue.sections} products={catalogue.products} onSelect={(section) => openProducts(section ? { rayon: section.slug } : undefined)} />
              </Reveal>

              <Reveal index={next()} style={{ marginTop: 12 }}>
                <FreeDeliveryNote />
              </Reveal>

              {favorites.length > 0 ? (
                <Reveal index={next()} style={{ marginTop: 24, gap: 8 }}>
                  <SectionHeader title={t("Vos produits préférés")} actionLabel={t("Tout voir")} onAction={() => router.navigate("/favoris", { withAnchor: true })} />
                  <ProductRail products={favorites} />
                </Reveal>
              ) : null}

              {essentials.length > 0 ? (
                <Reveal index={next()} style={{ marginTop: favorites.length > 0 ? 8 : 24, gap: 8 }}>
                  <SectionHeader title={t("Les essentiels")} subtitle={t("La base de vos courses de la semaine")} actionLabel={t("Tout voir")} onAction={() => openProducts()} />
                  <ProductRail products={essentials} />
                </Reveal>
              ) : favorites.length === 0 && available.length > 0 ? (
                <Reveal index={next()} style={{ marginTop: 24, gap: 8 }}>
                  <SectionHeader title={t("Découvrez nos produits")} actionLabel={t("Tout voir")} onAction={() => openProducts()} />
                  <ProductRail products={available.slice(0, RAIL_SIZE)} />
                </Reveal>
              ) : available.length === 0 ? (
                <Text variant="bodyLarge" color={m3.onSurfaceVariant} style={{ marginTop: 24, paddingHorizontal: SCREEN_PADDING }}>
                  {t("Aucun produit disponible pour le moment.")}
                </Text>
              ) : null}

              <Reveal index={next()} style={{ marginTop: 16 }}>
                <ServiceFacts />
              </Reveal>
            </>
          )}
        </View>
      </Animated.ScrollView>

      {/* Fond de la barre d'état quand l'en-tête est sorti de l'écran. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background }, statusScrim]} />

      <VoiceFab extended={!scrolled} onPress={() => openAssistant("voice")} bottom={dockBottom + sizes.tabBar + (count > 0 ? sizes.cartBar + 8 : 0) + 16} />
    </View>
  )
}

/** Entrée en cascade au premier affichage (40 ms d'écart, 14 dp de montée). */
function Reveal({ index, children, style }: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion()
  const [entering] = useState(() =>
    FadeInDown.duration(DUR_SLOW)
      .delay(Math.min(index, 8) * DUR_STAGGER)
      .easing(EASE_OUT_2027)
      .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] }),
  )
  return (
    <Animated.View entering={reducedMotion ? undefined : entering} style={style}>
      {children}
    </Animated.View>
  )
}

/** Forme de l'accueil pendant le premier chargement. */
function HomeSkeleton() {
  return (
    <View style={{ gap: 24 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: SCREEN_PADDING }}>
        {[0, 1, 2, 3].map((tile) => (
          <View key={tile} style={{ alignItems: "center", gap: 8, width: 80 }}>
            <Skeleton width={72} height={72} radius={radius.tile} />
            <Skeleton width={56} height={10} radius={5} />
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 12 }}>
        <Skeleton width={190} height={20} radius={10} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </View>
      </View>
    </View>
  )
}

/** Rappel « livraison offerte » à plat : une ligne, sans dégradé. */
function FreeDeliveryNote() {
  const { t } = useLocale()
  return (
    <View style={{ marginHorizontal: SCREEN_PADDING, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.card, backgroundColor: m3.secondaryContainer }}>
      <Truck size={22} color={m3.onSecondaryContainer} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSmall" color={m3.onSecondaryContainer}>
          {t("Livraison offerte dès {seuil} DH", { seuil: FREE_DELIVERY_THRESHOLD_DH })}
        </Text>
        <Text variant="bodySmall" color={m3.onSurfaceVariant}>
          {t("Sinon {fee} DH, minimum {minimum} DH livraison comprise", { fee: DELIVERY_FEE_DH, minimum: PANIER_MINIMUM_DH })}
        </Text>
      </View>
    </View>
  )
}

/** « Comment ça marche » : uniquement des faits garantis par le service (pas d'avis ni de chiffres inventés). */
function ServiceFacts() {
  const { t } = useLocale()
  const facts: { Icon: LucideIcon; text: string }[] = [
    { Icon: Store, text: t("Achetés chaque matin au marché de gros de Fès") },
    { Icon: Truck, text: t("Livrés le lendemain entre {from}h et {to}h", { from: DELIVERY_WINDOW.from, to: DELIVERY_WINDOW.to }) },
    { Icon: Wallet, text: t("Paiement à la livraison ou par Wallet SOUKI") },
  ]

  return (
    <View style={{ gap: 4 }}>
      <SectionHeader title={t("Comment ça marche")} />
      <View style={{ marginHorizontal: SCREEN_PADDING, borderRadius: radius.card, borderWidth: 1, borderColor: m3.outlineVariant, backgroundColor: palette.white, overflow: "hidden" }}>
        {facts.map(({ Icon, text }, factIndex) => (
          <View
            key={text}
            style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: factIndex === 0 ? 0 : 1, borderTopColor: m3.outlineVariant }}
          >
            <Icon size={22} color={m3.motion} strokeWidth={2} />
            <Text variant="bodyMedium" color={m3.onSurface} style={{ flex: 1 }}>
              {text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
