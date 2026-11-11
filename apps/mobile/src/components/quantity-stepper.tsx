import { Pressable, View } from "react-native"
import { Minus, Plus, Trash2, type LucideIcon } from "lucide-react-native"
import { formatQuantity } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { palette, radius } from "@/theme"

type QuantityStepperProps = {
  quantity: number
  step: number
  /** Unite affichee (kg, lot, 250g…). */
  unit: string
  onChange: (quantity: number) => void
  /**
   * `card` : bandeau vert pleine largeur sous une carte produit ;
   * `regular` : fiche produit ;
   * `small` : lignes de panier (boutons 32 pt, zone de toucher 44 pt).
   */
  size?: "card" | "regular" | "small"
  /** Le moins a la quantite minimale retire le produit (icone corbeille). */
  removable?: boolean
  /** Plus grande quantite autorisee (stock), facultatif. */
  max?: number
  /** `buy` : pose dans la barre d'achat en verre (fond blanc, boutons vert pale sans ombre). */
  tone?: "default" | "buy"
}

/** Selecteur de quantite au pas du produit (0,5 kg, 1 lot, 1 piece), icones Lucide comme la PWA. */
export function QuantityStepper({
  quantity,
  step,
  unit,
  onChange,
  size = "regular",
  removable = true,
  max,
  tone = "default",
}: QuantityStepperProps) {
  const onBuyBar = tone === "buy"
  const { t, locale } = useLocale()
  const onCard = size === "card"
  const atMinimum = quantity <= step
  const atMaximum = max !== undefined && quantity + step > max
  const decrementDisabled = atMinimum && !removable
  const label = formatQuantity(quantity, unit, locale)
  const small = size === "small"
  const buttonSize = onCard ? 36 : small ? 32 : 44

  // Design system 2027 : haptique `selection` a chaque pas.
  const change = (next: number) => {
    haptics.selection()
    onChange(next)
  }

  const button = (Icon: LucideIcon, accessibilityLabel: string, disabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={small ? 6 : 4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: buttonSize,
        height: buttonSize,
        borderRadius: onCard ? 12 : buttonSize / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: onCard ? "rgba(255, 255, 255, 0.18)" : onBuyBar ? palette.pale50 : palette.white,
        opacity: onCard && disabled ? 0.35 : 1,
        transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
        boxShadow: onCard || onBuyBar || disabled ? undefined : "0 4px 10px -6px rgba(0, 91, 67, 0.5)",
      })}
    >
      <Icon size={onCard || small ? 16 : 18} color={onCard ? palette.white : disabled ? palette.ink300 : palette.souki900} strokeWidth={2.6} />
    </Pressable>
  )

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={t("Quantité")}
      accessibilityValue={{ text: label }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment" && !atMaximum) change(quantity + step)
        if (event.nativeEvent.actionName === "decrement" && !decrementDisabled) change(quantity - step)
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 4,
        padding: 4,
        minHeight: onCard ? 44 : small ? 40 : 52,
        borderRadius: onCard ? radius.control : radius.pill,
        backgroundColor: onCard ? palette.souki900 : onBuyBar ? palette.white : palette.pale50,
        alignSelf: onCard ? "stretch" : "auto",
      }}
    >
      {button(
        atMinimum && removable ? Trash2 : Minus,
        atMinimum && removable ? t("Retirer du panier") : t("Diminuer"),
        decrementDisabled,
        () => change(atMinimum ? 0 : quantity - step),
      )}
      <Text
        variant={onCard || small ? "callout" : "headline"}
        weight="black"
        color={onCard ? palette.white : palette.souki900}
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ flexShrink: 1, minWidth: onCard ? 40 : small ? 54 : 64, fontSize: small ? 14 : undefined, fontVariant: ["tabular-nums"] }}
      >
        {label}
      </Text>
      {button(Plus, t("Augmenter"), atMaximum, () => change(quantity + step))}
    </View>
  )
}
