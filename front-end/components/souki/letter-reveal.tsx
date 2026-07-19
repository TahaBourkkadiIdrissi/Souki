"use client"

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Segment de texte a reveler. Chaque segment peut avoir sa propre couleur/style
 * et occuper une ligne dediee (block).
 */
export interface LetterRevealSegment {
  text: string
  className?: string
  /** Force le segment sur sa propre ligne (utile pour les titres multi-lignes). */
  block?: boolean
}

interface LetterRevealProps {
  /** Texte simple. Ignore si `segments` est fourni. */
  text?: string
  /** Segments stylisables (couleur, retour a la ligne). */
  segments?: LetterRevealSegment[]
  /** Balise du conteneur (h1, h2, p, span...). */
  as?: ElementType
  className?: string
  /** Delai entre chaque lettre (ms). */
  stagger?: number
  /** Delai avant la premiere lettre (ms). */
  startDelay?: number
  /**
   * `mount` : l'ecriture demarre au chargement (rendu SSR, aucun flash).
   * `view`  : l'ecriture demarre quand l'element entre dans le viewport.
   */
  trigger?: "mount" | "view"
  /** Curseur clignotant facon machine a ecrire, qui disparait a la fin. */
  caret?: boolean
  /** Rejoue l'animation a chaque entree dans le viewport (trigger=view). */
  repeat?: boolean
  children?: ReactNode
}

/**
 * Ecriture "lettre par lettre" facon machine a ecrire.
 *
 * 100% CSS pour l'animation (politique Souki) : le JS ne fait que poser la
 * classe `is-typing`. Sans JS, le texte reste entierement visible (fail-safe),
 * et `prefers-reduced-motion` affiche tout instantanement.
 */
export function LetterReveal({
  text,
  segments,
  as,
  className,
  stagger = 42,
  startDelay = 0,
  trigger = "mount",
  caret = false,
  repeat = false,
  children,
}: LetterRevealProps) {
  const Tag = as ?? "span"
  const ref = useRef<HTMLElement>(null)
  // Sur "mount" on ecrit directement (classe presente au rendu SSR => pas de flash).
  const [typing, setTyping] = useState(trigger === "mount")

  useEffect(() => {
    if (trigger !== "view") return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTyping(true)
            if (!repeat) observer.unobserve(entry.target)
          } else if (repeat) {
            setTyping(false)
          }
        })
      },
      { threshold: 0.35 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [trigger, repeat])

  const resolvedSegments: LetterRevealSegment[] = segments ?? [{ text: text ?? "" }]

  // Index global des lettres visibles pour un stagger continu entre segments.
  let charIndex = 0
  const totalChars = resolvedSegments.reduce(
    (sum, seg) => sum + Array.from(seg.text).filter((c) => c !== " ").length,
    0,
  )
  const totalMs = startDelay + totalChars * stagger + 420

  const renderWord = (word: string, key: string, segClassName?: string) => (
    <span key={key} aria-hidden="true" className={cn("lr-word", segClassName)}>
      {Array.from(word).map((char, ci) => {
        const delay = startDelay + charIndex * stagger
        charIndex += 1
        return (
          <span key={ci} className="lr-char" style={{ "--d": `${delay}ms` } as CSSProperties}>
            {char}
          </span>
        )
      })}
    </span>
  )

  return (
    <Tag
      ref={ref as never}
      className={cn("letter-reveal", typing && "is-typing", className)}
      style={{ "--lr-total": `${totalMs}ms` } as CSSProperties}
      aria-label={resolvedSegments.map((s) => s.text).join(" ")}
    >
      {resolvedSegments.map((seg, si) => {
        const words = seg.text.split(" ")
        const content = words.map((word, wi) => (
          <Fragment key={`${si}-${wi}`}>
            {renderWord(word, `w-${si}-${wi}`, seg.className)}
            {wi < words.length - 1 ? " " : null}
          </Fragment>
        ))

        if (seg.block) {
          return (
            <span key={si} aria-hidden="true" className="lr-line">
              {content}
            </span>
          )
        }
        return <Fragment key={si}>{content}</Fragment>
      })}
      {caret ? <span className="lr-caret" aria-hidden="true" /> : null}
      {children}
    </Tag>
  )
}
