"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Home, RefreshCw } from "lucide-react"

export default function Error({
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
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-3xl border border-[#DDE7DE] bg-white px-8 py-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6E8B73]">SOUKI</p>
        <h1 className="mt-3 text-2xl font-bold text-[#1E8A3C]">Une erreur est survenue</h1>
        <p className="mt-3 text-sm leading-6 text-[#677669]">
          Quelque chose s&apos;est mal passe. Vous pouvez reessayer ou revenir a l&apos;accueil.
        </p>
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1E8A3C]/90"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Reessayer
          </button>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#DDE7DE] px-4 py-3 text-sm font-bold text-[#1E8A3C] transition-colors hover:bg-[#F7FCF7]"
          >
            <Home className="size-4" aria-hidden="true" />
            Retour a l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
