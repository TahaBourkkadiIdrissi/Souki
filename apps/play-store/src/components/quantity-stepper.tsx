import { Pressable, View } from "react-native"
import { Minus, Plus, Trash2, type LucideIcon } from "lucide-react-native"
import { formatQuantity } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { m3, radius, sizes, states, withAlpha } from "@/theme"

type QuantityStepperProps = {
  quantity: number
  step: number
  /** Unité affichée (kg, lot, 250g…). */
  unit: string
  onChange: (quantity: number) => void
  /**
   * `card` : pleine largeur sous une carte produit (rempli `primary`) ;
   * `regular` : fiche produit (48 dp) ;
   * `small` : lignes de panier (40 dp, zone de toucher 48 dp).
   */
  size?: "card" | "regular" | "small"
  /** Le moins à la quantité minimale retire le produit (icône corbeille). */
  removable?: boolean
  /** Plus grande quantité autorisée (stock), facultatif. */
  max?: number
  /** Gardé pour compatibilité : la barre d'achat utilise le même style tonal. */
  tone?: "default" | "buy"
}

/**
 * Sélecteur de quantité au pas du produit (0,5 kg, 1 lot, 1 pièce), fiche CartLine du design :
 * pilule tonale `secondary-container` à coins de 12 dp, quantité en chiffres tabulaires qui
 * roulent ; version remplie `primary` sur la carte produit. Réglable avec TalkBack (glisser
 * vers le haut ou le bas).
 */
export function QuantityStepper({ quantity, step, unit, onChange, size = "regular", removable = true, max }: QuantityStepperProps) {
  const { t, locale } = useLocale()
  const filled = size === "card"
  const small = size === "small"
  const atMinimum = quantity <= step
  const atMaximum = max !== undefined && quantity + step > max
  const decrementDisabled = atMinimum && !removable
  const label = formatQuantity(quantity, unit, locale)
  const height = small ? 40 : sizes.controlMd
  const background = filled ? m3.primary : m3.secondaryContainer
  const foreground = filled ? m3.onPrimary : m3.onSecondaryContainer

  const change = (next: number) => {
    if (next <= 0) haptics.remove()
    else haptics.selection()
    onChange(next)
  }

  const button = (Icon: LucideIcon, accessibilityLabel: string, disabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={(sizes.touchMin - height) / 2 + 2}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      android_ripple={{ color: withAlpha(foreground, states.pressed + 0.06), borderless: true, radius: height / 2 }}
      style={{ width: height, height, alignItems: "center", justifyContent: "center", opacity: disabled ? states.disabledContent : 1 }}
    >
      <Icon size={small ? 18 : 20} color={foreground} strokeWidth={2.2} />
    </Pressable>
  )

  return (
    <View
      accessible
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
        minHeight: height,
        borderRadius: radius.control,
        backgroundColor: background,
        alignSelf: filled ? "stretch" : "auto",
      }}
    >
      {button(
        atMinimum && removable ? Trash2 : Minus,
        atMinimum && removable ? t("Retirer du panier") : t("Diminuer"),
        decrementDisabled,
        () => change(atMinimum ? 0 : quantity - step),
      )}
      <View style={{ minWidth: small ? 48 : 56, alignItems: "center", paddingHorizontal: 2 }}>
        <AnimatedDigits value={label} variant="labelLarge" weight="bold" color={foreground} />
      </View>
      {button(Plus, t("Augmenter"), atMaximum, () => change(quantity + step))}
    </View>
  )
}
