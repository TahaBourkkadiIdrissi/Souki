import { useEffect, useRef, useState, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import { Link, type Href } from "expo-router"
import type { SFSymbol } from "expo-symbols"
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import Svg, { Circle, Path } from "react-native-svg"
import { CalendarDays, Check, Clock, Receipt, ShoppingBasket, TriangleAlert, Truck, type LucideIcon } from "lucide-react-native"
import { formatDirhams, ORDER_STEPS, orderProgress, type OrderTone } from "@souki/shared"

import { ThumbStack } from "@/components/checkout-parts"
import { Note } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { EASE_OUT } from "@/lib/motion"
import { palette, radius, shadows } from "@/theme"

/* ---------- StatusPill ---------- */

const PILL: Record<OrderTone, { background: string; color: string }> = {
  wait: { background: palette.orange50, color: palette.orange700 },
  road: { background: palette.souki900, color: palette.white },
  ok: { background: palette.pale50, color: palette.market700 },
  issue: { background: "#FDECEC", color: "#B42318" },
}

const PULSE = {
  "0%": { opacity: 1, transform: [{ scale: 1 }] },
  "100%": { opacity: 0, transform: [{ scale: 2.4 }] },
} as const

/** Pastille d'etat d'une commande, libelles du site ; point qui pulse en route. */
export function StatusPill({ status }: { status: string | null }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const progress = orderProgress(status)
  const colors = PILL[progress.tone]
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.background, alignSelf: "flex-start" }}>
      {progress.tone === "road" ? (
        <View style={{ width: 7, height: 7 }}>
          {reducedMotion ? null : (
            <Animated.View style={{ position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: palette.mint300, animationName: PULSE, animationDuration: "1800ms", animationIterationCount: "infinite", animationTimingFunction: "ease-out" }} />
          )}
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.mint300 }} />
        </View>
      ) : null}
      <Text variant="footnote" weight="heavy" color={colors.color} numberOfLines={1} style={{ fontSize: 12 }}>
        {t(progress.label)}
      </Text>
    </View>
  )
}

/* ---------- OrderSteps compact : pastille + 4 segments ---------- */

export function OrderStepsCompact({ status, date }: { status: string | null; date?: string | null }) {
  const { t } = useLocale()
  const progress = orderProgress(status)
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <StatusPill status={status} />
        {date ? (
          <Text variant="footnote" weight="semibold" color={palette.ink500} numberOfLines={1} style={{ flexShrink: 1, fontSize: 12 }}>
            {date}
          </Text>
        ) : null}
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t(progress.label)}
        accessibilityValue={{ min: 1, max: 4, now: progress.step + 1 }}
        style={{ flexDirection: "row", gap: 4 }}
      >
        {ORDER_STEPS.map((_, index) => {
          const done = !progress.cancelled && (index < progress.step || progress.delivered)
          const now = !progress.cancelled && index === progress.step && !progress.delivered
          const background = done ? palette.market600 : now ? (progress.tone === "issue" ? palette.orange500 : palette.souki900) : palette.green100
          return <View key={index} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: background }} />
        })}
      </View>
    </View>
  )
}

/* ---------- OrderSteps complet : le camion sur le « S » ---------- */

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Le chemin du suivi (prototype) : trois courbes, quatre arrets. */
const TRACK = "M22 64 C 70 64 76 22 124 22 S 178 64 226 64 S 282 22 330 22"
const VIEW_W = 352
const VIEW_H = 86
const SEGMENTS = [
  [[22, 64], [70, 64], [76, 22], [124, 22]],
  [[124, 22], [172, 22], [178, 64], [226, 64]],
  [[226, 64], [274, 64], [282, 22], [330, 22]],
] as const
const STOPS = [[22, 64], [124, 22], [226, 64], [330, 22]] as const

/** 101 points regulierement repartis sur le chemin (0 %, 1 %, … 100 %). */
const SAMPLES = (() => {
  const points: { x: number; y: number }[] = []
  for (const [p0, p1, p2, p3] of SEGMENTS) {
    for (let index = 0; index <= 40; index++) {
      const t = index / 40
      const u = 1 - t
      points.push({
        x: u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        y: u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      })
    }
  }
  const lengths = [0]
  for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y))
  const total = lengths[lengths.length - 1]
  const xs: number[] = []
  const ys: number[] = []
  let cursor = 0
  for (let step = 0; step <= 100; step++) {
    const target = (total * step) / 100
    while (cursor < lengths.length - 2 && lengths[cursor + 1] < target) cursor++
    const span = lengths[cursor + 1] - lengths[cursor] || 1
    const ratio = Math.min(1, Math.max(0, (target - lengths[cursor]) / span))
    xs.push(points[cursor].x + (points[cursor + 1].x - points[cursor].x) * ratio)
    ys.push(points[cursor].y + (points[cursor + 1].y - points[cursor].y) * ratio)
  }
  return { xs, ys, total }
})()

const TRUCK = 32
const STEP_ICONS: LucideIcon[] = [Receipt, ShoppingBasket, Truck, Check]

type OrderTrackProps = {
  status: string | null
  title: string
  date?: string | null
  /** Heure de chaque etape franchie (4 cases, vides si inconnues). */
  times: (string | null)[]
}

/**
 * Suivi de commande (OrderSteps, design system 2027) : les 4 etapes du site sur le chemin du
 * « S ». Un changement d'etape remplit le chemin et fait avancer le camion (600 ms) ;
 * haptique de succes a « Livrée », d'alerte a un incident. En arabe, le chemin se retourne.
 */
export function OrderTrack({ status, title, date, times }: OrderTrackProps) {
  const { t, isRtl } = useLocale()
  const reducedMotion = useReducedMotion()
  const progress = orderProgress(status)
  const { delivered, cancelled, tone, step } = progress
  const issue = tone === "issue" && !cancelled
  const target = delivered ? 1 : cancelled ? 0 : (step + (tone === "road" ? 0.55 : 0)) / 3
  const value = useSharedValue(target)
  const [width, setWidth] = useState(0)
  const previous = useRef(progress.status)

  useEffect(() => {
    value.set(reducedMotion ? target : withTiming(target, { duration: 600, easing: EASE_OUT }))
  }, [target, reducedMotion, value])

  useEffect(() => {
    if (previous.current !== progress.status) {
      if (delivered) haptics.success()
      else if (issue) haptics.warning()
    }
    previous.current = progress.status
  }, [progress.status, delivered, issue])

  const scale = width / VIEW_W
  const fillProps = useAnimatedProps(() => ({ strokeDashoffset: SAMPLES.total * (1 - value.get()) }))
  const truckStyle = useAnimatedStyle(() => {
    const index = Math.round(value.get() * 100)
    const x = SAMPLES.xs[index] * scale
    return { transform: [{ translateX: (isRtl ? width - x : x) - TRUCK / 2 }, { translateY: SAMPLES.ys[index] * scale - TRUCK / 2 }] }
  })

  const heading = delivered ? t("Vos produits frais sont arrivés.") : cancelled ? t("Commande annulée") : issue ? t(progress.label) : t("Votre panier est entre de bonnes mains")
  const fill = delivered ? palette.leaf500 : issue ? palette.orange500 : palette.market600
  const TruckIcon = issue ? TriangleAlert : STEP_ICONS[Math.min(step, 3)]

  return (
    <View accessibilityLabel={t("Avancement de la commande")} style={{ padding: 18, gap: 14, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="footnote" weight="bold" color={palette.ink500} style={{ fontSize: 12 }}>
            {title}
          </Text>
          <Text accessibilityRole="header" variant="title2" weight="black" color={palette.ink900} style={{ fontSize: 19, lineHeight: 24 }}>
            {heading}
          </Text>
          {date ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <CalendarDays size={15} color={palette.market600} strokeWidth={2.2} />
              <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ flexShrink: 1, fontSize: 13 }}>
                {date}
              </Text>
            </View>
          ) : null}
        </View>
        <StatusPill status={status} />
      </View>

      {cancelled ? null : (
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: width ? VIEW_H * scale : 80 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {width > 0 ? (
            <>
              <Svg width={width} height={VIEW_H * scale} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}>
                <Path d={TRACK} fill="none" stroke={palette.green100} strokeWidth={12} strokeLinecap="round" />
                <AnimatedPath d={TRACK} fill="none" stroke={fill} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${SAMPLES.total} ${SAMPLES.total}`} animatedProps={fillProps} />
                <Path d={TRACK} fill="none" stroke={palette.white} strokeWidth={2} strokeDasharray="2 8" strokeLinecap="round" opacity={0.7} />
                {STOPS.map(([cx, cy], index) => {
                  const done = index < step || delivered
                  const now = index === step && !delivered
                  return <Circle key={index} cx={cx} cy={cy} r={7} stroke={palette.white} strokeWidth={3} fill={done ? (delivered ? palette.leaf500 : palette.market600) : now ? palette.souki900 : palette.green100} />
                })}
              </Svg>
              {delivered ? null : (
                <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, width: TRUCK, height: TRUCK, alignItems: "center", justifyContent: "center" }, truckStyle]}>
                  {tone === "road" && !reducedMotion ? (
                    <Animated.View style={{ position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(30, 138, 60, 0.25)", animationName: PULSE, animationDuration: "1800ms", animationIterationCount: "infinite", animationTimingFunction: "ease-out" }} />
                  ) : null}
                  <View style={{ width: TRUCK, height: TRUCK, borderRadius: TRUCK / 2, alignItems: "center", justifyContent: "center", backgroundColor: issue ? palette.orange500 : palette.souki900, borderWidth: 3, borderColor: palette.white }}>
                    <TruckIcon size={15} color={issue ? palette.ink900 : palette.white} strokeWidth={2.4} />
                  </View>
                </Animated.View>
              )}
            </>
          ) : null}
        </View>
      )}

      {progress.issue && !cancelled ? <Note tone="red">{t(progress.issue)}</Note> : null}

      <View>
        {ORDER_STEPS.map((item, index) => {
          const state = cancelled ? "next" : index < step || delivered ? "done" : index === step ? (issue ? "issue" : "now") : "next"
          const Icon = state === "done" ? Check : STEP_ICONS[index]
          const tile =
            state === "done"
              ? { background: palette.market600, color: palette.white }
              : state === "now"
                ? { background: palette.souki900, color: palette.white }
                : state === "issue"
                  ? { background: palette.orange500, color: palette.ink900 }
                  : { background: palette.sand, color: palette.ink300 }
          const last = index === ORDER_STEPS.length - 1
          return (
            <View
              key={item.title}
              accessible
              accessibilityLabel={[t(item.title), state === "now" || state === "issue" ? t(item.description) : null, times[index]].filter(Boolean).join(", ")}
              accessibilityState={{ selected: state === "now" }}
              style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingBottom: last ? 0 : 14 }}
            >
              {last ? null : <View style={{ position: "absolute", top: 34, bottom: 2, start: 16, width: 2, backgroundColor: state === "done" ? palette.market600 : palette.green100 }} />}
              <View style={{ width: 34, height: 34, borderRadius: 12, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: tile.background, boxShadow: state === "now" ? "0 0 0 5px rgba(30, 138, 60, 0.16)" : undefined }}>
                <Icon size={16} color={tile.color} strokeWidth={2.6} />
              </View>
              <View style={{ flex: 1, paddingTop: 6, gap: 2 }}>
                <Text variant="callout" weight="heavy" color={state === "next" ? palette.ink500 : palette.ink900} style={{ fontSize: 14 }}>
                  {t(item.title)}
                </Text>
                {state === "now" || state === "issue" ? (
                  <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
                    {t(item.description)}
                  </Text>
                ) : null}
              </View>
              {times[index] ? (
                <Text variant="footnote" weight="bold" numeric color={palette.ink500} style={{ paddingTop: 7, fontSize: 12 }}>
                  {times[index]}
                </Text>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

/* ---------- OrderCard ---------- */

type OrderCardProps = {
  title: string
  date: string
  total: number
  status: string | null
  when?: string | null
  images: string[]
  /** Echeance en orange (« Modifiable jusqu'à 01h00 », « Réclamation possible 24 h »). */
  badge?: string | null
  actions?: ReactNode
  /** Suivi de la commande : toute la carte y mene. */
  href: Href
  /** Appui long : menu contextuel natif (Suivre, Gérer, Recommander…). */
  menu?: { title: string; icon: SFSymbol; onPress: () => void; destructive?: boolean }[]
}

/**
 * Carte d'une commande dans l'historique ; toute la carte ouvre le suivi, l'appui long ouvre
 * un menu contextuel natif avec apercu (UIContextMenu, iOS 13+).
 */
export function OrderCard({ title, date, total, status, when, images, badge, actions, href, menu }: OrderCardProps) {
  const { t } = useLocale()
  return (
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      <Link href={href} asChild>
        <Link.Trigger>
          <Pressable accessibilityRole="button" accessibilityHint={t("Ouvre le suivi de la commande")} style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.75 : 1 })}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="callout" weight="heavy" color={palette.ink900} style={{ fontSize: 16 }}>
                  {title}
                </Text>
                <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 12 }}>
                  {date}
                </Text>
              </View>
              <Text variant="headline" weight="black" numeric color={palette.souki900} style={{ fontSize: 18 }}>
                {`${formatDirhams(total)} DH`}
              </Text>
            </View>
            <OrderStepsCompact status={status} date={when} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <ThumbStack images={images} />
              {badge ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: palette.orange50, flexShrink: 1 }}>
                  <Clock size={13} color={palette.orange700} strokeWidth={2.6} />
                  <Text variant="footnote" weight="heavy" color={palette.orange700} numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </Link.Trigger>
        <Link.Preview />
        {menu && menu.length > 0 ? (
          <Link.Menu>
            {menu.map((item) => (
              <Link.MenuAction key={item.title} title={item.title} icon={item.icon} destructive={item.destructive} onPress={item.onPress} />
            ))}
          </Link.Menu>
        ) : null}
      </Link>
      {actions ? <View style={{ flexDirection: "row", gap: 8 }}>{actions}</View> : null}
    </View>
  )
}

/** Grille d'infos 2 colonnes (sk-info-grid) : petit libelle en capitales, valeur dessous. */
export function InfoGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
      {items.map((item) => (
        <View key={item.label} style={{ width: "50%", gap: 2, paddingEnd: 10 }}>
          <Text variant="eyebrow" color={palette.ink500} style={{ fontSize: 11 }}>
            {item.label}
          </Text>
          <Text variant="callout" weight="bold" color={palette.ink900} style={{ fontSize: 14 }}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  )
}
