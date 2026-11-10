import { useCallback, useMemo } from "react"
import { Alert, Linking, Pressable, useWindowDimensions, View } from "react-native"
import Animated, { Easing, FadeIn, Keyframe, useReducedMotion } from "react-native-reanimated"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useFocusEffect, useRouter } from "expo-router"
import { setStatusBarStyle } from "expo-status-bar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Mail, X } from "lucide-react-native"

import { BrandButton } from "@/components/brand-button"
import { ProductImage } from "@/components/product-image"
import { SMotif } from "@/components/s-motif"
import { SocialButton } from "@/components/social-buttons"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useCloseAuth } from "@/hooks/use-close-auth"
import { SITE_URL } from "@/lib/config"
import { MARKET_KEYS, pickProducts } from "@/lib/scene-products"
import { palette, radius } from "@/theme"

const BAG = require("../../../assets/brand/splash-symbol.png")
/** iPhone SE (667 pt de haut) : sac plus petit, deux assiettes seulement (page EcranEntree). */
const COMPACT_HEIGHT = 700

const FLOAT = { "0%": { transform: [{ translateY: 0 }] }, "50%": { transform: [{ translateY: -5 }] }, "100%": { transform: [{ translateY: 0 }] } } as const

function pop(delay: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.86 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.back(1.4)) },
  })
    .duration(520)
    .delay(delay)
}

/** Assiettes de l'etal (sk-au-pl0..3) : positions du design, sous la barre d'etat. */
const PLATES = [
  { start: 26, top: 74, size: 70, delay: 80, float: 0 },
  { end: 34, top: 58, size: 70, delay: 150, float: 1600 },
  { start: 70, top: 176, size: 56, delay: 220, float: 800 },
  { end: 72, top: 164, size: 56, delay: 290, float: 2400 },
]

/**
 * Entree de l'app (AuthFlow / EcranEntree, design 2027) : un seul ecran pour se connecter ou creer
 * un compte. En haut, la scene du marche ; en bas, Apple (noir, en premier : exige par l'App Store
 * des que Google est propose), Google, puis l'e-mail. SOUKI reconnait le compte : existant -> accueil,
 * nouveau -> code -> onboarding. Ouvert en modal quand un compte est necessaire ; la croix ramene
 * la ou l'on etait. Apple et Google ne sont pas encore branches (B1, B2) : ils le disent.
 */
export default function EntreeScreen() {
  const router = useRouter()
  const closeAuth = useCloseAuth()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const compact = height < COMPACT_HEIGHT
  const reducedMotion = useReducedMotion()
  const { t, locale, direction } = useLocale()
  const { products } = useCatalogue()
  const plates = useMemo(() => pickProducts(products, MARKET_KEYS), [products])

  // Texte de la barre d'etat en blanc sur le vert de la scene.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light")
      return () => setStatusBarStyle("dark")
    }, []),
  )

  const comingSoon = (provider: "Apple" | "Google") =>
    Alert.alert(t("Bientôt disponible"), t("La connexion avec {provider} arrive avec la prochaine version de l'app. Continuez avec votre e-mail.", { provider }), [
      { text: t("Annuler"), style: "cancel" },
      { text: t("Continuer avec l'e-mail"), isPreferred: true, onPress: () => router.push("/email") },
    ])

  const arabic = locale === "ar"
  const visiblePlates = compact ? PLATES.slice(0, 2) : PLATES

  return (
    <View style={{ flex: 1, backgroundColor: palette.cream, direction }}>
      {/* Scene du marche */}
      <View style={{ flex: 1, minHeight: 0, overflow: "hidden", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 28, paddingBottom: compact ? 46 : 54, gap: 6 }}>
        <LinearGradient colors={[palette.night950, palette.forest800, palette.market600]} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", end: -60, top: 40 }}>
          <SMotif size={200} opacity={0.08} />
        </View>
        {visiblePlates.map((plate, index) => {
          const product = plates[index]
          if (!product) return null
          return (
            <Animated.View
              key={product.id}
              entering={reducedMotion ? FadeIn.duration(200) : pop(plate.delay)}
              pointerEvents="none"
              style={{ position: "absolute", top: insets.top + (compact ? 16 : plate.top), start: plate.start, end: plate.end }}
            >
              <Animated.View
                style={[
                  { width: plate.size, height: plate.size, borderRadius: plate.size / 2, overflow: "hidden", backgroundColor: palette.cream, boxShadow: "0 14px 26px -14px rgba(0, 0, 0, 0.6)" },
                  reducedMotion ? null : { animationName: FLOAT, animationDuration: "3200ms", animationDelay: `${plate.float}ms`, animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" },
                ]}
              >
                <ProductImage uri={product.image} variant="inset" style={{ width: plate.size, height: plate.size }} />
              </Animated.View>
            </Animated.View>
          )
        })}
        <Animated.View entering={reducedMotion ? FadeIn.duration(200) : pop(0)} style={{ marginBottom: 8 }}>
          <Image source={BAG} style={{ width: compact ? 70 : 92, height: compact ? 70 : 92 }} contentFit="contain" accessibilityLabel="SOUKI" />
        </Animated.View>
        <Text accessibilityRole="header" weight="black" color={palette.white} align="center" style={{ maxWidth: 300, fontSize: compact ? 24 : 28, lineHeight: arabic ? (compact ? 36 : 42) : compact ? 28 : 33, letterSpacing: arabic ? 0 : -0.5 }}>
          {t("Le marché de Fès, livré demain.")}
        </Text>
        {/* Fermer : retour la ou l'on etait (on peut parcourir le marche sans compte). */}
        <Pressable
          onPress={closeAuth}
          accessibilityRole="button"
          accessibilityLabel={t("Fermer")}
          style={({ pressed }) => ({
            position: "absolute",
            top: insets.top + (compact ? 4 : 8),
            start: 16,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.glassOnDark,
            borderWidth: 1,
            borderColor: palette.glassStroke,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <X size={20} color={palette.white} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Feuille creme : les trois facons d'entrer */}
      <View
        style={{
          marginTop: -32,
          paddingTop: compact ? 22 : 26,
          paddingHorizontal: compact ? 16 : 20,
          paddingBottom: Math.max(insets.bottom, compact ? 12 : 16) + (compact ? 4 : 10),
          gap: 10,
          borderTopLeftRadius: radius.hero,
          borderTopRightRadius: radius.hero,
          borderCurve: "continuous",
          backgroundColor: palette.cream,
        }}
      >
        <Text weight="black" color={palette.ink900} align="center" style={{ fontSize: arabic ? 22 : 19, lineHeight: arabic ? 32 : 24, letterSpacing: arabic ? 0 : -0.2, marginBottom: 4 }}>
          {t("Connectez-vous ou créez un compte")}
        </Text>
        <SocialButton provider="apple" compact={compact} label={t("Continuer avec Apple")} onPress={() => comingSoon("Apple")} />
        <SocialButton provider="google" compact={compact} label={t("Continuer avec Google")} onPress={() => comingSoon("Google")} />
        <BrandButton tone="soft" icon={Mail} label={t("Continuer avec l'e-mail")} onPress={() => router.push("/email")} />
        <Text color={palette.ink500} align="center" style={{ marginTop: 2, fontSize: 12, lineHeight: 17 }}>
          {t("En continuant, vous acceptez la ")}
          <Text
            weight="bold"
            color={palette.ink700}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`${SITE_URL}/politique-confidentialite`)}
            style={{ fontSize: 12, textDecorationLine: "underline" }}
          >
            {t("Politique de confidentialité")}
          </Text>
          .
        </Text>
      </View>
    </View>
  )
}
