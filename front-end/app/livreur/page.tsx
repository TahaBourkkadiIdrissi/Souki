"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DollarSign,
  Map as MapIcon,
  MapPin,
  Navigation,
  Package,
  Phone,
  Star,
  Truck,
  User,
} from "lucide-react"
import type { LineLayerSpecification } from "mapbox-gl"
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox"

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
const MAPBOX_STYLE = "mapbox://styles/zmarou/cmo758hgx002m01qveoyp7e5c"
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  ""
const MOROCCO_BOUNDS: [[number, number], [number, number]] = [[-17, 20], [-1, 36]]
const FES_START_COORDINATE: [number, number] = [-5.0003, 34.0331]
const DEFAULT_MAP_VIEW = {
  longitude: FES_START_COORDINATE[0],
  latitude: FES_START_COORDINATE[1],
  zoom: 11,
}
const ROUTE_LAYER: Omit<LineLayerSpecification, "source"> = {
  id: "tournee-route-line",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#1E8A3C",
    "line-width": 4,
    "line-opacity": 0.88,
  },
}

type TabType = "list" | "map" | "profile"
type DeliveryStatus = "pending" | "enroute" | "delivered" | "absent"
type PaymentMethod = "cod" | "wallet" | "cmi"
type NoticeTone = "info" | "success" | "error"

interface DeliveryViewItem {
  id: string
  stepNumber: number
  orderNumber: string
  timeSlot: string
  address: string
  neighborhood: string | null
  clientName: string
  clientPhone: string
  callHref: string | null
  packageCount: number
  amount: number
  paymentMethod: PaymentMethod
  status: DeliveryStatus
  rawStatus: string
  lat: number | null
  lng: number | null
}

interface PageNotice {
  tone: NoticeTone
  message: string
}

function normalizeCoordinate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return null
    }

    const parsedValue = Number(trimmedValue)
    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function normalizeTourneeItem(item: TourneeItem): TourneeItem {
  return {
    ...item,
    lat: normalizeCoordinate(item.lat ?? item.latitude),
    lng: normalizeCoordinate(item.lng ?? item.longitude),
  }
}

function normalizeTourneeResponse(response: TourneeResponse): TourneeResponse {
  return {
    ...response,
    items: Array.isArray(response.items) ? response.items.map(normalizeTourneeItem) : [],
  }
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
    return normalizeTourneeResponse(JSON.parse(rawValue) as TourneeResponse)
  } catch {
    window.localStorage.removeItem(CACHE_KEY)
    return null
  }
}

function writeCachedTournee(data: TourneeResponse) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeTourneeResponse(data)))
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

function mapTourneeItemToDeliveryView(item: TourneeItem, index: number): DeliveryViewItem {
  return {
    id: String(item.commande_id),
    stepNumber: index + 1,
    orderNumber: String(item.commande_id),
    timeSlot: item.creneau_livraison || "Non precise",
    address: item.full_address,
    neighborhood: item.neighborhood,
    clientName: item.client_phone || item.client_label,
    clientPhone: item.client_phone || "Telephone indisponible",
    callHref: buildCallHref(item.client_phone),
    packageCount: item.colis_count,
    amount: Number(item.montant_total || 0),
    paymentMethod: normalizePaymentMethod(item.mode_paiement),
    status: normalizeDeliveryStatus(item.statut),
    rawStatus: item.statut,
    lat: item.lat,
    lng: item.lng,
  }
}

function hasCoordinates(item: DeliveryViewItem): item is DeliveryViewItem & { lat: number; lng: number } {
  return (
    typeof item.lat === "number" &&
    Number.isFinite(item.lat) &&
    typeof item.lng === "number" &&
    Number.isFinite(item.lng)
  )
}

function isActiveDelivery(item: DeliveryViewItem) {
  return item.status === "pending" || item.status === "enroute"
}

function formatPaymentMethodLabel(paymentMethod: PaymentMethod) {
  if (paymentMethod === "wallet") {
    return "Wallet"
  }

  if (paymentMethod === "cmi") {
    return "CMI"
  }

  return "Especes"
}

function formatAmount(amount: number) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(amount)} DH`
}

function getDeliveryNeighborhood(delivery: DeliveryViewItem) {
  const normalizedNeighborhood = delivery.neighborhood?.trim()
  if (normalizedNeighborhood) {
    return normalizedNeighborhood
  }

  const firstAddressSegment = delivery.address.split(",")[0]?.trim()
  return firstAddressSegment || "Quartier non precise"
}

function buildNavigationHref(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
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
  const router = useRouter()
  const { token, isLoading: isAuthLoading, isAuthenticated, can } = useAuth()
  const hasLivreurAccess = can("livreur.dashboard.access")
  const mapRef = useRef<MapRef | null>(null)
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
    const normalizedResponse = normalizeTourneeResponse(response)

    setTourneeData(normalizedResponse)
    setDeliveryList(normalizedResponse.items.map(mapTourneeItemToDeliveryView))
    setTourneeStarted(
      normalizedResponse.tournee_started ||
        normalizedResponse.items.some((item) => normalizeBackendStatus(item.statut) === "EN_COURS_DE_LIVRAISON")
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

    if (!isAuthenticated || !hasLivreurAccess) {
      router.replace("/login/livreur?redirect=/livreur")
    }
  }, [hasLivreurAccess, isAuthenticated, isAuthLoading, router])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!token || !hasLivreurAccess) {
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
  }, [hasLivreurAccess, isAuthLoading, token])

  const mappableDeliveries = deliveryList.filter(hasCoordinates)
  const activeDeliveries = deliveryList.filter(isActiveDelivery)
  const nextDelivery = activeDeliveries[0] ?? null
  const futureDeliveries = activeDeliveries.slice(1)
  const nextDeliveryWithCoordinates = nextDelivery && hasCoordinates(nextDelivery) ? nextDelivery : null
  const nextDeliveryIndex = nextDelivery ? deliveryList.findIndex((item) => item.id === nextDelivery.id) : -1
  const previousMappableDelivery =
    nextDeliveryIndex > 0 ? deliveryList.slice(0, nextDeliveryIndex).reverse().find(hasCoordinates) ?? null : null
  const routeStartCoordinates = previousMappableDelivery
    ? ([previousMappableDelivery.lng, previousMappableDelivery.lat] as [number, number])
    : ([FES_START_COORDINATE[0], FES_START_COORDINATE[1]] as [number, number])
  const routeCoordinates = nextDeliveryWithCoordinates
    ? [routeStartCoordinates, [nextDeliveryWithCoordinates.lng, nextDeliveryWithCoordinates.lat] as [number, number]]
    : []
  const routeGeoJson = {
    type: "FeatureCollection" as const,
    features:
      routeCoordinates.length > 1
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: routeCoordinates,
              },
            },
          ]
        : [],
  }
  const activeMissingCoordinatesCount = activeDeliveries.filter((item) => !hasCoordinates(item)).length
  const nextNavigationHref = nextDeliveryWithCoordinates
    ? buildNavigationHref(nextDeliveryWithCoordinates.lat, nextDeliveryWithCoordinates.lng)
    : null
  const mapViewportKey = nextDeliveryWithCoordinates
    ? `${nextDeliveryWithCoordinates.id}:${nextDeliveryWithCoordinates.lat}:${nextDeliveryWithCoordinates.lng}:${routeStartCoordinates[0]}:${routeStartCoordinates[1]}`
    : mappableDeliveries.map((item) => `${item.id}:${item.lat}:${item.lng}`).join("|")
  const isMapboxConfigured = MAPBOX_TOKEN.length > 0

  const focusMapOnDelivery = useEffectEvent(() => {
    if (!mapRef.current) {
      return
    }

    if (nextDeliveryWithCoordinates) {
      mapRef.current.easeTo({
        center: [nextDeliveryWithCoordinates.lng, nextDeliveryWithCoordinates.lat],
        zoom: 14.5,
        padding: { top: 72, bottom: 320, left: 32, right: 32 },
        duration: 900,
      })
      return
    }

    if (mappableDeliveries.length === 0) {
      mapRef.current.easeTo({
        center: [DEFAULT_MAP_VIEW.longitude, DEFAULT_MAP_VIEW.latitude],
        zoom: DEFAULT_MAP_VIEW.zoom,
        duration: 900,
      })
      return
    }

    const longitudes = mappableDeliveries.map((item) => item.lng)
    const latitudes = mappableDeliveries.map((item) => item.lat)
    const west = Math.min(...longitudes)
    const east = Math.max(...longitudes)
    const south = Math.min(...latitudes)
    const north = Math.max(...latitudes)

    if (west === east && south === north) {
      mapRef.current.easeTo({
        center: [west, south],
        zoom: 13.5,
        padding: { top: 72, bottom: 240, left: 32, right: 32 },
        duration: 900,
      })
      return
    }

    mapRef.current.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: { top: 72, bottom: 240, left: 32, right: 32 },
        duration: 900,
      }
    )
  })

  useEffect(() => {
    if (activeTab !== "map") {
      return
    }

    const frameId = window.requestAnimationFrame(() => focusMapOnDelivery())
    return () => window.cancelAnimationFrame(frameId)
  }, [activeTab, mapViewportKey])

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

      <main className={cn("pb-20", activeTab === "map" ? "px-0 py-0" : "px-4 py-4")}>
        {activeTab !== "map" && loadSource === "cache" && !beforeSeven && (
          <div className="mb-4 p-4 rounded-2xl bg-[#FFF3E0] text-[#8A5A00] text-sm shadow-sm">
            Mode hors ligne actif. La liste affiche la derniere tournee sauvegardee sur cet appareil.
          </div>
        )}

        {activeTab !== "map" && notice && !beforeSeven && (
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
          <div className="relative h-[calc(100dvh-15rem)] min-h-[32rem] overflow-hidden bg-[#E4ECE5]">
            <div className="absolute inset-0">
              {!isMapboxConfigured ? (
                <div className="flex h-full items-center justify-center px-6">
                  <div className="max-w-xs rounded-[2rem] bg-white/92 p-7 text-center shadow-lg backdrop-blur">
                    <MapIcon className="mx-auto mb-4 h-14 w-14 text-[#8A8A8A]" />
                    <p className="font-semibold text-[#3D3D3D]">Token Mapbox manquant</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      Ajoutez `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` pour afficher la carte du livreur.
                    </p>
                  </div>
                </div>
              ) : isTourneeLoading ? (
                <div className="flex h-full items-center justify-center px-6">
                  <div className="rounded-[2rem] bg-white/88 px-6 py-5 text-center shadow-lg backdrop-blur">
                    <Spinner className="mx-auto size-6 text-[#1E8A3C]" />
                    <p className="mt-3 font-medium text-[#3D3D3D]">Chargement de votre tournee...</p>
                  </div>
                </div>
              ) : beforeSeven ? (
                <div className="flex h-full items-center justify-center px-6">
                  <div className="max-w-xs rounded-[2rem] bg-white/92 p-7 text-center shadow-lg backdrop-blur">
                    <Clock3 className="mx-auto mb-4 h-14 w-14 text-[#1E8A3C]" />
                    <p className="text-xl font-semibold text-[#3D3D3D]">Bonjour, prenez un cafe</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      Votre tournee s&apos;affichera ici a 7h00.
                    </p>
                  </div>
                </div>
              ) : !token ? (
                <div className="flex h-full items-center justify-center px-6">
                  <div className="max-w-xs rounded-[2rem] bg-white/92 p-7 text-center shadow-lg backdrop-blur">
                    <Truck className="mx-auto mb-4 h-14 w-14 text-[#1E8A3C]" />
                    <p className="font-semibold text-[#3D3D3D]">Votre session livreur est requise.</p>
                    <Link
                      href="/login/livreur"
                      className="mt-4 inline-flex rounded-2xl bg-[#F07C00] px-4 py-2.5 font-medium text-white"
                    >
                      Se connecter
                    </Link>
                  </div>
                </div>
              ) : deliveryList.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6">
                  <div className="max-w-xs rounded-[2rem] bg-white/92 p-7 text-center shadow-lg backdrop-blur">
                    <MapIcon className="mx-auto mb-4 h-14 w-14 text-[#8A8A8A]" />
                    <p className="font-semibold text-[#3D3D3D]">Aucune livraison assignee</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      Revenez un peu plus tard pour verifier votre tournee du jour.
                    </p>
                  </div>
                </div>
              ) : mappableDeliveries.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6">
                  <div className="max-w-xs rounded-[2rem] bg-white/92 p-7 text-center shadow-lg backdrop-blur">
                    <MapIcon className="mx-auto mb-4 h-14 w-14 text-[#8A8A8A]" />
                    <p className="font-semibold text-[#3D3D3D]">Aucune coordonnee GPS exploitable</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      Les livraisons doivent avoir `lat` et `lng` pour etre positionnees sur la carte.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0">
                    <Map
                      ref={mapRef}
                      reuseMaps
                      initialViewState={DEFAULT_MAP_VIEW}
                      mapboxAccessToken={MAPBOX_TOKEN}
                      mapStyle={MAPBOX_STYLE}
                      maxBounds={MOROCCO_BOUNDS}
                      attributionControl={false}
                      onLoad={() => focusMapOnDelivery()}
                    >
                      <NavigationControl position="top-right" showCompass={false} />

                      {routeCoordinates.length > 1 && (
                        <Source id="tournee-route" type="geojson" data={routeGeoJson}>
                          <Layer {...ROUTE_LAYER} />
                        </Source>
                      )}

                      {(nextDelivery ? futureDeliveries.filter(hasCoordinates) : mappableDeliveries).map((item) => (
                        <Marker key={item.id} longitude={item.lng} latitude={item.lat} anchor="center">
                          <div className="h-3.5 w-3.5 rounded-full bg-[#9AA69D] ring-4 ring-white/90 shadow-sm" />
                        </Marker>
                      ))}

                      {nextDeliveryWithCoordinates && (
                        <Marker longitude={nextDeliveryWithCoordinates.lng} latitude={nextDeliveryWithCoordinates.lat} anchor="bottom">
                          <div className="flex flex-col items-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border-4 border-white bg-[#1E8A3C] text-lg font-black text-white shadow-[0_12px_30px_rgba(30,138,60,0.38)]">
                              {nextDeliveryWithCoordinates.stepNumber}
                            </div>
                            <div className="-mt-2 h-4 w-4 rotate-45 rounded-[4px] bg-[#1E8A3C] ring-4 ring-white" />
                          </div>
                        </Marker>
                      )}
                    </Map>
                  </div>

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-white/35" />
                </>
              )}
            </div>

            <div className="pointer-events-none absolute inset-x-3 top-3 z-20 space-y-2">
              {loadSource === "cache" && !beforeSeven && (
                <div className="rounded-2xl bg-[#FFF3E0]/95 px-4 py-3 text-sm text-[#8A5A00] shadow-sm backdrop-blur">
                  Mode hors ligne actif. La carte affiche la derniere tournee sauvegardee.
                </div>
              )}

              {notice && !beforeSeven && (
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm shadow-sm backdrop-blur",
                    notice.tone === "success" && "bg-[#F0FAF1]/95 text-[#1E8A3C]",
                    notice.tone === "info" && "bg-[#FFF3E0]/95 text-[#8A5A00]",
                    notice.tone === "error" && "bg-red-50/95 text-red-600"
                  )}
                >
                  {notice.message}
                </div>
              )}
            </div>

            {isMapboxConfigured && !beforeSeven && !isTourneeLoading && token && deliveryList.length > 0 && (
              <div className="absolute inset-x-0 bottom-[4.75rem] z-20 px-3">
                <div className="rounded-t-3xl bg-white/96 shadow-[0_-14px_40px_rgba(17,24,39,0.18)] backdrop-blur">
                  <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#D1D5DB]" />

                  {!nextDelivery ? (
                    <div className="px-5 pb-6 pt-4">
                      <div className="rounded-[1.75rem] bg-[#F0FAF1] p-5 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1E8A3C] text-white">
                          <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <h3 className="mt-4 text-2xl font-bold text-[#17301E]">Tournee terminee !</h3>
                        <p className="mt-2 text-sm leading-6 text-[#5B6B60]">
                          Toutes les commandes de la journee ont ete traitees. Vous pouvez consulter votre progression ou revenir plus tard.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8A8A8A]">Livrees</p>
                            <p className="mt-1 text-xl font-bold text-[#17301E]">{completedCount}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8A8A8A]">Revenus</p>
                            <p className="mt-1 text-xl font-bold text-[#17301E]">{todayEarnings} DH</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 pb-6 pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1E8A3C]">
                            Prochaine livraison
                          </p>
                          <h3 className="mt-2 truncate text-2xl font-bold text-[#17301E]">
                            {getDeliveryNeighborhood(nextDelivery)}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-[#5B6B60]">{nextDelivery.address}</p>
                        </div>

                        <div className="shrink-0 rounded-[1.4rem] bg-[#F0FAF1] px-4 py-3 text-center">
                          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#6B7280]">Stop</p>
                          <p className="mt-1 text-2xl font-black text-[#1E8A3C]">{nextDelivery.stepNumber}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <Package className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Colis</span>
                          </div>
                          <p className="mt-2 text-lg font-bold text-[#17301E]">{nextDelivery.packageCount}</p>
                        </div>

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Montant</span>
                          </div>
                          <p className="mt-2 text-lg font-bold text-[#17301E]">{formatAmount(nextDelivery.amount)}</p>
                        </div>

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Paiement</span>
                          </div>
                          <p className="mt-2 text-base font-semibold text-[#17301E]">
                            {formatPaymentMethodLabel(nextDelivery.paymentMethod)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <Clock3 className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Creneau</span>
                          </div>
                          <p className="mt-2 text-base font-semibold text-[#17301E]">{nextDelivery.timeSlot}</p>
                        </div>
                      </div>

                      {activeMissingCoordinatesCount > 0 && (
                        <div className="mt-4 rounded-2xl bg-[#FFF3E0] px-4 py-3 text-sm text-[#8A5A00]">
                          {activeMissingCoordinatesCount} livraison(s) restante(s) n&apos;ont pas de coordonnees GPS exploitables.
                        </div>
                      )}

                      {!nextDeliveryWithCoordinates && (
                        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                          La prochaine livraison n&apos;a pas de coordonnees GPS. La navigation est temporairement indisponible.
                        </div>
                      )}

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <a
                          href={nextNavigationHref ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!nextNavigationHref}
                          className={cn(
                            "flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#17301E] px-4 text-base font-semibold text-white shadow-sm transition-transform active:scale-[0.99]",
                            !nextNavigationHref && "pointer-events-none bg-gray-200 text-gray-500 shadow-none"
                          )}
                        >
                          <Navigation className="h-5 w-5" />
                          Naviguer
                        </a>

                        <a
                          href={nextDelivery.callHref ?? undefined}
                          aria-disabled={!nextDelivery.callHref}
                          className={cn(
                            "flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#F3F4F6] px-4 text-base font-semibold text-[#17301E] transition-transform active:scale-[0.99]",
                            !nextDelivery.callHref && "pointer-events-none bg-gray-200 text-gray-500"
                          )}
                        >
                          <Phone className="h-5 w-5" />
                          Appeler
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(nextDelivery.id, "delivered")}
                        className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 text-base font-semibold text-white shadow-sm transition-transform active:scale-[0.99]"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        Valider la livraison
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
            { id: "map" as TabType, icon: MapIcon, label: "Carte" },
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
