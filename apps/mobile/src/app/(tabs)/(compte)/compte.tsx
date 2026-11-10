import { ActivityIndicator, Alert, Linking, ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import Constants from "expo-constants"
import { Image } from "expo-image"
import {
  Bell,
  CircleHelp,
  Gift,
  Globe,
  Heart,
  Info,
  LogOut,
  MessageCircle,
  MapPin,
  PackageCheck,
  Repeat,
  ShieldCheck,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react-native"

import { BrandButton } from "@/components/brand-button"
import { LanguageSwitch } from "@/components/language-switch"
import { Avatar, SettingsGroup, SettingsRow } from "@/components/settings-group"
import { Text } from "@/components/text"
import { useDockInset } from "@/components/tab-bar"
import { useAuth } from "@/contexts/auth-context"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { useOpenAssistant } from "@/hooks/use-open-assistant"
import { SITE_URL } from "@/lib/config"
import { haptics } from "@/lib/haptics"
import { palette, radius, SCREEN_PADDING, shadows } from "@/theme"

const MASCOT = require("../../../../assets/illustrations/recolte-fermier.svg")

const SITE_PAGES: { path: string; label: string; Icon: LucideIcon }[] = [
  { path: "/a-propos", label: "À propos", Icon: Info },
  { path: "/faq", label: "Questions fréquentes", Icon: CircleHelp },
  { path: "/politique-confidentialite", label: "Politique de confidentialité", Icon: ShieldCheck },
]

/**
 * Ce qu'apporte un compte : uniquement des fonctions qui existent. Le parrainage est montre
 * depuis que son credit se deduit au checkout (site et app), comme sur le site.
 */
const BENEFITS: { Icon: LucideIcon; label: string }[] = [
  { Icon: PackageCheck, label: "Suivre vos commandes et vos livraisons" },
  { Icon: Wallet, label: "Wallet SOUKI : remboursements et crédit déduits de vos commandes" },
  { Icon: ShieldCheck, label: "Signaler un problème sur une commande livrée" },
  { Icon: Gift, label: "Parrainage : un crédit pour vous et pour un proche, à sa première commande livrée" },
]

/**
 * Compte (EcranCompte / EcranProfil, design system 2027). Invite : carte d'accueil avec Souki,
 * « Se connecter » et « Créer un compte », ce qu'apporte un compte. Connecte : photo, nom,
 * e-mail et quartier, Mon compte (profil, adresse, securite, notifications), favoris, langue et
 * « Se déconnecter » (alerte iOS, « Annuler » en gras).
 */
export default function CompteScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const { favoriteIds } = useFavorites()
  const { status, profile, user, signOut } = useAuth()
  const dockInset = useDockInset()
  const openAssistant = useOpenAssistant()
  const version = Constants.expoConfig?.version ?? ""

  const confirmSignOut = () => {
    Alert.alert(t("Se déconnecter ?"), t("Vous pourrez vous reconnecter à tout moment avec votre e-mail ou votre téléphone."), [
      { text: t("Annuler"), style: "cancel", isPreferred: true },
      {
        text: t("Se déconnecter"),
        style: "destructive",
        onPress: () => {
          haptics.remove()
          // Deconnexion choisie : l'ecran d'entree (on peut le fermer et parcourir le marche).
          void signOut().then(() => router.push("/connexion"))
        },
      },
    ])
  }

  const fullName = [profile?.prenom, profile?.nom].filter(Boolean).join(" ")
  const contact = profile?.email || user?.email || profile?.telephone || user?.phone || ""
  const area = profile?.address.ville || ""

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ direction }}
      contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 8, paddingBottom: dockInset, gap: 22 }}
    >
      {status === "loading" ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={palette.market600} />
        </View>
      ) : status === "signedIn" ? (
        <>
          <View style={{ alignItems: "center", gap: 10, paddingTop: 4, paddingBottom: 6 }}>
            <Avatar name={fullName || contact} image={profile?.photo_url} size={84} />
            <Text variant="title2" weight="black" color={palette.ink900} align="center" style={{ fontSize: 22 }}>
              {fullName || t("Mon compte")}
            </Text>
            <Text variant="footnote" weight="semibold" color={palette.ink500} align="center">
              {[contact, area].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <SettingsGroup title={t("Mon compte")}>
            <SettingsRow icon={User} label={t("Profil")} sub={t("Nom, e-mail, téléphone")} onPress={() => router.push("/profil")} />
            <SettingsRow icon={MapPin} label={t("Adresse de livraison")} value={area || undefined} onPress={() => router.push("/adresse")} />
            <SettingsRow icon={ShieldCheck} label={t("Sécurité")} sub={t("Mot de passe, sessions actives")} onPress={() => router.push("/securite")} />
            <SettingsRow icon={Bell} label={t("Notifications")} onPress={() => router.push("/notifications")} />
          </SettingsGroup>
        </>
      ) : (
        <GuestCard onSignIn={() => router.push("/connexion")} onSignUp={() => router.push("/connexion")} />
      )}

      {status === "signedIn" ? (
        <SettingsGroup title={t("Fidélité")}>
          <SettingsRow icon={Wallet} label={t("Wallet SOUKI")} sub={t("Remboursements et crédit offert")} onPress={() => router.push("/wallet")} />
          <SettingsRow icon={Gift} label={t("Parrainage")} sub={t("Invitez un proche")} onPress={() => router.push("/parrainage")} />
          <SettingsRow icon={Repeat} label={t("Abonnements")} sub={t("Vos courses reviennent toutes seules")} onPress={() => router.push("/abonnements")} />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title={t("Mes achats")}>
        <SettingsRow icon={Heart} label={t("Favoris")} value={favoriteIds.length > 0 ? String(favoriteIds.length) : undefined} onPress={() => router.push("/favoris")} />
      </SettingsGroup>

      <SettingsGroup title={t("Préférences")}>
        <SettingsRow icon={Globe} label={t("Langue")} control={<LanguageSwitch />} />
      </SettingsGroup>

      <SettingsGroup title="SOUKI">
        <SettingsRow icon={MessageCircle} label={t("Discuter avec Souki")} sub={t("Horaires, livraison, paiement, réclamation")} onPress={() => openAssistant("chat")} />
        {status === "signedIn" ? (
          <SettingsRow icon={ShieldCheck} label={t("Assistants IA et données")} sub={t("Votre accord pour les assistants IA")} onPress={() => router.push("/accord-ia")} />
        ) : null}
        {/* Developpement seulement (jamais dans l'app publiee) : revoir l'onboarding sans recreer de compte. */}
        {__DEV__ && status === "signedIn" ? (
          <SettingsRow icon={ShieldCheck} label="Revoir l'onboarding (dev)" onPress={() => router.push("/bienvenue?demo=1")} />
        ) : null}
        {SITE_PAGES.map((page) => (
          <SettingsRow key={page.path} icon={page.Icon} label={t(page.label)} external onPress={() => void Linking.openURL(`${SITE_URL}${page.path}`)} />
        ))}
      </SettingsGroup>

      {status === "signedIn" ? (
        <SettingsGroup>
          <SettingsRow icon={LogOut} label={t("Se déconnecter")} danger onPress={confirmSignOut} />
        </SettingsGroup>
      ) : null}

      <Text variant="footnote" color={palette.ink500} align="center">
        {t("SOUKI {version} · Fès, Maroc", { version })}
      </Text>
    </ScrollView>
  )
}

/** Compte invite : Souki accueille, deux actions, et ce qu'apporte un compte. */
function GuestCard({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const { t } = useLocale()
  return (
    <View style={{ padding: 20, gap: 16, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.pale50, alignItems: "center", justifyContent: "center" }}>
          <Image source={MASCOT} style={{ width: 52, height: 60, marginTop: 4 }} contentFit="contain" accessibilityLabel={t("Souki, la mascotte SOUKI")} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" weight="black" color={palette.ink900}>
            {t("Bienvenue chez SOUKI")}
          </Text>
          <Text variant="footnote" color={palette.ink500}>
            {t("Connectez-vous pour commander, suivre vos livraisons et utiliser votre Wallet.")}
          </Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {BENEFITS.map(({ Icon, label }) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon size={18} color={palette.market600} strokeWidth={2.2} />
            <Text variant="footnote" weight="semibold" color={palette.ink700} style={{ flex: 1 }}>
              {t(label)}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <BrandButton label={t("Se connecter")} onPress={onSignIn} />
        <BrandButton tone="soft" label={t("Créer un compte")} onPress={onSignUp} />
      </View>
    </View>
  )
}
