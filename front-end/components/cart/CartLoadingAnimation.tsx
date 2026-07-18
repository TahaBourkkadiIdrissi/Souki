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
 * CartLoadingAnimation – shown during AI smart basket generation.
 * Renders a cart SVG with an animated fill bar and a numeric percentage
 * that updates as `progress` changes. Once the bar tops out at 100 % while
 * the request is still in flight, the hero number switches to an estimated
 * countdown ("~19s") so the user knows the wait is expected.
 */
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
      {/* Cart SVG with fill overlay */}
      <div className={styles.cartWrapper}>
        {/* Fill bar rises from the bottom */}
        <div
          className={`${styles.fillBar} ${finalizing ? styles.fillBarFinalizing : ""}`}
          style={{ height: `${clamped}%` }}
          data-testid="fill-bar"
        />
        {/* Cart outline on top */}
        <svg
          className={styles.cartSvg}
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Cart body */}
          <rect x="18" y="28" width="60" height="40" rx="6" stroke="#F07C00" strokeWidth="4" />
          {/* Cart handle */}
          <path d="M18 28 L10 12" stroke="#F07C00" strokeWidth="4" strokeLinecap="round" />
          <path d="M10 12 H6" stroke="#F07C00" strokeWidth="4" strokeLinecap="round" />
          {/* Wheels */}
          <circle cx="30" cy="76" r="5" fill="#F07C00" />
          <circle cx="66" cy="76" r="5" fill="#F07C00" />
        </svg>
      </div>

      {/* Hero number: percentage, then estimated countdown once the bar is full */}
      <div className={styles.labelRow}>
        {finalizing ? (
          secondsLeft > 0 ? (
            <>
              <span className={styles.percentage}>
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
