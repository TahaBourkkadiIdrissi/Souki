"use client"

import { FormEvent, Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react"

import { PasswordStrength } from "@/components/souki/password-strength"
import { API_BASE_URL } from "@/lib/api"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!token) {
      setError("Ce lien de réinitialisation est incomplet.")
      return
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Utilisez au moins 8 caractères, une majuscule et un chiffre.")
      return
    }
    if (password !== confirmation) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: password,
          confirm_password: confirmation,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(" ")
          : data.detail
        throw new Error(detail || "La réinitialisation a échoué.")
      }
      setSuccess(true)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "La réinitialisation a échoué."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-black/5">
      <Link href="/login/client" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#1A4F8A] hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Retour à la connexion
      </Link>

      <h1 className="text-2xl font-bold text-[#3D3D3D]">Nouveau mot de passe</h1>
      <p className="mt-3 text-sm leading-6 text-[#6F6F6F]">
        Choisissez un nouveau mot de passe pour votre compte SOUKI.
      </p>

      {success ? (
        <div className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
          <CheckCircle2 className="mb-3 h-7 w-7" />
          <p className="font-semibold">Mot de passe réinitialisé</p>
          <p className="mt-2 text-sm leading-6">Toutes vos anciennes sessions ont été déconnectées.</p>
          <Link href="/login/client" className="mt-5 inline-flex rounded-xl bg-[#1E8A3C] px-5 py-3 text-sm font-semibold text-white">
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-[#3D3D3D]">Nouveau mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A8A8A]" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 py-3 pl-12 pr-12 outline-none transition-colors focus:border-[#4CB84A]"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A]">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-[#3D3D3D]">Confirmer le mot de passe</label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition-colors focus:border-[#4CB84A]"
            />
          </div>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-xl bg-[#1E8A3C] py-3.5 font-semibold text-white shadow-lg shadow-[#1E8A3C]/20 transition-colors hover:bg-[#166E2B] disabled:opacity-60">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enregistrer le mot de passe"}
          </button>
        </form>
      )}
    </section>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F6F4] px-6 py-12">
      <Suspense fallback={<Loader2 className="h-7 w-7 animate-spin text-[#1E8A3C]" />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  )
}
