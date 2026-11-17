import { Pressable, View, type PressableProps } from "react-native"
import { TabTrigger, type TabTriggerSlotProps } from "expo-router/ui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { House, LayoutGrid, Receipt, ShoppingBasket, User, type LucideIcon } from "lucide-react-native"

import { FloatingCartBar } from "@/components/cart-bar"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { m3, sizes, states, withAlpha } from "@/theme"

/** Destinations : nom de la route du groupe, lien, libellé, icône Lucide. */
export const TABS: { name: string; href: "/marche" | "/produits" | "/panier" | "/commandes" | "/compte"; label: string; Icon: LucideIcon }[] = [
  { name: "(marche)", href: "/marche", label: "Accueil", Icon: House },
  { name: "(produits)", href: "/produits", label: "Produits", Icon: LayoutGrid },
  { name: "(panier)", href: "/panier", label: "Panier", Icon: ShoppingBasket },
  { name: "(commandes)", href: "/commandes", label: "Commandes", Icon: Receipt },
  { name: "(compte)", href: "/compte", label: "Compte", Icon: User },
]

/**
 * Hauteur de l'inset système sous la barre de navigation (navigation par gestes ou 3 boutons).
 * Ce qui est posé au-dessus de la barre se place à `useDockBottom() + sizes.tabBar`.
 */
export function useDockBottom() {
  return useSafeAreaInsets().bottom
}

/**
 * Espace à laisser sous le contenu qui défile pour ne rien cacher derrière la barre de
 * navigation (et la mini-barre panier quand elle est là).
 */
export function useDockInset() {
  const bottom = useDockBottom()
  const { count } = useCart()
  return bottom + sizes.tabBar + (count > 0 ? sizes.cartBar + 8 : 0) + 16
}

type BottomDockProps = {
  /** Mini-barre panier visible (dès le premier produit, hors onglet Panier). */
  showCartBar: boolean
}

/**
 * Bas de l'écran (fiche NavigationBar) : mini-barre panier, puis barre de navigation Material 3
 * collée au bord, bord à bord (elle s'étend sous la barre système).
 */
export function BottomDock({ showCartBar }: BottomDockProps) {
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      {showCartBar ? <FloatingCartBar /> : null}
      <NavigationBar />
    </View>
  )
}

/**
 * Barre de navigation Material 3 (variante courte 64 dp, M3 Expressive) : cinq destinations,
 * libellés toujours visibles (plafonnés à 115 % de taille de texte), icône active dans un
 * indicateur en pilule `primary-container`, badge orange à l'encre sur Panier.
 */
function NavigationBar() {
  const { t } = useLocale()
  const { count } = useCart()
  const bottom = useDockBottom()
  return (
    <View
      accessibilityRole="tablist"
      style={{
        paddingBottom: bottom,
        backgroundColor: m3.surfaceContainer,
        borderTopWidth: 1,
        borderTopColor: m3.outlineVariant,
      }}
    >
      <View style={{ minHeight: sizes.tabBar, flexDirection: "row", alignItems: "stretch" }}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <TabButton label={t(tab.label)} Icon={tab.Icon} badge={tab.name === "(panier)" ? count : 0} />
          </TabTrigger>
        ))}
      </View>
    </View>
  )
}

type TabButtonProps = TabTriggerSlotProps & { label: string; Icon: LucideIcon; badge: number }

/** Destination (reçoit `isFocused` et `onPress` du TabTrigger parent). */
function TabButton({ label, Icon, badge, isFocused, onPress, ref: _ref, ...props }: TabButtonProps) {
  const iconColor = isFocused ? m3.onPrimaryContainer : m3.onSurfaceVariant
  const labelColor = isFocused ? m3.onSurface : m3.onSurfaceVariant
  return (
    <Pressable
      {...(props as PressableProps)}
      onPress={(event) => {
        if (!isFocused) haptics.selection()
        onPress?.(event)
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={badge > 0 ? `${label}, ${badge}` : label}
      android_ripple={{ color: withAlpha(m3.onSurface, states.pressed), borderless: true, radius: 36 }}
      style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6 }}
    >
      <View
        style={{
          width: 56,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isFocused ? m3.primaryContainer : "transparent",
        }}
      >
        <Icon size={22} color={iconColor} strokeWidth={isFocused ? 2.4 : 2} />
        {badge > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              end: 6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 4,
              backgroundColor: m3.tertiaryContainer,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Orange-500 à l'encre (5,4:1), dans les deux thèmes. */}
            <Text variant="labelSmall" weight="bold" numeric color={m3.onTertiaryContainer} maxFontSizeMultiplier={1.15} style={{ fontSize: 11, lineHeight: 16, letterSpacing: 0 }}>
              {badge > 99 ? "99+" : String(badge)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="labelMedium" color={labelColor} numberOfLines={1} align="center" maxFontSizeMultiplier={1.15} adjustsFontSizeToFit minimumFontScale={0.85} style={{ alignSelf: "stretch", paddingHorizontal: 2 }}>
        {label}
      </Text>
    </Pressable>
  )
}
