import { Link, useLocalSearchParams, type Href } from "expo-router"
import React from "react"
import { Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Screen } from "@/components/ui/Screen"

export default function PreLoginPage() {
  const params = useLocalSearchParams<{ redirect?: string }>()
  const redirect = params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : ""

  return (
    <Screen>
      <BrandHeader title="Connexion" subtitle="Choisissez votre espace" backHref="/" />
      <View className="gap-4 p-4">
        {[
          { href: `/login/client${redirect}`, title: "Client", text: "Commander et suivre mon panier." },
          { href: `/login/livreur${redirect}`, title: "Livreur", text: "Tournee, carte et livraisons." },
          { href: `/login/parent${redirect}`, title: "Parent", text: "Espace parent Souki." },
          { href: `/admin/login${redirect}`, title: "Admin", text: "Pilotage operationnel." }
        ].map((item) => (
          <Link key={item.title} href={item.href as Href} asChild>
            <View className="rounded-xl bg-white p-5 shadow-soft">
              <Text className="text-xl font-bold text-primary">{item.title}</Text>
              <Text className="mt-1 text-sm text-text-muted">{item.text}</Text>
            </View>
          </Link>
        ))}
      </View>
    </Screen>
  )
}
