import { useQuery } from "@tanstack/react-query"
import { ChartNoAxesCombined, Truck, Users } from "lucide-react-native"
import React from "react"
import { ActivityIndicator, Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { StatCard } from "@/components/souki/StatCard"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { useAuth } from "@/contexts/AuthContext"
import { getAdminDashboard } from "@/services/api/endpoints"
import { colors } from "@/theme/tokens"

export default function AdminPage() {
  const { isAuthenticated, can, hasRole } = useAuth()
  const allowed = isAuthenticated && (hasRole("ADMIN") || can("dashboard.read"))
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
    enabled: allowed
  })

  if (!allowed) {
    return (
      <Screen>
        <BrandHeader title="Admin" backHref="/" />
        <View className="gap-4 p-4">
          <Text className="text-text-body">Connexion admin requise.</Text>
          <Button onPress={() => undefined}>Utiliser /admin/login</Button>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <BrandHeader title="Dashboard admin" subtitle="Vue operationnelle du web" backHref="/" />
      <View className="gap-4 p-4">
        {isLoading ? <ActivityIndicator color={colors.greenMarket} /> : null}
        {error ? <Text className="text-destructive">{(error as Error).message}</Text> : null}
        {data ? (
          <>
            <View className="flex-row gap-3">
              <StatCard label="CA total" value={`${data.ca_total} DH`} icon={<ChartNoAxesCombined color={colors.greenMarket} />} />
              <StatCard label="Commandes" value={data.total_commandes} icon={<Users color={colors.blueTrust} />} />
            </View>
            <View className="flex-row gap-3">
              <StatCard label="Livrees" value={data.commandes_livrees} />
              <StatCard label="Livreurs" value={data.livreurs_disponibles} icon={<Truck color={colors.orangeCta} />} />
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  )
}
