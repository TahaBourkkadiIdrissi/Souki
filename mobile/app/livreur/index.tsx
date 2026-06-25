import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { CheckCircle2, Navigation, PackageCheck, Truck } from "lucide-react-native"
import React from "react"
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { MapboxDeliveryMap } from "@/components/souki/MapboxDeliveryMap"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { useAuth } from "@/contexts/AuthContext"
import {
  demarrerLivreurTournee,
  envoyerEvenementLivraison,
  getLivreurTournee
} from "@/services/api/endpoints"
import { colors } from "@/theme/tokens"

export default function LivreurPage() {
  const { isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["livreur-tournee"],
    queryFn: () => getLivreurTournee(),
    enabled: isAuthenticated
  })

  const updateStatus = async (commandeId: number, status: "EN_ROUTE" | "LIVRE" | "ABSENT" | "REFUS", version?: number) => {
    try {
      await envoyerEvenementLivraison(commandeId, status, version)
      await refetch()
    } catch (caught) {
      Alert.alert("Action impossible", caught instanceof Error ? caught.message : "Erreur API")
    }
  }

  if (!isAuthenticated) {
    return (
      <Screen>
        <BrandHeader title="Espace livreur" backHref="/" />
        <View className="gap-4 p-4">
          <Text className="text-text-body">Connectez-vous pour consulter votre tournee.</Text>
          <Button variant="accent" onPress={() => undefined}>
            Ouvrir via l'onglet Connexion
          </Button>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <BrandHeader title="Tournee livreur" subtitle="Carte Mapbox et statuts de livraison" backHref="/" />
      <View className="gap-5 p-4">
        {isLoading ? <ActivityIndicator color={colors.greenMarket} /> : null}
        {error ? <Text className="text-destructive">{(error as Error).message}</Text> : null}
        {data ? (
          <>
            <View className="rounded-xl bg-bg-card p-4">
              <Text className="text-lg font-extrabold text-text-body">{data.items.length} livraison(s)</Text>
              <Text className="text-sm text-text-muted">Date : {data.date_jour}</Text>
              <Button
                variant="accent"
                onPress={() => void demarrerLivreurTournee().then(() => refetch())}
              >
                Demarrer la tournee
              </Button>
            </View>
            <MapboxDeliveryMap items={data.items} />
            {data.items.map((item) => (
              <View key={item.commande_id} className="gap-3 rounded-xl bg-white p-4 shadow-soft">
                <View className="flex-row items-start gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-bg-card">
                    <Truck color={colors.greenMarket} size={20} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-text-body">Commande #{item.commande_id}</Text>
                    <Text className="text-sm text-text-muted">{item.client_label}</Text>
                    <Text className="mt-1 text-sm text-text-body">{item.full_address}</Text>
                  </View>
                </View>
                <Text className="font-semibold text-primary">{item.statut}</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    className="flex-1 items-center rounded-xl bg-blue-trust p-3"
                    onPress={() => void updateStatus(item.commande_id, "EN_ROUTE", item.status_version)}
                  >
                    <Navigation color="#FFFFFF" size={18} />
                  </Pressable>
                  <Pressable
                    className="flex-1 items-center rounded-xl bg-primary p-3"
                    onPress={() => void updateStatus(item.commande_id, "LIVRE", item.status_version)}
                  >
                    <PackageCheck color="#FFFFFF" size={18} />
                  </Pressable>
                  <Pressable
                    className="flex-1 items-center rounded-xl bg-accent p-3"
                    onPress={() => void updateStatus(item.commande_id, "ABSENT", item.status_version)}
                  >
                    <CheckCircle2 color="#FFFFFF" size={18} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
        <Button
          variant="outline"
          onPress={async () => {
            await logout()
            router.replace("/login")
          }}
          className="mt-4 border-red-200"
        >
          <Text className="text-red-500 font-bold">Déconnexion</Text>
        </Button>
      </View>
    </Screen>
  )
}
