import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"
import { Check, ShoppingBasket, Truck } from "lucide-react-native"
import { DELIVERY_FEE_DH, formatDirhams, FREE_DELIVERY_THRESHOLD_DH } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { DUR_SLOW, EASE_OUT_2027 } from "@/lib/motion"
import { palette, radius, shadows } from "@/theme"

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Le chemin du sac SOUKI (prototype) : du panier, a gauche, jusqu'au camion, a droite. */
const GAUGE = "M18 86 C 92 86 100 52 160 52 S 232 18 302 18"
const VIEW_W = 320
const VIEW_H = 104

/** Points de controle des deux courbes (le « S » reflete le controle precedent autour de 160,52). */
const SEGMENTS = [
  [[18, 86], [92, 86], [100, 52], [160, 52]],
  [[160, 52], [220, 52], [232, 18], [302, 18]],
] as const

/** Table de points regulierement repartis sur le chemin (pour placer le panier et mesurer). */
const SAMPLES = (() => {
  const points: { x: number; y: number }[] = []
  for (const [p0, p1, p2, p3] of SEGMENTS) {
    for (let index = 0; index <= 60; index++) {
      const t = index / 60
      const u = 1 - t
      points.push({
        x: u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        y: u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      })
    }
  }
  const lengths = [0]
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y))
  }
  const total = lengths[lengths.length - 1]
  // 101 positions a 0 %, 1 %, … 100 % de la longueur.
  const table: { x: number; y: number }[] = []
  let cursor = 0
  for (let step = 0; step <= 100; step++) {
    const target = (total * step) / 100
    while (cursor < lengths.length - 2 && lengths[cursor + 1] < target) cursor++
    const span = lengths[cursor + 1] - lengths[cursor] || 1
    const ratio = Math.min(1, Math.max(0, (target - lengths[cursor]) / span))
    table.push({ x: points[cursor].x + (points[cursor + 1].x - points[cursor].x) * ratio, y: points[cursor].y + (points[cursor + 1].y - points[cursor].y) * ratio })
  }
  return { table, total }
})()
const PATH_LENGTH = SAMPLES.total
const XS = SAMPLES.table.map((point) => point.x)
const YS = SAMPLES.table.map((point) => point.y)

/** Six feuilles qui s'envolent au franchissement (decalage en pt). */
const LEAVES = [
  [-60, -50],
  [-20, -70],
  [30, -60],
  [60, -30],
  [-40, 20],
  [40, 30],
] as const

/** Images cles des feuilles, creees une fois (un nouveau rendu ne relance pas l'envolee). */
const leafKeyframes = (mirror: boolean) =>
  LEAVES.map(([dx, dy]) => ({
    "0%": { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "0deg" }, { scale: 0.6 }] },
    "100%": { opacity: 0, transform: [{ translateX: mirror ? -dx : dx }, { translateY: dy }, { rotate: "220deg" }, { scale: 1 }] },
  }))
const LEAF_KEYFRAMES = { ltr: leafKeyframes(false), rtl: leafKeyframes(true) }

const MARKER = 30

/**
 * Jauge de livraison offerte (DeliveryPath, design system 2027) dessinee sur le « S » du logo :
 * le panier avance sur le chemin jusqu'au camion (dur-slow, ease-out). A 300 DH de produits,
 * « Livraison offerte ✓ », le chemin passe en leaf-500 et 6 feuilles s'envolent (une seule fois
 * par panier, haptique de succes). En arabe, le chemin se retourne.
 */
export function DeliveryPath({ subtotal }: { subtotal: number }) {
  const { t, isRtl } = useLocale()
  const reducedMotion = useReducedMotion()
  const [width, setWidth] = useState(0)
  const [burst, setBurst] = useState(0)
  const progress = Math.max(0, Math.min(1, subtotal / FREE_DELIVERY_THRESHOLD_DH))
  const done = progress >= 1
  const left = Math.max(0, FREE_DELIVERY_THRESHOLD_DH - subtotal)
  const value = useSharedValue(progress)
  const wasDone = useRef(done)

  useEffect(() => {
    value.set(reducedMotion ? progress : withTiming(progress, { duration: DUR_SLOW, easing: EASE_OUT_2027 }))
  }, [progress, reducedMotion, value])

  useEffect(() => {
    if (done && !wasDone.current) {
      haptics.success()
      if (!reducedMotion) setBurst((count) => count + 1)
    }
    wasDone.current = done
  }, [done, reducedMotion])

  const scale = width / VIEW_W
  const height = VIEW_H * scale

  const fillProps = useAnimatedProps(() => ({ strokeDashoffset: PATH_LENGTH * (1 - value.get()) }))
  const markerStyle = useAnimatedStyle(() => {
    const index = Math.round(value.get() * 100)
    const x = XS[index] * scale
    const y = YS[index] * scale
    return { transform: [{ translateX: (isRtl ? width - x : x) - MARKER / 2 }, { translateY: y - MARKER / 2 }] }
  })

  const amount = t("{price} DH", { price: formatDirhams(left) })
  const [before, after] = t("Plus que {montant} pour la livraison offerte", { montant: "\u0000" }).split("\u0000")
  const end = { x: (isRtl ? VIEW_W - 302 : 302) * scale, y: 18 * scale }

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={done ? t("Livraison offerte") : t("Plus que {montant} DH pour la livraison offerte", { montant: formatDirhams(left) })}
      accessibilityValue={{ min: 0, max: FREE_DELIVERY_THRESHOLD_DH, now: Math.min(subtotal, FREE_DELIVERY_THRESHOLD_DH) }}
      style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text variant="callout" weight="heavy" color={palette.ink900} style={{ flex: 1 }}>
          {done ? (
            `${t("Livraison offerte")} ✓`
          ) : (
            <>
              {before}
              <Text variant="callout" weight="heavy" numeric color={palette.market700}>
                {amount}
              </Text>
              {after}
            </>
          )}
        </Text>
        <View style={{ minHeight: 24, paddingHorizontal: 8, borderRadius: 999, justifyContent: "center", backgroundColor: done ? palette.pale50 : palette.sand }}>
          <Text variant="footnote" weight="heavy" numeric={!done} color={done ? palette.market700 : palette.ink700} style={{ fontSize: 12, lineHeight: 16 }}>
            {/* Frais de livraison dits clairement : c'est la difference avec le total du bouton. */}
            {done ? t("Livraison offerte") : t("Livraison {fee} DH", { fee: DELIVERY_FEE_DH })}
          </Text>
        </View>
      </View>

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ marginTop: 6, height: height || 80 }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}>
              <Path d={GAUGE} fill="none" stroke={palette.green100} strokeWidth={14} strokeLinecap="round" />
              <AnimatedPath
                d={GAUGE}
                fill="none"
                stroke={done ? palette.leaf500 : palette.market600}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={`${PATH_LENGTH} ${PATH_LENGTH}`}
                animatedProps={fillProps}
              />
              <Path d={GAUGE} fill="none" stroke={palette.white} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" opacity={0.7} />
            </Svg>
            {/* Camion a l'arrivee */}
            <View
              style={{
                position: "absolute",
                left: end.x - 12,
                top: end.y - 12,
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 3,
                borderColor: done ? palette.leaf500 : palette.green100,
                backgroundColor: done ? palette.leaf500 : palette.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Truck size={11} color={done ? palette.white : palette.market700} strokeWidth={2.6} />
            </View>
            {/* Le panier qui avance */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: MARKER,
                  height: MARKER,
                  borderRadius: MARKER / 2,
                  borderWidth: 3,
                  borderColor: palette.white,
                  backgroundColor: palette.souki900,
                  alignItems: "center",
                  justifyContent: "center",
                },
                markerStyle,
              ]}
            >
              {done ? <Check size={15} color={palette.white} strokeWidth={2.8} /> : <ShoppingBasket size={14} color={palette.white} strokeWidth={2.6} />}
            </Animated.View>
          </>
        ) : null}
      </View>

      {/* Meme logique que le site : la jauge compte les produits seuls, « 120 / 300 DH ». */}
      <Text variant="footnote" weight="semibold" numeric color={palette.ink500} align="end" style={{ marginTop: 4, fontSize: 12, lineHeight: 16 }}>
        {t("{sous_total} / {seuil} DH", { sous_total: formatDirhams(subtotal), seuil: FREE_DELIVERY_THRESHOLD_DH })}
      </Text>

      {burst > 0
        ? LEAF_KEYFRAMES[isRtl ? "rtl" : "ltr"].map((keyframes, index) => (
            <Animated.View
              key={`${burst}-${index}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                top: "50%",
                [isRtl ? "right" : "left"]: "85%",
                width: 14,
                height: 14,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 14,
                borderBottomRightRadius: 0,
                borderBottomLeftRadius: 14,
                backgroundColor: palette.leaf500,
                opacity: 0,
                animationName: keyframes,
                animationDuration: "900ms",
                animationDelay: `${index * 30}ms`,
                animationTimingFunction: "ease-out",
                animationFillMode: "forwards",
              }}
            />
          ))
        : null}
    </View>
  )
}
