"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { usePwaStandalone } from "@/hooks/usePwaStandalone"

/** Page legale unique du site. Il n'y a jamais eu de route /cgu. */
export const POLICY_PATH = "/politique-confidentialite"

/**
 * Lien vers la politique de confidentialite.
 *
 * Depuis l'app installee, la politique s'ouvre dans le navigateur et non dans la
 * PWA : un document legal n'a pas a enfermer l'utilisateur dans un contexte sans
 * barre d'adresse ni bouton retour, surtout depuis un formulaire d'inscription
 * qu'il perdrait en naviguant. Sur le web, c'est une navigation interne normale.
 */
export function PolicyLink({
  className,
  children = "Politique de Confidentialité",
}: {
  className?: string
  children?: ReactNode
}) {
  const isStandalone = usePwaStandalone()

  if (!isStandalone) {
    return (
      <Link href={POLICY_PATH} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <a
      href={POLICY_PATH}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(event) => {
        // iOS en mode standalone ignore parfois target="_blank" et navigue sur
        // place : on force l'ouverture externe.
        event.preventDefault()
        window.open(`${window.location.origin}${POLICY_PATH}`, "_blank", "noopener,noreferrer")
      }}
    >
      {children}
    </a>
  )
}
