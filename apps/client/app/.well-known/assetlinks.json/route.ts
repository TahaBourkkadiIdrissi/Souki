import { ANDROID_APP_ID, androidCertFingerprints } from "@/lib/store-apps"

/**
 * Digital Asset Links : prouve que souki.io appartient à l'app Android SOUKI (io.souki.app).
 * L'app Google Play (PWA emballée, apps/play-store-pwa) s'affiche alors en plein écran, sans
 * barre d'adresse ; sans cette preuve, Chrome montre la barre d'adresse en haut de l'app.
 * Liste vide tant que ANDROID_APP_SHA256_FINGERPRINTS n'est pas renseignée (empreintes de la
 * clé de signature Google Play et de la clé d'importation, voir apps/play-store-pwa/README.md).
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
