import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react"
import { Pressable, TextInput, View, type TextInputProps } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, ZoomIn } from "react-native-reanimated"
import { Check, CircleAlert, Eye, EyeOff, Info, type LucideIcon } from "lucide-react-native"
import { PASSWORD_RULES, passwordIsValid } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { SPRING_FINGER } from "@/lib/motion"
import { fonts, palette } from "@/theme"

/** Tremblement d'erreur (320 ms) d'un champ ou des cases OTP. */
function useShake(trigger: unknown, enabled: boolean) {
  const reducedMotion = useReducedMotion()
  const x = useSharedValue(0)
  useEffect(() => {
    if (!enabled || reducedMotion) return
    x.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 70 }), withTiming(-6, { duration: 70 }), withTiming(4, { duration: 60 }), withTiming(0, { duration: 70 })))
  }, [trigger, enabled, reducedMotion, x])
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }))
}

export type TextFieldProps = Omit<TextInputProps, "style" | "placeholderTextColor"> & {
  label?: string
  /** « (optionnel) » apres le libelle. */
  optional?: string
  icon?: LucideIcon
  /** Prefixe fixe (« +212 »). */
  prefix?: string
  /** Mot de passe : texte masque et bouton œil. */
  secure?: boolean
  help?: string
  /** L'erreur dit quoi faire, sous le champ (jamais en alerte). */
  error?: string | null
  /** Pastille « Vérifié ». */
  verified?: string
  disabled?: boolean
}

/**
 * Champ de formulaire (TextField, design system 2027) : libelle au-dessus, champ blanc de
 * 54 pt aux coins de 16 pt, icone, aide ou erreur dessous. Focus : contour market-600 et
 * halo. Erreur : le champ tremble 320 ms et l'iPhone vibre une fois. Texte 16 pt.
 */
export function TextField({ label, optional, icon: Icon, prefix, secure = false, help, error, verified, disabled = false, onFocus, onBlur, ...input }: TextFieldProps) {
  const { t, isRtl } = useLocale()
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(true)
  const shakeStyle = useShake(error, Boolean(error))

  useEffect(() => {
    if (error) haptics.error()
  }, [error])

  const borderColor = error ? palette.red600 : focused ? palette.market600 : palette.line
  return (
    <View style={{ gap: 6, flex: 1 }}>
      {label ? (
        <Text variant="footnote" weight="bold" color={palette.ink700} style={{ paddingStart: 4 }}>
          {label}
          {optional ? (
            <Text variant="footnote" color={palette.ink500}>
              {` ${optional}`}
            </Text>
          ) : null}
        </Text>
      ) : null}
      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 54,
            paddingHorizontal: 14,
            borderRadius: 16,
            borderCurve: "continuous",
            backgroundColor: disabled ? palette.sand : palette.white,
            borderWidth: error || focused ? 2 : 1.5,
            borderColor,
            boxShadow: focused && !error ? "0 0 0 4px rgba(30, 138, 60, 0.12)" : undefined,
          },
          shakeStyle,
        ]}
      >
        {Icon ? <Icon size={18} color={focused ? palette.souki900 : palette.ink500} strokeWidth={2.2} /> : null}
        {prefix ? (
          <Text variant="body" weight="bold" numeric color={palette.ink900} style={{ paddingEnd: 10, borderEndWidth: 1, borderColor: palette.line }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          {...input}
          editable={!disabled}
          secureTextEntry={secure && hidden}
          placeholderTextColor={palette.ink400}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          style={{ flex: 1, height: "100%", fontFamily: fonts.latin.semibold, fontSize: 16, color: palette.ink900, textAlign: isRtl ? "right" : "left" }}
        />
        {verified ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, minHeight: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: palette.pale50 }}>
            <Check size={12} color={palette.market700} strokeWidth={3} />
            <Text variant="eyebrow" color={palette.market700} style={{ letterSpacing: 0, textTransform: "none" }}>
              {verified}
            </Text>
          </View>
        ) : null}
        {secure ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("Afficher le mot de passe") : t("Masquer le mot de passe")}
            style={{ width: 44, height: 44, marginEnd: -10, alignItems: "center", justifyContent: "center" }}
          >
            {hidden ? <Eye size={18} color={palette.ink500} /> : <EyeOff size={18} color={palette.ink500} />}
          </Pressable>
        ) : null}
      </Animated.View>
      {error || help ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, paddingStart: 4 }}>
          {error ? <CircleAlert size={14} color={palette.red600} strokeWidth={2.4} style={{ marginTop: 1 }} /> : null}
          <Text variant="footnote" weight={error ? "semibold" : "medium"} color={error ? palette.red600 : palette.ink500} style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>
            {error ?? help}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/**
 * Regles du mot de passe du site et du back-end, cochees en direct (PasswordRules). Chaque
 * coche entre en ressort ; haptique `selection` quand la derniere regle est remplie.
 */
export function PasswordRules({ value }: { value: string }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const allValid = passwordIsValid(value)
  const wasValid = useRef(allValid)
  useEffect(() => {
    if (allValid && !wasValid.current) haptics.selection()
    wasValid.current = allValid
  }, [allValid])

  return (
    <View accessibilityRole="summary" style={{ gap: 8, paddingHorizontal: 4 }}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value)
        return (
          <View key={rule.id} accessible accessibilityLabel={`${t(rule.label)} : ${ok ? t("rempli") : t("à remplir")}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: ok ? palette.market600 : "transparent",
                borderWidth: ok ? 0 : 2,
                borderColor: palette.ink300,
              }}
            >
              {ok ? (
                <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(SPRING_FINGER.damping).stiffness(SPRING_FINGER.stiffness)}>
                  <Check size={12} color={palette.white} strokeWidth={3.2} />
                </Animated.View>
              ) : null}
            </View>
            <Text variant="footnote" weight="semibold" color={ok ? palette.ink900 : palette.ink500}>
              {t(rule.label)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  /** Appele au 6e chiffre : la verification part seule. */
  onComplete: (code: string) => void
  error?: boolean
  done?: boolean
  length?: number
}

/**
 * Code OTP (OtpInput) : un seul champ cache (`oneTimeCode`, pave numerique) affiche en 6 cases ;
 * le code recu par SMS se propose au-dessus du clavier. Chaque chiffre entre en ressort,
 * curseur qui clignote, erreur : tremblement 320 ms et cases rouges.
 */
export function OtpInput({ value, onChange, onComplete, error = false, done = false, length = 6 }: OtpInputProps) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const shakeStyle = useShake(error ? value : null, error)

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel={t("Code à 6 chiffres")} accessibilityValue={{ text: value }}>
      <Animated.View style={[{ flexDirection: "row", gap: 8, direction: "ltr" }, shakeStyle]}>
        {Array.from({ length }, (_, index) => {
          const digit = value[index] ?? ""
          const current = !done && index === value.length
          const border = error ? palette.red600 : digit || current || done ? palette.market600 : palette.line
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: 58,
                borderRadius: 16,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: done ? palette.pale50 : palette.white,
                borderWidth: digit || current || error || done ? 2 : 1.5,
                borderColor: border,
                boxShadow: current && !error ? "0 0 0 4px rgba(30, 138, 60, 0.12)" : undefined,
              }}
            >
              {digit ? (
                <Animated.View key={`${index}-${digit}`} entering={reducedMotion ? undefined : ZoomIn.springify().damping(SPRING_FINGER.damping).stiffness(SPRING_FINGER.stiffness)}>
                  <Text variant="title1" weight="black" numeric color={error ? palette.red600 : palette.souki900} style={{ fontSize: 26, lineHeight: 30 }}>
                    {digit}
                  </Text>
                </Animated.View>
              ) : current ? (
                <BlinkingCaret />
              ) : null}
            </View>
          )
        })}
      </Animated.View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, "").slice(0, length)
          onChange(digits)
          if (digits.length === length) onComplete(digits)
        }}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
    </Pressable>
  )
}

const BLINK = {
  "0%": { opacity: 1 },
  "50%": { opacity: 0 },
  "100%": { opacity: 1 },
} as const

function BlinkingCaret() {
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      style={
        reducedMotion
          ? { width: 2, height: 26, borderRadius: 1, backgroundColor: palette.market600 }
          : {
              width: 2,
              height: 26,
              borderRadius: 1,
              backgroundColor: palette.market600,
              animationName: BLINK,
              animationDuration: "1000ms",
              animationIterationCount: "infinite",
              animationTimingFunction: "step-end",
            }
      }
    />
  )
}

/** Progression d'un parcours en etapes (StepProgress) : segments souki-900 remplis en 300 ms. */
export function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  const { t } = useLocale()
  return (
    <View accessible accessibilityLabel={t("Étape {n} sur {total} : {label}", { n: current, total, label })} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: total }, (_, index) => (
          <Animated.View
            key={index}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              backgroundColor: index < current ? palette.souki900 : palette.green100,
              transitionProperty: "backgroundColor",
              transitionDuration: 300,
            }}
          />
        ))}
      </View>
      <Text variant="footnote" weight="bold" color={palette.ink500} style={{ fontSize: 12 }}>
        {t("Étape {n} sur {total} · {label}", { n: current, total, label })}
      </Text>
    </View>
  )
}

/** Note d'information (sk-note) : verte par defaut, orange (alerte) ou rouge (danger). */
export function Note({ tone = "green", icon: Icon = tone === "green" ? Info : CircleAlert, children }: { tone?: "green" | "orange" | "red"; icon?: LucideIcon; children: ReactNode }) {
  const colors =
    tone === "orange" ? { background: palette.orange50, color: palette.orange700 } : tone === "red" ? { background: "#FDECEC", color: "#B42318" } : { background: palette.pale50, color: palette.souki900 }
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderCurve: "continuous", backgroundColor: colors.background }}>
      <Icon size={18} color={colors.color} strokeWidth={2.4} style={{ marginTop: 1 }} />
      <Text variant="footnote" weight="semibold" color={colors.color} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  )
}
