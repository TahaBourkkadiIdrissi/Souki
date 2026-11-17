import { useCallback, useState } from "react"
import { ActivityIndicator, Alert, Linking, ScrollView, Share, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, MessageCircle, Share2 } from "lucide-react-native"
import { formatDirhams, formatOrderDay, REFERRAL_MESSAGE, referralLink, translate } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Note } from "@/components/form-fields"
import { HowTo, LoyaltyCard, ReferralCode, RulesList, Stats } from "@/components/loyalty-parts"
import { PressableScale } from "@/components/pressable-scale"
import { Avatar } from "@/components/settings-group"
import { useDockInset } from "@/components/tab-bar"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { PARRAINAGE_KEY, useParrainage } from "@/hooks/use-loyalty"
import { ApiError, generateParrainageCode } from "@/lib/api"
import { SITE_URL } from "@/lib/config"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius, scene } from "@/theme"

const WREATH = require("../../../../assets/illustrations/couronne-legumes.webp")

/**
 * Parrainage (EcranWallet > Parrainage, design system 2027 ; regles du site) : en-tete
 * « Invitez un proche, gagnez 15 DH chacun », code en « Bon SOUKI », WhatsApp et partage iOS
 * (`Share.share` montre les vraies applications), compteurs, « Comment ça marche ? »,
 * filleuls (prenom et initiale, comme le site ; « Un proche » sinon) et regles. Le credit arrive a la premiere commande
 * livree du proche, et se deduit au checkout de l'app comme du site.
 */
export default function ParrainageScreen() {
  const router = useRouter()
  const { t, locale, dateLocale, isRtl, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const dockInset = useDockInset()
  const client = useQueryClient()
  const { data, isLoading, refetch } = useParrainage()
  const [generating, setGenerating] = useState(false)
  const Back = isRtl ? ChevronRight : ChevronLeft

  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  const code = data?.code ?? null
  const credit = data?.credit_par_filleul ?? 0
  const creditLabel = formatDirhams(credit)
  const link = code ? referralLink(SITE_URL, code) : ""
  const message = code ? translate(locale, REFERRAL_MESSAGE, { code, credit: creditLabel }) : ""

  const generate = async () => {
    setGenerating(true)
    try {
      await generateParrainageCode()
      haptics.success()
      await client.invalidateQueries({ queryKey: PARRAINAGE_KEY })
    } catch (caught) {
      Alert.alert(t("Impossible de créer votre code. Réessayez dans un instant."), caught instanceof ApiError ? t(caught.message) : undefined)
    } finally {
      setGenerating(false)
    }
  }

  const whatsapp = () => {
    haptics.medium()
    void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`)
  }

  const share = () => {
    void Share.share({ message: `${message} ${link}`, url: link }).catch(() => undefined)
  }

  return (
    <ScrollView style={{ direction, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: dockInset }}>
      {/* En-tete vert nuit */}
      <View style={{ paddingTop: insets.top + 54, paddingHorizontal: 20, paddingBottom: 62, gap: 8, overflow: "hidden", borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero }}>
        <LinearGradient colors={[scene.night950, scene.forest800, scene.market600]} locations={[0, 0.6, 1.3]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        {/* Couronne de legumes du design system, en filigrane dans le coin (decorative). */}
        <Image source={WREATH} contentFit="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", end: -40, bottom: -50, width: 170, height: 170, opacity: 0.45 }} />
        <PressableScale
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("Retour")}
          style={{ position: "absolute", top: insets.top + 6, start: 14, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: scene.glassOnDark, borderWidth: 1, borderColor: scene.glassStroke }}
        >
          <Back size={20} color={scene.white} strokeWidth={2.6} />
        </PressableScale>
        <Text accessibilityRole="header" variant="title1" weight="black" color={scene.white} style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.7 }}>
          {t("Invitez un proche,")}
          {"\n"}
          {t("gagnez")}{" "}
          <Text variant="title1" weight="black" color={palette.yellow400} style={{ fontSize: 28, lineHeight: 34 }}>
            {`${creditLabel || "15"} DH`}
          </Text>{" "}
          {t("chacun")}
        </Text>
        <Text variant="callout" weight="medium" color={palette.mint300} style={{ fontSize: 14, lineHeight: 20 }}>
          {t("Votre proche s'inscrit avec votre code. Dès sa première commande livrée, vous recevez chacun {credit} DH sur votre Wallet SOUKI.", { credit: creditLabel || "15" })}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 14, marginTop: -34 }}>
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={palette.market600} />
          </View>
        ) : code ? (
          <>
            <ReferralCode code={code} credit={credit} />
            <View style={{ gap: 8 }}>
              <BrandButton icon={MessageCircle} label={t("Envoyer sur WhatsApp")} onPress={whatsapp} />
              <BrandButton tone="soft" icon={Share2} label={t("Partager le lien")} onPress={share} />
            </View>
            <Stats
              items={[
                { value: String(data?.convertis ?? 0), label: t("Filleuls crédités") },
                { value: String(data?.en_attente ?? 0), label: t("En attente de 1re livraison") },
                { value: `${formatDirhams(data?.gains_total ?? 0)} DH`, label: t("Gagné") },
              ]}
            />
          </>
        ) : (
          <View style={{ gap: 10, padding: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white }}>
            <Text variant="callout" weight="bold" color={palette.ink900}>
              {t("Vous n'avez pas encore de code de parrainage.")}
            </Text>
            <BrandButton label={generating ? t("Création…") : t("Créer mon code")} disabled={generating} onPress={() => void generate()} />
          </View>
        )}

        <LoyaltyCard title={t("Comment ça marche ?")}>
          <HowTo
            steps={[
              { title: t("Partagez votre code"), detail: t("Par WhatsApp, SMS ou de vive voix.") },
              { title: t("Votre proche s'inscrit"), detail: t("Il saisit votre code à la création de son compte.") },
              { title: t("Première commande livrée"), detail: t("{credit} DH arrivent sur vos deux Wallets SOUKI.", { credit: creditLabel || "15" }) },
            ]}
          />
        </LoyaltyCard>

        {data && data.filleuls.length > 0 ? (
          <LoyaltyCard title={t("Vos filleuls")}>
            {data.filleuls.map((filleul, index) => {
              const converted = Boolean(filleul.converted_at) || filleul.statut.toUpperCase() === "CONVERTI"
              return (
                <View key={`${filleul.created_at ?? ""}-${index}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: palette.line }}>
                  <Avatar name={filleul.prenom || "P"} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text variant="footnote" weight="semibold" color={palette.ink900} style={{ fontSize: 13 }}>
                      {filleul.prenom || t("Un proche")}
                    </Text>
                    {filleul.created_at ? (
                      <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 12 }}>
                        {t("Inscrit le {date}", { date: formatOrderDay(filleul.created_at, dateLocale) ?? "" })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center", backgroundColor: converted ? palette.pale50 : palette.orange50 }}>
                    <Text variant="footnote" weight="heavy" numeric color={converted ? palette.market700 : palette.orange700} style={{ fontSize: 12 }}>
                      {converted ? `+ ${creditLabel} DH` : t("En attente")}
                    </Text>
                  </View>
                </View>
              )
            })}
          </LoyaltyCard>
        ) : null}

        <LoyaltyCard title={t("Bon à savoir")}>
          <RulesList
            rules={[
              t("Le crédit arrive à la première commande livrée de votre proche, pas à l'inscription."),
              t("Un même numéro de téléphone ne peut pas se parrainer lui-même."),
              t("Votre crédit se déduit du montant à payer ; le reste se règle en cash à la livraison."),
            ]}
          />
        </LoyaltyCard>
        {data && data.plafond_filleuls > 0 ? (
          <Note>{t("Jusqu'à {n} proches crédités par compte.", { n: data.plafond_filleuls })}</Note>
        ) : null}
      </View>
    </ScrollView>
  )
}
