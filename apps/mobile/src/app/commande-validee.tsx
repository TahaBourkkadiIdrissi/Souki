import { View } from "react-native"
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Banknote, Check, Receipt, Truck, Wallet } from "lucide-react-native"
import { formatDeliveryDate, formatDirhams } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Celebration, CheckoutLine } from "@/components/checkout-parts"
import { SMotif } from "@/components/s-motif"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette, radius } from "@/theme"

const MASCOT = require("../../assets/illustrations/recolte-fermier.svg")

/** L'anneau apparait en ressort (sk-pop, 500 ms). */
const POP = {
  from: { opacity: 0, transform: [{ scale: 0.85 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
} as const
/** Ressort du design system : cubic-bezier(0.34, 1.56, 0.64, 1). Reanimated refuse la chaine CSS. */
const POP_EASING = cubicBezier(0.34, 1.56, 0.64, 1)
const FLOAT = {
  "0%": { transform: [{ translateY: 0 }] },
  "50%": { transform: [{ translateY: -5 }] },
  "100%": { transform: [{ translateY: 0 }] },
} as const

type Params = { id?: string; date?: string; heure?: string; count?: string; due?: string; wallet?: string; mode?: string }

/**
 * Commande validee (EcranConfirmation, design system 2027) : plein ecran vert, Souki dans un
 * anneau qui apparait en ressort avec une coche feuille, pluie de feuilles une seule fois,
 * numero, date et heure, montant a payer, rappel « modifiable ou annulable jusqu'à 01h00 ».
 * Les montants sont ceux renvoyes par le serveur (POST /api/checkout).
 */
export default function CommandeValideeScreen() {
  const router = useRouter()
  const { t, dateLocale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const params = useLocalSearchParams<Params>()

  const count = Number(params.count) || 0
  const due = Number(params.due) || 0
  const walletUsed = Number(params.wallet) || 0
  const paidByWallet = params.mode === "wallet"
  const date = formatDeliveryDate(params.date || null, dateLocale)
  const when = date
    ? `${date.charAt(0).toUpperCase()}${date.slice(1)}, ${t("vers {heure}", { heure: params.heure ?? "" })}`
    : t("Vers {heure}", { heure: params.heure ?? "" })

  const paymentTitle = paidByWallet ? t("Payé par votre Wallet") : t("{montant} DH à payer à la livraison", { montant: formatDirhams(due) })
  const paymentDetail = !paidByWallet && walletUsed > 0
    ? t("Crédit Wallet de {montant} DH déduit · modifiable ou annulable jusqu'à 01h00", { montant: formatDirhams(walletUsed) })
    : t("Modifiable ou annulable jusqu'à 01h00")

  return (
    <View style={{ flex: 1, direction, backgroundColor: palette.night950 }}>
      <LinearGradient
        colors={[palette.night950, palette.forest800, palette.market600]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1.15 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SMotif size={420} opacity={0.08} style={{ top: 40, end: -120 }} />
      <Celebration count={26} />

      <View style={{ flex: 1, alignItems: "center", paddingTop: insets.top + 56, paddingHorizontal: 22, zIndex: 2 }}>
        <Animated.View
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
            ...(reducedMotion ? null : { animationName: POP, animationDuration: "500ms", animationTimingFunction: POP_EASING, animationFillMode: "both" }),
          }}
        >
          <Animated.View style={reducedMotion ? undefined : { animationName: FLOAT, animationDuration: "3200ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }}>
            <Image source={MASCOT} style={{ width: 112, height: 126, marginTop: 10 }} contentFit="contain" accessibilityLabel={t("Souki, la mascotte SOUKI")} />
          </Animated.View>
          <View style={{ position: "absolute", bottom: 4, end: 4, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: palette.leaf500, borderWidth: 4, borderColor: palette.forest800 }}>
            <Check size={18} color={palette.white} strokeWidth={3.2} />
          </View>
        </Animated.View>

        <Text accessibilityRole="header" variant="title1" weight="black" color={palette.white} align="center" style={{ marginTop: 20, fontSize: 32, lineHeight: 38, letterSpacing: -1 }}>
          {t("Commande validée !")}
        </Text>
        <Text variant="body" weight="medium" color={palette.mint300} align="center" style={{ marginTop: 8, fontSize: 15, lineHeight: 21 }}>
          {t("Souki s'occupe du marché demain matin.")}
        </Text>

        <View
          style={{
            alignSelf: "stretch",
            marginTop: 24,
            padding: 16,
            gap: 12,
            borderRadius: radius.card,
            borderCurve: "continuous",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.18)",
          }}
        >
          <CheckoutLine
            dark
            icon={Receipt}
            title={t("Commande n° {id}", { id: params.id ?? "" })}
            detail={t(count === 1 ? "{n} produit · prix du jour" : "{n} produits · prix du jour", { n: count })}
          />
          <CheckoutLine dark icon={Truck} title={when} detail={t("SOUKI vous appelle la veille pour confirmer")} />
          <CheckoutLine dark icon={paidByWallet ? Wallet : Banknote} title={paymentTitle} detail={paymentDetail} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 6, zIndex: 3 }}>
        <BrandButton tone="light" icon={Truck} label={t("Suivre ma commande")} onPress={() => {
            router.dismissTo("/commandes")
            if (params.id) router.push(`/suivi/${params.id}`)
          }}
        />
        <BrandButton tone="ghostLight" label={t("Continuer mes courses")} onPress={() => router.dismissTo("/marche")} />
      </View>
    </View>
  )
}
