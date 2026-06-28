"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, HeartHandshake, ShieldCheck, ShoppingBasket } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { MobileBottomNav } from "@/components/souki/mobile-bottom-nav"

export default function ParentDashboardPage() {
  const router = useRouter()
  const { isLoading, isAuthenticated, user, can } = useAuth()

  const isReturningUser = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("souki_has_logged_in") === "true"
  }, [])

  useEffect(() => {
    if (isLoading) {
      return
    }
    if (!isAuthenticated || !can("parent.dashboard.access")) {
      router.replace("/login?redirect=/parent")
    }
  }, [can, isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated || !can("parent.dashboard.access")) {
    return (
      <div className="min-h-screen bg-[#FFFDF4] flex items-center justify-center px-6">
        <div className="rounded-3xl border border-[#F2E7A0] bg-white p-8 shadow-sm text-center max-w-md">
          <p className="text-xs uppercase tracking-[0.25em] text-[#B08B12]">Espace Parent</p>
          <h1 className="mt-3 text-2xl font-bold text-[#3D3D3D]">Verification de votre acces</h1>
          <p className="mt-3 text-[#777777]">Nous preparons votre dashboard parental.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFDF4] pb-24 md:pb-0">
      <header className="hidden glass-ios26 border-b border-[#F2E7A0] md:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none border border-gray-100">
              <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[#B08B12]">Espace Parent</p>
              <h1 className="text-2xl font-bold text-[#3D3D3D]">{isReturningUser ? "Rebonjour" : "Bonjour"} {user?.email || "Parent"}</h1>
            </div>
          </div>
          <Link
            href="/catalogue"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#F5C400] px-5 py-3 font-semibold text-white hover:bg-[#EAB308] transition-colors"
          >
            <ShoppingBasket className="w-5 h-5" />
            Commander
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
        <div className="md:hidden">
          <p className="text-sm uppercase tracking-[0.22em] text-[#B08B12]">Espace Parent</p>
          <h1 className="mt-1 text-2xl font-bold text-[#3D3D3D]">{isReturningUser ? "Rebonjour" : "Bonjour"} {user?.email || "Parent"}</h1>
        </div>
        <section className="rounded-[32px] bg-white border border-[#F3EAAE] p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-[#B08B12]">Dashboard parental</p>
          <h2 className="mt-3 text-4xl font-bold text-[#3D3D3D]">Pilotez les commandes et l’organisation familiale.</h2>
          <p className="mt-4 max-w-2xl text-[#6F6F6F] leading-7">
            Cette vue est maintenant reliee au nouveau contexte RBAC. Seuls les comptes ayant la permission
            `parent.dashboard.access` peuvent y acceder.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: CalendarDays,
              title: "Planning des livraisons",
              text: "Suivez les commandes programmees pour la famille et les prochaines plages horaires.",
            },
            {
              icon: HeartHandshake,
              title: "Abonnements & proches",
              text: "Centralisez les besoins des enfants et les preferences alimentaires.",
            },
            {
              icon: ShieldCheck,
              title: "Accès sécurisé",
              text: "Les permissions sont verifiees cote serveur puis relayees cote interface.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-[28px] bg-white border border-[#F3EAAE] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF7CF] flex items-center justify-center text-[#B08B12]">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-[#3D3D3D]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#6F6F6F]">{item.text}</p>
            </article>
          ))}
        </section>
      </main>
      <MobileBottomNav />
    </div>
  )
}
