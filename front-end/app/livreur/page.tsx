"use client"

import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Navigation,
  Package,
  Phone,
  Route,
  SignalHigh,
  Truck,
  WifiOff,
} from "lucide-react"
import type { LineLayerSpecification } from "mapbox-gl"
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox"

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
    "line-color": "#F07C00",
    "line-width": 5,
    "line-opacity": 0.9,
  },
}

type DeliveryStatus = "pending" | "enroute" | "delivered" | "absent"
type PaymentMethod = "cod" | "wallet" | "cmi"
type NoticeTone = "info" | "success" | "error"

interface DeliveryViewItem {
  id: string
  stepNumber: number
  orderNumber: string
  timeSlot: string
  address: string
  street: string | null
  neighborhood: string | null
  details: string | null
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
    street: item.street,
    neighborhood: item.neighborhood,
    details: item.details,
    clientName: item.client_label,
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

function buildPreciseAddress(delivery: DeliveryViewItem) {
  const addressParts = [delivery.neighborhood?.trim(), delivery.street?.trim()].filter(Boolean)
  if (addressParts.length > 0) {
    return addressParts.join(", ")
  }

  const firstAddressSegment = delivery.address.split(",")[0]?.trim()
  return firstAddressSegment || "Adresse non precise"
}

function buildPackageSummary(delivery: DeliveryViewItem) {
  const baseSummary = `${delivery.packageCount} colis`
  const normalizedDetails = delivery.details?.trim()

  return normalizedDetails ? `${baseSummary} - ${normalizedDetails}` : baseSummary
}

function buildPaymentSummary(delivery: DeliveryViewItem) {
  return `${formatAmount(delivery.amount)} - ${formatPaymentMethodLabel(delivery.paymentMethod)}`
}

function buildWazeNavigationHref(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
}

function buildGoogleMapsNavigationHref(lat: number, lng: number) {
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

function CenterStateCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="pointer-events-auto w-full max-w-sm rounded-[2rem] border border-white/60 bg-white/92 p-7 text-center shadow-[0_28px_80px_rgba(15,23,42,0.2)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F0FAF1] text-[#1E8A3C]">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-[#17301E]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#5B6B60]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F7FAF7]/85 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6D7A72]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#17301E]">{value}</p>
    </div>
  )
}

export default function LivreurPage() {
  const router = useRouter()
  const { token, isLoading: isAuthLoading, isAuthenticated, can } = useAuth()
  const hasLivreurAccess = can("livreur.dashboard.access")
  const mapRef = useRef<MapRef | null>(null)
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
  const nextWazeHref = nextDeliveryWithCoordinates
    ? buildWazeNavigationHref(nextDeliveryWithCoordinates.lat, nextDeliveryWithCoordinates.lng)
    : null
  const nextGoogleMapsHref = nextDeliveryWithCoordinates
    ? buildGoogleMapsNavigationHref(nextDeliveryWithCoordinates.lat, nextDeliveryWithCoordinates.lng)
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
        zoom: 15,
        padding: { top: 150, bottom: 360, left: 40, right: 40 },
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
        zoom: 14,
        padding: { top: 150, bottom: 300, left: 40, right: 40 },
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
        padding: { top: 150, bottom: 300, left: 40, right: 40 },
        duration: 900,
      }
    )
  })

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => focusMapOnDelivery())
    return () => window.cancelAnimationFrame(frameId)
  }, [mapViewportKey])

  const completedCount = deliveryList.filter((item) => item.status === "delivered" || item.status === "absent").length
  const totalCount = deliveryList.length
  const remainingCount = activeDeliveries.length
  const remainingTime = computeRemainingTime(deliveryList)
  const todayEarnings = deliveryList.filter((item) => item.status === "delivered").length * 10
  const tourneeWindow = formatTourneeWindow(deliveryList)
  const tourneeTitle = `Tournee du ${formatTourneeDate(tourneeData?.date_jour)}${tourneeWindow ? ` - ${tourneeWindow}` : ""}`
  const progressRatio = totalCount === 0 ? 0 : completedCount / totalCount
  const futureMarkers = nextDelivery ? futureDeliveries.filter(hasCoordinates) : mappableDeliveries
  const showMap =
    isMapboxConfigured && !isTourneeLoading && !beforeSeven && Boolean(token) && mappableDeliveries.length > 0
  const showBottomSheet = !isTourneeLoading && !beforeSeven && Boolean(token) && deliveryList.length > 0

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

  const floatingStatusLabel = beforeSeven
    ? "Disponible a 7h00"
    : isTourneeLoading
      ? "Synchronisation"
      : deliveryList.length === 0
        ? "Aucune affectation"
        : !tourneeStarted
          ? "Pret a demarrer"
          : nextDelivery
            ? "En livraison"
            : "Tournee terminee"
  const floatingStatusClass = beforeSeven
    ? "bg-[#FFF3E0] text-[#8A5A00]"
    : !tourneeStarted && deliveryList.length > 0
      ? "bg-[#FFF3E0] text-[#8A5A00]"
      : nextDelivery
        ? "bg-[#F0FAF1] text-[#1E8A3C]"
        : "bg-[#EEF5FF] text-[#285C9A]"

  const renderCenterState = () => {
    if (isTourneeLoading) {
      return (
        <CenterStateCard
          icon={Truck}
          title="Chargement de votre tournee"
          description="Nous recuperons la tournee du jour, les etapes et les coordonnees GPS."
          action={<Spinner className="mx-auto size-6 text-[#1E8A3C]" />}
        />
      )
    }

    if (beforeSeven) {
      return (
        <CenterStateCard
          icon={Clock3}
          title="La tournee arrive bientot"
          description="Votre tournee s'affichera ici a partir de 7h00."
        />
      )
    }

    if (!token) {
      return (
        <CenterStateCard
          icon={Truck}
          title="Session livreur requise"
          description="Connectez-vous pour consulter votre tournee et piloter vos prochaines livraisons."
          action={
            <Link
              href="/login/livreur"
              className="inline-flex rounded-2xl bg-[#F07C00] px-5 py-3 font-semibold text-white"
            >
              Se connecter
            </Link>
          }
        />
      )
    }

    if (deliveryList.length === 0) {
      return (
        <CenterStateCard
          icon={MapIcon}
          title="Aucune livraison assignee"
          description="Revenez un peu plus tard pour verifier votre tournee du jour."
        />
      )
    }

    if (!isMapboxConfigured) {
      return (
        <CenterStateCard
          icon={MapIcon}
          title="Carte indisponible"
          description="Ajoutez NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN pour activer la navigation cartographique."
        />
      )
    }

    if (mappableDeliveries.length === 0) {
      return (
        <CenterStateCard
          icon={MapPin}
          title="Coordonnees GPS manquantes"
          description="Les commandes doivent fournir lat et lng pour la navigation terrain."
        />
      )
    }

    return null
  }
  const centerState = renderCenterState()

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#D9E6DD]">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(217,230,221,0.6)_35%,_rgba(185,208,190,0.9)_100%)]" />

      {showMap && (
        <div className="absolute inset-0 z-0">
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

            {futureMarkers.map((item) => (
              <Marker key={item.id} longitude={item.lng} latitude={item.lat} anchor="center">
                <div className="h-3 w-3 rounded-full bg-[#8B9991]/90 ring-4 ring-white/85 shadow-sm" />
              </Marker>
            ))}

            {nextDeliveryWithCoordinates && (
              <Marker
                longitude={nextDeliveryWithCoordinates.lng}
                latitude={nextDeliveryWithCoordinates.lat}
                anchor="bottom"
              >
                <div className="relative flex flex-col items-center">
                  <div className="absolute top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-[#F07C00]/30 animate-ping" />
                  <div className="absolute top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-[#F07C00]/12" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[#F07C00] text-lg font-black text-white shadow-[0_18px_34px_rgba(240,124,0,0.4)]">
                    {nextDeliveryWithCoordinates.stepNumber}
                  </div>
                  <div className="-mt-2 h-4 w-4 rotate-45 rounded-[4px] bg-[#F07C00] ring-4 ring-white" />
                </div>
              </Marker>
            )}
          </Map>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-[#10251A]/40 via-transparent via-45% to-[#10251A]/20" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-4">
        <div className="mx-auto max-w-4xl">
          <div className="pointer-events-auto rounded-[2rem] border border-white/60 bg-white/84 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                      floatingStatusClass
                    )}
                  >
                    {floatingStatusLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F7F4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5F6E65]">
                    {isOffline ? <WifiOff className="h-3.5 w-3.5" /> : <SignalHigh className="h-3.5 w-3.5" />}
                    {isOffline ? "Hors ligne" : loadSource === "cache" ? "Cache" : "Live"}
                  </span>
                </div>

                <p className="mt-2 truncate text-base font-semibold text-[#17301E]">{tourneeTitle}</p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <HeaderMetric label="Restantes" value={String(remainingCount)} />
                  <HeaderMetric label="Livrees" value={`${completedCount}/${totalCount}`} />
                  <HeaderMetric label="Gains" value={formatAmount(todayEarnings)} />
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8E3]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1E8A3C] to-[#F07C00] transition-all duration-500"
                    style={{ width: `${progressRatio * 100}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOnDuty((currentValue) => !currentValue)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-2 text-sm font-semibold shadow-sm transition-colors",
                  isOnDuty ? "bg-[#1E8A3C] text-white" : "bg-red-50 text-red-600"
                )}
              >
                {isOnDuty ? "En service" : "Pause"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 top-[9.75rem] z-30 px-4">
        <div className="mx-auto max-w-4xl space-y-2">
          {loadSource === "cache" && !beforeSeven && (
            <div className="rounded-2xl bg-[#FFF3E0]/95 px-4 py-3 text-sm text-[#8A5A00] shadow-sm backdrop-blur">
              Mode hors ligne actif. La derniere tournee sauvegardee est affichee.
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
      </div>

      {centerState && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 pt-28">
          {centerState}
        </div>
      )}

      {showBottomSheet && (
        <div className="absolute inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-4xl px-3 pb-3">
            <div className="pointer-events-auto max-h-[62vh] overflow-y-auto rounded-t-[2rem] border border-white/70 bg-white/96 shadow-[0_-16px_56px_rgba(15,23,42,0.22)] backdrop-blur-xl">
              <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-[#D1D5DB]" />

              {!nextDelivery ? (
                <div className="px-5 pb-6 pt-4">
                  <div className="rounded-[1.75rem] bg-[#F0FAF1] p-5 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1E8A3C] text-white">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-[#17301E]">Tournee terminee</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5B6B60]">
                      Toutes les commandes ont ete traitees. La carte reste disponible pour revoir le parcours du jour.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8A8A8A]">Livrees</p>
                        <p className="mt-1 text-xl font-bold text-[#17301E]">{completedCount}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8A8A8A]">Gains</p>
                        <p className="mt-1 text-xl font-bold text-[#17301E]">{formatAmount(todayEarnings)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-5 pb-6 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1E8A3C]">
                        Focus livraison
                      </p>
                      <h3 className="mt-2 truncate text-2xl font-bold text-[#17301E]">{nextDelivery.clientName}</h3>
                      <p className="mt-2 text-sm font-medium text-[#3F5246]">{buildPreciseAddress(nextDelivery)}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5B6B60]">{nextDelivery.address}</p>
                    </div>

                    <div className="shrink-0 rounded-[1.4rem] bg-[#F0FAF1] px-4 py-3 text-center">
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#6B7280]">Stop</p>
                      <p className="mt-1 text-2xl font-black text-[#1E8A3C]">{nextDelivery.stepNumber}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                      <div className="flex items-center gap-2 text-[#6B7280]">
                        <Package className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-[0.16em]">Colis</span>
                      </div>
                      <p className="mt-2 text-base font-bold text-[#17301E]">{buildPackageSummary(nextDelivery)}</p>
                    </div>

                    <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                      <div className="flex items-center gap-2 text-[#6B7280]">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-[0.16em]">Encaissement</span>
                      </div>
                      <p className="mt-2 text-base font-bold text-[#17301E]">{buildPaymentSummary(nextDelivery)}</p>
                    </div>

                    <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                      <div className="flex items-center gap-2 text-[#6B7280]">
                        <Phone className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-[0.16em]">Contact</span>
                      </div>
                      <p className="mt-2 text-base font-semibold text-[#17301E]">{nextDelivery.clientPhone}</p>
                    </div>

                    <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                      <div className="flex items-center gap-2 text-[#6B7280]">
                        <Clock3 className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-[0.16em]">Creneau</span>
                      </div>
                      <p className="mt-2 text-base font-semibold text-[#17301E]">{nextDelivery.timeSlot}</p>
                    </div>
                  </div>

                  {!tourneeStarted && (
                    <button
                      type="button"
                      onClick={handleStartTournee}
                      disabled={isStartingTournee || deliveryList.length === 0}
                      className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#17301E] px-4 text-base font-semibold text-white shadow-sm transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isStartingTournee ? <Spinner className="size-5" /> : <Truck className="h-5 w-5" />}
                      {tourneeStarted ? "Tournee demarree" : "Demarrer la tournee"}
                    </button>
                  )}

                  {activeMissingCoordinatesCount > 0 && (
                    <div className="mt-4 rounded-2xl bg-[#FFF3E0] px-4 py-3 text-sm text-[#8A5A00]">
                      {activeMissingCoordinatesCount} livraison(s) restante(s) n'ont pas de coordonnees GPS exploitables.
                    </div>
                  )}

                  {!nextDeliveryWithCoordinates && (
                    <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                      La prochaine livraison n'a pas de coordonnees GPS. La navigation est temporairement indisponible.
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3">
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

                    <a
                      href={nextWazeHref ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!nextWazeHref}
                      className={cn(
                        "flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#17301E] px-4 text-base font-semibold text-white shadow-sm transition-transform active:scale-[0.99]",
                        !nextWazeHref && "pointer-events-none bg-gray-200 text-gray-500 shadow-none"
                      )}
                    >
                      <Navigation className="h-5 w-5" />
                      Naviguer
                    </a>
                  </div>

                  {nextGoogleMapsHref && (
                    <a
                      href={nextGoogleMapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#285C9A]"
                    >
                      Ouvrir aussi dans Google Maps
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleStatusChange(nextDelivery.id, "delivered")}
                    className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 text-base font-semibold text-white shadow-[0_12px_28px_rgba(30,138,60,0.26)] transition-transform active:scale-[0.99]"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Valider la livraison
                  </button>

                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F7F9F7] px-4 py-3 text-sm text-[#5B6B60]">
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-[#1E8A3C]" />
                      <span>{remainingCount} etape(s) restante(s)</span>
                    </div>
                    <span>ETA {remainingTime}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
