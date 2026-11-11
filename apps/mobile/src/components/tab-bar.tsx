import { Pressable, View, type PressableProps } from "react-native"
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from "react-native-reanimated"
import { TabTrigger, type TabTriggerSlotProps } from "expo-router/ui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { House, LayoutGrid, Receipt, ShoppingBasket, User, type LucideIcon } from "lucide-react-native"

import { FloatingCartBar } from "@/components/cart-bar"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, EASE_OUT_2027 } from "@/lib/motion"
import { palette, shadows, sizes } from "@/theme"

/** Onglets du prototype : nom de la route du groupe, lien, libelle, icone Lucide. */
export const TABS: { name: string; href: "/marche" | "/produits" | "/panier" | "/commandes" | "/compte"; label: string; Icon: LucideIcon }[] = [
  { name: "(marche)", href: "/marche", label: "Accueil", Icon: House },
  { name: "(produits)", href: "/produits", label: "Produits", Icon: LayoutGrid },
  { name: "(panier)", href: "/panier", label: "Panier", Icon: ShoppingBasket },
  { name: "(commandes)", href: "/commandes", label: "Commandes", Icon: Receipt },
  { name: "(compte)", href: "/compte", label: "Compte", Icon: User },
]

/** Distance entre le bas de l'ecran et la capsule d'onglets (le prototype la pose a 10 pt). */
export function useDockBottom() {
  const insets = useSafeAreaInsets()
  return Math.max(insets.bottom - 20, 10)
}

/**
 * Espace a laisser sous le contenu defilant pour ne rien cacher derriere le dock
 * (capsule d'onglets + mini-barre panier quand elle est la).
 */
export function useDockInset() {
  const bottom = useDockBottom()
  const { count } = useCart()
  return bottom + sizes.tabBar + (count > 0 ? sizes.cartBar + 8 : 0) + 24
}

type BottomDockProps = {
  /** Mini-barre panier visible (des le premier produit, hors onglet Panier). */
  showCartBar: boolean
}

/**
 * Dock du bas (prototype) : mini-barre panier puis capsule d'onglets en verre, a 12 pt des
 * bords. Dessine par l'app, il est identique sur toutes les versions d'iOS.
 */
export function BottomDock({ showCartBar }: BottomDockProps) {
  const bottom = useDockBottom()
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      pointerEvents="box-none"
      entering={reducedMotion ? undefined : FadeInDown.duration(DUR_BASE).easing(EASE_OUT_2027)}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(160)}
      style={{ position: "absolute", left: 12, right: 12, bottom, gap: 8 }}
    >
      {showCartBar ? <FloatingCartBar /> : null}
      <TabBar />
    </Animated.View>
  )
}

/**
 * Barre d'onglets en verre (TabBar, design system 2027) : capsule de 64 pt, onglet actif
 * souki-900 sur une lentille souki-900 a 9 %, pastille orange a l'encre sur Panier.
 * Aucune animation au changement d'onglet ; haptique `selection`.
 */
function TabBar() {
  const { t } = useLocale()
  const { count } = useCart()
  return (
    <View style={{ borderRadius: 999, boxShadow: shadows.float }}>
      <View
        accessibilityRole="tablist"
        style={{
          height: sizes.tabBar,
          padding: 4,
          borderRadius: 999,
          backgroundColor: "rgba(251, 251, 247, 0.96)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.8)",
          flexDirection: "row",
          alignItems: "stretch",
          justifyContent: "space-between",
        }}
      >
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

/** Bouton d'onglet (recoit `isFocused` et `onPress` du TabTrigger parent). */
function TabButton({ label, Icon, badge, isFocused, onPress, ref: _ref, ...props }: TabButtonProps) {
  const color = isFocused ? palette.souki900 : palette.ink500
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
      style={{
        flex: 1,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        backgroundColor: isFocused ? "rgba(0, 91, 67, 0.09)" : "transparent",
      }}
    >
      <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} />
      <Text variant="eyebrow" weight={isFocused ? "black" : "bold"} color={color} numberOfLines={1} style={{ fontSize: 10, lineHeight: 12, letterSpacing: 0, textTransform: "none" }}>
        {label}
      </Text>
      {badge > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            start: "50%",
            marginStart: 6,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 5,
            backgroundColor: palette.orange500,
            borderWidth: 2,
            borderColor: palette.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Pastille du panier : orange-500 a l'encre (5,4:1), comme le prototype. */}
          <Text variant="eyebrow" weight="black" numeric color={palette.ink900} style={{ fontSize: 11, lineHeight: 13, letterSpacing: 0 }}>
            {badge > 99 ? "99+" : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
