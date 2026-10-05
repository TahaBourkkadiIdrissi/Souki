export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window { soukiInstallPrompt?: InstallPromptEvent | null }
}

export function installPlatform(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints) {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)
  return {
    ios,
    android: /Android/i.test(ua),
    chromeIos: /CriOS/i.test(ua),
    embedded: /Instagram|FBAN|FBAV|WhatsApp|TikTok|Bytedance|\bwv\b/i.test(ua),
    modernSafari: ios && /OS 2[6-9]_/i.test(ua),
  }
}

export function chromeIntent(url: string) {
  const target = new URL(url)
  return `intent://${target.host}${target.pathname}${target.search}#Intent;scheme=${target.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target.href)};end`
}
