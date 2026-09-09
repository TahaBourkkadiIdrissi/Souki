"use client"

import React from "react"
import styles from "./CartLoadingAnimation.module.css"

interface CartLoadingAnimationProps {
  /** Progress percentage 0–100 */
  progress: number
  /**
   * Secondes restantes estimées. Affichées en compte à rebours quand la barre
   * atteint 100 % alors que la génération ML tourne encore (~26 s à froid),
   * pour que l'attente ne ressemble pas à un gel. `null` = masqué (terminé).
   */
  remainingSeconds?: number | null
}

/**
 * CartLoadingAnimation — « la récolte se compose » : scène affichée pendant la
 * génération IA du panier, dans le langage visuel de l'animation d'entrée.
 *
 * Aube verte + rayons derrière un panier marocain en osier (généré via
 * Higgsfield, détouré) qui respire, entouré de la couronne de la récolte en
 * lente orbite (copie floutée derrière = profondeur) et de glints de rosée.
 * Le pourcentage héros bascule en compte à rebours (~Xs) quand le modèle ML
 * calcule encore. Toute la mise en mouvement est en CSS (module), neutralisée
 * sous prefers-reduced-motion.
 */

// Glints de rosée sur la couronne : position en %, couleur de marque, délai.
const GLINTS = [
  { left: "18%", top: "22%", size: 7, color: "#F5C400", delay: 0 },
  { left: "78%", top: "18%", size: 5, color: "#FFFFFF", delay: 450 },
  { left: "86%", top: "58%", size: 6, color: "#F5C400", delay: 900 },
  { left: "64%", top: "86%", size: 5, color: "#FFFFFF", delay: 1350 },
  { left: "12%", top: "66%", size: 6, color: "#F5C400", delay: 1800 },
]

export const CartLoadingAnimation: React.FC<CartLoadingAnimationProps> = ({
  progress,
  remainingSeconds = null,
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)))
  const finalizing = clamped >= 100 && remainingSeconds !== null
  const secondsLeft = remainingSeconds ?? 0

  const ariaLabel = finalizing
    ? secondsLeft > 0
      ? `Finalisation du panier par l'IA, environ ${secondsLeft} secondes restantes`
      : "Finalisation du panier par l'IA, encore quelques instants"
    : `Génération du panier : ${clamped}%`

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {/* Scène : aube + rayons + couronne en orbite + panier qui respire */}
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.bloom} />
        <div className={styles.rays} />
        <img
          src="/images/launch/wreath.webp"
          alt=""
          className={`${styles.wreath} ${styles.wreathBack}`}
        />
        <img src="/images/launch/wreath.webp" alt="" className={styles.wreath} />
        <img
          src="/images/launch/basket.webp"
          alt=""
          className={`${styles.basket} ${finalizing ? styles.basketFinalizing : ""}`}
        />
        {GLINTS.map((glint) => (
          <span
            key={`${glint.left}-${glint.top}`}
            className={styles.glint}
            style={{
              left: glint.left,
              top: glint.top,
              width: glint.size,
              height: glint.size,
              background: glint.color,
              boxShadow: `0 0 10px 2px ${glint.color}`,
              animationDelay: `${glint.delay}ms`,
            }}
          />
        ))}
      </div>

      {/* Hero number: percentage, then estimated countdown once the bar is full */}
      <div className={styles.labelRow}>
        {finalizing ? (
          secondsLeft > 0 ? (
            <>
              <span className={`${styles.percentage} ${styles.countdown}`}>
                ~{secondsLeft}
                <span className={styles.unit}>s</span>
              </span>
              <span className={styles.label}>Finalisation par l&apos;IA…</span>
            </>
          ) : (
            <>
              <span className={`${styles.percentage} ${styles.dots}`} aria-hidden="true">
                <span>•</span>
                <span>•</span>
                <span>•</span>
              </span>
              <span className={styles.label}>Encore quelques instants…</span>
            </>
          )
        ) : (
          <>
            <span className={styles.percentage}>{clamped}%</span>
            <span className={styles.label}>Génération du panier…</span>
          </>
        )}
      </div>

      {/* Progress track (shimmers while finalizing) */}
      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={`${styles.progressFill} ${finalizing ? styles.progressFillFinalizing : ""}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

export default CartLoadingAnimation
