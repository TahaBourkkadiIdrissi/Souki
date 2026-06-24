import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import React from "react"
import { ActivityIndicator, Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { useAuth } from "@/contexts/AuthContext"
import { getProfile } from "@/services/api/endpoints"
import { colors } from "@/theme/tokens"

export default function ParametresPage() {
  const { isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const { data, isLoading, error } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: isAuthenticated
  })

  return (
    <Screen>
      <BrandHeader title="Parametres" subtitle="Compte et preferences" backHref="/" />
      <View className="gap-4 p-4">
        {!isAuthenticated ? <Text className="text-text-body">Connectez-vous pour gerer votre compte.</Text> : null}
        {isLoading ? <ActivityIndicator color={colors.greenMarket} /> : null}
        {error ? <Text className="text-destructive">{(error as Error).message}</Text> : null}
        {data ? (
          <View className="gap-2 rounded-xl bg-white p-4 shadow-soft">
            <Text className="text-xl font-bold text-text-body">
              {data.prenom} {data.nom}
            </Text>
            <Text className="text-sm text-text-muted">{data.email}</Text>
            <Text className="text-sm text-text-muted">{data.telephone}</Text>
            <Text className="text-sm text-text-body">{data.address?.adresse}</Text>
          </View>
        ) : null}
        <Button variant="outline" onPress={async () => {
          await logout()
          router.replace('/login')
        }}>
          Deconnexion
        </Button>
      </View>
    </Screen>
  )
}
