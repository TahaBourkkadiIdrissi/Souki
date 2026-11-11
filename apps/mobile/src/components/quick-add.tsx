import { useEffect, useState } from "react"
import { Pressable } from "react-native"
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated"
import { Minus, Plus, Trash2 } from "lucide-react-native"
import { formatQuantity, type CatalogueProduct } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { useCartActions, useCartQuantity } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { EASE_OUT } from "@/lib/motion"
import { palette, shadows } from "@/theme"

const MORPH = LinearTransition.duration(240).easing(EASE_OUT)
const CONTENT_IN = FadeIn.duration(160).delay(60)
/** Le selecteur se replie en bulle de quantite apres ce delai sans toucher. */
const COLLAPSE_AFTER_MS = 2200
/** Rond de repos 44 pt (zone de toucher pleine) ; selecteur deroule de 140 pt. */
const SIZE = 44
const EXPANDED_WIDTH = 140

/**
 * Ajout rapide pose sur la photo (modele Glovo / Instacart) : un « + » rond qui se deroule
 * en selecteur « − quantite + », puis se replie en bulle souki-900 (decision) montrant la quantite.
 * La forme change par animation de mise en page (fil UI), le chiffre roule.
 */
export function QuickAdd({ product, expandedWidth = EXPANDED_WIDTH }: { product: CatalogueProduct; expandedWidth?: number }) {
  const { t, locale } = useLocale()
  const quantity = useCartQuantity(product.id)
  const { add, setQuantity } = useCartActions()
  const reducedMotion = useReducedMotion()
  const [expanded, setExpanded] = useState(false)
  const [touchedAt, setTouchedAt] = useState(0)

  useEffect(() => {
    if (!expanded) return
    const timer = setTimeout(() => setExpanded(false), COLLAPSE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [expanded, touchedAt])

  const touch = () => {
    setExpanded(true)
    setTouchedAt(Date.now())
  }
  // Un seul retour par action : `selection` a chaque pas, `medium` au retrait.
  const change = (next: number) => {
    if (next <= 0) haptics.medium()
    else haptics.selection()
    if (next <= 0) setExpanded(false)
    else touch()
    setQuantity(product.id, next)
  }
  const label = formatQuantity(quantity, product.displayUnit, locale)
  const layout = reducedMotion ? undefined : MORPH
  const entering = reducedMotion ? undefined : CONTENT_IN

  const shell = {
    height: SIZE,
    minWidth: SIZE,
    borderRadius: SIZE / 2,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    boxShadow: shadows.float,
  }

  if (quantity <= 0) {
    return (
      <Animated.View layout={layout} style={[shell, { backgroundColor: palette.white }]}>
        <Pressable
          onPress={() => {
            add(product)
            haptics.add()
            touch()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("Ajouter {name}", { name: product.name })}
          style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}
        >
          <Plus size={22} color={palette.souki900} strokeWidth={3} />
        </Pressable>
      </Animated.View>
    )
  }

  if (!expanded) {
    return (
      <Animated.View layout={layout} style={[shell, { backgroundColor: palette.souki900, paddingHorizontal: 12 }]}>
        <Pressable
          onPress={touch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("Modifier la quantité : {quantite}", { quantite: label })}
          style={{ height: SIZE, justifyContent: "center", paddingHorizontal: 2 }}
        >
          <Animated.View entering={entering}>
            <AnimatedDigits value={label} variant="footnote" weight="black" color={palette.white} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    )
  }

  const atMinimum = quantity <= product.quantityStep
  const button = (Icon: typeof Plus, accessibilityLabel: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Icon size={18} color={palette.white} strokeWidth={2.8} />
    </Pressable>
  )

  return (
    <Animated.View layout={layout} style={[shell, { width: expandedWidth, backgroundColor: palette.souki900 }]}>
      <Animated.View entering={entering} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {button(atMinimum ? Trash2 : Minus, atMinimum ? t("Retirer du panier") : t("Diminuer"), () =>
          change(atMinimum ? 0 : quantity - product.quantityStep),
        )}
        <AnimatedDigits value={label} variant="footnote" weight="black" color={palette.white} />
        {button(Plus, t("Augmenter"), () => change(quantity + product.quantityStep))}
      </Animated.View>
    </Animated.View>
  )
}
