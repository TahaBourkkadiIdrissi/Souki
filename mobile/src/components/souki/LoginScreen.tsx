import { Link, useLocalSearchParams, useRouter, type Href } from "expo-router"
import React, { useState } from "react"
import { Alert, Text, View } from "react-native"
import { z } from "zod"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { TextField } from "@/components/ui/TextField"
import { useAuth } from "@/contexts/AuthContext"

const loginSchema = z.object({
  loginId: z.string().min(3, "Identifiant requis"),
  password: z.string().min(6, "Mot de passe requis")
})

export function LoginScreen({
  role,
  title,
  accent = "primary",
  isAdmin = false
}: {
  role: "CLIENT" | "LIVREUR" | "PARENT" | "ADMIN"
  title: string
  accent?: "primary" | "accent"
  isAdmin?: boolean
}) {
  const router = useRouter()
  const params = useLocalSearchParams<{ redirect?: string }>()
  const { login, adminLogin } = useAuth()
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const parsed = loginSchema.safeParse({ loginId, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Formulaire invalide")
      return
    }

    // ── Strict email validation to prevent malformed input ──
    const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    const trimmedId = loginId.trim()
    if (trimmedId.includes("@") && !EMAIL_REGEX.test(trimmedId)) {
      const msg = "Format d'email invalide. Utilisez le format nom@domaine.ma"
      setError(msg)
      Alert.alert("Email invalide", msg)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const user = isAdmin ? await adminLogin(loginId, password) : await login(loginId, password, role)
      const redirect = params.redirect || user.default_dashboard || (role === "LIVREUR" ? "/livreur" : "/")
      router.replace(redirect as Href)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Erreur de connexion"
      setError(message)
      Alert.alert("Connexion impossible", message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <BrandHeader title={title} subtitle="Connectez-vous a votre espace Souki" backHref="/login" />
      <View className="gap-5 px-4 py-8">
        <View className="rounded-xl bg-bg-card p-5">
          <Text className="text-3xl font-extrabold text-text-body">{title}</Text>
          <Text className="mt-2 text-sm leading-5 text-text-muted">
            Meme flow que le web : FastAPI, validation token, session persistante.
          </Text>
        </View>
        <TextField label="Email ou telephone" autoCapitalize="none" value={loginId} onChangeText={setLoginId} />
        <TextField label="Mot de passe" secureTextEntry value={password} onChangeText={setPassword} />
        {error ? <Text className="text-sm font-semibold text-destructive">{error}</Text> : null}
        <Button variant={accent} loading={loading} onPress={submit}>
          Se connecter
        </Button>
        {!isAdmin ? (
          <Link href={`/verify?login_id=${encodeURIComponent(loginId)}`} className="text-center font-semibold text-blue-trust">
            Verifier mon compte par OTP
          </Link>
        ) : null}
      </View>
    </Screen>
  )
}
