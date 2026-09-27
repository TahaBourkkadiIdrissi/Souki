"use client"

import { useReportWebVitals } from "next/web-vitals"
import { useRef } from "react"
import { trackEvent } from "@/lib/analytics"

export function WebVitals() {
  // These metrics describe the document navigation, not subsequent SPA routes.
  const loadPath = useRef(typeof window === "undefined" ? "" : window.location.pathname)
  useReportWebVitals((metric) => {
    trackEvent("web_vitals", {
      metric_name: metric.name,
      metric_id: metric.id,
      metric_value: metric.value,
      metric_rating: metric.rating,
      page_path: loadPath.current,
    })
  })
  return null
}
