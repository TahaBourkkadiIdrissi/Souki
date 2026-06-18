import { Link } from "expo-router"
import React from "react"
import { Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Screen } from "@/components/ui/Screen"

export default function ParentPage() {
  return (
    <Screen>
      <BrandHeader title="Espace parent" backHref="/" />
      <View className="gap-4 p-4">
        <Text className="text-base text-text-body">
          Espace parent miroir du web, pret a recevoir les modules commandes et suivi familial.
        </Text>
        <Link href="/catalogue" className="font-bold text-primary">
          Aller au catalogue
        </Link>
      </View>
    </Screen>
  )
}
