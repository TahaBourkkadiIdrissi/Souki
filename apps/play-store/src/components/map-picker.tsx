import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import MapView, { type Region } from "react-native-maps"
import * as Location from "expo-location"
import { LocateFixed, MapPin } from "lucide-react-native"
import { isInServiceArea, SERVICE_CENTER, type Coordinates } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { palette, radius, shadows } from "@/theme"

export type PickedPlace = {
  coordinates: Coordinates
  inZone: boolean
  /** Rue et numero trouves par le geocodeur d'Apple (peut etre vide). */
  street: string
  /** Quartier ou ville pour l'etiquette. */
  area: string
  city: string
  postalCode: string
}

type MapPickerProps = {
  height?: number
  /** Position de depart ; sinon le centre de Fes. */
  initial?: Coordinates | null
  /** Appele quand la carte s'arrete (adresse mise a jour). */
  onPick: (place: PickedPlace) => void
  /** Carte plein ecran (adresse du compte) : coins droits. */
  full?: boolean
  /** Remonte l'epingle (pt) ; 0 = pointe au centre de la carte, la ou l'adresse est lue. */
  pinOffset?: number
}

const DELTA = { latitudeDelta: 0.012, longitudeDelta: 0.012 }

/** Adresse lisible a partir du geocodage inverse d'Apple Plans. */
async function describe(coordinates: Coordinates): Promise<Omit<PickedPlace, "coordinates" | "inZone">> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coordinates)
    if (!place) return { street: "", area: "", city: "", postalCode: "" }
    const street = [place.streetNumber, place.street].filter(Boolean).join(" ") || place.name || ""
    return { street, area: place.district || place.subregion || place.city || "", city: place.city || "", postalCode: place.postalCode || "" }
  } catch {
    return { street: "", area: "", city: "", postalCode: "" }
  }
}

/**
 * Choix de l'adresse sur une carte (MapPicker, design system 2027) : Apple Plans, epingle
 * fixe au centre qui se souleve pendant le glissement et retombe en ressort (420 ms) avec un
 * retour haptique ; « Me localiser » centre la carte sur la position. Hors de Fes, l'epingle
 * passe en orange a l'encre.
 */
export function MapPicker({ height = 250, initial, onPick, full = false, pinOffset = 0 }: MapPickerProps) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const mapRef = useRef<MapView>(null)
  const [label, setLabel] = useState("")
  const [inZone, setInZone] = useState(true)
  const [locating, setLocating] = useState(false)
  const lift = useSharedValue(0)
  const start = initial ?? SERVICE_CENTER
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }))

  const settle = async (region: Region, silent = false) => {
    lift.set(reducedMotion ? 0 : withSpring(0, { damping: 12, stiffness: 260 }))
    if (!silent) haptics.add()
    const coordinates = { latitude: region.latitude, longitude: region.longitude }
    const zone = isInServiceArea(coordinates)
    setInZone(zone)
    const details = await describe(coordinates)
    setLabel(details.area || details.street)
    onPick({ coordinates, inZone: zone, ...details })
  }

  // Premiere adresse au montage (la carte ne s'arrete pas tant qu'on n'y touche pas).
  useEffect(() => {
    void settle({ ...start, ...DELTA }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const locate = async () => {
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== "granted") return
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      mapRef.current?.animateToRegion({ latitude: position.coords.latitude, longitude: position.coords.longitude, ...DELTA }, 400)
    } catch {
      // Position indisponible : l'utilisateur deplace la carte a la main.
    } finally {
      setLocating(false)
    }
  }

  return (
    <View style={{ height: full ? undefined : height, flex: full ? 1 : undefined, borderRadius: full ? 0 : radius.card, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#EEF1EA" }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{ ...start, ...DELTA }}
        showsUserLocation
        showsPointsOfInterests={false}
        onRegionChange={() => {
          if (!reducedMotion) lift.set(withTiming(-10, { duration: 120 }))
        }}
        onRegionChangeComplete={(region) => void settle(region)}
        accessibilityLabel={t("Carte : déplacez la carte pour placer l'épingle sur votre porte")}
      />

      {/* Epingle fixe au centre */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingBottom: 56 + pinOffset }}>
        <Animated.View style={[{ alignItems: "center" }, pinStyle]}>
          <View
            style={{
              width: 46,
              height: 46,
              borderTopLeftRadius: 23,
              borderTopRightRadius: 23,
              borderBottomRightRadius: 23,
              borderBottomLeftRadius: 0,
              transform: [{ rotate: "-45deg" }],
              backgroundColor: inZone ? palette.souki900 : palette.orange500,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 18px -8px rgba(0, 91, 67, 0.8)",
            }}
          >
            <View style={{ transform: [{ rotate: "45deg" }] }}>
              <MapPin size={20} color={inZone ? palette.white : palette.ink900} strokeWidth={2.4} />
            </View>
          </View>
        </Animated.View>
        <View style={{ marginTop: 6, width: 14, height: 5, borderRadius: 7, backgroundColor: "rgba(10, 40, 20, 0.3)" }} />
      </View>

      {label ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: full ? 110 : 12,
            start: full ? undefined : 12,
            alignSelf: full ? "center" : undefined,
            maxWidth: "70%",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            boxShadow: "0 6px 16px -8px rgba(10, 40, 20, 0.35)",
          }}
        >
          <Text variant="footnote" weight="bold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 12 }}>
            {label}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => void locate()}
        accessibilityRole="button"
        accessibilityLabel={t("Me localiser")}
        style={({ pressed }) => ({
          position: "absolute",
          end: 12,
          bottom: full ? undefined : 12,
          top: full ? "46%" : undefined,
          minHeight: 44,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          backgroundColor: palette.white,
          boxShadow: shadows.float,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {locating ? <ActivityIndicator size="small" color={palette.souki900} /> : <LocateFixed size={18} color={palette.souki900} strokeWidth={2.4} />}
        <Text variant="footnote" weight="heavy" color={palette.souki900} style={{ fontSize: 14 }}>
          {t("Me localiser")}
        </Text>
      </Pressable>
    </View>
  )
}
