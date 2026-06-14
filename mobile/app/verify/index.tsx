import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import React, { useState } from "react"
import { Alert, Text, View } from "react-native"

import { BrandHeader } from "@/components/souki/BrandHeader"
import { Button } from "@/components/ui/Button"
import { Screen } from "@/components/ui/Screen"
import { TextField } from "@/components/ui/TextField"
import { resendOtp, verifyOtp } from "@/services/api/endpoints"
import { setSecureItem, TOKEN_KEY } from "@/services/secureStorage"

export default function VerifyPage() {
  const router = useRouter()
  const params = useLocalSearchParams<{ login_id?: string }>()
  const [loginId, setLoginId] = useState(params.login_id || "")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const response = await verifyOtp({ login_id: loginId, otp_code: otp })
      await setSecureItem(TOKEN_KEY, response.access_token)
      router.replace((response.default_dashboard || "/") as Href)
    } catch (error) {
      Alert.alert("OTP invalide", error instanceof Error ? error.message : "Erreur API")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <BrandHeader title="Verification OTP" backHref="/login" />
      <View className="gap-5 p-4">
        <Text className="text-sm text-text-muted">Reproduit le flow `/auth/verify-otp` du web.</Text>
        <TextField label="Email ou telephone" value={loginId} onChangeText={setLoginId} />
        <TextField label="Code OTP" keyboardType="number-pad" value={otp} onChangeText={setOtp} />
        <Button loading={loading} onPress={submit}>
          Verifier
        </Button>
        <Button variant="outline" onPress={() => void resendOtp({ login_id: loginId })}>
          Renvoyer le code
        </Button>
      </View>
    </Screen>
  )
}
