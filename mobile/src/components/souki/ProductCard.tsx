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
    <View className="mb-4 overflow-hidden rounded-2xl bg-white shadow-soft">
      {/* Visuel carre pour un rendu e-commerce homogene */}
      <Image
        source={{ uri: product.image }}
        className="aspect-square w-full bg-bg-card"
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View className="gap-2 p-3">
        {/* Nom + alias tronques pour ne jamais chevaucher le prix */}
        <View className="min-w-0">
          <Text numberOfLines={1} className="text-base font-bold text-text-body">
            {product.name}
          </Text>
          <Text numberOfLines={1} className="text-xs text-text-muted">
            {product.alias}
          </Text>
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-base font-extrabold text-primary">
              {product.price.toFixed(2)} DH
            </Text>
            <Text numberOfLines={1} className="text-[11px] font-semibold uppercase text-text-muted">
              / {product.displayUnit}
            </Text>
          </View>
          <Pressable
            className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent"
            onPress={() => onAdd(product)}
          >
            <Plus color={colors.white} size={20} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}
