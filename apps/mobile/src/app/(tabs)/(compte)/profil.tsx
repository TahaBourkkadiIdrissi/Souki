import { useState } from "react"
import { ActionSheetIOS, ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Camera, Mail } from "lucide-react-native"
import { isValidEmail, isValidMoroccanPhone, normalizeMoroccanPhone } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Note, TextField } from "@/components/form-fields"
import { Avatar } from "@/components/settings-group"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, updateProfile, uploadProfilePhoto } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette } from "@/theme"

/** Limite du serveur (MAX_AVATAR_SIZE_BYTES). */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

/** Numero affiche sans l'indicatif (le champ montre « +212 » en prefixe). */
function localPhone(value: string): string {
  return value.startsWith("+212") ? value.slice(4) : value
}

/**
 * Profil (EcranProfil, design system 2027) : photo, prenom, nom, e-mail avec la pastille
 * « Vérifié », telephone, « Enregistrer » colle en bas (PUT /api/user/profile, comme le site).
 * La photo se change en touchant l'avatar : appareil photo ou Photos, recadrage carre, envoi
 * en JPEG (POST /api/user/profile/photo, 2 Mo au plus).
 */
export default function ProfilScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const { profile, refresh } = useAuth()
  const [firstName, setFirstName] = useState(profile?.prenom ?? "")
  const [lastName, setLastName] = useState(profile?.nom ?? "")
  const [email, setEmail] = useState(profile?.email ?? "")
  const [phone, setPhone] = useState(localPhone(profile?.telephone ?? ""))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photo, setPhoto] = useState<string | null>(profile?.photo_url ?? null)

  const pickPhoto = async (source: "camera" | "library") => {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(t("Accès refusé"), source === "camera" ? t("Autorisez l'appareil photo dans Réglages > SOUKI.") : t("Autorisez l'accès aux photos dans Réglages > SOUKI."))
      return
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      // JPEG plutot que HEIC : le serveur n'accepte que JPG, PNG et WEBP.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    }
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      Alert.alert(t("Photo trop lourde"), t("L'image ne doit pas depasser 2 Mo."))
      return
    }
    const mimeType = asset.mimeType && ["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType) ? asset.mimeType : "image/jpeg"
    setUploading(true)
    try {
      const response = await uploadProfilePhoto(asset.uri, mimeType)
      setPhoto(response.photo_url)
      haptics.success()
      await refresh()
    } catch (caught) {
      haptics.error()
      Alert.alert(t("Envoi de la photo impossible."), caught instanceof ApiError ? t(caught.message) : t("Vérifiez votre connexion internet."))
    } finally {
      setUploading(false)
    }
  }

  const choosePhoto = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: t("Photo de profil"), options: [t("Prendre une photo"), t("Choisir dans Photos"), t("Annuler")], cancelButtonIndex: 2, tintColor: palette.souki900 },
      (index) => {
        if (index === 0) void pickPhoto("camera")
        if (index === 1) void pickPhoto("library")
      },
    )
  }

  const save = async () => {
    const next: Record<string, string> = {}
    if (!isValidEmail(email)) next.email = t("Format d'email invalide. Veuillez saisir une adresse email correcte (ex: nom@domaine.ma).")
    if (!isValidMoroccanPhone(phone)) next.phone = t("Numéro invalide. Format attendu : 06XXXXXXXX, 07XXXXXXXX ou +212XXXXXXXXX")
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    try {
      await updateProfile({ prenom: firstName.trim(), nom: lastName.trim(), email: email.trim(), telephone: normalizeMoroccanPhone(phone) })
      await refresh()
      haptics.success()
      router.back()
    } catch (caught) {
      setErrors({ form: caught instanceof ApiError ? t(caught.message) : t("Enregistrement impossible. Vérifiez votre connexion internet.") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ alignItems: "center", paddingVertical: 6 }}>
          <Pressable onPress={choosePhoto} disabled={uploading} accessibilityRole="button" accessibilityLabel={t("Changer la photo de profil")} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <Avatar name={firstName || email} image={photo} size={104} />
            <View style={{ position: "absolute", bottom: 0, end: 0, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.souki900, borderWidth: 3, borderColor: colors.background }}>
              {uploading ? <ActivityIndicator size="small" color={palette.white} /> : <Camera size={16} color={palette.white} strokeWidth={2.4} />}
            </View>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextField label={t("Prénom")} value={firstName} onChangeText={setFirstName} textContentType="givenName" />
          <TextField label={t("Nom")} value={lastName} onChangeText={setLastName} textContentType="familyName" />
        </View>
        <TextField
          label={t("Email")}
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          verified={profile?.email_verified && email === profile.email ? t("Vérifié") : undefined}
          error={errors.email}
        />
        <TextField label={t("Téléphone")} prefix="+212" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" error={errors.phone} />
        {errors.form ? <Note tone="red">{errors.form}</Note> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
        <BrandButton label={saving ? t("Enregistrement…") : t("Enregistrer")} disabled={saving} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  )
}
