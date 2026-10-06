"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { ChevronDown, Heart, MapPin, User } from "lucide-react"
import { SoukiLogoLink } from "@/components/souki/souki-logo"

export function PwaHomeHeader({ address, name, photo, favorites }: {
  address: string; name: string; photo: string | null; favorites: number
}) {
  const anchor = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    if (anchor.current) observer.observe(anchor.current)
    return () => observer.disconnect()
  }, [])
  const content = <>
    <SoukiLogoLink href="/pwa-welcome" variant="symbol" height={30} priority className="flex size-11 items-center justify-center rounded-full bg-white/10 [&_img]:brightness-0 [&_img]:invert" />
    <Link href="/parametres/compte#adresse" className="flex h-11 min-w-0 items-center gap-1 rounded-full bg-white/10 px-2" aria-label={`Adresse de livraison : ${address || "Ajouter une adresse"}`}>
      <MapPin className="size-4 shrink-0 text-[#9BE7AE]" />
      <span className="min-w-0 flex-1"><span className="block text-[9px] text-[#9BE7AE]">Livraison à</span><span className="block truncate text-xs font-bold">{address || "Ajouter une adresse"}</span></span>
      <ChevronDown className="size-3 shrink-0" />
    </Link>
    <div className="flex gap-1.5">
      <Link href="/favoris" aria-label="Mes favoris" className="relative flex size-11 items-center justify-center rounded-full bg-white/10">
        <Heart className="size-5" />{favorites > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#E4405F] px-1 text-[10px] font-bold">{favorites > 9 ? "9+" : favorites}</span>}
      </Link>
      <Link href="/parametres" aria-label="Profil et paramètres" className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-[#EAFBEF] font-bold text-[#14522A]">
        {photo ? <img src={photo} alt="" className="size-full object-cover" /> : name ? name[0].toUpperCase() : <User className="size-5" />}
      </Link>
    </div>
  </>
  return <>
    <div ref={anchor} className="grid grid-cols-[44px_minmax(0,1fr)_94px] items-center gap-2 text-white">{content}</div>
    {compact && createPortal(<div className="fixed inset-x-0 top-0 z-50 bg-[#124A27]/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] text-white shadow-md backdrop-blur-md">
      <div className="mx-auto grid max-w-lg grid-cols-[44px_minmax(0,1fr)_94px] items-center gap-2">{content}</div>
    </div>, document.body)}
  </>
}
