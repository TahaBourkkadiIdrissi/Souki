"use client"

import { type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  DollarSign,
  Gauge,
  LogOut,
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
  XCircle,
} from "lucide-react"
import type { LineLayerSpecification } from "mapbox-gl"
import MapView, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox"

import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/useAuth"
import {
  ApiError,
  CodValidationResponse,
  confirmerRamassageLivreur,
  DeliveryEventRequest,
  DeliveryEventResponse,
  envoyerEvenementLivraison,
  getLivreurTournee,
  refuserTourneeLivreur,
  TourneeItem,
  TourneeResponse,
  validerPaiementCodLivreur,
} from "@/lib/api"
import {
  enqueueDeliverySyncEvent,
  getAllDeliverySyncEvents,
  removeDeliverySyncEvent,
  type DeliverySyncQueueItem,
} from "@/lib/delivery-sync-queue"
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
const GPS_BOOTSTRAP_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 12000,
}
const ROUTE_REFRESH_DISTANCE_METERS = 40
const ROUTE_REFRESH_INTERVAL_MS = 15000
const ROUTE_OVERVIEW_PADDING = { top: 140, bottom: 190, left: 28, right: 28 }
const DRIVE_MODE_PADDING = { top: 100, bottom: 190, left: 20, right: 20 }
const ASSIGNMENT_REFUSED_STATUS = "REFUS_LIVREUR"
const STARTED_DELIVERY_STATUS = "EN_ROUTE"
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

type DeliveryStatus = "pending" | "enroute" | "delivered" | "absent" | "refused"
type DeliveryBackendStatus = DeliveryEventRequest["target_status"]
type PaymentMethod = "cod" | "wallet" | "cmi"
type NoticeTone = "info" | "success" | "error"
type SheetMode = "peek" | "expanded"

interface DeliveryViewItem {
  id: string
  stepNumber: number
  supplierId: string | null
  supplierName: string | null
  supplierAddress: string | null
  supplierPhone: string | null
  supplierLat: number | null
  supplierLng: number | null
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
  paymentValidated: boolean
  status: DeliveryStatus
  rawStatus: string
  statusVersion: number
  enrouteAt: string | null
  deliveredAt: string | null
  absentAt: string | null
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

interface RouteStop {
  id: string
  kind: "driver" | "supplier" | "delivery"
  label: string
  coordinate: [number, number]
  deliveryId?: string
  stepNumber?: number
}

type CoordinateOverrideMap = Record<string, { lat: number; lng: number }>

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
    fournisseur_latitude: normalizeCoordinate(item.fournisseur_latitude ?? item.pickup_lat),
    fournisseur_longitude: normalizeCoordinate(item.fournisseur_longitude ?? item.pickup_lng),
    pickup_lat: normalizeCoordinate(item.pickup_lat ?? item.fournisseur_latitude),
    pickup_lng: normalizeCoordinate(item.pickup_lng ?? item.fournisseur_longitude),
  }
}

function normalizeTourneeResponse(response: TourneeResponse): TourneeResponse {
  const pickup = response.pickup
    ? {
        ...response.pickup,
        latitude: normalizeCoordinate(response.pickup.latitude),
        longitude: normalizeCoordinate(response.pickup.longitude),
      }
    : null

  return {
    ...response,
    tournee_id: response.tournee_id ?? null,
    pickup,
    ramassee: Boolean(response.ramassee),
    ramasse_at: response.ramasse_at ?? null,
    items: Array.isArray(response.items) ? response.items.map(normalizeTourneeItem) : [],
  }
}

function formatLocalDateKey(dateValue: Date) {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, "0")
  const day = String(dateValue.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeTourneeDateKey(dateValue?: string | null) {
  if (!dateValue) {
    return null
  }

  const trimmedValue = dateValue.trim()
  if (!trimmedValue) {
    return null
  }

  const directMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) {
    return directMatch[1]
  }

  const parsedDate = new Date(trimmedValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return formatLocalDateKey(parsedDate)
}

function isTourneeForCurrentDay(response: TourneeResponse) {
  const responseDateKey = normalizeTourneeDateKey(response.date_jour)
  if (!responseDateKey) {
    return false
  }

  return responseDateKey === formatLocalDateKey(new Date())
}

function isTerminalDeliveryStatus(status: string) {
  const normalizedStatus = normalizeDeliveryStatus(status)
  return normalizedStatus === "delivered" || normalizedStatus === "absent" || normalizedStatus === "refused"
}

function shouldPreferCachedStatus(apiStatus: string, cachedStatus: string) {
  const normalizedApiStatus = normalizeDeliveryStatus(apiStatus)
  const normalizedCachedStatus = normalizeDeliveryStatus(cachedStatus)

  if (normalizedCachedStatus === "delivered" || normalizedCachedStatus === "absent" || normalizedCachedStatus === "refused") {
    return normalizedApiStatus !== normalizedCachedStatus
  }

  return normalizedCachedStatus === "enroute" && normalizedApiStatus === "pending"
}

function mergeTourneeWithCache(apiResponse: TourneeResponse, cachedResponse: TourneeResponse | null) {
  const normalizedApiResponse = normalizeTourneeResponse(apiResponse)
  if (!cachedResponse) {
    return normalizedApiResponse
  }

  const normalizedCachedResponse = normalizeTourneeResponse(cachedResponse)
  const apiDateKey = normalizeTourneeDateKey(normalizedApiResponse.date_jour)
  const cachedDateKey = normalizeTourneeDateKey(normalizedCachedResponse.date_jour)

  if (!apiDateKey || !cachedDateKey || apiDateKey !== cachedDateKey) {
    return normalizedApiResponse
  }

  if (
    normalizedApiResponse.items.length === 0 &&
    normalizedCachedResponse.items.length > 0 &&
    normalizedCachedResponse.items.every((item) => isTerminalDeliveryStatus(item.statut))
  ) {
    return {
      ...normalizedCachedResponse,
      date_jour: normalizedApiResponse.date_jour,
      sort_strategy: normalizedApiResponse.sort_strategy || normalizedCachedResponse.sort_strategy,
      status: normalizedApiResponse.status || normalizedCachedResponse.status,
      available_after: normalizedApiResponse.available_after || normalizedCachedResponse.available_after,
      tournee_started: true,
    }
  }

  const cachedItemsById = new Map(
    normalizedCachedResponse.items.map((item) => [String(item.commande_id), item] as const)
  )

  const mergedItems = normalizedApiResponse.items.map((item) => {
    const cachedItem = cachedItemsById.get(String(item.commande_id))
    if (!cachedItem || !shouldPreferCachedStatus(item.statut, cachedItem.statut)) {
      return item
    }

    return {
      ...item,
      statut: cachedItem.statut,
      payment_validated:
        cachedItem.payment_validated === true ? true : (item.payment_validated ?? cachedItem.payment_validated ?? null),
      status_version:
        Number(cachedItem.status_version || 1) >= Number(item.status_version || 1)
          ? cachedItem.status_version
          : item.status_version,
      enroute_at: cachedItem.enroute_at ?? item.enroute_at ?? null,
      delivered_at: cachedItem.delivered_at ?? item.delivered_at ?? null,
      absent_at: cachedItem.absent_at ?? item.absent_at ?? null,
    }
  })

  const hasCompletedSteps = mergedItems.some((item) => isTerminalDeliveryStatus(item.statut))

  return {
    ...normalizedApiResponse,
    items: mergedItems,
    tournee_started:
      normalizedApiResponse.tournee_started ||
      mergedItems.some((item) => normalizeBackendStatus(item.statut) === STARTED_DELIVERY_STATUS) ||
      hasCompletedSteps,
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
    const parsedResponse = normalizeTourneeResponse(JSON.parse(rawValue) as TourneeResponse)
    if (!isTourneeForCurrentDay(parsedResponse)) {
      window.localStorage.removeItem(CACHE_KEY)
      return null
    }

    return parsedResponse
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

  if (normalizedStatus === "EN_ROUTE" || normalizedStatus === "EN_COURS_DE_LIVRAISON") {
    return "enroute"
  }

  if (normalizedStatus === "LIVRE" || normalizedStatus === "LIVREE" || normalizedStatus === "DELIVERED") {
    return "delivered"
  }

  if (normalizedStatus === "ABSENT") {
    return "absent"
  }

  if (
    normalizedStatus === "REFUS" ||
    normalizedStatus === "REFUSE" ||
    normalizedStatus === "REFUSED" ||
    normalizedStatus === ASSIGNMENT_REFUSED_STATUS
  ) {
    return "refused"
  }

  return "pending"
}

function mapDeliveryStatusToBackendStatus(status: DeliveryStatus) {
  if (status === "enroute") {
    return "EN_ROUTE"
  }

  if (status === "delivered") {
    return "LIVRE"
  }

  if (status === "absent") {
    return "ABSENT"
  }

  if (status === "refused") {
    return "REFUS"
  }

  return "A_LIVRER"
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
    supplierId: item.fournisseur_id != null ? String(item.fournisseur_id) : null,
    supplierName: item.fournisseur_nom ?? item.fournisseur_shop_name ?? null,
    supplierAddress: item.fournisseur_address ?? null,
    supplierPhone: item.fournisseur_phone ?? null,
    supplierLat: item.fournisseur_latitude ?? item.pickup_lat ?? null,
    supplierLng: item.fournisseur_longitude ?? item.pickup_lng ?? null,
    orderNumber: String(item.commande_id),
    timeSlot: item.creneau_livraison || "Non précisé",
    address: item.full_address,
    street: item.street,
    neighborhood: item.neighborhood,
    details: item.details,
    clientName: item.client_label,
    clientPhone: item.client_phone || "Téléphone indisponible",
    callHref: buildCallHref(item.client_phone),
    packageCount: item.colis_count,
    amount: Number(item.montant_total || 0),
    paymentMethod: normalizePaymentMethod(item.mode_paiement),
    paymentValidated: Boolean(item.payment_validated),
    status: normalizeDeliveryStatus(item.statut),
    rawStatus: item.statut,
    statusVersion: Number(item.status_version || 1),
    enrouteAt: item.enroute_at ?? null,
    deliveredAt: item.delivered_at ?? null,
    absentAt: item.absent_at ?? null,
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

function getDeliveryCoordinate(item: DeliveryViewItem, overrides: CoordinateOverrideMap) {
  if (hasCoordinates(item)) {
    return { lat: item.lat, lng: item.lng }
  }

  const override = overrides[item.id]
  if (
    override &&
    typeof override.lat === "number" &&
    Number.isFinite(override.lat) &&
    typeof override.lng === "number" &&
    Number.isFinite(override.lng)
  ) {
    return override
  }

  return null
}

function hasEffectiveCoordinates(item: DeliveryViewItem, overrides: CoordinateOverrideMap) {
  return getDeliveryCoordinate(item, overrides) !== null
}

function isActiveDelivery(item: DeliveryViewItem) {
  return item.status === "pending" || item.status === "enroute"
}

function isPendingAssignmentDelivery(item: DeliveryViewItem) {
  return normalizeBackendStatus(item.rawStatus) === "EN_ATTENTE_LIVREUR"
}

function formatPaymentMethodLabel(paymentMethod: PaymentMethod) {
  if (paymentMethod === "wallet") {
    return "Wallet"
  }

  if (paymentMethod === "cmi") {
    return "CMI"
  }

  return "Espèces"
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
  return firstAddressSegment || "Adresse non précisée"
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
  return buildMultiStopDirectionsUrl([origin, destination])
}

function buildMultiStopDirectionsUrl(stops: [number, number][]) {
  const coordinates = stops.map((coordinate) => `${coordinate[0]},${coordinate[1]}`).join(";")
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

function coordinateKey(coordinate: [number, number]) {
  return `${coordinate[0].toFixed(6)},${coordinate[1].toFixed(6)}`
}

function areSameCoordinate(first: [number, number], second: [number, number]) {
  return coordinateKey(first) === coordinateKey(second)
}

function areStringArraysEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false
  }

  return first.every((value, index) => value === second[index])
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
  const { token, isLoading: isAuthLoading, isAuthenticated, can, logout } = useAuth()
  const hasLivreurAccess = can("livreur.dashboard.access")
  const mapRef = useRef<MapRef | null>(null)
  const deliveryListRef = useRef<DeliveryViewItem[]>([])
  const lastDriverLocationRef = useRef<DriverLocation | null>(null)
  const isLocationRequestPendingRef = useRef(false)
  const isQueueSyncInFlightRef = useRef(false)
  const lastDirectionsRequestRef = useRef<{
    origin: [number, number]
    stopsKey: string
    timestamp: number
  } | null>(null)

  const [deliveryList, setDeliveryList] = useState<DeliveryViewItem[]>([])
  const [tourneeData, setTourneeData] = useState<TourneeResponse | null>(null)
  const [isOnDuty, setIsOnDuty] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [isTourneeLoading, setIsTourneeLoading] = useState(true)
  const [isStartingTournee, setIsStartingTournee] = useState(false)
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false)
  const [isValidatingCodPayment, setIsValidatingCodPayment] = useState(false)
  const [isLoadingRefus, setIsLoadingRefus] = useState(false)
  const [isRefusingTournee, setIsRefusingTournee] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }
  const [beforeSeven, setBeforeSeven] = useState(false)
  const [tourneeStarted, setTourneeStarted] = useState(false)
  const [loadSource, setLoadSource] = useState<"api" | "cache" | null>(null)
  const [notice, setNotice] = useState<PageNotice | null>(null)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [activeNavigationDeliveryId, setActiveNavigationDeliveryId] = useState<string | null>(null)
  const [sheetMode, setSheetMode] = useState<SheetMode>("peek")
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)
  const [isDriverFocusEnabled, setIsDriverFocusEnabled] = useState(true)
  const [routeGeoJson, setRouteGeoJson] = useState<LineFeatureCollection>(EMPTY_ROUTE_GEOJSON)
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null)
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [deliveryCoordinateOverrides, setDeliveryCoordinateOverrides] = useState<CoordinateOverrideMap>({})
  const [geocodingDeliveryIds, setGeocodingDeliveryIds] = useState<string[]>([])
  const [failedGeocodingDeliveryIds, setFailedGeocodingDeliveryIds] = useState<string[]>([])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timeoutId = window.setTimeout(
      () => setNotice(null),
      notice.tone === "error" ? 5200 : 3600
    )

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const handleConfirmPickup = async () => {
    if (!token || !tourneeData?.tournee_id || tourneeData.ramassee) {
      return
    }
    setIsConfirmingPickup(true)
    setNotice(null)
    try {
      const response = await confirmerRamassageLivreur(token, tourneeData.tournee_id)
      const nextTournee = {
        ...tourneeData,
        ramassee: true,
        ramasse_at: response.ramasse_at,
        items: tourneeData.items.map((item) =>
          normalizeBackendStatus(item.statut) === "EN_ATTENTE_LIVREUR"
            ? {
                ...item,
                statut: "A_LIVRER",
              }
            : item
        ),
      }
      applyTourneeData(nextTournee, "api")
      writeCachedTournee(nextTournee)
      setNotice({
        tone: "success",
        message: `${response.commandes_ramassees} commande(s) ramassée(s). Les livraisons sont débloquées.`,
      })
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Impossible de confirmer le ramassage.",
      })
    } finally {
      setIsConfirmingPickup(false)
    }
  }

  const applyTourneeData = useEffectEvent((response: TourneeResponse, source: "api" | "cache") => {
    const normalizedResponse = normalizeTourneeResponse(response)
    const hasCompletedSteps = normalizedResponse.items.some((item) => isTerminalDeliveryStatus(item.statut))
    const hasStartedSteps = normalizedResponse.items.some(
      (item) => normalizeBackendStatus(item.statut) === STARTED_DELIVERY_STATUS
    )

    setTourneeData(normalizedResponse)
    setDeliveryList(normalizedResponse.items.map(mapTourneeItemToDeliveryView))
    setTourneeStarted(normalizedResponse.tournee_started || hasStartedSteps || hasCompletedSteps)
    setLoadSource(source)
    setBeforeSeven(false)
  })

  useEffect(() => {
    deliveryListRef.current = deliveryList
  }, [deliveryList])

  const loadCachedTournee = useEffectEvent((fallbackMessage: string) => {
    const cachedTournee = readCachedTournee()
    if (!cachedTournee) {
      return false
    }

    applyTourneeData(cachedTournee, "cache")
    setNotice({ tone: "info", message: fallbackMessage })
    return true
  })

  const refreshTourneeFromServer = useEffectEvent(async () => {
    if (!token) {
      return
    }

    try {
      const response = await getLivreurTournee(token)
      const mergedResponse = mergeTourneeWithCache(response, null)
      writeCachedTournee(mergedResponse)
      applyTourneeData(mergedResponse, "api")
    } catch {
      // Keep the rollback snapshot visible if the refresh itself fails.
    }
  })

  const applyLocalDeliverySnapshot = useEffectEvent((snapshot: DeliveryViewItem) => {
    setDeliveryList((previousList) =>
      previousList.map((item) =>
        item.id === snapshot.id
          ? {
              ...item,
              status: snapshot.status,
              rawStatus: snapshot.rawStatus,
              statusVersion: snapshot.statusVersion,
              enrouteAt: snapshot.enrouteAt,
              deliveredAt: snapshot.deliveredAt,
              absentAt: snapshot.absentAt,
            }
          : item
      )
    )

    setTourneeData((previousTournee) => {
      if (!previousTournee) {
        return previousTournee
      }

      const nextTournee = {
        ...previousTournee,
        items: previousTournee.items.map((item) =>
          String(item.commande_id) === snapshot.id
            ? {
                ...item,
                statut: snapshot.rawStatus,
                status_version: snapshot.statusVersion,
                enroute_at: snapshot.enrouteAt,
                delivered_at: snapshot.deliveredAt,
                absent_at: snapshot.absentAt,
              }
            : item
        ),
      }

      writeCachedTournee(nextTournee)
      return nextTournee
    })
  })

  const applyLocalDeliveryMutation = useEffectEvent((commandeId: string, nextStatus: DeliveryStatus, nextVersion?: number) => {
    const nextRawStatus = mapDeliveryStatusToBackendStatus(nextStatus)
    const nowIso = new Date().toISOString()

    setTourneeStarted(true)
    setDeliveryList((previousList) =>
      previousList.map((item) => {
        if (item.id !== commandeId) {
          return item
        }

        return {
          ...item,
          status: nextStatus,
          rawStatus: nextRawStatus,
          statusVersion: nextVersion ?? item.statusVersion + 1,
          enrouteAt: nextStatus === "enroute" ? nowIso : item.enrouteAt,
          deliveredAt: nextStatus === "delivered" ? nowIso : item.deliveredAt,
          absentAt: nextStatus === "absent" ? nowIso : item.absentAt,
        }
      })
    )

    setTourneeData((previousTournee) => {
      if (!previousTournee) {
        return previousTournee
      }

      const nextTournee = {
        ...previousTournee,
        tournee_started: true,
        items: previousTournee.items.map((item) =>
          String(item.commande_id) === commandeId
            ? {
                ...item,
                statut: nextRawStatus,
                status_version: nextVersion ?? Number(item.status_version || 1) + 1,
                enroute_at: nextStatus === "enroute" ? nowIso : item.enroute_at ?? null,
                delivered_at: nextStatus === "delivered" ? nowIso : item.delivered_at ?? null,
                absent_at: nextStatus === "absent" ? nowIso : item.absent_at ?? null,
              }
            : item
        ),
      }

      writeCachedTournee(nextTournee)
      return nextTournee
    })
  })

  const applyServerDeliveryEvent = useEffectEvent((response: DeliveryEventResponse) => {
    const nextStatus = normalizeDeliveryStatus(response.new_status)
    const shouldMarkTourneeStarted =
      nextStatus === "enroute" || nextStatus === "delivered" || nextStatus === "absent" || nextStatus === "refused"

    if (shouldMarkTourneeStarted) {
      setTourneeStarted(true)
    }
    setDeliveryList((previousList) =>
      previousList.map((item) =>
        item.id === String(response.commande_id)
          ? {
              ...item,
              status: nextStatus,
              rawStatus: response.new_status,
              statusVersion: response.status_version,
              enrouteAt: response.enroute_at ?? item.enrouteAt,
              deliveredAt: response.delivered_at ?? item.deliveredAt,
              absentAt: response.absent_at ?? item.absentAt,
            }
          : item
      )
    )

    setTourneeData((previousTournee) => {
      if (!previousTournee) {
        return previousTournee
      }

      const nextTournee = {
        ...previousTournee,
        tournee_started: previousTournee.tournee_started || shouldMarkTourneeStarted,
        items: previousTournee.items.map((item) =>
          item.commande_id === response.commande_id
            ? {
                ...item,
                statut: response.new_status,
                status_version: response.status_version,
                enroute_at: response.enroute_at ?? item.enroute_at ?? null,
                delivered_at: response.delivered_at ?? item.delivered_at ?? null,
                absent_at: response.absent_at ?? item.absent_at ?? null,
              }
            : item
        ),
      }

      writeCachedTournee(nextTournee)
      return nextTournee
    })
  })

  const clearLocalTournee = useEffectEvent(() => {
    setDeliveryList([])
    deliveryListRef.current = []
    setTourneeStarted(false)
    setActiveNavigationDeliveryId(null)
    setIsNavigating(false)
    setRouteGeoJson(EMPTY_ROUTE_GEOJSON)
    setRouteSummary(null)
    setRouteError(null)
    setIsRouteLoading(false)
    setSheetMode("peek")
    lastDirectionsRequestRef.current = null

    setTourneeData((previousTournee) => {
      if (!previousTournee) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(CACHE_KEY)
        }
        return previousTournee
      }

      const nextTournee = {
        ...previousTournee,
        tournee_started: false,
        items: [],
      }

      writeCachedTournee(nextTournee)
      return nextTournee
    })
  })

  const removePendingAssignmentsFromLocalTournee = useEffectEvent(() => {
    const pendingIds = new Set(
      deliveryListRef.current.filter(isPendingAssignmentDelivery).map((item) => item.id)
    )
    if (pendingIds.size === 0) {
      return
    }

    setDeliveryList((previousList) => previousList.filter((item) => !pendingIds.has(item.id)))

    if (activeNavigationDeliveryId && pendingIds.has(activeNavigationDeliveryId)) {
      setActiveNavigationDeliveryId(null)
      setIsNavigating(false)
      setRouteGeoJson(EMPTY_ROUTE_GEOJSON)
      setRouteSummary(null)
      setRouteError(null)
      setIsRouteLoading(false)
      setSheetMode("peek")
      lastDirectionsRequestRef.current = null
    }

    setTourneeData((previousTournee) => {
      if (!previousTournee) {
        return previousTournee
      }

      const nextTournee = {
        ...previousTournee,
        items: previousTournee.items.filter(
          (item) => normalizeBackendStatus(item.statut) !== "EN_ATTENTE_LIVREUR"
        ),
      }

      writeCachedTournee(nextTournee)
      return nextTournee
    })
  })

  const applyCodPaymentValidation = useEffectEvent((commandeId: string, validated: boolean) => {
    setDeliveryList((previousList) =>
      previousList.map((item) =>
        item.id === commandeId
          ? {
              ...item,
              paymentValidated: validated,
            }
          : item
      )
    )

    setTourneeData((previousTournee) => {
      if (!previousTournee) {
        return previousTournee
      }

      const nextTournee = {
        ...previousTournee,
        items: previousTournee.items.map((item) =>
          String(item.commande_id) === commandeId
            ? {
                ...item,
                payment_validated: validated,
              }
            : item
        ),
      }

      writeCachedTournee(nextTournee)
      return nextTournee
    })
  })

  const refreshTourneeFromApi = useEffectEvent(async () => {
    if (!token || typeof window === "undefined" || !window.navigator.onLine) {
      return false
    }

    try {
      const response = await getLivreurTournee(token)
      const mergedResponse = mergeTourneeWithCache(response, readCachedTournee())
      writeCachedTournee(mergedResponse)
      applyTourneeData(mergedResponse, "api")
      return true
    } catch {
      return false
    }
  })

  const flushDeliverySyncQueue = useEffectEvent(async () => {
    if (typeof window === "undefined" || !token || !window.navigator.onLine || isQueueSyncInFlightRef.current) {
      return
    }

    isQueueSyncInFlightRef.current = true
    let shouldRefreshTournee = false

    try {
      const queuedEvents = await getAllDeliverySyncEvents()
      for (const queuedEvent of queuedEvents) {
        try {
          const response = await envoyerEvenementLivraison(token, queuedEvent.commandeId, {
            target_status: queuedEvent.targetStatus,
            client_event_id: queuedEvent.clientEventId,
            device_timestamp: queuedEvent.deviceTimestamp,
            expected_version: queuedEvent.expectedVersion,
          })
          await removeDeliverySyncEvent(queuedEvent.clientEventId)
          applyServerDeliveryEvent(response)
        } catch (error) {
          if (error instanceof ApiError) {
            await removeDeliverySyncEvent(queuedEvent.clientEventId)
            shouldRefreshTournee = true
            setNotice({ tone: "error", message: error.message })
            continue
          }

          break
        }
      }
    } finally {
      isQueueSyncInFlightRef.current = false
      if (shouldRefreshTournee) {
        void refreshTourneeFromApi()
      }
    }
  })

  const submitDeliveryStatusChange = useEffectEvent(
    async ({
      delivery,
      targetStatus,
      offlineMessage,
      clientEventIdOverride,
    }: {
      delivery: DeliveryViewItem
      targetStatus: DeliveryStatus
      offlineMessage: string
      clientEventIdOverride?: string
    }) => {
      if (!token) {
        setNotice({ tone: "error", message: "Session livreur requise pour mettre a jour la livraison." })
        return false
      }

      if (targetStatus === "delivered" && delivery.paymentMethod === "cod" && !delivery.paymentValidated) {
        setNotice({ tone: "error", message: "Encaissement COD non valide. Livraison bloquee." })
        return false
      }

      const previousSnapshot = { ...delivery }
      const clientEventId =
        clientEventIdOverride ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${delivery.id}-${Date.now()}`)
      const deviceTimestamp = new Date().toISOString()
      const queueItem: DeliverySyncQueueItem = {
        clientEventId,
        commandeId: delivery.id,
        targetStatus: mapDeliveryStatusToBackendStatus(targetStatus) as DeliveryBackendStatus,
        deviceTimestamp,
        expectedVersion: delivery.statusVersion,
        createdAt: Date.now(),
      }

      applyLocalDeliveryMutation(delivery.id, targetStatus, delivery.statusVersion + 1)
      await enqueueDeliverySyncEvent(queueItem)

      if (typeof window !== "undefined" && !window.navigator.onLine) {
        setNotice({ tone: "info", message: offlineMessage })
        return true
      }

      try {
        const response = await envoyerEvenementLivraison(token, delivery.id, {
          target_status: queueItem.targetStatus,
          client_event_id: clientEventId,
          device_timestamp: deviceTimestamp,
          expected_version: delivery.statusVersion,
        })

        await removeDeliverySyncEvent(clientEventId)
        applyServerDeliveryEvent(response)
        setNotice({ tone: "success", message: response.message })
        return true
      } catch (error) {
        if (error instanceof ApiError) {
          await removeDeliverySyncEvent(clientEventId)
          applyLocalDeliverySnapshot(previousSnapshot)
          await refreshTourneeFromServer()
          setNotice({ tone: "error", message: error.message })
          return false
        }

        setNotice({ tone: "info", message: offlineMessage })
        return true
      }
    }
  )

  const applyDriverPosition = useEffectEvent((position: GeolocationPosition) => {
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
    setIsRequestingLocation(false)
  })

  const requestCurrentLocation = useEffectEvent(
    ({
      showNoticeOnError = false,
      recenterAfterSuccess = false,
      showLoadingState = false,
    }: {
      showNoticeOnError?: boolean
      recenterAfterSuccess?: boolean
      showLoadingState?: boolean
    } = {}) => {
      if (typeof window === "undefined") {
        return
      }

      if (!window.isSecureContext) {
        const message = "La geolocalisation mobile exige une page HTTPS securisee."
        setGpsError(message)
        if (showNoticeOnError) {
          setNotice({ tone: "error", message })
        }
        return
      }

      if (!("geolocation" in window.navigator)) {
        const message = "Le GPS du navigateur n'est pas disponible sur cet appareil."
        setGpsError(message)
        if (showNoticeOnError) {
          setNotice({ tone: "error", message })
        }
        return
      }

      if (isLocationRequestPendingRef.current) {
        return
      }

      isLocationRequestPendingRef.current = true
      if (showLoadingState) {
        setIsRequestingLocation(true)
      }
      window.navigator.geolocation.getCurrentPosition(
        (position) => {
          isLocationRequestPendingRef.current = false
          applyDriverPosition(position)

          if (recenterAfterSuccess) {
            window.requestAnimationFrame(() => {
              handleRecenterToDriver()
            })
          }
        },
        (error) => {
          isLocationRequestPendingRef.current = false
          if (showLoadingState) {
            setIsRequestingLocation(false)
          }

          if (error.code === error.PERMISSION_DENIED) {
            if (showNoticeOnError) {
              setNotice({
                tone: "error",
                message: "Activez la localisation du navigateur sur mobile pour suivre le trajet.",
              })
            }
            return
          }

          const message =
            error.code === error.TIMEOUT
              ? "La position GPS tarde a arriver. Reessayez en exterieur ou pres d'une fenetre."
              : "Impossible d'obtenir la position GPS actuelle sur cet appareil."
          setGpsError(message)
          if (showNoticeOnError) {
            setNotice({ tone: "error", message })
          }
        },
        GPS_BOOTSTRAP_OPTIONS
      )
    }
  )

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

    if (!window.isSecureContext) {
      setGpsError("La geolocalisation mobile exige une page HTTPS securisee.")
      return
    }

    if (!("geolocation" in window.navigator)) {
      setGpsError("Le GPS du navigateur n'est pas disponible sur cet appareil.")
      return
    }

    let isCancelled = false
    requestCurrentLocation()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestCurrentLocation()
      }
    }

    const watchId = window.navigator.geolocation.watchPosition(
      (position) => {
        if (isCancelled) {
          return
        }

        applyDriverPosition(position)
      },
      (error) => {
        if (isCancelled) {
          return
        }

        if (error.code === error.PERMISSION_DENIED) {
          setGpsError(null)
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

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      isCancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.navigator.geolocation.clearWatch(watchId)
    }
  }, [applyDriverPosition, requestCurrentLocation])

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
      setNotice({ tone: "error", message: "Connectez-vous pour consulter votre tournée." })
      return
    }

    let isCancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 8000)

    const loadTournee = async () => {
      setIsTourneeLoading(true)
      setNotice(null)

      if (!window.navigator.onLine) {
        const hasCache = loadCachedTournee("Mode hors ligne. Affichage de la dernière tournée enregistrée.")
        if (!hasCache) {
          setTourneeData(null)
          setDeliveryList([])
          setLoadSource(null)
          setNotice({ tone: "error", message: "Mode hors ligne et aucune tournée n'est disponible en cache." })
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

        const mergedResponse = mergeTourneeWithCache(response, readCachedTournee())
        writeCachedTournee(mergedResponse)
        applyTourneeData(mergedResponse, "api")
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
            ? "Le chargement a expiré. Affichage de la dernière tournée enregistrée."
            : "Serveur indisponible. Affichage de la dernière tournée enregistrée."
          const hasCache = loadCachedTournee(cacheMessage)

          if (!hasCache) {
            setTourneeData(null)
            setDeliveryList([])
            setLoadSource(null)
            setNotice({
              tone: "error",
              message: isTimeout
                ? "Le chargement a expiré et aucune tournée n'est disponible en cache."
                : error instanceof Error
                  ? error.message
                  : "Impossible de charger la tournée.",
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

  useEffect(() => {
    if (!token || typeof window === "undefined") {
      return
    }

    void flushDeliverySyncQueue()

    const handleOnline = () => {
      void flushDeliverySyncQueue()
    }

    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener("online", handleOnline)
    }
  }, [flushDeliverySyncQueue, token])

  const mappableDeliveries = deliveryList.filter((item) => hasEffectiveCoordinates(item, deliveryCoordinateOverrides))
  const pickupCoordinates =
    tourneeData?.pickup?.latitude != null &&
    tourneeData.pickup.longitude != null &&
    Number.isFinite(tourneeData.pickup.latitude) &&
    Number.isFinite(tourneeData.pickup.longitude)
      ? {
          lat: tourneeData.pickup.latitude,
          lng: tourneeData.pickup.longitude,
        }
      : null
  const pickupStop =
    pickupCoordinates
      ? {
          id: tourneeData?.pickup?.fournisseur_id != null ? String(tourneeData.pickup.fournisseur_id) : "tournee-pickup",
          label: tourneeData?.pickup?.shop_name || "Fournisseur",
          coordinate: [pickupCoordinates.lng, pickupCoordinates.lat] as [number, number],
        }
      : null
  const isPickupPhase = Boolean(tourneeData && !tourneeData.ramassee && pickupStop)
  const activeDeliveries = useMemo(() => deliveryList.filter(isActiveDelivery), [deliveryList])
  const nextDelivery = activeDeliveries[0] ?? null
  const navigatingDelivery = activeNavigationDeliveryId
    ? deliveryList.find((item) => item.id === activeNavigationDeliveryId && isActiveDelivery(item)) ?? null
    : null
  const currentDelivery = isNavigating ? navigatingDelivery ?? nextDelivery : nextDelivery
  const futureDeliveries = activeDeliveries.filter((item) => item.id !== currentDelivery?.id)
  const nextDeliveryCoordinates = currentDelivery ? getDeliveryCoordinate(currentDelivery, deliveryCoordinateOverrides) : null
  const nextDeliveryWithCoordinates = currentDelivery && nextDeliveryCoordinates ? currentDelivery : null
  const nextDeliveryIndex = currentDelivery ? deliveryList.findIndex((item) => item.id === currentDelivery.id) : -1
  const fallbackRouteStartCoordinates = pickupStop?.coordinate ?? ([FES_START_COORDINATE[0], FES_START_COORDINATE[1]] as [number, number])
  const routeOriginCoordinates = driverLocation
    ? ([driverLocation.longitude, driverLocation.latitude] as [number, number])
    : fallbackRouteStartCoordinates
  const routeDeliveries = isPickupPhase ? [] : isNavigating && currentDelivery ? [currentDelivery, ...futureDeliveries] : activeDeliveries
  const routeStops: RouteStop[] = [
    {
      id: "driver",
      kind: "driver",
      label: "Position livreur",
      coordinate: routeOriginCoordinates,
    },
  ]
  const visitedSupplierKeys = new Set<string>()

  if (isPickupPhase && pickupStop) {
    const lastStop = routeStops[routeStops.length - 1]
    if (!lastStop || !areSameCoordinate(lastStop.coordinate, pickupStop.coordinate)) {
      routeStops.push({
        id: `supplier-${pickupStop.id}`,
        kind: "supplier",
        label: pickupStop.label,
        coordinate: pickupStop.coordinate,
      })
    }
  }

  for (const delivery of routeDeliveries) {
    const supplierCoordinate =
      delivery.supplierLat != null &&
      delivery.supplierLng != null &&
      Number.isFinite(delivery.supplierLat) &&
      Number.isFinite(delivery.supplierLng)
        ? ([delivery.supplierLng, delivery.supplierLat] as [number, number])
        : pickupStop?.coordinate

    if (supplierCoordinate && !tourneeData?.ramassee) {
      const supplierKey = delivery.supplierId || coordinateKey(supplierCoordinate)
      if (!visitedSupplierKeys.has(supplierKey)) {
        const lastStop = routeStops[routeStops.length - 1]
        if (!lastStop || !areSameCoordinate(lastStop.coordinate, supplierCoordinate)) {
          routeStops.push({
            id: `supplier-${supplierKey}`,
            kind: "supplier",
            label: delivery.supplierName || pickupStop?.label || "Fournisseur",
            coordinate: supplierCoordinate,
          })
        }
        visitedSupplierKeys.add(supplierKey)
      }
    }

    const deliveryMapCoordinate = getDeliveryCoordinate(delivery, deliveryCoordinateOverrides)
    if (deliveryMapCoordinate) {
      const deliveryCoordinate: [number, number] = [deliveryMapCoordinate.lng, deliveryMapCoordinate.lat]
      const lastStop = routeStops[routeStops.length - 1]
      if (!lastStop || !areSameCoordinate(lastStop.coordinate, deliveryCoordinate)) {
        routeStops.push({
          id: `delivery-${delivery.id}`,
          kind: "delivery",
          label: `Commande #${delivery.orderNumber}`,
          coordinate: deliveryCoordinate,
          deliveryId: delivery.id,
          stepNumber: delivery.stepNumber,
        })
      }
    }
  }

  const routePlanCoordinates = routeStops.map((stop) => stop.coordinate)
  const routePlanKey = routeStops.map((stop) => `${stop.kind}:${stop.id}:${coordinateKey(stop.coordinate)}`).join("|")
  const supplierMarkers = routeStops.filter((stop) => stop.kind === "supplier")
  const activeMissingCoordinatesCount = activeDeliveries.filter((item) => !hasEffectiveCoordinates(item, deliveryCoordinateOverrides)).length
  const isMapboxConfigured = MAPBOX_TOKEN.length > 0
  const isCurrentDeliveryGeocoding = currentDelivery ? geocodingDeliveryIds.includes(currentDelivery.id) : false
  const didCurrentDeliveryGeocodingFail = currentDelivery ? failedGeocodingDeliveryIds.includes(currentDelivery.id) : false
  const deliveriesToGeocode = useMemo(
    () =>
      activeDeliveries.filter(
        (delivery) =>
          !hasCoordinates(delivery) &&
          !deliveryCoordinateOverrides[delivery.id] &&
          Boolean(delivery.address?.trim())
      ),
    [activeDeliveries, deliveryCoordinateOverrides]
  )
  const geocodeQueueKey = deliveriesToGeocode
    .map((delivery) => `${delivery.id}:${delivery.address}:${delivery.street}:${delivery.neighborhood}`)
    .join("|")
  const geocodeProximityKey = driverLocation
    ? `${driverLocation.longitude.toFixed(5)},${driverLocation.latitude.toFixed(5)}`
    : pickupStop
      ? coordinateKey(pickupStop.coordinate)
      : "no-proximity"
  const routeOriginLongitude = routeOriginCoordinates[0]
  const routeOriginLatitude = routeOriginCoordinates[1]

  useEffect(() => {
    if (!currentDelivery) {
      setIsNavigating(false)
      setActiveNavigationDeliveryId(null)
      setSheetMode("peek")
    }
  }, [currentDelivery])

  useEffect(() => {
    if (isNavigating) {
      setSheetMode("peek")
    }
  }, [isNavigating])

  useEffect(() => {
    if (!isMapboxConfigured || isOffline || activeDeliveries.length === 0) {
      return
    }

    if (deliveriesToGeocode.length === 0) {
      return
    }

    let isCancelled = false
    const controller = new AbortController()

    const geocodeDeliveries = async () => {
      const nextOverrides: CoordinateOverrideMap = {}
      const failedIds: string[] = []
      setGeocodingDeliveryIds((currentIds) =>
        {
          const nextIds = Array.from(new Set([...currentIds, ...deliveriesToGeocode.map((delivery) => delivery.id)]))
          return areStringArraysEqual(currentIds, nextIds) ? currentIds : nextIds
        }
      )

      for (const delivery of deliveriesToGeocode.slice(0, 8)) {
        const queryCandidates = Array.from(
          new Set(
            [
              [delivery.address, "Fes", "Maroc"].filter(Boolean).join(", "),
              [delivery.street, delivery.neighborhood, "Fes", "Maroc"].filter(Boolean).join(", "),
              [delivery.neighborhood, "Fes", "Maroc"].filter(Boolean).join(", "),
              [delivery.street, "Fes", "Maroc"].filter(Boolean).join(", "),
            ].filter((query) => query.trim().length > 0)
          )
        )

        let resolvedCoordinate: { lat: number; lng: number } | null = null

        for (const query of queryCandidates) {
          const params = new URLSearchParams({
            access_token: MAPBOX_TOKEN,
            language: "fr",
            country: "ma",
            limit: "1",
            types: "address,poi,neighborhood,locality,place",
          })

          if (driverLocation) {
            params.set("proximity", `${driverLocation.longitude},${driverLocation.latitude}`)
          } else if (pickupStop) {
            params.set("proximity", `${pickupStop.coordinate[0]},${pickupStop.coordinate[1]}`)
          }

          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`,
              { signal: controller.signal }
            )
            if (!response.ok) {
              continue
            }

            const payload = (await response.json()) as { features?: Array<{ center?: [number, number] }> }
            const center = payload.features?.[0]?.center
            if (!center || center.length < 2 || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
              continue
            }

            resolvedCoordinate = { lng: center[0], lat: center[1] }
            break
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              return
            }
          }
        }

        if (resolvedCoordinate) {
          nextOverrides[delivery.id] = resolvedCoordinate
        } else {
          failedIds.push(delivery.id)
        }
      }

      if (!isCancelled && Object.keys(nextOverrides).length > 0) {
        setDeliveryCoordinateOverrides((currentOverrides) => ({
          ...currentOverrides,
          ...nextOverrides,
        }))
      }
      if (!isCancelled) {
        setGeocodingDeliveryIds((currentIds) =>
          {
            const nextIds = currentIds.filter((id) => !deliveriesToGeocode.some((delivery) => delivery.id === id))
            return areStringArraysEqual(currentIds, nextIds) ? currentIds : nextIds
          }
        )
        if (failedIds.length > 0) {
          setFailedGeocodingDeliveryIds((currentIds) => {
            const nextIds = Array.from(new Set([...currentIds, ...failedIds]))
            return areStringArraysEqual(currentIds, nextIds) ? currentIds : nextIds
          })
        }
      }
    }

    void geocodeDeliveries()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [deliveriesToGeocode, geocodeQueueKey, geocodeProximityKey, isMapboxConfigured, isOffline])

  useEffect(() => {
    if (routePlanCoordinates.length < 2) {
      setRouteGeoJson(EMPTY_ROUTE_GEOJSON)
      setRouteSummary(null)
      if (currentDelivery && !nextDeliveryCoordinates) {
        if (!isMapboxConfigured) {
          setRouteError("Token Mapbox manquant: impossible de localiser l'adresse client.")
        } else if (isOffline) {
          setRouteError("Mode hors ligne: l'adresse client n'a pas de coordonnees GPS disponibles.")
        } else if (isCurrentDeliveryGeocoding) {
          setRouteError("Localisation de l'adresse client en cours...")
        } else if (didCurrentDeliveryGeocodingFail) {
          setRouteError("Adresse client introuvable sur Mapbox. Ajoutez lat/lng a l'adresse pour tracer le chemin.")
        } else {
          setRouteError("Adresse client sans coordonnees GPS. Recherche Mapbox en cours.")
        }
      } else {
        setRouteError(null)
      }
      setIsRouteLoading(false)
      lastDirectionsRequestRef.current = null
      return
    }

    if (!isMapboxConfigured) {
      setRouteGeoJson(createLineFeatureCollection(routePlanCoordinates, "fallback"))
      setRouteSummary(null)
      setRouteError("Le token Mapbox est requis pour calculer un itinéraire.")
      setIsRouteLoading(false)
      lastDirectionsRequestRef.current = null
      return
    }

    if (routePlanCoordinates.length > 25) {
      setRouteGeoJson(createLineFeatureCollection(routePlanCoordinates, "fallback"))
      setRouteSummary(null)
      setRouteError("Tournee trop longue pour un seul calcul Mapbox. Trace simplifiee active.")
      setIsRouteLoading(false)
      lastDirectionsRequestRef.current = null
      return
    }

    if (isOffline) {
      setRouteGeoJson(createLineFeatureCollection(routePlanCoordinates, "fallback"))
      setRouteSummary(null)
      setRouteError("Trace simplifiée active. L'itinéraire détaillé Mapbox est indisponible hors ligne.")
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
      const requestAge = Date.now() - lastRequest.timestamp

      if (
        originDrift < ROUTE_REFRESH_DISTANCE_METERS &&
        lastRequest.stopsKey === routePlanKey &&
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
        const response = await fetch(buildMultiStopDirectionsUrl(routePlanCoordinates), {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Directions Mapbox indisponibles (${response.status}).`)
        }

        const payload = (await response.json()) as MapboxDirectionsResponse
        const bestRoute = payload.routes?.[0]
        if (!bestRoute || !Array.isArray(bestRoute.geometry?.coordinates)) {
          throw new Error("Aucun itinéraire exploitable n'a été retourné par Mapbox.")
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
          stopsKey: routePlanKey,
          timestamp: Date.now(),
        }
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return
        }

        setRouteGeoJson(createLineFeatureCollection(routePlanCoordinates, "fallback"))
        setRouteSummary(null)
        setRouteError(
          error instanceof Error
            ? `${error.message} La carte affiche un trace simplifie de la tournee.`
            : "Impossible de calculer l'itinéraire détaillé."
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
    currentDelivery?.id,
    didCurrentDeliveryGeocodingFail,
    isCurrentDeliveryGeocoding,
    nextDeliveryCoordinates?.lat,
    nextDeliveryCoordinates?.lng,
    routePlanKey,
    routeOriginLatitude,
    routeOriginLongitude,
  ])

  const syncMapCamera = useEffectEvent(() => {
    if (!mapRef.current) {
      return
    }

    const mapInstance = mapRef.current

    if (!isDriverFocusEnabled) {
      return
    }

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
          padding: driveModePadding,
          duration: 700,
          essential: true,
        })
        return
      }

      if (nextDeliveryWithCoordinates) {
        mapInstance.easeTo({
          center: [nextDeliveryCoordinates!.lng, nextDeliveryCoordinates!.lat],
          zoom: 15.2,
          pitch: 45,
          bearing: mapInstance.getBearing(),
          padding: driveModePadding,
          duration: 700,
          essential: true,
        })
        return
      }
    }

    if (routeStops.length > 1) {
      const longitudes = routeStops.map((stop) => stop.coordinate[0])
      const latitudes = routeStops.map((stop) => stop.coordinate[1])
      const west = Math.min(...longitudes)
      const east = Math.max(...longitudes)
      const south = Math.min(...latitudes)
      const north = Math.max(...latitudes)

      if (west === east && south === north) {
        mapInstance.easeTo({
          center: [west, south],
          zoom: 15,
          pitch: 20,
          bearing: 0,
          padding: routeOverviewPadding,
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
          padding: routeOverviewPadding,
          duration: 900,
          essential: true,
        }
      )
      return
    }

    if (driverLocation && nextDeliveryWithCoordinates) {
      const west = Math.min(driverLocation.longitude, nextDeliveryCoordinates!.lng)
      const east = Math.max(driverLocation.longitude, nextDeliveryCoordinates!.lng)
      const south = Math.min(driverLocation.latitude, nextDeliveryCoordinates!.lat)
      const north = Math.max(driverLocation.latitude, nextDeliveryCoordinates!.lat)

      if (west === east && south === north) {
        mapInstance.easeTo({
          center: [west, south],
          zoom: 15,
          pitch: 20,
          bearing: 0,
          padding: routeOverviewPadding,
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
          padding: routeOverviewPadding,
          duration: 900,
          essential: true,
        }
      )
      return
    }

    if (nextDeliveryWithCoordinates) {
      mapInstance.easeTo({
        center: [nextDeliveryCoordinates!.lng, nextDeliveryCoordinates!.lat],
        zoom: 15,
        pitch: 10,
        bearing: 0,
        padding: routeOverviewPadding,
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
        padding: routeOverviewPadding,
        duration: 900,
        essential: true,
      })
      return
    }

    if (pickupCoordinates) {
      mapInstance.easeTo({
        center: [pickupCoordinates.lng, pickupCoordinates.lat],
        zoom: 15,
        pitch: 10,
        bearing: 0,
        padding: routeOverviewPadding,
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

    const mappableCoordinates = mappableDeliveries
      .map((item) => getDeliveryCoordinate(item, deliveryCoordinateOverrides))
      .filter((coordinate): coordinate is { lat: number; lng: number } => coordinate !== null)
    const longitudes = mappableCoordinates.map((coordinate) => coordinate.lng)
    const latitudes = mappableCoordinates.map((coordinate) => coordinate.lat)
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
        padding: routeOverviewPadding,
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
        padding: routeOverviewPadding,
        duration: 900,
        essential: true,
      }
    )
  })

  const roundedHeadingKey =
    typeof driverLocation?.heading === "number" ? Math.round(driverLocation.heading / 8) * 8 : "none"
  const mapCameraKey = [
    isNavigating ? "drive" : "overview",
    isHeaderCollapsed ? "header-collapsed" : "header-expanded",
    nextDeliveryWithCoordinates?.id ?? "no-destination",
    driverLocation?.latitude ?? "no-lat",
    driverLocation?.longitude ?? "no-lng",
    pickupCoordinates?.lat ?? "no-pickup-lat",
    pickupCoordinates?.lng ?? "no-pickup-lng",
    routePlanKey,
    roundedHeadingKey,
    routeGeoJson.features.length,
  ].join(":")

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => syncMapCamera())
    return () => window.cancelAnimationFrame(frameId)
  }, [mapCameraKey])

  const completedCount = deliveryList.filter(
    (item) => item.status === "delivered" || item.status === "absent" || item.status === "refused"
  ).length
  const totalCount = deliveryList.length
  const remainingCount = activeDeliveries.length
  const remainingTime = computeRemainingTime(deliveryList)
  const todayEarnings = deliveryList.filter((item) => item.status === "delivered").length * 10
  const progressRatio = totalCount === 0 ? 0 : completedCount / totalCount
  const currentRouteDistanceLabel = routeSummary ? formatDistanceLabel(routeSummary.distanceMeters) : "Trace en attente"
  const currentRouteDurationLabel = routeSummary ? formatDurationFromSeconds(routeSummary.durationSeconds) : remainingTime
  const pendingAssignmentCount = deliveryList.filter(isPendingAssignmentDelivery).length
  const futureMarkers = (currentDelivery ? futureDeliveries : mappableDeliveries)
    .map((delivery) => ({
      delivery,
      coordinate: getDeliveryCoordinate(delivery, deliveryCoordinateOverrides),
    }))
    .filter(
      (marker): marker is { delivery: DeliveryViewItem; coordinate: { lat: number; lng: number } } =>
        marker.coordinate !== null
    )
  const sheetHeightValue = sheetMode === "expanded" ? "min(58dvh, 34rem)" : "max(20dvh, 12rem)"
  const isSheetExpanded = sheetMode === "expanded"
  const routeOverviewPadding = isHeaderCollapsed ? { ...ROUTE_OVERVIEW_PADDING, top: 72 } : ROUTE_OVERVIEW_PADDING
  const driveModePadding = isHeaderCollapsed ? { ...DRIVE_MODE_PADDING, top: 56 } : DRIVE_MODE_PADDING
  const topOverlayOffset = isHeaderCollapsed ? "3.75rem" : "8.75rem"
  const showMap =
    isMapboxConfigured &&
    !isTourneeLoading &&
    !beforeSeven &&
    Boolean(token) &&
    (mappableDeliveries.length > 0 || pickupCoordinates !== null)
  const showBottomSheet =
    !isTourneeLoading &&
    !beforeSeven &&
    Boolean(token) &&
    Boolean(tourneeData) &&
    deliveryList.length > 0
  const isCodDeliveryPendingValidation = Boolean(
    currentDelivery && currentDelivery.paymentMethod === "cod" && !currentDelivery.paymentValidated
  )
  const canRejectEntireTournee = Boolean(token) && pendingAssignmentCount > 0

  const buildTourneeRefusPayload = () => ({
    client_event_id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tournee-refus-${Date.now()}`,
    device_timestamp: new Date().toISOString(),
  })

  const handleRejectEntireTournee = async () => {
    if (!token || !canRejectEntireTournee || isRefusingTournee) {
      return
    }

    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Êtes-vous sûr de vouloir refuser toutes les commandes de cette tournée ?")
    if (!confirmed) {
      return
    }

    setIsRefusingTournee(true)
    try {
      const response = await refuserTourneeLivreur(token, buildTourneeRefusPayload())
      removePendingAssignmentsFromLocalTournee()
      setNotice({ tone: "success", message: response.message })
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Impossible de refuser toute la tournée.",
      })
    } finally {
      setIsRefusingTournee(false)
    }
  }

  const handleStartDriveMode = async () => {
    if (!tourneeData?.ramassee) {
      setNotice({ tone: "info", message: "Ramassez d'abord chez le fournisseur." })
      return
    }
    if (!nextDelivery) {
      return
    }

    if (nextDelivery.status === "pending") {
      setIsStartingTournee(true)
      const hasStarted = await submitDeliveryStatusChange({
        delivery: nextDelivery,
        targetStatus: "enroute",
        offlineMessage: "Démarrage enregistré hors ligne. Synchronisation dès le retour du réseau.",
      })
      setIsStartingTournee(false)
      if (!hasStarted) {
        return
      }
    }

    setActiveNavigationDeliveryId(nextDelivery.id)
    setIsDriverFocusEnabled(true)
    setIsNavigating(true)
  }

  const handleCompleteCurrentDelivery = async () => {
    const deliveryToComplete = currentDelivery
    if (!deliveryToComplete) {
      return
    }

    setIsStartingTournee(true)
    let readyDelivery = deliveryToComplete

    if (deliveryToComplete.status === "pending") {
      const hasStarted = await submitDeliveryStatusChange({
        delivery: deliveryToComplete,
        targetStatus: "enroute",
        offlineMessage: "Démarrage enregistré hors ligne. Synchronisation dès le retour du réseau.",
      })

      if (!hasStarted) {
        setIsStartingTournee(false)
        return
      }

      readyDelivery =
        deliveryListRef.current.find((item) => item.id === deliveryToComplete.id) ??
        {
          ...deliveryToComplete,
          status: "enroute",
          rawStatus: STARTED_DELIVERY_STATUS,
          statusVersion: deliveryToComplete.statusVersion + 1,
          enrouteAt: new Date().toISOString(),
        }
    }

    const hasCompleted = await submitDeliveryStatusChange({
      delivery: readyDelivery,
      targetStatus: "delivered",
      offlineMessage: "Livraison enregistrée hors ligne. Synchronisation dès le retour du réseau.",
    })
    setIsStartingTournee(false)
    if (hasCompleted) {
      setActiveNavigationDeliveryId(null)
      setIsNavigating(false)
    }
  }

  const handleValidateCurrentCodPayment = async () => {
    const deliveryToValidate = currentDelivery
    if (!deliveryToValidate || !token) {
      return
    }

    if (deliveryToValidate.paymentMethod !== "cod") {
      setNotice({ tone: "info", message: "Cette commande n'est pas en paiement COD." })
      return
    }

    if (deliveryToValidate.paymentValidated) {
      setNotice({ tone: "success", message: "Encaissement COD déjà confirmé." })
      return
    }

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      setNotice({ tone: "error", message: "La validation COD exige une connexion réseau active." })
      return
    }

    setIsValidatingCodPayment(true)
    try {
      const response: CodValidationResponse = await validerPaiementCodLivreur(token, deliveryToValidate.id)
      applyCodPaymentValidation(String(response.commande_id), response.payment_validated)
      setNotice({ tone: "success", message: response.message })
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Impossible de valider l'encaissement COD.",
      })
    } finally {
      setIsValidatingCodPayment(false)
    }
  }

  const handleMarkCurrentDeliveryAbsent = async () => {
    const deliveryToMarkAbsent = currentDelivery
    if (!deliveryToMarkAbsent) {
      return
    }

    setIsStartingTournee(true)
    const hasMarkedAbsent = await submitDeliveryStatusChange({
      delivery: deliveryToMarkAbsent,
      targetStatus: "absent",
      offlineMessage: "Absence enregistrée hors ligne. Alerte envoyée dès le retour du réseau.",
    })
    setIsStartingTournee(false)
    if (hasMarkedAbsent) {
      setActiveNavigationDeliveryId(null)
      setIsNavigating(false)
    }
  }

  const handleMarkCurrentDeliveryRefused = async () => {
    const activeDelivery = currentDelivery
    if (!activeDelivery) {
      return
    }

    if (isLoadingRefus) {
      return
    }

    setIsLoadingRefus(true)
    try {
      const freshEventId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${activeDelivery.id}-refus-${Date.now()}`

      const liveDelivery =
        deliveryListRef.current.find((item) => item.id === activeDelivery.id) ??
        activeDelivery

      const hasMarkedRefused = await submitDeliveryStatusChange({
        delivery: liveDelivery,
        targetStatus: "refused",
        offlineMessage: "Refus client enregistré hors ligne. La mise en liste noire sera synchronisée au retour du réseau.",
        clientEventIdOverride: freshEventId,
      })

      if (hasMarkedRefused) {
        setActiveNavigationDeliveryId(null)
        setIsNavigating(false)
      }
    } catch (error) {
      console.error("Erreur lors du refus :", error)
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Impossible d'enregistrer le refus client.",
      })
    } finally {
      setIsLoadingRefus(false)
    }
  }

  const handleRecenterToDriver = () => {
    if (!mapRef.current) {
      return
    }

    const activeDriverLocation = driverLocation ?? lastDriverLocationRef.current

    if (!activeDriverLocation) {
      requestCurrentLocation({ showNoticeOnError: true, recenterAfterSuccess: true, showLoadingState: true })
      return
    }

    setIsDriverFocusEnabled(true)

    const mapInstance = mapRef.current
    if (isNavigating) {
      mapInstance.easeTo({
        center: [activeDriverLocation.longitude, activeDriverLocation.latitude],
        zoom: 16.8,
        pitch: 60,
        bearing:
          typeof activeDriverLocation.heading === "number" ? activeDriverLocation.heading : mapInstance.getBearing(),
        padding: driveModePadding,
        duration: 700,
        essential: true,
      })
      return
    }

    if (nextDeliveryWithCoordinates) {
      const west = Math.min(activeDriverLocation.longitude, nextDeliveryCoordinates!.lng)
      const east = Math.max(activeDriverLocation.longitude, nextDeliveryCoordinates!.lng)
      const south = Math.min(activeDriverLocation.latitude, nextDeliveryCoordinates!.lat)
      const north = Math.max(activeDriverLocation.latitude, nextDeliveryCoordinates!.lat)

      if (west === east && south === north) {
        mapInstance.easeTo({
          center: [west, south],
          zoom: 15.2,
          pitch: 30,
          bearing: 0,
          padding: routeOverviewPadding,
          duration: 700,
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
          padding: routeOverviewPadding,
          duration: 700,
          essential: true,
        }
      )
      return
    }

    mapInstance.easeTo({
      center: [activeDriverLocation.longitude, activeDriverLocation.latitude],
      zoom: 15,
      pitch: 20,
      bearing: 0,
      padding: routeOverviewPadding,
      duration: 700,
      essential: true,
    })
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
              : "Tournée terminée"
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
          title="Chargement de votre tournée"
          description="Nous récupérons la tournée du jour, les étapes et les coordonnées GPS."
          action={<Spinner className="mx-auto size-6 text-[#1E8A3C]" />}
        />
      )
    }

    if (beforeSeven) {
      return (
        <CenterStateCard
          icon={Clock3}
          title="La tournée arrive bientôt"
          description="Votre tournée s'affichera ici à partir de 7h00."
        />
      )
    }

    if (!token) {
      return (
        <CenterStateCard
          icon={Truck}
          title="Session livreur requise"
          description="Connectez-vous pour consulter votre tournée et piloter vos prochaines livraisons."
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
          description="Revenez un peu plus tard pour vérifier votre tournée du jour."
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

    if (mappableDeliveries.length === 0 && !pickupCoordinates) {
      return (
        <CenterStateCard
          icon={MapPin}
          title="Coordonnees GPS manquantes"
          description="Les commandes ou le fournisseur doivent fournir lat et lng pour la navigation terrain."
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
          <MapView
            ref={mapRef}
            reuseMaps
            initialViewState={DEFAULT_MAP_VIEW}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={MAPBOX_STYLE}
            maxBounds={MOROCCO_BOUNDS}
            attributionControl={false}
            dragPan={!isNavigating}
            onLoad={() => syncMapCamera()}
            onDragStart={() => setIsDriverFocusEnabled(false)}
          >
            <NavigationControl position="top-right" showCompass={false} />

            {routeGeoJson.features.length > 0 && (
              <Source id="tournee-route" type="geojson" data={routeGeoJson}>
                <Layer {...ROUTE_CASING_LAYER} />
                <Layer {...ROUTE_LAYER} />
              </Source>
            )}

            {futureMarkers.map((item) => (
              <Marker key={item.delivery.id} longitude={item.coordinate.lng} latitude={item.coordinate.lat} anchor="center">
                <div className="h-3 w-3 rounded-full bg-[#8B9991]/90 ring-4 ring-white/85 shadow-sm" />
              </Marker>
            ))}

            {supplierMarkers.map((supplier) => (
              <Marker key={supplier.id} longitude={supplier.coordinate[0]} latitude={supplier.coordinate[1]} anchor="bottom">
                <div className="relative flex flex-col items-center">
                  <div className="absolute top-1/2 h-14 w-14 -translate-y-1/2 rounded-full bg-[#1E8A3C]/25 animate-ping" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#1E8A3C] text-white shadow-[0_16px_32px_rgba(30,138,60,0.35)]">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="-mt-2 h-4 w-4 rotate-45 rounded-[4px] bg-[#1E8A3C] ring-4 ring-white" />
                  <div className="mt-1 max-w-[130px] rounded-full bg-white/95 px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#1E8A3C] shadow-sm">
                    Collecte
                  </div>
                </div>
              </Marker>
            ))}

            {nextDeliveryWithCoordinates && (
              <Marker longitude={nextDeliveryCoordinates!.lng} latitude={nextDeliveryCoordinates!.lat} anchor="bottom">
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
          </MapView>
        </div>
      )}

      {showMap && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--driver-bottom-sheet-height)+1rem)] z-30 flex justify-end px-4">
          <button
            type="button"
            onClick={handleRecenterToDriver}
            disabled={isRequestingLocation}
            className={cn(
              "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/70 px-3 py-2 text-xs font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-colors disabled:cursor-not-allowed disabled:opacity-70",
              driverLocation
                ? "bg-[#17301E]/88 text-white"
                : "bg-white/90 text-[#17301E]"
            )}
          >
            {isRequestingLocation ? <Spinner className="size-4" /> : <Navigation className="h-4 w-4" />}
            {isRequestingLocation ? "Localisation..." : isDriverFocusEnabled ? "Suivi auto" : "Me localiser"}
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-[#10251A]/38 via-transparent via-45% to-[#10251A]/20" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-4">
        <div className="mx-auto max-w-4xl">
          {isHeaderCollapsed ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsHeaderCollapsed(false)}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/88 px-3 py-2 text-xs font-semibold text-[#17301E] shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
              >
                Afficher
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="pointer-events-auto rounded-[2rem] border border-white/60 bg-white/84 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
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
                    {canRejectEntireTournee && (
                      <button
                        type="button"
                        onClick={handleRejectEntireTournee}
                        disabled={isRefusingTournee}
                        title={`Refuser ${pendingAssignmentCount} nouvelle(s) course(s)`}
                        className="inline-flex max-w-full items-center justify-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        {isRefusingTournee ? <Spinner className="size-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        <span className="truncate">
                          {isRefusingTournee ? "Refus..." : "Refuser la livraison"}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <HeaderMetric label="Restantes" value={String(remainingCount)} />
                    <HeaderMetric label="Livrees" value={`${completedCount}/${totalCount}`} />
                    <HeaderMetric
                      label={routeSummary ? "Distance" : "Gains"}
                      value={routeSummary ? currentRouteDistanceLabel : formatAmount(todayEarnings)}
                    />
                  </div>

                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#E2E8E3]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1E8A3C] to-[#1A73E8] transition-all duration-500"
                      style={{ width: `${progressRatio * 100}%` }}
                    />
                  </div>

                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsHeaderCollapsed(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#D7E1DA] bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4F6257] transition-colors hover:bg-white"
                  >
                    Masquer
                    <ChevronUp className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-600 transition-colors hover:bg-red-100"
                    aria-label="Déconnexion"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sortir
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOnDuty((currentValue) => !currentValue)}
                    className={cn(
                      "rounded-full px-3 py-2 text-sm font-semibold shadow-sm transition-colors",
                      isOnDuty ? "bg-[#1E8A3C] text-white" : "bg-red-50 text-red-600"
                    )}
                  >
                    {isOnDuty ? "En service" : "Pause"}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      router.replace("/login")
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-white p-2 text-red-500 shadow-sm transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div
        className="pointer-events-none absolute inset-x-0 z-30 px-4 transition-[top] duration-300"
        style={{ top: topOverlayOffset }}
      >
        <div className="mx-auto max-w-4xl space-y-2">
          {loadSource === "cache" && !beforeSeven && (
            <div className="rounded-2xl bg-[#FFF3E0]/95 px-4 py-3 text-sm text-[#8A5A00] shadow-sm backdrop-blur">
              Mode hors ligne actif. La dernière tournée sauvegardée est affichée.
            </div>
          )}

          {notice && !beforeSeven && (
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm shadow-sm backdrop-blur animate-in fade-in slide-in-from-top-2 duration-300",
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

          {routeError && !beforeSeven && currentDelivery && (
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

              {!currentDelivery ? (
                <div className="flex flex-1 items-center px-4 pb-4 pt-3">
                  <div className="w-full rounded-[1.5rem] bg-[#F0FAF1] p-4 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1E8A3C] text-white">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-[#17301E]">Tournée terminée</h3>
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
                            {isPickupPhase ? "Collecte fournisseur" : isNavigating ? "En travail" : "Prêt pour la course"}
                          </span>
                          <span className="inline-flex rounded-full bg-[#EEF5FF] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#285C9A]">
                            {currentRouteDistanceLabel}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate text-lg font-bold text-[#17301E]">
                          {isPickupPhase ? pickupStop?.label || "Fournisseur" : currentDelivery.clientName}
                        </h3>
                        <p className="mt-1 truncate text-sm font-medium text-[#3F5246]">
                          {isPickupPhase ? tourneeData?.pickup?.address || "Adresse fournisseur" : buildPreciseAddress(currentDelivery)}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#5B6B60]">
                          {isPickupPhase ? "Premiere etape obligatoire avant livraison" : buildPaymentSummary(currentDelivery)}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-[1.25rem] bg-white px-3 py-2 text-center shadow-sm">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#6B7280]">Stop</p>
                        <p className="mt-1 text-xl font-black text-[#1E8A3C]">{isPickupPhase ? "F" : currentDelivery.stepNumber}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[#6B7280]">
                          <Package className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em]">Colis</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-bold text-[#17301E]">{currentDelivery.packageCount}</p>
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
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Adresse complète</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#17301E]">{currentDelivery.address}</p>
                        </div>

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Paiement</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#17301E]">{buildPaymentSummary(currentDelivery)}</p>
                          {currentDelivery.paymentMethod === "cod" && (
                            <span
                              className={cn(
                                "mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                currentDelivery.paymentValidated
                                  ? "bg-[#F0FAF1] text-[#1E8A3C]"
                                  : "bg-[#FFF3E0] text-[#8A5A00]"
                              )}
                            >
                              {currentDelivery.paymentValidated ? "COD validé" : "COD à encaisser"}
                            </span>
                          )}
                        </div>

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3">
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <Package className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-[0.16em]">Details colis</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#17301E]">{buildPackageSummary(currentDelivery)}</p>
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
                            {activeMissingCoordinatesCount} livraison(s) restante(s) n'ont pas de coordonnées GPS exploitables.
                          </div>
                        )}

                        {!nextDeliveryWithCoordinates && (
                          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                            La prochaine livraison n'a pas de coordonnées GPS. Le guidage embarqué est indisponible.
                          </div>
                        )}

                        <div className="rounded-2xl bg-[#F7F9F7] px-4 py-3 text-sm text-[#5B6B60]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-[#1E8A3C]" />
                              <span>{remainingCount} étape(s) restante(s)</span>
                            </div>
                            <span>{routeSummary ? currentRouteDurationLabel : `ETA ${remainingTime}`}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isNavigating && isCodDeliveryPendingValidation && (
                    <button
                      type="button"
                      onClick={handleValidateCurrentCodPayment}
                      disabled={isStartingTournee || isValidatingCodPayment || !currentDelivery}
                      className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#F07C00] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(240,124,0,0.25)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isValidatingCodPayment ? <Spinner className="size-5" /> : <DollarSign className="h-5 w-5" />}
                      <span className="truncate">
                        {isValidatingCodPayment ? "Validation COD..." : "Valider l'encaissement COD"}
                      </span>
                    </button>
                  )}

                  <div
                    className={cn(
                      "grid gap-3",
                      isNavigating
                        ? "grid-cols-[3.25rem_5.5rem_7.5rem_minmax(0,1fr)]"
                        : "grid-cols-[3.25rem_minmax(0,1fr)]",
                      isSheetExpanded ? "pt-3" : "mt-auto pt-3"
                    )}
                  >
                      <a
                        href={currentDelivery.callHref ?? undefined}
                        aria-disabled={!currentDelivery.callHref}
                        className={cn(
                          "flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#F3F4F6] px-3 text-sm font-semibold text-[#17301E] transition-transform active:scale-[0.99]",
                          !currentDelivery.callHref && "pointer-events-none bg-gray-200 text-gray-500"
                        )}
                      >
                        <Phone className="h-5 w-5" />
                      </a>

                      {isNavigating && !isPickupPhase && (
                        <button
                          type="button"
                          onClick={handleMarkCurrentDeliveryAbsent}
                          disabled={isStartingTournee || isValidatingCodPayment || !currentDelivery}
                          title="Client introuvable"
                          className="flex h-12 items-center justify-center rounded-2xl bg-amber-500 px-3 text-xs font-semibold text-white shadow-[0_14px_30px_rgba(245,158,11,0.24)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Absent
                        </button>
                      )}

                      {isNavigating && !isPickupPhase && (
                        <button
                          type="button"
                          onClick={handleMarkCurrentDeliveryRefused}
                          disabled={isLoadingRefus || isStartingTournee || isValidatingCodPayment || !currentDelivery}
                          title="Client refuse la commande"
                          className={cn(
                            "flex h-12 items-center justify-center rounded-2xl bg-red-600 px-3 text-xs font-semibold text-white shadow-[0_14px_30px_rgba(220,38,38,0.24)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
                            isLoadingRefus && "opacity-50"
                          )}
                        >
                          {isLoadingRefus ? "Traitement..." : "Refus client"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={isPickupPhase ? handleConfirmPickup : isNavigating ? handleCompleteCurrentDelivery : handleStartDriveMode}
                        disabled={
                          isStartingTournee ||
                          isConfirmingPickup ||
                          isValidatingCodPayment ||
                          !currentDelivery ||
                          (!isPickupPhase && isNavigating && isCodDeliveryPendingValidation)
                        }
                        className={cn(
                          "flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
                          isPickupPhase || isNavigating ? "bg-[#1E8A3C]" : "bg-[#17301E]"
                        )}
                      >
                        {isStartingTournee || isConfirmingPickup ? (
                          <Spinner className="size-5" />
                        ) : isPickupPhase ? (
                          <Package className="h-5 w-5" />
                        ) : isNavigating ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Navigation className="h-5 w-5" />
                        )}
                        <span className="truncate">
                          {isPickupPhase ? "Confirmer la collecte" : isNavigating ? "Marquer comme livre" : "Demarrer la course"}
                        </span>
                      </button>
                    </div>

                  {isNavigating && isCodDeliveryPendingValidation && (
                    <p className="mt-2 text-xs font-medium text-[#8A5A00]">
                      Encaissez puis validez le COD pour debloquer le bouton de livraison.
                    </p>
                  )}

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
                      onClick={() => {
                        setActiveNavigationDeliveryId(null)
                        setIsNavigating(false)
                      }}
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
