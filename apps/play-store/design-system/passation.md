# Passation au code

## Depuis les tokens

`tokens.json` devient `theme.android.ts` dans `apps/mobile` : `color.tokens` donne deux objets (`light`, `dark`), choisis par `useColorScheme()` ou par le réglage Compte. Les longueurs en `px` se lisent en dp, les tailles de texte en sp (`allowFontScaling` actif, `maxFontSizeMultiplier` à 2).

## Ordre de développement

1. Thème (`theme.android.ts`), polices (Instrument Sans variable, Plex Arabic en quatre fichiers), composant `Text` avec la règle arabe.
2. `Pressable` commun : enfoncement 0,97, ripple `android_ripple` de la couleur du contenu, zone de 48 dp.
3. Boutons, barre de navigation, mini-barre panier.
4. Carte produit, sélecteur de quantité, étiquette de prix.
5. Accueil et carte « Marché du jour ».

## Notes de traduction

| Composant | React Native |
|---|---|
| Button | `Pressable` + Reanimated (`withTiming` 120 ms). FAB : `@expo/ui` (Compose `ExtendedFloatingActionButton`) possible. |
| ProductCard | Bordure 1 dp, pas d'ombre au repos. Photo détourée en `expo-image`. Container transform : `sharedTransitionTag`. |
| MarketCard | `expo-linear-gradient`. Chiffres : un `Animated.View` par chiffre, `fontVariant: ['tabular-nums']`. Annoncé à TalkBack une fois, pas à chaque seconde. |
| NavigationBar | Onglets natifs d'Expo Router (Material) ; indicateur en `primary-container`. |
| OrderStatus | Vues simples ; le tracé en « S » de l'écran de suivi sera en `react-native-svg`. |

## Demande le back-end

Heure serveur pour le compte à rebours, disponibilité par produit, statuts de commande pour les notifications, canaux de notification.

## Écrans

Les écrans (les aperçus `Screen…`) sont assemblés avec `kit/souki-v5.css` et `kit/souki-v5.js` : mêmes classes, mêmes tokens. Le kit est la référence web de chaque composant ; il ne se copie pas tel quel en React Native.

| Écran | Point d'attention |
|---|---|
| Accueil | L'en-tête change avec l'heure serveur : `open`, `last` (dernière heure, aplat orange et encre), `closed`. |
| Catalogue | Le bouton d'ajout est posé sur la photo : le prix garde toute la largeur, même avec « DH / botte ». |
| Fiche | Barre d'achat collée, au-dessus de l'inset système. Pas de barre de navigation. |
| Panier | Les montants viennent de `cartTotals()` (`@souki/shared`), jamais d'un calcul local. |
| Lancement | L'intro part exactement de l'image de l'écran de démarrage : même symbole, même taille, même position. |
| Texte agrandi | Aucune hauteur fixe : les boutons, chips, champs et barres ont une hauteur minimale. Les libellés de la barre de navigation sont plafonnés à 115 % (`maxFontSizeMultiplier`). |
| Entrée | « Continuer avec Google » ouvre la feuille système de Credential Manager. Utiliser le bouton officiel de Google, avec son logo : il n'est pas redessiné ici. |
| Code | Six cases, clavier numérique, remplissage automatique à la réception (`autoComplete="sms-otp"` ou e-mail). |
| Adresse | Google Maps (`react-native-maps`) ; la carte des maquettes est un dessin. La zone de Fès vient du back-end. |
| Onboarding | La route en « S » est un tracé `react-native-svg` ; le camion avance avec `ease-emphasized`, 300 ms. Seules les étapes manquantes sont affichées. |
| Suppression du compte | Deux boutons de même taille. Le mot de passe confirme ; pas de questionnaire, pas de délai caché. |
| Checkout | Créneaux `DELIVERY_TIME_PRESETS` (08h, 10h, 12h, 14h) ; montants par `checkoutAmounts()`. Le paiement par carte n'est pas affiché. |
| Compte restreint | Affiché quand `BlacklistStatusDTO` l'indique ; le texte exact de la raison vient du back-end. |
| Notifications | Écran d'explication puis `POST_NOTIFICATIONS`, uniquement après la première commande validée. Un refus n'est jamais redemandé en boucle. |
| Suivi | `orderProgress()` donne l'étape et le ton. Le tracé en « S » est un `Path` `react-native-svg` dont le remplissage s'anime (`duration-slow`). |
| Gérer | La feuille n'apparaît que si `canManageOrder()` est vrai. Annuler passe par un dialogue M3, jamais par un glisser. |
| Réclamation | `canClaimOrder()` (24 h), motifs `CLAIM_REASONS`, montant par `claimRefund()`. |
| Recommander | Les prix sont ceux du jour ; un produit épuisé est montré puis retiré, jamais remplacé en silence. |
| Wallet | Les deux soldes et les libellés des mouvements viennent de `WALLET_TRANSACTION_LABELS` (`@souki/shared`). |
| Abonnements | Rythmes et libellés : `RECURRENCE_FREQUENCIES`. Statuts : `ACTIVE`, `EN_PAUSE`, `SUSPENDUE`, `ARRETEE`. |
| Commande vocale | 15 s au plus (`VOICE_MAX_MS`). Les groupes surlignés viennent de `buildVoiceSpans()`. Un seul produit en vedette à la fois ; le total roule. Animation allégée : la liste apparaît d'un coup. |
| Panier intelligent | Valeurs par défaut : `SMART_DEFAULTS` (150 DH, 3 personnes, 7 jours) ; personnes 1 à 8, durée 3 à 14 jours. |
| Discussion | 500 caractères par message (`CHAT_MAX_LENGTH`), 20 messages d'historique. La mascotte s'appelle Souki. |

## Aperçus statiques

La page affiche les aperçus en mode statique : aucun script n'y tourne. Les sources des écrans sont donc dans `kit/screens/` (HTML + `souki-v5.js`), et chaque `components/<Écran>/preview.html` en est une version pré-rendue, sans script, avec les styles et les images (réduites) en ligne. Après une modification d'une source, régénérer les aperçus avec `kit/bake.js` (Playwright ; les chemins en tête du script sont à adapter à votre machine).

## Données des maquettes

- Les produits montrés sont ceux du catalogue réel (`catalogue.ts`) : noms au pluriel (« Tomates »), unités réelles (« lot » pour la laitue et les herbes, « 250 g » pour l'ail). Les prix restent des exemples.
- Les montants suivent `formatDirhams()` : pas de « ,00 ».
- Photos : `kit/produits/<id>.webp`, détourées depuis les photos du site (512 px, transparent). À remplacer par la séance photo (section Photographie).

## Arabe

Les cartes `…Ar` sont générées depuis les mêmes sources, avec `kit/ar.json` : la table des textes français vers l'arabe (environ 440 entrées). Le nom latin en darija n'est jamais affiché en arabe ; les heures s'écrivent `10:00` ; les prix gardent les chiffres occidentaux et `DH`. Cette table peut servir de base aux fichiers de traduction de l'app (`@souki/shared/i18n`), après relecture.
