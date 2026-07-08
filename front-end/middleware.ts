import { NextRequest, NextResponse } from "next/server"

// Limite de taille de corps au niveau du proxy /backend (VULN-008) : backstop
// au-dessus de la limite applicative de 10 Mo (le backend repond 413 avec un
// message precis avant cette limite). Evite qu'un corps arbitrairement gros
// atteigne le backend via le proxy same-origin.
const MAX_PROXY_BODY_BYTES = 12 * 1024 * 1024

export function middleware(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json(
      { detail: "Corps de requête trop volumineux." },
      { status: 413 }
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: "/backend/:path*",
}
