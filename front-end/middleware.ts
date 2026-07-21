import { NextRequest, NextResponse } from "next/server"

// Limite de taille de corps au niveau du proxy /backend (VULN-008) : backstop
// au-dessus de la limite applicative de 10 Mo (le backend repond 413 avec un
// message precis avant cette limite). Evite qu'un corps arbitrairement gros
// atteigne le backend via le proxy same-origin.
const MAX_PROXY_BODY_BYTES = 12 * 1024 * 1024

/**
 * Origine reelle de la requete, telle que la voit le navigateur.
 *
 * Derriere le proxy Vercel, request.nextUrl porte l'URL interne : seuls les
 * en-tetes x-forwarded-* donnent l'hote public. x-forwarded-host peut contenir
 * une liste (« a, b »), on retient le premier element.
 */
function getRequestOrigin(request: NextRequest): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host")
  if (!host) {
    return null
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "")
  return `${protocol}://${host}`
}

export function middleware(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json(
      { detail: "Corps de requête trop volumineux." },
      { status: 413 }
    )
  }

  /*
   * Controle CSRF a la frontiere du proxy (VULN-010).
   *
   * Le backend refuse toute ecriture authentifiee par cookie dont l'en-tete Origin
   * n'appartient pas a FRONTEND_ORIGINS. Or /backend est un proxy same-origin : le
   * navigateur envoie l'origine du front (URL de production Vercel, URL de preview,
   * localhost...), que le backend ne peut pas connaitre a l'avance — d'ou des 403
   * « Origine non autorisee » sur le panier et la composition de plats depuis l'app
   * installee.
   *
   * On fait donc la verification ici, ou l'origine attendue est connue de facon
   * certaine : si l'Origin correspond a l'hote de la requete, c'est une vraie requete
   * same-origin et on retire l'en-tete avant de relayer (le backend ne teste que les
   * Origin presents, il laisse donc passer). Toute origine tierce est transmise telle
   * quelle et reste rejetee par le backend. La protection est conservee, simplement
   * appliquee la ou elle peut l'etre correctement.
   */
  const origin = request.headers.get("origin")
  if (origin && origin === getRequestOrigin(request)) {
    const headers = new Headers(request.headers)
    headers.delete("origin")
    return NextResponse.next({ request: { headers } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/backend/:path*",
}
