import type { TextStyle } from "react-native"

/**
 * Design system SOUKI 2027 (artifact « SOUKI 2027 », project/tokens.json), upgrade de
 * l'identite de la PWA : memes couleurs, deux verts a deux roles (souki-900 = decision,
 * market-600 = mouvement), orange qui porte de l'encre, ombres teintees vert.
 * Mode clair uniquement, comme le site.
 */
export const tokens = {
  /** Vert du logo. DECISION : boutons principaux, selecteur deplie, bulle de quantite (blanc dessus 8,1:1). */
  souki900: "#005B43",
  /** Vert « prix » : texte vert sur blanc ou creme (prix, liens, montants), 6,6:1. */
  market700: "#176B2E",
  /** Vert marche. MOUVEMENT : jauges, contour « dans le panier », icones actives, focus. Jamais de petit texte blanc dessus. */
  market600: "#1E8A3C",
  /** Vert frais : fin de degrade, point « ouvert », elements sur fond sombre. Jamais pour une jauge ou du texte sur clair. */
  fresh500: "#4CB84A",
  /** Vert feuille du logo : mascotte, confettis, chemin de livraison une fois offerte. */
  leaf500: "#22AA3F",
  /** Vert nuit : depart des degrades d'en-tete, carte « Marche ferme ». */
  night950: "#0A2814",
  /** Vert profond du hero, fond du mode « soir ». */
  green950: "#0C3B22",
  /** Etape centrale du degrade d'en-tete. */
  forest800: "#14522A",
  /** Depart du degrade de la carte « Commande vocale ». */
  forest700: "#123F22",
  /** Fin du degrade « Commande vocale », barres d'onde de l'orbe. */
  forest900: "#0A2614",
  /** Menthe : texte secondaire et icones SUR fond vert sombre uniquement. */
  mint300: "#9BE7AE",
  /** Vert pale : pastilles, selecteur de quantite clair, lignes « offerte ». */
  pale50: "#F0FAF1",
  /** Piste des jauges, separateurs sur pale-50. */
  green100: "#DDEFE0",
  /** Fond du bouton « soft » (texte souki-900). */
  softFill: "#E7F5E8",
  /** Fond des photos produit carrees. */
  photoBg: "#F1F6EF",
  /** Orange urgence. Porte de l'ENCRE (ink-900), jamais du blanc. */
  orange500: "#F07C00",
  /** Orange en TEXTE (ou icone) sur fond clair. */
  orange700: "#B35400",
  /** Fond des alertes orange. */
  orange50: "#FFF1DE",
  /** Jaune badges et lune du mode ferme. Toujours de l'encre dessus. */
  yellow400: "#F5C400",
  /** Coeur des favoris uniquement. */
  pink500: "#E4405F",
  /** Rupture, suppression, erreurs uniquement. */
  red600: "#DC2626",
  /** Bleu confiance (une tuile de rayon). */
  trust700: "#1A4F8A",
  /** Texte principal (et texte sur orange / jaune). */
  ink900: "#1F2A22",
  /** Corps de texte long. */
  ink700: "#3D3D3D",
  /** Texte secondaire (unites, darija, dates), 4,8:1 sur creme. */
  ink500: "#647366",
  /** Placeholders et icones decoratives uniquement (3,45:1). */
  ink400: "#7C8B7D",
  /** Icones desactivees, squelettes fonces. */
  ink300: "#A9B4AA",
  /** Fond de tous les ecrans. */
  cream: "#FBFBF7",
  /** Sections alternees, listes groupees. */
  section: "#F2F6F3",
  /** Remplissage neutre (champs, squelettes clairs). */
  sand: "#F5F5F0",
  white: "#FFFFFF",
  /** Separateurs et bordures de carte (1 pt). */
  line: "#E7ECE5",
  /** Verre clair de la barre d'onglets et de la mini-barre panier. */
  glass: "rgba(251, 251, 247, 0.74)",
  /** Pastilles et boutons ronds poses sur l'en-tete vert. */
  glassOnDark: "rgba(255, 255, 255, 0.12)",
  /** Lisere des elements en verre sur fond vert. */
  glassStroke: "rgba(255, 255, 255, 0.22)",
  /** Voile vert sur la photo d'etal. */
  veil: "rgba(10, 40, 20, 0.72)",
  /** Fond derriere les feuilles. */
  scrim: "rgba(10, 40, 20, 0.40)",
  /** Orbe de la commande vocale. Reserve a la voix. */
  voiceCyan: "#50DCE6",
  voiceTeal: "#28BEAA",
  tileHerbFrom: "#7CCB6B",
  tileHerbTo: "#B6E3A4",
  tileOrangeTo: "#FFB547",
  tileSoukiTo: "#2E7D4F",
  tileYellowTo: "#FFE27A",
  tileTrustTo: "#4A86C5",
} as const

/**
 * Palette historique : les anciens noms restent valables (alias des tokens 2027) pour ne
 * casser aucun ecran. Les nouveaux ecrans utilisent les noms 2027 (`palette.souki900`…).
 */
export const palette = {
  ...tokens,
  /** Alias de souki-900. */
  green900: tokens.souki900,
  /** Alias de green-950. */
  green950: tokens.green950,
  /** Alias de market-600 (mouvement, pas de texte blanc dessus). */
  green700: tokens.market600,
  /** Alias de fresh-500. */
  green500: tokens.fresh500,
  /** Alias de leaf-500. */
  leaf: tokens.leaf500,
  /** Alias de mint-300. */
  mint: tokens.mint300,
  /** Alias de pale-50. */
  green50: tokens.pale50,
  green100: tokens.green100,
  /** Alias de orange-500 (porte de l'encre). */
  orange: tokens.orange500,
  orange50: tokens.orange50,
  /** Alias de yellow-400. */
  yellow: tokens.yellow400,
  /** Alias de pink-500. */
  pink: tokens.pink500,
  /** Alias de red-600. */
  red: tokens.red600,
  /** Alias de ink-900. */
  ink: tokens.ink900,
  /** Alias de ink-700. */
  inkSoft: tokens.ink700,
  /** UPGRADE 2027 : texte secondaire = ink-500 (#647366), plus #7C8B7D (sous AA). */
  muted: tokens.ink500,
  /** Ancien gris du texte secondaire, garde pour les placeholders. */
  placeholder: tokens.ink400,
} as const

/** Ancien nom garde pour les composants natifs (@expo/ui, onglets, theme de navigation). */
export const BRAND_GREEN = palette.green900
export const BRAND_GREEN_DARK_MODE = palette.green500

/** Couleurs par role. */
export const colors = {
  brand: tokens.souki900,
  brandBright: tokens.market600,
  brandFill: tokens.pale50,
  onBrand: tokens.white,
  accent: tokens.orange500,
  label: tokens.ink900,
  secondaryLabel: tokens.ink500,
  tertiaryLabel: tokens.ink300,
  separator: tokens.line,
  background: tokens.cream,
  card: tokens.white,
  fill: tokens.sand,
  imagePlaceholder: tokens.photoBg,
  warning: tokens.orange700,
  danger: tokens.red600,
  favorite: tokens.pink500,
  /** Fond des boutons principaux, selecteur deplie, bulle de quantite. */
  decision: tokens.souki900,
  /** Jauges, contours actifs, icones actives, focus. */
  motion: tokens.market600,
  /** Prix, liens et montants sur fond clair. */
  price: tokens.market700,
  /** Texte et icones poses sur orange-500 ou yellow-400. */
  onAccent: tokens.ink900,
  /** Texte orange sur fond clair (minimum non atteint). */
  accentText: tokens.orange700,
  /** Corps de texte long. */
  bodyText: tokens.ink700,
  placeholder: tokens.ink400,
  section: tokens.section,
} as const

/** Degrades autorises : en-tete (horloge du marche), tuiles de rayon, carte vocale. */
export const gradients = {
  hero: [tokens.night950, tokens.forest800, tokens.market600] as const,
  market: [tokens.night950, tokens.forest800, tokens.market600] as const,
  /** Horloge du marche : l'en-tete change d'etat avec l'heure. */
  clock: {
    open: [tokens.night950, tokens.forest800, tokens.market600] as const,
    evening: [tokens.night950, tokens.green950, tokens.souki900] as const,
    lastHour: [tokens.orange500, tokens.orange500] as const,
    closed: [tokens.night950, tokens.night950] as const,
  },
  voice: [tokens.forest700, tokens.forest900] as const,
  tiles: [
    [tokens.market600, tokens.fresh500],
    [tokens.tileHerbFrom, tokens.tileHerbTo],
    [tokens.orange500, tokens.tileOrangeTo],
    [tokens.souki900, tokens.tileSoukiTo],
    [tokens.yellow400, tokens.tileYellowTo],
    [tokens.trust700, tokens.tileTrustTo],
  ] as const,
}

/** Polices : Poppins (latin, 400 a 900) et Tajawal (arabe). */
export const fonts = {
  latin: {
    regular: "Poppins_400Regular",
    medium: "Poppins_500Medium",
    semibold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
    heavy: "Poppins_800ExtraBold",
    black: "Poppins_900Black",
  },
  arabic: {
    regular: "Tajawal_400Regular",
    medium: "Tajawal_500Medium",
    semibold: "Tajawal_700Bold",
    bold: "Tajawal_700Bold",
    heavy: "Tajawal_800ExtraBold",
    black: "Tajawal_900Black",
  },
} as const

export type FontWeightName = keyof (typeof fonts)["latin"]

type TextVariantSpec = Pick<TextStyle, "fontSize" | "lineHeight" | "letterSpacing"> & {
  weight: FontWeightName
  /** Chiffres tabulaires, isoles en LTR meme en arabe (prix, comptes a rebours). */
  numeric?: boolean
  /** Capitales (sur-titres) : en francais seulement, jamais en arabe. */
  uppercase?: boolean
}

/**
 * Echelle de texte 2027 (tokens.json > type). L'espacement des lettres est converti des
 * `em` du design en points. Le texte suit la taille choisie dans Reglages (Dynamic Type).
 * En arabe, le composant Text ajoute +1 pt et +30 % d'interligne.
 */
export const textVariants = {
  /** Salutation de l'accueil, une seule fois par ecran. */
  heroGreeting: { fontSize: 34, lineHeight: 36, weight: "black", letterSpacing: -1 },
  /** Grand titre des onglets. */
  largeTitle: { fontSize: 32, lineHeight: 38, weight: "heavy", letterSpacing: -0.8 },
  /** Nom du produit sur la fiche, titres de feuille. */
  title1: { fontSize: 26, lineHeight: 32, weight: "heavy", letterSpacing: -0.5 },
  /** Titres de section et de carrousel. */
  title2: { fontSize: 20, lineHeight: 26, weight: "heavy", letterSpacing: -0.3 },
  /** Libelles de bouton, titres de ligne. */
  headline: { fontSize: 17, lineHeight: 22, weight: "bold", letterSpacing: -0.17 },
  /** Corps de texte (ink-700 pour les descriptions). */
  body: { fontSize: 16, lineHeight: 24, weight: "regular" },
  /** Nom de produit dans la carte, promesses courtes. */
  callout: { fontSize: 15, lineHeight: 20, weight: "semibold" },
  /** Darija latine, unites, dates (ink-500). */
  footnote: { fontSize: 13, lineHeight: 18, weight: "medium" },
  /** Sur-titres en capitales et texte des badges. */
  eyebrow: { fontSize: 11, lineHeight: 14, weight: "heavy", letterSpacing: 0.9, uppercase: true },
  /** Prix du jour sur la fiche. */
  priceHero: { fontSize: 48, lineHeight: 52, weight: "black", letterSpacing: -1.9, numeric: true },
  /** Prix dans la carte produit, total de la mini-barre. */
  priceCard: { fontSize: 21, lineHeight: 24, weight: "black", letterSpacing: -0.6, numeric: true },
  /** Compte a rebours de la carte « Marche du jour ». */
  countdown: { fontSize: 40, lineHeight: 44, weight: "black", letterSpacing: -1.2, numeric: true },
  /** Devise et unite collees au prix. */
  priceUnit: { fontSize: 12, lineHeight: 14, weight: "bold", numeric: true },

  // Anciens noms (avant 2027), gardes pour les ecrans existants.
  display: { fontSize: 30, lineHeight: 36, weight: "heavy", letterSpacing: -0.6 },
  title: { fontSize: 24, lineHeight: 30, weight: "heavy", letterSpacing: -0.4 },
  caption: { fontSize: 11, lineHeight: 14, weight: "bold" },
  price: { fontSize: 17, lineHeight: 22, weight: "black", letterSpacing: -0.4, numeric: true },
} satisfies Record<string, TextVariantSpec>

export type TextVariant = keyof typeof textVariants

/** Rayons, toujours en coins continus (`borderCurve: "continuous"`). */
export const radius = {
  xs: 8,
  control: 14,
  photo: 18,
  tile: 22,
  card: 24,
  feature: 30,
  hero: 40,
  pill: 999,
} as const

/** Grille de 4 pt. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
} as const

/** Tailles fixes du systeme. */
export const sizes = {
  touchMin: 44,
  controlLg: 56,
  tile: 72,
  cartBar: 60,
  tabBar: 64,
} as const

/** Ombres toutes teintees vert, jamais grises. */
export const shadows = {
  card: "0 10px 24px -14px rgba(30, 138, 60, 0.35)",
  raised: "0 22px 44px -20px rgba(0, 91, 67, 0.45)",
  float: "0 16px 36px -14px rgba(10, 40, 20, 0.38)",
  search: "0 14px 34px -14px rgba(10, 40, 20, 0.55)",
  tile: "0 14px 26px -12px rgba(30, 138, 60, 0.6)",
  button: "0 10px 22px -10px rgba(0, 91, 67, 0.55)",
} as const

/** Ombre douce verte des cartes (alias de shadows.card). */
export const cardShadow = shadows.card

/** Marge laterale standard d'un ecran (space-4). */
export const SCREEN_PADDING = 16

/** Ancienne echelle (avant l'identite SOUKI), conservee pour compatibilite. */
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700" },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 22 },
  callout: { fontSize: 16, lineHeight: 21 },
  subheadline: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>
