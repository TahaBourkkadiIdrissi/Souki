"use client"

import { useEffect, useState, type CSSProperties } from "react"

/**
 * Animation d'entree de l'app installee.
 *
 * Sequence : fond blanc → rectangles qui montent en s'approchant → eclatement des
 * legumes → convergence vers le logo → fondu vers l'accueil PWA.
 *
 * Le declenchement N'EST PAS decide ici : le script inline de app/layout.tsx pose
 * l'attribut `data-souki-launch` sur <html> avant la premiere peinture, quand l'app
 * tourne en standalone et que c'est le premier ecran de la session. Ce composant se
 * contente d'exister dans le DOM des le rendu serveur — c'est ce qui permet de couvrir
 * l'ecran noir affiche par iOS entre son splash et le premier rendu de l'app.
 *
 * Toute la mise en mouvement vit dans globals.css (politique projet : animations 100%
 * CSS, avec neutralisation sous prefers-reduced-motion).
 */

// Duree totale de la sequence, calee sur les animations de globals.css
// (.souki-launch : delai 1880ms + 380ms de fondu).
const SEQUENCE_MS = 2260

// Barres colorees de la premiere phase : hauteur en % et couleur de marque.
const BARS = [
  { height: 38, color: "#8FD69A" },
  { height: 62, color: "#4CB84A" },
  { height: 92, color: "#1E8A3C" },
  { height: 70, color: "#F5C400" },
  { height: 44, color: "#F07C00" },
]

// Legumes de l'eclatement, places en couronne autour du centre.
const VEGETABLES = [
  "tomate",
  "carotte",
  "poivron-rouge",
  "brocoli",
  "aubergine",
  "mais",
  "piment",
  "courgette",
]

const BURST_RADIUS_PX = 104

export function PwaLaunchOverlay() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (!root.hasAttribute("data-souki-launch")) {
      setDone(true)
      return
    }

    const timeoutId = window.setTimeout(() => {
      root.removeAttribute("data-souki-launch")
      setDone(true)
    }, SEQUENCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [])

  if (done) return null

  return (
    <div
      className="souki-launch fixed inset-0 z-[200] bg-white"
      aria-hidden="true"
      // L'ecran est purement decoratif : il ne doit jamais intercepter un tap.
      style={{ pointerEvents: "none" }}
    >
      <div className="relative flex h-full w-full items-center justify-center">
        {/* Phase 1 — rectangles qui montent en s'approchant */}
        <div className="souki-launch-bars absolute flex h-40 items-end gap-2.5">
          {BARS.map((bar, index) => (
            <span
              key={bar.color}
              className="souki-launch-bar block w-3.5 rounded-full sm:w-4"
              style={
                {
                  height: `${bar.height}%`,
                  backgroundColor: bar.color,
                  "--d": `${index * 70}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {/* Phase 2 — eclatement des legumes */}
        {VEGETABLES.map((name, index) => {
          const angle = (index / VEGETABLES.length) * 2 * Math.PI - Math.PI / 2
          return (
            <img
              key={name}
              src={`/images/legumes/${name}.png`}
              alt=""
              className="souki-launch-veggie absolute h-16 w-16 object-contain"
              style={
                {
                  "--sx": `${Math.round(Math.cos(angle) * BURST_RADIUS_PX)}px`,
                  "--sy": `${Math.round(Math.sin(angle) * BURST_RADIUS_PX)}px`,
                  "--sr": `${index % 2 === 0 ? 22 : -22}deg`,
                  "--d": `${index * 45}ms`,
                } as CSSProperties
              }
            />
          )
        })}

        {/* Phase 3 — le logo se forme */}
        <img
          src="/logo3.png"
          alt=""
          className="souki-launch-logo relative h-36 w-36 object-contain"
        />
      </div>
    </div>
  )
}
