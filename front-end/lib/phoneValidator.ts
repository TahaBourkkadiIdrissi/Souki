const MOROCCAN_REGEX = /^\+212[67]\d{8}$/;

/**
 * Normalise un numéro marocain vers +212XXXXXXXXX.
 * Accepte : 06XXXXXXXX, 07XXXXXXXX, 6XXXXXXXX, 7XXXXXXXX, +212XXXXXXXXX, 00212XXXXXXXXX
 */
export function normalizeMoroccanPhone(raw: string): string {
  const v = raw.trim().replace(/[\s\-]/g, "");
  if (v.startsWith("+212")) return v;
  if (v.startsWith("00212")) return "+" + v.slice(2);
  if (v.startsWith("0")) return "+212" + v.slice(1);
  return "+212" + v;
}

/**
 * Retourne true si le numéro est un mobile marocain valide (06 ou 07).
 * La vérification d'existence réelle est assurée côté backend (phonenumbers/ANRT).
 */
export function isValidMoroccanPhone(raw: string): boolean {
  if (!raw?.trim()) return false;
  return MOROCCAN_REGEX.test(normalizeMoroccanPhone(raw));
}

export const PHONE_ERROR_MSG =
  "Format invalide. Exemples valides : 0612345678, 0712345678";
