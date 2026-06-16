import { Image } from "expo-image"
import { Plus } from "lucide-react-native"
import React from "react"
import { Pressable, Text, View } from "react-native"

import type { CatalogueProduct } from "@/lib/catalogue"
import { colors } from "@/theme/tokens"

export function ProductCard({
  product,
  onAdd
}: {
  product: CatalogueProduct
  onAdd: (product: CatalogueProduct) => void
}) {
  return (
    <View className="mb-4 overflow-hidden rounded-xl bg-white shadow-soft">
      <Image
        source={{ uri: product.image }}
        className="h-36 w-full bg-bg-card"
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View className="gap-2 p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-text-body">{product.name}</Text>
            <Text className="text-sm text-text-muted">{product.alias}</Text>
          </View>
          <Text className="text-lg font-extrabold text-primary">{product.price.toFixed(2)} DH</Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase text-text-muted">{product.displayUnit}</Text>
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-xl bg-accent"
            onPress={() => onAdd(product)}
          >
            <Plus color={colors.white} size={22} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}
