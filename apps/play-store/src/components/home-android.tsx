import { Pressable, View } from "react-native"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, ArrowRight, Heart, MapPin, Mic, Moon, Sparkles } from "lucide-react-native"
import { formatCountdown } from "@souki/shared"

import { SearchField } from "@/components/m3"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useOrderHours } from "@/hooks/use-order-hours"
import { haptics } from "@/lib/haptics"
import { DUR_BASE } from "@/lib/motion"
import { getColorScheme, m3, palette, radius, scene, SCREEN_PADDING, sizes, states, withAlpha } from "@/theme"

/** Ville desservie ; l'adresse du compte la précise quand elle est connue. */
export const SERVICE_CITY = "Fès"

/** Dernière heure avant la fermeture (01h00) : en-tête orange. */
const LAST_HOUR_SECONDS = 3600
/** Le soir commence à 21h (heure du Maroc côté serveur, heure de l'appareil pour l'affichage). */
const EVENING_HOUR = 21

export type MarketMoment = "open" | "evening" | "last" | "closed"

/** Moment du marché d'après l'horloge des commandes (serveur) et l'heure : pilote l'en-tête et la carte. */
export function useMarketMoment(): { moment: MarketMoment; countdown: string } {
  const hours = useOrderHours()
  const remaining = hours.hours * 3600 + hours.minutes * 60 + hours.seconds
  const hour = new Date().getHours()
  const moment: MarketMoment = hours.closed ? "closed" : remaining <= LAST_HOUR_SECONDS ? "last" : hour >= EVENING_HOUR || hour < 1 ? "evening" : "open"
  return { moment, countdown: formatCountdown(hours) }
}

/* ---------- En-tête ---------- */

type HomeHeaderProps = {
  moment: MarketMoment
  search: string
  onSearch: (text: string) => void
  onSubmitSearch: () => void
  onVoice: () => void
  onFavorites: () => void
}

/**
 * En-tête de l'accueil (fiche MarketHeader) : lieu de livraison, favoris, salutation et recherche
 * avec micro. Il suit l'horloge du marché : vert le jour, vert nuit le soir et la nuit, orange à
 * l'encre pendant la dernière heure. Coins bas de 32 dp.
 */
export function HomeHeader({ moment, search, onSearch, onSubmitSearch, onVoice, onFavorites }: HomeHeaderProps) {
  const { t, isRtl } = useLocale()
  const { profile } = useAuth()
  const insets = useSafeAreaInsets()
  const last = moment === "last"
  const ink = last ? scene.ink900 : scene.white
  const inkVariant = last ? scene.ink900 : scene.mint300
  const dark = getColorScheme() === "dark"

  const hour = new Date().getHours()
  const firstName = profile?.prenom?.trim()
  const hello = hour >= 5 && hour < 18 ? t("Bonjour") : t("Bonsoir")
  const greeting = firstName ? `${hello} ${firstName}` : hello
  const place = profile?.address?.adresse?.trim() ? `${profile.address.adresse.trim()}, ${profile.address.ville?.trim() || SERVICE_CITY}` : SERVICE_CITY

  const gradient: readonly [string, string, ...string[]] =
    moment === "open"
      ? dark
        ? ["#06190C", "#0C3B22", "#14522A"]
        : [scene.night950, scene.forest800, scene.market600]
      : moment === "last"
        ? [scene.orange500, scene.orange500]
        : [scene.night950, scene.night950]

  return (
    <View style={{ borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero, overflow: "hidden" }}>
      <LinearGradient colors={gradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: SCREEN_PADDING, paddingBottom: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {moment === "closed" ? (
            <View style={{ width: sizes.touchMin, height: sizes.touchMin, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: scene.glassOnDark }}>
              <Moon size={22} color={scene.white} strokeWidth={2} />
            </View>
          ) : null}
          <View accessible accessibilityLabel={t("Livraison à {ville}", { ville: place })} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MapPin size={16} color={inkVariant} strokeWidth={2.2} />
            <Text variant="labelLarge" color={inkVariant} numberOfLines={1} style={{ flexShrink: 1 }}>
              {`${t("Livrer à")} · ${place}`}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.selection()
              onFavorites()
            }}
            accessibilityRole="button"
            accessibilityLabel={t("Mes favoris")}
            android_ripple={{ color: withAlpha(ink, 0.16) }}
            style={{
              width: sizes.touchMin,
              height: sizes.touchMin,
              borderRadius: radius.control,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: last ? "rgba(31, 42, 34, 0.10)" : scene.glassOnDark,
            }}
          >
            <Heart size={22} color={ink} strokeWidth={2} />
          </Pressable>
        </View>
        <Text accessibilityRole="header" variant="displaySmall" color={ink} numberOfLines={2} style={{ textAlign: isRtl ? "right" : "left" }}>
          {greeting}
        </Text>
        <SearchField
          value={search}
          onChangeText={onSearch}
          onSubmitEditing={onSubmitSearch}
          // La recherche se fait dans l'onglet Produits : le champ y emmène directement, clavier compris.
          onFocus={onSubmitSearch}
          showSoftInputOnFocus={false}
          caretHidden
          onVoice={onVoice}
          onHero={moment === "open" || moment === "last"}
          placeholder={t("Chercher un légume, un fruit…")}
          accessibilityLabel={t("Rechercher, aussi en darija")}
          style={moment === "open" || moment === "last" ? undefined : { backgroundColor: "rgba(255, 255, 255, 0.10)" }}
        />
      </View>
    </View>
  )
}

/* ---------- Assistants ---------- */

/** Deux assistants juste sous l'en-tête (cartes compactes) : commande vocale et panier intelligent. */
export function AssistantRow({ onVoice, onSmart }: { onVoice: () => void; onSmart: () => void }) {
  const { t } = useLocale()
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: SCREEN_PADDING }}>
      <AssistantCard
        dark
        icon={<Mic size={24} color={scene.voiceCyan} strokeWidth={2.2} />}
        title={t("Dicter ma liste")}
        detail={t("En darija ou en français")}
        onPress={onVoice}
      />
      <AssistantCard
        icon={<Sparkles size={24} color={m3.motion} strokeWidth={2} />}
        title={t("Panier intelligent")}
        detail={t("Votre semaine en un geste")}
        onPress={onSmart}
      />
    </View>
  )
}

function AssistantCard({ dark = false, icon, title, detail, onPress }: { dark?: boolean; icon: React.ReactNode; title: string; detail: string; onPress: () => void }) {
  const titleColor = dark ? scene.white : m3.onSurface
  const detailColor = dark ? scene.mint300 : m3.onSurfaceVariant
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      android_ripple={{ color: withAlpha(dark ? scene.voiceCyan : m3.primary, states.pressed + 0.04) }}
      style={{
        flex: 1,
        minHeight: 104,
        padding: 14,
        gap: 4,
        justifyContent: "space-between",
        borderRadius: radius.card,
        overflow: "hidden",
        backgroundColor: dark ? scene.forest700 : palette.white,
        borderWidth: dark ? 0 : 1,
        borderColor: m3.outlineVariant,
      }}
    >
      {icon}
      <View style={{ gap: 2, marginTop: 12 }}>
        <Text variant="titleSmall" color={titleColor} numberOfLines={2}>
          {title}
        </Text>
        <Text variant="bodySmall" color={detailColor} numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </Pressable>
  )
}

/* ---------- Carte « Marché du jour » ---------- */

/**
 * L'horloge du service (fiche MarketCard) : sur-titre avec point d'état, compte à rebours en
 * chiffres tabulaires qui roulent (séparateurs atténués), échéance, flèche. Carte claire le jour,
 * vert nuit le soir et quand le marché est fermé. TalkBack lit l'état une fois, pas chaque seconde.
 */
export function MarketCard({ moment, countdown, onPress }: { moment: MarketMoment; countdown: string; onPress: () => void }) {
  const { t, isRtl } = useLocale()
  const reducedMotion = useReducedMotion()
  const night = moment === "evening" || moment === "closed"
  const surface = night ? scene.night950 : palette.white
  const ink = night ? scene.white : m3.onSurface
  const inkVariant = night ? scene.mint300 : m3.onSurfaceVariant
  const dot = moment === "last" ? scene.orange500 : moment === "closed" ? scene.yellow400 : scene.fresh500
  const eyebrow = moment === "closed" ? t("Marché fermé") : moment === "last" ? t("Dernière heure") : moment === "evening" ? t("Marché du soir") : t("Marché du jour")
  const caption = moment === "closed" ? t("avant l'ouverture, à {heure}", { heure: "08:00" }) : t("avant la fermeture, à {heure}", { heure: "01:00" })
  const Arrow = isRtl ? ArrowLeft : ArrowRight
  const parts = countdown.split(":")

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${moment === "closed" ? t("Ouverture à {heure}", { heure: "08:00" }) : t("Fermeture à {heure}", { heure: "01:00" })}`}
      accessibilityHint={moment === "last" ? t("Ouvre le panier") : t("Ouvre les produits")}
      android_ripple={{ color: withAlpha(night ? scene.white : m3.onSurface, states.pressed) }}
      style={{
        marginHorizontal: SCREEN_PADDING,
        padding: 20,
        gap: 4,
        borderRadius: radius.feature,
        overflow: "hidden",
        backgroundColor: surface,
        borderWidth: night ? 0 : 1,
        borderColor: m3.outlineVariant,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <Text variant="eyebrow" color={moment === "last" ? m3.tertiary : inkVariant}>
          {eyebrow}
        </Text>
      </View>
      <Animated.View
        key={moment}
        entering={reducedMotion ? undefined : FadeIn.duration(DUR_BASE)}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ flexDirection: "row", alignItems: "baseline", direction: "ltr", alignSelf: isRtl ? "flex-end" : "flex-start", marginTop: 4 }}
      >
        {parts.map((part, index) => (
          <View key={index} style={{ flexDirection: "row", alignItems: "baseline" }}>
            {index > 0 ? (
              <Text variant="priceHero" color={withAlpha(ink, 0.3)} style={{ marginHorizontal: 1 }}>
                :
              </Text>
            ) : null}
            <Text variant="priceHero" color={ink} maxFontSizeMultiplier={1.4}>
              {part}
            </Text>
          </View>
        ))}
      </Animated.View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="bodyMedium" color={inkVariant} style={{ flex: 1 }}>
          {caption}
        </Text>
        <Arrow size={22} color={ink} strokeWidth={2} />
      </View>
    </Pressable>
  )
}
