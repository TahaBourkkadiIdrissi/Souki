"use client"

import { useEffect, useRef } from "react"
import { ArrowDown, Ellipsis, PlusSquare, Share, X, Compass } from "lucide-react"
import { installPlatform } from "@/lib/pwa-install"

export function IosInstallGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const platform = installPlatform()
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} onCancel={onClose} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-[#F4FAF3] p-6 text-[#173D25] backdrop:bg-black/40">
    <button onClick={onClose} aria-label="Fermer le guide" className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white"><X /></button>
    <div className="mx-auto flex h-full max-w-sm flex-col justify-center gap-8">
      <h2 className="text-3xl font-bold">Souki, à portée de main.</h2>
      {platform.embedded ? <>
        <Compass className="size-20 text-[#1E8A3C]" />
        <h3 className="text-xl font-semibold">Ouvrir dans Safari</h3>
        <p>Touchez le menu <strong>···</strong> du navigateur, puis « Ouvrir dans Safari ».</p>
        <button className="rounded-xl bg-white p-3" onClick={async (event) => {
          const button = event.currentTarget
          try { await navigator.clipboard.writeText(location.href); button.textContent = "Lien copié" } catch { /* URL remains selectable below. */ }
        }}>Copier le lien</button>
        <p className="break-all text-sm select-all">{location.href}</p>
      </> : <>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <span className="text-sm font-semibold">1 · {platform.modernSafari || platform.chromeIos ? "Menu, puis Partager" : "Partager"}</span>
          <div className="mt-5 flex items-center justify-around text-[#1E8A3C]">{(platform.modernSafari || platform.chromeIos) && <Ellipsis className="size-10" />}<Share className="size-12" /></div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <span className="text-sm font-semibold">2 · Sur l’écran d’accueil</span>
          <div className="mt-5 flex items-center gap-4"><PlusSquare className="size-10 text-[#1E8A3C]" /><span>Puis <strong>Ajouter</strong></span></div>
        </div>
        <p className="text-sm">Retrouvez ce symbole dans la barre de votre navigateur.</p>
        <div className="flex justify-center motion-safe:animate-bounce"><ArrowDown className="size-10" /><Share className="size-10" /></div>
      </>}
    </div>
  </dialog>
}
