/**
 * Brouillon de la commande vocale (T_CommandeVocale) mis au panier : la liste vocale passe
 * maintenant par « Ajouter au panier » (design 2027), puis par le panier. Le checkout reprend ce
 * numero pour garder le lien voix -> commande (`brouillon_vocal_id`), comme le site. Memoire de
 * la session seulement : rien n'est garde sur le telephone.
 */
let pendingVoiceDraftId: number | null = null

export function rememberVoiceDraft(id: number | null | undefined): void {
  if (typeof id === "number" && id > 0) pendingVoiceDraftId = id
}

export function peekVoiceDraft(): number | null {
  return pendingVoiceDraftId
}

export function forgetVoiceDraft(): void {
  pendingVoiceDraftId = null
}
