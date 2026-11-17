import { readItem, removeItem, writeItem } from "@/lib/device-storage"

/**
 * Jeton JWT du client. L'app n'a pas de cookie : le back-end lit l'en-tete
 * `Authorization: Bearer` quand le cookie httpOnly est absent (back-end/auth_dependencies.py).
 */
const TOKEN_KEY = "souki_access_token"

let cached: string | null | undefined

export async function getAccessToken(): Promise<string | null> {
  if (cached === undefined) cached = await readItem(TOKEN_KEY)
  return cached
}

/**
 * `persist: false` (« Se souvenir de moi » decoche) : le jeton reste en memoire et la
 * session se termine a la fermeture de l'app.
 */
export async function setAccessToken(token: string, persist = true): Promise<void> {
  cached = token
  if (persist) await writeItem(TOKEN_KEY, token)
  else await removeItem(TOKEN_KEY)
}

export async function clearAccessToken(): Promise<void> {
  cached = null
  await removeItem(TOKEN_KEY)
}
