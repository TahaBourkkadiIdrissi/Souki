import { useEffect, useMemo } from "react"
import { View } from "react-native"
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import Svg, { Circle, Path } from "react-native-svg"
import { Truck } from "lucide-react-native"

import { palette } from "@/theme"

const AnimatedPath = Animated.createAnimatedComponent(Path)

type Point = [number, number]

/**
 * Chemin du « S » de l'onboarding (obRoad du design system) : un arret par etape, segments en
 * vague. 178 pt de large, 206 au-dela de 5 etapes.
 */
function buildRoad(count: number) {
  const width = count > 5 ? 206 : 178
  const gap = (width - 28) / Math.max(1, count - 1)
  const xs = Array.from({ length: count }, (_, index) => 14 + index * gap)
  let d = "M14 14"
  const segments: [Point, Point, Point, Point][] = []
  for (let index = 1; index < count; index += 1) {
    const y = index % 2 ? 0 : 28
    const c1: Point = [xs[index - 1] + gap * 0.35, y]
    const c2: Point = [xs[index] - gap * 0.35, y]
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${xs[index]} 14`
    segments.push([[xs[index - 1], 14], c1, c2, [xs[index], 14]])
  }
  // Longueur du trace (react-native-svg n'a pas `pathLength`) : on echantillonne les courbes.
  let length = 0
  for (const [p0, p1, p2, p3] of segments) {
    let previous = p0
    for (let step = 1; step <= 24; step += 1) {
      const t = step / 24
      const u = 1 - t
      const point: Point = [
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]
      length += Math.hypot(point[0] - previous[0], point[1] - previous[1])
      previous = point
    }
  }
  return { width, xs, d, length }
}

/**
 * Progression : le trace se remplit en market-600 (520 ms) et le camion avance en ressort.
 * Les arrets des informations a donner restent en pointilles tant qu'ils ne sont pas passes.
 * En arabe, le chemin est en miroir. Pour VoiceOver : une barre de progression « Étape 2 sur 7 ».
 */
export function OnboardingRoad({ count, page, infoStops, rtl, label }: { count: number; page: number; infoStops: boolean[]; rtl: boolean; label: string }) {
  const reducedMotion = useReducedMotion()
  const road = useMemo(() => buildRoad(count), [count])
  const ratio = count > 1 ? page / (count - 1) : 1
  const fill = useSharedValue(ratio)
  const truck = useSharedValue(road.xs[page] ?? 14)

  useEffect(() => {
    fill.set(reducedMotion ? ratio : withTiming(ratio, { duration: 520, easing: Easing.out(Easing.cubic) }))
    const target = road.xs[page] ?? 14
    truck.set(reducedMotion ? target : withSpring(target, { damping: 16, stiffness: 220 }))
  }, [fill, page, ratio, reducedMotion, road.xs, truck])

  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: road.length * (1 - fill.get()) }))
  const truckStyle = useAnimatedStyle(() => ({ transform: [{ translateX: truck.get() - 13 }] }))

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: count, now: page + 1 }}
      style={{ width: road.width, height: 28, transform: rtl ? [{ scaleX: -1 }] : undefined }}
    >
      <Svg width={road.width} height={28} viewBox={`0 0 ${road.width} 28`} style={{ overflow: "visible" }}>
        <Path d={road.d} fill="none" stroke={palette.line} strokeWidth={6} strokeLinecap="round" />
        <AnimatedPath d={road.d} fill="none" stroke={palette.market600} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${road.length} ${road.length}`} animatedProps={pathProps} />
        {road.xs.map((x, index) => {
          const passed = index <= page
          return (
            <Circle
              key={index}
              cx={x}
              cy={14}
              r={4.5}
              fill={passed ? palette.market600 : palette.cream}
              stroke={passed ? palette.market600 : palette.line}
              strokeWidth={2.5}
              strokeDasharray={!passed && infoStops[index] ? "2 2.4" : undefined}
            />
          )
        })}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", left: 0, top: 1, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: palette.souki900, boxShadow: "0 6px 12px -6px rgba(10, 40, 20, 0.6)" },
          truckStyle,
        ]}
      >
        <Truck size={13} color={palette.white} strokeWidth={2.6} />
      </Animated.View>
    </View>
  )
}
