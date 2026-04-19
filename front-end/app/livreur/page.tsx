"use client"

import { useEffect, useEffectEvent, useState } from "react"
import Link from "next/link"
import { Calendar, ClipboardList, DollarSign, Map, Star, Truck, User } from "lucide-react"

import { DeliveryCard } from "@/components/souki/delivery-card"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/useAuth"
import {
  ApiError,
  demarrerLivreurTournee,
  getLivreurTournee,
  TourneeItem,
  TourneeResponse,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const CACHE_KEY = "souki_tournee_today"

type TabType = "list" | "map" | "profile"
type DeliveryStatus = "pending" | "enroute" | "delivered" | "absent"
type PaymentMethod = "cod" | "wallet" | "cmi"
type NoticeTone = "info" | "success" | "error"

interface DeliveryViewItem {
  id: string
  orderNumber: string
  timeSlot: string
  address: string
  clientName: string
  clientPhone: string
  callHref: string | null
  packageCount: number
  amount: number
  paymentMethod: PaymentMethod
  status: DeliveryStatus
  rawStatus: string
}

interface PageNotice {
  tone: NoticeTone
  message: string
}

function readCachedTournee(): TourneeResponse | null {
  if (typeof window === "undefined") {
    return null
  }

  const rawValue = window.localStorage.getItem(CACHE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as TourneeResponse
  } catch {
    window.localStorage.removeItem(CACHE_KEY)
    return null
  }
}

function writeCachedTournee(data: TourneeResponse) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(data))
}

function normalizeBackendStatus(status: string | null | undefined) {
  return (status || "").trim().toUpperCase()
}

function normalizeDeliveryStatus(status: string): DeliveryStatus {
  const normalizedStatus = normalizeBackendStatus(status)

  if (normalizedStatus === "EN_COURS_DE_LIVRAISON" || normalizedStatus === "EN_ROUTE") {
    return "enroute"
  }

  if (normalizedStatus === "LIVRE" || normalizedStatus === "LIVREE" || normalizedStatus === "DELIVERED") {
    return "delivered"
  }

  if (normalizedStatus === "ABSENT") {
    return "absent"
  }

  return "pending"
}

function normalizePaymentMethod(modePaiement: string | null | undefined): PaymentMethod {
  const normalizedMode = (modePaiement || "").trim().toLowerCase()

  if (normalizedMode === "wallet") {
    return "wallet"
  }

  if (normalizedMode === "cmi" || normalizedMode === "card") {
    return "cmi"
  }

  return "cod"
}

function buildCallHref(phone: string | null | undefined) {
  if (!phone) {
    return null
  }

  const sanitizedPhone = phone.replace(/\s+/g, "")
  return sanitizedPhone ? `tel:${sanitizedPhone}` : null
}

function mapTourneeItemToDeliveryView(item: TourneeItem): DeliveryViewItem {
  return {
    id: String(item.commande_id),
    orderNumber: String(item.commande_id),
    timeSlot: item.creneau_livraison || "Non precise",
    address: item.full_address,
    clientName: item.client_phone || item.client_label,
    clientPhone: item.client_phone || "Telephone indisponible",
    callHref: buildCallHref(item.client_phone),
    packageCount: item.colis_count,
    amount: Number(item.montant_total || 0),
    paymentMethod: normalizePaymentMethod(item.mode_paiement),
    status: normalizeDeliveryStatus(item.statut),
    rawStatus: item.statut,
  }
}

function extractHourBounds(timeSlot: string) {
  const matches = timeSlot.match(/\d{1,2}/g)
  if (!matches || matches.length === 0) {
    return []
  }

  return matches.map((match) => Number.parseInt(match, 10)).filter((value) => !Number.isNaN(value))
}

function formatTourneeDate(dateValue?: string) {
  const fallbackDate = new Date()
  const parsedDate = dateValue ? new Date(dateValue) : fallbackDate

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate)
}

function formatTourneeWindow(items: DeliveryViewItem[]) {
  const allBounds = items.flatMap((item) => extractHourBounds(item.timeSlot))
  if (allBounds.length === 0) {
    return null
  }

  const minHour = Math.min(...allBounds)
  const maxHour = Math.max(...allBounds)
  return `${minHour}h00-${maxHour}h00`
}

function computeRemainingTime(items: DeliveryViewItem[]) {
  const activeItems = items.filter((item) => item.status === "pending" || item.status === "enroute")
  if (activeItems.length === 0) {
    return "0h00"
  }

  const allBounds = activeItems.flatMap((item) => extractHourBounds(item.timeSlot))
  if (allBounds.length === 0) {
    return "N/A"
  }

  const latestHour = Math.max(...allBounds)
  const now = new Date()
  const endTime = new Date(now)
  endTime.setHours(latestHour, 0, 0, 0)

  const difference = endTime.getTime() - now.getTime()
  if (difference <= 0) {
    return "0h00"
  }

  const totalMinutes = Math.round(difference / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h${minutes.toString().padStart(2, "0")}`
}

function updateStartedStatuses(response: TourneeResponse): TourneeResponse {
  return {
    ...response,
    tournee_started: true,
    items: response.items.map((item) => {
      const normalizedStatus = normalizeBackendStatus(item.statut)
      if (normalizedStatus === "EN_COURS_DE_LIVRAISON") {
        return item
      }

      if (normalizedStatus === "A_LIVRER" || normalizedStatus === "EN_ATTENTE") {
        return {
          ...item,
          statut: "EN_COURS_DE_LIVRAISON",
        }
      }

      return item
    }),
  }
}

export default function LivreurPage() {
  const { token, isLoading: isAuthLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>("list")
  const [deliveryList, setDeliveryList] = useState<DeliveryViewItem[]>([])
  const [tourneeData, setTourneeData] = useState<TourneeResponse | null>(null)
  const [isOnDuty, setIsOnDuty] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [isTourneeLoading, setIsTourneeLoading] = useState(true)
  const [isStartingTournee, setIsStartingTournee] = useState(false)
  const [beforeSeven, setBeforeSeven] = useState(false)
  const [tourneeStarted, setTourneeStarted] = useState(false)
  const [loadSource, setLoadSource] = useState<"api" | "cache" | null>(null)
  const [notice, setNotice] = useState<PageNotice | null>(null)

  const applyTourneeData = useEffectEvent((response: TourneeResponse, source: "api" | "cache") => {
    setTourneeData(response)
    setDeliveryList(response.items.map(mapTourneeItemToDeliveryView))
    setTourneeStarted(
      response.tournee_started ||
        response.items.some((item) => normalizeBackendStatus(item.statut) === "EN_COURS_DE_LIVRAISON")
    )
    setLoadSource(source)
    setBeforeSeven(false)
  })

  const loadCachedTournee = useEffectEvent((fallbackMessage: string) => {
    const cachedTournee = readCachedTournee()
    if (!cachedTournee) {
      return false
    }

    applyTourneeData(cachedTournee, "cache")
    setNotice({ tone: "info", message: fallbackMessage })
    return true
  })

  useEffect(() => {
    const syncOnlineStatus = () => {
      setIsOffline(!window.navigator.onLine)
    }

    syncOnlineStatus()
    window.addEventListener("online", syncOnlineStatus)
    window.addEventListener("offline", syncOnlineStatus)

    return () => {
      window.removeEventListener("online", syncOnlineStatus)
      window.removeEventListener("offline", syncOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!token) {
      setIsTourneeLoading(false)
      setTourneeData(null)
      setDeliveryList([])
      setLoadSource(null)
      setBeforeSeven(false)
      setNotice({ tone: "error", message: "Connectez-vous pour consulter votre tournee." })
      return
    }

    let isCancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 8000)

    const loadTournee = async () => {
      setIsTourneeLoading(true)
      setNotice(null)

      if (!window.navigator.onLine) {
        const hasCache = loadCachedTournee("Mode hors ligne. Affichage de la derniere tournee enregistree.")
        if (!hasCache) {
          setTourneeData(null)
          setDeliveryList([])
          setLoadSource(null)
          setNotice({ tone: "error", message: "Mode hors ligne et aucune tournee n'est disponible en cache." })
        }
        setIsTourneeLoading(false)
        window.clearTimeout(timeoutId)
        return
      }

      try {
        const response = await getLivreurTournee(token, controller.signal)
        if (isCancelled) {
          return
        }

        writeCachedTournee(response)
        applyTourneeData(response, "api")
      } catch (error) {
        if (isCancelled) {
          return
        }

        if (error instanceof ApiError && error.status === 403) {
          setBeforeSeven(true)
          setTourneeData(null)
          setDeliveryList([])
          setLoadSource(null)
          setTourneeStarted(false)
          setNotice(null)
        } else {
          const isTimeout = error instanceof DOMException && error.name === "AbortError"
          const cacheMessage = isTimeout
            ? "Le chargement a expire. Affichage de la derniere tournee enregistree."
            : "Serveur indisponible. Affichage de la derniere tournee enregistree."
          const hasCache = loadCachedTournee(cacheMessage)

          if (!hasCache) {
            setTourneeData(null)
            setDeliveryList([])
            setLoadSource(null)
            setNotice({
              tone: "error",
              message: isTimeout
                ? "Le chargement a expire et aucune tournee n'est disponible en cache."
                : error instanceof Error
                  ? error.message
                  : "Impossible de charger la tournee.",
            })
          }
        }
      } finally {
        if (!isCancelled) {
          setIsTourneeLoading(false)
        }
        window.clearTimeout(timeoutId)
      }
    }

    void loadTournee()

    return () => {
      isCancelled = true
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [isAuthLoading, token])

  const completedCount = deliveryList.filter((item) => item.status === "delivered" || item.status === "absent").length
  const totalCount = deliveryList.length
  const remainingTime = computeRemainingTime(deliveryList)
  const todayEarnings = deliveryList.filter((item) => item.status === "delivered").length * 10
  const monthEarnings = 1240
  const tourneeWindow = formatTourneeWindow(deliveryList)
  const tourneeTitle = `Tournee du ${formatTourneeDate(tourneeData?.date_jour)}${tourneeWindow ? ` - ${tourneeWindow}` : ""}`

  const handleStatusChange = (id: string, newStatus: "enroute" | "delivered" | "absent") => {
    setDeliveryList((previousList) =>
      previousList.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    )
  }

  const handleStartTournee = async () => {
    if (!token || deliveryList.length === 0 || isStartingTournee) {
      return
    }

    setIsStartingTournee(true)
    setNotice(null)

    try {
      const response = await demarrerLivreurTournee(token)
      const shouldMarkStarted =
        response.updated_count > 0 || response.previous_status === "EN_COURS_DE_LIVRAISON"
      const nextTourneeData = tourneeData ? updateStartedStatuses(tourneeData) : null

      setTourneeStarted(shouldMarkStarted)
      if (shouldMarkStarted) {
        setDeliveryList((previousList) =>
          previousList.map((item) =>
            item.status === "pending" ? { ...item, status: "enroute", rawStatus: "EN_COURS_DE_LIVRAISON" } : item
          )
        )
      }

      if (nextTourneeData && shouldMarkStarted) {
        setTourneeData(nextTourneeData)
        writeCachedTournee(nextTourneeData)
      }

      setNotice({ tone: "success", message: response.message })
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Impossible de demarrer la tournee.",
      })
    } finally {
      setIsStartingTournee(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] max-w-md mx-auto relative">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
              <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <div>
              <span className="font-bold text-[#1E8A3C]">SOUKI</span>
              <span className="text-sm text-[#8A8A8A] ml-1">Driver</span>
            </div>
          </div>
          <button
            onClick={() => setIsOnDuty(!isOnDuty)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              isOnDuty ? "bg-[#4CB84A]/10 text-[#4CB84A]" : "bg-red-100 text-red-600"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", isOnDuty ? "bg-[#4CB84A]" : "bg-red-500")} />
            {isOnDuty ? "En service" : "Hors service"}
          </button>
        </div>

        <div className="mt-3">
          <p className="text-lg font-semibold text-[#3D3D3D]">{tourneeTitle}</p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-[#1E8A3C]">{completedCount}/{totalCount} livraisons</span>
            <span className="text-[#8A8A8A]">Temps restant : {remainingTime}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4CB84A] rounded-full transition-all"
              style={{ width: totalCount === 0 ? "0%" : `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={handleStartTournee}
          disabled={isStartingTournee || deliveryList.length === 0 || tourneeStarted}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1E8A3C] text-white font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isStartingTournee ? <Spinner className="size-5" /> : <Truck className="w-5 h-5" />}
          <span>{tourneeStarted ? "Tournee demarree" : "Demarrer la tournee"}</span>
        </button>
      </header>

      <main className="pb-20 px-4 py-4">
        {loadSource === "cache" && !beforeSeven && (
          <div className="mb-4 p-4 rounded-2xl bg-[#FFF3E0] text-[#8A5A00] text-sm shadow-sm">
            Mode hors ligne actif. La liste affiche la derniere tournee sauvegardee sur cet appareil.
          </div>
        )}

        {notice && !beforeSeven && (
          <div
            className={cn(
              "mb-4 p-4 rounded-2xl text-sm shadow-sm",
              notice.tone === "success" && "bg-[#F0FAF1] text-[#1E8A3C]",
              notice.tone === "info" && "bg-[#FFF3E0] text-[#8A5A00]",
              notice.tone === "error" && "bg-red-50 text-red-600"
            )}
          >
            {notice.message}
          </div>
        )}

        {activeTab === "list" && (
          <>
            {isTourneeLoading ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center">
                <Spinner className="size-6 text-[#1E8A3C]" />
                <p className="font-medium text-[#3D3D3D]">Chargement de votre tournee...</p>
              </div>
            ) : beforeSeven ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <p className="text-xl font-semibold text-[#3D3D3D]">Bonjour, prenez un cafe ☕</p>
                <p className="text-[#8A8A8A] mt-2">
                  Votre tournee s&apos;affichera ici a 7h00.
                </p>
              </div>
            ) : !token ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <p className="text-[#3D3D3D] font-semibold">Votre session livreur est requise.</p>
                <Link href="/login/livreur" className="inline-flex mt-4 px-4 py-2 rounded-xl bg-[#F07C00] text-white font-medium">
                  Se connecter
                </Link>
              </div>
            ) : deliveryList.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <p className="text-[#3D3D3D] font-semibold">Aucune livraison assignee pour le moment.</p>
                <p className="text-[#8A8A8A] mt-2">Revenez un peu plus tard pour verifier votre tournee du jour.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deliveryList.map((delivery, index) => (
                  <DeliveryCard
                    key={delivery.id}
                    id={delivery.id}
                    sequenceNumber={index + 1}
                    orderNumber={delivery.orderNumber}
                    timeSlot={delivery.timeSlot}
                    address={delivery.address}
                    clientName={delivery.clientName}
                    clientPhone={delivery.clientPhone}
                    callHref={delivery.callHref}
                    packageCount={delivery.packageCount}
                    amount={delivery.amount}
                    paymentMethod={delivery.paymentMethod}
                    status={delivery.status}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "map" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="aspect-square bg-gray-100 flex items-center justify-center">
              <div className="text-center p-8">
                <Map className="w-16 h-16 text-[#8A8A8A] mx-auto mb-4" />
                <p className="text-[#8A8A8A]">Carte en cours de chargement...</p>
                <p className="text-sm text-[#8A8A8A] mt-2">
                  Affichage des itineraires de livraison
                </p>
              </div>
            </div>

            <div className="p-4 border-t">
              <h3 className="font-semibold text-[#3D3D3D] mb-3">Prochaines etapes</h3>
              <div className="space-y-2">
                {deliveryList
                  .filter((item) => item.status === "pending" || item.status === "enroute")
                  .slice(0, 3)
                  .map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-[#F0FAF1] rounded-lg">
                      <span className="w-6 h-6 bg-[#1E8A3C] text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#3D3D3D] truncate">{item.address}</p>
                        <p className="text-xs text-[#8A8A8A]">{item.timeSlot}</p>
                      </div>
                    </div>
                  ))}
                {deliveryList.length === 0 && (
                  <p className="text-sm text-[#8A8A8A]">Aucune etape a afficher pour le moment.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-[#1E8A3C] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  M
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#3D3D3D]">Mohammed B.</h2>
                  <p className="text-[#8A8A8A]">Zone Fes-Centre</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn("w-5 h-5", star <= 4 ? "text-[#F5C400] fill-[#F5C400]" : "text-gray-200")}
                    />
                  ))}
                </div>
                <span className="font-bold text-[#3D3D3D]">4.8/5</span>
                <span className="text-sm text-[#8A8A8A]">(156 evaluations)</span>
              </div>

              <div className="p-4 bg-[#F0FAF1] rounded-xl">
                <p className="text-sm text-[#8A8A8A] mb-1">Statut contrat</p>
                <p className="font-semibold text-[#1E8A3C]">Livreur Independant - Zone Fes-Centre</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#F07C00]" />
                Revenus
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#F07C00]/10 rounded-xl">
                  <p className="text-sm text-[#8A8A8A] mb-1">Aujourd&apos;hui</p>
                  <p className="text-2xl font-bold text-[#F07C00]">{todayEarnings} DH</p>
                  <p className="text-xs text-[#8A8A8A]">{completedCount} livraisons x 10 DH</p>
                </div>
                <div className="p-4 bg-[#4CB84A]/10 rounded-xl">
                  <p className="text-sm text-[#8A8A8A] mb-1">Ce mois</p>
                  <p className="text-2xl font-bold text-[#4CB84A]">{monthEarnings} DH</p>
                  <p className="text-xs text-[#8A8A8A]">124 livraisons</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#1E8A3C]" />
                Statistiques
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A8A]">Livraisons totales</span>
                  <span className="font-semibold text-[#3D3D3D]">1,456</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A8A]">Taux de reussite</span>
                  <span className="font-semibold text-[#4CB84A]">98.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A8A]">Temps moyen/livraison</span>
                  <span className="font-semibold text-[#3D3D3D]">12 min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A8A]">Membre depuis</span>
                  <span className="font-semibold text-[#3D3D3D]">Janvier 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A8A]">Source de la tournee</span>
                  <span className="font-semibold text-[#3D3D3D]">
                    {loadSource === "cache" ? "Cache local" : loadSource === "api" ? "API live" : "Indisponible"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A8A]">Connexion</span>
                  <span className={cn("font-semibold", isOffline ? "text-red-600" : "text-[#1E8A3C]")}>
                    {isOffline ? "Hors ligne" : "En ligne"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 px-4 py-2 z-50">
        <div className="flex items-center justify-around">
          {[
            { id: "list" as TabType, icon: ClipboardList, label: "Liste" },
            { id: "map" as TabType, icon: Map, label: "Carte" },
            { id: "profile" as TabType, icon: User, label: "Profil" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors",
                activeTab === tab.id ? "text-[#1E8A3C]" : "text-[#8A8A8A]"
              )}
            >
              <tab.icon className="w-6 h-6" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
