import { useLocalSearchParams, useRouter } from "expo-router"
import React, { useState } from "react"
import { Alert, Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { TextField } from "@/components/ui/TextField"
import { submitCheckout } from "@/services/api/endpoints"
import { useCartStore } from "@/store/cartStore"

export default function CheckoutPage() {
  const router = useRouter()
  const params = useLocalSearchParams<{ panier_id?: string }>()
  const clearCart = useCartStore((state) => state.clear)
  const [adresse, setAdresse] = useState("")
  const [telephone, setTelephone] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!params.panier_id || !adresse || !telephone) {
      Alert.alert("Formulaire incomplet", "Adresse, telephone et panier sont obligatoires.")
      return
    }
    setLoading(true)
    try {
      const response = await submitCheckout({
        panier_id: Number(params.panier_id),
        adresse,
        telephone,
        mode_paiement: "COD"
      })
      await clearCart()
      Alert.alert("Commande validee", `Commande #${response.commande_id}`)
      router.replace(`/catalogue?commande_validee=${response.commande_id}`)
    } catch (error) {
      Alert.alert("Checkout impossible", error instanceof Error ? error.message : "Erreur API")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <BrandHeader title="Checkout" subtitle="Adresse et confirmation de commande" backHref="/catalogue" />
      <View className="gap-5 p-4">
        <View className="rounded-xl bg-bg-card p-4">
          <Text className="font-bold text-text-body">Panier #{params.panier_id || "-"}</Text>
          <Text className="mt-1 text-sm text-text-muted">Paiement a la livraison, comme le flow web COD.</Text>
        </View>
        <TextField label="Telephone" keyboardType="phone-pad" value={telephone} onChangeText={setTelephone} />
        <TextField label="Adresse complete" multiline value={adresse} onChangeText={setAdresse} />
        <Button loading={loading} onPress={submit}>
          Confirmer la commande
        </Button>
      </View>
    </Screen>
  )
}
