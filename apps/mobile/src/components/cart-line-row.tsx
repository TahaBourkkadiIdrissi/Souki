import { memo } from "react"
import { Pressable, View } from "react-native"
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable"
import { Link } from "expo-router"
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
import { cardShadow, palette, SCREEN_PADDING } from "@/theme"

const DELETE_WIDTH = 88

/**
 * Ligne du panier (CartLine, design system 2027) : photo 60 pt, nom, prix unitaire, total de
 * ligne qui roule et petit selecteur. Balayer vers la gauche (la droite en arabe) decouvre
 * « Supprimer » sur 88 pt ; au minimum, le moins devient une corbeille.
 */
export const CartLineRow = memo(function CartLineRow({ line, onRemoved }: { line: PricedCartLine; onRemoved?: (line: PricedCartLine) => void }) {
  const { t, locale, isRtl } = useLocale()
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
      style={{ width: DELETE_WIDTH, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: palette.red }}
    >
      <Trash2 size={20} color={palette.white} strokeWidth={2.2} />
      <Text variant="footnote" weight="heavy" color={palette.white} style={{ fontSize: 12 }}>
        {t("Supprimer")}
      </Text>
    </Pressable>
  )

  return (
    <View style={{ marginHorizontal: SCREEN_PADDING, borderRadius: 20, borderCurve: "continuous", boxShadow: cardShadow }}>
      <View style={{ borderRadius: 20, borderCurve: "continuous", overflow: "hidden" }}>
        <ReanimatedSwipeable
          friction={1.6}
          rightThreshold={DELETE_WIDTH / 2}
          leftThreshold={DELETE_WIDTH / 2}
          overshootRight={false}
          overshootLeft={false}
          renderRightActions={isRtl ? undefined : deleteAction}
          renderLeftActions={isRtl ? deleteAction : undefined}
          childrenContainerStyle={{ backgroundColor: palette.white }}
        >
          <View
            accessibilityActions={[{ name: "delete", label: t("Supprimer") }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "delete") removeLine()
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, backgroundColor: palette.white }}
          >
            <Link href={productHref(product)} asChild>
              <Pressable accessibilityRole="imagebutton" accessibilityLabel={name}>
                <ProductImage
                  uri={product.image}
                  variant="inset"
                  style={{ width: 60, height: 60, borderRadius: 16, borderCurve: "continuous", overflow: "hidden", opacity: line.unavailable ? 0.4 : 1 }}
                />
              </Pressable>
            </Link>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={2} style={{ lineHeight: 19 }}>
                {name}
              </Text>
              {line.unavailable ? (
                <Text variant="footnote" weight="semibold" color={palette.orange700} style={{ fontSize: 12, lineHeight: 16 }}>
                  {t("Indisponible aujourd'hui : non compté dans le total.")}
                </Text>
              ) : (
                <>
                  <Text variant="footnote" numeric color={palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
                    {t("{price} DH / {unit}", { price: formatDirhams(line.unitPrice), unit: formatPriceUnit(product.displayUnit, locale) })}
                  </Text>
                  <AnimatedDigits value={t("{price} DH", { price: formatDirhams(line.lineTotal) })} variant="callout" weight="black" color={palette.market700} />
                </>
              )}
            </View>
            <QuantityStepper
              quantity={line.quantity}
              step={product.quantityStep}
              unit={product.displayUnit}
              size="small"
              onChange={(next) => {
                // Corbeille du selecteur : il a deja donne son retour haptique.
                if (next > 0) return setQuantity(line.productId, next)
                remove(line.productId)
                onRemoved?.(line)
              }}
            />
          </View>
        </ReanimatedSwipeable>
      </View>
    </View>
  )
})
