import { useEffect, useMemo, useState } from "react"
import { Alert, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, useWindowDimensions, View } from "react-native"
import Animated, { Easing, FadeIn, Keyframe, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { ArrowLeft, ArrowRight, Check, Languages, Leaf, MapPin, Mic, ShoppingBasket, Sparkles, Truck, User, type LucideIcon } from "lucide-react-native"
import { formatDirhams, formatPriceUnit, formatQuantity, normalizeMoroccanPhone, type Locale } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Note, TextField } from "@/components/form-fields"
import { MapPicker, type PickedPlace } from "@/components/map-picker"
import { OnboardingRoad } from "@/components/onboarding-road"
import {
  AssistantsScene,
  MarketScene,
  NameScene,
  PhoneScene,
  SceneCanvas,
  TrustScene,
  WelcomeScene,
  type SceneKey,
  type SceneProduct,
} from "@/components/onboarding-scenes"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { ApiError, updateAddress, updateProfile } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { MARKET_KEYS, pickProducts } from "@/lib/scene-products"
import { formatPhoneDigits, isPhoneComplete, markOnboardingSeen, missingInfo, phoneDigits, type OnboardingInfo } from "@/lib/onboarding"
import { fonts, palette, radius, shadows } from "@/theme"

const SPLASH = require("../../assets/brand/splash-symbol.png")
const INTRO: SceneKey[] = ["marche", "voix", "confiance"]
const INFO: OnboardingInfo[] = ["prenom", "adresse", "telephone"]
/** iPhone SE (667 pt de haut) : scene plus basse et textes plus petits (page EcranPetit). */
const COMPACT_HEIGHT = 700

/** Fond de chaque etape (sk-ob-bg-*), en fondu de 420 ms d'une etape a l'autre. */
const BACKGROUNDS: Record<SceneKey, { colors: [string, string, ...string[]]; locations?: [number, number, ...number[]] }> = {
  bienvenue: { colors: [palette.yellow400, palette.yellow400] },
  prenom: { colors: [palette.green100, palette.green100] },
  adresse: { colors: ["#EEF1EA", "#EEF1EA"] },
  telephone: { colors: [palette.souki900, palette.souki900] },
  marche: { colors: [palette.night950, palette.forest800, palette.market600], locations: [0, 0.55, 1] },
  voix: { colors: [palette.forest700, palette.forest900], locations: [0.1, 0.8] },
  confiance: { colors: [palette.mint300, palette.mint300] },
}
/** Fonds clairs : le logo passe en vert SOUKI. */
const LIGHT_BACKGROUNDS = new Set<SceneKey>(["bienvenue", "prenom", "adresse", "confiance"])

type Fact = { icon: LucideIcon; label: string }

/** Le texte glisse de 28 pt dans le sens du geste (sens inverse en arabe). */
function slideIn(fromEnd: boolean) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateX: fromEnd ? 28 : -28 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }], easing: Easing.out(Easing.cubic) },
  }).duration(380)
}

/**
 * Onboarding « Bienvenue chez SOUKI » (Onboarding, design system 2027) : une seule fois, juste apres
 * la creation du compte, avant l'accueil. Bienvenue + langue ; puis SEULEMENT ce qui manque pour
 * livrer (prenom, adresse, telephone), chacun avec « Plus tard » ; puis trois ecrans sur le service
 * (« Passer » mene a l'accueil). Pas de demande de notifications ici. La progression est le chemin
 * du « S » avec le camion. Glisser la scene change d'etape (sauf sur la carte de l'adresse).
 * Les reponses sont enregistrees a la fin avec les routes existantes du profil et de l'adresse.
 */
export default function BienvenueScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const compact = height < COMPACT_HEIGHT
  const reducedMotion = useReducedMotion()
  const { t, locale, setLocale, isRtl, direction } = useLocale()
  const { profile, refresh } = useAuth()
  const { products } = useCatalogue()
  // Developpement seulement : toutes les etapes, et rien n'est enregistre sur le vrai compte.
  const { demo } = useLocalSearchParams<{ demo?: string }>()
  const isDemo = __DEV__ && demo === "1"

  // Ce qui manque, fige au premier profil connu : les etapes ne changent plus ensuite.
  const [missing, setMissing] = useState<OnboardingInfo[] | null>(isDemo ? [...INFO] : profile ? missingInfo(profile) : null)
  useEffect(() => {
    if (missing === null && profile) setMissing(missingInfo(profile))
  }, [missing, profile])
  // Profil introuvable (reseau) : on ne bloque pas, l'onboarding montre seulement le service.
  useEffect(() => {
    const fallback = setTimeout(() => setMissing((current) => current ?? []), 4000)
    return () => clearTimeout(fallback)
  }, [])

  const steps: SceneKey[] = ["bienvenue", ...(missing ?? []), ...INTRO]
  const [page, setPage] = useState(0)
  const [forward, setForward] = useState(true)
  const [values, setValues] = useState(isDemo ? { prenom: "", adresse: "", telephone: "" } : { prenom: profile?.prenom ?? "", adresse: profile?.address.adresse ?? "", telephone: "" })
  const [later, setLater] = useState<OnboardingInfo[]>([])
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [keyboard, setKeyboard] = useState(false)
  const [saving, setSaving] = useState(false)

  const key = steps[Math.min(page, steps.length - 1)]
  const isInfo = (INFO as string[]).includes(key)
  const isIntro = (INTRO as string[]).includes(key)
  const last = page === steps.length - 1
  const name = values.prenom.trim()
  const ok =
    key === "telephone" ? isPhoneComplete(values.telephone) : key === "prenom" ? name.length > 1 : key === "adresse" ? values.adresse.trim().length > 1 : key === "bienvenue" ? missing !== null : true

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboard(true))
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  /* ---------- Hauteur de la scene : 414 / 300 pt sur iPhone 16 Pro, plus basse sur SE et avec le clavier ---------- */
  const designHeight = isIntro ? 414 : 300
  const stageHeight =
    isInfo && keyboard ? (compact ? 110 : 150) : Math.round(height * (compact ? (isIntro ? 0.435 : 0.294) : isIntro ? 0.486 : 0.352))
  const stage = useSharedValue(stageHeight)
  useEffect(() => {
    stage.set(reducedMotion ? stageHeight : withTiming(stageHeight, { duration: 420, easing: Easing.out(Easing.cubic) }))
  }, [reducedMotion, stage, stageHeight])
  const stageStyle = useAnimatedStyle(() => ({ height: stage.get() }))

  /* ---------- Produits des scenes ---------- */
  const marketProducts = useMemo<SceneProduct[]>(
    () =>
      pickProducts(products, MARKET_KEYS).map((product) => ({
        name: product.name,
        image: product.image,
        price: `${formatDirhams(product.price)} DH / ${formatPriceUnit(product.unit, locale)}`,
        quantity: "",
      })),
    [locale, products],
  )
  const voiceProducts = useMemo<SceneProduct[]>(
    () =>
      pickProducts(products, [["tomate", "maticha"], ["pomme de terre", "batata"]]).map((product, index) => ({
        name: locale === "ar" && product.nameAr ? product.nameAr : product.name,
        image: product.image,
        price: "",
        quantity: formatQuantity(index === 0 ? 2 : 1, product.unit, locale),
      })),
    [locale, products],
  )

  /* ---------- Navigation ---------- */

  const go = (next: number) => {
    if (next < 0 || next >= steps.length || next === page) return
    Keyboard.dismiss()
    haptics.selection()
    setForward(next > page)
    setPage(next)
  }

  const later_ = () => {
    const info = key as OnboardingInfo
    setLater((current) => (current.includes(info) ? current : [...current, info]))
    setValues((current) => ({ ...current, [info]: "" }))
    go(page + 1)
  }

  const finish = async () => {
    if (saving) return
    setSaving(true)
    Keyboard.dismiss()
    const asked = missing ?? []
    const prenom = asked.includes("prenom") && !later.includes("prenom") ? name : ""
    const telephone = asked.includes("telephone") && !later.includes("telephone") && isPhoneComplete(values.telephone) ? normalizeMoroccanPhone(phoneDigits(values.telephone)) : ""
    const adresse = asked.includes("adresse") && !later.includes("adresse") ? values.adresse.trim() : ""
    let failed = false
    if (isDemo) {
      setSaving(false)
      haptics.success()
      router.dismissTo("/marche")
      return
    }
    try {
      if ((prenom || telephone) && profile) {
        await updateProfile({ prenom: prenom || profile.prenom, nom: profile.nom ?? "", email: profile.email, telephone: telephone || profile.telephone })
      }
      if (adresse) {
        await updateAddress({ adresse, ville: place?.city || "Fès", code_postal: place?.postalCode || "" })
      }
      if (prenom || telephone || adresse) await refresh()
    } catch (caught) {
      failed = true
      Alert.alert(
        t("Informations non enregistrées"),
        `${caught instanceof ApiError ? t(caught.message) : t("Vérifiez votre connexion internet.")} ${t("Vous pourrez les ajouter dans Compte.")}`,
      )
    }
    await markOnboardingSeen()
    if (!failed) haptics.success()
    setSaving(false)
    router.dismissTo("/marche")
  }

  const next = () => (last ? void finish() : go(page + 1))

  /* ---------- Glisser la scene : etape suivante ou precedente ---------- */
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .enabled(key !== "adresse")
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onEnd((event) => {
      if (Math.abs(event.translationX) < 40) return
      const toNext = event.translationX < 0 !== isRtl
      if (toNext && (!ok || last)) return
      go(page + (toNext ? 1 : -1))
    })

  /* ---------- Textes ---------- */
  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? t("Bonjour") : hour >= 12 && hour < 18 ? t("Bon après-midi") : t("Bonsoir")
  const missingCount = missing?.length ?? 0

  const intros: Record<"marche" | "voix" | "confiance", { eyebrow: string; title: string; body: string; facts: Fact[] }> = {
    marche: {
      eyebrow: t("Comment ça marche"),
      title: t("Le marché de Fès, livré chez vous."),
      body: t("Chaque matin, SOUKI achète vos fruits, légumes et herbes au marché de gros. Commandez jusqu'à 1h, recevez le lendemain."),
      facts: [
        { icon: Leaf, label: t("Prix du jour") },
        { icon: Truck, label: t("Livraison 8h–15h") },
      ],
    },
    voix: {
      eyebrow: t("Deux assistants"),
      title: t("Dites votre liste, SOUKI remplit le panier."),
      body: t("Parlez en darija ou en français. Ou donnez un budget, le nombre de personnes ou un plat marocain."),
      facts: [
        { icon: Mic, label: t("Commande vocale") },
        { icon: Sparkles, label: t("Panier intelligent") },
      ],
    },
    confiance: {
      eyebrow: t("Sans surprise"),
      title: t("Vous payez à la livraison."),
      body: t("En espèces ou avec votre Wallet. Un produit abîmé ? Signalez-le sous 24 h : il est remboursé sur votre Wallet."),
      facts: [
        { icon: ShoppingBasket, label: t("Dès 50 DH, livraison comprise") },
        { icon: Truck, label: t("Offerte dès 300 DH") },
      ],
    },
  }
  const infos: Record<OnboardingInfo, { eyebrow: string; title: string; body: string; label: string }> = {
    prenom: { eyebrow: t("Votre compte"), title: t("Comment vous appeler ?"), body: t("Votre prénom s'affiche sur l'accueil et sur votre commande, pour le livreur."), label: t("Prénom") },
    adresse: { eyebrow: t("Livraison"), title: t("Où livrer vos courses ?"), body: t("SOUKI livre à Fès. Placez l'épingle sur votre porte."), label: t("Adresse") },
    telephone: { eyebrow: t("Livraison"), title: t("Un numéro pour le livreur"), body: t("Il vous appelle seulement si besoin, pendant la livraison."), label: t("Téléphone") },
  }

  const arabic = locale === "ar"
  const titleStyle = arabic
    ? { fontSize: compact ? 26 : 30, lineHeight: compact ? 36 : 42, letterSpacing: 0 }
    : isInfo
      ? { fontSize: compact ? 24 : 27, lineHeight: compact ? 29 : 32, letterSpacing: -0.5 }
      : { fontSize: compact ? 26 : 30, lineHeight: compact ? 31 : 35, letterSpacing: -0.6 }
  const bodyStyle = arabic ? { fontSize: 17, lineHeight: 28 } : isInfo || compact ? { fontSize: 15, lineHeight: 22 } : { fontSize: 16, lineHeight: 24 }

  const eyebrow = (label: string) =>
    compact && isInfo ? null : (
      <Text weight="heavy" color={palette.orange700} style={{ fontSize: arabic ? 13 : 11, lineHeight: arabic ? 18 : 14, letterSpacing: arabic ? 0 : 0.9, textTransform: arabic ? "none" : "uppercase" }}>
        {label}
      </Text>
    )

  let body: React.ReactNode
  if (key === "bienvenue") {
    body = (
      <>
        <Text accessibilityRole="header" weight="black" color={palette.ink900} style={titleStyle}>
          {name ? t("Bienvenue, {name} 👋", { name }) : t("Bienvenue chez SOUKI 👋")}
        </Text>
        <Text color={palette.ink700} style={bodyStyle}>
          {missingCount === 0
            ? t("Votre compte est prêt. Trois écrans pour découvrir SOUKI, puis le marché.")
            : missingCount === 1
              ? t("Votre compte est prêt. Pour vous livrer, il nous manque une information : donnez-la maintenant ou plus tard.")
              : t("Votre compte est prêt. Pour vous livrer, il nous manque {n} informations : donnez-les maintenant ou plus tard.", { n: missingCount })}
        </Text>
        <View style={{ gap: 10, marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Languages size={15} color={palette.ink500} strokeWidth={2.2} />
            <Text weight="heavy" color={palette.ink500} style={{ fontSize: 13 }}>
              {t("Langue de l'app")}
            </Text>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t("Langue de l'app")} style={{ flexDirection: "row", gap: 8 }}>
            {(
              [
                ["fr", "Français"],
                ["ar", "العربية"],
              ] as [Locale, string][]
            ).map(([code, label]) => {
              const active = locale === code
              return (
                <Pressable
                  key={code}
                  onPress={() => {
                    if (active) return
                    haptics.selection()
                    setLocale(code)
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLanguage={code}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: compact ? 44 : 50,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    backgroundColor: active ? palette.pale50 : palette.white,
                    boxShadow: active ? `inset 0 0 0 2px ${palette.souki900}` : shadows.card,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Text weight="heavy" color={active ? palette.souki900 : palette.ink900} style={{ fontSize: code === "ar" ? 18 : 16, fontFamily: code === "ar" ? fonts.arabic.heavy : fonts.latin.heavy }}>
                    {label}
                  </Text>
                  {active ? <Check size={14} color={palette.souki900} strokeWidth={3} /> : null}
                </Pressable>
              )
            })}
          </View>
        </View>
      </>
    )
  } else if (isInfo) {
    const info = infos[key as OnboardingInfo]
    const outside = key === "adresse" && place !== null && !place.inZone
    body = (
      <>
        {eyebrow(info.eyebrow)}
        <Text accessibilityRole="header" weight="black" color={palette.ink900} style={titleStyle}>
          {info.title}
        </Text>
        <Text color={palette.ink700} style={bodyStyle}>
          {info.body}
        </Text>
        <View style={{ marginTop: 6 }}>
          {key === "prenom" ? (
            <TextField
              label={info.label}
              icon={User}
              value={values.prenom}
              onChangeText={(text) => setValues((current) => ({ ...current, prenom: text }))}
              autoFocus
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={() => ok && go(page + 1)}
            />
          ) : key === "adresse" ? (
            <TextField
              label={info.label}
              icon={MapPin}
              value={values.adresse}
              onChangeText={(text) => setValues((current) => ({ ...current, adresse: text }))}
              placeholder={t("Rue, quartier, point de repère")}
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              returnKeyType="done"
            />
          ) : (
            <TextField
              label={info.label}
              prefix="+212"
              value={formatPhoneDigits(values.telephone)}
              onChangeText={(text) => setValues((current) => ({ ...current, telephone: phoneDigits(text) }))}
              placeholder="6 12 34 56 78"
              keyboardType="phone-pad"
              autoFocus
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              maxLength={13}
            />
          )}
        </View>
        {key === "adresse" && ok ? (
          outside ? (
            <Note tone="orange">{t("SOUKI livre uniquement à Fès pour l'instant. Choisissez une adresse à Fès.")}</Note>
          ) : (
            <Note icon={Check}>{t("Bonne nouvelle, nous livrons chez vous !")}</Note>
          )
        ) : null}
      </>
    )
  } else {
    const intro = intros[key as "marche" | "voix" | "confiance"]
    body = (
      <>
        {eyebrow(intro.eyebrow)}
        <Text accessibilityRole="header" weight="black" color={palette.ink900} style={titleStyle}>
          {intro.title}
        </Text>
        <Text color={palette.ink700} style={bodyStyle}>
          {intro.body}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {intro.facts.map((fact) => (
            <View key={fact.label} style={{ maxWidth: "100%", minHeight: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: palette.section }}>
              <fact.icon size={15} color={palette.market600} strokeWidth={2.4} />
              <Text weight="heavy" color={palette.souki900} style={{ flexShrink: 1, fontSize: 13 }}>
                {fact.label}
              </Text>
            </View>
          ))}
        </View>
      </>
    )
  }

  const primary = key === "bienvenue" ? t("Commencer") : last ? t("Faire mes courses") : key === "adresse" ? t("Confirmer l'adresse") : t("Continuer")
  const enter = reducedMotion ? FadeIn.duration(200) : slideIn(forward !== isRtl)

  /* ---------- Scene ---------- */
  let scene: React.ReactNode
  if (key === "adresse") {
    scene = (
      <MapPicker
        full
        height={stageHeight}
        onPick={(picked) => {
          setPlace(picked)
          setValues((current) => (current.adresse.trim() ? current : { ...current, adresse: [picked.street, picked.area].filter(Boolean).join(", ") }))
        }}
      />
    )
  } else {
    const content =
      key === "bienvenue" ? (
        <WelcomeScene />
      ) : key === "prenom" ? (
        <NameScene name={name} greeting={`${greeting} 👋`} />
      ) : key === "telephone" ? (
        <PhoneScene phone={formatPhoneDigits(values.telephone)} />
      ) : key === "marche" ? (
        <MarketScene products={marketProducts} />
      ) : key === "voix" ? (
        <AssistantsScene products={voiceProducts} />
      ) : (
        <TrustScene />
      )
    scene = (
      <SceneCanvas width={width} height={stageHeight} designHeight={designHeight}>
        {content}
      </SceneCanvas>
    )
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: palette.cream, direction }}>
      <GestureDetector gesture={swipe}>
        <Animated.View
          accessibilityElementsHidden={key !== "adresse"}
          importantForAccessibility={key === "adresse" ? "auto" : "no-hide-descendants"}
          style={[{ overflow: "hidden", borderBottomLeftRadius: 40, borderBottomRightRadius: 40, borderCurve: "continuous" }, stageStyle]}
        >
          {steps.map((step, index) => {
            const background = BACKGROUNDS[step]
            return (
              <Animated.View
                key={step}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: index === page ? 1 : 0,
                  transitionProperty: "opacity",
                  transitionDuration: reducedMotion ? 0 : 420,
                }}
              >
                <LinearGradient colors={background.colors} locations={background.locations} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }} />
              </Animated.View>
            )
          })}
          <Animated.View key={`${key}-${locale}`} entering={enter} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            {scene}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Logo et « Passer » au-dessus de la scene */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + (compact ? 4 : 8), left: 20, right: 20, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Image source={SPLASH} style={{ width: 34, height: 34 }} contentFit="contain" tintColor={LIGHT_BACKGROUNDS.has(key) ? palette.souki900 : undefined} accessibilityLabel="SOUKI" />
        {isIntro && !last ? (
          <Pressable
            onPress={() => void finish()}
            accessibilityRole="button"
            style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: radius.pill, backgroundColor: key === "confiance" ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.14)", opacity: pressed ? 0.7 : 1 })}
          >
            <Text weight="heavy" color={key === "confiance" ? palette.souki900 : palette.white} style={{ fontSize: 14 }}>
              {t("Passer")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: compact ? 16 : 24, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={`body-${page}-${locale}`} entering={enter} accessibilityLiveRegion="polite" style={{ gap: isInfo ? 8 : compact ? 7 : 10 }}>
          {body}
        </Animated.View>
      </ScrollView>

      <View style={{ alignItems: "center", gap: compact || isInfo ? 8 : 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: keyboard ? 10 : Math.max(insets.bottom, compact ? 10 : 16) + (isInfo ? 0 : 8) }}>
        <OnboardingRoad count={steps.length} page={page} infoStops={steps.map((step) => (INFO as string[]).includes(step))} rtl={isRtl} label={t("Étape {i} sur {n}", { i: page + 1, n: steps.length })} />
        <BrandButton
          label={saving ? t("Enregistrement…") : primary}
          icon={last ? ShoppingBasket : isRtl ? ArrowLeft : ArrowRight}
          iconPosition={last ? "start" : "end"}
          disabled={!ok || saving}
          onPress={next}
        />
        {isInfo ? (
          <Pressable onPress={later_} accessibilityRole="button" hitSlop={4} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
            <Text weight="heavy" color={palette.souki900} style={{ fontSize: 15 }}>
              {t("Plus tard")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  )
}
