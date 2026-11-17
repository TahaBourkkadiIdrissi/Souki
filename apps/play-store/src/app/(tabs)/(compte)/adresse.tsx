import { useState } from "react"
import { KeyboardAvoidingView, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChevronLeft, ChevronRight, House, MapPin, Truck } from "lucide-react-native"

import { BrandButton } from "@/components/brand-button"
import { Note, TextField } from "@/components/form-fields"
import { MapPicker, type PickedPlace } from "@/components/map-picker"
import { PressableScale } from "@/components/pressable-scale"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, updateAddress } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius } from "@/theme"

/** Hauteur de la feuille d'adresse posee sur la carte. */
const SHEET_HEIGHT = 380

/**
 * Adresse de livraison (EcranProfil > Adresse, design system 2027) : carte plein ecran,
 * epingle fixe, « Me localiser », et feuille avec l'adresse et le complement. L'adresse est
 * enregistree en texte comme sur le site (PUT /api/user/address) ; la carte la remplit et
 * verifie qu'elle est bien a Fes.
 */
export default function AdresseScreen() {
  const router = useRouter()
  const { t, isRtl, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { profile, refresh } = useAuth()
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [address, setAddress] = useState(profile?.address.adresse ?? "")
  const [edited, setEdited] = useState(Boolean(profile?.address.adresse))
  const [complement, setComplement] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const Back = isRtl ? ChevronRight : ChevronLeft
  const outside = place !== null && !place.inZone

  const onPick = (next: PickedPlace) => {
    setPlace(next)
    if (!edited) setAddress([next.street, next.area].filter(Boolean).join(", "))
  }

  const save = async () => {
    if (!address.trim()) return setError(t("Saisissez votre adresse."))
    setError(null)
    setSaving(true)
    try {
      const full = [address.trim(), complement.trim()].filter(Boolean).join(" — ")
      await updateAddress({ adresse: full, ville: place?.city || profile?.address.ville || "Fès", code_postal: place?.postalCode || profile?.address.code_postal || "" })
      await refresh()
      haptics.success()
      router.back()
    } catch (caught) {
      setError(caught instanceof ApiError ? t(caught.message) : t("Enregistrement impossible. Vérifiez votre connexion internet."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction }}>
      {/* La carte s'arrete sous le haut de la feuille : l'epingle, au centre, est sur l'adresse lue. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: SHEET_HEIGHT - 40 }}>
        <MapPicker full onPick={onPick} />
      </View>
      <PressableScale
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t("Retour")}
        style={{ position: "absolute", top: insets.top + 8, start: 14, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.78)", boxShadow: "0 6px 16px -8px rgba(10, 40, 20, 0.4)" }}
      >
        <Back size={22} color={palette.ink900} strokeWidth={2.6} />
      </PressableScale>

      <KeyboardAvoidingView behavior="padding" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <View
          style={{
            gap: 12,
            paddingTop: 22,
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopLeftRadius: radius.hero,
            borderTopRightRadius: radius.hero,
            backgroundColor: colors.background,
            boxShadow: "0 -16px 30px -24px rgba(10, 40, 20, 0.45)",
          }}
        >
          <View style={{ position: "absolute", top: 9, alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: palette.line }} />
          <Text accessibilityRole="header" variant="title2" color={palette.ink900}>
            {t("Adresse de livraison")}
          </Text>
          <TextField
            icon={MapPin}
            value={address}
            onChangeText={(text) => {
              setEdited(true)
              setAddress(text)
            }}
            placeholder={t("Rue, numéro, quartier")}
            textContentType="fullStreetAddress"
            error={error}
          />
          <TextField icon={House} value={complement} onChangeText={setComplement} placeholder={t("Immeuble, étage, point de repère")} />
          {outside ? (
            <Note tone="orange">{t("SOUKI livre uniquement à Fès pour l'instant. Choisissez une adresse à Fès.")}</Note>
          ) : (
            <Note icon={Truck}>{t("Livraison entre 8h et 15h, à Fès uniquement.")}</Note>
          )}
          <BrandButton label={saving ? t("Enregistrement…") : t("Enregistrer l'adresse")} disabled={saving || outside} onPress={() => void save()} />
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}
