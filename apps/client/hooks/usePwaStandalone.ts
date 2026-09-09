"use client"

import { useEffect, useState } from "react"
import { isPwaStandalone } from "@/lib/pwa"

/**
 * Etat client "l'app tourne-t-elle en PWA installee (standalone) ?".
 *
 * `isPwaStandalone()` lit `window`, donc l'appeler pendant le rendu provoque un
 * mismatch d'hydratation (serveur = false, client = true). Ce hook renvoie
 * toujours `false` au premier rendu puis se met a jour apres le montage, comme
 * le fait deja `pwa-nav-shell.tsx`. Il reagit aussi aux changements de
 * `display-mode` (ex. passage plein ecran).
 */
export function usePwaStandalone(): boolean {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const update = () => setStandalone(isPwaStandalone())
    update()

    const media = window.matchMedia("(display-mode: standalone)")
    // addEventListener('change') : supporte par tous les navigateurs modernes.
    media.addEventListener?.("change", update)
    return () => media.removeEventListener?.("change", update)
  }, [])

  return standalone
}
