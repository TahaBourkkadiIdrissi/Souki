import { useState } from "react"
import { Linking, View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowLeft, ArrowRight, Check, Gift, Lock, Mail, MapPin } from "lucide-react-native"
import { isValidEmail, isValidMoroccanPhone, normalizeMoroccanPhone, passwordIsValid } from "@souki/shared"

import { AuthScreen } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { Note, PasswordRules, TextField } from "@/components/form-fields"
import { MapPicker, type PickedPlace } from "@/components/map-picker"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, register } from "@/lib/api"
import { SITE_URL } from "@/lib/config"
import { palette } from "@/theme"

type Step = 1 | 2 | 3

/**
 * Inscription en 3 etapes (EcranInscription, design system 2027), l'adresse d'abord : c'est
 * elle qui dit si SOUKI peut livrer (Fes uniquement, comme le site). 1 Adresse sur la carte,
 * 2 Informations, 3 Mot de passe ; puis le code a 6 chiffres. Memes champs et memes regles
 * que apps/client/app/login (POST /auth/register).
 */
export default function InscriptionScreen() {
  const router = useRouter()
  const { t, isRtl } = useLocale()
  const [step, setStep] = useState<Step>(1)
  const [place, setPlace] = useState<PickedPlace | null>(null)
  /** Change pour recentrer la carte sur Fes (« Choisir une autre adresse »). */
  const [mapKey, setMapKey] = useState(0)
  const [address, setAddress] = useState("")
  const [addressEdited, setAddressEdited] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  // Code de parrainage facultatif, comme sur le site (?ref=CODE en majuscules).
  const [referralCode, setReferralCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const Arrow = isRtl ? ArrowLeft : ArrowRight

  const onPick = (next: PickedPlace) => {
    setPlace(next)
    // L'adresse suit l'epingle tant qu'elle n'a pas ete retouchee a la main.
    if (!addressEdited) setAddress([next.street, next.area].filter(Boolean).join(", "))
  }

  const backLabel = step === 1 ? t("Connexion") : step === 2 ? t("Adresse") : t("Vos informations")
  const goBack = () => (step === 1 ? router.back() : setStep((step - 1) as Step))

  const checkStep2 = () => {
    const next: Record<string, string> = {}
    if (!email.trim()) next.email = t("Saisissez votre e-mail : il sert à vous connecter.")
    else if (!isValidEmail(email)) next.email = t("Format d'email invalide. Veuillez saisir une adresse email correcte (ex: nom@domaine.ma).")
    if (phone.trim() && !isValidMoroccanPhone(phone)) next.phone = t("Numéro invalide. Format attendu : 06XXXXXXXX, 07XXXXXXXX ou +212XXXXXXXXX")
    setErrors(next)
    if (Object.keys(next).length === 0) setStep(3)
  }

  const submit = async () => {
    if (!place) return
    if (password !== confirm) return setErrors({ confirm: t("Les mots de passe ne correspondent pas.") })
    setErrors({})
    setLoading(true)
    try {
      const result = await register({
        email: email.trim(),
        prenom: firstName.trim() || undefined,
        nom: lastName.trim() || undefined,
        phone: phone.trim() ? normalizeMoroccanPhone(phone) : undefined,
        code_parrainage: referralCode.trim().toUpperCase() || undefined,
        password,
        role: "CLIENT",
        latitude: place.coordinates.latitude,
        longitude: place.coordinates.longitude,
        adresse: address.trim().slice(0, 200) || undefined,
        ville: (place.city || "Fès").slice(0, 100),
      })
      router.replace({
        pathname: "/verification",
        params: { userId: String(result.id), channel: result.verification_channel ?? "", target: result.verification_target ?? "" },
      })
    } catch (caught) {
      setErrors({ form: caught instanceof ApiError ? t(caught.message) : t("Erreur lors de la création du compte.") })
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    const outside = place !== null && !place.inZone
    return (
      <AuthScreen
        backLabel={backLabel}
        onBack={goBack}
        step={{ current: 1, total: 3, label: t("Adresse") }}
        title={t("Où livrer vos courses ?")}
        subtitle={t("Placez l'épingle sur votre porte : le livreur s'en sert pour vous trouver.")}
        dock={
          outside ? (
            <BrandButton tone="soft" icon={MapPin} label={t("Choisir une autre adresse")} onPress={() => {
                setPlace(null)
                setAddressEdited(false)
                setMapKey((key) => key + 1)
              }}
            />
          ) : (
            <BrandButton label={t("Continuer")} icon={Arrow} iconPosition="end" disabled={!place || !address.trim()} onPress={() => setStep(2)} />
          )
        }
      >
        <MapPicker key={mapKey} height={250} onPick={onPick} />
        {outside ? (
          <Note tone="orange">{t("SOUKI livre uniquement à Fès pour l'instant. Choisissez une adresse à Fès.")}</Note>
        ) : place ? (
          <Note icon={Check}>{t("Bonne nouvelle, nous livrons chez vous !")}</Note>
        ) : null}
        <TextField
          label={t("Adresse")}
          icon={MapPin}
          value={address}
          onChangeText={(text) => {
            setAddressEdited(true)
            setAddress(text)
          }}
          placeholder={t("Rue, numéro, quartier")}
          textContentType="fullStreetAddress"
          help={t("Complétez si besoin : immeuble, étage, point de repère.")}
        />
      </AuthScreen>
    )
  }

  if (step === 2) {
    return (
      <AuthScreen
        backLabel={backLabel}
        onBack={goBack}
        step={{ current: 2, total: 3, label: t("Vos informations") }}
        title={t("Faisons connaissance")}
        subtitle={t("Ces informations servent à la livraison et à vous contacter si besoin.")}
        dock={<BrandButton label={t("Continuer")} icon={Arrow} iconPosition="end" onPress={checkStep2} />}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextField label={t("Prénom")} value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="given-name" />
          <TextField label={t("Nom")} value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="family-name" />
        </View>
        <TextField
          label={t("Email")}
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          error={errors.email}
        />
        <TextField
          label={t("Téléphone")}
          optional={t("(optionnel)")}
          prefix="+212"
          value={phone}
          onChangeText={setPhone}
          placeholder="6 12 34 56 78"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          error={errors.phone}
        />
        <TextField
          label={t("Code de parrainage")}
          optional={t("(optionnel)")}
          icon={Gift}
          value={referralCode}
          onChangeText={(text) => setReferralCode(text.toUpperCase())}
          placeholder="K7M2P9"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={10}
          help={t("Le code d'un proche : vous recevez chacun un crédit à votre première commande livrée.")}
        />
        <Note>{t("Nous vous enverrons un code à 6 chiffres pour activer le compte.")}</Note>
      </AuthScreen>
    )
  }

  const ready = passwordIsValid(password) && confirm.length > 0
  return (
    <AuthScreen
      backLabel={backLabel}
      onBack={goBack}
      step={{ current: 3, total: 3, label: t("Sécurité") }}
      title={t("Protégez votre compte")}
      dock={<BrandButton label={loading ? t("Création du compte…") : t("Créer mon compte")} disabled={!ready || loading} onPress={() => void submit()} />}
    >
      <TextField label={t("Mot de passe")} icon={Lock} secure value={password} onChangeText={setPassword} textContentType="newPassword" autoComplete="new-password" />
      <PasswordRules value={password} />
      <TextField
        label={t("Confirmer le mot de passe")}
        icon={Lock}
        secure
        value={confirm}
        onChangeText={setConfirm}
        textContentType="newPassword"
        placeholder={t("Retapez le mot de passe")}
        error={errors.confirm}
      />
      {errors.form ? <Note tone="red">{errors.form}</Note> : null}
      <Text variant="footnote" color={palette.ink500} align="center" style={{ fontSize: 12 }}>
        {t("En créant un compte, vous acceptez les conditions d'utilisation et la ")}
        <Text variant="footnote" weight="bold" color={palette.market700} style={{ fontSize: 12 }} onPress={() => void Linking.openURL(`${SITE_URL}/politique-confidentialite`)}>
          {t("politique de confidentialité")}
        </Text>
        .
      </Text>
    </AuthScreen>
  )
}
