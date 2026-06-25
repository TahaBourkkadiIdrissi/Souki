"use client"

import React from "react"
import styles from "./CartLoadingAnimation.module.css"

interface CartLoadingAnimationProps {
  /** Progress percentage 0–100 */
  progress: number
}

/**
 * CartLoadingAnimation – shown during AI smart basket generation.
 * Renders a cart SVG with an animated fill bar and a numeric percentage
 * that updates as `progress` changes.
 */
export const CartLoadingAnimation: React.FC<CartLoadingAnimationProps> = ({ progress }) => {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)))

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-label={`Génération du panier : ${clamped}%`}
    >
      {/* Cart SVG with fill overlay */}
      <div className={styles.cartWrapper}>
        {/* Fill bar rises from the bottom */}
        <div
          className={styles.fillBar}
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

      {/* Percentage label */}
      <div className={styles.labelRow}>
        <span className={styles.percentage}>{clamped}%</span>
        <span className={styles.label}>Génération du panier…</span>
      </div>

      {/* Progress track */}
      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

export default CartLoadingAnimation
