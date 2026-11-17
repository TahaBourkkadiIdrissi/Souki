import { useSegments } from "expo-router"
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui"

import { BottomDock, TABS } from "@/components/tab-bar"
import { useCart } from "@/contexts/cart-context"
import { colors } from "@/theme"

/** Écrans du compte et des commandes avec leur propre bouton collé en bas : pas de barre de navigation. */
const ACCOUNT_FORMS = new Set(["profil", "adresse", "securite", "changer-mot-de-passe", "supprimer-compte", "notifications", "suivi", "gerer", "reclamation"])

/**
 * Onglets SOUKI Android : barre de navigation Material 3 dessinée par l'app (fiche NavigationBar)
 * et mini-barre panier au-dessus. La `TabList` cachée déclare les routes ; la barre visible utilise
 * des `TabTrigger`. Sur une fiche produit, la barre s'efface pour laisser la place à la barre
 * d'achat ; la mini-barre est cachée sur l'onglet Panier.
 */
export default function TabsLayout() {
  const { count } = useCart()
  const segments = useSegments() as string[]
  const onProductPage = segments.includes("produit")
  const onCartTab = segments.includes("(panier)")
  const onAccountForm = segments.some((segment) => ACCOUNT_FORMS.has(segment))

  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.background }}>
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
