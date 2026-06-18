import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import React, { useMemo, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { ProductCard } from "@/components/souki/ProductCard"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { fetchCatalogueProducts } from "@/lib/catalogue"
import { submitManualBasket } from "@/services/api/endpoints"
import { useCartStore } from "@/store/cartStore"

export default function CataloguePage() {
  const router = useRouter()
  const cart = useCartStore((state) => state.cart)
  const addItem = useCartStore((state) => state.addItem)
  const [submitting, setSubmitting] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ["catalogue"],
    queryFn: fetchCatalogueProducts
  })

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart])

  const submitCart = async () => {
    setSubmitting(true)
    try {
      const response = await submitManualBasket(
        cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          prix_unitaire: item.price
        }))
      )
      router.push(`/checkout?panier_id=${response.panier_id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <BrandHeader title="Nos legumes" subtitle="Catalogue synchronise avec FastAPI" backHref="/" />
      <View className="gap-4 px-4 py-5">
        {cart.length ? (
          <View className="rounded-xl bg-primary p-4">
            <Text className="text-lg font-extrabold text-white">
              {cart.length} article{cart.length > 1 ? "s" : ""} - {total.toFixed(2)} DH
            </Text>
            <Text className="mb-3 text-sm text-white/80">Panier conserve localement comme le web.</Text>
            <Button variant="accent" loading={submitting} disabled={!cart.length} onPress={submitCart}>
              Valider mon panier
            </Button>
          </View>
        ) : null}

        {isLoading ? <ActivityIndicator color="#1E8A3C" /> : null}
        {error ? <Text className="text-destructive">Catalogue indisponible : {(error as Error).message}</Text> : null}
        {data?.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={(item) => void addItem(item, item.quantityStep)} />
        ))}
      </View>
    </Screen>
  )
}
