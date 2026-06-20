"use client"

import { usePathname } from "next/navigation"

import { SupplierShell } from "@/components/souki/supplier-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { canAccessRoute } from "@/lib/routes"

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoading, isAuthenticated, user } = useAuth()

  const decision = canAccessRoute({ pathname, user, isAuthenticated, isLoading })

  if (!decision.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#DDEBDD] bg-background px-8 py-10 text-center shadow-sm dark:border-border">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[#DDEBDD] bg-white p-0.5 shadow-sm">
            <img
              src="/logo3.png"
              alt="SOUKI"
              className="h-full w-[175%] max-w-none object-cover"
              style={{ objectPosition: "left center" }}
            />
          </div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Espace fournisseur</p>
          <h1 className="mt-3 text-2xl font-bold text-primary [font-family:var(--font-poppins)]">
            Vérification des accès
          </h1>
          <p className="mt-3 text-muted-foreground">Nous validons votre session et vos permissions.</p>
          <div className="mx-auto mt-6 flex max-w-[13rem] gap-2">
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-2 flex-1 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return <SupplierShell>{children}</SupplierShell>
}
