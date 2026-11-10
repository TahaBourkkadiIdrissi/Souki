import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Linking, Pressable, ScrollView, Switch, View } from "react-native"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  MapPin,
  Store,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react-native"
import {
  checkoutAmounts,
  DEFAULT_DELIVERY_TIME,
  DELIVERY_CITY,
  formatCountdown,
  formatDeliveryDate,
  formatDirhams,
  isValidMoroccanPhone,
  minutesToHHMM,
  minutesToLabel,
  normalizeMoroccanPhone,
  PANIER_MINIMUM_DH,
  type BlacklistStatusDTO,
  type CartTotals,
  type CheckoutAmounts,
  type PaymentMode,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { BrandButton } from "@/components/brand-button"
import { BrandEmptyState } from "@/components/brand-empty-state"
import { CheckoutCard, CheckoutLine, Checkbox, PaymentOption, PaymentRow, ThumbStack, TimeSlider } from "@/components/checkout-parts"
import { Note, StepProgress, TextField } from "@/components/form-fields"
import { MapPicker, type PickedPlace } from "@/components/map-picker"
import { MoonMark } from "@/components/market-clock"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCartSummary } from "@/hooks/use-cart-summary"
import { useOrderHours } from "@/hooks/use-order-hours"
import {
  ApiError,
  fetchBlacklistStatus,
  fetchSettingsBootstrap,
  markBlacklistLiftNotificationSeen,
  submitCheckout,
} from "@/lib/api"
import { SITE_URL } from "@/lib/config"
import { haptics } from "@/lib/haptics"
import { forgetVoiceDraft, peekVoiceDraft } from "@/lib/voice-draft"
import { DUR_BASE, EASE_OUT_2027 } from "@/lib/motion"
import { colors, palette, radius, shadows } from "@/theme"

const STEPS = ["Adresse", "Livraison", "Paiement", "Récapitulatif"] as const
type Step = 1 | 2 | 3 | 4

/** +212612345678 -> "+212 6 12 34 56 78" */
function formatPhone(raw: string): string {
  const value = normalizeMoroccanPhone(raw)
  if (!/^\+212\d{9}$/.test(value)) return raw
  return `+212 ${value[4]} ${value.slice(5, 7)} ${value.slice(7, 9)} ${value.slice(9, 11)} ${value.slice(11, 13)}`
}

/**
 * Checkout en 4 etapes (EcranCheckout, design system 2027), plein ecran modal ouvert par
 * « Valider la commande » : adresse et carte, heure de livraison, paiement, recapitulatif.
 * Regles et montants du site (apps/client/app/checkout/page.tsx) ; le back-end recalcule tout
 * a la validation (POST /api/checkout). Le total reste visible au-dessus du bouton colle en bas.
 */
export default function CheckoutScreen() {
  const router = useRouter()
  // Brouillon de la commande vocale (?vocal=ID) : garde le lien voix -> commande, comme le site.
  const { vocal } = useLocalSearchParams<{ vocal?: string }>()
  // Liste vocale passee par le panier : le numero du brouillon est garde en memoire (lib/voice-draft).
  const voiceDraftId = vocal && /^\d+$/.test(vocal) ? Number(vocal) : peekVoiceDraft()
  const { t, isRtl } = useLocale()
  const reducedMotion = useReducedMotion()
  const { status, profile } = useAuth()
  const { clear } = useCart()
  const { lines, totals } = useCartSummary()
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const submitted = useRef(false)

  const [step, setStep] = useState<Step>(1)
  const [address, setAddress] = useState(profile?.address.adresse ?? "")
  const [addressEdited, setAddressEdited] = useState(Boolean(profile?.address.adresse))
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [phone, setPhone] = useState((profile?.telephone ?? "").replace(/^\+212/, ""))
  const [instructions, setInstructions] = useState("")
  const [showErrors, setShowErrors] = useState(false)
  const [time, setTime] = useState(DEFAULT_DELIVERY_TIME)
  const [payment, setPayment] = useState<PaymentMode>("cod")
  // Credit Wallet deduit du paiement a la livraison, active par defaut comme sur le site.
  const [useWalletCredit, setUseWalletCredit] = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)
  const [blacklist, setBlacklist] = useState<BlacklistStatusDTO | null>(null)
  const [liftSeen, setLiftSeen] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Profil, solde du Wallet et restriction du paiement a la livraison, comme le site.
  useEffect(() => {
    if (status !== "signedIn") return
    const controller = new AbortController()
    fetchSettingsBootstrap(controller.signal)
      .then((data) => {
        const centimes = data.wallet?.balance_centimes ?? data.wallet?.solde_centimes ?? 0
        setWalletBalance(centimes / 100)
        if (data.profile.address?.adresse) {
          setAddress((current) => current || data.profile.address.adresse)
          setAddressEdited(true)
        }
        if (data.profile.telephone) setPhone((current) => current || data.profile.telephone.replace(/^\+212/, ""))
      })
      .catch(() => undefined)
    fetchBlacklistStatus(controller.signal)
      .then(setBlacklist)
      .catch(() => setBlacklist(null))
    return () => controller.abort()
  }, [status])

  const codBlocked = Boolean(blacklist?.is_blacklisted)
  useEffect(() => {
    if (codBlocked && payment === "cod") setPayment("wallet")
  }, [codBlocked, payment])

  const available = useMemo(() => lines.filter((line) => !line.unavailable), [lines])
  const amounts = checkoutAmounts(totals.total, walletBalance, payment, useWalletCredit)
  const paidByWallet = payment === "wallet"

  const phoneMissing = phone.trim().length === 0
  const phoneInvalid = !phoneMissing && !isValidMoroccanPhone(phone)
  const addressMissing = address.trim().length === 0
  const outsideZone = place !== null && !place.inZone
  const stepOneValid = !phoneMissing && !phoneInvalid && !addressMissing
  const paymentValid = paidByWallet ? !amounts.walletInsufficient : !codBlocked

  const goTo = (next: Step) => {
    setStep(next)
    setSubmitError(null)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  const back = () => {
    if (step === 1) router.back()
    else goTo((step - 1) as Step)
  }

  const next = () => {
    if (step === 1 && !stepOneValid) {
      setShowErrors(true)
      haptics.error()
      return
    }
    haptics.selection()
    goTo((step + 1) as Step)
  }

  // Demande de levee dans une feuille native (app/levee-restriction.tsx).
  const askLift = () => router.push("/levee-restriction")

  // Au retour de la feuille, l'etat de la restriction est relu (« demande en attente »).
  useFocusEffect(
    useCallback(() => {
      if (status !== "signedIn") return
      fetchBlacklistStatus()
        .then(setBlacklist)
        .catch(() => undefined)
    }, [status]),
  )

  const acknowledgeLift = () => {
    markBlacklistLiftNotificationSeen()
      .then(() => setLiftSeen(true))
      .catch(() => undefined)
  }

  const placeOrder = async () => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const response = await submitCheckout({
        items: available.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
        creneau_livraison: minutesToHHMM(time),
        mode_paiement: payment,
        utiliser_wallet: amounts.walletDiscount > 0,
        contact_phone: normalizeMoroccanPhone(phone),
        delivery_address: address.trim(),
        delivery_city: DELIVERY_CITY,
        delivery_instructions: instructions.trim() || null,
        brouillon_vocal_id: voiceDraftId,
        panier_id: null,
      })
      submitted.current = true
      forgetVoiceDraft()
      haptics.success()
      router.replace({
        pathname: "/commande-validee",
        params: {
          id: String(response.commande_id),
          date: response.date_livraison ?? "",
          heure: minutesToLabel(time),
          count: String(response.lignes.length || available.length),
          due: String(response.reste_a_payer ?? amounts.due),
          wallet: String(response.montant_wallet ?? amounts.walletDiscount),
          mode: paidByWallet ? "wallet" : "cod",
        },
      })
      clear()
    } catch (caught) {
      haptics.error()
      setSubmitError(caught instanceof ApiError ? t(caught.message) : t("Erreur de connexion au serveur."))
      setSubmitting(false)
    }
  }

  // Invite : la commande se passe avec un compte (le site redirige aussi vers la connexion).
  if (status === "guest") {
    return (
      <CheckoutFrame step={step} onBack={() => router.back()} closeOnly>
        <BrandEmptyState
          art="basket"
          title={t("Connectez-vous pour commander")}
          description={t("Votre panier reste enregistré sur ce téléphone.")}
          action={{ label: t("Se connecter"), onPress: () => router.replace("/connexion") }}
        />
      </CheckoutFrame>
    )
  }

  if (lines.length === 0 && !submitted.current) {
    return (
      <CheckoutFrame step={step} onBack={() => router.back()} closeOnly>
        <BrandEmptyState
          art="basket"
          title={t("Votre panier est vide")}
          description={t("Choisissez vos produits avant de passer commande.")}
          action={{ label: t("Voir le marché"), onPress: () => router.dismissTo("/marche") }}
        />
      </CheckoutFrame>
    )
  }

  const caption = step < 3 ? t("Total TTC") : paidByWallet ? t("Payé par votre Wallet") : t("À payer à la livraison")
  const dockAmount = step < 3 ? totals.total : amounts.due

  return (
    <CheckoutFrame
      step={step}
      onBack={back}
      scrollRef={scrollRef}
      dock={
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 8 }}>
            <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 13 }}>
              {caption}
            </Text>
            <AnimatedDigits value={`${formatDirhams(dockAmount)} DH`} weight="black" color={palette.souki900} style={{ fontSize: 17, lineHeight: 22 }} />
          </View>
          {step < 4 ? (
            <BrandButton label={t("Continuer")} icon={isRtl ? ChevronLeft : ArrowRight} iconPosition="end" disabled={step === 3 && !paymentValid} onPress={next} />
          ) : (
            <PlaceOrderButton
              ready={accepted && totals.meetsMinimum && stepOneValid && paymentValid && available.length > 0}
              submitting={submitting}
              onPress={() => void placeOrder()}
            />
          )}
        </>
      }
    >
      <Animated.View key={step} entering={reducedMotion ? undefined : FadeIn.duration(DUR_BASE).easing(EASE_OUT_2027)} style={{ gap: 14 }}>
        {step === 1 ? (
          <>
            <StepTitle>{t("Où livrer ?")}</StepTitle>
            <MapPicker
              height={190}
              onPick={(picked) => {
                setPlace(picked)
                if (!addressEdited) setAddress([picked.street, picked.area].filter(Boolean).join(", "))
              }}
            />
            {outsideZone ? <Note tone="orange">{t("SOUKI livre uniquement à Fès pour l'instant. Choisissez une adresse à Fès.")}</Note> : null}
            <CheckoutCard>
              <TextField
                label={t("Adresse")}
                icon={MapPin}
                value={address}
                onChangeText={(text) => {
                  setAddressEdited(true)
                  setAddress(text)
                }}
                placeholder={t("Entrez votre adresse de livraison")}
                textContentType="fullStreetAddress"
                error={showErrors && addressMissing ? t("Ajoutez votre adresse de livraison.") : null}
              />
              <TextField label={t("Ville")} icon={Store} value={t(DELIVERY_CITY)} disabled help={t("SOUKI livre uniquement à Fès.")} />
              <TextField
                label={t("Numéro de téléphone")}
                prefix="+212"
                value={phone}
                onChangeText={setPhone}
                placeholder="6 12 34 56 78"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                help={t("Ajoutez un numéro pour que SOUKI confirme la livraison.")}
                error={
                  showErrors && phoneMissing
                    ? t("Ajoutez un numéro pour que SOUKI confirme la livraison.")
                    : phoneInvalid && showErrors
                      ? t("Numéro invalide. Format attendu : 06XXXXXXXX, 07XXXXXXXX ou +212XXXXXXXXX")
                      : null
                }
              />
              <TextField
                label={t("Instructions livraison")}
                optional={t("(optionnel)")}
                value={instructions}
                onChangeText={setInstructions}
                placeholder={t("Ex : 2e étage, code porte 1234…")}
                multiline
                maxLength={300}
              />
            </CheckoutCard>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <StepTitle>{t("Quand livrer ?")}</StepTitle>
            <DeliveryDateCard />
            <TimeSlider value={time} onChange={setTime} />
            <DeliveryTimeNote />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <StepTitle>{t("Comment payer ?")}</StepTitle>
            {blacklist ? <BlacklistNotice status={blacklist} liftSeen={liftSeen} onAsk={askLift} onAcknowledge={acknowledgeLift} /> : null}
            <View accessibilityRole="radiogroup" accessibilityLabel={t("Méthode de paiement")} style={{ gap: 10 }}>
              <PaymentOption
                icon={Banknote}
                title={t("Paiement à la livraison")}
                desc={codBlocked ? t("Indisponible tant que la restriction est active.") : t("Payez à la porte, confirmation appel la veille")}
                selected={payment === "cod" && !codBlocked}
                disabled={codBlocked}
                onSelect={() => setPayment("cod")}
              >
                {walletBalance > 0 ? (
                  <PaymentRow
                    title={t("Utiliser mon crédit Wallet ({montant} DH)", { montant: formatDirhams(Math.min(walletBalance, totals.total)) })}
                    detail={t("Déduit du montant à payer, le reste se règle en cash à la porte.")}
                    control={
                      <Switch
                        value={useWalletCredit}
                        onValueChange={(value) => {
                          haptics.selection()
                          setUseWalletCredit(value)
                        }}
                        trackColor={{ true: palette.market600, false: palette.line }}
                        accessibilityLabel={t("Utiliser mon crédit Wallet")}
                      />
                    }
                  />
                ) : null}
              </PaymentOption>
              <PaymentOption
                icon={Wallet}
                title={t("Wallet SOUKI")}
                trailing={t("Solde : {montant} DH", { montant: formatDirhams(walletBalance) })}
                desc={
                  amounts.walletInsufficient
                    ? t("Insuffisant pour tout payer : choisissez le paiement à la livraison, votre crédit sera déduit.")
                    : t("Le Wallet règle toute la commande.")
                }
                selected={paidByWallet && !amounts.walletInsufficient}
                disabled={amounts.walletInsufficient}
                onSelect={() => setPayment("wallet")}
              />
              <PaymentOption icon={CreditCard} title={t("Carte bancaire CMI")} badge={t("Bientôt")} desc={t("Visa / Mastercard marocain — bientôt disponible")} selected={false} disabled />
            </View>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <StepTitle>{t("Tout est bon ?")}</StepTitle>
            <ClosedBanner />
            <CheckoutCard title={t("Livraison")} onEdit={() => goTo(1)}>
              <CheckoutLine icon={MapPin} title={`${address.trim()}, ${t(DELIVERY_CITY)}`} detail={formatPhone(phone)} />
              <DeliveryWhenLine time={time} />
            </CheckoutCard>
            <CheckoutCard title={t("Panier")} onEdit={() => router.back()}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <ThumbStack images={available.map((line) => line.live?.image ?? line.product.image)} />
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="callout" weight="bold" color={palette.ink900} style={{ fontSize: 15 }}>
                    {t(available.length === 1 ? "{n} produit" : "{n} produits", { n: available.length })}
                  </Text>
                  <Text variant="footnote" color={palette.ink500} style={{ fontSize: 12 }}>
                    {t("Prix du jour")}
                  </Text>
                </View>
              </View>
            </CheckoutCard>
            <CheckoutCard title={t("Paiement")} onEdit={() => goTo(3)}>
              {paidByWallet ? (
                <CheckoutLine icon={Wallet} title={t("Wallet SOUKI")} detail={t("Le Wallet règle toute la commande.")} />
              ) : (
                <CheckoutLine
                  icon={Banknote}
                  title={t("Paiement à la livraison")}
                  detail={
                    amounts.walletDiscount > 0
                      ? t("Crédit Wallet de {montant} DH déduit", { montant: formatDirhams(amounts.walletDiscount) })
                      : t("Payez à la porte, confirmation appel la veille")
                  }
                />
              )}
            </CheckoutCard>
            <CheckoutTotals totals={totals} amounts={amounts} paidByWallet={paidByWallet} />
            {!totals.meetsMinimum ? (
              <Note tone="orange">
                {t("Minimum de commande : {min} DH, livraison comprise. Ajoutez encore {manque} DH de produits.", {
                  min: PANIER_MINIMUM_DH,
                  manque: formatDirhams(totals.missingForMinimum),
                })}
              </Note>
            ) : null}
            {submitError ? <Note tone="red">{submitError}</Note> : null}
            <Checkbox checked={accepted} onChange={setAccepted} accessibilityLabel={t("J'ai lu et j'accepte la Politique de Confidentialité")}>
              <Text variant="callout" color={palette.ink700} style={{ fontSize: 14, lineHeight: 20 }}>
                {t("J'ai lu et j'accepte la")}{" "}
                <Text
                  variant="callout"
                  weight="heavy"
                  color={palette.market700}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(`${SITE_URL}/politique-confidentialite`)}
                  style={{ fontSize: 14, lineHeight: 20 }}
                >
                  {t("Politique de Confidentialité")}
                </Text>
              </Text>
            </Checkbox>
          </>
        ) : null}
      </Animated.View>
    </CheckoutFrame>
  )
}

/* ---------- Gabarit : barre du haut, etapes, contenu, dock ---------- */

type CheckoutFrameProps = {
  step: Step
  onBack: () => void
  /** Etat vide ou invite : bouton fermer seul, sans etapes. */
  closeOnly?: boolean
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>
  dock?: ReactNode
  children: ReactNode
}

function CheckoutFrame({ step, onBack, closeOnly = false, scrollRef, dock, children }: CheckoutFrameProps) {
  const { t, isRtl, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const Back = isRtl ? ChevronRight : ChevronLeft
  const showBack = !closeOnly && step > 1

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 12, gap: 10, backgroundColor: palette.glass, boxShadow: `0 1px 0 ${palette.line}`, zIndex: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={showBack ? t("Étape précédente") : t("Fermer")}
            hitSlop={4}
            style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.sand }}>
              {showBack ? <Back size={18} color={palette.ink900} strokeWidth={2.6} /> : <X size={18} color={palette.ink900} strokeWidth={2.6} />}
            </View>
          </Pressable>
          <Text accessibilityRole="header" variant="headline" weight="heavy" color={palette.ink900} align="center" style={{ flex: 1, fontSize: 17 }}>
            {t("Finaliser ma commande")}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        {closeOnly ? null : <StepProgress current={step} total={STEPS.length} label={t(STEPS[step - 1])} />}
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14, flexGrow: 1 }}
      >
        {children}
      </ScrollView>

      {dock ? (
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: Math.max(insets.bottom, 12),
            padding: 10,
            gap: 8,
            borderRadius: 30,
            borderCurve: "continuous",
            backgroundColor: palette.glass,
            boxShadow: `${shadows.float}, inset 0 0 0 1px rgba(255, 255, 255, 0.8)`,
          }}
        >
          {dock}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

function StepTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" variant="title2" weight="black" color={palette.ink900} style={{ marginTop: 6, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}>
      {children}
    </Text>
  )
}

/* ---------- Petits composants qui suivent l'horloge des commandes ---------- */
// Isoles : seuls eux se redessinent chaque seconde, pas tout le checkout.

/** Date de livraison : ce n'est pas un choix, c'est le lendemain confirme. */
function DeliveryDateCard() {
  const { t, dateLocale } = useLocale()
  const { deliveryDate } = useOrderHours()
  const label = formatDeliveryDate(deliveryDate, dateLocale)
  const day = deliveryDate ? new Date(`${deliveryDate}T12:00:00Z`) : null
  const weekday = day ? new Intl.DateTimeFormat(dateLocale, { timeZone: "UTC", weekday: "short" }).format(day) : null

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, borderCurve: "continuous", backgroundColor: palette.souki900 }}>
      <View style={{ width: 52, height: 56, borderRadius: 14, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: palette.white }}>
        {day ? (
          <>
            <Text variant="eyebrow" color={palette.orange700} style={{ fontSize: 10 }}>
              {weekday}
            </Text>
            <Text variant="title2" weight="black" numeric color={palette.souki900} style={{ fontSize: 24, lineHeight: 28 }}>
              {String(day.getUTCDate())}
            </Text>
          </>
        ) : (
          <CalendarDays size={24} color={palette.souki900} strokeWidth={2.2} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="heavy" color={palette.white} style={{ fontSize: 15 }}>
          {label ? label.charAt(0).toUpperCase() + label.slice(1) : t("Le lendemain de la commande")}
        </Text>
        <Text variant="footnote" color={palette.mint300} style={{ fontSize: 12, lineHeight: 16 }}>
          {label ? t("Le lendemain de la commande, date confirmée") : t("Date confirmée à la réouverture, à 8h")}
        </Text>
      </View>
    </View>
  )
}

function DeliveryTimeNote() {
  const { t, dateLocale } = useLocale()
  const { deliveryDate } = useOrderHours()
  const date = formatDeliveryDate(deliveryDate, dateLocale)
  return (
    <Note icon={Clock}>
      {date
        ? t("Livraison le {date}, entre 8h et 15h, à l'heure choisie. Modifiable ou annulable jusqu'à 01h00.", { date })
        : t("Livraison entre 8h et 15h, à l'heure choisie. Modifiable ou annulable jusqu'à 01h00.")}
    </Note>
  )
}

function DeliveryWhenLine({ time }: { time: number }) {
  const { t, dateLocale } = useLocale()
  const { deliveryDate } = useOrderHours()
  const date = formatDeliveryDate(deliveryDate, dateLocale)
  const title = date ? `${date.charAt(0).toUpperCase()}${date.slice(1)}, ${t("vers {heure}", { heure: minutesToLabel(time) })}` : t("Vers {heure}", { heure: minutesToLabel(time) })
  return <CheckoutLine icon={CalendarDays} title={title} detail={t("Entre 8h et 15h, à l'heure choisie")} />
}

/** Bandeau nuit (01h-08h) : la lune et le compte a rebours de reouverture. */
function ClosedBanner() {
  const { t } = useLocale()
  const hours = useOrderHours()
  if (!hours.closed) return null
  return (
    <View accessibilityRole="summary" style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.night950, overflow: "hidden" }}>
      <MoonMark />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="black" color={palette.white} style={{ fontSize: 16 }}>
          {t("Commandes fermées · réouverture à 8h")}
        </Text>
        <Text variant="footnote" weight="semibold" color={palette.mint300} style={{ fontSize: 12, lineHeight: 16 }}>
          {t("Commandes et modifications fermées de 01h à 08h. Votre récapitulatif reste ici.")}
        </Text>
        <AnimatedDigits value={formatCountdown(hours)} weight="black" color={palette.white} style={{ fontSize: 22, lineHeight: 28, marginTop: 6 }} />
      </View>
    </View>
  )
}

/** « Passer la commande » ; « Validation dès 8h » de 01h a 08h (le serveur refuse aussi). */
function PlaceOrderButton({ ready, submitting, onPress }: { ready: boolean; submitting: boolean; onPress: () => void }) {
  const { t } = useLocale()
  const { closed } = useOrderHours()
  if (submitting) {
    return (
      <View style={{ minHeight: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, backgroundColor: palette.souki900 }}>
        <ActivityIndicator color={palette.white} />
        <Text variant="headline" weight="bold" color={palette.white}>
          {t("Validation…")}
        </Text>
      </View>
    )
  }
  return <BrandButton label={closed ? t("Validation dès 8h") : t("Passer la commande")} icon={Check} disabled={closed || !ready} onPress={onPress} />
}

/* ---------- Restriction du paiement a la livraison ---------- */

function BlacklistNotice({ status, liftSeen, onAsk, onAcknowledge }: { status: BlacklistStatusDTO; liftSeen: boolean; onAsk: () => void; onAcknowledge: () => void }) {
  const { t } = useLocale()
  const lifted = status.last_action === "LIFTED" && !status.lift_notification_seen && !liftSeen

  if (!status.is_blacklisted && lifted) {
    return (
      <View style={{ gap: 10 }}>
        <Note>{t("Restriction levée : le paiement à la livraison est à nouveau disponible.")}</Note>
        <BrandButton tone="soft" size="sm" fill={false} label={t("J'ai compris")} onPress={onAcknowledge} />
      </View>
    )
  }
  if (!status.is_blacklisted) return null

  return (
    <View style={{ gap: 8, padding: 14, borderRadius: 18, borderCurve: "continuous", backgroundColor: palette.orange50 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TriangleAlert size={18} color={palette.orange700} strokeWidth={2.4} />
        <Text variant="callout" weight="heavy" color={palette.ink900} style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>
          {t("Votre compte ne peut plus passer de commandes en paiement à la livraison")}
        </Text>
      </View>
      <Text variant="footnote" color={palette.ink700} style={{ fontSize: 13, lineHeight: 18 }}>
        {t("Suite à un refus de livraison. Le Wallet reste disponible.")}
      </Text>
      {status.last_action === "LIFT_REQUESTED" ? (
        <Text variant="footnote" weight="semibold" color={palette.orange700} style={{ fontSize: 13 }}>
          {t("Demande de levée en attente de décision.")}
        </Text>
      ) : null}
      {status.last_action === "LIFT_REJECTED" ? (
        <Text variant="footnote" weight="semibold" color={palette.red600} style={{ fontSize: 13 }}>
          {t("Demande refusée. Motif : {motif}", { motif: status.last_reason ?? "—" })}
        </Text>
      ) : null}
      {status.last_action !== "LIFT_REQUESTED" ? (
        <BrandButton tone="soft" size="sm" fill={false} label={t("Demander la levée de restriction")} onPress={onAsk} />
      ) : null}
    </View>
  )
}

/* ---------- Totaux (sk-sum) ---------- */

function CheckoutTotals({ totals, amounts, paidByWallet }: { totals: CartTotals; amounts: CheckoutAmounts; paidByWallet: boolean }) {
  const { t } = useLocale()
  const totalLabel = paidByWallet ? t("Payé par votre Wallet") : amounts.walletDiscount > 0 ? t("À payer à la livraison") : t("Total TTC")
  return (
    <View style={{ padding: 18, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      <SumRow label={t("Sous-total produits")} value={`${formatDirhams(totals.subtotal)} DH`} />
      <SumRow label={t("Frais de livraison")} value={totals.deliveryFee > 0 ? `${formatDirhams(totals.deliveryFee)} DH` : t("Offerte")} free={totals.deliveryFee === 0} />
      {amounts.walletDiscount > 0 ? (
        <>
          <SumRow label={t("Total TTC")} value={`${formatDirhams(totals.total)} DH`} />
          <SumRow label={t("Crédit Wallet SOUKI")} value={`− ${formatDirhams(amounts.walletDiscount)} DH`} free />
        </>
      ) : null}
      {/* Trait pointille : iOS ne dessine le pointille que sur une bordure complete. */}
      <View style={{ height: 1, marginTop: 2, overflow: "hidden" }}>
        <View style={{ height: 3, borderWidth: 1, borderStyle: "dashed", borderColor: palette.line }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingTop: 2 }}>
        <Text variant="headline" weight="black" color={palette.ink900} style={{ fontSize: 17 }}>
          {totalLabel}
        </Text>
        <AnimatedDigits value={`${formatDirhams(amounts.due)} DH`} weight="black" color={palette.souki900} style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.7 }} />
      </View>
    </View>
  )
}

function SumRow({ label, value, free = false }: { label: string; value: string; free?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <Text variant="callout" color={palette.ink700} style={{ fontSize: 15 }}>
        {label}
      </Text>
      <Text variant="callout" weight={free ? "black" : "heavy"} numeric color={free ? palette.market700 : palette.ink900} style={{ fontSize: 15 }}>
        {value}
      </Text>
    </View>
  )
}
