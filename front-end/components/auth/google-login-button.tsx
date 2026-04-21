"use client"

import { useEffect, useRef, useState } from "react"

import { Loader2 } from "lucide-react"

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential?: string }) => void
            ux_mode?: "popup" | "redirect"
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon"
              theme?: "outline" | "filled_blue" | "filled_black"
              size?: "large" | "medium" | "small"
              text?:
                | "signin_with"
                | "signup_with"
                | "continue_with"
                | "signin"
              shape?: "rectangular" | "pill" | "circle" | "square"
              logo_alignment?: "left" | "center"
              width?: number
              locale?: string
            }
          ) => void
          cancel?: () => void
        }
      }
    }
  }
}

type GoogleLoginButtonProps = {
  onCredential: (credential: string) => Promise<void>
  onError: (message: string) => void
  disabled?: boolean
  label?: string
  className?: string
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

let googleScriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Sign-In est disponible uniquement dans le navigateur."))
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]'
      )

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true })
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Impossible de charger Google Sign-In.")),
          { once: true }
        )
        return
      }

      const script = document.createElement("script")
      script.src = "https://accounts.google.com/gsi/client"
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Impossible de charger Google Sign-In."))
      document.head.appendChild(script)
    })
  }

  return googleScriptPromise
}

let googleInitialized = false

export function GoogleLoginButton({
  onCredential,
  onError,
  disabled = false,
  className = "",
}: GoogleLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onCredentialRef = useRef(onCredential)
  const onErrorRef = useRef(onError)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    onCredentialRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    let isMounted = true

    const setupGoogleButton = async () => {
      if (!containerRef.current) {
        return
      }

      if (!GOOGLE_CLIENT_ID) {
        onErrorRef.current("Google Client ID introuvable. Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID.")
        setIsLoading(false)
        return
      }

      try {
        await loadGoogleScript()

        const googleId = window.google?.accounts?.id
        if (!googleId || !containerRef.current || !isMounted) {
          return
        }

        containerRef.current.innerHTML = ""

        if (!googleInitialized) {
          googleId.initialize({
            client_id: GOOGLE_CLIENT_ID,
            ux_mode: "popup",
            auto_select: false,
            cancel_on_tap_outside: true,
            callback: async ({ credential }) => {
              if (!credential) {
                onErrorRef.current("La connexion Google a ete annulee.")
                return
              }

              try {
                await onCredentialRef.current(credential)
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "La connexion Google a echoue."
                onErrorRef.current(message)
              }
            },
          })
          googleInitialized = true
        }

        googleId.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 380,
          locale: "fr",
        })

        setIsLoading(false)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "La connexion Google a echoue."
        onErrorRef.current(message)
        setIsLoading(false)
      }
    }

    void setupGoogleButton()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div
      className={`w-full ${disabled ? "pointer-events-none opacity-60" : ""} ${className}`}
    >
      {isLoading ? (
        <div className="flex h-[52px] items-center justify-center gap-3 rounded-xl bg-white text-[#3D3D3D]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Chargement de Google...</span>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={`${isLoading ? "hidden" : "flex h-[52px] w-full items-center justify-center overflow-hidden rounded-xl"} google-login-host`}
      />
    </div>
  )
}
