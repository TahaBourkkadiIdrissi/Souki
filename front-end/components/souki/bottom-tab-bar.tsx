"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Leaf, PackageCheck, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Accueil", href: "/", icon: Home },
  { label: "Catalogue", href: "/catalogue", icon: Leaf },
  { label: "Historique", href: "/historique", icon: PackageCheck },
  { label: "Paramètres", href: "/parametres", icon: Settings },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7F0E8] bg-white/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 md:hidden"
      aria-label="Navigation principale PWA"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-bold transition-colors",
                isActive ? "text-[#1B4332]" : "text-[#6B7280]"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                isActive && "bg-[#EAF8EC]"
              )}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
