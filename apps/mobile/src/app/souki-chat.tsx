import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react"
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from "react-native"
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated"
import { useRouter } from "expo-router"
import { Image } from "expo-image"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useQuery } from "@tanstack/react-query"
import { RotateCcw, Send, X } from "lucide-react-native"
import { CHAT_MAX_LENGTH, chatHistory, type ChatMessage } from "@souki/shared"

import { RoundIcon } from "@/components/ai-parts"
import { Note } from "@/components/form-fields"
import { LiveDot } from "@/components/home-hero"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, fetchQuickAnswers, streamChat } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, EASE_OUT_2027 } from "@/lib/motion"
import { colors, fonts, palette, radius, shadows } from "@/theme"

const MASCOT = require("../../assets/illustrations/recolte-fermier.svg")

/** Conversation gardee pendant la session de l'app (comme le sessionStorage du site). */
const conversations = new Map<string, ChatMessage[]>()

/**
 * Discussion avec Souki (EcranAssistants > Discussion, regles de mascot-chat-sheet.tsx) :
 * salutation du site, questions rapides avec leur reponse toute prete (/api/assistant/
 * suggestions), reponses en continu (/api/assistant/chat) qui ne citent que des faits du
 * service, « Souki écrit… », champ colle au-dessus du clavier. 500 caracteres par message.
 */
export default function SoukiChatScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const key = `souki-chat:${user?.id ?? "me"}`
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const abort = useRef<AbortController | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(() => conversations.get(key) ?? [])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quick = useQuery({ queryKey: ["assistant-suggestions"], queryFn: ({ signal }) => fetchQuickAnswers(signal), staleTime: 30 * 60 * 1000 })

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (!busy) conversations.set(key, messages.slice(-20))
  }, [messages, busy, key])

  const send = async (content: string, readyAnswer?: string) => {
    const text = content.trim()
    if (busy || !text || text.length > CHAT_MAX_LENGTH) return
    haptics.selection()
    const history = chatHistory(messages)
    const next: ChatMessage[] = [...history, { role: "user", content: text }, { role: "assistant", content: "" }]
    setMessages(next)
    setDraft("")
    setError(null)
    setBusy(true)
    let answer = ""
    const append = (delta: string) => {
      answer += delta
      setMessages([...next.slice(0, -1), { role: "assistant", content: answer }])
    }
    const controller = new AbortController()
    abort.current = controller
    const timeout = setTimeout(() => controller.abort(), 60000)
    try {
      if (readyAnswer) append(readyAnswer)
      else await streamChat(text, history, append, controller.signal)
    } catch (caught) {
      if (controller !== abort.current) return
      setMessages(history)
      setDraft(text)
      haptics.error()
      setError(controller.signal.aborted ? t("La réponse prend trop de temps. Réessayez.") : caught instanceof ApiError ? t(caught.message) : t("Souki est momentanément indisponible."))
    } finally {
      clearTimeout(timeout)
      if (controller === abort.current) {
        setBusy(false)
        abort.current = null
      }
    }
  }

  const suggestions = quick.data ?? []
  const waiting = busy && messages[messages.length - 1]?.content === ""

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <View style={{ paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", backgroundColor: palette.glass, boxShadow: `0 1px 0 ${palette.line}` }}>
        <RoundIcon icon={X} label={t("Fermer")} onPress={() => router.back()} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Avatar size={40} />
          <View>
            <Text variant="callout" weight="heavy" color={palette.ink900} style={{ fontSize: 16 }}>
              Souki
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <LiveDot color={palette.leaf500} />
              <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 12 }}>
                {t("Courses et livraison")}
              </Text>
            </View>
          </View>
        </View>
        <RoundIcon
          icon={RotateCcw}
          label={t("Nouvelle conversation")}
          onPress={() => {
            if (busy) return
            setMessages([])
            setError(null)
            setDraft("")
          }}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        accessibilityRole="list"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12 }}
      >
        <Bubble from="bot">{t("Salam ! Je suis Souki 👋 Une question sur vos courses ou la livraison ?")}</Bubble>
        {messages.length === 0 && suggestions.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingStart: 42 }}>
            {suggestions.map((item) => (
              <Suggestion key={item.question} label={t(item.question)} disabled={busy} onPress={() => void send(t(item.question), t(item.answer))} />
            ))}
          </View>
        ) : null}
        {messages.map((message, index) =>
          message.role === "assistant" && message.content === "" ? null : (
            <Bubble key={index} from={message.role === "user" ? "me" : "bot"}>
              {message.content}
            </Bubble>
          ),
        )}
        {waiting ? <Typing label={t("Souki écrit…")} /> : null}
        {error ? <Note tone="red">{error}</Note> : null}
      </ScrollView>

      {messages.length > 0 && suggestions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 6 }} style={{ flexGrow: 0 }}>
          {suggestions.map((item) => (
            <Suggestion key={item.question} label={t(item.question)} disabled={busy} onPress={() => void send(t(item.question), t(item.answer))} />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ marginHorizontal: 12, marginBottom: Math.max(insets.bottom, 12), flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 30, borderCurve: "continuous", backgroundColor: palette.glass, boxShadow: `${shadows.float}, inset 0 0 0 1px rgba(255, 255, 255, 0.8)` }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t("Posez votre question…")}
          placeholderTextColor={palette.ink300}
          maxLength={CHAT_MAX_LENGTH}
          multiline
          accessibilityLabel={t("Votre message à Souki")}
          style={{ flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 22, backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.line, fontFamily: fonts.latin.regular, fontSize: 16, color: palette.ink900, textAlign: direction === "rtl" ? "right" : "left" }}
        />
        <Pressable
          onPress={() => void send(draft)}
          disabled={busy || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel={t("Envoyer")}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: busy || !draft.trim() ? palette.sand : palette.souki900, opacity: pressed ? 0.75 : 1 })}
        >
          <Send size={18} color={busy || !draft.trim() ? palette.ink300 : palette.white} strokeWidth={2.4} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function Avatar({ size = 34 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: palette.pale50, borderWidth: 1.5, borderColor: palette.green100 }}>
      <Image source={MASCOT} style={{ width: size * 0.88, height: size, marginTop: size * 0.18 }} contentFit="contain" accessibilityElementsHidden />
    </View>
  )
}

/** Bulle : Souki en blanc avec son avatar, le client en souki-900 ; montee de 14 pt en 240 ms. */
function Bubble({ from, children }: { from: "bot" | "me"; children: string }) {
  const reducedMotion = useReducedMotion()
  const me = from === "me"
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(DUR_BASE).easing(EASE_OUT_2027).withInitialValues({ transform: [{ translateY: 14 }] })}
      style={{ flexDirection: me ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, maxWidth: "88%", alignSelf: me ? "flex-end" : "flex-start" }}
    >
      {me ? null : <Avatar />}
      <View
        style={{
          flexShrink: 1,
          paddingVertical: 11,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderCurve: "continuous",
          borderBottomLeftRadius: me ? 20 : 6,
          borderBottomRightRadius: me ? 6 : 20,
          backgroundColor: me ? palette.souki900 : palette.white,
          boxShadow: me ? undefined : shadows.card,
          gap: 3,
        }}
      >
        <Formatted text={children} color={me ? palette.white : palette.ink900} />
      </View>
    </Animated.View>
  )
}

/** **gras** et puces « - » comme le site ; une ligne par paragraphe. */
function Formatted({ text, color }: { text: string; color: string }) {
  return (
    <>
      {text.split("\n").map((line, index) => {
        const bullet = /^[-*] /.test(line)
        const parts: ReactNode[] = (bullet ? `• ${line.slice(2)}` : line).split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <Text key={i} variant="body" weight="heavy" color={color} style={{ fontSize: 15, lineHeight: 21 }}>
              {part.slice(2, -2)}
            </Text>
          ) : (
            part
          ),
        )
        return (
          <Text key={index} selectable variant="body" color={color} style={{ fontSize: 15, lineHeight: 21, minHeight: line ? undefined : 6 }}>
            {parts}
          </Text>
        )
      })}
    </>
  )
}

function Suggestion({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18, borderCurve: "continuous", backgroundColor: palette.pale50, borderWidth: 1, borderColor: palette.green100, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
    >
      <Text variant="footnote" weight="bold" color={palette.souki900} style={{ fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  )
}

const DOT = {
  "0%": { opacity: 0.3, transform: [{ translateY: 0 }] },
  "50%": { opacity: 1, transform: [{ translateY: -3 }] },
  "100%": { opacity: 0.3, transform: [{ translateY: 0 }] },
} as const

/** « Souki écrit… » : trois points. */
function Typing({ label }: { label: string }) {
  const reducedMotion = useReducedMotion()
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
      <Avatar />
      <View style={{ flexDirection: "row", gap: 5, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: palette.white, boxShadow: shadows.card }}>
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={{
              width: 7,
              height: 7,
              borderRadius: radius.pill,
              backgroundColor: palette.ink300,
              ...(reducedMotion ? null : { animationName: DOT, animationDuration: "900ms", animationDelay: `${index * 150}ms`, animationIterationCount: "infinite" }),
            }}
          />
        ))}
      </View>
    </View>
  )
}
