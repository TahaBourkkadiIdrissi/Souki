import React from "react"
import { Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Screen } from "@/components/ui/Screen"

export function AdminSectionScreen({ title, description }: { title: string; description: string }) {
  return (
    <Screen>
      <BrandHeader title={title} subtitle="Module admin Souki" backHref="/admin" />
      <View className="gap-4 p-4">
        <View className="rounded-xl bg-bg-card p-5">
          <Text className="text-lg font-bold text-text-body">{title}</Text>
          <Text className="mt-2 text-sm leading-5 text-text-muted">{description}</Text>
        </View>
      </View>
    </Screen>
  )
}
