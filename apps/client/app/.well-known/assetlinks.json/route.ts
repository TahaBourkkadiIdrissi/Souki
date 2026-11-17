import { ANDROID_APP_ID, androidCertFingerprints } from "@/lib/store-apps"

/**
 * Digital Asset Links : autorise l'app Android SOUKI (io.souki.app) à ouvrir les liens
 * https://souki.io/produit/… et https://souki.io/r/… (liens d'app vérifiés, `autoVerify`).
 * Liste vide tant que ANDROID_APP_SHA256_FINGERPRINTS n'est pas renseignée.
 */
export const dynamic = "force-dynamic"

export function GET() {
  const fingerprints = androidCertFingerprints()
  const statements =
    fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: ANDROID_APP_ID, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : []
  return Response.json(statements, { headers: { "Cache-Control": "public, max-age=3600" } })
}
