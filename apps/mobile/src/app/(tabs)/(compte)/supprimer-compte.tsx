import { useState } from "react"
import { KeyboardAvoidingView, Linking, ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check, Trash2, Truck, Wallet } from "lucide-react-native"
import { formatDirhams, isOrderFinished } from "@souki/shared"

import { TextLink } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { Note, TextField } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useWallet } from "@/hooks/use-loyalty"
import { useOrders } from "@/hooks/use-orders"
import { ApiError, deleteAccount } from "@/lib/api"
import { SITE_URL } from "@/lib/config"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius } from "@/theme"

/** Mot a taper pour activer le bouton (DELETE /api/user/account exige la meme confirmation). */
const CONFIRMATION = "SUPPRIMER"

/** Commande encore a livrer : la suppression attend (le livreur a besoin de l'adresse). */
const IN_PROGRESS = ["EN_ATTENTE", "CONFIRMEE", "VERROUILLEE", "EN_ATTENTE_LIVREUR", "REFUS_LIVREUR", "A_LIVRER", "PLANIFIEE", "EN_ROUTE"]

/**
 * Suppression du compte dans l'app, comme Apple l'exige (regle 5.1.1(v)) : ecran dedie, ce qui
 * est supprime et ce qui est garde, solde du Wallet perdu, commande en cours qui bloque,
 * saisie de SUPPRIMER pour activer le bouton rouge. Le back-end anonymise le compte : l'e-mail
 * et le telephone redeviennent libres pour un nouveau compte.
 */
export default function SupprimerCompteScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { forget } = useAuth()
  const { orders } = useOrders()
  const wallet = useWallet()
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const pending = orders.find((order) => !isOrderFinished(order.statut) && IN_PROGRESS.includes((order.statut ?? "").toUpperCase()))
  const balance = (wallet.data?.balance_centimes ?? 0) / 100

  const remove = async () => {
    setError(null)
    setDeleting(true)
    try {
      await deleteAccount()
      haptics.remove()
      await forget()
      router.dismissTo("/compte")
    } catch (caught) {
      haptics.error()
      setError(caught instanceof ApiError ? t(caught.message) : t("Suppression impossible. Vérifiez votre connexion internet."))
      setDeleting(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text variant="body" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
          {t("Votre compte SOUKI et vos informations personnelles seront supprimés.")}
        </Text>
        <Note tone="red">{t("Action permanente et irréversible : le compte ne pourra pas être récupéré.")}</Note>

        <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white }}>
          <Text variant="eyebrow" color={palette.ink500} style={{ fontSize: 12 }}>
            {t("Ce qui se passe")}
          </Text>
          {[
            t("Nom, e-mail, téléphone, adresses, photo et mot de passe sont effacés."),
            t("Vos abonnements sont arrêtés et vous êtes déconnecté de tous vos appareils."),
            t("Vous pourrez recréer un compte avec le même e-mail ou le même numéro."),
            t("Vos anciennes commandes sont gardées sans votre nom, pour la comptabilité."),
          ].map((line) => (
            <View key={line} style={{ flexDirection: "row", gap: 8 }}>
              <Check size={16} color={palette.market600} strokeWidth={2.6} style={{ marginTop: 2 }} />
              <Text variant="footnote" color={palette.ink700} style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        {pending ? (
          <Note tone="orange" icon={Truck}>
            {t("Votre commande N-{id} est en cours. Annulez-la ou attendez sa livraison, puis supprimez votre compte.", { id: pending.id })}
          </Note>
        ) : null}
        {balance > 0 ? (
          <Note tone="orange" icon={Wallet}>
            {t("Votre Wallet contient encore {montant} DH. Ce montant sera perdu : utilisez-le sur une commande avant de supprimer votre compte.", { montant: formatDirhams(balance) })}
          </Note>
        ) : null}

        <TextField
          label={t("Tapez SUPPRIMER pour confirmer")}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          error={error}
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Text variant="footnote" color={palette.ink500}>
            {t("Une question avant de partir ?")}
          </Text>
          <TextLink label={t("Consulter la FAQ")} onPress={() => void Linking.openURL(`${SITE_URL}/faq`)} />
        </View>
      </ScrollView>
      <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
        <BrandButton
          tone="danger"
          icon={Trash2}
          label={deleting ? t("Suppression…") : t("Supprimer mon compte")}
          disabled={typed.trim() !== CONFIRMATION || deleting || Boolean(pending)}
          onPress={() => void remove()}
        />
        <BrandButton tone="soft" label={t("Annuler")} onPress={() => router.back()} />
      </View>
    </KeyboardAvoidingView>
  )
}
