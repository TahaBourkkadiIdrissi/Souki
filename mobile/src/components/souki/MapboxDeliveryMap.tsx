import Mapbox from "@rnmapbox/maps"
import React, { useMemo } from "react"
import { Text, View } from "react-native"

import type { TourneeItem } from "@/types/api"

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

if (token) {
  Mapbox.setAccessToken(token)
}

export function MapboxDeliveryMap({ items }: { items: TourneeItem[] }) {
  const coordinates = useMemo(() => {
    return items
      .map((item) => [item.lng ?? item.longitude, item.lat ?? item.latitude] as [number | null | undefined, number | null | undefined])
      .filter((pair): pair is [number, number] => typeof pair[0] === "number" && typeof pair[1] === "number")
  }, [items])

  if (!token) {
    return (
      <View className="h-64 items-center justify-center rounded-xl bg-bg-card p-6">
        <Text className="text-center font-semibold text-text-body">
          Ajoutez EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN pour activer la carte livreur.
        </Text>
      </View>
    )
  }

  return (
    <View className="h-72 overflow-hidden rounded-xl bg-bg-card">
      <Mapbox.MapView style={{ flex: 1 }} styleURL="mapbox://styles/zmarou/cmo758hgx002m01qveoyp7e5c">
        <Mapbox.Camera
          zoomLevel={coordinates.length ? 12 : 10}
          centerCoordinate={coordinates[0] || [-4.9998, 34.0331]}
        />
        {coordinates.map((coordinate, index) => (
          <Mapbox.PointAnnotation key={`${coordinate.join("-")}-${index}`} id={`delivery-${index}`} coordinate={coordinate}>
            <View className="h-5 w-5 rounded-full bg-accent" />
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>
    </View>
  )
}
