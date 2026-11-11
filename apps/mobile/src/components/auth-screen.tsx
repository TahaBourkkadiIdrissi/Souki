import type { ReactNode } from "react"
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native"
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChevronLeft, ChevronRight, Mail, X } from "lucide-react-native"

import { StepProgress } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { DUR_SLOW, EASE_OUT_2027 } from "@/lib/motion"
import { colors, palette, shadows } from "@/theme"

type AuthScreenProps = {
  /** Libelle du retour (« Connexion », « Adresse »…) ; absent = bouton fermer. */
  backLabel?: string
  onBack: () => void
  step?: { current: number; total: number; label: string }
  title?: string
  subtitle?: ReactNode
  children: ReactNode
  /** Bouton(s) colles en bas, au-dessus du clavier. */
  dock?: ReactNode
  /**
   * Entree de l'app (AuthFlow) : retour rond a gauche et croix ronde a droite (sk-au-nav),
   * au lieu du retour « ‹ Libelle ».
   */
  onClose?: () => void
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: palette.white, boxShadow: "0 2px 10px rgba(10, 40, 20, 0.08)" }}>{children}</View>
    </Pressable>
  )
}

/**
 * Gabarit des ecrans de compte (prototype `screens-compte.js`) : retour « ‹ Libelle » en
 * souki-900, barre d'etapes, titre 28 pt Black, formulaire en cascade, bouton principal colle
 * en bas au-dessus du clavier.
 */
export function AuthScreen({ backLabel, onBack, step, title, subtitle, children, dock, onClose }: AuthScreenProps) {
  const { t, isRtl, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const Back = isRtl ? ChevronRight : ChevronLeft

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      {onClose ? (
        <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <RoundButton label={backLabel ?? t("Retour")} onPress={onBack}>
            <Back size={22} color={palette.ink900} strokeWidth={2.6} />
          </RoundButton>
          <RoundButton label={t("Fermer")} onPress={onClose}>
            <X size={18} color={palette.ink900} strokeWidth={2.6} />
          </RoundButton>
        </View>
      ) : (
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 8 }}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel ?? "Fermer"}
          style={({ pressed }) => ({ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", paddingEnd: 8, opacity: pressed ? 0.6 : 1 })}
        >
          {backLabel ? (
            <>
              <Back size={24} color={palette.souki900} strokeWidth={2.6} />
              <Text variant="body" weight="semibold" color={palette.souki900}>
                {backLabel}
              </Text>
            </>
          ) : (
            <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <X size={22} color={palette.ink900} strokeWidth={2.4} />
            </View>
          )}
        </Pressable>
      </View>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 24 }}>
        {step ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
            <StepProgress current={step.current} total={step.total} label={step.label} />
          </View>
        ) : null}
        {title ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4, gap: 6 }}>
            <Text accessibilityRole="header" variant="title1" weight="black" color={palette.ink900} style={{ fontSize: 28, lineHeight: 34 }}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(DUR_SLOW).easing(EASE_OUT_2027)} style={{ gap: 14, paddingHorizontal: 20, paddingTop: 14 }}>
          {children}
        </Animated.View>
      </ScrollView>
      {dock ? <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>{dock}</View> : null}
    </KeyboardAvoidingView>
  )
}

/** Lien texte market-700 (« Mot de passe oublié ? », « S'inscrire ») avec zone de 44 pt. */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={4} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Text variant="callout" weight="heavy" color={palette.market700} style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Rappel de l'e-mail saisi a l'entree, avec « Modifier » (sk-au-chip). */
export function EmailChip({ value, onEdit }: { value: string; onEdit: () => void }) {
  const { t } = useLocale()
  return (
    <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingStart: 14, paddingEnd: 6, borderRadius: 16, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      <Mail size={16} color={palette.market600} strokeWidth={2.2} />
      <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} ellipsizeMode="middle" style={{ flex: 1, fontSize: 15, direction: "ltr" }}>
        {value}
      </Text>
      <TextLink label={t("Modifier")} onPress={onEdit} />
    </View>
  )
}
