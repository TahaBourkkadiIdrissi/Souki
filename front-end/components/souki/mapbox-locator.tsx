"use client"

import { useState, useRef, useEffect } from "react"
import { MapPin, Loader2, AlertCircle, X } from "lucide-react"
import "mapbox-gl/dist/mapbox-gl.css"

interface MapboxLocatorProps {
  onAddressDetected: (address: string, city: string) => void
  isOpen: boolean
  onClose: () => void
}

export function MapboxLocator({ onAddressDetected, isOpen, onClose }: MapboxLocatorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  // Request user location when modal opens
  useEffect(() => {
    if (!isOpen) return
    if (map.current) return

    setError(null)
    setLoading(true)

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur votre navigateur.")
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ latitude, longitude })
        setLoading(false)
      },
      (err) => {
        let errorMsg = "Erreur de géolocalisation."
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = "Accès à la localisation refusé. Vérifiez les paramètres de votre navigateur."
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMsg = "Position indisponible. Essayez à nouveau."
        } else if (err.code === err.TIMEOUT) {
          errorMsg = "Délai d'attente dépassé. Réessayez."
        }
        setError(errorMsg)
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [isOpen])

  // Initialize Mapbox when location and container are ready
  useEffect(() => {
    if (!isOpen || !userLocation || map.current || !mapContainer.current) return
    initializeMap(userLocation.latitude, userLocation.longitude)
  }, [isOpen, userLocation])

  // Initialize Mapbox map
  const initializeMap = async (lat: number, lng: number) => {
    try {
      const mapboxgl = await import("mapbox-gl")
      const MapboxGl = mapboxgl.default

      if (!mapContainer.current) return

      MapboxGl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

      const newMap = new MapboxGl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: 15,
      })

      newMap.on("load", () => {
        new MapboxGl.Marker({ color: "#1E8A3C" })
          .setLngLat([lng, lat])
          .addTo(newMap)
      })

      // Handle map clicks for address detection
      newMap.on("click", async (e) => {
        await detectAddressAtLocation(e.lngLat.lng, e.lngLat.lat)
        
        // Update marker position
        const markers = document.querySelectorAll(".mapboxgl-marker")
        markers.forEach((marker) => marker.remove())
        
        new MapboxGl.Marker({ color: "#1E8A3C" })
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .addTo(newMap)
      })

      map.current = newMap
    } catch (err) {
      setError("Erreur lors de l'initialisation de la carte.")
      console.error(err)
    }
  }

  // Reverse geocode coordinates to get address
  const detectAddressAtLocation = async (lng: number, lat: number) => {
    try {
      setLoading(true)
      setError(null)

      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      if (!mapboxToken) {
        setError("Token Mapbox non configuré.")
        setLoading(false)
        return
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=fr`
      )

      if (!response.ok) {
        throw new Error("Erreur lors du reverse geocoding")
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const address = feature.place_name || `${lat}, ${lng}`

        // Extract city
        let city = ""
        const cityFeature = data.features.find((f: any) => f.place_type.includes("place"))
        if (cityFeature) {
          city = cityFeature.text || ""
        }

        onAddressDetected(address, city)
        onClose()
      } else {
        setError("Adresse non trouvée. Essayez un autre emplacement.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la localisation")
    } finally {
      setLoading(false)
    }
  }

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#1E8A3C]" />
            <h2 className="font-bold text-lg text-[#3D3D3D]">Me localiser</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-[#8A8A8A]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {loading && !userLocation && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-[#1E8A3C] animate-spin mx-auto mb-4" />
                <p className="text-[#3D3D3D] font-medium">Récupération de votre position...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center bg-red-50 p-6">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
                <p className="text-red-700 font-medium">{error}</p>
                <button
                  onClick={() => {
                    setError(null)
                    setUserLocation(null)
                    setLoading(true)
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const { latitude, longitude } = position.coords
                          setUserLocation({ latitude, longitude })
                          setLoading(false)
                          if (mapContainer.current && !map.current) {
                            initializeMap(latitude, longitude)
                          }
                        },
                        () => {
                          setError("Erreur lors de la récupération de la position.")
                          setLoading(false)
                        }
                      )
                    }
                  }}
                  className="mt-4 px-4 py-2 bg-[#1E8A3C] text-white rounded-lg text-sm font-semibold hover:bg-[#176B2E] transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {userLocation && !error && (
            <>
              <div className="flex-1 bg-gray-100 relative min-h-[360px]">
                <div ref={mapContainer} className="w-full h-full min-h-[360px]" />
                
                {/* Instructions overlay */}
                <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4">
                  <p className="text-sm text-[#3D3D3D] font-medium">Cliquez sur la carte pour sélectionner votre adresse</p>
                  {loading && (
                    <div className="mt-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-[#1E8A3C] animate-spin" />
                      <span className="text-sm text-[#8A8A8A]">Détection de l'adresse...</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-200 rounded-xl text-[#3D3D3D] font-semibold hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
