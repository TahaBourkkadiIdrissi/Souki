import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useReducedMotion } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"

/** Reflet qui balaie le bloc (animation CSS de Reanimated, fil UI, en boucle). */
const SHIMMER = {
  from: { transform: [{ translateX: "-100%" }] },
  to: { transform: [{ translateX: "100%" }] },
} as const

type SkeletonProps = { width?: DimensionValue; height?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }

/** Bloc de chargement facon Glovo/Instacart : la forme du contenu a venir, avec un reflet. */
export function Skeleton({ width = "100%", height, radius = 16, style }: SkeletonProps) {
  const reducedMotion = useReducedMotion()
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: "#E9EFE8", overflow: "hidden" }, style]}>
      {reducedMotion ? null : (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            animationName: SHIMMER,
            animationDuration: "1300ms",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.65)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  )
}

/** Carte produit en cours de chargement (meme gabarit que ProductCard). */
export function ProductCardSkeleton() {
  return (
    <View style={{ flex: 1, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 12, gap: 10, borderRadius: 24, backgroundColor: "#FFFFFF" }}>
      <Skeleton style={{ aspectRatio: 1 }} radius={18} />
      <Skeleton height={20} width="50%" radius={7} />
      <Skeleton height={14} width="80%" radius={7} />
    </View>
  )
}
