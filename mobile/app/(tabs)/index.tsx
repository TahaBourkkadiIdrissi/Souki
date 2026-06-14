import { Image } from "expo-image"
import type { Href } from "expo-router"
import { useRouter } from "expo-router"
import { Leaf, ShieldCheck, Truck } from "lucide-react-native"
import React from "react"
import { Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { useAuth } from "@/contexts/AuthContext"
import { colors } from "@/theme/tokens"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  const requireAuth = (path: string) => {
    router.push((isAuthenticated ? path : `/login?redirect=${encodeURIComponent(path)}`) as Href)
  }

  return (
    <Screen>
      <BrandHeader />
      <View className="gap-8 px-4 py-6">
        <View className="overflow-hidden rounded-xl bg-bg-card">
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=900&fit=crop"
            }}
            className="h-56 w-full"
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View className="gap-4 p-5">
            <Text className="text-4xl font-extrabold text-primary">SOUKI Fresh Market</Text>
            <Text className="text-base leading-6 text-text-body">
              Legumes frais du marche de gros de Fes, livres chez vous le matin meme.
            </Text>
            <Button onPress={() => requireAuth("/catalogue")}>Decouvrir nos produits</Button>
          </View>
        </View>

        <View className="gap-3">
          {[
            { icon: <Leaf color={colors.greenMarket} />, title: "Frais du matin", text: "Selection au marche de gros." },
            { icon: <Truck color={colors.orangeCta} />, title: "Livraison 8h-13h", text: "Commande ce soir, livraison demain." },
            { icon: <ShieldCheck color={colors.blueTrust} />, title: "Prix transparents", text: "Prix affiches et panier clair." }
          ].map((item) => (
            <View key={item.title} className="flex-row gap-4 rounded-xl bg-white p-4 shadow-soft">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-bg-card">{item.icon}</View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-text-body">{item.title}</Text>
                <Text className="text-sm text-text-muted">{item.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  )
}
