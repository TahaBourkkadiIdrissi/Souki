export type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

export function isPwaStandalone() {
  if (typeof window === "undefined") {
    return false
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  )
}
