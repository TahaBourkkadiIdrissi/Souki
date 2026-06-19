"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, Phone, Lock, Users, Truck, ShoppingBag } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { GoogleLoginButton } from "@/components/auth/google-login-button"
import { FarmerAvatar } from "@/components/avatar/farmer-avatar"
import { shouldShowOnboarding } from "@/lib/onboarding"

function PreLoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { login, googleLogin } = useAuth()
  const redirectTarget = searchParams.get("redirect") || "/"
  const switchAccount = searchParams.get("switch") === "1"
  const loggedOut = searchParams.get("logged_out") === "1"

  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [shakeError, setShakeError] = useState(false)

  const roles = [
    {
      title: "Parent",
      description: "Espace parent & famille",
      icon: Users,
      href: "/login/parent",
      emoji: "👨‍👩‍👧",
      gradient: "from-amber-500/10 to-orange-500/10",
      border: "border-amber-200",
      iconColor: "text-amber-600",
    },
    {
      title: "Livreur",
      description: "Gérez vos livraisons",
      icon: Truck,
      href: "/login/livreur",
      emoji: "🚚",
      gradient: "from-blue-500/10 to-indigo-500/10",
      border: "border-blue-200",
      iconColor: "text-blue-600",
    },
  ]

  const withRedirect = (href: string) => {
    const params = new URLSearchParams()
    if (searchParams.get("redirect")) params.set("redirect", searchParams.get("redirect")!)
    if (switchAccount) params.set("switch", "1")
    if (loggedOut) params.set("logged_out", "1")
    const query = params.toString()
    return query ? `${href}?${query}` : href
  }

  const resolvePostLoginRedirect = (nextUser: { default_dashboard?: string }) => {
    if (redirectTarget !== "/") return redirectTarget
    if (shouldShowOnboarding()) return "/onboarding"
    return nextUser.default_dashboard || "/"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!phone.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs.")
      setShakeError(true)
      setTimeout(() => setShakeError(false), 500)
      return
    }
    setLoading(true)
    try {
      let loginId = phone.trim()
      if (loginId.startsWith("0")) {
        loginId = `+212${loginId.substring(1)}`
      } else if (!loginId.startsWith("+")) {
        loginId = `+212${loginId}`
      }
      const nextUser = await login(loginId, password, "CLIENT")
      router.push(resolvePostLoginRedirect(nextUser))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue est survenue."
      setError(message)
      setShakeError(true)
      setTimeout(() => setShakeError(false), 500)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async (credential: string) => {
    setError("")
    try {
      const nextUser = await googleLogin(credential, "CLIENT")
      router.push(resolvePostLoginRedirect(nextUser))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "La connexion Google a échoué."
      setError(message)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#F8FAF9] pb-[env(safe-area-inset-bottom)]">
      {/* ─── Hero Section with animated gradient ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1B4332] via-[#1B4332] to-[#2D6A4F] px-6 pb-20 pt-12 text-center animate-gradient-shift">
        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-6 left-8 text-3xl opacity-20 animate-float-slow" style={{ animationDelay: '0s' }}>🌿</div>
          <div className="absolute top-12 right-10 text-2xl opacity-15 animate-float-slow" style={{ animationDelay: '1s' }}>🍃</div>
          <div className="absolute bottom-12 left-12 text-2xl opacity-15 animate-float-slow" style={{ animationDelay: '2s' }}>🌱</div>
          <div className="absolute bottom-8 right-8 text-3xl opacity-20 animate-float-slow" style={{ animationDelay: '0.5s' }}>☘️</div>
        </div>

        {/* Subtle dot-pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-white p-0.5 shadow-lg shadow-black/20">
              <img
                src="/logo3.png"
                alt="SOUKI"
                className="h-full w-[175%] max-w-none object-cover"
                style={{ objectPosition: "left center" }}
              />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">SOUKI</span>
          </Link>

          {/* Avatar */}
          <div className="mt-5 flex justify-center">
            <FarmerAvatar expression="welcome" size="lg" />
          </div>

          <p className="mx-auto mt-4 max-w-xs text-base font-medium leading-relaxed text-white/80">
            Vos légumes frais, livrés à l&apos;aube 🌅
          </p>
          <p className="mt-1.5 text-sm text-white/50">Du marché de Fès, directement chez vous.</p>
        </div>
      </div>

      {/* ─── Animated Emoji Strip ─── */}
      <div className="relative -mt-5 z-10 overflow-hidden py-2.5">
        <div
          className="flex gap-6 whitespace-nowrap px-4 text-2xl"
          style={{ animation: "souki-scroll-x 18s linear infinite" }}
        >
          {["🍅","🥕","🥦","🍋","🫑","🧅","🥒","🍆","🌽","🥬","🍅","🥕","🥦","🍋","🫑","🧅","🥒","🍆","🌽","🥬"].map((emoji, i) => (
            <span key={i} className="inline-block select-none opacity-70">
              {emoji}
            </span>
          ))}
        </div>
        <style
          dangerouslySetInnerHTML={{
            __html: `@keyframes souki-scroll-x { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`,
          }}
        />
      </div>

      {/* ─── Glassmorphism Card ─── */}
      <div className="relative z-20 -mt-1 flex-1 overflow-y-auto">
        <div className="mx-4 mb-6 rounded-3xl border border-white/60 bg-white/95 px-5 pb-8 pt-7 shadow-xl shadow-black/5 backdrop-blur-xl animate-fade-in-up">
          {/* Welcome heading */}
          <h1 className="text-[22px] font-black text-[#1A1A1A]">Bienvenue 👋</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Connectez-vous pour commander vos produits frais.
          </p>

          {/* Error banner */}
          {error && (
            <div className={`mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ${shakeError ? 'animate-shake' : ''}`}>
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                !
              </span>
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Phone */}
            <div className="animate-fade-in-up-delay-1">
              <label className="mb-1.5 block text-sm font-semibold text-[#1A1A1A]">
                Numéro de téléphone
              </label>
              <div className="flex items-stretch overflow-hidden rounded-2xl border-2 border-gray-200 transition-all duration-200 focus-within:border-[#1E8A3C] focus-within:shadow-[0_0_0_3px_rgba(30,138,60,0.1)]">
                <div className="flex shrink-0 items-center gap-1 border-r border-gray-200 bg-gray-50 px-3 text-sm font-bold text-[#1A1A1A]">
                  <span className="text-lg">🇲🇦</span>
                  <span className="text-[#6B7280]">+212</span>
                </div>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="6XX-XXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-[#1A1A1A] placeholder:text-gray-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="animate-fade-in-up-delay-2">
              <label className="mb-1.5 block text-sm font-semibold text-[#1A1A1A]">Mot de passe</label>
              <div className="relative overflow-hidden rounded-2xl border-2 border-gray-200 transition-all duration-200 focus-within:border-[#1E8A3C] focus-within:shadow-[0_0_0_3px_rgba(30,138,60,0.1)]">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full bg-transparent pl-10 pr-12 text-sm text-[#1A1A1A] placeholder:text-gray-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-[52px] w-full items-center justify-center rounded-full bg-[#1B4332] text-base font-bold text-white shadow-lg shadow-[#1B4332]/25 transition-all active:scale-[0.97] disabled:opacity-60 animate-fade-in-up-delay-3"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Se connecter"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-[#6B7280]">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Google OAuth */}
          <GoogleLoginButton onCredential={handleGoogleLogin} onError={setError} disabled={loading} />

          {/* Sign-up link */}
          <p className="mt-6 text-center text-sm text-[#6B7280]">
            Pas encore inscrit ?{" "}
            <Link
              href={withRedirect("/login/client")}
              className="font-bold text-[#1B4332] underline-offset-2 hover:underline"
            >
              Créer un compte
            </Link>
          </p>
        </div>

        {/* ─── Role Selection Cards ─── */}
        <div className="mx-4 mb-8">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
            Autres profils
          </p>
          <div className="grid grid-cols-2 gap-3">
            {roles.map((role) => (
              <Link
                key={role.href}
                href={withRedirect(role.href)}
                className={`group relative flex flex-col items-center gap-2 rounded-2xl border ${role.border} bg-gradient-to-br ${role.gradient} p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <role.icon className={`h-6 w-6 ${role.iconColor}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-[#1A1A1A]">{role.title}</p>
                  <p className="text-[11px] text-[#6B7280] leading-tight mt-0.5">{role.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PreLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#1B4332]" />}>
      <PreLoginContent />
    </Suspense>
  )
}
