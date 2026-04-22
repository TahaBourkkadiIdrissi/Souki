"use client"

import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  DollarSign,
  Gauge,
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
const GPS_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
}
const ROUTE_REFRESH_DISTANCE_METERS = 40
const ROUTE_REFRESH_INTERVAL_MS = 15000
const ROUTE_OVERVIEW_PADDING = { top: 140, bottom: 190, left: 28, right: 28 }
const DRIVE_MODE_PADDING = { top: 100, bottom: 190, left: 20, right: 20 }
const ROUTE_CASING_LAYER: Omit<LineLayerSpecification, "source"> = {
  id: "tournee-route-casing",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#FFFFFF",
    "line-width": 10,
    "line-opacity": 0.7,
  },
}
const ROUTE_LAYER: Omit<LineLayerSpecification, "source"> = {
  id: "tournee-route-main",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#1A73E8",
    "line-width": 6,
    "line-opacity": 0.96,
  },
}

type DeliveryStatus = "pending" | "enroute" | "delivered" | "absent"
type PaymentMethod = "cod" | "wallet" | "cmi"
type NoticeTone = "info" | "success" | "error"
type SheetMode = "peek" | "expanded"

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

interface DriverLocation {
  latitude: number
  longitude: number
  accuracy: number | null
  speedKmh: number | null
  heading: number | null
  timestamp: number
}

interface RouteSummary {
  distanceMeters: number
  durationSeconds: number
}

interface LineFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: Record<string, string | number | boolean | null>
    geometry: {
      type: "LineString"
      coordinates: [number, number][]
    }
  }>
}

interface MapboxDirectionsResponse {
  routes?: Array<{
    distance: number
    duration: number
    geometry: {
      type: "LineString"
      coordinates: [number, number][]
    }
  }>
}

const EMPTY_ROUTE_GEOJSON: LineFeatureCollection = {
  type: "FeatureCollection",
  features: [],
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

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI
}

function computeDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6371000
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLng = toRadians(lng2 - lng1)
  const startLat = toRadians(lat1)
  const endLat = toRadians(lat2)
  const haversineValue =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
}

function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const startLat = toRadians(lat1)
  const endLat = toRadians(lat2)
  const deltaLng = toRadians(lng2 - lng1)
  const y = Math.sin(deltaLng) * Math.cos(endLat)
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng)

  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function createLineFeatureCollection(
  coordinates: [number, number][],
  kind: "directions" | "fallback" = "directions"
): LineFeatureCollection {
  if (coordinates.length < 2) {
    return EMPTY_ROUTE_GEOJSON
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind },
        geometry: {
          type: "LineString",
          coordinates,
        },
      },
    ],
  }
}

function formatDurationFromSeconds(value: number) {
  const roundedMinutes = Math.max(1, Math.round(value / 60))
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours}h${minutes.toString().padStart(2, "0")}`
}

function formatDistanceLabel(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`
  }

  const distanceKm = distanceMeters / 1000
  return `${distanceKm >= 10 ? distanceKm.toFixed(0) : distanceKm.toFixed(1)} km`
}

function buildDirectionsUrl(origin: [number, number], destination: [number, number]) {
  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const params = new URLSearchParams({
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "false",
    language: "fr",
    access_token: MAPBOX_TOKEN,
  })

  return `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params.toString()}`
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
  const lastDriverLocationRef = useRef<DriverLocation | null>(null)
  const lastDirectionsRequestRef = useRef<{
    origin: [number, number]
    destination: [number, number]
    timestamp: number
  } | null>(null)

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
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>("peek")
  const [routeGeoJson, setRouteGeoJson] = useState<LineFeatureCollection>(EMPTY_ROUTE_GEOJSON)
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null)
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

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
    if (typeof window === "undefined") {
      return
    }

    if (!("geolocation" in window.navigator)) {
      setGpsError("Le GPS du navigateur n'est pas disponible sur cet appareil.")
      return
    }

    let isCancelled = false
    const watchId = window.navigator.geolocation.watchPosition(
      (position) => {
        if (isCancelled) {
          return
        }

        const previousLocation = lastDriverLocationRef.current
        const deviceHeading =
          typeof position.coords.heading === "number" &&
          Number.isFinite(position.coords.heading) &&
          position.coords.heading >= 0
            ? position.coords.heading
            : null
        const computedHeading =
          previousLocation &&
          computeDistanceMeters(
            previousLocation.latitude,
            previousLocation.longitude,
            position.coords.latitude,
            position.coords.longitude
          ) > 5
            ? computeBearing(
                previousLocation.latitude,
                previousLocation.longitude,
                position.coords.latitude,
                position.coords.longitude
              )
            : previousLocation?.heading ?? null
        const nextLocation: DriverLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy:
            typeof position.coords.accuracy === "number" && Number.isFinite(position.coords.accuracy)
              ? position.coords.accuracy
              : null,
          speedKmh:
            typeof position.coords.speed === "number" &&
            Number.isFinite(position.coords.speed) &&
            position.coords.speed >= 0
              ? position.coords.speed * 3.6
              : previousLocation?.speedKmh ?? null,
          heading: deviceHeading ?? computedHeading,
          timestamp: position.timestamp,
        }

        lastDriverLocationRef.current = nextLocation
        setDriverLocation(nextLocation)
        setGpsError(null)
      },
      (error) => {
        if (isCancelled) {
          return
        }

        if (error.code === error.PERMISSION_DENIED) {
          setGpsError("Autorisez la geolocalisation pour activer le guidage live du livreur.")
          return
        }

        if (error.code === error.TIMEOUT) {
          setGpsError("Le GPS prend plus de temps que prevu. Nous continuons d'essayer.")
          return
        }

        setGpsError("Le suivi GPS temps reel est temporairement indisponible.")
      },
      GPS_WATCH_OPTIONS
    )

    return () => {
      isCancelled = true
      window.navigator.geolocation.clearWatch(watchId)
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
  const fallbackRouteStartCoordinates = previousMappableDelivery
    ? ([previousMappableDelivery.lng, previousMappableDelivery.lat] as [number, number])
    : ([FES_START_COORDINATE[0], FES_START_COORDINATE[1]] as [number, number])
  const routeOriginCoordinates = driverLocation
    ? ([driverLocation.longitude, driverLocation.latitude] as [number, number])
    : fallbackRouteStartCoordinates
  const activeMissingCoordinatesCount = activeDeliveries.filter((item) => !hasCoordinates(item)).length
  const isMapboxConfigured = MAPBOX_TOKEN.length > 0
  const routeOriginLongitude = routeOriginCoordinates[0]
  const routeOriginLatitude = routeOriginCoordinates[1]

  useEffect(() => {
    if (!nextDelivery) {
      setIsNavigating(false)
      setSheetMode("peek")
    }
  }, [nextDelivery])

  useEffect(() => {
    if (isNavigating) {
      setSheetMode("peek")
    }
  }, [isNavigating])

  useEffect(() => {
    if (!nextDeliveryWithCoordinates) {
      setRouteGeoJson(EMPTY_ROUTE_GEOJSON)
      setRouteSummary(null)
      setRouteError(null)
      setIsRouteLoading(false)
      lastDirectionsRequestRef.current = null
      return
    }

    const destinationCoordinates: [number, number] = [nextDeliveryWithCoordinates.lng, nextDeliveryWithCoordinates.lat]

    if (!isMapboxConfigured) {
      setRouteGeoJson(EMPTY_ROUTE_GEOJSON)
      setRouteSummary(null)
      setRouteError("Le token Mapbox est requis pour calculer un itineraire.")
      setIsRouteLoading(false)
      lastDirectionsRequestRef.current = null
      return
    }

    if (isOffline) {
      setRouteGeoJson(createLineFeatureCollection([routeOriginCoordinates, destinationCoordinates], "fallback"))
      setRouteSummary(null)
      setRouteError("Trace simplifiee active. L'itineraire detaille Mapbox est indisponible hors ligne.")
      setIsRouteLoading(false)
      return
    }

    const lastRequest = lastDirectionsRequestRef.current
    if (lastRequest) {
      const originDrift = computeDistanceMeters(
        lastRequest.origin[1],
        lastRequest.origin[0],
        routeOriginLatitude,
        routeOriginLongitude
      )
      const destinationDrift = computeDistanceMeters(
        lastRequest.destination[1],
        lastRequest.destination[0],
        destinationCoordinates[1],
        destinationCoordinates[0]
      )
      const requestAge = Date.now() - lastRequest.timestamp

      if (
        originDrift < ROUTE_REFRESH_DISTANCE_METERS &&
        destinationDrift < 5 &&
        requestAge < ROUTE_REFRESH_INTERVAL_MS
      ) {
        return
      }
    }

    let isCancelled = false
    const controller = new AbortController()

    const loadDirectionsRoute = async () => {
      setIsRouteLoading(true)
      setRouteError(null)

      try {
        const response = await fetch(buildDirectionsUrl(routeOriginCoordinates, destinationCoordinates), {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Directions Mapbox indisponibles (${response.status}).`)
        }

        const payload = (await response.json()) as MapboxDirectionsResponse
        const bestRoute = payload.routes?.[0]
        if (!bestRoute || !Array.isArray(bestRoute.geometry?.coordinates)) {
          throw new Error("Aucun itineraire exploitable n'a ete retourne par Mapbox.")
        }

        if (isCancelled) {
          return
        }

        setRouteGeoJson(createLineFeatureCollection(bestRoute.geometry.coordinates))
        setRouteSummary({
          distanceMeters: bestRoute.distance,
          durationSeconds: bestRoute.duration,
        })
        setRouteError(null)
        lastDirectionsRequestRef.current = {
          origin: routeOriginCoordinates,
          destination: destinationCoordinates,
          timestamp: Date.now(),
        }
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return
        }

        setRouteGeoJson(createLineFeatureCollection([routeOriginCoordinates, destinationCoordinates], "fallback"))
        setRouteSummary(null)
        setRouteError(
          error instanceof Error
            ? `${error.message} La carte affiche un trace simplifie entre le livreur et la destination.`
            : "Impossible de calculer l'itineraire detaille."
        )
      } finally {
        if (!isCancelled) {
          setIsRouteLoading(false)
        }
      }
    }

    void loadDirectionsRoute()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [
    driverLocation?.latitude,
    driverLocation?.longitude,
    isMapboxConfigured,
    isOffline,
    nextDeliveryWithCoordinates?.id,
    nextDeliveryWithCoordinates?.lat,
    nextDeliveryWithCoordinates?.lng,
    routeOriginLatitude,
    routeOriginLongitude,
  ])

  const syncMapCamera = useEffectEvent(() => {
    if (!mapRef.current) {
      return
    }

    const mapInstance = mapRef.current

    if (isNavigating) {
      if (driverLocation) {
        const nextBearing =
          driverLocation.speedKmh && driverLocation.speedKmh > 4 && typeof driverLocation.heading === "number"
            ? driverLocation.heading
            : mapInstance.getBearing()

        mapInstance.easeTo({
          center: [driverLocation.longitude, driverLocation.latitude],
          zoom: 16.8,
          pitch: 60,
          bearing: nextBearing,
          padding: DRIVE_MODE_PADDING,
          duration: 700,
          essential: true,
        })
        return
      }

      if (nextDeliveryWithCoordinates) {
        mapInstance.easeTo({
          center: [nextDeliveryWithCoordinates.lng, nextDeliveryWithCoordinates.lat],
          zoom: 15.2,
          pitch: 45,
          bearing: mapInstance.getBearing(),
          padding: DRIVE_MODE_PADDING,
          duration: 700,
          essential: true,
        })
        return
      }
    }

    if (driverLocation && nextDeliveryWithCoordinates) {
      const west = Math.min(driverLocation.longitude, nextDeliveryWithCoordinates.lng)
      const east = Math.max(driverLocation.longitude, nextDeliveryWithCoordinates.lng)
      const south = Math.min(driverLocation.latitude, nextDeliveryWithCoordinates.lat)
      const north = Math.max(driverLocation.latitude, nextDeliveryWithCoordinates.lat)

      if (west === east && south === north) {
        mapInstance.easeTo({
          center: [west, south],
          zoom: 15,
          pitch: 20,
          bearing: 0,
          padding: ROUTE_OVERVIEW_PADDING,
          duration: 900,
          essential: true,
        })
        return
      }

      mapInstance.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: ROUTE_OVERVIEW_PADDING,
          duration: 900,
          essential: true,
        }
      )
      return
    }

    if (nextDeliveryWithCoordinates) {
      mapInstance.easeTo({
        center: [nextDeliveryWithCoordinates.lng, nextDeliveryWithCoordinates.lat],
        zoom: 15,
        pitch: 10,
        bearing: 0,
        padding: ROUTE_OVERVIEW_PADDING,
        duration: 900,
        essential: true,
      })
      return
    }

    if (driverLocation) {
      mapInstance.easeTo({
        center: [driverLocation.longitude, driverLocation.latitude],
        zoom: 14.5,
        pitch: 15,
        bearing: 0,
        padding: ROUTE_OVERVIEW_PADDING,
        duration: 900,
        essential: true,
      })
      return
    }

    if (mappableDeliveries.length === 0) {
      mapInstance.easeTo({
        center: [DEFAULT_MAP_VIEW.longitude, DEFAULT_MAP_VIEW.latitude],
        zoom: DEFAULT_MAP_VIEW.zoom,
        duration: 900,
        essential: true,
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
      mapInstance.easeTo({
        center: [west, south],
        zoom: 14,
        pitch: 10,
        bearing: 0,
        padding: ROUTE_OVERVIEW_PADDING,
        duration: 900,
        essential: true,
      })
      return
    }

    mapInstance.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: ROUTE_OVERVIEW_PADDING,
        duration: 900,
        essential: true,
      }
    )
  })

  const roundedHeadingKey =
    typeof driverLocation?.heading === "number" ? Math.round(driverLocation.heading / 8) * 8 : "none"
  const mapCameraKey = [
    isNavigating ? "drive" : "overview",
    nextDeliveryWithCoordinates?.id ?? "no-destination",
    driverLocation?.latitude ?? "no-lat",
    driverLocation?.longitude ?? "no-lng",
    roundedHeadingKey,
    routeGeoJson.features.length,
  ].join(":")

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => syncMapCamera())
    return () => window.cancelAnimationFrame(frameId)
  }, [mapCameraKey])

  const completedCount = deliveryList.filter((item) => item.status === "delivered" || item.status === "absent").length
  const totalCount = deliveryList.length
  const remainingCount = activeDeliveries.length
  const remainingTime = computeRemainingTime(deliveryList)
  const todayEarnings = deliveryList.filter((item) => item.status === "delivered").length * 10
  const tourneeWindow = formatTourneeWindow(deliveryList)
  const tourneeTitle = `Tournee du ${formatTourneeDate(tourneeData?.date_jour)}${tourneeWindow ? ` - ${tourneeWindow}` : ""}`
  const progressRatio = totalCount === 0 ? 0 : completedCount / totalCount
  const currentRouteDistanceLabel = routeSummary ? formatDistanceLabel(routeSummary.distanceMeters) : "Trace en attente"
  const currentRouteDurationLabel = routeSummary ? formatDurationFromSeconds(routeSummary.durationSeconds) : remainingTime
  const futureMarkers = nextDelivery ? futureDeliveries.filter(hasCoordinates) : mappableDeliveries
  const sheetHeightValue = sheetMode === "expanded" ? "min(58dvh, 34rem)" : "max(20dvh, 12rem)"
  const isSheetExpanded = sheetMode === "expanded"
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
      return false
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
      return shouldMarkStarted
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Impossible de demarrer la tournee.",
      })
      return false
    } finally {
      setIsStartingTournee(false)
    }
  }

  const handleStartDriveMode = async () => {
    if (!nextDelivery) {
      return
    }

    if (!tourneeStarted) {
      const hasStarted = await handleStartTournee()
      if (!hasStarted) {
        return
      }
    }

    setIsNavigating(true)
  }

  const handleCompleteCurrentDelivery = () => {
    if (!nextDelivery) {
      return
    }

    handleStatusChange(nextDelivery.id, "delivered")
    setIsNavigating(false)
  }

  const floatingStatusLabel = isNavigating
    ? "Drive mode"
    : beforeSeven
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
  const floatingStatusClass = isNavigating
    ? "bg-[#EAF2FF] text-[#1A73E8]"
    : beforeSeven
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
    <div
      className="relative mx-auto h-screen w-full max-w-md overflow-hidden bg-[#D9E6DD] md:rounded-[2rem] md:shadow-[0_20px_70px_rgba(15,23,42,0.18)]"
      style={{ ["--driver-bottom-sheet-height" as string]: sheetHeightValue }}
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(217,230,221,0.6)_35%,_rgba(185,208,190,0.9)_100%)]" />

      {showMap && (
        <div className="absolute inset-x-0 top-0 bottom-[var(--driver-bottom-sheet-height)] z-0">
          <Map
            ref={mapRef}
            reuseMaps
            initialViewState={DEFAULT_MAP_VIEW}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={MAPBOX_STYLE}
            maxBounds={MOROCCO_BOUNDS}
            attributionControl={false}
            dragPan={!isNavigating}
            onLoad={() => syncMapCamera()}
          >
            <NavigationControl position="top-right" showCompass={false} />

            {routeGeoJson.features.length > 0 && (
              <Source id="tournee-route" type="geojson" data={routeGeoJson}>
                <Layer {...ROUTE_CASING_LAYER} />
                <Layer {...ROUTE_LAYER} />
              </Source>
            )}

            {futureMarkers.map((item) => (
              <Marker key={item.id} longitude={item.lng} latitude={item.lat} anchor="center">
                <div className="h-3 w-3 rounded-full bg-[#8B9991]/90 ring-4 ring-white/85 shadow-sm" />
              </Marker>
            ))}

            {nextDeliveryWithCoordinates && (
              <Marker longitude={nextDeliveryWithCoordinates.lng} latitude={nextDeliveryWithCoordinates.lat} anchor="bottom">
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

            {driverLocation && (
              <Marker longitude={driverLocation.longitude} latitude={driverLocation.latitude} anchor="center">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute h-14 w-14 rounded-full bg-[#1A73E8]/20 animate-ping" />
                  <div className="absolute h-10 w-10 rounded-full bg-[#1A73E8]/15" />
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-[#1A73E8] shadow-[0_12px_24px_rgba(26,115,232,0.35)]">
                    <div
                      className="h-0 w-0 border-b-[10px] border-l-[6px] border-r-[6px] border-b-white border-l-transparent border-r-transparent"
                      style={{
                        transform: `rotate(${driverLocation.heading ?? 0}deg)`,
                      }}
                    />
                  </div>
                </div>
              </Marker>
            )}
          </Map>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-[#10251A]/38 via-transparent via-45% to-[#10251A]/20" />

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
                  {driverLocation && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A73E8]">
                      <Gauge className="h-3.5 w-3.5" />
                      {driverLocation.speedKmh ? `${Math.round(driverLocation.speedKmh)} km/h` : "GPS actif"}
                    </span>
                  )}
                </div>

                <p className="mt-2 truncate text-base font-semibold text-[#17301E]">{tourneeTitle}</p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <HeaderMetric label="Restantes" value={String(remainingCount)} />
                  <HeaderMetric label="Livrees" value={`${completedCount}/${totalCount}`} />
                  <HeaderMetric
                    label={routeSummary ? "Distance" : "Gains"}
                    value={routeSummary ? currentRouteDistanceLabel : formatAmount(todayEarnings)}
                  />
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8E3]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1E8A3C] to-[#1A73E8] transition-all duration-500"
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

          {gpsError && !beforeSeven && token && deliveryList.length > 0 && (
            <div className="rounded-2xl bg-[#EAF2FF]/95 px-4 py-3 text-sm text-[#285C9A] shadow-sm backdrop-blur">
              {gpsError}
            </div>
          )}

          {routeError && !beforeSeven && nextDeliveryWithCoordinates && (
            <div className="rounded-2xl bg-[#EEF5FF]/95 px-4 py-3 text-sm text-[#285C9A] shadow-sm backdrop-blur">
              {routeError}
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
        <div className="absolute inset-x-0 bottom-0 z-50 h-[var(--driver-bottom-sheet-height)]">
          <div className="h-full px-2 pb-2">
            <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-t-[2rem] border border-white/70 bg-white/96 shadow-[0_-18px_56px_rgba(15,23,42,0.24)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setSheetMode((currentMode) => (currentMode === "peek" ? "expanded" : "peek"))}
                className="flex items-center justify-center gap-1 px-4 pb-2 pt-3 text-[#6B7280]"
              >
                <span className="h-1.5 w-14 rounded-full bg-[#D1D5DB]" />
                {isSheetExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>

              {!nextDelivery ? (
                <div className="flex flex-1 items-center px-4 pb-4 pt-3">
                  <div className="w-full rounded-[1.5rem] bg-[#F0FAF1] p-4 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1E8A3C] text-white">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-[#17301E]">Tournee terminee</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-left">
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
                <div className="flex h-full min-h-0 flex-col px-4 pb-4">
                  <div className="rounded-[1.6rem] bg-[linear-gradient(145deg,rgba(240,250,241,0.98),rgba(255,255,255,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-[#F0FAF1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1E8A3C]">
                            {isNavigating ? "En travail" : "Pret pour la course"}
                          </span>
                          <span className="inline-flex rounded-full bg-[#EEF5FF] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#285C9A]">
                            {currentRouteDistanceLabel}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate text-lg font-bold text-[#17301E]">{nextDelivery.clientName}</h3>
                        <p className="mt-1 truncate text-sm font-medium text-[#3F5246]">{buildPreciseAddress(nextDelivery)}</p>
                        <p className="mt-1 truncate text-xs text-[#5B6B60]">{buildPaymentSummary(nextDelivery)}</p>
                      </div>

                      <div className="shrink-0 rounded-[1.25rem] bg-white px-3 py-2 text-center shadow-sm">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#6B7280]">Stop</p>
                        <p className="mt-1 text-xl font-black text-[#1E8A3C]">{nextDelivery.stepNumber}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[#6B7280]">
                          <Package className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em]">Colis</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-bold text-[#17301E]">{nextDelivery.packageCount}</p>
                      </div>

                      <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[#6B7280]">
                          <Route className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em]">Route</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-bold text-[#17301E]">
                          {isRouteLoading ? "..." : currentRouteDistanceLabel}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[#6B7280]">
                          <Gauge className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em]">ETA</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-bold text-[#17301E]">
                          {isRouteLoading ? "..." : currentRouteDurationLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isSheetExpanded && (
                    <div className="delivery-sheet-scroll mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
                      <div className="space-y-3 pb-3">
                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Adresse complete</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#17301E]">{nextDelivery.address}</p>
                        </div>

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Paiement</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#17301E]">{buildPaymentSummary(nextDelivery)}</p>
                        </div>

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <Package className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Details colis</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#17301E]">{buildPackageSummary(nextDelivery)}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#6B7280]">GPS</p>
                            <p className="mt-2 text-sm font-bold text-[#17301E]">
                              {driverLocation?.accuracy ? `${Math.round(driverLocation.accuracy)} m` : "En attente"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#6B7280]">Vitesse</p>
                            <p className="mt-2 text-sm font-bold text-[#17301E]">
                              {driverLocation?.speedKmh ? `${Math.round(driverLocation.speedKmh)} km/h` : "N/A"}
                            </p>
                          </div>
                        </div>

                        {activeMissingCoordinatesCount > 0 && (
                          <div className="rounded-2xl bg-[#FFF3E0] px-4 py-3 text-sm text-[#8A5A00]">
                            {activeMissingCoordinatesCount} livraison(s) restante(s) n'ont pas de coordonnees GPS exploitables.
                          </div>
                        )}

                        {!nextDeliveryWithCoordinates && (
                          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                            La prochaine livraison n'a pas de coordonnees GPS. Le guidage embarque est indisponible.
                          </div>
                        )}

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3 text-sm text-[#5B6B60]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-[#1E8A3C]" />
                              <span>{remainingCount} etape(s) restante(s)</span>
                            </div>
                            <span>{routeSummary ? currentRouteDurationLabel : `ETA ${remainingTime}`}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={cn("grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3", isSheetExpanded ? "pt-3" : "mt-auto pt-3")}>
                    <a
                      href={nextDelivery.callHref ?? undefined}
                      aria-disabled={!nextDelivery.callHref}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#F3F4F6] px-3 text-sm font-semibold text-[#17301E] transition-transform active:scale-[0.99]",
                        !nextDelivery.callHref && "pointer-events-none bg-gray-200 text-gray-500"
                      )}
                    >
                      <Phone className="h-5 w-5" />
                    </a>

                    <button
                      type="button"
                      onClick={isNavigating ? handleCompleteCurrentDelivery : handleStartDriveMode}
                      disabled={isStartingTournee || !nextDelivery}
                      className={cn(
                        "flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
                        isNavigating ? "bg-[#1E8A3C]" : "bg-[#17301E]"
                      )}
                    >
                      {isStartingTournee ? (
                        <Spinner className="size-5" />
                      ) : isNavigating ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Navigation className="h-5 w-5" />
                      )}
                      <span className="truncate">{isNavigating ? "Marquer comme livre" : "Demarrer la course"}</span>
                    </button>
                  </div>

                  {!isSheetExpanded && (
                    <button
                      type="button"
                      onClick={() => setSheetMode("expanded")}
                      className="mt-2 w-full text-xs font-medium text-[#285C9A]"
                    >
                      Voir les details de la course
                    </button>
                  )}

                  {isNavigating && (
                    <button
                      type="button"
                      onClick={() => setIsNavigating(false)}
                      className="mt-2 w-full text-xs font-medium text-[#285C9A]"
                    >
                      Revenir a la vue d'ensemble
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
