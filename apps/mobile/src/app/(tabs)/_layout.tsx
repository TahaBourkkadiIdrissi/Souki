import { View } from "react-native"
import { useSegments } from "expo-router"
import { NativeTabs } from "expo-router/native-tabs"

import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui"

import { CartBar, FloatingCartBar, NATIVE_CART_ACCESSORY } from "@/components/cart-bar"
import { BottomDock, TABS } from "@/components/tab-bar"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { fonts, palette } from "@/theme"

const ACCOUNT_FORMS = new Set(["profil", "adresse", "securite", "changer-mot-de-passe", "supprimer-compte", "notifications", "suivi", "gerer", "reclamation"])

/**
 * Onglets SOUKI (TabBar + CartBar du design system 2027), dessines par l'app pour etre
 * identiques sur toutes les versions d'iOS (l'iPhone de test est en iOS 18, sans verre natif).
 * La `TabList` cachee declare les routes ; le dock visible (mini-barre panier + capsule
 * d'onglets) utilise des `TabTrigger`. Sur une fiche produit, le dock s'efface pour laisser
 * la place a la barre d'achat ; la mini-barre est cachee sur l'onglet Panier.
 */
export default function TabsLayout() {
  const { count } = useCart()
  const segments = useSegments() as string[]
  const onProductPage = segments.includes("produit")
  const onCartTab = segments.includes("(panier)")
  // Ecrans du compte avec leur propre bouton colle en bas : pas de dock (prototype).
  const onAccountForm = segments.some((segment) => ACCOUNT_FORMS.has(segment))

  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot />
      {onProductPage || onAccountForm ? null : <BottomDock showCartBar={count > 0 && !onCartTab} />}
      <TabList style={{ display: "none" }}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
        ))}
      </TabList>
    </Tabs>
  )
}

/**
 * Ancienne version : barre d'onglets native d'iOS (verre « Liquid Glass » a partir d'iOS 26)
 * et accessoire natif pour la mini-barre. Gardee pour revenir au natif si besoin.
 */
export function NativeTabsLayout() {
  const { t } = useLocale()
  const { count } = useCart()
  const segments = useSegments() as string[]
  const onProductPage = segments.includes("produit")
  // La mini-barre est cachee sur l'onglet Panier (le panier est deja a l'ecran).
  const onCartTab = segments.includes("(panier)")

  const showCartBar = count > 0 && !onProductPage && !onCartTab

  return (
    <View style={{ flex: 1 }}>
    <NativeTabs
      // TabBar 2027 : onglet actif souki-900, inactifs ink-500 ; haptique `selection`, aucune animation.
      tintColor={palette.souki900}
      iconColor={{ default: palette.ink500, selected: palette.souki900 }}
      // Sur iOS le texte de la pastille native reste blanc : orange-700 (7:1) au lieu de orange-500 (2,8:1).
      badgeBackgroundColor={palette.orange700}
      minimizeBehavior="onScrollDown"
      hidden={onProductPage}
      labelStyle={{
        default: { fontFamily: fonts.latin.semibold, fontSize: 10, color: palette.ink500 },
        selected: { fontFamily: fonts.latin.bold, fontSize: 10, color: palette.souki900 },
      }}
      screenListeners={{ tabPress: () => haptics.selection() }}
    >
      {showCartBar && NATIVE_CART_ACCESSORY ? (
        <NativeTabs.BottomAccessory>
          <CartBar />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="(marche)">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>{t("Accueil")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(produits)">
        <NativeTabs.Trigger.Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} md="grid_view" />
        <NativeTabs.Trigger.Label>{t("Produits")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(panier)">
        <NativeTabs.Trigger.Icon sf={{ default: "basket", selected: "basket.fill" }} md="shopping_basket" />
        <NativeTabs.Trigger.Label>{t("Panier")}</NativeTabs.Trigger.Label>
        {count > 0 ? <NativeTabs.Trigger.Badge>{String(count)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(commandes)">
        <NativeTabs.Trigger.Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} md="receipt_long" />
        <NativeTabs.Trigger.Label>{t("Commandes")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(compte)">
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
        <NativeTabs.Trigger.Label>{t("Compte")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
    {/* Avant iOS 26, pas d'accessoire natif : la bulle est dessinee au-dessus des onglets. */}
    {showCartBar && !NATIVE_CART_ACCESSORY ? <FloatingCartBar /> : null}
    </View>
  )
}
