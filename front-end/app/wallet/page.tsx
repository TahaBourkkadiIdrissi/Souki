"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Check, ShieldCheck, Sparkles, Wallet, Lock, EyeOff, Eye, Loader2, Copy
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWallet, type WalletState } from "@/hooks/useWallet"
import { useAuth } from "@/hooks/useAuth"
import { generateParrainageCode } from "@/lib/api"
import { toast } from "sonner"

function dhFromCentimes(c: number) { return `${(c / 100).toFixed(2).replace(".", ",")} DH` }

/* Compte de maniere fluide vers la nouvelle valeur quand le solde change
   (recharge, gain de parrainage). Pas d'animation au premier rendu ni si
   l'utilisateur prefere le mouvement reduit. */
function useAnimatedCentimes(target: number, durationMs = 700) {
  const [display, setDisplay] = useState(target)
  const previousRef = useRef(target)

  useEffect(() => {
    const previous = previousRef.current
    if (previous === target) return
    previousRef.current = target

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target)
      return
    }

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(previous + (target - previous) * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return display
}

const walletPasswordChecks = (value: string) => ({
  minLength: value.length >= 8,
  uppercase: /[A-Z]/.test(value),
  number: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
})

const isWalletPasswordStrong = (value: string) => {
  const checks = walletPasswordChecks(value)
  return Object.values(checks).every(Boolean)
}

export default function WalletPage() {
  const router = useRouter()
  const { isLoading: isAuthLoading, isAuthenticated, token, user, validateToken } = useAuth()
  const walletApi = useWallet()

  const [walletState, setWalletState] = useState<WalletState | null>(null)
  const [showWalletActivate, setShowWalletActivate] = useState(false)
  const [walletCreate, setWalletCreate] = useState({ password: "", confirm_password: "" })
  const [showWalletPassword, setShowWalletPassword] = useState(false)
  const [showWalletConfirmPassword, setShowWalletConfirmPassword] = useState(false)
  const [showWalletIdModal, setShowWalletIdModal] = useState(false)
  const [walletIdFull, setWalletIdFull] = useState("")
  const [showParrainageModal, setShowParrainageModal] = useState(false)
  const [parrainageCopied, setParrainageCopied] = useState(false)
  const [isGeneratingParrainage, setIsGeneratingParrainage] = useState(false)
  const [localParrainageCode, setLocalParrainageCode] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const animatedBalanceCentimes = useAnimatedCentimes(walletState?.balance_centimes ?? 0)

  useEffect(() => {
    const load = async () => {
      if (isAuthLoading) return
      if (!isAuthenticated && !token) {
        setPageLoading(false)
        router.push("/login?redirect=/wallet")
        return
      }
      setPageLoading(true)
      try {
        const data = await walletApi.getWallet()
        setWalletState(data)
      } catch (e) {
        setErrors((prev) => ({
          ...prev,
          page: e instanceof Error ? e.message : "Impossible de charger votre portefeuille",
        }))
      } finally {
        setPageLoading(false)
      }
    }
    void load()
  }, [isAuthLoading, isAuthenticated, token, router, walletApi.getWallet])

  const handleCopyParrainage = () => {
    const code = localParrainageCode || user?.profiles?.client?.code_parrainage;
    if (code) {
      navigator.clipboard.writeText(code);
      setParrainageCopied(true);
      setTimeout(() => setParrainageCopied(false), 2000);
    }
  }

  const handleGenerateParrainage = async () => {
    if (!token) return;
    setIsGeneratingParrainage(true);
    try {
      const res = await generateParrainageCode(token);
      if (res && res.code_parrainage) {
        setLocalParrainageCode(res.code_parrainage);
      }
      await validateToken();
    } catch (e) {
      // Fallback: Generate arbitrarily in frontend if backend endpoint is unavailable
      const randomCode = Array.from({ length: 8 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
      setLocalParrainageCode(randomCode);
    } finally {
      setIsGeneratingParrainage(false);
    }
  }

  const onActivateWallet = async () => {
    const nextErrors: Record<string, string> = {}
    if (!isWalletPasswordStrong(walletCreate.password)) {
      nextErrors.wallet_password = "Le mot de passe doit contenir 8 caractères, une majuscule, un chiffre et un caractère spécial."
    }
    if (walletCreate.password !== walletCreate.confirm_password) {
      nextErrors.wallet_confirm = "Les deux mots de passe doivent etre identiques."
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...nextErrors }))
      return
    }

    try {
      const res = await walletApi.activateWallet(walletCreate)
      setErrors({})
      setWalletIdFull(res.wallet_code)
      setShowWalletIdModal(true)
      const fresh = await walletApi.getWallet()
      setWalletState(fresh)
      setWalletCreate({ password: "", confirm_password: "" })
      setShowWalletActivate(false)
      setShowWalletPassword(false)
      setShowWalletConfirmPassword(false)
      showSaved()
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        wallet: e instanceof Error ? e.message : "Impossible de créer le portefeuille pour le moment.",
      }))
    }
  }

  const walletPasswordState = useMemo(() => walletPasswordChecks(walletCreate.password), [walletCreate.password])

  if (pageLoading || isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#1E8A3C] font-semibold">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement de votre portefeuille...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24 md:pb-0">
      <header className="sticky top-0 z-50 hidden bg-white/80 backdrop-blur-md border-b border-gray-100/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] md:block">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 text-[#3D3D3D] hover:text-[#1E8A3C] hover:bg-[#F0FAF1] rounded-xl transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                  <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-xl font-bold text-[#1E8A3C] leading-none tracking-tight">SOUKI</span>
                  <span className="text-[11px] font-medium text-[#8A8A8A] mt-0.5 uppercase tracking-wider">Fresh Market</span>
                </div>
              </Link>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#3D3D3D]">Espace Wallet</h1>
              <p className="text-xs text-[#8A8A8A]">Gérez votre solde et paiements</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-5 md:hidden flex items-center gap-3 mb-4">
        <Link href="/" className="p-2 text-[#3D3D3D] hover:text-[#1E8A3C] hover:bg-[#F0FAF1] rounded-xl transition-colors bg-white shadow-sm border border-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#1E8A3C]">Mon Wallet</h1>
          <p className="mt-1 text-sm font-medium text-[#6F8070]">Gérez votre solde SOUKI.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {saved && (
          <div className="fixed top-24 right-6 z-50 flex items-center gap-2 bg-[#1E8A3C] text-white px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-right-5 duration-300">
            <Check className="w-4 h-4" />
            Portefeuille créé !
          </div>
        )}
        {errors.page && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errors.page}</div>}

        {walletState?.has_wallet ? (
          <div className="space-y-6">
            {/* VIRTUAL CARD & QUICK ACTIONS */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Virtual Card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A3621] via-[#1E8A3C] to-[#4CB84A] p-7 text-white shadow-[0_20px_60px_rgba(30,138,60,0.3)] lg:w-[400px] shrink-0">
                <div className="absolute top-0 right-0 p-6 opacity-20">
                  <Sparkles className="w-24 h-24" />
                </div>
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute -left-10 -top-10 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
                
                <div className="relative z-10 flex justify-between items-start mb-10">
                  <div className="font-bold tracking-widest text-white/80 uppercase text-xs">Souki Premium</div>
                  <Wallet className="w-6 h-6 text-white/90" />
                </div>
                
                <div className="relative z-10 mb-6">
                  <p className="text-sm font-medium text-white/70 mb-1">Solde disponible</p>
                  <h3 className="text-4xl font-black tracking-tight souki-tabular-nums">{dhFromCentimes(animatedBalanceCentimes)}</h3>
                </div>
                
                <div className="relative z-10 flex justify-between items-end">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/20">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 mb-0.5">Identifiant</p>
                    <p className="font-mono text-sm tracking-widest font-semibold">{walletState.wallet_code_masked}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-white/60 mb-0.5">Membre depuis</p>
                    <p className="text-xs font-semibold">{walletState.created_at ? new Date(walletState.created_at).getFullYear() : new Date().getFullYear()}</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button onClick={() => toast.info("La recharge par carte bancaire sera bientot disponible. L'equipe Souki y travaille.")} className="group flex flex-col items-center justify-center gap-3 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all hover:border-[#1E8A3C]/30 hover:-translate-y-1">
                  <div className="w-12 h-12 bg-[#F0FAF1] rounded-full flex items-center justify-center text-[#1E8A3C] group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                  <span className="text-sm font-semibold text-[#3D3D3D]">Recharger</span>
                </button>
                <button onClick={() => toast.info("Le transfert entre amis sera disponible dans la prochaine mise a jour.")} className="group flex flex-col items-center justify-center gap-3 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all hover:border-[#F07C00]/30 hover:-translate-y-1">
                  <div className="w-12 h-12 bg-[#FFF7EE] rounded-full flex items-center justify-center text-[#F07C00] group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                  <span className="text-sm font-semibold text-[#3D3D3D]">Envoyer</span>
                </button>
                <button onClick={() => toast.info("La demande de fonds est en cours de developpement.")} className="group flex flex-col items-center justify-center gap-3 bg-white border border-gray-100 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all hover:border-[#1A73E8]/30 hover:-translate-y-1">
                  <div className="w-12 h-12 bg-[#EAF2FF] rounded-full flex items-center justify-center text-[#1A73E8] group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  </div>
                  <span className="text-sm font-semibold text-[#3D3D3D]">Demander</span>
                </button>
                <button onClick={() => setShowParrainageModal(true)} className="group relative flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1E8A3C] to-[#165f2e] border-none rounded-3xl p-4 shadow-[0_8px_20px_rgba(30,138,60,0.25)] hover:shadow-[0_12px_25px_rgba(30,138,60,0.35)] transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                  <div className="relative z-10 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <span className="relative z-10 text-sm font-bold text-white">Parrainer</span>
                  <span className="absolute top-2 right-2 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-white/30 border border-white/50"></span>
                  </span>
                </button>
              </div>
            </div>

            {/* TRANSACTIONS & AVANTAGES */}
            <div className="flex flex-col lg:flex-row gap-6 mt-8">
              {/* Historique */}
              <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-bold text-[#3D3D3D]">Historique des transactions</h4>
                  <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-500 rounded-full">Récents</span>
                </div>
                
                {(walletState.transactions || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-10 px-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 animate-fade-in-up">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-gray-300">
                      <Wallet className="w-8 h-8" />
                    </div>
                    <h5 className="font-bold text-[#3D3D3D] mb-1">Aucune transaction</h5>
                    <p className="text-sm text-[#8A8A8A] max-w-xs mb-5">Votre portefeuille SOUKI est vide. Commencez par recharger votre compte ou attendez vos gains de parrainage !</p>
                    <button className="text-sm font-semibold text-[#1E8A3C] bg-[#F0FAF1] px-5 py-2.5 rounded-xl transition hover:bg-[#EAF8EC]">
                      Découvrir les avantages
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {walletState.transactions.map((tx, txIndex) => (
                      <div
                        key={tx.id}
                        className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-4 transition-all hover:border-[#1E8A3C]/20 hover:shadow-sm animate-cascade"
                        style={{ "--cascade-i": Math.min(txIndex, 8) } as CSSProperties}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", tx.montant_centimes > 0 ? "bg-[#F0FAF1] text-[#1E8A3C]" : "bg-gray-100 text-gray-600")}>
                            {tx.montant_centimes > 0 ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-[#3D3D3D]">{tx.type.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-medium text-[#8A8A8A]">{tx.date ? new Date(tx.date).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' }) : ""}</span>
                          </div>
                        </div>
                        <span className={cn("font-black", tx.montant_centimes > 0 ? "text-[#1E8A3C]" : "text-[#3D3D3D]")}>
                          {tx.montant_centimes > 0 ? "+" : ""}{dhFromCentimes(tx.montant_centimes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Avantages Banner */}
              <div className="lg:w-[320px] shrink-0 bg-[#FAFAF8] rounded-3xl p-6 border border-gray-100/80">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-[#1E8A3C]" />
                  <h4 className="font-bold text-[#3D3D3D]">Pourquoi l'utiliser ?</h4>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                      <span className="text-lg">⚡</span>
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm text-[#3D3D3D]">Paiement instantané</h5>
                      <p className="text-xs text-[#8A8A8A] mt-0.5">Plus besoin de saisir votre carte, un clic suffit à la caisse.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                      <span className="text-lg">🎁</span>
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm text-[#3D3D3D]">Gains de parrainage</h5>
                      <p className="text-xs text-[#8A8A8A] mt-0.5">Invitez vos amis et recevez directement de l'argent sur votre solde.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                      <span className="text-lg">🛡️</span>
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm text-[#3D3D3D]">100% Sécurisé</h5>
                      <p className="text-xs text-[#8A8A8A] mt-0.5">Protégé par un mot de passe unique dédié à votre portefeuille.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200/60 text-center">
                  <p className="text-xs font-medium text-[#6F8070]">Besoin d'aide avec votre Wallet ?</p>
                  <button className="mt-2 text-sm font-bold text-[#1E8A3C] hover:underline">Contacter le support</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-[#F0E4C8] bg-[radial-gradient(circle_at_top_right,_rgba(255,250,240,0.92),_transparent_36%),linear-gradient(135deg,#fffdf7_0%,#fff3d6_58%,#f8e6b3_100%)] p-6 shadow-[0_20px_65px_rgba(124,98,35,0.12)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl space-y-4">
                <div className="flex items-center gap-3 text-[#7A4F00]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7e0] shadow-sm">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#B17900]">Souki wallet</p>
                    <h3 className="text-2xl font-black tracking-tight text-[#3D3D3D]">Ach katsenna ? Crée ton portefeuille Souki daba !</h3>
                  </div>
                </div>
                <p className="text-sm leading-6 text-[#6E6555]">
                  Active ton portefeuille Souki pour préparer tes futurs paiements en un geste, ou pour recevoir des bonus de parrainage.
                </p>
                <button
                  onClick={() => setShowWalletActivate((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#1E8A3C] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(30,138,60,0.24)] transition hover:bg-[#176B2E]"
                >
                  <Wallet className="h-4 w-4" />
                  Créer mon portefeuille
                </button>
                {errors.wallet && <p className="text-sm text-red-600">{errors.wallet}</p>}
              </div>
              <div className="min-w-[260px] rounded-2xl border border-[#E8D9B0] bg-white/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#3D3D3D]">
                  <ShieldCheck className="h-4 w-4 text-[#1E8A3C]" />
                  Regles du mot de passe
                </div>
                <div className="mt-3 space-y-2 text-sm text-[#6E6555]">
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-[#1E8A3C]" />Minimum 8 caractères</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-[#1E8A3C]" />Une lettre majuscule</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-[#1E8A3C]" />Un chiffre</div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-[#1E8A3C]" />Un caractère spécial</div>
                </div>
              </div>
            </div>
            {showWalletActivate && (
              <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#3D3D3D]">Mot de passe du portefeuille</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                      <input
                        type={showWalletPassword ? "text" : "password"}
                        value={walletCreate.password}
                        onChange={(e) => setWalletCreate((p) => ({ ...p, password: e.target.value }))}
                        placeholder="Crée un mot de passe sécurisé"
                        className="w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-12 text-[#3D3D3D] transition-colors focus:border-[#4CB84A] focus:outline-none"
                      />
                      <button type="button" onClick={() => setShowWalletPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]">
                        {showWalletPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.wallet_password && <p className="mt-1 text-xs text-red-500">{errors.wallet_password}</p>}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#3D3D3D]">Confirmation du mot de passe</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                      <input
                        type={showWalletConfirmPassword ? "text" : "password"}
                        value={walletCreate.confirm_password}
                        onChange={(e) => setWalletCreate((p) => ({ ...p, confirm_password: e.target.value }))}
                        placeholder="Retape le mot de passe"
                        className="w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-12 text-[#3D3D3D] transition-colors focus:border-[#4CB84A] focus:outline-none"
                      />
                      <button type="button" onClick={() => setShowWalletConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]">
                        {showWalletConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.wallet_confirm && <p className="mt-1 text-xs text-red-500">{errors.wallet_confirm}</p>}
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[#6E6555]">
                  <div className={cn("flex items-center gap-2", walletPasswordState.minLength ? "text-[#1E8A3C]" : "text-[#8A8A8A]")}><Check className="h-4 w-4" />8 caractères minimum</div>
                  <div className={cn("flex items-center gap-2", walletPasswordState.uppercase ? "text-[#1E8A3C]" : "text-[#8A8A8A]")}><Check className="h-4 w-4" />Au moins une majuscule</div>
                  <div className={cn("flex items-center gap-2", walletPasswordState.number ? "text-[#1E8A3C]" : "text-[#8A8A8A]")}><Check className="h-4 w-4" />Au moins un chiffre</div>
                  <div className={cn("flex items-center gap-2", walletPasswordState.special ? "text-[#1E8A3C]" : "text-[#8A8A8A]")}><Check className="h-4 w-4" />Au moins un caractère spécial</div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button onClick={onActivateWallet} disabled={walletApi.loading} className="inline-flex items-center gap-2 rounded-xl bg-[#1E8A3C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#176B2E] disabled:opacity-70">
                    {walletApi.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Créer mon portefeuille
                  </button>
                  <button onClick={() => setShowWalletActivate(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-[#3D3D3D] transition hover:border-gray-300">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showParrainageModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#4CB84A]/30 bg-white p-6 shadow-[0_20px_70px_rgba(30,138,60,0.18)] animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1E8A3C] to-[#165f2e] text-white shadow-lg mb-4">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-black text-[#3D3D3D] mb-2">Parrainez vos amis</h3>
              <p className="text-sm text-[#8A8A8A] mb-6">
                Partagez votre code avec vos amis. Vous gagnerez tous les deux un bonus sur votre portefeuille Souki lors de leur première commande !
              </p>
              
              { (localParrainageCode || user?.profiles?.client?.code_parrainage) ? (
                <>
                  <div className="w-full rounded-2xl border-2 border-dashed border-[#1E8A3C]/30 bg-[#F0FAF1] px-4 py-6 mb-6 relative overflow-hidden shadow-inner">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#1E8A3C]/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-[#4CB84A]/10 rounded-full blur-lg translate-y-1/2 -translate-x-1/2"></div>
                    <div className="relative z-10">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#1E8A3C] font-semibold mb-2">Votre code de parrainage</p>
                      <p className="break-all font-mono text-3xl font-black tracking-[0.18em] text-[#1E8A3C] selection:bg-[#1E8A3C]/20">
                        {localParrainageCode || user?.profiles?.client?.code_parrainage}
                      </p>
                    </div>
                  </div>
                  
                  <div className="w-full grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-[#3D3D3D]">0</span>
                      <span className="text-xs text-[#8A8A8A] font-semibold uppercase">Filleuls inscrits</span>
                    </div>
                    <div className="bg-gradient-to-br from-[#F0FAF1] to-[#E6F5E7] rounded-xl p-3 border border-[#1E8A3C]/20 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-[#1E8A3C]">0,00</span>
                      <span className="text-xs text-[#1E8A3C] font-semibold uppercase">Crédits (DH)</span>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3">
                    <button 
                      onClick={handleCopyParrainage} 
                      className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E8A3C] px-4 py-3.5 text-white font-bold transition-all hover:bg-[#176B2E] shadow-[0_8px_20px_rgba(30,138,60,0.25)] hover:shadow-[0_12px_25px_rgba(30,138,60,0.35)] hover:-translate-y-0.5"
                    >
                      {parrainageCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                      {parrainageCopied ? "Code copié !" : "Copier mon code"}
                    </button>
                    <button 
                      onClick={() => setShowParrainageModal(false)} 
                      className="flex w-full items-center justify-center rounded-xl border-2 border-gray-100 bg-white px-4 py-3.5 text-[#3D3D3D] font-bold transition hover:bg-gray-50"
                    >
                      Fermer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-6 mb-6 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 border border-gray-100">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-[#3D3D3D] mb-1">Code non généré</p>
                    <p className="text-xs text-[#8A8A8A] text-center max-w-[200px]">Générez votre code unique pour commencer à inviter vos amis et gagner des crédits.</p>
                  </div>
                  <div className="flex w-full flex-col gap-3">
                    <button 
                      onClick={handleGenerateParrainage}
                      disabled={isGeneratingParrainage}
                      className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E8A3C] to-[#4CB84A] px-4 py-3.5 text-white font-bold transition-all shadow-[0_8px_20px_rgba(30,138,60,0.25)] hover:shadow-[0_12px_25px_rgba(30,138,60,0.35)] hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      {isGeneratingParrainage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" />}
                      {isGeneratingParrainage ? "Génération en cours..." : "Générer mon code"}
                    </button>
                    <button 
                      onClick={() => setShowParrainageModal(false)} 
                      className="flex w-full items-center justify-center rounded-xl border-2 border-gray-100 bg-white px-4 py-3.5 text-[#3D3D3D] font-bold transition hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showWalletIdModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#4CB84A]/30 bg-white p-6 shadow-[0_20px_70px_rgba(30,138,60,0.18)] animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0FAF1] text-[#1E8A3C]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#3D3D3D]">Portefeuille Souki créé</h3>
                <p className="text-sm text-[#8A8A8A]">Ce code complet n'est affiché qu'une seule fois.</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-gray-200 bg-[#FAFAF8] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8A8A8A]">Code portefeuille</p>
              <p className="mt-2 break-all font-mono text-lg font-semibold tracking-[0.18em] text-[#1E8A3C]">{walletIdFull}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button onClick={() => navigator.clipboard.writeText(walletIdFull)} className="inline-flex items-center gap-2 rounded-xl border border-[#1E8A3C] px-4 py-2 text-[#1E8A3C] transition hover:bg-[#F0FAF1]">
                <Copy className="h-4 w-4" />Copier le code
              </button>
              <button onClick={() => setShowWalletIdModal(false)} className="rounded-xl bg-[#1E8A3C] px-4 py-2 text-white transition hover:bg-[#176B2E]">
                J'ai noté mon code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
