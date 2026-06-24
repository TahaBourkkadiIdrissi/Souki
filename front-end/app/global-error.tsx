"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            background: "#F5F5F0",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              borderRadius: "1.5rem",
              border: "1px solid #DDE7DE",
              background: "#fff",
              padding: "2.5rem 2rem",
              textAlign: "center",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.25em", textTransform: "uppercase", color: "#6E8B73" }}>
              SOUKI
            </p>
            <h1 style={{ marginTop: "0.75rem", fontSize: "1.5rem", fontWeight: 700, color: "#1E8A3C" }}>
              Une erreur critique est survenue
            </h1>
            <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", lineHeight: 1.6, color: "#677669" }}>
              Veuillez recharger l&apos;application.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                width: "100%",
                borderRadius: "1rem",
                background: "#1E8A3C",
                color: "#fff",
                padding: "0.75rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Recharger
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
