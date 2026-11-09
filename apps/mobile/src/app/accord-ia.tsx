import { Linking, ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MessageCircle, Mic, ShieldCheck, ShoppingBasket, type LucideIcon } from "lucide-react-native"

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
import { colors, palette, radius } from "@/theme"

/**
 * Accord pour les assistants IA (regle Apple 5.1.2(i)) : avant le premier usage de la commande
 * vocale, du panier intelligent ou de la discussion avec Souki, l'app dit quelles donnees partent
 * vers quel service d'IA externe, et demande l'accord. Une seule fois par compte ; l'accord se
 * retire depuis Compte. Contenu verifie dans le back-end : seuls l'audio ou le texte de la liste,
 * les criteres du panier et les messages sont envoyes, jamais le nom, l'e-mail ni le telephone.
 */
export default function AccordIaSheet() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { next } = useLocalSearchParams<{ next?: AssistantMode }>()
  const target = next && next in ASSISTANT_ROUTES ? ASSISTANT_ROUTES[next] : null
  const alreadyGiven = hasAiConsent(user?.id)

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

  const uses: { icon: LucideIcon; title: string; detail: string }[] = [
    { icon: Mic, title: t("Commande vocale"), detail: t("Votre enregistrement ou votre liste écrite est envoyé à Google (Gemini) pour reconnaître les produits.") },
    { icon: ShoppingBasket, title: t("Panier intelligent"), detail: t("Vos critères (budget, personnes, durée, plat) sont envoyés à Groq pour composer le panier.") },
    { icon: MessageCircle, title: t("Discussion avec Souki"), detail: t("Vos messages sont envoyés à Groq pour rédiger la réponse.") },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 14 }}>
        <Text accessibilityRole="header" variant="title2" weight="black" color={palette.ink900} style={{ fontSize: 22 }}>
          {t("Les assistants IA de SOUKI")}
        </Text>
        <Text variant="body" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
          {t("Pour vous répondre, ces assistants envoient certaines données à des services d'IA externes. Votre accord est demandé avant le premier usage.")}
        </Text>
        <View style={{ padding: 16, gap: 14, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white }}>
          {uses.map((use) => (
            <View key={use.title} style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.pale50 }}>
                <use.icon size={18} color={palette.souki900} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="callout" weight="bold" color={palette.ink900} style={{ fontSize: 15 }}>
                  {use.title}
                </Text>
                <Text variant="footnote" color={palette.ink700} style={{ fontSize: 13, lineHeight: 18 }}>
                  {use.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Note icon={ShieldCheck}>
          {t("Votre nom, votre e-mail et votre téléphone ne sont jamais envoyés. Ces données servent uniquement à vous répondre.")}
        </Note>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 4 }}>
          <Text variant="footnote" color={palette.ink500}>
            {t("Vous pouvez retirer votre accord dans Compte.")}
          </Text>
          <TextLink label={t("Politique de confidentialité")} onPress={() => void Linking.openURL(`${SITE_URL}/politique-confidentialite`)} />
        </View>
      </ScrollView>
      <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
        {alreadyGiven && !target ? (
          <BrandButton tone="danger" label={t("Retirer mon accord")} onPress={withdraw} />
        ) : (
          <BrandButton label={t("Accepter et continuer")} onPress={accept} />
        )}
        <BrandButton tone="soft" label={alreadyGiven && !target ? t("Fermer") : t("Pas maintenant")} onPress={() => router.back()} />
      </View>
    </View>
  )
}
