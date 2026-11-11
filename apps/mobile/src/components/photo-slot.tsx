import { ActionSheetIOS, Alert, Pressable, View } from "react-native"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { Camera, X } from "lucide-react-native"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { palette } from "@/theme"

export type PickedPhoto = { uri: string; mimeType: string }

/** Meme plafond que le serveur (claim_photo_storage_service.py). */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const SLOT = 60

/**
 * Emplacement photo (PhotoSlot, design system 2027) : 60 pt, vide (appareil photo + « Photo »)
 * ou miniature. Au toucher : feuille d'actions (prendre une photo, choisir dans Photos, retirer).
 * La photo reste sur le telephone jusqu'a l'envoi ; le serveur la verifie et la nettoie.
 */
export function PhotoSlot({ photo, onChange, title }: { photo: PickedPhoto | null; onChange: (photo: PickedPhoto | null) => void; title: string }) {
  const { t } = useLocale()

  const pick = async (source: "camera" | "library") => {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(t("Accès refusé"), source === "camera" ? t("Autorisez l'appareil photo dans Réglages > SOUKI.") : t("Autorisez l'accès aux photos dans Réglages > SOUKI."))
      return
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.6,
      // JPEG plutot que HEIC : le serveur n'accepte que JPG, PNG et WEBP.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    }
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      Alert.alert(t("Photo trop lourde"), t("La photo ne doit pas dépasser 8 Mo."))
      return
    }
    const mimeType = asset.mimeType && ["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType) ? asset.mimeType : "image/jpeg"
    haptics.selection()
    onChange({ uri: asset.uri, mimeType })
  }

  const open = () => {
    const options = photo
      ? [t("Prendre une photo"), t("Choisir dans Photos"), t("Retirer la photo"), t("Annuler")]
      : [t("Prendre une photo"), t("Choisir dans Photos"), t("Annuler")]
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: photo ? 2 : undefined, tintColor: palette.souki900 },
      (index) => {
        if (index === 0) void pick("camera")
        if (index === 1) void pick("library")
        if (photo && index === 2) {
          haptics.selection()
          onChange(null)
        }
      },
    )
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={photo ? t("Photo ajoutée, modifier") : t("Ajouter une photo")}
      style={({ pressed }) => ({
        width: SLOT,
        height: SLOT,
        borderRadius: 16,
        borderCurve: "continuous",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        backgroundColor: palette.pale50,
        borderWidth: photo ? 0 : 1.5,
        borderStyle: "dashed",
        borderColor: palette.green100,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={{ width: SLOT, height: SLOT }} contentFit="cover" accessibilityIgnoresInvertColors />
          <View style={{ position: "absolute", top: 4, end: 4, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.55)" }}>
            <X size={11} color={palette.white} strokeWidth={3} />
          </View>
        </>
      ) : (
        <>
          <Camera size={20} color={palette.souki900} strokeWidth={2.2} />
          <Text variant="footnote" weight="bold" color={palette.souki900} style={{ fontSize: 11 }}>
            {t("Photo")}
          </Text>
        </>
      )}
    </Pressable>
  )
}
