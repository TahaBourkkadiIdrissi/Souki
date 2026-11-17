import type { TextStyle } from "react-native"

/**
 * Design system SOUKI Android (apps/play-store/design-system/tokens.json), construit sur
 * l'identité SOUKI 2027 de l'iOS : deux verts à deux rôles (souki-900 = décision,
 * market-600 = mouvement), orange qui porte de l'encre, Material 3 pour la grammaire.
 *
 * Thème clair et thème sombre PAR RÔLES : chaque couleur SOUKI a sa valeur sombre (table
 * « Correspondance des tokens » de design-system/android.md). Les écrans lisent `palette` et
 * `colors` au moment du rendu ; `applyColorScheme` remplace les valeurs et la racine de l'app
 * se redessine (contexts/theme-context.tsx). Les surfaces qui restent vert foncé dans les deux
 * thèmes (en-tête de l'accueil, scène vocale, intro) utilisent `brand`, qui ne change jamais.
 */

export type ColorScheme = "light" | "dark"

/** Valeurs du thème clair (identité SOUKI 2027, inchangée). */
const LIGHT = {
  /** Vert du logo. DÉCISION : boutons principaux, sélection, bulle de quantité. Rôle M3 `primary`. */
  souki900: "#005B43",
  /** Vert « prix » : prix, liens, montants. Rôle M3 `secondary`. */
  market700: "#176B2E",
  /** Vert marché. MOUVEMENT : jauges, contour « dans le panier », icônes actives, focus. Jamais de petit texte blanc dessus. */
  market600: "#1E8A3C",
  /** Vert frais : fin de dégradé, point « ouvert ». */
  fresh500: "#4CB84A",
  /** Vert feuille du logo : mascotte, confettis. */
  leaf500: "#22AA3F",
  /** Vert nuit : départ des dégradés d'en-tête, carte « Marché fermé ». */
  night950: "#0A2814",
  green950: "#0C3B22",
  forest800: "#14522A",
  forest700: "#123F22",
  forest900: "#0A2614",
  /** Menthe : texte secondaire SUR fond vert sombre uniquement. */
  mint300: "#9BE7AE",
  /** Rôle M3 `secondary-container` : pastilles, sélecteur de quantité, lignes « offerte ». */
  pale50: "#F0FAF1",
  /** Piste des jauges (`motion-track`). */
  green100: "#DDEFE0",
  /** Rôle M3 `primary-container` : bouton tonal, indicateur de l'onglet actif. */
  softFill: "#E7F5E8",
  /** Fond des photos produit (reste clair en sombre : photos détourées). */
  photoBg: "#F1F6EF",
  /** Orange urgence (`tertiary-container`). Porte de l'ENCRE, jamais du blanc. */
  orange500: "#F07C00",
  /** Orange en TEXTE sur fond clair (`tertiary`). */
  orange700: "#B35400",
  /** Fond des alertes orange (`warning-container`). */
  orange50: "#FFF1DE",
  /** Jaune badges. Toujours de l'encre dessus. */
  yellow400: "#F5C400",
  /** Cœur des favoris uniquement. */
  pink500: "#E4405F",
  /** Rupture, suppression, erreurs uniquement (`error`). */
  red600: "#DC2626",
  /** Bleu confiance (une tuile de rayon). */
  trust700: "#1A4F8A",
  /** Texte principal (`on-surface`). */
  ink900: "#1F2A22",
  /** Corps de texte long. */
  ink700: "#3D3D3D",
  /** Texte secondaire (`on-surface-variant`, assombri d'un cran pour l'AA). */
  ink500: "#5A695C",
  /** Bordures de champs et icônes décoratives (`outline`). Jamais pour du texte. */
  ink400: "#7C8B7D",
  /** Icônes désactivées, squelettes foncés. */
  ink300: "#A9B4AA",
  /** Fond de tous les écrans (`surface`). */
  cream: "#FBFBF7",
  /** Sections alternées, listes groupées (`surface-container`). */
  section: "#F2F6F3",
  /** Remplissage neutre : champs, squelettes (`surface-container-high`). */
  sand: "#ECF1EB",
  /** Cartes (`surface-container-lowest`) et texte sur les couleurs de décision. */
  white: "#FFFFFF",
  /** Séparateurs et bordures de carte, 1 dp (`outline-variant`). */
  line: "#E7ECE5",
  /** Barres posées sur le contenu : opaques sur Android (pas de flou sur l'entrée de gamme). */
  glass: "rgba(251, 251, 247, 0.96)",
  glassOnDark: "rgba(255, 255, 255, 0.12)",
  glassStroke: "rgba(255, 255, 255, 0.22)",
  veil: "rgba(10, 40, 20, 0.72)",
  /** Voile derrière les feuilles et dialogues. */
  scrim: "rgba(10, 40, 20, 0.40)",
  /** Réservés à la voix. */
  voiceCyan: "#50DCE6",
  voiceTeal: "#28BEAA",
  tileHerbFrom: "#7CCB6B",
  tileHerbTo: "#B6E3A4",
  tileOrangeTo: "#FFB547",
  tileSoukiTo: "#2E7D4F",
  tileYellowTo: "#FFE27A",
  tileTrustTo: "#4A86C5",
}

type TokenName = keyof typeof LIGHT

/** Valeurs sombres (tokens.json, colonne « dark »). Une couleur absente garde sa valeur claire. */
const DARK: Partial<Record<TokenName, string>> = {
  souki900: "#9BE7AE",
  market700: "#7FD492",
  market600: "#4CB84A",
  pale50: "#0F4526",
  green100: "#1F4D31",
  softFill: "#14522A",
  photoBg: "#DDE8DA",
  orange700: "#FFB547",
  orange50: "#4A2A05",
  pink500: "#FF7A93",
  red600: "#FF8A80",
  ink900: "#EEF6EE",
  ink700: "#D3E3D6",
  ink500: "#A9C4AF",
  ink400: "#7FA088",
  ink300: "#5C7F66",
  cream: "#0A2814",
  section: "#0C3B22",
  sand: "#114529",
  white: "#06190C",
  line: "#1F4D31",
  glass: "rgba(10, 40, 20, 0.96)",
  scrim: "rgba(0, 0, 0, 0.60)",
}

/**
 * Couleurs de marque FIXES, identiques dans les deux thèmes : écran de démarrage, en-tête vert,
 * scène vocale, intro. À utiliser pour tout ce qui est posé sur ces surfaces.
 */
export const brand = {
  souki900: LIGHT.souki900,
  night950: LIGHT.night950,
  green950: LIGHT.green950,
  forest800: LIGHT.forest800,
  forest700: LIGHT.forest700,
  forest900: LIGHT.forest900,
  market600: LIGHT.market600,
  fresh500: LIGHT.fresh500,
  mint300: LIGHT.mint300,
  /** Texte et icônes sur l'en-tête vert et la scène vocale (`on-hero`). */
  onDark: "#FFFFFF",
  /** Texte secondaire sur fond vert sombre (`on-hero-variant`). */
  onDarkVariant: LIGHT.mint300,
  /** Encre sur orange-500 et jaune-400, dans les deux thèmes. */
  ink: LIGHT.ink900,
  orange500: LIGHT.orange500,
  yellow400: LIGHT.yellow400,
} as const

/**
 * Couleurs d'illustration et de scène, identiques dans les deux thèmes : tuiles de rayon,
 * scènes de l'onboarding, en-tête vert, états de l'horloge du marché, confettis. Ces surfaces ont
 * leurs propres couleurs ; ce qui est posé dessus utilise aussi `scene`.
 */
export const scene: Readonly<typeof LIGHT> = Object.freeze({ ...LIGHT })

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** Couleurs SOUKI du thème courant (changent avec `applyColorScheme`). */
export const tokens: Mutable<typeof LIGHT> = { ...LIGHT }

function buildPalette(t: typeof LIGHT) {
  return {
    ...t,
    green900: t.souki900,
    green950: t.green950,
    green700: t.market600,
    green500: t.fresh500,
    leaf: t.leaf500,
    mint: t.mint300,
    green50: t.pale50,
    green100: t.green100,
    orange: t.orange500,
    orange50: t.orange50,
    yellow: t.yellow400,
    pink: t.pink500,
    red: t.red600,
    ink: t.ink900,
    inkSoft: t.ink700,
    muted: t.ink500,
    placeholder: t.ink400,
  }
}

function buildColors(t: typeof LIGHT) {
  return {
    brand: t.souki900,
    brandBright: t.market600,
    brandFill: t.pale50,
    onBrand: t.white,
    accent: t.orange500,
    label: t.ink900,
    secondaryLabel: t.ink500,
    tertiaryLabel: t.ink300,
    separator: t.line,
    background: t.cream,
    card: t.white,
    fill: t.sand,
    imagePlaceholder: t.photoBg,
    warning: t.orange700,
    danger: t.red600,
    favorite: t.pink500,
    decision: t.souki900,
    motion: t.market600,
    price: t.market700,
    /** Encre sur orange-500 / jaune-400 : foncée dans les deux thèmes. */
    onAccent: brand.ink,
    accentText: t.orange700,
    bodyText: t.ink700,
    placeholder: t.ink400,
    section: t.section,
  }
}

/** Palette du thème courant (anciens noms de l'iOS gardés en alias). */
export const palette: Mutable<ReturnType<typeof buildPalette>> = buildPalette(LIGHT)

/** Couleurs par rôle du thème courant. */
export const colors: Mutable<ReturnType<typeof buildColors>> = buildColors(LIGHT)

/** Rôles Material 3 complets du thème courant (tokens.json), pour le code nouveau. */
const M3_LIGHT = {
  surface: "#FBFBF7",
  surfaceDim: "#E4E9E1",
  surfaceBright: "#FFFFFF",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerLow: "#F7F8F3",
  surfaceContainer: "#F2F6F3",
  surfaceContainerHigh: "#ECF1EB",
  surfaceContainerHighest: "#E3E9E2",
  onSurface: "#1F2A22",
  onSurfaceVariant: "#5A695C",
  outline: "#7C8B7D",
  outlineVariant: "#E7ECE5",
  inverseSurface: "#1F2A22",
  inverseOnSurface: "#F2F6F3",
  inversePrimary: "#9BE7AE",
  primary: "#005B43",
  onPrimary: "#FFFFFF",
  primaryContainer: "#E7F5E8",
  onPrimaryContainer: "#005B43",
  secondary: "#176B2E",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#F0FAF1",
  onSecondaryContainer: "#176B2E",
  tertiary: "#B35400",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#F07C00",
  onTertiaryContainer: "#1F2A22",
  error: "#DC2626",
  onError: "#FFFFFF",
  errorContainer: "#FDECEC",
  onErrorContainer: "#8F1414",
  motion: "#1E8A3C",
  motionTrack: "#DDEFE0",
  favorite: "#E4405F",
  warningContainer: "#FFF1DE",
  onWarningContainer: "#B35400",
  scrim: "rgba(10, 40, 20, 0.40)",
}

const M3_DARK: typeof M3_LIGHT = {
  surface: "#0A2814",
  surfaceDim: "#071D0E",
  surfaceBright: "#1B5936",
  surfaceContainerLowest: "#06190C",
  surfaceContainerLow: "#0B311B",
  surfaceContainer: "#0C3B22",
  surfaceContainerHigh: "#114529",
  surfaceContainerHighest: "#164F30",
  onSurface: "#EEF6EE",
  onSurfaceVariant: "#A9C4AF",
  outline: "#7FA088",
  outlineVariant: "#1F4D31",
  inverseSurface: "#EEF6EE",
  inverseOnSurface: "#1F2A22",
  inversePrimary: "#005B43",
  primary: "#9BE7AE",
  onPrimary: "#0A2814",
  primaryContainer: "#14522A",
  onPrimaryContainer: "#D3F5DA",
  secondary: "#7FD492",
  onSecondary: "#0A2814",
  secondaryContainer: "#0F4526",
  onSecondaryContainer: "#9BE7AE",
  tertiary: "#FFB547",
  onTertiary: "#1F2A22",
  tertiaryContainer: "#F07C00",
  onTertiaryContainer: "#1F2A22",
  error: "#FF8A80",
  onError: "#3B0A0A",
  errorContainer: "#5C1414",
  onErrorContainer: "#FFD9D6",
  motion: "#4CB84A",
  motionTrack: "#1F4D31",
  favorite: "#FF7A93",
  warningContainer: "#4A2A05",
  onWarningContainer: "#FFB547",
  scrim: "rgba(0, 0, 0, 0.60)",
}

export const m3: Mutable<typeof M3_LIGHT> = { ...M3_LIGHT }

/** Ancien nom garde pour les composants natifs (onglets, thème de navigation). */
export const BRAND_GREEN = LIGHT.souki900
export const BRAND_GREEN_DARK_MODE = LIGHT.fresh500

type Gradient = readonly [string, string, ...string[]]

function buildGradients(scheme: ColorScheme) {
  const hero: Gradient = scheme === "dark" ? ["#06190C", "#0C3B22", "#14522A"] : [brand.night950, brand.forest800, brand.market600]
  return {
    hero,
    market: hero,
    /** Horloge du marché : l'en-tête change d'état avec l'heure (même vert foncé dans les deux thèmes). */
    clock: {
      open: hero,
      evening: [brand.night950, brand.green950, brand.souki900] as Gradient,
      lastHour: [brand.orange500, brand.orange500] as Gradient,
      closed: [brand.night950, brand.night950] as Gradient,
    },
    voice: [brand.forest700, brand.forest900] as Gradient,
    tiles: [
      [LIGHT.market600, LIGHT.fresh500],
      [LIGHT.tileHerbFrom, LIGHT.tileHerbTo],
      [LIGHT.orange500, LIGHT.tileOrangeTo],
      [LIGHT.souki900, LIGHT.tileSoukiTo],
      [LIGHT.yellow400, LIGHT.tileYellowTo],
      [LIGHT.trust700, LIGHT.tileTrustTo],
    ] as (readonly [string, string])[],
  }
}

/** Dégradés autorisés : en-tête (horloge du marché), tuiles de rayon, carte vocale. */
export const gradients: ReturnType<typeof buildGradients> = buildGradients("light")

function buildShadows(scheme: ColorScheme) {
  const dark = scheme === "dark"
  return {
    /** Élévation = niveaux de surface d'abord ; ombres réservées à ce qui flotte ou se soulève. */
    card: dark ? "0 10px 24px -14px rgba(0, 0, 0, 0.6)" : "0 10px 24px -14px rgba(30, 138, 60, 0.35)",
    raised: dark ? "0 22px 44px -20px rgba(0, 0, 0, 0.7)" : "0 22px 44px -20px rgba(0, 91, 67, 0.45)",
    float: dark ? "0 16px 36px -14px rgba(0, 0, 0, 0.7)" : "0 16px 36px -14px rgba(10, 40, 20, 0.38)",
    search: dark ? "0 14px 34px -14px rgba(0, 0, 0, 0.7)" : "0 14px 34px -14px rgba(10, 40, 20, 0.55)",
    tile: dark ? "0 14px 26px -12px rgba(0, 0, 0, 0.6)" : "0 14px 26px -12px rgba(30, 138, 60, 0.6)",
    button: dark ? "0 10px 22px -10px rgba(0, 0, 0, 0.6)" : "0 10px 22px -10px rgba(0, 91, 67, 0.55)",
    sheet: dark ? "0 -12px 36px -16px rgba(0, 0, 0, 0.7)" : "0 -12px 36px -16px rgba(10, 40, 20, 0.30)",
  }
}

/** Ombres teintées vert en clair, noires en sombre. */
export const shadows: ReturnType<typeof buildShadows> = buildShadows("light")

let currentScheme: ColorScheme = "light"

export function getColorScheme(): ColorScheme {
  return currentScheme
}

/**
 * Passe tout le système de couleurs au thème demandé. Appelé par ThemeProvider AVANT le rendu
 * des écrans ; la racine des écrans est ensuite redessinée (clé = thème).
 */
export function applyColorScheme(scheme: ColorScheme) {
  if (scheme === currentScheme) return
  currentScheme = scheme
  const next = scheme === "dark" ? { ...LIGHT, ...DARK } : LIGHT
  Object.assign(tokens, next)
  Object.assign(palette, buildPalette(next))
  Object.assign(colors, buildColors(next))
  Object.assign(m3, scheme === "dark" ? M3_DARK : M3_LIGHT)
  Object.assign(gradients, buildGradients(scheme))
  Object.assign(shadows, buildShadows(scheme))
}

/** Teinte d'un calque d'état (ripple, appui) de la couleur du contenu : `withAlpha("#005B43", 0.1)`. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  if (value.length !== 6) return hex
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Calques d'état Material 3. */
export const states = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.1,
  dragged: 0.16,
  disabledContent: 0.38,
  disabledContainer: 0.12,
  pressScale: 0.97,
} as const

/**
 * Polices du design Android (décision 1) : Instrument Sans (latin, 400 à 700) et
 * IBM Plex Sans Arabic. Les graisses 800 et 900 de l'iOS n'existent pas : elles tombent sur 700.
 */
export const fonts = {
  latin: {
    regular: "InstrumentSans_400Regular",
    medium: "InstrumentSans_500Medium",
    semibold: "InstrumentSans_600SemiBold",
    bold: "InstrumentSans_700Bold",
    heavy: "InstrumentSans_700Bold",
    black: "InstrumentSans_700Bold",
  },
  arabic: {
    regular: "IBMPlexSansArabic_400Regular",
    medium: "IBMPlexSansArabic_500Medium",
    semibold: "IBMPlexSansArabic_600SemiBold",
    bold: "IBMPlexSansArabic_700Bold",
    heavy: "IBMPlexSansArabic_700Bold",
    black: "IBMPlexSansArabic_700Bold",
  },
} as const

export type FontWeightName = keyof (typeof fonts)["latin"]

type TextVariantSpec = Pick<TextStyle, "fontSize" | "lineHeight" | "letterSpacing"> & {
  weight: FontWeightName
  /** Chiffres tabulaires, isolés en LTR même en arabe (prix, comptes à rebours). */
  numeric?: boolean
  /** Capitales (sur-titres) : en français seulement, jamais en arabe. */
  uppercase?: boolean
}

/**
 * Échelle de texte Android (tokens.json > type), en sp : Material 3 + styles SOUKI. Les noms de
 * l'iOS sont gardés et pointent vers le style M3 équivalent. Le texte suit la taille de police du
 * système jusqu'à 200 %. En arabe, le composant Text ajoute +1 sp et +30 % d'interligne.
 */
export const textVariants = {
  // Material 3
  displaySmall: { fontSize: 36, lineHeight: 44, weight: "bold", letterSpacing: -0.9 },
  headlineLarge: { fontSize: 32, lineHeight: 40, weight: "bold", letterSpacing: -0.7 },
  headlineMedium: { fontSize: 28, lineHeight: 36, weight: "bold", letterSpacing: -0.5 },
  headlineSmall: { fontSize: 24, lineHeight: 32, weight: "semibold", letterSpacing: -0.4 },
  titleLarge: { fontSize: 20, lineHeight: 28, weight: "semibold", letterSpacing: -0.3 },
  titleMedium: { fontSize: 16, lineHeight: 24, weight: "semibold", letterSpacing: -0.1 },
  titleSmall: { fontSize: 14, lineHeight: 20, weight: "semibold" },
  bodyLarge: { fontSize: 16, lineHeight: 24, weight: "regular" },
  bodyMedium: { fontSize: 14, lineHeight: 20, weight: "regular" },
  bodySmall: { fontSize: 12, lineHeight: 16, weight: "medium", letterSpacing: 0.1 },
  labelLarge: { fontSize: 14, lineHeight: 20, weight: "semibold" },
  labelMedium: { fontSize: 12, lineHeight: 16, weight: "semibold", letterSpacing: 0.1 },
  labelSmall: { fontSize: 11, lineHeight: 16, weight: "semibold", letterSpacing: 0.2 },

  // Noms de l'iOS, rattachés à l'échelle Android
  /** Salutation de l'accueil (display-small). */
  heroGreeting: { fontSize: 36, lineHeight: 44, weight: "bold", letterSpacing: -0.9 },
  /** Grand titre des onglets (headline-large). */
  largeTitle: { fontSize: 32, lineHeight: 40, weight: "bold", letterSpacing: -0.7 },
  /** Nom du produit sur la fiche, titres de feuille (headline-medium). */
  title1: { fontSize: 28, lineHeight: 36, weight: "bold", letterSpacing: -0.5 },
  /** Titres de section et de carrousel (title-large). */
  title2: { fontSize: 20, lineHeight: 28, weight: "semibold", letterSpacing: -0.3 },
  /** Libellés de bouton, titres de ligne (title-medium). */
  headline: { fontSize: 16, lineHeight: 24, weight: "semibold", letterSpacing: -0.1 },
  /** Corps de texte (body-large). */
  body: { fontSize: 16, lineHeight: 24, weight: "regular" },
  /** Nom de produit dans la carte (title-small). */
  callout: { fontSize: 14, lineHeight: 20, weight: "semibold" },
  /** Darija latine, unités, dates (body-small). */
  footnote: { fontSize: 13, lineHeight: 18, weight: "medium" },
  /** Sur-titres en capitales et badges. */
  eyebrow: { fontSize: 11, lineHeight: 16, weight: "bold", letterSpacing: 0.9, uppercase: true },
  /** Prix du jour sur la fiche. */
  priceHero: { fontSize: 48, lineHeight: 52, weight: "bold", letterSpacing: -1.9, numeric: true },
  /** Prix dans la carte produit, total de la mini-barre. */
  priceCard: { fontSize: 20, lineHeight: 24, weight: "bold", letterSpacing: -0.5, numeric: true },
  /** Compte à rebours de la carte « Marché du jour ». */
  countdown: { fontSize: 40, lineHeight: 44, weight: "bold", letterSpacing: -1.2, numeric: true },
  /** Devise et unité collées au prix. */
  priceUnit: { fontSize: 12, lineHeight: 16, weight: "semibold", numeric: true },

  // Anciens noms (avant 2027), gardés pour les écrans existants.
  display: { fontSize: 28, lineHeight: 36, weight: "bold", letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 32, weight: "semibold", letterSpacing: -0.4 },
  caption: { fontSize: 11, lineHeight: 16, weight: "semibold" },
  price: { fontSize: 16, lineHeight: 22, weight: "bold", letterSpacing: -0.3, numeric: true },
} satisfies Record<string, TextVariantSpec>

export type TextVariant = keyof typeof textVariants

/**
 * Formes Material 3 (tokens.json > radius), sous les noms de l'iOS : 8, 14, 18, 22, 24, 30, 40
 * deviennent 8, 12, 16, 16, 20, 28, 32.
 */
export const radius = {
  /** M3 extra-small : badges, cases. */
  xxs: 4,
  /** M3 small : chips, snackbars, menus. */
  xs: 8,
  /** M3 medium : boutons, champs, sélecteur de quantité. */
  control: 12,
  /** M3 large : photo et carte produit. */
  photo: 16,
  /** M3 large : tuile de rayon, FAB. */
  tile: 16,
  /** M3 large-increased : cartes de contenu, mini-barre panier. */
  card: 20,
  /** M3 extra-large : feuilles du bas, dialogues, carte « Marché du jour ». */
  feature: 28,
  /** M3 extra-large-increased : bas de l'en-tête vert. */
  hero: 32,
  pill: 999,
} as const

/** Grille de 4 dp. */
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

/** Tailles fixes du système Android. */
export const sizes = {
  /** Zone de toucher minimale Android. */
  touchMin: 48,
  controlMd: 48,
  controlLg: 56,
  tile: 72,
  /** Mini-barre panier au-dessus de la barre de navigation. */
  cartBar: 56,
  /** Barre de navigation courte M3 Expressive. */
  tabBar: 64,
  topBar: 64,
  icon: 24,
} as const

/** Ombre des cartes (alias de shadows.card, lue au rendu). */
export const cardShadow = shadows.card

/** Marge latérale standard d'un écran (space-4). */
export const SCREEN_PADDING = 16

/** Ancienne échelle (avant l'identité SOUKI), conservée pour compatibilité. */
export const typography = {
  largeTitle: { fontSize: 32, lineHeight: 40, fontWeight: "700" },
  title1: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  title3: { fontSize: 20, lineHeight: 28, fontWeight: "600" },
  headline: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24 },
  callout: { fontSize: 15, lineHeight: 20 },
  subheadline: { fontSize: 14, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>
