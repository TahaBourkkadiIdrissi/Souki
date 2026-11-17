import { memo } from "react"
import { Pressable, View } from "react-native"
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable"
import { useRouter } from "expo-router"
import { Trash2 } from "lucide-react-native"
import { formatDirhams, formatPriceUnit, productName } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { ProductImage } from "@/components/product-image"
import { QuantityStepper } from "@/components/quantity-stepper"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useProductHref } from "@/hooks/use-product-href"
import type { PricedCartLine } from "@/hooks/use-cart-summary"
import { haptics } from "@/lib/haptics"
import { colors, m3, radius, SCREEN_PADDING, states } from "@/theme"

const DELETE_WIDTH = 88

/**
 * Ligne du panier (fiche CartLine du design system Android) : à plat, filet en bas ; photo de
 * 64 dp sur `photo-bg`, nom, prix unitaire ; total de ligne en haut à droite (chiffres qui roulent)
 * et sélecteur tonal dessous. Glisser vers la gauche (la droite en arabe) découvre « Supprimer » ;
 * au minimum, le moins devient une corbeille ; une snackbar propose « Annuler ».
 */
export const CartLineRow = memo(function CartLineRow({ line, onRemoved }: { line: PricedCartLine; onRemoved?: (line: PricedCartLine) => void }) {
  const { t, locale, isRtl } = useLocale()
  const router = useRouter()
  const { setQuantity, remove } = useCart()
  const productHref = useProductHref()
  const product = line.live ?? line.product
  const name = productName(product, locale)

  const removeLine = () => {
    haptics.remove()
    remove(line.productId)
    onRemoved?.(line)
  }

  const deleteAction = () => (
    <Pressable
      onPress={removeLine}
      accessibilityRole="button"
      accessibilityLabel={t("Supprimer {name}", { name })}
      style={{ width: DELETE_WIDTH, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: m3.error }}
    >
      <Trash2 size={22} color={m3.onError} strokeWidth={2} />
      <Text variant="labelMedium" color={m3.onError}>
        {t("Supprimer")}
      </Text>
    </Pressable>
  )

  return (
    <ReanimatedSwipeable
      friction={1.6}
      rightThreshold={DELETE_WIDTH / 2}
      leftThreshold={DELETE_WIDTH / 2}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={isRtl ? undefined : deleteAction}
      renderLeftActions={isRtl ? deleteAction : undefined}
      childrenContainerStyle={{ backgroundColor: colors.background }}
    >
      <View
        accessibilityActions={[{ name: "delete", label: t("Supprimer") }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "delete") removeLine()
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: SCREEN_PADDING,
          paddingVertical: 12,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: m3.outlineVariant,
        }}
      >
        <Pressable onPress={() => router.push(productHref(product))} accessibilityRole="imagebutton" accessibilityLabel={name}>
          <ProductImage
            uri={product.image}
            variant="inset"
            style={{ width: 64, height: 64, borderRadius: radius.control, overflow: "hidden", opacity: line.unavailable ? states.disabledContent : 1 }}
          />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleMedium" color={m3.onSurface} numberOfLines={2}>
            {name}
          </Text>
          {line.unavailable ? (
            <Text variant="bodySmall" color={m3.tertiary}>
              {t("Indisponible aujourd'hui : non compté dans le total.")}
            </Text>
          ) : (
            <Text variant="bodySmall" numeric color={m3.onSurfaceVariant}>
              {t("{price} DH / {unit}", { price: formatDirhams(line.unitPrice), unit: formatPriceUnit(product.displayUnit, locale) })}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {line.unavailable ? null : (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3, direction: "ltr" }}>
              <AnimatedDigits value={formatDirhams(line.lineTotal)} variant="priceCard" color={m3.secondary} />
              <Text variant="priceUnit" color={m3.secondary}>
                DH
              </Text>
            </View>
          )}
          <QuantityStepper
            quantity={line.quantity}
            step={product.quantityStep}
            unit={product.displayUnit}
            size="small"
            onChange={(next) => {
              // Corbeille du sélecteur : il a déjà donné son retour haptique.
              if (next > 0) return setQuantity(line.productId, next)
              remove(line.productId)
              onRemoved?.(line)
            }}
          />
        </View>
      </View>
    </ReanimatedSwipeable>
  )
})
