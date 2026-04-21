"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Eye, EyeOff, Lock, Mail, Shield, Loader2 } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"

export default function AdminLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { adminLogin } = useAuth()
  const redirectTarget = searchParams.get("redirect") || "/admin"

  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const nextUser = await adminLogin(loginId, password)
      router.push(redirectTarget !== "/admin" ? redirectTarget : nextUser.default_dashboard || "/admin")
    } catch (err: any) {
      setError(err.message || "Connexion admin impossible.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#F5F5F0]">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1E8A3C] via-[#145428] to-[#0F2D16] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-16 left-16 h-40 w-40 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-12 h-48 w-48 rounded-full bg-[#F07C00] blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl shadow-lg overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
              <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <div>
              <span className="text-3xl font-bold text-white">SOUKI</span>
              <span className="text-lg text-white/80 ml-2">Administration</span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
            Acces reserve au back-office.
          </h1>
          <p className="mt-6 text-xl text-white/75">
            Utilisez votre compte staff pour acceder aux operations, aux produits, aux paiements et aux statistiques.
          </p>
        </div>

        <div className="relative z-10 text-white/60 text-sm">
          © 2026 SOUKI Fresh Market
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-[32px] border border-[#DDE7DE] bg-white p-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6E8B73]">Back-office</p>
            <h2 className="mt-2 text-3xl font-bold text-[#223126]">Connexion admin</h2>
            <p className="mt-3 text-sm leading-6 text-[#677669]">
              Aucun acces admin n&apos;est expose sur la page publique. Cette entree est reservee aux comptes autorises.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#334438] mb-2">Email ou Telephone</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="staff@souki.ma ou +212..."
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-[#1E8A3C] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#334438] mb-2">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-2xl focus:border-[#1E8A3C] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1E8A3C] text-white rounded-2xl font-semibold text-lg hover:bg-[#176C2E] transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              Se connecter
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
