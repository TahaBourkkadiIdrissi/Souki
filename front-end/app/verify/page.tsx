"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import {
  AlertCircle,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { API_BASE_URL } from "@/lib/api"

const RESEND_DELAY_SECONDS = 60

function OTPVerificationForm({
  userId,
  channel,
  target,
}: {
  userId: number
  channel: string
  target?: string
}) {
  const router = useRouter()
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_DELAY_SECONDS)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])

  const channelLabel = useMemo(
    () => (channel === "phone" ? "par telephone" : "par email"),
    [channel]
  )

  const ChannelIcon = channel === "phone" ? Smartphone : Mail
  const normalizedOtp = otp.replace(/\D/g, "").slice(0, 6)

  const handleVerify = async () => {
    if (normalizedOtp.length !== 6) {
      setError("Saisissez le code OTP a 6 chiffres.")
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          channel,
          code: normalizedOtp,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "La verification a echoue.")
      }

      if (data.access_token) {
        localStorage.setItem("token", data.access_token)
        window.dispatchEvent(
          new CustomEvent("auth-token-changed", {
            detail: { token: data.access_token },
          })
        )
      }

      setMessage(data.message || "Code valide avec succes.")
      window.setTimeout(() => router.push(data.default_dashboard || "/"), 500)
    } catch (err: any) {
      setError(err.message || "La verification a echoue.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          channel,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Impossible de renvoyer le code.")
      }

      setMessage(data.message || "Un nouveau code a ete envoye.")
      setCountdown(data.resend_available_in_seconds || RESEND_DELAY_SECONDS)
      setOtp("")
    } catch (err: any) {
      setError(err.message || "Impossible de renvoyer le code.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="rounded-[28px] border border-[#E4EAE5] bg-white p-6 shadow-xl shadow-[#1E8A3C]/5 sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0FAF1] text-[#1E8A3C]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6E8B73]">
            Verification du compte
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#233127]">Code OTP a 6 chiffres</h2>
          <p className="mt-2 text-sm leading-6 text-[#66756B]">
            Entrez le code envoye {channelLabel}
            {target ? ` sur ${target}` : ""}.
          </p>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#F8FBF8] px-4 py-3 ring-1 ring-[#E3ECE5]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1E8A3C] ring-1 ring-[#E3ECE5]">
          <ChannelIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#314137]">
            {channel === "phone" ? "Validation par SMS / WhatsApp" : "Validation par email"}
          </p>
          <p className="text-xs text-[#7B8B80]">
            Le compte restera inactif tant que le code n&apos;est pas confirme.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(value) => {
              setOtp(value.replace(/\D/g, "").slice(0, 6))
              if (error) setError("")
            }}
            pattern={REGEXP_ONLY_DIGITS}
            containerClassName="gap-2"
            className="justify-center"
          >
            <InputOTPGroup className="gap-2">
              <InputOTPSlot index={0} className="h-12 w-12 rounded-2xl border border-[#DCE7DE] text-lg font-semibold" />
              <InputOTPSlot index={1} className="h-12 w-12 rounded-2xl border border-[#DCE7DE] text-lg font-semibold" />
              <InputOTPSlot index={2} className="h-12 w-12 rounded-2xl border border-[#DCE7DE] text-lg font-semibold" />
              <InputOTPSlot index={3} className="h-12 w-12 rounded-2xl border border-[#DCE7DE] text-lg font-semibold" />
              <InputOTPSlot index={4} className="h-12 w-12 rounded-2xl border border-[#DCE7DE] text-lg font-semibold" />
              <InputOTPSlot index={5} className="h-12 w-12 rounded-2xl border border-[#DCE7DE] text-lg font-semibold" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {message && (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{message}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleVerify}
          disabled={loading || normalizedOtp.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#176C2E] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          Verifier le code
        </button>

        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-dashed border-[#D9E6DB] px-4 py-4 text-sm text-[#617065] sm:flex-row">
          <p>
            Vous n&apos;avez rien recu ?
            {countdown > 0
              ? ` Renvoyez un nouveau code dans ${countdown}s.`
              : " Vous pouvez demander un nouveau code maintenant."}
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="inline-flex items-center gap-2 font-semibold text-[#1E8A3C] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Renvoyer le code
          </button>
        </div>
      </div>
    </div>
  )
}

function VerifyContent() {
  const searchParams = useSearchParams()
  const userId = Number(searchParams.get("userId") || "0")
  const channel = searchParams.get("channel") || "email"
  const target = searchParams.get("target") || ""

  const isValidPayload = Number.isFinite(userId) && userId > 0

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-24 left-20 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-20 right-14 h-56 w-56 rounded-full bg-[#F5C400]/30 blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl shadow-lg overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
              <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <div>
              <span className="text-3xl font-bold text-white">SOUKI</span>
              <span className="text-lg text-white/80 ml-2">Fresh Market</span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-sm">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight text-balance">
            Derniere etape avant l&apos;activation.
          </h1>
          <p className="text-xl text-white/85 max-w-md leading-8">
            Verifiez votre moyen de contact pour activer votre compte SOUKI et finaliser la creation de votre acces.
          </p>
        </div>

        <div className="relative z-10 text-white/70 text-sm">
          © 2026 SOUKI Fresh Market
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center bg-[#FCFDFC] px-6 py-12 lg:px-12 xl:px-20">
        <div className="mx-auto w-full max-w-xl">
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
              </div>
              <span className="text-xl font-bold text-[#1E8A3C]">SOUKI Fresh Market</span>
            </Link>
          </div>

          {isValidPayload ? (
            <OTPVerificationForm userId={userId} channel={channel} target={target} />
          ) : (
            <div className="rounded-[28px] border border-red-200 bg-white p-8 shadow-lg">
              <h2 className="text-2xl font-bold text-[#2E3A31]">Lien de verification invalide</h2>
              <p className="mt-3 text-sm leading-6 text-[#617065]">
                Les informations de verification sont incompletes. Revenez a l&apos;ecran d&apos;inscription pour demander un nouveau code OTP.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex rounded-2xl bg-[#1E8A3C] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#176C2E]"
              >
                Retour a la connexion
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#1E8A3C]" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
