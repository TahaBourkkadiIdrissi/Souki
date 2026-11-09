import { Linking, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MessageCircle, Mic, ShieldCheck, ShoppingBasket, type LucideIcon } from "lucide-react-native"

import { AiHero } from "@/components/ai-parts"
import { TextLink } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { Note } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { ASSISTANT_ROUTES, type AssistantMode } from "@/hooks/use-open-assistant"
import { giveAiConsent, hasAiConsent, withdrawAiConsent } from "@/lib/ai-consent"
import { SITE_URL } from "@/lib/config"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius, shadows } from "@/theme"

type Use = { mode: AssistantMode; icon: LucideIcon; title: string; service: string; detail: string }

/**
 * Accord pour les assistants IA (regle Apple 5.1.2(i)) : avant le premier usage de la commande
 * vocale, du panier intelligent ou de la discussion avec Souki, l'app dit quelles donnees partent
 * vers quel service d'IA externe, et demande l'accord. Une seule fois par compte ; l'accord se
 * retire depuis Compte. Contenu verifie dans le back-end : seuls l'audio ou le texte de la liste,
 * les criteres du panier et les messages sont envoyes, jamais le nom, l'e-mail ni le telephone.
 * Feuille a la hauteur de son contenu (`fitToContents`), boutons juste sous le texte.
 */
export default function AccordIaSheet() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { next } = useLocalSearchParams<{ next?: AssistantMode }>()
  const target = next && next in ASSISTANT_ROUTES ? ASSISTANT_ROUTES[next] : null
  const managing = hasAiConsent(user?.id) && !target

  const accept = () => {
    giveAiConsent(user?.id)
    haptics.success()
    if (target) router.replace(target)
    else router.back()
  }

  const withdraw = () => {
    withdrawAiConsent(user?.id)
    haptics.selection()
    router.back()
  }

  const uses: Use[] = [
    { mode: "voice", icon: Mic, title: t("Commande vocale"), service: "Google Gemini", detail: t("Votre enregistrement ou votre liste écrite, pour reconnaître les produits.") },
    { mode: "smart", icon: ShoppingBasket, title: t("Panier intelligent"), service: "Groq", detail: t("Vos critères (budget, personnes, durée, plat), pour composer le panier.") },
    { mode: "chat", icon: MessageCircle, title: t("Discussion avec Souki"), service: "Groq", detail: t("Vos messages, pour rédiger la réponse.") },
  ]
  // L'assistant que l'on vient d'ouvrir passe en premier.
  const ordered = next ? [...uses].sort((a, b) => Number(b.mode === next) - Number(a.mode === next)) : uses

  return (
    <View style={{ backgroundColor: colors.background, direction, paddingHorizontal: 16, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 16), gap: 14 }}>
      <AiHero
        icon={ShieldCheck}
        spark
        title={t("Les assistants IA de SOUKI")}
        detail={t("Pour vous répondre, ils envoient certaines données à un service d'IA externe. Votre accord est demandé une seule fois.")}
      />

      <View style={{ borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card, overflow: "hidden" }}>
        {ordered.map((use, index) => {
          const current = use.mode === next
          return (
            <View
              key={use.mode}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: palette.line, backgroundColor: current ? palette.pale50 : palette.white }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 12, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: current ? palette.souki900 : palette.pale50 }}>
                <use.icon size={18} color={current ? palette.white : palette.souki900} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <Text variant="callout" weight="bold" color={palette.ink900} style={{ fontSize: 15 }}>
                    {use.title}
                  </Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: current ? palette.white : palette.sand }}>
                    <Text variant="footnote" weight="heavy" color={palette.ink700} style={{ fontSize: 11 }}>
                      {use.service}
                    </Text>
                  </View>
                </View>
                <Text variant="footnote" color={palette.ink500} style={{ fontSize: 13, lineHeight: 18 }}>
                  {use.detail}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      <Note icon={ShieldCheck}>
        {t("Votre nom, votre e-mail et votre téléphone ne sont jamais envoyés. Ces données servent uniquement à vous répondre.")}
      </Note>

      <View style={{ gap: 8, marginTop: 2 }}>
        {managing ? (
          <BrandButton tone="danger" label={t("Retirer mon accord")} onPress={withdraw} />
        ) : (
          <BrandButton label={t("Accepter et continuer")} onPress={accept} />
        )}
        <BrandButton tone="soft" label={managing ? t("Fermer") : t("Pas maintenant")} onPress={() => router.back()} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 4 }}>
        <Text variant="footnote" color={palette.ink500} style={{ fontSize: 12 }}>
          {t("Vous pouvez retirer votre accord dans Compte.")}
        </Text>
        <TextLink label={t("Politique de confidentialité")} onPress={() => void Linking.openURL(`${SITE_URL}/politique-confidentialite`)} />
      </View>
    </View>
  )
}
