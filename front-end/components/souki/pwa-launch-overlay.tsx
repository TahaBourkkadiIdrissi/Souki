"use client"

import { useEffect, useState, type CSSProperties } from "react"

/**
 * Animation d'entree de l'app installee — « aube de la recolte ».
 *
 * Sequence : le logo respire des le premier frame (continuite avec le splash iOS)
 * → aube verte + lueur safran + rayons de soleil derriere lui → une couronne de
 * legumes photorealiste (generee via Higgsfield, detouree) vient se poser autour
 * du logo avec une physique de ressort, doublee d'une copie floutee plus large
 * pour la profondeur → reflet sur le logo → lettres SOUKI + devise → finale :
 * le vert profond de l'accueil jaillit du coeur du logo (disque qui inonde
 * l'ecran) et l'overlay s'efface dessus — le dernier frame du splash porte deja
 * la couleur du hero de /pwa-welcome, aucune coupure de luminance.
 *
 * Le declenchement N'EST PAS decide ici : le script inline de app/layout.tsx pose
 * l'attribut `data-souki-launch` sur <html> avant la premiere peinture, quand l'app
 * tourne en standalone et que c'est le premier ecran de la session. Ce composant se
 * contente d'exister dans le DOM des le rendu serveur — c'est ce qui permet de couvrir
 * l'ecran noir affiche par iOS entre son splash et le premier rendu de l'app.
 *
 * Toute la mise en mouvement vit dans globals.css (politique projet : animations 100%
 * CSS, avec neutralisation sous prefers-reduced-motion ; ressorts via linear(),
 * repli cubic-bezier). L'asset hero (public/images/launch/wreath.webp) est precache
 * par le service worker et precharge par le script inline du <head>.
 */

// Duree totale de la sequence, calee sur les animations de globals.css
// (.souki-launch : delai 2420ms + 230ms de fondu final sur la crue verte).
const SEQUENCE_MS = 2650

// Etincelles posees sur la couronne : glints de rosee aux couleurs de la marque.
const SPARKLES = [
  { x: -68, y: -110, size: 7, color: "#F5C400", delay: 850 },
  { x: 96, y: -84, size: 5, color: "#FFFFFF", delay: 1030 },
  { x: 132, y: 24, size: 6, color: "#F5C400", delay: 1210 },
  { x: 70, y: 122, size: 5, color: "#FFFFFF", delay: 1380 },
  { x: -112, y: 76, size: 6, color: "#F5C400", delay: 1530 },
  { x: -138, y: -24, size: 5, color: "#FFFFFF", delay: 1650 },
]

const WORDMARK = ["S", "O", "U", "K", "I"]

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
      <div className="souki-launch-scene relative flex h-full w-full items-center justify-center overflow-hidden">
        {/* Aube — halo vert qui s'ouvre derriere le logo */}
        <div className="souki-launch-bloom absolute inset-0" />

        {/* Rayons de soleil (le logo porte deja un soleil levant) */}
        <div className="souki-launch-rays absolute" />

        {/* Crue verte : a la fin de la sequence, le vert du hero de /pwa-welcome
            jaillit du coeur du logo et inonde l'ecran — continuite de couleur
            avec l'accueil. Sous les couronnes (elles s'effacent au-dessus). */}
        <div className="souki-launch-takeover absolute" />

        {/* Profondeur : la meme couronne, plus large, floutee, en contre-rotation */}
        <div className="absolute inset-0 grid place-items-center">
          <img
            src="/images/launch/wreath.webp"
            alt=""
            className="souki-launch-wreath souki-launch-wreath-back"
          />
        </div>

        {/* Hero : la couronne de la recolte tournoie et se pose autour du logo */}
        <div className="absolute inset-0 grid place-items-center">
          <img
            src="/images/launch/wreath.webp"
            alt=""
            className="souki-launch-wreath souki-launch-wreath-front"
          />
        </div>

        {/* Glints de rosee sur la couronne */}
        {SPARKLES.map((sparkle) => (
          <span
            key={`${sparkle.x}-${sparkle.y}`}
            className="souki-launch-sparkle absolute left-1/2 top-1/2"
            style={
              {
                width: `${sparkle.size}px`,
                height: `${sparkle.size}px`,
                marginLeft: `${-sparkle.size / 2}px`,
                marginTop: `${-sparkle.size / 2}px`,
                "--sx": `${sparkle.x}px`,
                "--sy": `${sparkle.y}px`,
                "--c": sparkle.color,
                "--d": `${sparkle.delay}ms`,
              } as CSSProperties
            }
          />
        ))}

        {/* Le logo respire au coeur de la couronne, puis un reflet le balaie.
            logo3.png est opaque (fond blanc) : le cercle + overflow-hidden le
            transforme en medaillon blanc — jamais de carte rectangulaire. */}
        <div className="souki-launch-logo-wrap relative h-36 w-36 overflow-hidden rounded-full bg-white">
          <img src="/logo3.png" alt="" className="souki-launch-logo h-full w-full object-contain" />
          <span className="souki-launch-shine absolute inset-0" />
        </div>

        {/* Lettrage SOUKI + devise, sous la couronne */}
        <div
          className="souki-launch-wordmark absolute inset-x-0 text-center"
          style={{ top: "calc(50% + min(52vmin, 212px))" }}
        >
          <div className="text-[28px] font-black tracking-[0.32em] text-[#163019]">
            {WORDMARK.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className="souki-launch-letter inline-block"
                style={{ "--d": `${index * 60}ms` } as CSSProperties}
              >
                {letter}
              </span>
            ))}
          </div>
          <p className="souki-launch-tagline mt-1.5 text-[11px] font-semibold tracking-wide text-gray-500">
            Du champ au panier, le matin même
          </p>
        </div>
      </div>
    </div>
  )
}
