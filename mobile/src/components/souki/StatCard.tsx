import React, { ReactNode } from "react"
import { Text, View } from "react-native"

export function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <View className="flex-1 rounded-xl bg-white p-4 shadow-soft">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase text-text-muted">{label}</Text>
        {icon}
      </View>
      <Text className="text-2xl font-extrabold text-text-body">{value}</Text>
    </View>
  )
}
