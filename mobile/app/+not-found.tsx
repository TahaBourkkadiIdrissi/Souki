import { Link } from "expo-router"
import React from "react"
import { Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Screen } from "@/components/ui/Screen"

export default function NotFoundPage() {
  return (
    <Screen>
      <BrandHeader title="Page introuvable" />
      <View className="gap-4 p-6">
        <Text className="text-base text-text-body">Cette route n'existe pas encore dans Souki mobile.</Text>
        <Link href="/" className="font-bold text-primary">
          Retour a l'accueil
        </Link>
      </View>
    </Screen>
  )
}
