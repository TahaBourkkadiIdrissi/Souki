import { ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Repeat, ShoppingBasket } from "lucide-react-native"
import { formatDirhams, formatQuantity, productName, roundToStep } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { ProductImage } from "@/components/product-image"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { orderLineImage, useOrder } from "@/hooks/use-orders"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius } from "@/theme"

/**
 * Recommander (EcranGerer > Recommander, design system 2027) : feuille avec les memes
 * produits aux prix d'aujourd'hui ; les produits absents du catalogue du jour ou en rupture
 * sont grises et exclus. Ils s'ajoutent au panier, ou l'on peut encore ajuster.
 * « Répéter automatiquement » ouvre l'abonnement depuis cette commande.
 */
export default function RecommanderSheet() {
  const router = useRouter()
  const { t, locale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { add } = useCart()
  const { productsById } = useCatalogue()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { order } = useOrder(Number(id))

  const rows = (order?.produits ?? []).map((line, index) => {
    const live = line.product_id ? productsById.get(line.product_id) : undefined
    const available = Boolean(live && live.availability !== "out_of_stock")
    const quantity = live ? Math.max(live.quantityStep, roundToStep(line.quantite_kg, live.quantityStep)) : line.quantite_kg
    return { key: `${line.ligne_panier_id ?? index}`, line, live, available, quantity, price: live ? live.price * quantity : null }
  })
  const addable = rows.filter((row) => row.available)
  const total = addable.reduce((sum, row) => sum + (row.price ?? 0), 0)

  const reorder = () => {
    for (const row of addable) if (row.live) add(row.live, row.quantity)
    haptics.success()
    router.back()
    router.navigate("/panier")
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 10 }}>
        <Text accessibilityRole="header" variant="title2" weight="black" color={palette.ink900} style={{ fontSize: 22 }}>
          {t("Recommander N-{id}", { id: order?.id ?? id })}
        </Text>
        <Text variant="footnote" color={palette.ink500} style={{ fontSize: 13, lineHeight: 18, marginBottom: 4 }}>
          {t("Les mêmes produits, aux prix d'aujourd'hui. Vous pourrez ajuster dans le panier.")}
        </Text>
        {rows.map((row) => {
          const name = row.live ? productName(row.live, locale) : locale === "ar" && row.line.nom_ar ? row.line.nom_ar : row.line.nom_fr
          return (
            <View key={row.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: row.available ? 1 : 0.55 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, overflow: "hidden", backgroundColor: palette.pale50 }}>
                <ProductImage uri={orderLineImage(row.line, productsById)} variant="inset" style={{ width: 40, height: 40 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 15 }}>
                  {name}
                </Text>
                <Text variant="footnote" numeric color={palette.ink500} style={{ fontSize: 12 }}>
                  {formatQuantity(row.quantity, row.live?.unit ?? "kg", locale)}
                </Text>
              </View>
              {row.available && row.price !== null ? (
                <Text variant="callout" weight="heavy" numeric color={palette.market700} style={{ fontSize: 14 }}>
                  {`${formatDirhams(row.price)} DH`}
                </Text>
              ) : (
                <View style={{ height: 24, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center", backgroundColor: palette.sand }}>
                  <Text variant="footnote" weight="heavy" color={palette.ink500} style={{ fontSize: 11 }}>
                    {t("Rupture")}
                  </Text>
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }}>
        <BrandButton
          icon={ShoppingBasket}
          label={t(addable.length === 1 ? "Ajouter {n} produit" : "Ajouter {n} produits", { n: addable.length })}
          trailing={addable.length > 0 ? `${formatDirhams(total)} DH` : undefined}
          disabled={addable.length === 0}
          onPress={reorder}
        />
        {/* Abonnement depuis cette commande (POST /api/commandes-recurrentes/depuis-commande). */}
        <BrandButton
          tone="ghost"
          size="md"
          icon={Repeat}
          label={t("Répéter automatiquement")}
          onPress={() => {
            router.back()
            router.push(`/abonner?commande=${order?.id ?? id}`)
          }}
        />
      </View>
    </View>
  )
}
