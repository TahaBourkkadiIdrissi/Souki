import { Tabs } from "expo-router"
import { Home } from "lucide-react-native"
import React from "react"

import { colors } from "@/theme/tokens"

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.greenMarket,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: "#E5E7EB",
          height: 64,
          paddingBottom: 8,
          paddingTop: 8
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ color }) => <Home color={color} size={20} /> }} />
    </Tabs>
  )
}
