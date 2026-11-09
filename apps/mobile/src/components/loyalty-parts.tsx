import { useEffect, useState, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, ZoomIn } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import * as Clipboard from "expo-clipboard"
import { Check, Copy, Gift, Receipt, ShieldCheck, Truck, Wallet, X, type LucideIcon } from "lucide-react-native"
import { formatDirhams, isGiftTransaction, RECURRENCE_FREQUENCIES, walletTransactionLabel, type RecurrenceFrequency } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { SMotif } from "@/components/s-motif"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { DUR_SLOW, EASE_OUT_2027 } from "@/lib/motion"
import { colors, palette, radius, shadows } from "@/theme"

/* ---------- WalletCard : solde et deux soldes ---------- */

/**
 * Carte du Wallet (WalletCard) : solde total en tres gros chiffres qui roulent, barre en deux
 * couleurs (credit offert en jaune, utilise en premier ; remboursements en vert) qui change de
 * proportion en 300 ms. Aucun bouton pour une fonction qui n'existe pas (recharge, envoi).
 */
export function WalletCard({ gift, refund }: { gift: number; refund: number }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const total = gift + refund
  const share = total > 0 ? gift / total : 0
  const giftShare = useSharedValue(share)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    giftShare.set(reducedMotion ? share : withTiming(share, { duration: DUR_SLOW, easing: EASE_OUT_2027 }))
  }, [share, reducedMotion, giftShare])

  // Deux segments (8 pt minimum chacun), 3 pt d'ecart.
  const giftStyle = useAnimatedStyle(() => ({ width: Math.max(8, (width - 3) * giftShare.get()) }))

  return (
    <View
      accessible
      accessibilityLabel={t("Solde du Wallet : {montant} dirhams", { montant: formatDirhams(total) })}
      style={{ padding: 20, gap: 6, borderRadius: radius.feature, borderCurve: "continuous", overflow: "hidden", boxShadow: shadows.raised }}
    >
      <LinearGradient colors={[palette.night950, palette.forest800, palette.souki900]} locations={[0, 0.6, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <SMotif size={220} opacity={0.08} style={{ top: -40, end: -30 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Wallet size={18} color={palette.white} strokeWidth={2.2} />
        <Text variant="callout" weight="heavy" color={palette.white} style={{ fontSize: 14 }}>
          {t("Wallet SOUKI")}
        </Text>
      </View>
      <Text variant="eyebrow" color={palette.mint300} style={{ fontSize: 11 }}>
        {t("Solde disponible")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, direction: "ltr" }}>
        <AnimatedDigits value={formatDirhams(total)} weight="black" color={palette.white} style={{ fontSize: 52, lineHeight: 58, letterSpacing: -2 }} />
        <Text variant="headline" weight="heavy" color={palette.mint300} style={{ fontSize: 18 }}>
          DH
        </Text>
      </View>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: "row", gap: 3, height: 8, marginTop: 12, marginBottom: 4 }}>
        <Animated.View style={[{ borderRadius: 4, backgroundColor: palette.yellow400 }, giftStyle]} />
        <View style={{ flex: 1, minWidth: 8, borderRadius: 4, backgroundColor: palette.fresh500 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Balance color={palette.yellow400} label={t("Crédit offert")} amount={gift} />
        <Balance color={palette.fresh500} label={t("Remboursements")} amount={refund} />
      </View>
    </View>
  )
}

function Balance({ color, label, amount }: { color: string; label: string; amount: number }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "rgba(255, 255, 255, 0.08)" }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, marginTop: 4, backgroundColor: color }} />
      <View style={{ flex: 1 }}>
        <Text variant="footnote" weight="semibold" color={palette.mint300} style={{ fontSize: 12 }}>
          {label}
        </Text>
        <Text variant="headline" weight="black" numeric color={palette.white} style={{ fontSize: 17 }}>
          {`${formatDirhams(amount)} DH`}
        </Text>
      </View>
    </View>
  )
}

/* ---------- TransactionRow ---------- */

const TX_ICONS: Record<string, LucideIcon> = {
  DEBIT_COMMANDE: Receipt,
  DEBIT_MODIFICATION: Receipt,
  CREDIT_MODIFICATION: Receipt,
  CREDIT_ANNULATION: X,
  CREDIT_SAV: ShieldCheck,
  CREDIT_REFUS: Truck,
  PARRAINAGE_PARRAIN: Gift,
  PARRAINAGE_FILLEUL: Gift,
}

/** Ligne d'historique du Wallet : libelles du site, credit vert « + », debit « − », offert en jaune. */
export function TransactionRow({ type, amount, date, first }: { type: string; amount: number; date: string; first: boolean }) {
  const { t } = useLocale()
  const credit = amount > 0
  const gift = isGiftTransaction(type)
  const Icon = TX_ICONS[type] ?? Wallet
  const tile = gift ? { background: "#FFF6D6", color: "#8A6A00" } : credit ? { background: palette.pale50, color: palette.souki900 } : { background: palette.sand, color: palette.ink500 }
  return (
    <View accessible style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: palette.line }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: tile.background }}>
        <Icon size={18} color={tile.color} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 14 }}>
          {t(walletTransactionLabel(type))}
        </Text>
        <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 12 }}>
          {date}
        </Text>
      </View>
      <Text variant="callout" weight="black" numeric color={credit ? palette.market700 : palette.ink700} style={{ fontSize: 15 }}>
        {`${credit ? "+ " : "− "}${formatDirhams(Math.abs(amount))} DH`}
      </Text>
    </View>
  )
}

/* ---------- ReferralCode : le « Bon SOUKI » ---------- */

const NOTCH = 22
const STUB = 92

/**
 * Code de parrainage en « Bon SOUKI » (ReferralCode) : ticket perfore, code en Poppins Black
 * espace, gains des deux cotes. « Copier » met le code dans le presse-papiers (expo-clipboard) :
 * coche en ressort et « Copié » pendant 1,6 s, haptique `impactLight`. `onCopy` est facultatif.
 */
export function ReferralCode({ code, credit, onCopy }: { code: string; credit: number; onCopy?: () => void }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code)
      haptics.add()
      setCopied(true)
      onCopy?.()
    } catch {
      setCopied(false)
    }
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "stretch", borderRadius: 22, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: `${shadows.raised}, inset 0 0 0 1.5px ${palette.green100}`, overflow: "hidden", direction: "ltr" }}>
      <View style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 18, gap: 4 }}>
        <Text variant="eyebrow" color={palette.ink500} style={{ fontSize: 11 }}>
          {t("Bon SOUKI · votre code")}
        </Text>
        <Text selectable variant="title1" weight="black" numeric color={palette.souki900} style={{ fontSize: 34, lineHeight: 40, letterSpacing: 4.5 }}>
          {code}
        </Text>
        <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 12 }}>
          <Text variant="footnote" weight="black" color={palette.market700} style={{ fontSize: 12 }}>{`${formatDirhams(credit)} DH`}</Text>
          {` ${t("pour vous")} · `}
          <Text variant="footnote" weight="black" color={palette.market700} style={{ fontSize: 12 }}>{`${formatDirhams(credit)} DH`}</Text>
          {` ${t("pour votre proche")}`}
        </Text>
      </View>
      {/* Pointilles et encoches de la perforation */}
      <View style={{ width: 2, overflow: "hidden" }}>
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 4, borderWidth: 2, borderStyle: "dashed", borderColor: palette.green100 }} />
      </View>
      <Pressable
        onPress={() => void copy()}
        accessibilityRole="button"
        accessibilityLabel={copied ? t("Code copié") : t("Copier le code")}
        style={({ pressed }) => ({ width: STUB, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: palette.pale50, opacity: pressed ? 0.75 : 1 })}
      >
        {copied ? (
          <Animated.View key="copied" entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)}>
            <Check size={20} color={palette.market700} strokeWidth={2.8} />
          </Animated.View>
        ) : (
          <Copy size={20} color={palette.souki900} strokeWidth={2.4} />
        )}
        <Text variant="footnote" weight="heavy" color={copied ? palette.market700 : palette.souki900} style={{ fontSize: 12 }}>
          {copied ? t("Copié") : t("Copier")}
        </Text>
      </Pressable>
      <View pointerEvents="none" style={{ position: "absolute", top: -NOTCH / 2, right: STUB + 1 - NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.background }} />
      <View pointerEvents="none" style={{ position: "absolute", bottom: -NOTCH / 2, right: STUB + 1 - NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.background }} />
    </View>
  )
}

/* ---------- Etapes « Comment ça marche ? » et regles ---------- */

export function HowTo({ steps }: { steps: { title: string; detail: string }[] }) {
  return (
    <View>
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        return (
          <View key={step.title} style={{ flexDirection: "row", gap: 12, paddingBottom: last ? 0 : 14 }}>
            {last ? null : <View style={{ position: "absolute", top: 34, bottom: 0, start: 16, width: 2, backgroundColor: palette.green100 }} />}
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: palette.souki900 }}>
              <Text variant="callout" weight="black" numeric color={palette.white} style={{ fontSize: 14 }}>
                {String(index + 1)}
              </Text>
            </View>
            <View style={{ flex: 1, paddingTop: 6, gap: 2 }}>
              <Text variant="callout" weight="heavy" color={palette.ink900} style={{ fontSize: 14 }}>
                {step.title}
              </Text>
              <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
                {step.detail}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

/** Liste a puces « Bon à savoir ». */
export function RulesList({ rules }: { rules: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      {rules.map((rule) => (
        <View key={rule} style={{ flexDirection: "row", gap: 8 }}>
          <Text variant="footnote" color={palette.ink700} style={{ fontSize: 12, lineHeight: 17 }}>
            •
          </Text>
          <Text variant="footnote" color={palette.ink700} style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
            {rule}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** Trois compteurs (filleuls credites, en attente, gagne). */
export function Stats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flex: 1, padding: 12, gap: 2, borderRadius: 18, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
          <Text variant="title2" weight="black" numeric color={palette.souki900} style={{ fontSize: 22 }}>
            {item.value}
          </Text>
          <Text variant="footnote" weight="bold" color={palette.ink500} style={{ fontSize: 11, lineHeight: 14 }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

/* ---------- FrequencyPicker ---------- */

/** Les 4 rythmes du site, en cartes radio. Haptique `selection`. */
export function FrequencyPicker({ value, onChange }: { value: RecurrenceFrequency; onChange: (value: RecurrenceFrequency) => void }) {
  const { t } = useLocale()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("À quel rythme ?")} style={{ gap: 8 }}>
      {RECURRENCE_FREQUENCIES.map((frequency) => {
        const active = frequency.value === value
        return (
          <Pressable
            key={frequency.value}
            onPress={() => {
              if (active) return
              haptics.selection()
              onChange(frequency.value)
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 56,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: active ? palette.pale50 : palette.white,
              borderWidth: active ? 2 : 1.5,
              borderColor: active ? palette.souki900 : palette.line,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? palette.souki900 : palette.ink300, alignItems: "center", justifyContent: "center" }}>
              {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.souki900 }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight="heavy" color={palette.ink900} style={{ fontSize: 15 }}>
                {t(frequency.label)}
              </Text>
              <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 12 }}>
                {t(frequency.detail)}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Choix en segments (sk-seg) : « À la livraison » / « Wallet SOUKI ». */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", alignSelf: "flex-start", padding: 3, borderRadius: radius.pill, backgroundColor: palette.sand }}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (active) return
              haptics.selection()
              onChange(option.value)
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            hitSlop={{ top: 6, bottom: 6 }}
            style={{ height: 32, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: "center", backgroundColor: active ? palette.white : "transparent", boxShadow: active ? "0 2px 8px -2px rgba(10, 40, 20, 0.2)" : undefined }}
          >
            <Text variant="footnote" weight="bold" color={active ? palette.souki900 : palette.ink500} style={{ fontSize: 13 }}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Carte blanche titree (sk-co-card) avec un contenu libre. */
export function LoyaltyCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      {title ? (
        <Text variant="eyebrow" color={palette.ink500} style={{ fontSize: 13 }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  )
}

