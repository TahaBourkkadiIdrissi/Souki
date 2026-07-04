import Link from "next/link"
import { Home } from "lucide-react"

import { RecolteAvatar } from "@/components/avatar/recolte-avatar"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-3xl border border-[#DDE7DE] bg-white px-8 py-10 text-center shadow-sm">
        <RecolteAvatar size="md" expression="curious" className="mx-auto" label="Récolte n'a pas trouvé la page" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#6E8B73]">SOUKI</p>
        <h1 className="mt-3 text-5xl font-black text-[#1E8A3C]">404</h1>
        <p className="mt-3 text-sm leading-6 text-[#677669]">
          Cette page n&apos;existe pas ou a ete deplacee.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1E8A3C]/90"
        >
          <Home className="size-4" aria-hidden="true" />
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  )
}
