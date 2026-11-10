import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, KeyboardAvoidingView, Linking, Pressable, ScrollView, TextInput, useWindowDimensions, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio"
import { Check, Keyboard, Mic, Send, Settings, ShoppingBasket } from "lucide-react-native"
import {
  buildVoiceSpans,
  formatDirhams,
  formatQuantity,
  productName,
  roundToStep,
  VOICE_MAX_MS,
  type CatalogueProduct,
  type VoiceBasketResponseDTO,
  type VoiceSpan,
} from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Text } from "@/components/text"
import {
  AnalysisSpot,
  ListeningSpot,
  MissingRow,
  VoiceBackdrop,
  VoiceHeader,
  VoiceHelp,
  VoiceRow,
  VoiceSaid,
  VoiceSheet,
  VoiceSteps,
  VoiceTopBar,
  VoiceTray,
  type SaidWord,
  type SpotItem,
  type StepState,
  type TrayChip,
} from "@/components/voice-scene"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOrderWindow } from "@/hooks/use-orders"
import { ApiError, sendTextBasket, sendVoiceBasket } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { rememberVoiceDraft } from "@/lib/voice-draft"
import { palette } from "@/theme"

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
/** Un groupe de mots toutes les 620 ms : le temps de lire chaque produit en vedette. */
const REVEAL_MS = 620
/** iPhone SE (667 pt de haut) : tailles reduites, comme la page EcranPetit. */
const COMPACT_HEIGHT = 700

type Phase = "idle" | "listening" | "analysis" | "ready" | "error"
type ErrorKind = "unclear" | "failed" | "permission" | "closed"

/** Produit reconnu, avec les prix du jour du catalogue (repli sur le prix renvoye par le serveur). */
type VoiceLine = {
  productId: number
  live: CatalogueProduct | null
  name: string
  image: string
  unit: string
  step: number
  quantity: number
  unitPrice: number
}

/**
 * Commande vocale (VoiceListening + VoiceAnalysis « Du mot au panier », design system 2027) :
 * une seule scene pour l'ecoute, l'analyse, la liste prete et « pas compris », sans transition de
 * navigation. A l'ouverture, rien n'est enregistre : toucher la sphere lance l'ecoute ;
 * « J'ai terminé » (ou la sphere) envoie
 * l'enregistrement. L'analyse revele la phrase groupe par groupe (620 ms) : produit en vedette,
 * vignette dans le plateau, total qui roule. La liste prete se corrige (quantite, retirer) puis
 * « Ajouter au panier ». « Pas compris » propose deux exemples, « Réessayer » et « Écrire ma liste »
 * (/api/text-basket). Le lien mot -> produit est retrouve dans la phrase (packages/shared/src/voice.ts).
 */
export default function CommandeVocaleScreen() {
  const router = useRouter()
  const { t, locale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const compact = height < COMPACT_HEIGHT
  const { add } = useCart()
  const { productsById } = useCatalogue()
  const { closed } = useOrderWindow()
  const recorder = useAudioRecorder(RECORDING)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAt = useRef(0)

  const [phase, setPhase] = useState<Phase>("idle")
  const [errorKind, setErrorKind] = useState<ErrorKind>("unclear")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState("")
  /** Groupes de la derniere phrase ; vide tant que le serveur n'a pas repondu. */
  const [spans, setSpans] = useState<VoiceSpan<VoiceLine>[]>([])
  const [revealed, setRevealed] = useState(0)
  /** Lignes deja validees avant « Corriger en parlant ». */
  const [kept, setKept] = useState<VoiceLine[]>([])
  const [keptMissing, setKeptMissing] = useState<string[]>([])
  const [keptWords, setKeptWords] = useState<Record<number, string>>({})
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [open, setOpen] = useState<number | null>(null)
  const [draftId, setDraftId] = useState<number | null>(null)

  /* ---------- Ecoute ---------- */

  const fail = useCallback((kind: ErrorKind, message: string | null) => {
    if (kind === "unclear") haptics.warning()
    else haptics.error()
    setErrorKind(kind)
    setErrorMessage(message)
    setPhase("error")
  }, [])

  const start = useCallback(async () => {
    setTyping(false)
    setErrorMessage(null)
    if (closed) return fail("closed", t("Les commandes et leurs modifications sont fermées de 01h00 à 08h00. Réouverture à 08h00."))
    const permission = await requestRecordingPermissionsAsync()
    if (!permission.granted) return fail("permission", t("Autorisez l'accès au micro dans Réglages > SOUKI."))
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      startedAt.current = Date.now()
      haptics.add()
      setSpans([])
      setRevealed(0)
      setPhase("listening")
      timer.current = setTimeout(() => void stopRef.current(), VOICE_MAX_MS)
    } catch {
      fail("failed", t("Impossible de démarrer le micro. Réessayez."))
    }
  }, [closed, fail, recorder, t])

  /** Reponse du serveur -> groupes de mots relies aux produits, puis revelation un par un. */
  const analyse = useCallback(
    (data: VoiceBasketResponseDTO) => {
      const lines = data.lignes_panier
        .filter((line) => line.quantite_effective > 0)
        .map((line) => {
          const live = productsById.get(line.product_id) ?? null
          const step = live?.quantityStep ?? 1
          const entry: VoiceLine = {
            productId: line.product_id,
            live,
            name: live ? productName(live, locale) : line.nom_produit,
            image: live?.image ?? "",
            unit: live?.unit ?? "kg",
            step,
            quantity: Math.max(step, roundToStep(line.quantite_effective, step)),
            unitPrice: live?.price ?? line.prix_unitaire,
          }
          const names = [live?.name, live?.alias, live?.nameAr, line.nom_produit].filter((name): name is string => Boolean(name))
          return { names, payload: entry }
        })
      const missing = data.produits_non_disponibles.filter(Boolean)
      if (lines.length === 0 && missing.length === 0) return fail("unclear", null)
      if (data.commande_id) setDraftId(data.commande_id)
      setSpans(buildVoiceSpans(data.transcription ?? "", lines, missing))
      setRevealed(0)
      setPhase("analysis")
    },
    [fail, locale, productsById],
  )

  const stop = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const duration = Date.now() - startedAt.current
    haptics.add()
    try {
      await recorder.stop()
    } catch {
      // Deja arrete (fin des 15 s).
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)
    const uri = recorder.uri
    if (!uri || duration < MIN_RECORDING_MS) return fail("unclear", null)
    setSpans([])
    setRevealed(0)
    setPhase("analysis")
    try {
      analyse(await sendVoiceBasket(uri))
    } catch (caught) {
      if (caught instanceof ApiError && caught.message.toLowerCase().includes("aucune voix")) return fail("unclear", null)
      fail("failed", caught instanceof ApiError ? t(caught.message) : t("Impossible de contacter l'assistant vocal."))
    }
  }, [analyse, fail, recorder, t])

  // La minuterie des 15 s appelle toujours la version a jour de stop.
  const stopRef = useRef(stop)
  stopRef.current = stop

  // Rien n'est enregistre a l'ouverture : l'ecoute demarre au toucher de la sphere.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      void recorder.stop().catch(() => undefined)
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)
    }
    // Nettoyage a la fermeture de l'ecran seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendText = async () => {
    const text = draft.trim()
    if (!text) return
    if (closed) return fail("closed", t("Les commandes et leurs modifications sont fermées de 01h00 à 08h00. Réouverture à 08h00."))
    setTyping(false)
    setDraft("")
    setSpans([])
    setRevealed(0)
    setPhase("analysis")
    try {
      analyse(await sendTextBasket(text))
    } catch (caught) {
      fail("failed", caught instanceof ApiError ? t(caught.message) : t("Impossible de contacter l'assistant vocal."))
    }
  }

  /* ---------- Analyse : un groupe toutes les 620 ms ---------- */

  useEffect(() => {
    if (phase !== "analysis" || spans.length === 0) return
    if (revealed >= spans.length) {
      const done = setTimeout(() => {
        haptics.success()
        setPhase("ready")
      }, 700)
      return () => clearTimeout(done)
    }
    const next = setTimeout(() => {
      if (spans[revealed]?.item || spans[revealed]?.missing) haptics.selection()
      setRevealed((count) => count + 1)
    }, REVEAL_MS)
    return () => clearTimeout(next)
  }, [phase, revealed, spans])

  /* ---------- Donnees affichees ---------- */

  const seen = spans.slice(0, revealed)
  const newLines = seen.filter((span) => span.item).map((span) => span.item as VoiceLine)
  const newMissing = seen.filter((span) => span.missing).map((span) => span.missing as string)

  /** Lignes du panier vocal : anciennes (avant « Corriger en parlant ») + nouvelles, fusionnees par produit. */
  const merged = (() => {
    const byId = new Map<number, VoiceLine & { words: string }>()
    for (const line of kept) byId.set(line.productId, { ...line, words: keptWords[line.productId] ?? "" })
    for (const span of seen) {
      if (!span.item) continue
      const line = span.item
      const existing = byId.get(line.productId)
      if (existing) byId.set(line.productId, { ...existing, quantity: existing.quantity + line.quantity, words: [existing.words, span.text].filter(Boolean).join(" · ") })
      else byId.set(line.productId, { ...line, words: span.text })
    }
    return [...byId.values()]
  })()

  const quantityOf = (line: VoiceLine) => quantities[line.productId] ?? line.quantity
  const visibleLines = merged.filter((line) => quantityOf(line) > 0)
  const total = visibleLines.reduce((sum, line) => sum + line.unitPrice * quantityOf(line), 0)
  // Sans doublon : un mot hors marche dit deux fois n'apparait qu'une fois.
  const missingAll = Array.from(new Set([...keptMissing, ...newMissing]))

  const currentIndex = (() => {
    for (let index = seen.length - 1; index >= 0; index -= 1) if (seen[index].item || seen[index].missing) return index
    return -1
  })()
  const currentSpan = currentIndex >= 0 ? spans[currentIndex] : null
  const spot: SpotItem = currentSpan?.item
    ? {
        kind: "item",
        key: `${currentIndex}`,
        name: currentSpan.item.name,
        image: currentSpan.item.image,
        detail: `${formatQuantity(currentSpan.item.quantity, currentSpan.item.unit, locale)} · ${formatDirhams(currentSpan.item.unitPrice * currentSpan.item.quantity)} DH`,
      }
    : currentSpan?.missing
      ? { kind: "missing", key: `${currentIndex}`, name: currentSpan.missing }
      : null

  const words: SaidWord[] = spans.map((span, index) => ({
    text: span.text,
    tone: phase === "error" ? "seen" : index >= revealed ? "dim" : index === currentIndex && phase === "analysis" ? "cur" : span.missing ? "miss" : "seen",
  }))

  /* ---------- Actions ---------- */

  const close = () => {
    if (timer.current) clearTimeout(timer.current)
    void recorder.stop().catch(() => undefined)
    router.back()
  }

  /** « Corriger en parlant » : on garde la liste (et ses corrections), on ecoute a nouveau. */
  const correct = () => {
    setKept(merged.map((line) => ({ ...line, quantity: quantityOf(line) })).filter((line) => line.quantity > 0))
    setKeptWords(Object.fromEntries(merged.map((line) => [line.productId, line.words])))
    setKeptMissing(missingAll)
    setQuantities({})
    setOpen(null)
    // Retour a la sphere au repos : l'ecoute repart au toucher.
    setSpans([])
    setRevealed(0)
    setPhase("idle")
  }

  const addToCart = () => {
    let added = 0
    for (const line of visibleLines) {
      if (!line.live || line.live.availability === "out_of_stock") continue
      add(line.live, quantityOf(line))
      added += 1
    }
    if (added === 0) {
      haptics.error()
      Alert.alert(t("Produits indisponibles"), t("Ces produits ne sont plus disponibles aujourd'hui."))
      return
    }
    rememberVoiceDraft(draftId)
    haptics.success()
    router.back()
    router.navigate("/panier")
  }

  /* ---------- Rendu ---------- */

  const bottom = Math.max(insets.bottom, compact ? 16 : 20)

  /** Liste ecrite (/api/text-basket) : au repos et dans « pas compris ». */
  const typingBar = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8, marginBottom: bottom, borderRadius: 30, backgroundColor: "rgba(255, 255, 255, 0.12)" }}>
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
  )
  const steps: [StepState, StepState, StepState] =
    phase === "idle" ? ["ready", "next", "next"] : phase === "listening" ? ["live", "next", "next"] : phase === "analysis" ? ["done", "now", "next"] : phase === "ready" ? ["done", "done", "done"] : ["done", "err", "next"]

  const errorTitle =
    errorKind === "unclear" ? t("Je n'ai pas bien compris") : errorKind === "permission" ? t("Micro non autorisé") : errorKind === "closed" ? t("Commandes fermées") : t("Analyse impossible")
  const errorDetail = errorMessage ?? t("Parlez un peu plus près, produit par produit.")

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, direction }}>
      <VoiceBackdrop />
      <View style={{ flex: 1, paddingTop: insets.top + (compact ? 4 : 8), paddingHorizontal: 20 }}>
        <VoiceTopBar onClose={close} />
        <VoiceSteps states={steps} />

        {phase === "ready" ? (
          <VoiceHeader
            tone="done"
            compact={compact}
            title={t("Votre liste est prête")}
            detail={
              visibleLines.length === 1
                ? t("1 produit reconnu")
                : t("{n} produits reconnus", { n: visibleLines.length }) + (missingAll.length ? ` · ${t("{n} hors marché", { n: missingAll.length })}` : "")
            }
          />
        ) : phase === "error" ? (
          <VoiceHeader tone="error" compact={compact} title={errorTitle} detail={errorDetail} />
        ) : null}

        {/* La phrase : pendant l'ecoute, l'analyse et « pas compris », pas sur la liste prete. */}
        {phase === "ready" ? null : phase === "idle" || phase === "listening" ? (
          <VoiceSaid compact={compact} words={[]} placeholder={t("Vos mots s'affichent ici")} caret={phase === "listening"} minHeight={92} />
        ) : (
          <VoiceSaid compact={compact} words={words} placeholder={phase === "analysis" ? t("Transcription en cours…") : t("Rien n'a été entendu.")} />
        )}

        {phase === "idle" || phase === "listening" ? (
          <>
            <ListeningSpot compact={compact} listening={phase === "listening"} onPress={() => void (phase === "listening" ? stop() : start())} />
            {typing && phase === "idle" ? (
              typingBar
            ) : (
              <View style={{ alignItems: "center", gap: 12, paddingBottom: bottom }}>
                {phase === "listening" ? (
                  <BrandButton tone="light" icon={Check} label={t("J'ai terminé")} onPress={() => void stop()} />
                ) : (
                  <Pressable
                    onPress={() => setTyping(true)}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Keyboard size={16} color={palette.white} strokeWidth={2.2} />
                    <Text weight="heavy" color={palette.white} style={{ fontSize: 14 }}>
                      {t("Écrire ma liste")}
                    </Text>
                  </Pressable>
                )}
                <Text weight="semibold" color={palette.mint300} align="center" style={{ fontSize: 12, lineHeight: 16 }}>
                  {`${t("Darija et français")} · « 2 kilo maticha w kilo batata »`}
                </Text>
              </View>
            )}
          </>
        ) : null}

        {phase === "analysis" ? (
          <>
            <AnalysisSpot compact={compact} current={spot} />
            <VoiceSheet
              title={t("Votre panier")}
              caption={t(newLines.length + kept.length > 1 ? "{n} produits" : "{n} produit", { n: newLines.length + kept.length })}
              total={total}
              fill={false}
              maxHeight={height * 0.6}
              bottomInset={bottom}
            >
              <VoiceTray
                chips={[
                  // Une vignette par groupe de mots : cle par position dans la phrase (un meme produit
                  // peut etre dit deux fois, « tomates … et encore des tomates »).
                  ...seen.flatMap<TrayChip>((span, index) =>
                    span.item
                      ? [{ key: `i-${index}`, image: span.item.image, label: formatQuantity(span.item.quantity, span.item.unit, locale) }]
                      : span.missing
                        ? [{ key: `m-${index}`, image: null, label: t("Absent"), missing: true }]
                        : [],
                  ),
                ]}
              />
            </VoiceSheet>
          </>
        ) : null}

        {phase === "ready" ? (
          <VoiceSheet title={t("Votre panier")} caption={t("Touchez pour modifier")} total={total} fill bottomInset={bottom}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
              {visibleLines.map((line, index) => (
                <VoiceRow
                  key={line.productId}
                  index={index}
                  open={open === line.productId}
                  onToggle={() => {
                    haptics.selection()
                    setOpen((current) => (current === line.productId ? null : line.productId))
                  }}
                  onChange={(next) => {
                    setQuantities((current) => ({ ...current, [line.productId]: next }))
                    if (next === 0) {
                      haptics.remove()
                      setOpen(null)
                    }
                  }}
                  row={{
                    key: String(line.productId),
                    name: line.name,
                    words: line.words,
                    image: line.image,
                    quantity: quantityOf(line),
                    quantityLabel: formatQuantity(quantityOf(line), line.unit, locale),
                    price: `${formatDirhams(line.unitPrice * quantityOf(line))} DH`,
                    unit: line.unit,
                    step: line.step,
                  }}
                />
              ))}
              {visibleLines.length === 0 ? (
                <Text weight="semibold" color={palette.ink500} align="center" style={{ fontSize: 14, marginVertical: 18 }}>
                  {t("Votre liste est vide. Dites-la à nouveau.")}
                </Text>
              ) : null}
              {missingAll.map((name, index) => (
                <MissingRow key={name} name={name} index={visibleLines.length + index} />
              ))}
            </ScrollView>
            <View style={{ gap: 8, marginTop: 4 }}>
              <BrandButton icon={ShoppingBasket} label={t("Ajouter au panier")} trailing={`${formatDirhams(total)} DH`} disabled={visibleLines.length === 0} onPress={addToCart} />
              <BrandButton tone="soft" icon={Mic} label={t("Corriger en parlant")} onPress={correct} />
            </View>
          </VoiceSheet>
        ) : null}

        {phase === "error" ? (
          <>
            {errorKind === "unclear" ? <VoiceHelp /> : null}
            <View style={{ flex: 1 }} />
            {typing ? (
              typingBar
            ) : (
              <View style={{ gap: 8, paddingTop: 16, paddingBottom: bottom }}>
                {errorKind === "closed" ? (
                  <BrandButton tone="light" label={t("Fermer")} onPress={close} />
                ) : errorKind === "permission" ? (
                  <BrandButton tone="light" icon={Settings} label={t("Ouvrir Réglages")} onPress={() => void Linking.openSettings()} />
                ) : (
                  <BrandButton
                    tone="light"
                    icon={Mic}
                    label={t("Réessayer")}
                    onPress={() => {
                      // Retour a la sphere au repos : l'ecoute repart au toucher.
                      setSpans([])
                      setRevealed(0)
                      setPhase("idle")
                    }}
                  />
                )}
                {errorKind === "closed" ? null : <BrandButton tone="soft" icon={Keyboard} label={t("Écrire ma liste")} onPress={() => setTyping(true)} />}
              </View>
            )}
          </>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  )
}
