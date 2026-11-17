import { BrandButton } from "@/components/brand-button"
import type { PrimaryButtonProps } from "@/components/primary-button"

/**
 * Sur iOS aussi, le bouton principal reprend la capsule verte de la PWA (identite SOUKI)
 * plutot que le bouton SwiftUI standard. (Import direct de brand-button : sur iOS,
 * « @/components/primary-button » designe ce fichier-ci.)
 */
export function PrimaryButton(props: PrimaryButtonProps) {
  return <BrandButton {...props} tone="primary" />
}
