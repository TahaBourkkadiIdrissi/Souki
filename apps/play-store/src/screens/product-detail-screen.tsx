import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, View, useWindowDimensions } from "react-native"
import Animated, {
  FadeIn,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, ArrowRight, Check, Heart, Leaf, RefreshCw, Share2, ShoppingBasket, Truck, type LucideIcon } from "lucide-react-native"
import {
  FREE_DELIVERY_THRESHOLD_DH,
  formatDirhams,
  productDescription,
  productIdFromSlug,
  productName,
  sectionName,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { BrandButton } from "@/components/brand-button"
import { AvailabilityBadge } from "@/components/availability-badge"
import { EmptyState } from "@/components/empty-state"
import { LevelTag } from "@/components/level-tag"
import { PriceTag } from "@/components/price-tag"
import { PressableScale } from "@/components/pressable-scale"
import { ProductImage } from "@/components/product-image"
import { ProductRail } from "@/components/product-rail"
import { QuantityStepper } from "@/components/quantity-stepper"
import { SectionHeader } from "@/components/section-header"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useDeliveryPromise } from "@/hooks/use-delivery-promise"
import { useOrderHours } from "@/hooks/use-order-hours"
import { haptics } from "@/lib/haptics"
import { SPRING_POP } from "@/lib/motion"
import { shareProduct } from "@/lib/share"
import { colors, m3, palette, radius, SCREEN_PADDING, shadows, sizes, states, withAlpha } from "@/theme"

/** Duree du « Ajoute ✓ » avant de revenir au bouton normal (BuyBar : 1,4 s). */
const CONFIRMATION_MS = 1400


/**
 * Fiche produit (EcranFiche, design system 2027 ; route /produit/[slug] comme le site) :
 * - la photo de la carte « zoome » jusqu'ici, file en parallaxe (0,4) et s'etire au tirage ;
 * - feuille aux coins radius-hero : rayon, « Prix du jour », niveau, nom et darija, prix en
 *   price-hero, description, promesse de livraison, produits du meme rayon ;
 * - barre d'achat en verre : quantite au pas du produit, bouton qui affiche le montant puis
 *   « Ajouté » ; la barre du haut passe en verre et prend le nom quand la photo sort.
 */
export function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { t, locale, direction, isRtl } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const catalogue = useCatalogue()
  const { quantityOf, add, setQuantity } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [quantity, setLocalQuantity] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { width: screenWidth } = useWindowDimensions()
  const scrollY = useSharedValue(0)
  const buttonScale = useSharedValue(1)
  const orderHours = useOrderHours()
  const deliveryPromise = useDeliveryPromise(orderHours)

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y)
  })
  const imageStyle = useAnimatedStyle(() => {
    const y = scrollY.get()
    if (reducedMotion) return {}
    return y < 0 ? { transform: [{ translateY: y / 2 }, { scale: 1 - y / 400 }] } : { transform: [{ translateY: y * 0.4 }] }
  })
  // La photo (carree, largeur de l'ecran) sort sous la barre du haut.
  const collapseAt = screenWidth - 120
  useAnimatedReaction(
    () => scrollY.get() > collapseAt,
    (next, previous) => {
      if (next !== previous) scheduleOnRN(setCollapsed, next)
    },
  )
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.get() }] }))

  useEffect(() => {
    if (!confirmed) return
    const timer = setTimeout(() => setConfirmed(false), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [confirmed])

  const productId = productIdFromSlug(slug ?? "")
  const product = productId === null ? undefined : catalogue.productsById.get(productId)
  const related = useMemo(
    () =>
      product
        ? catalogue.products
            .filter((other) => other.id !== product.id && other.availability !== "out_of_stock" && other.categories.includes(product.category))
            .slice(0, 10)
        : [],
    [catalogue.products, product],
  )

  if (!product) {
    return catalogue.isLoading ? (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={palette.green700} />
      </View>
    ) : (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 44 }}>
        <EmptyState art="search" title={t("Produit introuvable")} description={t("Ce produit n'est plus proposé aujourd'hui.")} />
      </View>
    )
  }

  const inCart = quantityOf(product.id)
  const name = productName(product, locale)
  const favorite = isFavorite(product.id)
  const soldOut = product.availability === "out_of_stock"
  const selected = quantity ?? (inCart > 0 ? inCart : product.quantityStep)
  const total = formatDirhams(product.price * selected)
  const sections = catalogue.sections.filter((section) => product.categories.includes(section.slug))
  // Darija : nom latin et nom arabe en français ; nom latin en arabe.
  const darija = locale === "ar" ? [product.alias, product.name].filter(Boolean).join(" · ") : [product.alias, product.nameAr].filter(Boolean).join(" · ")
  const deliveryLine = orderHours.closed ? t("Validation dès 8h. Livraison le lendemain, entre 8h et 15h.") : deliveryPromise
  const unchanged = inCart > 0 && quantity === null

  const confirm = () => {
    if (inCart > 0) setQuantity(product.id, selected)
    else add(product, selected)
    haptics.success()
    setLocalQuantity(null)
    setConfirmed(true)
    buttonScale.set(withSequence(withTiming(0.96, { duration: 90 }), withSpring(1, SPRING_POP)))
  }

  const toggle = () => {
    toggleFavorite(product.id)
    haptics.selection()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Barre du haut : boutons carrés sur la photo ; le nom apparaît quand la photo sort de l'écran. */}
      <Stack.Screen
        options={{
          title: collapsed ? name : "",
          headerTransparent: !collapsed,
          headerStyle: { backgroundColor: collapsed ? colors.background : "transparent" },
          headerBackVisible: false,
          headerLeft: () => <TopButton Icon={isRtl ? ArrowRight : ArrowLeft} label={t("Retour")} onPress={() => router.back()} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TopButton Icon={Share2} label={t("Partager")} onPress={() => shareProduct(product, name)} />
              <TopButton
                Icon={Heart}
                label={favorite ? t("Retirer des favoris") : t("Ajouter aux favoris")}
                color={favorite ? m3.favorite : m3.onSurface}
                filled={favorite}
                onPress={toggle}
              />
            </View>
          ),
        }}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        style={{ direction }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}
      >
        <Animated.View style={[imageStyle, { borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero, overflow: "hidden", backgroundColor: palette.photoBg }]}>
          <ProductImage uri={product.image} variant="inset" style={{ width: "100%", aspectRatio: 1, opacity: soldOut ? states.disabledContent : 1 }} />
        </Animated.View>

        <View style={{ paddingTop: 20, gap: 16 }}>
          <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {product.availability === "in_stock" ? <Chip label={t("En stock · acheté ce matin")} background={m3.secondaryContainer} color={m3.onSecondaryContainer} /> : null}
              <AvailabilityBadge availability={product.availability} />
              {sections.slice(0, 1).map((section) => (
                <Chip key={section.slug} label={sectionName(section, locale)} background={m3.surfaceContainerHigh} color={m3.onSurfaceVariant} />
              ))}
              <LevelTag level={product.niveau} />
            </View>

            <View style={{ gap: 2 }}>
              <Text selectable accessibilityRole="header" variant="headlineMedium" color={m3.onSurface}>
                {name}
              </Text>
              {darija ? (
                <Text variant="bodyMedium" color={m3.onSurfaceVariant}>
                  {darija}
                </Text>
              ) : null}
            </View>

            <PriceTag price={product.price} unit={product.displayUnit} size="hero" soldOut={soldOut} />

            <Text selectable variant="bodyLarge" color={m3.onSurfaceVariant}>
              {productDescription(product, locale)}
            </Text>

            <View>
              <InfoRow Icon={Truck} text={deliveryLine} />
              <InfoRow Icon={Leaf} text={t("Marché de gros de Fès, sans intermédiaire")} />
            </View>
          </View>

          {related.length > 0 ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <SectionHeader title={t("Dans le même rayon")} />
              <ProductRail products={related} />
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Barre d'achat collée en bas, au-dessus de l'inset système. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: SCREEN_PADDING,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: palette.white,
          boxShadow: shadows.sheet,
        }}
      >
        {soldOut ? (
          <BrandButton tone="soft" icon={Heart} label={favorite ? t("Retirer des favoris") : t("Ajouter aux favoris")} onPress={toggle} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <QuantityStepper quantity={selected} step={product.quantityStep} unit={product.displayUnit} removable={false} onChange={setLocalQuantity} />
            <Animated.View style={[{ flex: 1 }, buttonStyle]}>
              <PressableScale
                onPress={confirm}
                disabled={unchanged && !confirmed}
                accessibilityRole="button"
                accessibilityLabel={inCart > 0 ? t("Mettre à jour le panier") : t("Ajouter au panier")}
                accessibilityHint={unchanged ? t("Déjà dans votre panier.") : undefined}
                android_ripple={{ color: withAlpha(m3.onPrimary, states.pressed + 0.06) }}
                containerStyle={{ borderRadius: radius.control, overflow: "hidden" }}
                style={{
                  minHeight: sizes.controlLg,
                  borderRadius: radius.control,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingHorizontal: 16,
                  backgroundColor: confirmed ? m3.secondary : unchanged ? m3.surfaceContainerHighest : m3.primary,
                }}
              >
                {confirmed ? (
                  <Animated.View key="done" entering={reducedMotion ? undefined : ZoomIn.springify().damping(16).stiffness(220)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Check size={20} color={m3.onSecondary} strokeWidth={2.6} />
                    <Text variant="labelLarge" color={m3.onSecondary}>
                      {t("Ajouté")}
                    </Text>
                  </Animated.View>
                ) : (
                  <Animated.View key="add" entering={reducedMotion ? undefined : FadeIn.duration(160)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {inCart > 0 ? (
                      <RefreshCw size={18} color={unchanged ? withAlpha(m3.onSurface, states.disabledContent) : m3.onPrimary} strokeWidth={2.2} />
                    ) : (
                      <ShoppingBasket size={18} color={m3.onPrimary} strokeWidth={2.2} />
                    )}
                    <Text variant="labelLarge" color={unchanged ? withAlpha(m3.onSurface, states.disabledContent) : m3.onPrimary}>
                      {inCart > 0 ? t("Mettre à jour") : t("Ajouter")}
                    </Text>
                    <Text variant="labelLarge" color={unchanged ? withAlpha(m3.onSurface, states.disabledContent) : m3.onPrimary}>
                      ·
                    </Text>
                    <AnimatedDigits value={t("{price} DH", { price: total })} variant="labelLarge" weight="bold" color={unchanged ? withAlpha(m3.onSurface, states.disabledContent) : m3.onPrimary} />
                  </Animated.View>
                )}
              </PressableScale>
            </Animated.View>
          </View>
        )}
      </View>
    </View>
  )
}

/** Bouton de la barre du haut posé sur la photo : 48 dp, coins 12 dp, surface claire, ripple. */
function TopButton({ Icon, label, onPress, color = m3.onSurface, filled = false }: { Icon: LucideIcon; label: string; onPress: () => void; color?: string; filled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: withAlpha(m3.onSurface, states.pressed) }}
      style={{
        width: sizes.touchMin,
        height: sizes.touchMin,
        borderRadius: radius.control,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.white,
        borderWidth: 1,
        borderColor: m3.outlineVariant,
      }}
    >
      <Icon size={22} color={color} fill={filled ? color : "transparent"} strokeWidth={2} />
    </Pressable>
  )
}

/** Ligne d'information (livraison, origine) : icône `motion`, filet en haut. */
function InfoRow({ Icon, text }: { Icon: LucideIcon; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 48, paddingVertical: 10, borderTopWidth: 1, borderTopColor: m3.outlineVariant }}>
      <Icon size={22} color={m3.motion} strokeWidth={2} />
      <Text variant="bodyMedium" color={m3.onSurface} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  )
}

/** Pastille de la fiche (stock, rayon) : tonale, coins de 4 dp, label-small. */
function Chip({ label, background, color }: { label: string; background: string; color: string }) {
  return (
    <View style={{ minHeight: 22, paddingHorizontal: 6, borderRadius: radius.xxs, justifyContent: "center", backgroundColor: background }}>
      <Text variant="labelSmall" color={color}>
        {label}
      </Text>
    </View>
  )
}
