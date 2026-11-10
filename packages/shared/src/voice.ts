/**
 * Analyse vocale « Du mot au panier » (VoiceAnalysis, design system 2027).
 *
 * POST /api/voice-basket renvoie la phrase transcrite et le panier, sans dire quel groupe de
 * mots a donne quel produit. Comme le prevoit la fiche du design system, l'app retrouve ce lien
 * en cherchant dans la phrase les noms du produit (francais, darija latine, darija arabe). Ce
 * lien sert seulement a l'animation ; le panier, lui, vient toujours du serveur.
 */

export interface VoiceSpanSource<T> {
  /** Noms du produit a chercher dans la phrase (francais, darija, arabe). */
  names: string[]
  payload: T
}

export interface VoiceSpan<T> {
  /** Texte du groupe, tel qu'il a ete dit ; vide si le produit n'a pas ete retrouve dans la phrase. */
  text: string
  item?: T
  /** Produit demande que SOUKI ne vend pas (nom renvoye par le serveur). */
  missing?: string
}

/** Mots de quantite qui precedent le produit (« 2 kilo », « nss kilo », « deux bottes de »…). */
const QUANTITY_WORD =
  /^(\d+([.,]\d+)?|\d+\/\d+|kilos?|kg|g|gr|grammes?|livres?|nss|nos|nouss|nesf|demi|botte?s?|bottes?|lots?|pieces?|pièces?|dyal|d|de|du|des|un|une|deux|trois|quatre|cinq|six|wahed|wa7ed|jouj|zouj|tlata|rb3a|reb3a|khamsa|kilou|كيلو|كيلوات|نص|ديال|واحد|جوج|زوج|تلاتة|ربعة|خمسة|غرام)$/i
const CONNECTOR = /^(w|wa|et|o|و|ou|,)$/i

/** Lettres sans accents et en minuscules, avec pour chaque lettre sa position dans le texte d'origine. */
function foldWithIndex(text: string): { folded: string; origin: number[] } {
  let folded = ""
  const origin: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    const plain = text[index].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    for (const char of plain) {
      folded += char
      origin.push(index)
    }
  }
  return { folded, origin }
}

function fold(text: string): string {
  return foldWithIndex(text).folded.trim()
}

/** « Tomates » cherche aussi « tomate ». */
function variants(name: string): string[] {
  const base = fold(name)
  if (base.length < 3) return []
  const out = [base]
  if (base.length > 4 && base.endsWith("s")) out.push(base.slice(0, -1))
  return out
}

/** Debut du groupe : on remonte sur les mots de quantite (et un « w » / « et ») avant le nom. */
function groupStart(text: string, from: number, nameStart: number): number {
  const before = text.slice(from, nameStart)
  const words = [...before.matchAll(/\S+/g)]
  let start = nameStart
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const word = words[index][0].replace(/[,;.]+$/, "")
    if (QUANTITY_WORD.test(word)) start = from + (words[index].index ?? 0)
    else if (CONNECTOR.test(word)) {
      // « w 2 dyal na3na3 », « w zitoun » : le « w » / « et » ouvre le groupe.
      start = from + (words[index].index ?? 0)
      break
    } else break
  }
  return start
}

/** Texte entre deux groupes : la ponctuation seule reste collee au groupe precedent (« maticha, »). */
function pushLead<T>(spans: VoiceSpan<T>[], raw: string) {
  const lead = raw.trim()
  if (!lead) return
  const previous = spans[spans.length - 1]
  if (previous && /^[\s\p{P}]+$/u.test(lead)) previous.text = `${previous.text}${lead}`
  else spans.push({ text: lead })
}

export function buildVoiceSpans<T>(transcription: string, items: VoiceSpanSource<T>[], missing: string[] = []): VoiceSpan<T>[] {
  const text = transcription.trim()
  const { folded, origin } = foldWithIndex(text)
  const taken: [number, number][] = []
  const free = (start: number, end: number) => taken.every(([a, b]) => end <= a || start >= b)

  type Found = { start: number; end: number; span: VoiceSpan<T> }
  const found: Found[] = []
  const lost: VoiceSpan<T>[] = []

  const locate = (names: string[], span: VoiceSpan<T>) => {
    let best: { start: number; end: number } | null = null
    for (const name of names) {
      for (const variant of variants(name)) {
        let at = folded.indexOf(variant)
        while (at >= 0) {
          const start = origin[at]
          const end = origin[at + variant.length - 1] + 1
          if (free(start, end) && (!best || start < best.start)) {
            best = { start, end }
            break
          }
          at = folded.indexOf(variant, at + 1)
        }
      }
    }
    if (!best) {
      lost.push(span)
      return
    }
    // Le mot entier : « maticha » dans « maticha, » ou « tomates » trouve par « tomate ».
    let end = best.end
    while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end += 1
    taken.push([best.start, end])
    found.push({ start: best.start, end, span })
  }

  for (const entry of items) locate(entry.names, { text: "", item: entry.payload })
  for (const name of missing) locate([name], { text: "", missing: name })

  found.sort((a, b) => a.start - b.start)
  const spans: VoiceSpan<T>[] = []
  let cursor = 0
  for (const entry of found) {
    const start = Math.max(cursor, groupStart(text, cursor, entry.start))
    pushLead(spans, text.slice(cursor, start))
    spans.push({ ...entry.span, text: text.slice(start, entry.end).trim() })
    cursor = entry.end
  }
  pushLead(spans, text.slice(cursor))
  // Produits que la phrase ne nomme pas tels quels : ils passent quand meme en vedette, a la fin.
  return [...spans, ...lost]
}
