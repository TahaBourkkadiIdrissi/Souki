import { useEffect } from "react"
import { View } from "react-native"
import { MapPin } from "lucide-react-native"
import { isInServiceArea, SERVICE_CENTER, type Coordinates } from "@souki/shared"

import { Text } from "@/components/text"
import { m3, radius } from "@/theme"

/**
 * Aperçu web de développement uniquement (captures, revue de design) : `react-native-maps`
 * n'existe pas sur le web. L'app Android utilise `map-picker.tsx` (Google Maps). Même API.
 */
export type PickedPlace = {
  coordinates: Coordinates
  inZone: boolean
  street: string
  area: string
  city: string
  postalCode: string
}

type MapPickerProps = {
  height?: number
  initial?: Coordinates | null
  onPick: (place: PickedPlace) => void
  full?: boolean
  pinOffset?: number
}

export function MapPicker({ height = 250, initial, onPick, full = false }: MapPickerProps) {
  useEffect(() => {
    const coordinates = initial ?? SERVICE_CENTER
    onPick({ coordinates, inZone: isInServiceArea(coordinates), street: "", area: "Fès", city: "Fès", postalCode: "" })
    // Une seule position de départ : la carte ne bouge pas dans l'aperçu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View
      style={{
        height: full ? undefined : height,
        flex: full ? 1 : undefined,
        borderRadius: full ? 0 : radius.card,
        overflow: "hidden",
        backgroundColor: m3.surfaceContainerHigh,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <MapPin size={32} color={m3.primary} strokeWidth={2.2} />
      <Text variant="bodySmall" color={m3.onSurfaceVariant}>
        Carte (aperçu web)
      </Text>
    </View>
  )
}
