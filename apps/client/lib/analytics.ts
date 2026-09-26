"use client"

type AnalyticsParams = Record<string, string | number | boolean | null | undefined | object>

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && typeof window !== "undefined") {
    // GA's external script loads after hydration. Queue early interactions so
    // view_item and begin_checkout are not lost before it becomes available.
    window.dataLayer ||= []
    window.gtag ||= (...args: unknown[]) => { window.dataLayer?.push(args) }
    window.gtag("event", eventName, params)
  }
}
