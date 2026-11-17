import type { LucideIcon } from "lucide-react-native"

import { BrandButton } from "@/components/brand-button"

export type PrimaryButtonProps = {
  label: string
  onPress: () => void
  disabled?: boolean
  icon?: LucideIcon
}

/** Bouton principal : capsule verte SOUKI (voir brand-button.tsx). */
export function PrimaryButton(props: PrimaryButtonProps) {
  return <BrandButton {...props} tone="primary" />
}
