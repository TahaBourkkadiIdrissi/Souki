# SOUKI Android

Le design system de l'app Android SOUKI (Google Play). Même marque, même service et mêmes règles que le site et l'app iOS « SOUKI 2027 », pensés pour Android : Material 3 comme grammaire, l'identité SOUKI comme voix.

> Itération 10 : le design de la v1 est complet. Tous les écrans et leurs états existent en clair, en sombre (sauf P7) et en arabe, et le prototype animé se parcourt en entier. Reste le test sur appareil. L'état de chaque élément est dans la section **Avancement**. Prototype animé : https://claude.ai/artifact/TBHG8WS9pgxUPr3nVSDZz9.

## Le produit en une ligne

SOUKI livre à Fès les légumes, fruits et herbes du marché de gros, achetés le matin même. Commandes de 08h00 à 01h00, livraison le lendemain entre 8h et 15h, minimum 50 DH livraison comprise, livraison 15 DH, offerte dès 300 DH. Ces valeurs viennent de `packages/shared/src/rules.ts` : l'interface ne les invente jamais.

## Principes

1. **Calme.** Une action évidente par écran. Les animations fréquentes durent moins de 150 ms, aucune n'empêche d'agir.
2. **Net.** La typographie porte la hiérarchie avant la couleur. Grille de 4 dp, un rayon par niveau d'élément.
3. **Honnête.** Rien qui n'existe pas : pas de fausse note, de fausse urgence, de bouton « Bientôt ». Le compte à rebours est l'heure réelle de fermeture.
4. **Android d'abord.** Barre de navigation du bas, retour prédictif, bord à bord, snackbars, ripple. Aucun réflexe iOS.
5. **Pour tout le monde.** Évident pour une grand-mère sur un Redmi d'entrée de gamme, élégant pour un cadre. Français et arabe en miroir, texte jusqu'à 200 %.

## Couleur : les règles de rôle

Les tokens sont des rôles Material 3 construits sur la palette SOUKI. Chaque note d'usage donne le contraste mesuré dans les deux thèmes.

| Rôle | Token | Clair | Sombre | Règle |
|---|---|---|---|---|
| Décision | `primary` | `#005B43` | `#9BE7AE` | Bouton principal, sélection, bulle de quantité. Un seul par écran. |
| Mouvement | `motion` | `#1E8A3C` | `#4CB84A` | Jauges, contour « dans le panier », icônes actives, focus. Jamais de petit texte dessus. |
| Prix | `secondary` | `#176B2E` | `#7FD492` | Prix, liens, montants. |
| Urgence | `tertiary-container` | `#F07C00` | `#F07C00` | L'orange porte de l'encre (`on-tertiary-container`), jamais du blanc. |
| Orange en texte | `tertiary` | `#B35400` | `#FFB547` | Dernière heure, minimum non atteint. |
| Erreur | `error` | `#DC2626` | `#FF8A80` | Rupture, suppression, erreurs. Rien d'autre. |
| Favori | `favorite` | `#E4405F` | `#FF7A93` | Le cœur, uniquement. |
| Voix | `voice-cyan`, `voice-teal` | | | La commande vocale, uniquement, sur `voice-surface`. |
| Badge | `badge` | `#F5C400` | `#F5C400` | Badges, lune du mode fermé, avec de l'encre. |

- **Fond** `surface` (crème en clair, vert nuit en sombre), cartes sur `surface-container-lowest`, séparateurs `outline-variant`.
- **Texte** `on-surface` ; secondaire `on-surface-variant`. `outline` ne sert jamais à du texte.
- **Thème sombre** : des verts nuit, pas des gris. `primary` devient menthe avec de l'encre nuit dessus ; l'orange et le jaune ne changent pas.
- **Couleur dynamique (Material You)** : non. Seule l'icône thématique suit le téléphone.
- **Dégradés autorisés** : l'en-tête de l'accueil (`hero-from` vers `hero-to`, selon l'horloge du marché), les tuiles de rayon, la carte vocale. Nulle part ailleurs.
- **Élévation** : niveaux de surface d'abord. Les ombres (`shadow-float`, `shadow-sheet`) sont teintées vert et réservées à ce qui flotte.

À ne pas faire : texte blanc sur `motion` ou sur l'orange ; gris neutres en sombre ; un statut dit par la couleur seule (toujours couleur + icône + texte).

## Typographie

**Instrument Sans** (latin) et **IBM Plex Sans Arabic** (arabe). La planche `TypePairs` la compare à Schibsted Grotesk et à Geist sur de vrais contenus.

- Instrument Sans est une grotesque éditoriale : formes nettes, chasse un peu étroite, un rendu de maison de design plutôt que de modèle d'app. Variable de 400 à 700, licence OFL, vrais chiffres tabulaires (`tnum`).
- Elle s'arrête à 700 : pas de graisse « black ». La hiérarchie se fait par la taille et l'approche, ce qui est précisément ce qui la rend plus calme et plus adulte.
- IBM Plex Sans Arabic a le même gris et la même sécheresse. Elle n'est pas variable : on embarque quatre graisses (400, 500, 600, 700).
- Échelle Material 3 complète (`display-large` à `label-small`) en sp, plus les styles SOUKI : `price-hero`, `countdown`, `price-card`, `price-unit`, `eyebrow`.
- Chiffres et prix : tabulaires, toujours de gauche à droite, même en arabe. Format de `formatDirhams()` : `12,50 DH`, `12 DH` (jamais `12,00`), `3,50 DH / kg`.
- Arabe : taille latine + 1 sp, interligne + 30 %, ni capitales ni approche négative (styles `ar-*`).
- Taille minimale 12 sp. Aucune hauteur fixe sur du texte : tout tient à 200 %.
- `eyebrow` (capitales) : un par écran au plus, jamais en arabe.

## Formes et espace

Échelle de formes Material 3, pour que les composants natifs (Compose) et les nôtres aient les mêmes coins : `radius-md` 12 pour ce qu'on touche (boutons, champs), `radius-lg` 16 pour ce qu'on regarde (photo, carte produit), `radius-lg-inc` 20 pour les cartes de contenu, `radius-xl` 28 pour ce qui se pose sur l'écran (feuilles, dialogues, cartes signature). Les boutons ne sont pas des pilules : `radius-full` est réservé aux pastilles et à l'indicateur d'onglet.

Espaces sur une grille de 4 dp. Marge d'écran `space-4` (16), `space-5` à partir de 412 dp, `space-6` en largeur moyenne. Zone de toucher minimale `touch-min` (48 dp).

## Mouvement

Un seul jeu de tokens : durées `duration-press` 120, `duration-fast` 160, `duration-base` 240, `duration-slow` 300 ms (plafond), et une exception, `duration-screen` 400 ms, pour le container transform et le retour prédictif. Courbes : `ease-souki-out` pour ce qui entre, les courbes *emphasized* de Material 3 pour les transitions d'écran. Ressort `spring-finger` pour tout ce que le doigt tient. Enfoncement `press-scale` 0,97 et ripple de la couleur du contenu.

Avec « Supprimer les animations » ou l'économie d'énergie : fondus courts ou rien, sans perte d'information. Le détail (transitions, haptique, versions allégées) est dans la section **Android**.

## Iconographie

Icônes Lucide, trait de 2, 24 dp (`icon`), 20 dp dans les pastilles, jamais deux tailles côte à côte. Les icônes directionnelles se retournent en arabe ; les chiffres, le logo et les tracés de marque, non. Pas d'emoji dans l'interface.

Motifs de marque : le « S » du logo comme chemin (livraison, étapes de commande, route d'onboarding), la feuille, le sac. Les logos sont dans le groupe **Logos** et ne se redessinent pas.

## Images

Les photos produit détourées sont dans `kit/produits` (les originaux du site dans `assets/Photos`), les illustrations de marque dans `assets/Illustrations`. Une photo se pose toujours sur `photo-bg`, avec l'ombre commune de l'app. Direction et brief de séance : section **Photographie**. La mascotte sert aux états vides, la couronne de légumes à l'intro de lancement : nulle part ailleurs.

## Ton

Vouvoiement, phrases courtes, verbes d'action : « Ajouter », « Valider la commande », « Dicter ma liste ». Une erreur dit quoi faire : « Le code a expiré. Recevoir un nouveau code. » Un état vide propose une action utile. L'arabe est rédigé, pas traduit ; les noms de produits sont aussi en darija. Les prix et noms des maquettes sont des exemples.

## Où trouver les écrans

Les écrans sont dans **Composants**, rangés par lot. Chaque carte montre plusieurs téléphones côte à côte ; ouvrez-la en grand pour les lire.

| Lot | Cartes |
|---|---|
| Composants M3 | `TextField`, `SearchAndChips`, `Selection`, `TabsAndSnackbar`, `SheetAndDialog`, `ProgressAndMenu`, `Slider`, `ListRow` |
| Composants SOUKI | `CartLine`, `FreeDeliveryGauge`, `OrderSteps`, `MarketHeader`, `VoiceScene`, `SkeletonsAndEmpty`, `OrderCard`, avec `ProductCard`, `MarketCard`, `NavigationBar`, `OrderStatus` |
| Écrans P0 | `ScreenLaunch` (démarrage, intro, nuit), `AppIcon` |
| Écrans P1 | `ScreenHome`, `ScreenCatalog`, `ScreenProduct`, `ScreenCart`, `ScreenCartStates`, `ScreenFavorites`, `ScreenStates`, `ScreenScale` |
| Écrans P2 | `ScreenAuth`, `ScreenOnboarding`, `ScreenOnboarding2`, `ScreenAccount`, `ScreenSettings`, `ScreenKeyboard` |
| Écrans P3 | `ScreenCheckout`, `ScreenCheckoutStates`, `ScreenScale2`, `ScreenOrderDone` |
| Écrans P4 | `ScreenOrders`, `ScreenOrderIssues`, `ScreenOrderManage`, `ScreenClaim` |
| Écrans P5 | `ScreenWallet`, `ScreenSubscriptions`, `ScreenSubscriptionStates` |
| Écrans P6 | `ScreenVoice`, `ScreenAssistant`, `ScreenAssistantDish` |
| Écrans P7 | `ScreenTablet`, `ScreenTablet2` (largeur moyenne), `ScreenSystem` (notifications, suivi en direct, widgets, raccourcis, mise à jour) |
| Écrans P0 à P6 · sombre | La même carte suivie de `Dark` (`ScreenHomeDark`…) : chaque écran en thème sombre |
| Écrans P0 à P7 · arabe | La même carte suivie de `Ar` (`ScreenHomeAr`…) : chaque écran traduit, en miroir |
| Fiche Google Play | `PlayListing`, et la section **Fiche Google Play** pour les textes |

Le protocole de test sur téléphone est dans la section **Test sur appareil**. Le prototype animé des moments signature est publié à part : « SOUKI Android · Moments signature » (https://claude.ai/artifact/TBHG8WS9pgxUPr3nVSDZz9).
