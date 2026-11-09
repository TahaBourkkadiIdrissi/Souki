import { useCallback, useState } from "react"
import { KeyboardAvoidingView, Pressable, ScrollView, Switch, View } from "react-native"
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useFocusEffect, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Leaf, Lock, User, X } from "lucide-react-native"
import { setStatusBarStyle } from "expo-status-bar"
import { isValidEmail } from "@souki/shared"

import { TextLink } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { TextField } from "@/components/form-fields"
import { SMotif } from "@/components/s-motif"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useCloseAuth } from "@/hooks/use-close-auth"
import { ApiError } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { DUR_SLOW, EASE_OUT_2027 } from "@/lib/motion"
import { colors, gradients, palette, radius } from "@/theme"

const MASCOT = require("../../../assets/illustrations/recolte-fermier.svg")

/**
 * Connexion (EcranConnexion, design system 2027), plein ecran modal : en-tete vert avec Souki,
 * « Email ou Téléphone » et mot de passe, « Se souvenir de moi », « Mot de passe oublié ? »,
 * puis « S'inscrire ». Meme route et memes messages que le site (POST /auth/login).
 * Sign in with Apple et Google viendront avec leurs SDK et les routes back-end (B1, B2).
 */
export default function ConnexionScreen() {
  const router = useRouter()
  const closeAuth = useCloseAuth()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const { signIn } = useAuth()
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<{ field: "login" | "password"; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const id = loginId.trim()
    setError(null)
    if (!id) return setError({ field: "login", message: t("Saisissez votre e-mail ou votre téléphone.") })
    // Comme le site : le format d'e-mail n'est verifie que si l'identifiant contient « @ ».
    if (id.includes("@") && !isValidEmail(id)) {
      return setError({ field: "login", message: t("Format d'email invalide. Veuillez saisir une adresse email correcte (ex: nom@domaine.ma).") })
    }
    if (!password) return setError({ field: "password", message: t("Saisissez votre mot de passe.") })
    setLoading(true)
    try {
      await signIn(id, password, remember)
      haptics.success()
      closeAuth()
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.status === 401
            ? t("E-mail, téléphone ou mot de passe incorrect.")
            : t(caught.message)
          : t("Connexion impossible. Vérifiez votre connexion internet.")
      setError({ field: "password", message })
    } finally {
      setLoading(false)
    }
  }

  // Heure et batterie en blanc sur l'en-tete vert, tant que l'ecran est au premier plan
  // (Mot de passe oublie et Inscription, ouverts par-dessus, ont un en-tete clair).
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light")
      return () => setStatusBarStyle("dark")
    }, []),
  )

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* En-tete vert : Souki accueille */}
        <View style={{ borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero, overflow: "hidden" }}>
          <LinearGradient colors={gradients.clock.open} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1.3 }} style={{ paddingTop: insets.top + 34, paddingBottom: 28, paddingHorizontal: 20, alignItems: "center", gap: 6 }}>
            <SMotif size={300} opacity={0.09} style={{ end: -70, bottom: -40 }} />
            <Pressable
              onPress={closeAuth}
              accessibilityRole="button"
              accessibilityLabel={t("Fermer")}
              style={{
                position: "absolute",
                top: insets.top + 8,
                start: 16,
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.glassOnDark,
                borderWidth: 1,
                borderColor: palette.glassStroke,
              }}
            >
              <X size={20} color={palette.white} strokeWidth={2.4} />
            </Pressable>
            <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: "rgba(255, 255, 255, 0.12)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.28)", alignItems: "center", justifyContent: "center" }}>
              <Image source={MASCOT} style={{ width: 70, height: 80, marginTop: 6 }} contentFit="contain" accessibilityLabel={t("Souki, la mascotte SOUKI")} />
              <View style={{ position: "absolute", bottom: 2, end: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: palette.leaf500, borderWidth: 3, borderColor: palette.night950, alignItems: "center", justifyContent: "center" }}>
                <Leaf size={12} color={palette.white} strokeWidth={2.4} />
              </View>
            </View>
            <Text accessibilityRole="header" variant="title1" weight="black" color={palette.white} align="center" style={{ marginTop: 10, fontSize: 28, lineHeight: 32 }}>
              {t("Bienvenue chez SOUKI")}
            </Text>
            <Text variant="callout" weight="medium" color={palette.mint300} align="center" style={{ maxWidth: 280, fontSize: 14 }}>
              {t("Connectez-vous pour commander, suivre vos livraisons et utiliser votre Wallet.")}
            </Text>
          </LinearGradient>
        </View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(DUR_SLOW).easing(EASE_OUT_2027)} style={{ marginTop: 22, paddingHorizontal: 20, gap: 14 }}>
          <TextField
            label={t("Email ou Téléphone")}
            icon={User}
            value={loginId}
            onChangeText={setLoginId}
            placeholder={t("nom@exemple.ma ou 06…")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            returnKeyType="next"
            error={error?.field === "login" ? error.message : null}
          />
          <TextField
            label={t("Mot de passe")}
            icon={Lock}
            secure
            value={password}
            onChangeText={setPassword}
            placeholder={t("Votre mot de passe")}
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            error={error?.field === "password" ? error.message : null}
          />
          {/* Une seule ligne comme le prototype : interrupteur et « Se souvenir de moi » a gauche,
              « Mot de passe oublié ? » a droite. Le lien garde sa place ; si la ligne manque de
              largeur (texte agrandi, arabe, petit iPhone), « Se souvenir de moi » passe sur deux lignes. */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
              <Switch
                value={remember}
                onValueChange={(next) => {
                  haptics.selection()
                  setRemember(next)
                }}
                trackColor={{ true: palette.market600, false: palette.line }}
                accessibilityLabel={t("Se souvenir de moi")}
              />
              <Text variant="footnote" weight="semibold" color={palette.ink900} style={{ flexShrink: 1, fontSize: 14 }}>
                {t("Se souvenir de moi")}
              </Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              <TextLink label={t("Mot de passe oublié ?")} onPress={() => router.push("/mot-de-passe-oublie")} />
            </View>
          </View>
          <BrandButton label={loading ? t("Connexion…") : t("Se connecter")} disabled={loading} onPress={() => void submit()} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Text variant="callout" weight="medium" color={palette.ink500} style={{ fontSize: 14 }}>
              {t("Pas encore de compte ?")}
            </Text>
            <TextLink label={t("S'inscrire")} onPress={() => router.push("/inscription")} />
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
