"use client"

import NextImage, { type ImageProps } from "next/image"
import { useState } from "react"

/** Proxy/authenticated media and unconfigured remote hosts retain direct loading.
 * Curated public photos and local artwork use responsive Next.js optimization.
 * Do not enable arbitrary remote optimizer hosts (server-side fetch/SSRF).
 */
export default function OptimizedImage({ fallbackImage, ...props }: ImageProps & { fallbackImage?: string }) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null)
  const src = failedSrc === props.src && fallbackImage ? fallbackImage : props.src
  let direct = false
  if (typeof src === "string") {
    direct = src.startsWith("/backend/") || src.startsWith("//")
    if (/^https?:\/\//.test(src)) {
      const url = new URL(src)
      direct = url.protocol !== "https:" || !(
        url.hostname === "images.unsplash.com" ||
        (url.hostname === "cdn.pixabay.com" && url.pathname.startsWith("/photo/")) ||
        (url.hostname === "reowdwijnmkjujcqqztx.supabase.co" && url.pathname.startsWith("/storage/v1/object/public/products/")) ||
        (url.hostname === "tse1.mm.bing.net" && url.pathname.startsWith("/th/id/"))
      )
    }
  }
  return <NextImage {...props} src={src} unoptimized={props.unoptimized ?? direct} onError={(event) => {
    if (fallbackImage && src !== fallbackImage) setFailedSrc(props.src)
    props.onError?.(event)
  }} />
}
