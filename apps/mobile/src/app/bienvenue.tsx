import { useEffect, useMemo, useState } from "react"
import { Alert, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, useWindowDimensions, View } from "react-native"
import Animated, { Easing, FadeIn, Keyframe, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { ArrowLeft, ArrowRight, Check, Gift, Languages, Leaf, Lock, MapPin, Mic, ShoppingBasket, Sparkles, Truck, User, type LucideIcon } from "lucide-react-native"
import { formatDirhams, formatPriceUnit, formatQuantity, normalizeMoroccanPhone, passwordIsValid, type Locale } from "@souki/shared"

import { EmailChip } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { Note, OtpInput, PasswordRules, TextField } from "@/components/form-fields"
import { MapPicker, type PickedPlace } from "@/components/map-picker"
import { OnboardingRoad } from "@/components/onboarding-road"
import {
  AssistantsScene,
  CodeScene,
  MarketScene,
  NameScene,
  PasswordScene,
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
import { ApiError, register, resendOtp, updateAddress, updateProfile, verifyOtp } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { MARKET_KEYS, pickProducts } from "@/lib/scene-products"
import { formatPhoneDigits, isPhoneComplete, markOnboardingSeen, missingInfo, phoneDigits, type OnboardingInfo } from "@/lib/onboarding"
import { fonts, palette, radius, shadows } from "@/theme"

const SPLASH = require("../../assets/brand/splash-symbol.png")
const INTRO: SceneKey[] = ["marche", "voix", "confiance"]
const INFO: OnboardingInfo[] = ["prenom", "adresse", "telephone"]
/** Etapes d'un nouveau compte par e-mail : tout est demande ici, puis le compte est cree. */
const SIGNUP_STEPS: SceneKey[] = ["bienvenue", "prenom", "adresse", "telephone", "motdepasse", "code", ...INTRO]
/** Etapes a remplir (arrets en pointilles sur le chemin du « S ») : les champs de la scene se reduisent avec le clavier. */
const FORM_STEPS = new Set<SceneKey>(["prenom", "adresse", "telephone", "motdepasse", "code"])
/** iPhone SE (667 pt de haut) : scene plus basse et textes plus petits (page EcranPetit). */
const COMPACT_HEIGHT = 700
/** « Renvoyer le code » attend 60 s (comme le site). */
const RESEND_SECONDS = 60

/** Fond de chaque etape (sk-ob-bg-*), en fondu de 420 ms d'une etape a l'autre. */
const BACKGROUNDS: Record<SceneKey, { colors: [string, string, ...string[]]; locations?: [number, number, ...number[]] }> = {
  bienvenue: { colors: [palette.yellow400, palette.yellow400] },
  prenom: { colors: [palette.green100, palette.green100] },
  adresse: { colors: ["#EEF1EA", "#EEF1EA"] },
  telephone: { colors: [palette.souki900, palette.souki900] },
  motdepasse: { colors: [palette.pale50, palette.green100] },
  code: { colors: [palette.green100, palette.mint300] },
  marche: { colors: [palette.night950, palette.forest800, palette.market600], locations: [0, 0.55, 1] },
  voix: { colors: [palette.forest700, palette.forest900], locations: [0.1, 0.8] },
  confiance: { colors: [palette.mint300, palette.mint300] },
}
/** Fonds clairs : le logo passe en vert SOUKI. */
const LIGHT_BACKGROUNDS = new Set<SceneKey>(["bienvenue", "prenom", "adresse", "motdepasse", "code", "confiance"])

type Fact = { icon: LucideIcon; label: string }

/** Le texte glisse de 28 pt dans le sens du geste (sens inverse en arabe). */
function slideIn(fromEnd: boolean) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateX: fromEnd ? 28 : -28 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }], easing: Easing.out(Easing.cubic) },
  }).duration(380)
}

/**
 * Onboarding « Bienvenue chez SOUKI » (Onboarding, design system 2027), sur le chemin du « S ».
 *
 * Nouveau compte par e-mail (`?email=` depuis l'entree) : bienvenue + langue, prenom et nom, adresse
 * (carte, zone de Fes : obligatoire, le serveur l'exige pour creer le compte), telephone (« Plus tard »),
 * mot de passe -> le compte est cree (POST /auth/register avec tout) -> code recu par e-mail
 * (valide au 6e chiffre) -> trois ecrans sur le service -> accueil.
 *
 * Compte deja cree ailleurs (Google / Apple, plus tard) : bienvenue, SEULEMENT ce qui manque (chacun
 * avec « Plus tard », enregistre a la fin), puis les trois ecrans.
 * Pas de demande de notifications ici. Glisser la scene change d'etape (sauf sur la carte).
 */
export default function BienvenueScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const compact = height < COMPACT_HEIGHT
  const reducedMotion = useReducedMotion()
  const { t, locale, setLocale, isRtl, direction } = useLocale()
  const { profile, refresh, acceptToken } = useAuth()
  const { products } = useCatalogue()
  const params = useLocalSearchParams<{ email?: string }>()
  // Mode fige a l'ouverture : la session s'ouvre en cours de route (apres le code).
  const [signupEmail] = useState(() => (params.email ?? "").trim().toLowerCase())
  const signup = signupEmail.length > 0

  // Compte existant : ce qui manque, fige au premier profil connu.
  const [missing, setMissing] = useState<OnboardingInfo[] | null>(signup ? [] : profile ? missingInfo(profile) : null)
  useEffect(() => {
    if (missing === null && profile) setMissing(missingInfo(profile))
  }, [missing, profile])
  // Profil introuvable (reseau) : on ne bloque pas, l'onboarding montre seulement le service.
  useEffect(() => {
    const fallback = setTimeout(() => setMissing((current) => current ?? []), 4000)
    return () => clearTimeout(fallback)
  }, [])

  const steps: SceneKey[] = signup ? SIGNUP_STEPS : ["bienvenue", ...(missing ?? []), ...INTRO]
  const [page, setPage] = useState(0)
  const [forward, setForward] = useState(true)
  const [values, setValues] = useState({
    prenom: signup ? "" : (profile?.prenom ?? ""),
    nom: "",
    adresse: signup ? "" : (profile?.address.adresse ?? ""),
    telephone: "",
    password: "",
    referral: "",
    code: "",
  })
  const [later, setLater] = useState<OnboardingInfo[]>([])
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [keyboard, setKeyboard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Compte cree (apres « Créer mon compte ») : identifiant pour le code, et plus de retour en arriere.
  const [account, setAccount] = useState<{ userId: number; channel: string; target: string } | null>(null)
  const [verified, setVerified] = useState(false)
  const [wait, setWait] = useState(RESEND_SECONDS)

  const key = steps[Math.min(page, steps.length - 1)]
  const isInfo = (INFO as string[]).includes(key)
  const isForm = FORM_STEPS.has(key)
  const isIntro = (INTRO as string[]).includes(key)
  const last = page === steps.length - 1
  const name = values.prenom.trim()
  const outside = place !== null && !place.inZone
  const ok =
    key === "telephone"
      ? isPhoneComplete(values.telephone)
      : key === "prenom"
        ? name.length > 1
        : key === "adresse"
          ? values.adresse.trim().length > 1 && (!signup || (place !== null && place.inZone))
          : key === "motdepasse"
            ? passwordIsValid(values.password)
            : key === "code"
              ? values.code.length === 6
              : key === "bienvenue"
                ? missing !== null
                : true
  // « Plus tard » : prenom et telephone ; l'adresse aussi pour un compte existant (le serveur l'exige a la creation).
  const canLater = isInfo && !(signup && key === "adresse")

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboard(true))
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // Compte a rebours de « Renvoyer le code ».
  useEffect(() => {
    if (key !== "code" || verified || wait <= 0) return
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [key, verified, wait])

  /* ---------- Hauteur de la scene : 414 / 300 pt sur iPhone 16 Pro, plus basse sur SE et avec le clavier ---------- */
  const designHeight = isIntro ? 414 : 300
  const stageHeight =
    isForm && keyboard ? (compact ? 110 : 150) : Math.round(height * (compact ? (isIntro ? 0.435 : 0.294) : isIntro ? 0.486 : 0.352))
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

  const codeIndex = steps.indexOf("code")
  const go = (next: number) => {
    if (next < 0 || next >= steps.length || next === page) return
    // Compte cree : on ne revient plus sur le mot de passe ; code valide : plus sur le code.
    if (signup && account && next < codeIndex) return
    if (signup && verified && next <= codeIndex) return
    Keyboard.dismiss()
    haptics.selection()
    setFormError(null)
    setForward(next > page)
    setPage(next)
  }

  const later_ = () => {
    const info = key as OnboardingInfo
    setLater((current) => (current.includes(info) ? current : [...current, info]))
    setValues((current) => ({ ...current, [info]: "" }))
    go(page + 1)
  }

  /** Nouveau compte : tout ce qui a ete donne part avec la creation (le serveur exige la position). */
  const createAccount = async () => {
    if (saving || !place) return
    setSaving(true)
    setFormError(null)
    Keyboard.dismiss()
    try {
      const result = await register({
        email: signupEmail,
        password: values.password,
        role: "CLIENT",
        prenom: later.includes("prenom") ? undefined : name || undefined,
        nom: values.nom.trim() || undefined,
        phone: !later.includes("telephone") && isPhoneComplete(values.telephone) ? normalizeMoroccanPhone(phoneDigits(values.telephone)) : undefined,
        code_parrainage: values.referral.trim().toUpperCase() || undefined,
        latitude: place.coordinates.latitude,
        longitude: place.coordinates.longitude,
        adresse: values.adresse.trim().slice(0, 200) || undefined,
        ville: (place.city || "Fès").slice(0, 100),
      })
      setAccount({ userId: result.id, channel: result.verification_channel ?? "email", target: result.verification_target ?? signupEmail })
      setWait(RESEND_SECONDS)
      haptics.success()
      setForward(true)
      setPage(codeIndex)
    } catch (caught) {
      haptics.error()
      if (caught instanceof ApiError) setFormError(t(caught.message))
      else Alert.alert(t("Pas de connexion internet"), t("Vérifiez votre connexion internet."))
    } finally {
      setSaving(false)
    }
  }

  /** Code recu par e-mail : valide au 6e chiffre, ouvre la session, puis les trois ecrans. */
  const checkCode = async (code: string) => {
    if (!account || saving || verified) return
    setSaving(true)
    setFormError(null)
    try {
      const result = await verifyOtp(account.userId, code, account.channel)
      if (result.access_token) await acceptToken(result.access_token)
      setVerified(true)
      haptics.success()
      setTimeout(() => {
        setForward(true)
        setPage(codeIndex + 1)
      }, 600)
    } catch (caught) {
      haptics.error()
      setFormError(caught instanceof ApiError && caught.status !== 400 ? t(caught.message) : t("Code incorrect. Vérifiez-le ou demandez-en un nouveau."))
    } finally {
      setSaving(false)
    }
  }

  const resend = async () => {
    if (!account) return
    try {
      const result = await resendOtp(account.userId, account.channel)
      setWait(result.resend_available_in_seconds ?? RESEND_SECONDS)
      setValues((current) => ({ ...current, code: "" }))
      setFormError(null)
    } catch (caught) {
      setFormError(caught instanceof ApiError ? t(caught.message) : t("Impossible d'envoyer un nouveau code pour le moment."))
    }
  }

  const finish = async () => {
    if (saving) return
    // Nouveau compte : rien a enregistrer, tout est parti avec la creation. Pas encore valide : pas d'accueil.
    if (signup && !verified) return
    setSaving(true)
    Keyboard.dismiss()
    let failed = false
    if (signup) {
      await markOnboardingSeen()
      setSaving(false)
      haptics.success()
      router.dismissTo("/marche")
      return
    }
    const asked = missing ?? []
    const prenom = asked.includes("prenom") && !later.includes("prenom") ? name : ""
    const telephone = asked.includes("telephone") && !later.includes("telephone") && isPhoneComplete(values.telephone) ? normalizeMoroccanPhone(phoneDigits(values.telephone)) : ""
    const adresse = asked.includes("adresse") && !later.includes("adresse") ? values.adresse.trim() : ""
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

  const next = () => {
    if (key === "motdepasse") return void createAccount()
    if (key === "code") return void checkCode(values.code)
    if (last) return void finish()
    go(page + 1)
  }

  /* ---------- Glisser la scene : etape suivante ou precedente ---------- */
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .enabled(key !== "adresse")
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onEnd((event) => {
      if (Math.abs(event.translationX) < 40) return
      const toNext = event.translationX < 0 !== isRtl
      // Creer le compte et valider le code se font seulement avec le bouton.
      if (toNext && (!ok || last || key === "motdepasse" || key === "code")) return
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
    : isForm
      ? { fontSize: compact ? 24 : 27, lineHeight: compact ? 29 : 32, letterSpacing: -0.5 }
      : { fontSize: compact ? 26 : 30, lineHeight: compact ? 31 : 35, letterSpacing: -0.6 }
  const bodyStyle = arabic ? { fontSize: 17, lineHeight: 28 } : isForm || compact ? { fontSize: 15, lineHeight: 22 } : { fontSize: 16, lineHeight: 24 }

  const eyebrow = (label: string) =>
    compact && isForm ? null : (
      <Text weight="heavy" color={palette.orange700} style={{ fontSize: arabic ? 13 : 11, lineHeight: arabic ? 18 : 14, letterSpacing: arabic ? 0 : 0.9, textTransform: arabic ? "none" : "uppercase" }}>
        {label}
      </Text>
    )
  const heading = (title: string, text: React.ReactNode) => (
    <>
      <Text accessibilityRole="header" weight="black" color={palette.ink900} style={titleStyle}>
        {title}
      </Text>
      <Text color={palette.ink700} style={bodyStyle}>
        {text}
      </Text>
    </>
  )

  let body: React.ReactNode
  if (key === "bienvenue") {
    body = (
      <>
        {heading(
          name ? t("Bienvenue, {name} 👋", { name }) : t("Bienvenue chez SOUKI 👋"),
          signup
            ? t("Créons votre compte : votre nom, votre adresse de livraison, puis un mot de passe.")
            : missingCount === 0
              ? t("Votre compte est prêt. Trois écrans pour découvrir SOUKI, puis le marché.")
              : missingCount === 1
                ? t("Votre compte est prêt. Pour vous livrer, il nous manque une information : donnez-la maintenant ou plus tard.")
                : t("Votre compte est prêt. Pour vous livrer, il nous manque {n} informations : donnez-les maintenant ou plus tard.", { n: missingCount }),
        )}
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
    body = (
      <>
        {eyebrow(info.eyebrow)}
        {heading(info.title, info.body)}
        <View style={{ marginTop: 6, gap: 10 }}>
          {key === "prenom" ? (
            <>
              <TextField
                label={info.label}
                icon={User}
                value={values.prenom}
                onChangeText={(text) => setValues((current) => ({ ...current, prenom: text }))}
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
              />
              {signup ? (
                <TextField
                  label={t("Nom")}
                  optional={t("(optionnel)")}
                  value={values.nom}
                  onChangeText={(text) => setValues((current) => ({ ...current, nom: text }))}
                  autoComplete="family-name"
                  textContentType="familyName"
                  returnKeyType="done"
                  onSubmitEditing={() => ok && go(page + 1)}
                />
              ) : null}
            </>
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
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              maxLength={13}
            />
          )}
        </View>
        {key === "adresse" ? (
          outside ? (
            <Note tone="orange">{t("SOUKI livre uniquement à Fès pour l'instant. Choisissez une adresse à Fès.")}</Note>
          ) : ok ? (
            <Note icon={Check}>{t("Bonne nouvelle, nous livrons chez vous !")}</Note>
          ) : null
        ) : null}
      </>
    )
  } else if (key === "motdepasse") {
    body = (
      <>
        {eyebrow(t("Votre compte"))}
        {heading(t("Choisissez un mot de passe"), t("Il protège votre compte SOUKI."))}
        <View style={{ marginTop: 6, gap: 10 }}>
          <EmailChip value={signupEmail} onEdit={() => router.back()} />
          <TextField
            label={t("Mot de passe")}
            icon={Lock}
            secure
            value={values.password}
            onChangeText={(text) => {
              setValues((current) => ({ ...current, password: text }))
              setFormError(null)
            }}
            textContentType="newPassword"
            autoComplete="new-password"
            passwordRules="minlength: 8; required: upper; required: digit;"
            returnKeyType="done"
          />
          <PasswordRules value={values.password} />
          {referralOpen ? (
            <TextField
              label={t("Code de parrainage")}
              optional={t("(optionnel)")}
              icon={Gift}
              value={values.referral}
              onChangeText={(text) => setValues((current) => ({ ...current, referral: text }))}
              placeholder={t("Ex : K7M2P9")}
              autoCapitalize="characters"
              autoCorrect={false}
              help={t("Vous recevrez 15 DH sur votre Wallet SOUKI à votre 1re commande livrée.")}
            />
          ) : (
            <Pressable onPress={() => setReferralOpen(true)} accessibilityRole="button" hitSlop={4} style={({ pressed }) => ({ alignSelf: "flex-start", minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
              <Text weight="heavy" color={palette.market700} style={{ fontSize: 14 }}>
                {t("J'ai un code de parrainage")}
              </Text>
            </Pressable>
          )}
          {formError ? <Note tone="red">{formError}</Note> : null}
        </View>
      </>
    )
  } else if (key === "code") {
    const minutes = Math.floor(wait / 60)
    const seconds = String(wait % 60).padStart(2, "0")
    body = (
      <>
        {eyebrow(t("Votre compte"))}
        {heading(
          t("Vérifiez votre e-mail"),
          <>
            {t("Saisissez le code à 6 chiffres envoyé à ")}
            <Text weight="bold" color={palette.ink900} style={bodyStyle}>
              {account?.target ?? signupEmail}
            </Text>
            .
          </>,
        )}
        <View style={{ marginTop: 6, gap: 10 }}>
          <OtpInput
            value={values.code}
            onChange={(code) => {
              setValues((current) => ({ ...current, code }))
              setFormError(null)
            }}
            onComplete={(code) => void checkCode(code)}
            error={Boolean(formError)}
            done={verified}
          />
          {verified ? (
            <Note icon={Check}>{t("Compte créé. Quelques réglages et c'est parti.")}</Note>
          ) : formError ? (
            <Note tone="red">{formError}</Note>
          ) : null}
          {verified ? null : wait > 0 ? (
            <Text weight="heavy" numeric color={palette.ink500} align="center" style={{ fontSize: 14, minHeight: 44, lineHeight: 44 }}>
              {t("Renvoyer le code dans {temps}", { temps: `${minutes}:${seconds}` })}
            </Text>
          ) : (
            <Pressable onPress={() => void resend()} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: "center", minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
              <Text weight="heavy" color={palette.market700} style={{ fontSize: 14 }}>
                {t("Renvoyer le code")}
              </Text>
            </Pressable>
          )}
        </View>
      </>
    )
  } else {
    const intro = intros[key as "marche" | "voix" | "confiance"]
    body = (
      <>
        {eyebrow(intro.eyebrow)}
        {heading(intro.title, intro.body)}
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

  const primary =
    key === "bienvenue"
      ? t("Commencer")
      : key === "motdepasse"
        ? saving
          ? t("Création…")
          : t("Créer mon compte")
        : key === "code"
          ? saving
            ? t("Vérification…")
            : t("Valider")
          : last
            ? saving
              ? t("Enregistrement…")
              : t("Faire mes courses")
            : key === "adresse"
              ? t("Confirmer l'adresse")
              : t("Continuer")
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
      ) : key === "motdepasse" ? (
        <PasswordScene email={signupEmail} length={values.password.length} />
      ) : key === "code" ? (
        <CodeScene code={values.code} />
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
        <Animated.View key={`body-${page}-${locale}`} entering={enter} accessibilityLiveRegion="polite" style={{ gap: isForm ? 8 : compact ? 7 : 10 }}>
          {body}
        </Animated.View>
      </ScrollView>

      <View style={{ alignItems: "center", gap: compact || isForm ? 8 : 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: keyboard ? 10 : Math.max(insets.bottom, compact ? 10 : 16) + (isForm ? 0 : 8) }}>
        <OnboardingRoad count={steps.length} page={page} infoStops={steps.map((step) => FORM_STEPS.has(step))} rtl={isRtl} label={t("Étape {i} sur {n}", { i: page + 1, n: steps.length })} />
        <BrandButton
          label={primary}
          icon={last ? ShoppingBasket : key === "motdepasse" ? Check : isRtl ? ArrowLeft : ArrowRight}
          iconPosition={last || key === "motdepasse" ? "start" : "end"}
          disabled={!ok || saving || (key === "code" && verified)}
          onPress={next}
        />
        {canLater ? (
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
