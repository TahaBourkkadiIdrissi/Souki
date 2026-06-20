"use client"

import { useEffect, useRef } from "react"

const SUPPLIER_REFRESH_INTERVAL_MS = 30_000

export function useSupplierLiveRefresh(refresh: () => void | Promise<void>, enabled = true) {
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled) return

    const runRefresh = () => {
      void refreshRef.current()
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") runRefresh()
    }

    const interval = window.setInterval(runRefresh, SUPPLIER_REFRESH_INTERVAL_MS)
    window.addEventListener("focus", runRefresh)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", runRefresh)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [enabled])
}
