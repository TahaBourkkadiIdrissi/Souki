"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeft, User, Bell, Shield, CreditCard, MapPin, Phone, Mail, Camera, Save, Trash2, LogOut,
  Moon, Sun, Globe, Smartphone, Lock, Eye, EyeOff, Check, ChevronRight, Wallet, Loader2, Copy, ShieldCheck, Sparkles, AlertTriangle, Gift, Share2
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getBlacklistStatus,
  markBlacklistLiftNotificationSeen,
  requestBlacklistLift,
  type BlacklistStatusDTO,
} from "@/lib/api"
import { useProfile } from "@/hooks/useProfile"
import { useNotifications, type NotificationPrefs } from "@/hooks/useNotifications"
import { useSecurity } from "@/hooks/useSecurity"
import { useWallet, type WalletState } from "@/hooks/useWallet"
import { useAuth } from "@/hooks/useAuth"


type Section = "compte" | "notifications" | "securite" | "paiement"
const sections: Section[] = ["compte", "notifications", "securite", "paiement"]
const getSectionFromPath = (pathname: string): Section => {
  const lastSegment = pathname.split("/").filter(Boolean).at(-1)
  return sections.includes(lastSegment as Section) ? (lastSegment as Section) : "compte"
}

type SettingsBootstrapResponse = {
  profile: {
    prenom: string
    nom: string
    email: string
    telephone: string
    photo_url?: string | null
    avatar_url?: string | null
    email_verified: boolean
    address: {
      adresse: string
      ville: string
      code_postal: string
    }
  }
  notifications: NotificationPrefs
  sessions: Array<any>
  wallet: any
}

const moroccanCities = ["Fès", "Casablanca", "Rabat", "Marrakech", "Agadir", "Tanger", "Meknès", "Oujda", "Kénitra", "Tétouan"]
const initialNotif: NotificationPrefs = { email: true, push: true, sms: false, promotions: true, orderUpdates: true, newsletter: false, livraison: true }
const acceptedPhotoTypes = ["image/jpeg", "image/png", "image/webp"]
const maxPhotoSize = 2 * 1024 * 1024

function Toggle({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return <button onClick={() => onCheckedChange(!checked)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none", checked ? "bg-[#1E8A3C]" : "bg-gray-200")}><span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200", checked ? "translate-x-6" : "translate-x-1")} /></button>
}

function SectionCard({ title, children, onSave, saving }: { title: string; children: React.ReactNode; onSave?: () => void; saving?: boolean }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-bold text-[#3D3D3D] text-lg">{title}</h2>
        {onSave && <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#1E8A3C] text-white rounded-xl text-sm font-semibold hover:bg-[#176B2E] transition-colors disabled:opacity-70">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Enregistrer</button>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function dhFromCentimes(c: number) { return `${(c / 100).toFixed(2).replace(".", ",")} DH` }
import { isValidMoroccanPhone, normalizeMoroccanPhone } from "@/lib/phoneValidator"
const isMoroccanPhone = (v: string) => isValidMoroccanPhone(v)
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
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

export default function ParametresPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout, isLoading: isAuthLoading, isAuthenticated, token } = useAuth()
  const profileApi = useProfile()
  const notifApi = useNotifications()
  const securityApi = useSecurity()
  const walletApi = useWallet()
  const { callApi } = profileApi
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bootstrapRequestRef = useRef(false)
  const [activeSection, setActiveSection] = useState<Section>(() => getSectionFromPath(pathname))
  const [darkMode, setDarkMode] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showWalletActivate, setShowWalletActivate] = useState(false)
  const [showWalletPassword, setShowWalletPassword] = useState(false)
  const [showWalletConfirmPassword, setShowWalletConfirmPassword] = useState(false)
  const [showWalletIdModal, setShowWalletIdModal] = useState(false)
  const [walletIdFull, setWalletIdFull] = useState("")
  const [deleteText, setDeleteText] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [personal, setPersonal] = useState({ prenom: "", nom: "", email: "", telephone: "" })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)
  const [address, setAddress] = useState({ adresse: "", ville: moroccanCities[0], code_postal: "" })
  const [notifications, setNotifications] = useState<NotificationPrefs>(initialNotif)
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" })
  const [sessions, setSessions] = useState<Array<any>>([])
  const [walletState, setWalletState] = useState<WalletState | null>(null)
  const [walletCreate, setWalletCreate] = useState({ password: "", confirm_password: "" })
  const [photoUploading, setPhotoUploading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [blacklistStatus, setBlacklistStatus] = useState<BlacklistStatusDTO | null>(null)
  const [showLiftModal, setShowLiftModal] = useState(false)
  const [hideLiftNotification, setHideLiftNotification] = useState(false)
  const [liftMotif, setLiftMotif] = useState("")
  const [liftRequestMessage, setLiftRequestMessage] = useState("")
  const [isSendingLiftRequest, setIsSendingLiftRequest] = useState(false)

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const [copiedReferral, setCopiedReferral] = useState(false)
  const referralCode = user?.profiles?.client?.code_parrainage || ""
  const referralLink =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/login/client?ref=${referralCode}`
      : ""

  const copyReferralCode = async () => {
    if (!referralCode) return
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopiedReferral(true)
      setTimeout(() => setCopiedReferral(false), 2000)
    } catch {
      /* presse-papiers indisponible */
    }
  }

  const shareReferral = async () => {
    if (!referralCode) return
    const message = `Rejoins-moi sur SOUKI avec mon code de parrainage ${referralCode} et reçois un produit offert sur ta 1ère commande livrée !`
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "SOUKI Fresh Market", text: message, url: referralLink })
      } else {
        await navigator.clipboard.writeText(`${message} ${referralLink}`)
        setCopiedReferral(true)
        setTimeout(() => setCopiedReferral(false), 2000)
      }
    } catch {
      /* partage annule par l'utilisateur */
    }
  }

  useEffect(() => {
    setActiveSection(getSectionFromPath(pathname))
  }, [pathname])

  useEffect(() => {
    const load = async () => {
      if (isAuthLoading) {
        return
      }

      if (!isAuthenticated && !token) {
        bootstrapRequestRef.current = false
        setPageLoading(false)
        router.push("/login/client?redirect=/parametres")
        return
      }

      if (bootstrapRequestRef.current) {
        return
      }

      bootstrapRequestRef.current = true

      setPageLoading(true)
      try {
        const data = await callApi<SettingsBootstrapResponse>("/api/user/bootstrap")
        const p = data.profile
        const n = data.notifications
        const s = data.sessions
        const w = data.wallet
        setPersonal({ prenom: p.prenom ?? "", nom: p.nom ?? "", email: p.email ?? "", telephone: p.telephone ?? "" })
        setPhotoUrl(p.photo_url ?? p.avatar_url ?? null)
        setEmailVerified(Boolean(p.email_verified))
        setAddress({ adresse: p.address.adresse ?? "", ville: p.address.ville || moroccanCities[0], code_postal: p.address.code_postal ?? "" })
        setNotifications(n)
        setSessions(s)
        setWalletState(w)
      } catch (e) {
        setErrors((prev) => ({
          ...prev,
          page: e instanceof Error ? e.message : "Impossible de charger vos paramètres",
        }))
        bootstrapRequestRef.current = false
      } finally {
        setPageLoading(false)
      }
    }
    void load()
  }, [
    isAuthLoading,
    isAuthenticated,
    token,
    router,
    callApi,
  ])

  useEffect(() => {
    if (!token || isAuthLoading || !isAuthenticated) {
      setBlacklistStatus(null)
      return
    }

    let isMounted = true
    getBlacklistStatus(token)
      .then((status) => {
        if (isMounted) {
          setBlacklistStatus(status)
        }
      })
      .catch(() => {
        if (isMounted) {
          setBlacklistStatus(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isAuthLoading, isAuthenticated, token])

  const sidebarName = `${personal.prenom} ${personal.nom}`.trim() || "Utilisateur"
  const initialLetter = (personal.nom?.[0] || personal.prenom?.[0] || "U").toUpperCase()

  const onSavePersonal = async () => {
    const nextErrors: Record<string, string> = {}
    if (!isEmail(personal.email)) nextErrors.email = "Email invalide"
    if (!isMoroccanPhone(personal.telephone)) nextErrors.telephone = "Format marocain requis (ex: 0612345678)"
    setErrors(nextErrors); if (Object.keys(nextErrors).length) return
    const normalizedPersonal = { ...personal, telephone: normalizeMoroccanPhone(personal.telephone) }
    try {
      const res = await profileApi.updateProfile(normalizedPersonal)
      if (res.email_changed) setErrors((e) => ({ ...e, email_info: "Un email de vérification a été envoyé" }))
      showSaved()
    } catch (e) { setErrors((v) => ({ ...v, email: e instanceof Error ? e.message : "Erreur" })) }
  }

  const onSaveAddress = async () => { try { await profileApi.updateAddress(address); showSaved() } catch (e) { setErrors((v) => ({ ...v, address: e instanceof Error ? e.message : "Erreur" })) } }
  const onSaveNotifications = async () => { try { await notifApi.updateNotifications(notifications); showSaved() } catch {} }
  const onChangePassword = async () => { try { await securityApi.changePassword(passwords); setPasswords({ current_password: "", new_password: "", confirm_password: "" }); showSaved() } catch (e) { setErrors((v) => ({ ...v, password: e instanceof Error ? e.message : "Erreur" })) } }
  const onDisconnectSession = async (id: number) => { await securityApi.disconnectSession(id); setSessions((prev) => prev.filter((s) => s.id !== id)) }
  const onDisconnectAll = async () => { await securityApi.disconnectAll(); logout(); router.push("/login") }
  const onDeleteAccount = async () => { await securityApi.deleteAccount("SUPPRIMER"); logout(); router.push("/app?page=deleted") }
  const onRequestLift = async () => {
    if (!token) {
      setLiftRequestMessage("Connectez-vous pour envoyer la demande.")
      return
    }

    const motif = liftMotif.trim()
    if (!motif) {
      setLiftRequestMessage("Expliquez la situation avant l'envoi.")
      return
    }

    setIsSendingLiftRequest(true)
    setLiftRequestMessage("")
    try {
      await requestBlacklistLift(token, motif)
      const status = await getBlacklistStatus(token)
      setBlacklistStatus(status)
      setLiftMotif("")
      setShowLiftModal(false)
      setLiftRequestMessage("Demande envoyee.")
    } catch (e) {
      setLiftRequestMessage(e instanceof Error ? e.message : "Impossible d'envoyer la demande.")
    } finally {
      setIsSendingLiftRequest(false)
    }
  }

  const onClickCamera = () => fileInputRef.current?.click()
  const onUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!acceptedPhotoTypes.includes(file.type)) {
      e.target.value = ""
      return setErrors((v) => ({ ...v, photo: "Choisissez une image JPG, PNG ou WEBP." }))
    }
    if (file.size > maxPhotoSize) {
      e.target.value = ""
      return setErrors((v) => ({ ...v, photo: "L'image ne doit pas depasser 2 Mo." }))
    }

    const previousPhotoUrl = photoUrl
    const previewUrl = URL.createObjectURL(file)
    try {
      setErrors((v) => {
        const next = { ...v }
        delete next.photo
        return next
      })
      setPhotoUploading(true)
      setPhotoUrl(previewUrl)
      const response = await profileApi.uploadPhoto(file)
      setPhotoUrl(response.photo_url ?? response.avatar_url ?? previewUrl)
      // Bump photo version so ProfileAvatar / ProfileDropdown re-fetch
      const v = Number(localStorage.getItem("souki_photo_version") || "0") + 1
      localStorage.setItem("souki_photo_version", String(v))
      window.dispatchEvent(new CustomEvent("souki:photo-updated", { detail: { version: v } }))
      showSaved()
    } catch (err) {
      setPhotoUrl(previousPhotoUrl)
      setErrors((v) => ({
        ...v,
        photo: err instanceof Error ? err.message : "Le televersement de l'image a echoue. Reessayez dans un instant.",
      }))
    } finally {
      URL.revokeObjectURL(previewUrl)
      setPhotoUploading(false)
      e.target.value = ""
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
      setErrors((prev) => {
        const next = { ...prev }
        delete next.wallet_password
        delete next.wallet_confirm
        delete next.wallet
        return next
      })
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

  const notifRows = useMemo(() => [
    { key: "email", label: "Notifications par email", desc: "Mises à jour et confirmations par email", icon: Mail },
    { key: "push", label: "Notifications push", desc: "Alertes instantanées sur votre appareil", icon: Smartphone },
    { key: "sms", label: "Notifications SMS", desc: "Messages texte pour les mises à jour importantes", icon: Phone },
    { key: "orderUpdates", label: "Mises à jour des commandes", desc: "Statut de livraison, confirmations", icon: Bell },
    { key: "livraison", label: "Alertes de livraison", desc: "Notifications de passage du livreur", icon: MapPin },
    { key: "promotions", label: "Promotions et offres", desc: "Remises exclusives et offres spéciales", icon: CreditCard },
    { key: "newsletter", label: "Newsletter SOUKI", desc: "Actualités et conseils hebdomadaires", icon: Globe },
  ] as const, [])
  const walletPasswordState = useMemo(() => walletPasswordChecks(walletCreate.password), [walletCreate.password])
  const shouldShowLiftNotification = Boolean(
    blacklistStatus?.last_action === "LIFTED" &&
    !blacklistStatus.lift_notification_seen &&
    !hideLiftNotification
  )

  const acknowledgeLiftNotification = async () => {
    if (!token) {
      setHideLiftNotification(true)
      return
    }

    try {
      await markBlacklistLiftNotificationSeen(token)
      setBlacklistStatus((current) => current ? { ...current, lift_notification_seen: true } : current)
    } catch {
      return
    }
    setHideLiftNotification(true)
  }

  if (pageLoading || isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#1E8A3C] font-semibold">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement des paramètres...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24 md:pb-0">
      <header className="sticky top-0 z-50 hidden bg-white/80 backdrop-blur-md border-b border-gray-100/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] md:block"><div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-20"><div className="flex items-center gap-4"><Link href="/" className="p-2 text-[#3D3D3D] hover:text-[#1E8A3C] hover:bg-[#F0FAF1] rounded-xl transition-colors"><ArrowLeft className="w-5 h-5" /></Link><Link href="/" className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none"><img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} /></div><div className="flex flex-col justify-center"><span className="text-xl font-bold text-[#1E8A3C] leading-none tracking-tight">SOUKI</span><span className="text-[11px] font-medium text-[#8A8A8A] mt-0.5 uppercase tracking-wider">Fresh Market</span></div></Link></div><div><h1 className="text-lg font-bold text-[#3D3D3D]">Paramètres</h1><p className="text-xs text-[#8A8A8A]">Gérez votre compte et vos préférences</p></div></div></div></header>
      <div className="mx-auto max-w-6xl px-4 pt-5 md:hidden">
        <h1 className="text-2xl font-black text-[#1E8A3C]">Paramètres</h1>
        <p className="mt-1 text-sm font-medium text-[#6F8070]">Gérez votre compte et vos préférences.</p>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {saved && <div className="fixed top-24 right-6 z-50 flex items-center gap-2 bg-[#1E8A3C] text-white px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-right-5 duration-300"><Check className="w-4 h-4" />Modifications enregistrées !</div>}
        {errors.page && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errors.page}</div>}
        {blacklistStatus && (blacklistStatus.is_blacklisted || shouldShowLiftNotification) && (
          <div className={cn("mb-6 rounded-2xl border p-4", blacklistStatus.is_blacklisted ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", blacklistStatus.is_blacklisted ? "text-red-600" : "text-[#1E8A3C]")} />
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", blacklistStatus.is_blacklisted ? "text-red-700" : "text-[#1E8A3C]")}>
                  {blacklistStatus.is_blacklisted ? "Votre compte ne peut plus passer de commandes COD" : "Restriction COD levee"}
                </p>
                <p className={cn("mt-1 text-xs", blacklistStatus.is_blacklisted ? "text-red-500" : "text-[#1E8A3C]")}>
                  {blacklistStatus.is_blacklisted ? "Suite a un refus de livraison. Wallet et CMI restent disponibles." : "Vous pouvez a nouveau choisir le paiement a la livraison."}
                </p>
                {blacklistStatus.last_action === "LIFT_REQUESTED" && <p className="mt-2 text-xs font-medium text-amber-600">Demande de levee en attente de decision admin.</p>}
                {blacklistStatus.last_action === "LIFT_REJECTED" && <p className="mt-2 text-xs font-medium text-red-600">Demande refusee. Motif : {blacklistStatus.last_reason}</p>}
                {shouldShowLiftNotification && <p className="mt-2 text-xs font-medium text-[#1E8A3C]">Restriction levee. COD disponible a nouveau.</p>}
                {shouldShowLiftNotification && (
                  <button
                    type="button"
                    onClick={() => void acknowledgeLiftNotification()}
                    className="mt-3 rounded-lg border border-[#1E8A3C] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E8A3C] transition hover:bg-[#F0FAF1]"
                  >
                    J'ai compris
                  </button>
                )}
                {liftRequestMessage && <p className="mt-2 text-xs font-medium text-[#1E8A3C]">{liftRequestMessage}</p>}
                {blacklistStatus.last_action !== "LIFT_REQUESTED" && blacklistStatus.last_action !== "LIFTED" && <button type="button" onClick={() => { setLiftRequestMessage(""); setShowLiftModal(true) }} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">Demander la levee de restriction</button>}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4"><div className="flex items-center gap-4"><div className="relative"><div className="relative w-14 h-14 rounded-xl bg-[#F0FAF1] overflow-hidden flex items-center justify-center font-bold text-[#1E8A3C]">{photoUrl ? <img src={photoUrl} alt={sidebarName} className="w-full h-full object-cover" /> : initialLetter}{photoUploading && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>}</div><button onClick={onClickCamera} className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#1E8A3C] rounded-full flex items-center justify-center text-white shadow-sm hover:bg-[#176B2E] transition-colors"><Camera className="w-3 h-3" /></button><input ref={fileInputRef} onChange={onUploadPhoto} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" /></div><div><p className="font-bold text-[#3D3D3D]">{sidebarName}</p><p className="text-sm text-[#8A8A8A]">{personal.email}</p>{emailVerified && <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-[#F0FAF1] text-[#1E8A3C] rounded-full text-xs font-medium"><Check className="w-3 h-3" /> Vérifié</span>}{errors.photo && <p className="text-xs text-red-500">{errors.photo}</p>}</div></div></div>
            <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">{([{ id: "compte", icon: User, label: "Compte" }, { id: "notifications", icon: Bell, label: "Notifications" }, { id: "securite", icon: Shield, label: "Sécurité" }, { id: "paiement", icon: CreditCard, label: "Paiement" }] as const).map((item) => <button key={item.id} onClick={() => { setActiveSection(item.id); router.push(`/parametres/${item.id}`) }} className={cn("w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 transition-colors", activeSection === item.id ? "bg-[#F0FAF1] text-[#1E8A3C]" : "text-[#3D3D3D] hover:bg-gray-50")}><div className="flex items-center gap-3"><item.icon className="w-4 h-4" /><span className="font-medium text-sm">{item.label}</span></div><ChevronRight className={cn("w-4 h-4 transition-transform", activeSection === item.id && "rotate-90")} /></button>)}</nav>
          </aside>
          <main className="flex-1 space-y-6">
            {activeSection === "compte" && <>
              <SectionCard title="Informations personnelles" onSave={onSavePersonal} saving={profileApi.loading}><div className="grid gap-5 md:grid-cols-2"><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Prénom</label><input value={personal.prenom} onChange={(e) => setPersonal((p) => ({ ...p, prenom: e.target.value }))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors text-[#3D3D3D]" /></div><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Nom</label><input value={personal.nom} onChange={(e) => setPersonal((p) => ({ ...p, nom: e.target.value }))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors text-[#3D3D3D]" /></div><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" /><input value={personal.email} onChange={(e) => setPersonal((p) => ({ ...p, email: e.target.value }))} type="email" className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors text-[#3D3D3D]" /></div>{errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}{errors.email_info && <p className="text-xs text-[#1E8A3C] mt-1">{errors.email_info}</p>}</div><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Téléphone</label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" /><input value={personal.telephone} onChange={(e) => setPersonal((p) => ({ ...p, telephone: e.target.value }))} type="tel" className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors text-[#3D3D3D]" /></div>{errors.telephone && <p className="text-xs text-red-500 mt-1">{errors.telephone}</p>}</div></div></SectionCard>
              <SectionCard title="Adresse de livraison" onSave={onSaveAddress} saving={profileApi.loading}><div className="grid gap-5"><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Adresse</label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" /><input value={address.adresse} onChange={(e) => setAddress((p) => ({ ...p, adresse: e.target.value }))} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors text-[#3D3D3D]" /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Ville</label><select value={address.ville} onChange={(e) => setAddress((p) => ({ ...p, ville: e.target.value }))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors text-[#3D3D3D] appearance-none bg-white">{moroccanCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></div><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Code postal</label><input value={address.code_postal} onChange={(e) => setAddress((p) => ({ ...p, code_postal: e.target.value }))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors text-[#3D3D3D]" /></div></div>{errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}</div></SectionCard>
              <SectionCard title="Préférences d'affichage" onSave={showSaved}><div className="space-y-1"><div className="flex items-center justify-between py-4 border-b border-gray-50"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">{darkMode ? <Moon className="w-4 h-4 text-[#3D3D3D]" /> : <Sun className="w-4 h-4 text-[#F07C00]" />}</div><div><p className="font-medium text-[#3D3D3D] text-sm">Mode sombre</p><p className="text-xs text-[#8A8A8A]">Non fonctionnel pour le moment</p></div></div><Toggle checked={darkMode} onCheckedChange={setDarkMode} /></div><div className="flex items-center justify-between py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><Globe className="w-4 h-4 text-[#3D3D3D]" /></div><div><p className="font-medium text-[#3D3D3D] text-sm">Langue</p><p className="text-xs text-[#8A8A8A]">Non fonctionnel pour le moment</p></div></div><select className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-[#3D3D3D] focus:outline-none focus:border-[#4CB84A] bg-white"><option value="fr">Français</option><option value="ar">Arabe</option><option value="en">English</option></select></div></div></SectionCard>
              {referralCode && (
                <div className="rounded-[28px] border border-[#1E8A3C]/10 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.3),_transparent_38%),linear-gradient(135deg,#165f2e_0%,#1E8A3C_52%,#79d65e_100%)] p-6 text-white shadow-[0_18px_60px_rgba(30,138,60,0.22)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
                      <Gift className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Parrainage</p>
                      <h3 className="text-xl font-bold tracking-tight">Invite tes proches, gagnez chacun un cadeau</h3>
                    </div>
                  </div>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-white/80">
                    Partage ton code avec tes colocataires ou voisins. À leur 1ère commande livrée, vous recevez chacun un crédit sur votre portefeuille Souki.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm sm:flex-1">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/65">Ton code</p>
                        <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-white">{referralCode}</p>
                      </div>
                      <button
                        onClick={copyReferralCode}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/18 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/28"
                      >
                        {copiedReferral ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedReferral ? "Copié" : "Copier"}
                      </button>
                    </div>
                    <button
                      onClick={shareReferral}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#1E8A3C] shadow-sm transition hover:bg-white/90"
                    >
                      <Share2 className="h-4 w-4" />
                      Partager
                    </button>
                  </div>
                </div>
              )}
            </>}
            {activeSection === "notifications" && <SectionCard title="Notifications" onSave={onSaveNotifications} saving={notifApi.loading}><div className="space-y-1">{notifRows.map((row) => <div key={row.key} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-[#F0FAF1] flex items-center justify-center"><row.icon className="w-4 h-4 text-[#1E8A3C]" /></div><div><p className="font-medium text-[#3D3D3D] text-sm">{row.label}</p><p className="text-xs text-[#8A8A8A]">{row.desc}</p></div></div><Toggle checked={notifications[row.key]} onCheckedChange={(v) => setNotifications((p) => ({ ...p, [row.key]: v }))} /></div>)}</div></SectionCard>}
            {activeSection === "securite" && <>
              <SectionCard title="Changer le mot de passe" onSave={onChangePassword} saving={securityApi.loading}><div className="space-y-4 max-w-md"><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Mot de passe actuel</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" /><input type={showPassword ? "text" : "password"} value={passwords.current_password} onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))} className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#3D3D3D]">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Nouveau mot de passe</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" /><input type="password" value={passwords.new_password} onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors" /></div></div><div><label className="block text-sm font-medium text-[#3D3D3D] mb-2">Confirmer le nouveau mot de passe</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" /><input type="password" value={passwords.confirm_password} onChange={(e) => setPasswords((p) => ({ ...p, confirm_password: e.target.value }))} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none transition-colors" /></div>{errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}</div></div></SectionCard>
              <SectionCard title="Sessions actives"><div className="space-y-3">{sessions.map((s) => <div key={s.id} className={cn("flex items-center justify-between p-4 rounded-xl border", s.is_current ? "bg-[#F0FAF1] border-[#4CB84A]/20" : "border-gray-100")}><div className="flex items-center gap-3"><div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", s.is_current ? "bg-[#1E8A3C]" : "bg-gray-100")}><Smartphone className={cn("w-4 h-4", s.is_current ? "text-white" : "text-[#8A8A8A]")} /></div><div><p className="font-medium text-[#3D3D3D] text-sm">{s.device_name || s.browser || "Session"}</p><p className="text-xs text-[#8A8A8A]">{s.location || "Maroc"} - {s.last_active ? "Actif récemment" : "Inconnu"}</p></div></div>{s.is_current ? <span className="text-xs bg-[#1E8A3C] text-white px-2 py-1 rounded-full font-medium">Cet appareil</span> : <button onClick={() => onDisconnectSession(s.id)} className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">Déconnecter</button>}</div>)}</div></SectionCard>
              <div className="bg-red-50 rounded-2xl border-2 border-red-100 overflow-hidden"><div className="px-6 py-4 border-b border-red-100"><h2 className="font-bold text-red-600 text-lg">Zone de danger</h2><p className="text-sm text-red-400">Actions irreversibles pour votre compte</p></div><div className="p-6 space-y-4"><div className="flex items-center justify-between"><div><p className="font-medium text-[#3D3D3D] text-sm">Deconnexion de tous les appareils</p><p className="text-xs text-[#8A8A8A]">Vous serez deconnecte de tous vos appareils</p></div><button onClick={onDisconnectAll} className="flex items-center gap-2 px-4 py-2 border-2 border-gray-200 text-[#3D3D3D] rounded-xl text-sm font-medium hover:border-red-300 hover:text-red-600 transition-colors"><LogOut className="w-4 h-4" />Tout deconnecter</button></div><div className="border-t border-red-100 pt-4 flex items-center justify-between"><div><p className="font-medium text-[#3D3D3D] text-sm">Supprimer le compte</p><p className="text-xs text-[#8A8A8A]">Action permanente et irreversible</p></div><button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"><Trash2 className="w-4 h-4" />Supprimer</button></div></div></div>
            </>}
            {activeSection === "paiement" && <>
              {walletState?.has_wallet ? (
                <div className="rounded-[28px] border border-[#1E8A3C]/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.32),_transparent_36%),linear-gradient(135deg,#165f2e_0%,#1E8A3C_48%,#79d65e_100%)] p-6 text-white shadow-[0_18px_60px_rgba(30,138,60,0.22)]">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
                          <Wallet className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/80">Souki e-wallet</p>
                          <h3 className="text-3xl font-bold tracking-tight">{dhFromCentimes(walletState.balance_centimes || 0)}</h3>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/65">Code portefeuille</p>
                        <p className="mt-2 font-mono text-sm font-semibold tracking-[0.2em] text-white">{walletState.wallet_code_masked ?? "Code indisponible"}</p>
                      </div>
                    </div>
                    <div className="min-w-[260px] rounded-2xl border border-white/16 bg-[#0c2f18]/25 p-4 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <ShieldCheck className="h-4 w-4" />
                        Mot de passe portefeuille distinct
                      </div>
                      <p className="mt-2 text-sm text-white/75">Ce portefeuille est séparé de ton compte SOUKI. Son mot de passe n'est jamais stocké en clair.</p>
                      <p className="mt-4 text-xs text-white/60">Historique</p>
                      {(walletState.transactions || []).length === 0 ? (
                        <div className="mt-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-4 text-sm text-white/80">
                          {walletState.transaction_placeholder}
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {walletState.transactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/12 bg-white/6 px-3 py-3 text-sm">
                              <span>{tx.libelle}</span>
                              <span className="font-semibold">{dhFromCentimes(Math.abs(tx.montant_centimes || 0))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-[#F0E4C8] bg-[radial-gradient(circle_at_top_right,_rgba(255,250,240,0.92),_transparent_36%),linear-gradient(135deg,#fffdf7_0%,#fff3d6_58%,#f8e6b3_100%)] p-6 shadow-[0_20px_65px_rgba(124,98,35,0.12)]">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl space-y-4">
                      <div className="flex items-center gap-3 text-[#7A4F00]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7e0] shadow-sm">
                          <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#B17900]">Souki wallet</p>
                          <h3 className="text-2xl font-black tracking-tight text-[#3D3D3D]">Ach katsenna ? Crée ton portefeuille Souki daba !</h3>
                        </div>
                      </div>
                      <p className="max-w-xl text-sm leading-6 text-[#6E6555]">
                        Active ton portefeuille Souki pour préparer tes futurs paiements en un geste. Ton code portefeuille sera généré une seule fois et ton mot de passe restera séparé de celui du compte.
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
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 p-6">
                <div className="flex items-center gap-3 text-[#3D3D3D]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                    <Lock className="h-5 w-5 text-[#8A8A8A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Paiement par carte — Bientôt disponible</h3>
                    <p className="text-sm text-[#8A8A8A]">Le paiement par carte arrivera prochainement. Aucune action n'est nécessaire pour le moment.</p>
                  </div>
                </div>
              </div>
            </>}
          </main>
        </div>
      </div>
      {showLiftModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h3 className="text-lg font-bold text-[#3D3D3D]">Demande de levee</h3><p className="mt-2 text-sm text-[#8A8A8A]">Expliquez la situation pour que l'admin puisse prendre une decision.</p><textarea value={liftMotif} onChange={(e) => setLiftMotif(e.target.value)} placeholder="Expliquez la situation..." rows={5} className="mt-4 w-full resize-none rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-[#3D3D3D] outline-none transition-colors focus:border-red-300" />{liftRequestMessage && <p className="mt-2 text-xs font-medium text-red-500">{liftRequestMessage}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => { setShowLiftModal(false); setLiftMotif(""); setLiftRequestMessage("") }} disabled={isSendingLiftRequest} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-[#3D3D3D] transition hover:bg-gray-50 disabled:opacity-60">Annuler</button><button type="button" onClick={() => void onRequestLift()} disabled={isSendingLiftRequest || liftMotif.trim().length === 0} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60">{isSendingLiftRequest ? "Envoi..." : "Envoyer la demande"}</button></div></div></div>}
      {showDeleteModal && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-md p-6"><h3 className="font-bold text-lg text-[#3D3D3D]">Confirmer la suppression</h3><p className="text-sm text-[#8A8A8A] mt-2">Tapez SUPPRIMER pour confirmer</p><input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} className="mt-4 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none" /><div className="mt-4 flex gap-2 justify-end"><button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border border-gray-200 rounded-xl">Annuler</button><button disabled={deleteText !== "SUPPRIMER"} onClick={onDeleteAccount} className="px-4 py-2 bg-red-500 text-white rounded-xl disabled:opacity-50">Supprimer</button></div></div></div>}
      {showWalletIdModal && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-lg rounded-3xl border border-[#4CB84A]/30 bg-white p-6 shadow-[0_20px_70px_rgba(30,138,60,0.18)]"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0FAF1] text-[#1E8A3C]"><Wallet className="h-5 w-5" /></div><div><h3 className="font-bold text-[#3D3D3D]">Portefeuille Souki créé</h3><p className="text-sm text-[#8A8A8A]">Ce code complet n'est affiché qu'une seule fois.</p></div></div><div className="mt-5 rounded-2xl border border-gray-200 bg-[#FAFAF8] px-4 py-4"><p className="text-xs uppercase tracking-[0.22em] text-[#8A8A8A]">Code portefeuille</p><p className="mt-2 break-all font-mono text-lg font-semibold tracking-[0.18em] text-[#1E8A3C]">{walletIdFull}</p></div><div className="mt-5 flex flex-wrap justify-end gap-3"><button onClick={() => navigator.clipboard.writeText(walletIdFull)} className="inline-flex items-center gap-2 rounded-xl border border-[#1E8A3C] px-4 py-2 text-[#1E8A3C] transition hover:bg-[#F0FAF1]"><Copy className="h-4 w-4" />Copier le code</button><button onClick={() => setShowWalletIdModal(false)} className="rounded-xl bg-[#1E8A3C] px-4 py-2 text-white transition hover:bg-[#176B2E]">J'ai noté mon code</button></div></div></div>}

    </div>
  )
}
