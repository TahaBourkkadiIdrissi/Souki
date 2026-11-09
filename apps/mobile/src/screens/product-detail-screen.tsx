import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, View, useWindowDimensions } from "react-native"
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
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect"
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check, ChevronLeft, ChevronRight, Heart, RefreshCw, Share, ShoppingBasket, Store, Truck, type LucideIcon } from "lucide-react-native"
import {
  FREE_DELIVERY_THRESHOLD_DH,
  formatDirhams,
  productDescription,
  productIdFromSlug,
  productName,
  sectionName,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
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
import { colors, palette, radius, SCREEN_PADDING, shadows } from "@/theme"

/** Duree du « Ajoute ✓ » avant de revenir au bouton normal (BuyBar : 1,4 s). */
const CONFIRMATION_MS = 1400

/** Le verre natif (iOS 26) quand il existe ; sinon un fond creme presque opaque. */
// Meme rendu du verre de l'iPhone en iOS 18 au plus recent (comme le dock du bas) :
// le verre natif d'iOS 26 n'est pas utilise, pour ne pas avoir deux apparences.
const NATIVE_GLASS = false && isGlassEffectAPIAvailable()

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
      {/* La barre du haut passe en verre et prend le nom quand la photo sort de l'ecran. */}
      <Stack.Screen
        options={{
          title: collapsed ? name : "",
          headerBlurEffect: collapsed ? "systemChromeMaterialLight" : "none",
          headerBackVisible: false,
          // Boutons ronds du prototype (blanc 78 %, ombre verte), identiques sur toutes les versions d'iOS.
          headerLeft: () => <RoundButton Icon={isRtl ? ChevronRight : ChevronLeft} label={t("Retour")} onPress={() => router.back()} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <RoundButton Icon={Share} label={t("Partager")} onPress={() => shareProduct(product, name)} />
              <RoundButton
                Icon={Heart}
                label={favorite ? t("Retirer des favoris") : t("Ajouter aux favoris")}
                color={favorite ? palette.pink500 : palette.ink900}
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <Animated.View style={imageStyle}>
          <Link.AppleZoomTarget>
            <ProductImage uri={product.image} variant="inset" style={{ width: "100%", aspectRatio: 1, opacity: soldOut ? 0.6 : 1 }} />
          </Link.AppleZoomTarget>
        </Animated.View>

        {/* Feuille aux coins radius-hero, avec poignee */}
        <View
          style={{
            marginTop: -40,
            borderTopLeftRadius: radius.hero,
            borderTopRightRadius: radius.hero,
            backgroundColor: colors.background,
            paddingTop: 26,
            gap: 16,
            boxShadow: "0 -16px 30px -24px rgba(10, 40, 20, 0.45)",
          }}
        >
          <View pointerEvents="none" style={{ position: "absolute", top: 9, alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: palette.line }} />

          <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {sections.map((section) => (
                <Chip key={section.slug} label={sectionName(section, locale)} background={palette.pale50} color={palette.market700} />
              ))}
              <Chip label={t("Prix du jour")} background={palette.yellow400} color={palette.ink900} />
              <AvailabilityBadge availability={product.availability} />
              <LevelTag level={product.niveau} />
            </View>

            <View>
              <Text selectable accessibilityRole="header" variant="title1" color={palette.ink900} style={locale === "ar" ? undefined : { fontSize: 30, lineHeight: 42, letterSpacing: 0 }}>
                {name}
              </Text>
              {locale === "fr" && product.alias ? (
                <Text variant="callout" color={palette.ink500} style={{ fontSize: 14, fontStyle: "italic", marginTop: 2 }}>
                  {product.alias}
                </Text>
              ) : null}
            </View>

            {/* Le prix du jour comme voix */}
            <View style={{ gap: 8, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
              <PriceTag price={product.price} unit={product.displayUnit} size="hero" soldOut={soldOut} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Store size={16} color={palette.market600} strokeWidth={2.2} />
                <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ flex: 1 }}>
                  {t("Prix du jour, achetés au marché de gros de Fès.")}
                </Text>
              </View>
            </View>

            <Text selectable variant="body" color={palette.ink700} style={locale === "ar" ? undefined : { fontSize: 17, lineHeight: 28 }}>
              {productDescription(product, locale)}
            </Text>

            <DeliveryNote />
          </View>

          {related.length > 0 ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <SectionHeader title={t("Dans le même rayon")} />
              <ProductRail products={related} />
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Barre d'achat en verre, posee au-dessus de l'indicateur d'accueil */}
      <View
        style={{
          position: "absolute",
          left: SCREEN_PADDING,
          right: SCREEN_PADDING,
          bottom: insets.bottom + 8,
          borderRadius: 30,
          borderCurve: "continuous",
          boxShadow: shadows.float,
        }}
      >
        <View style={{ borderRadius: 30, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.8)" }}>
          {NATIVE_GLASS ? (
            <GlassView glassEffectStyle="regular" colorScheme="light" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          ) : (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(251, 251, 247, 0.96)" }} />
          )}
          {soldOut ? (
            <View style={{ minHeight: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
              <Text variant="headline" color={palette.ink500} align="center">
                {t("Ce produit est épuisé pour aujourd'hui.")}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10 }}>
              <QuantityStepper quantity={selected} step={product.quantityStep} unit={product.displayUnit} removable={false} tone="buy" onChange={setLocalQuantity} />
              <Animated.View style={[{ flex: 1 }, buttonStyle]}>
                <PressableScale
                  onPress={confirm}
                  disabled={unchanged && !confirmed}
                  accessibilityRole="button"
                  accessibilityLabel={inCart > 0 ? t("Mettre à jour le panier") : t("Ajouter au panier")}
                  accessibilityHint={unchanged ? t("Déjà dans votre panier.") : undefined}
                  style={{
                    minHeight: 52,
                    borderRadius: 999,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingHorizontal: 18,
                    // Decision = souki-900 ; « Ajouté » confirme en market-700 (blanc dessus 6,6:1).
                    backgroundColor: confirmed ? palette.market700 : unchanged ? palette.sand : palette.souki900,
                    boxShadow: unchanged && !confirmed ? undefined : shadows.button,
                  }}
                >
                  {confirmed ? (
                    <Animated.View key="done" entering={reducedMotion ? undefined : ZoomIn.springify().damping(16).stiffness(220)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Check size={20} color={palette.white} strokeWidth={3} />
                      <Text variant="headline" color={palette.white}>
                        {t("Ajouté")}
                      </Text>
                    </Animated.View>
                  ) : (
                    <Animated.View key="add" entering={reducedMotion ? undefined : FadeIn.duration(160)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {inCart > 0 ? (
                        <RefreshCw size={18} color={unchanged ? palette.ink500 : palette.white} strokeWidth={2.4} />
                      ) : (
                        <ShoppingBasket size={18} color={palette.white} strokeWidth={2.4} />
                      )}
                      <AnimatedDigits value={t("{price} DH", { price: total })} variant="headline" weight="black" color={unchanged ? palette.ink500 : palette.white} />
                    </Animated.View>
                  )}
                </PressableScale>
              </Animated.View>
            </View>
          )}
        </View>
      </View>

    </View>
  )
}

/** Bouton rond de la barre du haut (`sk-round` du prototype) : 44 pt, blanc 78 %, ombre verte. */
function RoundButton({ Icon, label, onPress, color = palette.ink900, filled = false }: { Icon: LucideIcon; label: string; onPress: () => void; color?: string; filled?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.78)",
        boxShadow: "0 6px 16px -8px rgba(10, 40, 20, 0.4)",
      }}
    >
      <Icon size={20} color={color} fill={filled ? color : "transparent"} strokeWidth={2.4} />
    </PressableScale>
  )
}

/** Pastille de la fiche (rayon, « Prix du jour ») : 24 pt, texte 12 pt ExtraBold. */
function Chip({ label, background, color }: { label: string; background: string; color: string }) {
  return (
    <View style={{ minHeight: 24, paddingHorizontal: 10, borderRadius: 999, justifyContent: "center", backgroundColor: background }}>
      <Text variant="footnote" weight="heavy" color={color} style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </Text>
    </View>
  )
}

/** Promesse de livraison : ce qui est garanti, selon l'horloge des commandes. */
function DeliveryNote() {
  const { t } = useLocale()
  const hours = useOrderHours()
  const promise = useDeliveryPromise(hours)
  const title = hours.closed ? t("Le marché dort") : t("Commandez avant 1h du matin")
  const detail = hours.closed
    ? t("Vous pouvez préparer votre panier. Validation dès 8h.")
    : `${promise} ${t("Offerte dès {seuil} DH.", { seuil: FREE_DELIVERY_THRESHOLD_DH })}`
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, borderCurve: "continuous", padding: 14, backgroundColor: palette.pale50 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: palette.souki900, alignItems: "center", justifyContent: "center" }}>
        <Truck size={22} color={palette.white} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="heavy" color={palette.souki900}>
          {title}
        </Text>
        <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
          {detail}
        </Text>
      </View>
    </View>
  )
}
