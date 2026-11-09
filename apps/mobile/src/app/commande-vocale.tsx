import { useEffect, useRef, useState } from "react"
import { Pressable, ScrollView, TextInput, View } from "react-native"
import Animated, { useReducedMotion } from "react-native-reanimated"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio"
import { ArrowRight, ChevronLeft, Keyboard, Mic, Send, TriangleAlert, X } from "lucide-react-native"
import {
  deliveryFeeFor,
  formatDirhams,
  productName,
  VOICE_MAX_MS,
  type VoiceBasketLineDTO,
  type VoiceBasketResponseDTO,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { AssistantFrame, RoundIcon, SuggestedLine } from "@/components/ai-parts"
import { VoiceOrb } from "@/components/assistant-cards"
import { BrandButton } from "@/components/brand-button"
import { CheckoutCard } from "@/components/checkout-parts"
import { Note } from "@/components/form-fields"
import { LiveDot } from "@/components/home-hero"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOrderWindow } from "@/hooks/use-orders"
import { ApiError, sendTextBasket, sendVoiceBasket } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { palette, radius, shadows } from "@/theme"

/**
 * WAV PCM 16 bits mono a 16 kHz : le format que /api/voice-basket accepte sans conversion
 * (WAV, MP3 ou WebM ; l'enregistrement par defaut de l'iPhone, en M4A, serait refuse).
 */
const RECORDING: RecordingOptions = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  ios: { extension: ".wav", outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.HIGH, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  android: { extension: ".wav", outputFormat: "default", audioEncoder: "default" },
  web: {},
}

/** Sous une seconde, aucune liste n'a pu etre dite. */
const MIN_RECORDING_MS = 1000

type Phase = "idle" | "listening" | "processing" | "result"

/**
 * Commande vocale (EcranAssistants > Commande vocale, design system 2027 ; regles de
 * ai-modals.tsx du site) : plein ecran vert foret, orbe au centre. Repos « Touchez la sphère
 * pour parler », ecoute (anneaux, ondes, 15 s au plus), analyse « Composition du panier… ».
 * Darija et francais. La liste reconnue rappelle la phrase dite, previent des ajustements de
 * disponibilite, puis « Aller au checkout ». On peut aussi ecrire sa liste.
 */
export default function CommandeVocaleScreen() {
  const router = useRouter()
  const { t, locale, isRtl } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const { add } = useCart()
  const { productsById } = useCatalogue()
  const { closed } = useOrderWindow()
  const recorder = useAudioRecorder(RECORDING)
  const recorderState = useAudioRecorderState(recorder, 200)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState("")
  const [result, setResult] = useState<VoiceBasketResponseDTO | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)
    },
    [],
  )

  /** Une nouvelle liste s'ajoute a la precedente (« Ajouter en parlant »). */
  const merge = (data: VoiceBasketResponseDTO) => {
    setResult((current) => {
      if (!current) return data
      const lines = [...current.lignes_panier]
      for (const line of data.lignes_panier) {
        const index = lines.findIndex((entry) => entry.product_id === line.product_id)
        if (index >= 0) lines[index] = { ...lines[index], quantite_effective: lines[index].quantite_effective + line.quantite_effective }
        else lines.push(line)
      }
      return {
        ...data,
        transcription: [current.transcription, data.transcription].filter(Boolean).join(" · "),
        produits_non_disponibles: [...current.produits_non_disponibles, ...data.produits_non_disponibles],
        lignes_panier: lines,
      }
    })
    setQuantities((current) => {
      const next = { ...current }
      for (const line of data.lignes_panier) next[line.product_id] = (next[line.product_id] ?? 0) + line.quantite_effective
      return next
    })
    haptics.success()
    setPhase("result")
  }

  const fail = (caught: unknown, fallback: string) => {
    haptics.error()
    setError(caught instanceof ApiError ? t(caught.message) : t(fallback))
    setPhase(result ? "result" : "idle")
  }

  const stop = async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const duration = recorder.currentTime * 1000
    haptics.medium()
    try {
      await recorder.stop()
    } catch {
      // Deja arrete (fin des 15 s).
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)
    const uri = recorder.uri
    if (!uri || duration < MIN_RECORDING_MS) {
      setError(t("Aucune voix detectee. Appuyez et parlez."))
      setPhase(result ? "result" : "idle")
      return
    }
    setPhase("processing")
    try {
      merge(await sendVoiceBasket(uri))
    } catch (caught) {
      fail(caught, "Impossible de contacter l'assistant vocal.")
    }
  }

  const start = async () => {
    setError(null)
    if (closed) return setError(t("Les commandes et leurs modifications sont fermées de 01h00 à 08h00. Réouverture à 08h00."))
    const permission = await requestRecordingPermissionsAsync()
    if (!permission.granted) return setError(t("Micro non autorisé. Autorisez l'accès au micro dans Réglages > SOUKI."))
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      haptics.medium()
      setPhase("listening")
      timer.current = setTimeout(() => void stop(), VOICE_MAX_MS)
    } catch {
      setError(t("Impossible de démarrer le micro. Réessayez."))
    }
  }

  const sendText = async () => {
    const text = draft.trim()
    if (!text) return
    if (closed) return setError(t("Les commandes et leurs modifications sont fermées de 01h00 à 08h00. Réouverture à 08h00."))
    setError(null)
    setTyping(false)
    setDraft("")
    setPhase("processing")
    try {
      merge(await sendTextBasket(text))
    } catch (caught) {
      fail(caught, "Impossible de contacter l'assistant vocal.")
    }
  }

  const lines: VoiceBasketLineDTO[] = (result?.lignes_panier ?? []).filter((line) => (quantities[line.product_id] ?? 0) > 0)
  const subtotal = lines.reduce((sum, line) => sum + line.prix_unitaire * (quantities[line.product_id] ?? 0), 0)
  const fee = subtotal > 0 ? deliveryFeeFor(subtotal) : 0

  const checkout = () => {
    let added = 0
    for (const line of lines) {
      const live = productsById.get(line.product_id)
      if (!live || live.availability === "out_of_stock") continue
      add(live, quantities[line.product_id])
      added += 1
    }
    if (added === 0) return setError(t("Ces produits ne sont plus disponibles aujourd'hui."))
    haptics.success()
    router.replace(result?.commande_id ? `/checkout?vocal=${result.commande_id}` : "/checkout")
  }

  /* ---------- Liste reconnue ---------- */
  if (phase === "result" && result) {
    const adjusted = result.lignes_panier.some((line) => line.message_ajustement) || result.produits_non_disponibles.length > 0
    return (
      <AssistantFrame
        title={t("Votre liste")}
        onClose={() => router.back()}
        dock={
          <>
            <BrandButton
              label={closed ? t("Commandes fermées") : t("Aller au checkout")}
              icon={isRtl ? ChevronLeft : ArrowRight}
              iconPosition="end"
              trailing={`${formatDirhams(subtotal + fee)} DH`}
              disabled={closed || lines.length === 0}
              onPress={checkout}
            />
            <BrandButton tone="soft" icon={Mic} label={t("Ajouter en parlant")} onPress={() => void start()} />
          </>
        }
      >
        {result.transcription ? (
          <CheckoutCard title={t("Vous avez dit")}>
            <Text variant="body" color={palette.ink700} style={{ fontSize: 15, lineHeight: 22, fontStyle: "italic" }}>
              {`« ${result.transcription} »`}
            </Text>
          </CheckoutCard>
        ) : null}
        {adjusted ? <Note tone="orange" icon={TriangleAlert}>{t("Certains produits ont été ajustés selon leur disponibilité.")}</Note> : null}
        {result.produits_non_disponibles.length > 0 ? (
          <Note tone="orange">{t("Non disponibles aujourd'hui : {liste}.", { liste: result.produits_non_disponibles.join(", ") })}</Note>
        ) : null}
        {error ? <Note tone="red">{error}</Note> : null}
        <View style={{ gap: 8 }}>
          {result.lignes_panier.map((line, index) => {
            const live = productsById.get(line.product_id) ?? null
            const quantity = quantities[line.product_id] ?? 0
            if (quantity <= 0) return null
            return (
              <SuggestedLine
                key={line.product_id}
                index={index}
                product={live}
                name={live ? productName(live, locale) : line.nom_produit}
                unit={live?.unit ?? "kg"}
                unitPrice={line.prix_unitaire}
                image={live?.image ?? ""}
                quantity={quantity}
                note={line.message_ajustement ? t(line.message_ajustement) : null}
                onChange={(next) => setQuantities((current) => ({ ...current, [line.product_id]: next }))}
              />
            )
          })}
        </View>
        <View style={{ padding: 18, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
          <Row label={t("Produits")} value={`${formatDirhams(subtotal)} DH`} />
          <Row label={t("Livraison")} value={fee > 0 ? `${formatDirhams(fee)} DH` : t("Offerte")} />
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line }}>
            <Text variant="headline" weight="black" color={palette.ink900} style={{ fontSize: 17 }}>
              {t("Total")}
            </Text>
            <AnimatedDigits value={`${formatDirhams(subtotal + fee)} DH`} weight="black" color={palette.souki900} style={{ fontSize: 24, lineHeight: 30 }} />
          </View>
        </View>
        <Text variant="footnote" color={palette.ink500} align="center" style={{ fontSize: 12 }}>
          {t("Montant indicatif : le total est recalculé au prix du jour à la validation.")}
        </Text>
      </AssistantFrame>
    )
  }

  /* ---------- Ecoute ---------- */
  const listening = phase === "listening"
  const processing = phase === "processing"
  const seconds = Math.floor((recorderState.durationMillis ?? 0) / 1000)
  const orbState = processing ? t("Composition du panier…") : listening ? t("À l'écoute — touchez la sphère pour arrêter") : t("Touchez la sphère pour parler")

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 6, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) }}>
      <LinearGradient colors={[palette.forest700, palette.forest900]} locations={[0, 0.7]} start={{ x: 0.5, y: 0.2 }} end={{ x: 0.5, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <RoundIcon
          dark
          icon={X}
          label={t("Fermer")}
          onPress={() => {
            if (listening) void recorder.stop().catch(() => undefined)
            router.back()
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LiveDot color={palette.mint300} />
          <Text variant="callout" weight="heavy" color={palette.white} style={{ fontSize: 16 }}>
            {t("IA-SOUKI Vocal")}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 26 }}>
        <Text accessibilityLiveRegion="polite" variant="title2" weight="heavy" color={palette.white} align="center" style={{ maxWidth: 320, fontSize: 22, lineHeight: 30 }}>
          {processing ? t("Analyse en cours…") : listening ? t("Je vous écoute… {s} s", { s: seconds }) : t("Dites votre liste de courses")}
        </Text>
        <Pressable
          onPress={() => (listening ? void stop() : processing ? undefined : void start())}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel={orbState}
          accessibilityState={{ busy: processing }}
        >
          <Animated.View
            style={
              processing && !reducedMotion
                ? { animationName: SPIN, animationDuration: "1600ms", animationIterationCount: "infinite", animationTimingFunction: "linear" }
                : undefined
            }
          >
            <VoiceOrb size={176} animated={!reducedMotion && (listening || processing)} rings={!reducedMotion && listening} />
          </Animated.View>
        </Pressable>
        <Text variant="footnote" weight="semibold" color={palette.mint300} align="center" style={{ fontSize: 13 }}>
          {orbState}
        </Text>
        {error ? (
          <View style={{ alignSelf: "stretch" }}>
            <Note tone="red">{error}</Note>
          </View>
        ) : null}
      </ScrollView>

      {typing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 30, backgroundColor: "rgba(255, 255, 255, 0.12)" }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t("Ex : 2 kilos de tomates, 1 kilo d'oignons")}
            placeholderTextColor="rgba(255, 255, 255, 0.55)"
            autoFocus
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => void sendText()}
            style={{ flex: 1, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "rgba(255, 255, 255, 0.1)", color: palette.white, fontSize: 16 }}
          />
          <Pressable
            onPress={() => void sendText()}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t("Envoyer")}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim() ? palette.white : "rgba(255, 255, 255, 0.2)" }}
          >
            <Send size={18} color={draft.trim() ? palette.souki900 : palette.white} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text variant="footnote" weight="semibold" color={palette.mint300} style={{ fontSize: 12 }}>
            {t("Darija et français pris en charge.")}
          </Text>
          <View style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: "rgba(255, 255, 255, 0.1)" }}>
            <Text variant="footnote" weight="semibold" color={palette.white} style={{ fontSize: 13 }}>
              « 2 kilo maticha w kilo batata »
            </Text>
          </View>
          {listening || processing ? null : (
            <Pressable onPress={() => setTyping(true)} accessibilityRole="button" hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, opacity: pressed ? 0.6 : 1 })}>
              <Keyboard size={16} color={palette.white} strokeWidth={2.2} />
              <Text variant="footnote" weight="heavy" color={palette.white} style={{ fontSize: 13 }}>
                {t("Écrire ma liste")}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const SPIN = {
  from: { transform: [{ rotate: "0deg" }] },
  to: { transform: [{ rotate: "360deg" }] },
} as const

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <Text variant="callout" color={palette.ink700} style={{ fontSize: 15 }}>
        {label}
      </Text>
      <Text variant="callout" weight="heavy" numeric color={palette.ink900} style={{ fontSize: 15 }}>
        {value}
      </Text>
    </View>
  )
}
