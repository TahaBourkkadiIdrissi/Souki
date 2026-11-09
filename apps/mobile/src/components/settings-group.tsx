import { Children, isValidElement, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { ArrowUpRight, Camera, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react-native"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette, radius, shadows } from "@/theme"

/**
 * Reglages en cartes groupees (SettingsGroup, design system 2027) : titre en capitales,
 * lignes de 56 pt (64 avec sous-titre), separateurs en retrait de 60 pt.
 */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement)
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <Text variant="eyebrow" color={palette.ink500} style={{ paddingHorizontal: 6 }}>
          {title}
        </Text>
      ) : null}
      <View style={{ borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, overflow: "hidden", boxShadow: shadows.card }}>
        {rows.map((row, index) => (
          <View key={row.key ?? index}>
            {index > 0 ? <View style={{ height: 1, marginStart: 60, backgroundColor: palette.line }} /> : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  )
}

type SettingsRowProps = {
  icon: LucideIcon
  label: string
  sub?: string
  value?: string
  /** Controle a droite (interrupteur, langue, bouton « Déconnecter »). */
  control?: ReactNode
  onPress?: () => void
  /** Ligne rouge (deconnexion, suppression). */
  danger?: boolean
  /** Lien vers le site (fleche en diagonale). */
  external?: boolean
}

export function SettingsRow({ icon: Icon, label, sub, value, control, onPress, danger = false, external = false }: SettingsRowProps) {
  const { isRtl } = useLocale()
  const Trailing = external ? ArrowUpRight : isRtl ? ChevronLeft : ChevronRight
  const content = (
    <>
      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: danger ? "#FDECEC" : palette.pale50 }}>
        <Icon size={18} color={danger ? palette.red600 : palette.souki900} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="semibold" color={danger ? palette.red600 : palette.ink900}>
          {label}
        </Text>
        {sub ? (
          <Text variant="footnote" color={palette.ink500} style={{ marginTop: 2, fontSize: 12, lineHeight: 16 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="footnote" weight="medium" color={palette.ink500} numberOfLines={1} style={{ fontSize: 14, maxWidth: 140 }}>
          {value}
        </Text>
      ) : null}
      {control}
      {onPress && !control && !danger ? <Trailing size={18} color={palette.ink300} strokeWidth={2.2} /> : null}
    </>
  )
  const style = { flexDirection: "row", alignItems: "center", gap: 12, minHeight: sub ? 64 : 56, paddingHorizontal: 16, paddingVertical: sub ? 8 : 0 } as const
  if (!onPress) return <View style={style}>{content}</View>
  return (
    <Pressable onPress={onPress} accessibilityRole={external ? "link" : "button"} style={({ pressed }) => [style, { backgroundColor: pressed ? palette.pale50 : palette.white }]}>
      {content}
    </Pressable>
  )
}

/** Petite pastille de ligne (« Cet appareil »). */
export function RowTag({ label }: { label: string }) {
  return (
    <View style={{ minHeight: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: "center", backgroundColor: palette.pale50 }}>
      <Text variant="eyebrow" color={palette.market700} style={{ letterSpacing: 0, textTransform: "none" }}>
        {label}
      </Text>
    </View>
  )
}

/** Bouton de ligne rouge sur sable (« Déconnecter »). */
export function RowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={5}
      style={({ pressed }) => ({ minHeight: 34, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: palette.sand, opacity: pressed ? 0.7 : 1 })}
    >
      <Text variant="footnote" weight="heavy" color={palette.red600}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Photo de profil ronde (Avatar) : photo du compte, sinon l'initiale sur degrade vert ;
 * badge appareil photo quand elle est modifiable.
 */
export function Avatar({ name, image, size = 84, editable = false }: { name: string; image?: string | null; size?: number; editable?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || "S"
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, boxShadow: "0 0 0 4px #FFFFFF, 0 14px 28px -14px rgba(0, 91, 67, 0.7)" }}>
      {image ? (
        <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={[palette.market600, palette.souki900]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
          <Text variant="title1" weight="black" color={palette.white} style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
            {initial}
          </Text>
        </LinearGradient>
      )}
      {editable ? (
        <View style={{ position: "absolute", bottom: 0, end: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px -4px rgba(10, 40, 20, 0.4)" }}>
          <Camera size={16} color={palette.souki900} strokeWidth={2.4} />
        </View>
      ) : null}
    </View>
  )
}
