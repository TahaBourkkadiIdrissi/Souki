"use client"
import { useEffect, useRef, useState, type CSSProperties } from "react"

/**
 * Animation d'entree de l'app installee — « Le marche se reveille », reprise de l'intro de
 * l'app Play Store (apps/play-store/src/components/launch-intro.tsx).
 *
 * Sequence (~2,2 s) sur le vert SOUKI : le sac blanc respire, le « S » se trace en menthe,
 * le jour se leve (un disque creme s'ouvre depuis le sac), le logo complet apparait et six
 * feuilles s'envolent, puis fondu vers l'accueil. La nuit (01h-08h, heure du Maroc, commandes
 * fermees) : le disque est vert nuit, une lune se leve et le sac reste au centre.
 * Toucher l'ecran passe directement a l'accueil.
 *
 * Le declenchement N'EST PAS decide ici : le script inline de app/layout.tsx pose
 * `data-souki-launch="day"` ou `"night"` sur <html> avant la premiere peinture, quand l'app
 * tourne en standalone (PWA installee ou app Play Store) et que c'est le premier ecran de la
 * session. Ce composant existe dans le DOM des le rendu serveur : il couvre l'ecran des le
 * premier frame, dans la continuite de l'ecran de demarrage vert.
 *
 * Toute la mise en mouvement vit dans globals.css (politique projet : animations 100 % CSS,
 * neutralisees sous prefers-reduced-motion). Les images (sac, logo) sont precachees par le
 * service worker et prechargees par le script inline du <head>.
 */

// Duree totale, calee sur globals.css (.souki-launch : sortie a 1900 ms + 320 ms de fondu).
const SEQUENCE_MS = 2220
// Mouvement reduit : image fixe puis fondu de 200 ms apres 120 ms.
const REDUCED_SEQUENCE_MS = 320
// Toucher pour passer : meme fondu de sortie (320 ms).
const SKIP_MS = 320

/** Six feuilles qui s'envolent du logo : ecart x, ecart y, rotation (comme l'intro Play Store). */
const LEAVES = [
  [-70, -60, -30],
  [-34, -92, 20],
  [10, -100, -10],
  [52, -84, 35],
  [80, -48, 60],
  [-92, -18, -55],
] as const

/** Chemin du « S » qui traverse l'ecran, dans le repere 393 × 852 de l'intro. */
const ROAD = "M430 40 C 250 60 40 160 70 330 C 100 480 330 430 320 600 C 312 740 120 790 -40 820"

export function PwaLaunchOverlay() {
  const [done, setDone] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timeoutRef = useRef<number | undefined>(undefined)

  const finish = () => {
    document.documentElement.removeAttribute("data-souki-launch")
    setDone(true)
  }

  useEffect(() => {
    const root = document.documentElement
    if (!root.hasAttribute("data-souki-launch")) {
      setDone(true)
      return
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    timeoutRef.current = window.setTimeout(finish, reduced ? REDUCED_SEQUENCE_MS : SEQUENCE_MS)
    return () => window.clearTimeout(timeoutRef.current)
  }, [])

  const skip = () => {
    if (leaving) return
    setLeaving(true)
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(finish, SKIP_MS)
  }

  if (done) return null

  return (
    <div
      className={`souki-launch fixed inset-0 z-[200]${leaving ? " is-leaving" : ""}`}
      // Decoratif pour les lecteurs d'ecran ; un toucher passe a l'accueil (comme l'app Play Store).
      aria-hidden="true"
      onClick={skip}
    >
      {/* Le chemin du « S », menthe a 22 % */}
      <svg className="souki-launch-road" viewBox="0 0 393 852" preserveAspectRatio="none" aria-hidden="true">
        <path d={ROAD} pathLength={100} />
      </svg>

      {/* Le jour se leve : un disque s'ouvre depuis le sac (vert nuit la nuit) */}
      <div className="souki-launch-dawn" />

      {/* Nuit : lune jaune echancree, avec son halo */}
      <div className="souki-launch-moon">
        <span />
      </div>

      {/* Le sac : meme image que l'ecran de demarrage */}
      <img src="/brand/souki-2026/splash-symbol.png" alt="" width={160} height={160} fetchPriority="high" className="souki-launch-mark" />

      {/* Le logo complet (jour seulement) */}
      <img src="/brand/souki-2026/horizontal.png" alt="" width={236} height={79} className="souki-launch-logo" />

      {/* Six feuilles s'envolent du logo (ou du sac, la nuit) */}
      <div className="souki-launch-leaves">
        {LEAVES.map(([dx, dy, rotation], index) => {
          const size = index % 2 === 1 ? 10 : 14
          return (
            <span
              key={index}
              className="souki-launch-leaf"
              style={
                {
                  width: `${size}px`,
                  height: `${size}px`,
                  marginLeft: `${-size / 2}px`,
                  marginTop: `${-size / 2}px`,
                  borderRadius: `0 ${size}px 0 ${size}px`,
                  background: index % 2 === 1 ? "#4CB84A" : "#22AA3F",
                  "--dx": `${dx}px`,
                  "--dy": `${dy}px`,
                  "--r": `${rotation}deg`,
                  "--d": `${1000 + index * 45}ms`,
                } as CSSProperties
              }
            />
          )
        })}
      </div>
    </div>
  )
}
