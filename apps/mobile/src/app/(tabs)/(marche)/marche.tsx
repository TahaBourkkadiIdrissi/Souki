import { useCallback, useMemo, useState, type ReactNode } from "react"
import { RefreshControl, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, { FadeInDown, useAnimatedScrollHandler, useReducedMotion, useSharedValue } from "react-native-reanimated"
import { useFocusEffect, useRouter } from "expo-router"
import { setStatusBarStyle } from "expo-status-bar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Store, Truck, Wallet, type LucideIcon } from "lucide-react-native"
import { DELIVERY_FEE_DH, DELIVERY_WINDOW, FREE_DELIVERY_THRESHOLD_DH, PANIER_MINIMUM_DH, type CatalogueProduct } from "@souki/shared"

import { AssistantCards } from "@/components/assistant-cards"
import { CategoryRail } from "@/components/category-rail"
import { CompactHeader } from "@/components/compact-header"
import { EmptyState } from "@/components/empty-state"
import { HomeHero } from "@/components/home-hero"
import { MarketClock } from "@/components/market-clock"
import { ProductRail } from "@/components/product-rail"
import { SectionHeader } from "@/components/section-header"
import { ProductCardSkeleton, Skeleton } from "@/components/skeleton"
import { Text } from "@/components/text"
import { useDockInset } from "@/components/tab-bar"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOpenAssistant } from "@/hooks/use-open-assistant"
import { useRefresh } from "@/hooks/use-refresh"
import { DUR_SLOW, EASE_OUT_2027 } from "@/lib/motion"
import { colors, palette, radius, SCREEN_PADDING, shadows } from "@/theme"

/** Nombre de produits dans un rail de l'accueil. */
const RAIL_SIZE = 10

/** Ecart de la cascade d'entree des sections (design system : 40 ms, montee de 14 pt). */
const CASCADE_STEP_MS = 40

/** Hauteur approximative de l'en-tete : au-dela, la barre compacte apparait. */
const HERO_THRESHOLD = 300

/**
 * Accueil SOUKI (EcranAccueil, design system 2027) : en-tete qui suit l'horloge du marche,
 * les deux assistants juste dessous, carte « Marché du jour » et son compte a rebours,
 * rayons, livraison offerte, favoris, un rail par niveau et « Comment ça marche ».
 * Barre compacte en verre au defilement ; sections en cascade au premier affichage ;
 * squelettes pendant le chargement.
 */
export default function MarcheScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const dockInset = useDockInset()
  const catalogue = useCatalogue()
  const { favoriteIds } = useFavorites()
  const { refreshing, onRefresh } = useRefresh(catalogue.refetch)
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y)
  })

  // Texte clair sur le vert de l'accueil, sombre ailleurs.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light")
      return () => setStatusBarStyle("dark")
    }, []),
  )

  const available = useMemo(() => catalogue.products.filter((product) => product.availability !== "out_of_stock"), [catalogue.products])
  const favorites = useMemo(
    () => favoriteIds.map((id) => catalogue.productsById.get(id)).filter((product): product is CatalogueProduct => Boolean(product)),
    [favoriteIds, catalogue.productsById],
  )
  // « Essentiels du panier » = produits de niveau 1 (champ `niveau` du back-end).
  const essentials = useMemo(
    () =>
      available
        .filter((product) => product.niveau === 1)
        .sort((left, right) => right.stock - left.stock || left.price - right.price)
        .slice(0, RAIL_SIZE),
    [available],
  )

  const openProducts = (params?: { rayon?: string; focus?: string }) => router.navigate({ pathname: "/produits", params })

  const openAssistant = useOpenAssistant()

  let index = 0
  const next = () => index++

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        style={{ direction }}
        contentContainerStyle={{ paddingBottom: dockInset }}
        scrollIndicatorInsets={{ top: insets.top }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.white} progressViewOffset={insets.top} />}
      >
        {/* Vert sous l'en-tete quand on tire vers le bas (pas de bande claire). */}
        <View style={{ position: "absolute", top: -1000, left: 0, right: 0, height: 1000, backgroundColor: palette.night950 }} />
        <HomeHero scrollY={scrollY} onSearch={() => openProducts({ focus: "1" })} onFavorites={() => router.navigate("/favoris", { withAnchor: true })} />

        {/* Espacements du prototype : 18 / 16 / 18 / 14 pt en haut, 28 pt entre les sections. */}
        <View style={{ paddingTop: 18 }}>
          <Reveal index={next()}>
            <AssistantCards onVoice={() => openAssistant("voice")} onSmart={() => openAssistant("smart")} />
          </Reveal>
          <Reveal index={next()} style={{ marginTop: 16 }}>
            <MarketClock onCompose={() => openProducts()} onValidate={() => router.navigate("/panier")} />
          </Reveal>

          {catalogue.isLoading ? (
            <View style={{ marginTop: 18 }}>
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
              <Reveal index={next()} style={{ marginTop: 18 }}>
                <CategoryRail
                  sections={catalogue.sections}
                  products={catalogue.products}
                  activeKey="tous"
                  onSelect={(section) => openProducts(section ? { rayon: section.slug } : undefined)}
                />
              </Reveal>

              <Reveal index={next()} style={{ marginTop: 14 }}>
                <FreeDeliveryBanner />
              </Reveal>

              {favorites.length > 0 ? (
                <Reveal index={next()} style={{ marginTop: 28, gap: 12 }}>
                  <SectionHeader title={t("Vos produits préférés")} actionLabel={t("Tout voir")} onAction={() => router.navigate("/favoris", { withAnchor: true })} />
                  <ProductRail products={favorites} />
                </Reveal>
              ) : null}

              {essentials.length > 0 ? (
                <Reveal index={next()} style={{ marginTop: favorites.length > 0 ? 14 : 28, gap: 12 }}>
                  <SectionHeader title={t("Essentiels du panier")} actionLabel={t("Tout voir")} onAction={() => openProducts()} />
                  <ProductRail products={essentials} />
                </Reveal>
              ) : favorites.length === 0 && available.length > 0 ? (
                <Reveal index={next()} style={{ marginTop: 28, gap: 12 }}>
                  <SectionHeader title={t("Découvrez nos produits")} actionLabel={t("Tout voir")} onAction={() => openProducts()} />
                  <ProductRail products={available.slice(0, RAIL_SIZE)} />
                </Reveal>
              ) : available.length === 0 ? (
                <Text variant="callout" color={palette.ink500} style={{ marginTop: 28, paddingHorizontal: SCREEN_PADDING }}>
                  {t("Aucun produit disponible pour le moment.")}
                </Text>
              ) : null}

              <Reveal index={next()} style={{ marginTop: 28 }}>
                <ServiceFacts />
              </Reveal>
            </>
          )}
        </View>
      </Animated.ScrollView>

      <CompactHeader scrollY={scrollY} threshold={HERO_THRESHOLD} onSearch={() => openProducts({ focus: "1" })} />
    </View>
  )
}

/** Entree en cascade au premier affichage (40 ms d'ecart, 14 pt de montee). */
function Reveal({ index, children, style }: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion()
  const [entering] = useState(() =>
    FadeInDown.duration(DUR_SLOW)
      .delay(Math.min(index, 8) * CASCADE_STEP_MS)
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
      <View style={{ flexDirection: "row", gap: 14, paddingHorizontal: SCREEN_PADDING }}>
        {[0, 1, 2, 3].map((tile) => (
          <View key={tile} style={{ alignItems: "center", gap: 8 }}>
            <Skeleton width={72} height={72} radius={22} />
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

/** Bandeau « livraison offerte » a plat (pas de degrade hors en-tete et tuiles). */
function FreeDeliveryBanner() {
  const { t } = useLocale()
  return (
    <View style={{ marginHorizontal: SCREEN_PADDING, flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.pale50 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: palette.souki900, alignItems: "center", justifyContent: "center" }}>
        <Truck size={22} color={palette.white} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="black" color={palette.souki900}>
          {t("Livraison offerte dès {seuil} DH", { seuil: FREE_DELIVERY_THRESHOLD_DH })}
        </Text>
        <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
          {t("Sinon {fee} DH, minimum {minimum} DH livraison comprise", { fee: DELIVERY_FEE_DH, minimum: PANIER_MINIMUM_DH })}
        </Text>
      </View>
    </View>
  )
}

/** « Comment ça marche » : uniquement des faits garantis par le service (pas d'avis ni de chiffres inventes). */
function ServiceFacts() {
  const { t } = useLocale()
  const facts: { Icon: LucideIcon; text: string }[] = [
    { Icon: Store, text: t("Achetés chaque matin au marché de gros de Fès") },
    { Icon: Truck, text: t("Livrés le lendemain entre {from}h et {to}h", { from: DELIVERY_WINDOW.from, to: DELIVERY_WINDOW.to }) },
    { Icon: Wallet, text: t("Paiement à la livraison ou par Wallet SOUKI") },
  ]

  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title={t("Comment ça marche")} />
      <View style={{ marginHorizontal: SCREEN_PADDING, gap: 10 }}>
        {facts.map(({ Icon, text }) => (
          <View
            key={text}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: palette.pale50, alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color={palette.souki900} strokeWidth={2.2} />
            </View>
            <Text variant="callout" color={palette.ink900} style={{ flex: 1 }}>
              {text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
