"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Truck } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"

export default function LoginLivreur() {
  const { login } = useAuth()
  const router = useRouter()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await login(identifier, password, "LIVREUR")
      router.replace("/livreur")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Connexion impossible")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-[100dvh] bg-[#F7FAF6] lg:grid-cols-[minmax(420px,0.95fr)_1.05fr]">
      <section className="relative hidden min-h-[100dvh] overflow-hidden bg-[linear-gradient(145deg,#176B2E_0%,#1E8A3C_55%,#4CB84A_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div aria-hidden="true" className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 -right-12 h-96 w-96 rounded-full bg-[#F6B323]/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-[0_16px_45px_-22px_rgba(20,48,27,0.65)]">
            <Image src="/logo3.png" alt="" width={96} height={56} className="h-full w-[175%] max-w-none object-cover" style={{ objectPosition: "left center" }} />
          </span>
          <div>
            <p className="text-2xl font-black leading-none">SOUKI</p>
            <p className="mt-1 text-sm font-semibold text-white/75">Espace livreur</p>
          </div>
        </div>

        <div className="relative z-[1] max-w-xl">
          <div className="relative mx-auto mb-4 aspect-square w-[min(72%,360px)]">
            <Image src="/livreur/livreur_moto-west.png" alt="Livreur Souki transportant un panier de légumes frais" fill priority sizes="360px" className="object-contain drop-shadow-[0_28px_28px_rgba(20,48,27,0.34)]" />
          </div>
          <h1 className="text-4xl font-black leading-tight text-balance xl:text-5xl">Chaque panier arrive frais et à l’heure.</h1>
          <p className="mt-4 max-w-lg text-base font-medium leading-7 text-white/80">Connectez-vous pour consulter votre tournée, suivre vos livraisons et valider chaque remise.</p>
        </div>

        <div className="relative flex items-center gap-3 text-sm font-semibold text-white/80">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          Accès sécurisé réservé aux livreurs Souki
        </div>
      </section>

      <section className="relative flex items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_right,rgba(76,184,74,0.18),transparent_62%)] lg:hidden" />
        <div className="relative w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-sm">
              <Image src="/logo3.png" alt="" width={84} height={48} className="h-full w-[175%] max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </span>
            <div>
              <p className="text-xl font-black leading-none text-[#1E8A3C]">SOUKI</p>
              <p className="mt-1 text-xs font-semibold text-[#6F8070]">Espace livreur</p>
            </div>
          </div>

          <div className="mb-7">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF8EC] text-[#1E8A3C]">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-3xl font-black text-[#264129]">Connexion livreur</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#6F8070]">Utilisez les identifiants fournis par l’équipe Souki.</p>
          </div>

          <form onSubmit={submit} className="space-y-5 rounded-[28px] border border-[#DDE9DE] bg-white p-6 shadow-[0_26px_70px_-46px_rgba(30,65,41,0.5)] sm:p-8">
            <label className="block">
              <span className="text-sm font-bold text-[#344D38]">Email ou téléphone</span>
              <span className="relative mt-2 block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#718575]" aria-hidden="true" />
                <input
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="min-h-12 w-full rounded-2xl border-2 border-[#DDE7DE] bg-[#FBFDF9] py-3 pl-12 pr-4 text-[#264129] outline-none transition-colors placeholder:text-[#7C897E] focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10"
                  placeholder="livreur@souki.io"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-[#344D38]">Mot de passe</span>
              <span className="relative mt-2 block">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#718575]" aria-hidden="true" />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-2xl border-2 border-[#DDE7DE] bg-[#FBFDF9] py-3 pl-12 pr-12 text-[#264129] outline-none transition-colors placeholder:text-[#7C897E] focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10"
                  placeholder="Votre mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#5F735F] transition-colors hover:bg-[#EAF8EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A3C]"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </span>
            </label>

            {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

            <button type="submit" disabled={busy} className="min-h-12 w-full rounded-2xl bg-[#1E8A3C] px-5 font-bold text-white shadow-[0_16px_34px_-20px_rgba(30,138,60,0.75)] transition-colors hover:bg-[#176B2E] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs font-medium leading-5 text-[#718575]">Un problème d’accès ? Contactez votre responsable logistique Souki.</p>
        </div>
      </section>
    </main>
  )
}
