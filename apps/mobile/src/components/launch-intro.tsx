import { useEffect, useRef, useState } from "react"
import { Pressable, useWindowDimensions, View } from "react-native"
import Animated, {
  cubicBezier,
  makeMutable,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { Image } from "expo-image"
import { setStatusBarStyle } from "expo-status-bar"
import Svg, { Path } from "react-native-svg"
import { getOrderHours } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { EASE_OUT_2027 } from "@/lib/motion"
import { palette, radius } from "@/theme"

/* Memes images que l'ecran de lancement d'iOS (app.config.ts) : la 1re image de l'intro est identique. */
const SPLASH_MARK = require("../../assets/brand/splash-symbol.png")
const LOGO = require("../../assets/brand/horizontal.png")

/** Taille du sac, comme `imageWidth` de expo-splash-screen. */
const MARK = 160
/** Logo horizontal : 236 pt de large (ratio de horizontal.png, 1825 × 611). */
const LOGO_W = 236
const LOGO_H = Math.round((LOGO_W * 611) / 1825)

/** Sortie a 1900 ms, accueil a 2220 ms (fiche LaunchIntro). */
const OUT_AT = 1900
const OUT_MS = 320
const REDUCED_OUT_MS = 200

const EASE_OUT = cubicBezier(0.16, 1, 0.3, 1)
const EASE_IN_OUT = cubicBezier(0.65, 0, 0.35, 1)

/**
 * L'en-tete vert de l'accueil descend du haut quand l'intro s'efface (420 ms). Vaut 1 tant que
 * l'intro couvre l'ecran, 0 ensuite ; HomeHero le lit (0 aussi si l'intro n'est pas jouee).
 */
export const introHeroOffset = makeMutable(0)

/* ---------- Le chemin du « S » qui traverse l'ecran ---------- */

const PATH = "M430 40 C 250 60 40 160 70 330 C 100 480 330 430 320 600 C 312 740 120 790 -40 820"
const SEGMENTS = [
  [[430, 40], [250, 60], [40, 160], [70, 330]],
  [[70, 330], [100, 480], [330, 430], [320, 600]],
  [[320, 600], [312, 740], [120, 790], [-40, 820]],
] as const
/** Longueur du chemin dans le repere 393 × 852 (pour le trace par pointilles). */
const PATH_LENGTH = (() => {
  let total = 0
  for (const [p0, p1, p2, p3] of SEGMENTS) {
    let previous = p0 as readonly number[]
    for (let index = 1; index <= 60; index++) {
      const t = index / 60
      const u = 1 - t
      const point = [0, 1].map((axis) => u * u * u * p0[axis] + 3 * u * u * t * p1[axis] + 3 * u * t * t * p2[axis] + t * t * t * p3[axis])
      total += Math.hypot(point[0] - previous[0], point[1] - previous[1])
      previous = point
    }
  }
  return total
})()

const AnimatedPath = Animated.createAnimatedComponent(Path)

/* ---------- Images cles (CSS Reanimated, jouees une fois des le montage) ---------- */

/** Le sac respire (0,92 -> 1,05 -> 1) puis s'efface sous le logo (jour). */
const MARK_DAY = {
  "0%": { transform: [{ scale: 1 }], opacity: 1 },
  "22%": { transform: [{ scale: 0.92 }], opacity: 1 },
  "40%": { transform: [{ scale: 1.05 }], opacity: 1 },
  "55%": { transform: [{ scale: 1 }], opacity: 1 },
  "75%": { transform: [{ scale: 1 }], opacity: 1 },
  "100%": { transform: [{ scale: 0.72 }], opacity: 0 },
} as const
/** La nuit, le sac blanc reste et monte de 92 pt. */
const MARK_NIGHT = {
  "0%": { transform: [{ translateY: 0 }, { scale: 1 }] },
  "22%": { transform: [{ translateY: 0 }, { scale: 0.92 }] },
  "40%": { transform: [{ translateY: 0 }, { scale: 1.05 }] },
  "60%": { transform: [{ translateY: 0 }, { scale: 1 }] },
  "100%": { transform: [{ translateY: -92 }, { scale: 0.8 }] },
} as const
const REVEAL = { from: { transform: [{ scale: 0 }] }, to: { transform: [{ scale: 1 }] } } as const
const LOGO_IN = {
  from: { opacity: 0, transform: [{ translateY: LOGO_H * 0.12 }, { scale: 0.94 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
} as const
const FADE_UP = { from: { opacity: 0, transform: [{ translateY: 10 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } } as const

/** Six feuilles qui s'envolent du logo : [dx, dy, rotation]. */
const LEAVES = [
  [-70, -60, -30],
  [-34, -92, 20],
  [10, -100, -10],
  [52, -84, 35],
  [80, -48, 60],
  [-92, -18, -55],
] as const
const LEAF_KEYFRAMES = LEAVES.map(([dx, dy, rotation]) => ({
  "0%": { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "0deg" }, { scale: 0.4 }] },
  "20%": { opacity: 1 },
  "100%": { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }, { rotate: `${rotation}deg` }, { scale: 1 }] },
}))

/**
 * « Le marché se réveille » (LaunchIntro, design system 2027) : jouee une fois au demarrage a
 * froid, juste apres l'ecran de lancement fixe d'iOS, dont elle reprend l'image exacte. Environ
 * 2,2 s : le sac respire, le « S » se trace, le jour se leve (la nuit, 01h-08h heure du Maroc :
 * vert nuit et lune), le logo complet, six feuilles, la promesse et l'etat du marche, puis
 * fondu vers l'accueil. Toucher l'ecran passe directement a l'accueil. « Réduire les
 * animations » : fondu de 200 ms de l'image fixe. Reanimated et react-native-svg seulement (iOS 18+).
 */
export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const { width, height } = useWindowDimensions()
  // Heure du Maroc, sans attendre le reseau (l'intro ne s'allonge jamais pour lui).
  const [night] = useState(() => getOrderHours().closed)
  const exit = useSharedValue(0)
  const draw = useSharedValue(0)
  const leaving = useRef(false)

  const finish = () => onDone()

  const leave = (duration: number) => {
    if (leaving.current) return
    leaving.current = true
    haptics.soft()
    // L'en-tete vert de l'accueil descend pendant que l'intro s'efface.
    introHeroOffset.set(reducedMotion ? 0 : withTiming(0, { duration: 420, easing: EASE_OUT_2027 }))
    exit.set(
      withTiming(1, { duration, easing: EASE_OUT_2027 }, (done) => {
        if (done) scheduleOnRN(finish)
      }),
    )
  }

  useEffect(() => {
    introHeroOffset.set(1)
    setStatusBarStyle("light", false)
    if (reducedMotion) {
      const timer = setTimeout(() => leave(REDUCED_OUT_MS), 120)
      return () => clearTimeout(timer)
    }
    draw.set(withDelay(150, withTiming(1, { duration: 700, easing: EASE_OUT_2027 })))
    // Le jour se leve sur un fond creme : barre d'etat sombre ; la nuit, elle reste claire.
    const statusTimer = night ? null : setTimeout(() => setStatusBarStyle("dark", true), 760)
    const outTimer = setTimeout(() => leave(OUT_MS), OUT_AT)
    return () => {
      if (statusTimer) clearTimeout(statusTimer)
      clearTimeout(outTimer)
    }
    // L'intro ne se joue qu'une fois : rien a relancer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      setStatusBarStyle("dark", true)
      introHeroOffset.set(0)
    },
    [],
  )

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ scale: reducedMotion ? 1 : 1 + 0.04 * exit.get() }],
  }))
  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: PATH_LENGTH * (1 - draw.get()) }))

  const centerX = width / 2
  const centerY = height / 2

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: palette.souki900, overflow: "hidden" }, containerStyle]}
    >
      <Pressable
        onPress={() => leave(reducedMotion ? REDUCED_OUT_MS : OUT_MS)}
        accessible
        accessibilityRole="image"
        accessibilityLabel="SOUKI"
        accessibilityHint={t("Touchez pour passer")}
        style={{ flex: 1 }}
      >
        {reducedMotion ? null : (
          <>
            {/* Le chemin du « S », menthe a 22 % */}
            <Svg width={width} height={height} viewBox="0 0 393 852" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0 }}>
              <AnimatedPath
                d={PATH}
                fill="none"
                stroke={palette.mint300}
                strokeWidth={34}
                strokeLinecap="round"
                opacity={0.22}
                strokeDasharray={`${PATH_LENGTH} ${PATH_LENGTH}`}
                animatedProps={pathProps}
              />
            </Svg>
            {/* Le jour se leve : un cercle s'ouvre depuis le sac */}
            <Animated.View
              style={{
                position: "absolute",
                left: centerX - 950,
                top: centerY - 950,
                width: 1900,
                height: 1900,
                borderRadius: 950,
                backgroundColor: night ? palette.night950 : palette.cream,
                transform: [{ scale: 0 }],
                animationName: REVEAL,
                animationDuration: "520ms",
                animationDelay: "620ms",
                animationTimingFunction: EASE_IN_OUT,
                animationFillMode: "both",
              }}
            />
            {night ? <Moon /> : null}
          </>
        )}

        {/* Le sac : meme image et meme taille que l'ecran de lancement */}
        <Animated.View
          style={{
            position: "absolute",
            left: centerX - MARK / 2,
            top: centerY - MARK / 2,
            width: MARK,
            height: MARK,
            ...(reducedMotion
              ? null
              : {
                  animationName: night ? MARK_NIGHT : MARK_DAY,
                  animationDuration: night ? "1100ms" : "1000ms",
                  animationTimingFunction: EASE_OUT,
                  animationFillMode: "both",
                }),
          }}
        >
          <Image source={SPLASH_MARK} style={{ width: MARK, height: MARK }} contentFit="contain" />
        </Animated.View>

        {reducedMotion ? null : (
          <>
            {night ? null : (
              <Animated.View
                style={{
                  position: "absolute",
                  left: centerX - LOGO_W / 2,
                  top: height * 0.45 - LOGO_H / 2,
                  width: LOGO_W,
                  height: LOGO_H,
                  opacity: 0,
                  animationName: LOGO_IN,
                  animationDuration: "380ms",
                  animationDelay: "950ms",
                  animationTimingFunction: EASE_OUT,
                  animationFillMode: "both",
                }}
              >
                <Image source={LOGO} style={{ width: LOGO_W, height: LOGO_H }} contentFit="contain" />
              </Animated.View>
            )}

            {/* Six feuilles s'envolent du logo */}
            <View style={{ position: "absolute", left: centerX, top: height * (night ? 0.37 : 0.41), width: 0, height: 0 }}>
              {LEAF_KEYFRAMES.map((keyframes, index) => {
                const size = index % 2 === 1 ? 10 : 14
                return (
                  <Animated.View
                    key={index}
                    style={{
                      position: "absolute",
                      left: -size / 2,
                      top: -size / 2,
                      width: size,
                      height: size,
                      borderTopRightRadius: size,
                      borderBottomLeftRadius: size,
                      backgroundColor: index % 2 === 1 ? palette.fresh500 : palette.leaf500,
                      opacity: 0,
                      animationName: keyframes,
                      animationDuration: "900ms",
                      animationDelay: `${(night ? 1050 : 1000) + index * 45}ms`,
                      animationTimingFunction: EASE_OUT,
                      animationFillMode: "both",
                    }}
                  />
                )
              })}
            </View>

            {/* La promesse et l'etat du marche */}
            <View style={{ position: "absolute", left: 0, right: 0, top: height * (night ? 0.52 : 0.57), alignItems: "center", gap: 14, paddingHorizontal: 40 }}>
              <Animated.View
                style={{ opacity: 0, animationName: FADE_UP, animationDuration: "360ms", animationDelay: "1200ms", animationTimingFunction: EASE_OUT, animationFillMode: "both" }}
              >
                <Text variant="body" weight="semibold" color={night ? palette.mint300 : palette.ink700} align="center" style={{ maxWidth: 270, fontSize: 16, lineHeight: 23 }}>
                  {night ? t("Le marché dort. Préparez votre panier, validation dès 8h.") : t("Le marché du matin à Fès, livré le lendemain.")}
                </Text>
              </Animated.View>
              <Animated.View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  height: 30,
                  paddingStart: 12,
                  paddingEnd: 14,
                  borderRadius: radius.pill,
                  backgroundColor: night ? "rgba(255, 255, 255, 0.1)" : palette.pale50,
                  opacity: 0,
                  animationName: FADE_UP,
                  animationDuration: "360ms",
                  animationDelay: "1350ms",
                  animationTimingFunction: EASE_OUT,
                  animationFillMode: "both",
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: night ? palette.yellow400 : palette.fresh500 }} />
                <Text variant="footnote" weight="heavy" color={night ? palette.white : palette.souki900} style={{ fontSize: 12 }}>
                  {night ? t("Fermé · réouverture à 8h") : t("Marché ouvert · jusqu'à 1h")}
                </Text>
              </Animated.View>
            </View>
          </>
        )}
      </Pressable>
    </Animated.View>
  )
}

/** Lune yellow-400 echancree par la nuit, avec son halo (nuit seulement). */
function Moon() {
  return (
    <Animated.View
      style={{
        position: "absolute",
        right: 70,
        top: 150,
        width: 54,
        height: 54,
        borderRadius: 27,
        boxShadow: "0 0 0 12px rgba(245, 196, 0, 0.12), 0 0 0 26px rgba(245, 196, 0, 0.06)",
        opacity: 0,
        animationName: FADE_UP,
        animationDuration: "500ms",
        animationDelay: "900ms",
        animationTimingFunction: EASE_OUT,
        animationFillMode: "both",
      }}
    >
      <View style={{ flex: 1, borderRadius: 27, backgroundColor: palette.yellow400, overflow: "hidden" }}>
        <View style={{ position: "absolute", top: -8, left: -12, width: 48, height: 48, borderRadius: 24, backgroundColor: palette.night950 }} />
      </View>
    </Animated.View>
  )
}
