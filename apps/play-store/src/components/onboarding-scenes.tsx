import type { ReactNode } from "react"
import { View, type ViewStyle } from "react-native"
import Animated, { Easing, Keyframe, useReducedMotion, FadeIn } from "react-native-reanimated"
import { Image } from "expo-image"
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg"
import { LinearGradient } from "expo-linear-gradient"
import { Banknote, Clock, Leaf, Lock, Mail, Phone, Receipt, ShieldCheck, ShoppingBasket, Sparkles, Truck, Wallet } from "lucide-react-native"

import { VoiceOrb } from "@/components/assistant-cards"
import { LiveDot } from "@/components/home-hero"
import { ProductImage } from "@/components/product-image"
import { SMotif } from "@/components/s-motif"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette, shadows, scene } from "@/theme"

const MASCOT = require("../../assets/illustrations/recolte-fermier.svg")

/** Largeur du canevas du design (iPhone 16 Pro) : chaque scene est dessinee dessus puis mise a l'echelle. */
export const SCENE_WIDTH = 393

const FLOAT = { "0%": { transform: [{ translateY: 0 }] }, "50%": { transform: [{ translateY: -5 }] }, "100%": { transform: [{ translateY: 0 }] } } as const
const WAVE_HAND = {
  "0%": { transform: [{ rotate: "0deg" }] },
  "15%": { transform: [{ rotate: "-6deg" }] },
  "30%": { transform: [{ rotate: "5deg" }] },
  "45%": { transform: [{ rotate: "-3deg" }] },
  "60%": { transform: [{ rotate: "0deg" }] },
  "100%": { transform: [{ rotate: "0deg" }] },
} as const

/** Entree d'un element de scene (sk-ob-pop) : monte de 18 pt et grandit, en cascade de 70 ms. */
function pop(index: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.86 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.back(1.4)) },
  })
    .duration(460)
    .delay(120 + index * 70)
}

/** Element pose a une position du canevas, qui entre en cascade. */
function Piece({ index, style, children }: { index: number; style: ViewStyle; children: ReactNode }) {
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View entering={reducedMotion ? FadeIn.duration(200) : pop(index)} style={[{ position: "absolute" }, style]}>
      {children}
    </Animated.View>
  )
}

function Floating({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View style={reducedMotion ? undefined : { animationName: FLOAT, animationDuration: "3200ms", animationDelay: `${delay}ms`, animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }}>
      {children}
    </Animated.View>
  )
}

export type SceneProduct = { name: string; image: string; price: string; quantity: string }

export type SceneKey = "bienvenue" | "prenom" | "adresse" | "telephone" | "motdepasse" | "code" | "marche" | "voix" | "confiance"

/**
 * Canevas de 393 pt de large, mis a l'echelle de la scene (iPhone SE compris) : les positions
 * du design restent justes et rien ne deborde du cadre.
 */
export function SceneCanvas({ width, height, designHeight, children }: { width: number; height: number; designHeight: number; children: ReactNode }) {
  const scale = Math.min(width / SCENE_WIDTH, height / designHeight)
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height, overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          width: SCENE_WIDTH,
          height: designHeight,
          left: (width - SCENE_WIDTH) / 2,
          top: (height - designHeight) / 2,
          transform: [{ scale }],
        }}
      >
        {children}
      </View>
    </View>
  )
}

/* ---------- 1. Bienvenue : Recolte salue, feuilles autour ---------- */

const LEAVES: { left?: number; right?: number; top: number; rotate?: string }[] = [
  { left: 54, top: 110 },
  { right: 58, top: 104, rotate: "60deg" },
  { left: 86, top: 220 },
  { right: 80, top: 228 },
  { left: 30, top: 168 },
  { right: 30, top: 170 },
]

export function WelcomeScene() {
  const reducedMotion = useReducedMotion()
  return (
    <>
      {LEAVES.map((leaf, index) => (
        <Piece key={index} index={index} style={{ left: leaf.left, right: leaf.right, top: leaf.top, opacity: 0.55, transform: leaf.rotate ? [{ rotate: leaf.rotate }] : undefined }}>
          <Floating delay={index * 300}>
            <Leaf size={18} color={scene.souki900} strokeWidth={2.4} />
          </Floating>
        </Piece>
      ))}
      <Piece index={0} style={{ left: SCENE_WIDTH / 2 - 88, top: 92 }}>
        <View style={{ width: 176, height: 176, borderRadius: 88, alignItems: "center", justifyContent: "center", backgroundColor: scene.cream, boxShadow: "0 18px 34px -18px rgba(60, 40, 0, 0.55)" }}>
          <Animated.View
            style={[
              { width: 155, height: 155, transformOrigin: "50% 90%" },
              reducedMotion ? null : { animationName: WAVE_HAND, animationDuration: "2400ms", animationDelay: "500ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" },
            ]}
          >
            <Image source={MASCOT} style={{ width: 155, height: 155 }} contentFit="contain" />
          </Animated.View>
        </View>
      </Piece>
    </>
  )
}

/* ---------- 2. Prenom : l'en-tete de l'accueil se met a jour pendant la saisie ---------- */

export function NameScene({ name, greeting }: { name: string; greeting: string }) {
  const { t } = useLocale()
  return (
    <>
      <Piece index={0} style={{ left: SCENE_WIDTH / 2 - 150, top: 104 }}>
        <View style={{ width: 300, height: 120, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", justifyContent: "center", paddingHorizontal: 20, gap: 2, boxShadow: "0 22px 36px -20px rgba(10, 40, 20, 0.6)" }}>
          <LinearGradient colors={[scene.night950, scene.forest800, scene.market600]} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <SMotif size={120} opacity={0.1} style={{ position: "absolute", end: -40, top: -30 }} />
          <Text weight="bold" color={scene.mint300} style={{ fontSize: 14 }}>
            {greeting}
          </Text>
          <Text weight="black" color={scene.white} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ maxWidth: 180, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, opacity: name ? 1 : 0.45 }}>
            {name || t("Votre prénom")}
          </Text>
          <View style={{ position: "absolute", end: 18, top: 28, width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.12)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.28)" }}>
            <Image source={MASCOT} style={{ width: 52, height: 58, marginTop: 6 }} contentFit="contain" />
          </View>
        </View>
      </Piece>
      <Piece index={2} style={{ left: 24, right: 24, top: 240, alignItems: "center" }}>
        <View style={{ maxWidth: 345, minHeight: 36, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: scene.white, boxShadow: shadows.card }}>
          <Receipt size={16} color={scene.market600} strokeWidth={2.2} />
          <Text color={scene.ink700} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontSize: 13 }}>
            {`${t("Commande pour")} : `}
            <Text weight="heavy" color={scene.ink900} style={{ fontSize: 13 }}>
              {name || "…"}
            </Text>
          </Text>
        </View>
      </Piece>
    </>
  )
}

/* ---------- 4. Telephone : le numero apparait sur la carte du suivi ---------- */

export function PhoneScene({ phone }: { phone: string }) {
  const { t } = useLocale()
  return (
    <Piece index={0} style={{ left: SCENE_WIDTH / 2 - 150, top: 110 }}>
      <View style={{ width: 300, gap: 12, padding: 16, borderRadius: 24, borderCurve: "continuous", backgroundColor: scene.white, boxShadow: "0 22px 36px -20px rgba(0, 0, 0, 0.6)" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: scene.pale50 }}>
            <Truck size={18} color={scene.market600} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="black" color={scene.ink900} numberOfLines={1} style={{ fontSize: 16 }}>
              {t("En livraison")}
            </Text>
            <Text color={scene.ink500} numberOfLines={2} style={{ fontSize: 12, lineHeight: 16 }}>
              {t("Le livreur arrive entre 8h et 15h")}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 8, paddingStart: 14, paddingEnd: 8, borderRadius: 16, backgroundColor: scene.section }}>
          <Text weight="heavy" numeric color={scene.ink900} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontSize: 15, direction: "ltr" }}>
            {`+212 ${phone || "6 •• •• •• ••"}`}
          </Text>
          <View style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: scene.souki900 }}>
            <Phone size={14} color={scene.white} strokeWidth={2.6} />
            <Text weight="heavy" color={scene.white} style={{ fontSize: 13 }}>
              {t("Appeler")}
            </Text>
          </View>
        </View>
      </View>
    </Piece>
  )
}

/* ---------- 5. Le marche : soleil, prix du jour, etal ---------- */

/*
 * Canevas 393 x 414. La pastille « Prix du jour » en haut, sous le logo ; au centre, le soleil du
 * matin (lumiere douce, sans bord) et le panier du marche ; les quatre assiettes autour, chacune
 * a sa place : rien ne se chevauche et tout tient dans la scene (etiquettes comprises).
 */
const SUN = { size: 260, centerY: 246 }
const BASKET = { width: 150, height: 118, centerY: 238 }
const PLATES: { left?: number; right?: number; top: number; size: number }[] = [
  { left: 18, top: 168, size: 96 },
  { right: 18, top: 154, size: 96 },
  { left: 90, top: 298, size: 78 },
  { right: 90, top: 298, size: 78 },
]
const BASKET_IMAGE = require("../../assets/illustrations/basket.webp")

export function MarketScene({ products }: { products: SceneProduct[] }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  return (
    <>
      {/* Soleil du matin : lumiere creme qui s'efface vers les bords (pas un disque vide). */}
      <Animated.View
        entering={reducedMotion ? FadeIn.duration(200) : new Keyframe({ 0: { opacity: 0, transform: [{ translateY: 60 }, { scale: 0.8 }] }, 100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.cubic) } }).duration(900)}
        style={{ position: "absolute", left: SCENE_WIDTH / 2 - SUN.size / 2, top: SUN.centerY - SUN.size / 2, width: SUN.size, height: SUN.size }}
      >
        <Svg width={SUN.size} height={SUN.size}>
          <Defs>
            <RadialGradient id="market-sun" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FBFBF7" stopOpacity={0.55} />
              <Stop offset="0.45" stopColor="#FBFBF7" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#FBFBF7" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={SUN.size / 2} cy={SUN.size / 2} r={SUN.size / 2} fill="url(#market-sun)" />
        </Svg>
      </Animated.View>
      <View style={{ position: "absolute", right: -70, top: 70 }}>
        <SMotif size={170} opacity={0.08} />
      </View>
      {/* Le panier du marche, au centre de la lumiere. */}
      <Piece index={1} style={{ left: SCENE_WIDTH / 2 - BASKET.width / 2, top: BASKET.centerY - BASKET.height / 2 }}>
        <Floating delay={800}>
          <Image source={BASKET_IMAGE} style={{ width: BASKET.width, height: BASKET.height }} contentFit="contain" />
        </Floating>
      </Piece>
      <Piece index={0} style={{ left: 24, right: 24, top: 108, alignItems: "center" }}>
        <View style={{ maxWidth: 345, minHeight: 30, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(10, 40, 20, 0.35)" }}>
          <LiveDot color={scene.mint300} />
          <Text weight="heavy" color={scene.white} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1, fontSize: 12 }}>
            {t("Prix du jour, chaque matin")}
          </Text>
        </View>
      </Piece>
      {products.slice(0, 4).map((product, index) => {
        const plate = PLATES[index]
        return (
          <Piece key={product.name} index={index + 2} style={{ left: plate.left, right: plate.right, top: plate.top, width: plate.size + 8, marginHorizontal: -4, alignItems: "center", gap: 6 }}>
            <Floating delay={index % 2 ? 1600 : 0}>
              <View style={{ width: plate.size, height: plate.size, borderRadius: plate.size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: scene.cream, boxShadow: "0 16px 30px -14px rgba(0, 0, 0, 0.6)" }}>
                <ProductImage uri={product.image} variant="inset" style={{ width: plate.size, height: plate.size }} />
              </View>
            </Floating>
            <View style={{ maxWidth: plate.size + 8, minHeight: 24, paddingHorizontal: 8, justifyContent: "center", borderRadius: 999, backgroundColor: scene.yellow400 }}>
              <Text weight="black" numeric color={scene.ink900} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{ fontSize: 12, direction: "ltr" }}>
                {product.price}
              </Text>
            </View>
          </Piece>
        )
      })}
    </>
  )
}

/* ---------- 6. Les deux assistants : la phrase dite, la sphere, le panier ---------- */

export function AssistantsScene({ products }: { products: SceneProduct[] }) {
  const { t } = useLocale()
  return (
    <>
      <Piece index={0} style={{ left: 24, right: 24, top: 108, alignItems: "center" }}>
        <View style={{ maxWidth: 320, paddingVertical: 10, paddingHorizontal: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomEndRadius: 20, borderBottomStartRadius: 6, backgroundColor: scene.white }}>
          <Text weight="heavy" color={scene.ink900} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} align="center" style={{ fontSize: 15, lineHeight: 20 }}>
            {t("« 2 kilo maticha w kilo batata »")}
          </Text>
        </View>
      </Piece>
      <Piece index={1} style={{ left: SCENE_WIDTH / 2 - 46, top: 168 }}>
        <View style={{ position: "absolute", left: -16, top: -16, width: 124, height: 124, borderRadius: 62, backgroundColor: "rgba(80, 220, 230, 0.18)" }} />
        <VoiceOrb size={92} animated />
      </Piece>
      <View style={{ position: "absolute", left: 24, right: 24, top: 284, flexDirection: "row", gap: 8, padding: 8, borderRadius: 22, backgroundColor: "rgba(255, 255, 255, 0.1)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.12)" }}>
        {products.slice(0, 2).map((product, index) => (
          <Piece key={product.name} index={3 + index} style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingStart: 6, paddingEnd: 10, borderRadius: 16, backgroundColor: scene.white }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, overflow: "hidden", backgroundColor: scene.photoBg }}>
                <ProductImage uri={product.image} variant="inset" style={{ width: 38, height: 38 }} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="heavy" color={scene.ink900} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: 13, lineHeight: 16 }}>
                  {product.name}
                </Text>
                <Text weight="bold" numeric color={scene.market700} numberOfLines={1} style={{ fontSize: 12, lineHeight: 15 }}>
                  {product.quantity}
                </Text>
              </View>
            </View>
          </Piece>
        ))}
      </View>
      <Piece index={6} style={{ left: 24, right: 24, top: 350 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingStart: 8, paddingEnd: 12, borderRadius: 18, backgroundColor: scene.white }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: scene.souki900 }}>
            <ShoppingBasket size={16} color={scene.white} strokeWidth={2.2} />
            <View style={{ position: "absolute", top: -4, end: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: scene.yellow400, borderWidth: 2, borderColor: scene.white }}>
              <Sparkles size={8} color={scene.ink900} strokeWidth={3} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="heavy" color={scene.ink900} numberOfLines={1} style={{ fontSize: 13, lineHeight: 16 }}>
              {t("Panier intelligent")}
            </Text>
            <Text weight="semibold" color={scene.ink500} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: 12, lineHeight: 16 }}>
              {t("Tajine · 4 pers. · 150 DH")}
            </Text>
          </View>
        </View>
      </Piece>
    </>
  )
}

/* ---------- 7. Payer sans surprise : le recu, le remboursement sur le Wallet ---------- */

function ReceiptRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
      <Text weight={total ? "heavy" : "regular"} color={total ? scene.ink900 : scene.ink700} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, fontSize: 14 }}>
        {label}
      </Text>
      <Text weight={total ? "black" : "heavy"} numeric color={total ? scene.market700 : scene.ink900} style={{ fontSize: total ? 20 : 14, direction: "ltr" }}>
        {value}
      </Text>
    </View>
  )
}

export function TrustScene() {
  const { t, isRtl } = useLocale()
  return (
    <>
      <Piece index={0} style={{ left: SCENE_WIDTH / 2 - 150, top: 110 }}>
        <View style={{ width: 300, gap: 9, padding: 16, borderRadius: 24, borderCurve: "continuous", backgroundColor: scene.white, boxShadow: "0 24px 40px -22px rgba(10, 40, 20, 0.45)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 4 }}>
            <Text weight="black" color={scene.ink900} numberOfLines={1} style={{ flexShrink: 1, fontSize: 15 }}>
              {t("Votre commande")}
            </Text>
            <View style={{ flexShrink: 1, minHeight: 24, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: scene.orange50 }}>
              <Clock size={12} color={scene.orange700} strokeWidth={2.8} />
              <Text weight="heavy" color={scene.orange700} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontSize: 11 }}>
                {t("Modifiable jusqu'à 1h")}
              </Text>
            </View>
          </View>
          <ReceiptRow label={t("Produits")} value="186 DH" />
          <ReceiptRow label={t("Livraison")} value="15 DH" />
          <View style={{ paddingTop: 10, borderTopWidth: 1.5, borderStyle: "dashed", borderTopColor: scene.line }}>
            <ReceiptRow label={t("À payer à la livraison")} value="201 DH" total />
          </View>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
            {[
              { Icon: Banknote, label: t("Espèces") },
              { Icon: Wallet, label: t("Wallet SOUKI") },
            ].map(({ Icon, label }) => (
              <View key={label} style={{ flex: 1, minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6, borderRadius: 12, backgroundColor: scene.section }}>
                <Icon size={16} color={scene.souki900} strokeWidth={2.2} />
                <Text weight="heavy" color={scene.souki900} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontSize: 12 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Piece>
      <Piece index={4} style={{ top: 336, ...(isRtl ? { left: 22 } : { right: 22 }), maxWidth: 330 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingStart: 8, paddingEnd: 14, borderRadius: 999, backgroundColor: scene.souki900, boxShadow: "0 14px 26px -14px rgba(10, 40, 20, 0.7)" }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: scene.fresh500 }}>
            <Wallet size={16} color={scene.white} strokeWidth={2.4} />
          </View>
          <Text weight="bold" color={scene.white} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontSize: 13 }}>
            <Text weight="black" numeric color={scene.mint300} style={{ fontSize: 13 }}>
              {"+7 DH "}
            </Text>
            {t("remboursés sur votre Wallet")}
          </Text>
        </View>
      </Piece>
    </>
  )
}

/* ---------- Nouveau compte : mot de passe (la carte du compte se remplit) ---------- */

export function PasswordScene({ email, length }: { email: string; length: number }) {
  const { t } = useLocale()
  return (
    <>
      <Piece index={0} style={{ left: SCENE_WIDTH / 2 - 150, top: 104 }}>
        <View style={{ width: 300, gap: 12, padding: 16, borderRadius: 24, borderCurve: "continuous", backgroundColor: scene.white, boxShadow: "0 22px 36px -20px rgba(10, 40, 20, 0.45)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: scene.souki900 }}>
              <Lock size={18} color={scene.white} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="black" color={scene.ink900} numberOfLines={1} style={{ fontSize: 16 }}>
                {t("Compte SOUKI")}
              </Text>
              <Text color={scene.ink500} numberOfLines={1} ellipsizeMode="middle" style={{ fontSize: 12, direction: "ltr" }}>
                {email}
              </Text>
            </View>
          </View>
          <View style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 14, backgroundColor: scene.section }}>
            <Text weight="black" color={length ? scene.ink900 : scene.ink300} numberOfLines={1} style={{ fontSize: 20, letterSpacing: 4, direction: "ltr" }}>
              {length ? "•".repeat(Math.min(length, 16)) : "••••••••"}
            </Text>
          </View>
        </View>
      </Piece>
      <Piece index={2} style={{ left: 24, right: 24, top: 240, alignItems: "center" }}>
        <View style={{ maxWidth: 345, minHeight: 36, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: scene.white, boxShadow: shadows.card }}>
          <ShieldCheck size={16} color={scene.market600} strokeWidth={2.2} />
          <Text color={scene.ink700} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontSize: 13 }}>
            {t("Mot de passe protégé, jamais partagé")}
          </Text>
        </View>
      </Piece>
    </>
  )
}

/* ---------- Nouveau compte : le code recu par e-mail ---------- */

export function CodeScene({ code }: { code: string }) {
  const { t } = useLocale()
  return (
    <Piece index={0} style={{ left: SCENE_WIDTH / 2 - 150, top: 100 }}>
      <View style={{ width: 300, alignItems: "center", gap: 14, padding: 18, borderRadius: 24, borderCurve: "continuous", backgroundColor: scene.white, boxShadow: "0 22px 36px -20px rgba(10, 40, 20, 0.45)" }}>
        <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: scene.pale50 }}>
          <Mail size={24} color={scene.market600} strokeWidth={2.2} />
        </View>
        <Text weight="black" color={scene.ink900} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 16 }}>
          {t("Code envoyé par e-mail")}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, direction: "ltr" }}>
          {Array.from({ length: 6 }, (_, index) => (
            <View key={index} style={{ width: 34, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: code[index] ? scene.pale50 : scene.section, borderWidth: code[index] ? 2 : 0, borderColor: scene.market600 }}>
              <Text weight="black" numeric color={scene.ink900} style={{ fontSize: 18 }}>
                {code[index] ?? ""}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Piece>
  )
}
