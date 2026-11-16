# Brief pour Claude Design : design system de l'app Android SOUKI (Google Play)

> À lire en entier avant de dessiner quoi que ce soit.
> Ce document décrit le produit, ce qui existe déjà, ce qu'on attend de toi, et les règles à respecter.
> Les fichiers à joindre sont listés à la section 13.

---

## 1. Ta mission en une phrase

Créer **le design system complet et les écrans de l'app Android SOUKI** destinée au Google Play Store : une app native Android de très haut niveau, calme, précise, « faite à la main », qui reprend l'identité SOUKI (web, PWA, app iOS) et la porte au niveau des meilleures équipes produit du monde, en respectant à la lettre les conventions Android (Material 3) et les exigences du Play Store.

Ce n'est **pas** une copie de l'app iOS repeinte en vert Android. C'est la même marque, le même service, les mêmes parcours, mais pensés pour Android : navigation, gestes, retour prédictif, typographie, icônes, notifications, widgets, petits écrans.

---

## 2. Le produit SOUKI

SOUKI (« SOUKI Fresh Market ») livre les **légumes, fruits et herbes frais du marché de gros de Fès**, achetés le matin même, directement chez le client.

Règles du service (elles structurent toute l'interface) :

| Règle | Valeur |
|---|---|
| Ville | **Fès uniquement** (adresse placée sur une carte ; hors zone = avertissement) |
| Fenêtre de commande | **08h00 → 01h00**, heure du Maroc (`Africa/Casablanca`). Entre 01h et 08h le marché est **fermé**. |
| Livraison | le lendemain (ou la date confirmée), **entre 8h et 15h** |
| Panier minimum | **50 DH** livraison comprise |
| Frais de livraison | **15 DH**, **offerts dès 300 DH** de produits |
| Paiement | à la livraison aujourd'hui ; carte bancaire (CMI) prévue plus tard, à dessiner mais cachée |
| Langues | **français** (défaut) et **arabe** (interface entière en miroir, RTL). Noms de produits aussi en darija (latin et arabe). Les chiffres et les prix restent en chiffres occidentaux, de gauche à droite, même en arabe. |
| Monnaie | dirham, écrit `DH` (ex. `12,50 DH`, `3 DH / kg`) |

Les clients : familles et particuliers de Fès, beaucoup sur **Android de milieu ou d'entrée de gamme** (Samsung série A, Xiaomi Redmi, Oppo, Tecno…), souvent sur données mobiles, parfois peu à l'aise avec le numérique. Ils parlent darija, lisent le français ou l'arabe. L'app doit être évidente pour une grand-mère et élégante pour un cadre.

### Fonctions du produit

1. **Marché** : accueil, catalogue par rayons (Légumes, Fruits, Herbes…), recherche, fiche produit, favoris, disponibilité (en stock, bientôt épuisé, épuisé).
2. **Panier** : quantités par pas (kg, pièce, botte…), jauge vers la livraison offerte, minimum de commande, suggestions « Complétez votre panier » en trois étagères : *Les essentiels*, *Pour varier*, *Les petits plus* (jamais « niveau 1/2/3 » affiché au client).
3. **Compte** : entrée (connexion / inscription en un seul écran), code reçu par e-mail, onboarding après création du compte, profil et photo, adresse sur carte, sécurité (sessions, mot de passe), notifications, suppression du compte.
4. **Commande** : checkout (adresse, créneau, paiement), confirmation « commande validée ».
5. **Après la commande** : historique, suivi en 4 étapes (*Commande confirmée → Préparation → En livraison → Livrée*), gérer / modifier / annuler tant que c'est permis, réclamation dans les 24 h après livraison (motifs, photo facultative, remboursement sur le Wallet), « Recommander » (même panier aux prix du jour), incidents (absent, refusée, retour au dépôt) avec « Contacter SOUKI » (appel, WhatsApp).
6. **Fidélité** : Wallet (crédit offert et remboursements, affichés séparément), parrainage (caché tant qu'il n'est pas utilisable de bout en bout), abonnements (commande récurrente : quotidienne, tous les 3 jours, hebdomadaire, toutes les 2 semaines ; sauter, mettre en pause, reprendre).
7. **IA** : **commande vocale** (on dicte sa liste en darija ou en français → l'app l'analyse et remplit le panier), **liste écrite** (même chose au clavier), **panier intelligent**, **discussion avec la mascotte** (« Souki »). Consentement IA demandé avant le premier usage.

Statuts de commande réels (à couvrir tous, avec leur ton) :

| Ton | Statuts |
|---|---|
| attente | Brouillon, En attente, Confirmée, En préparation, En attente livreur, Réassignation en cours |
| en route | Prête à livrer, Planifiée, En route |
| livrée | Livrée |
| incident | Retour au dépôt, Destinataire absent, Livraison refusée, Annulée |

---

## 3. Les plateformes et la place de l'app Android

| Support | Rôle | Avenir |
|---|---|---|
| **souki.io** (site Next.js) | site vitrine et boutique sur navigateur | reste **le site web uniquement** |
| **PWA** (installable depuis le site) | app mobile actuelle sur Android | **supprimée** quand l'app Play Store sera publiée |
| **App iOS** (Expo / React Native) | publiée sur l'App Store | continue, design « SOUKI 2027 » |
| **App Android** (ce brief) | Google Play | remplace la PWA sur Android |

Conséquence : l'app Android sera **la porte d'entrée principale de SOUKI au Maroc** (le Maroc est très majoritairement Android). Elle doit être la meilleure des trois.

Technique prévue (pour que ton design soit réalisable) : app **Expo / React Native** comme l'iOS, avec le code métier partagé (`@souki/shared` : types, règles du panier, fenêtre de commande, traductions). Animations avec **Reanimated**, tracés avec **react-native-svg**, icônes **Lucide** (déjà utilisées partout) ou **Material Symbols**, composants natifs Android possibles via **Jetpack Compose** (`@expo/ui`). Évite tout ce qui demanderait un moteur graphique exotique (shaders lourds, vidéo en fond, 3D).

---

## 4. Ce qui existe déjà et que tu dois connaître

### 4.1 L'identité « SOUKI 2027 » (app iOS, en production)

C'est la référence de marque la plus aboutie. Ses valeurs sont dans `apps/mobile/src/theme.ts` (à joindre). Les règles de rôle, gagnées à la sueur, **se gardent** :

- **Deux verts, deux rôles.**
  - `souki-900 #005B43` (vert du logo) = **décision** : bouton principal, sélection, bulle de quantité. Blanc dessus : 8,1:1.
  - `market-600 #1E8A3C` = **mouvement** : jauges, contour « dans le panier », icônes actives, focus. **Jamais de petit texte blanc dessus** (4,4:1, sous AA).
  - `market-700 #176B2E` = prix, liens, montants sur fond clair (6,6:1).
- **L'orange porte de l'encre.** `orange-500 #F07C00` reçoit du texte `ink-900`, jamais du blanc (2,8:1). Texte orange sur clair = `orange-700 #B35400`.
- **Texte secondaire** = `ink-500 #647366` (4,8:1 sur crème). `ink-400 #7C8B7D` seulement pour les placeholders et icônes décoratives.
- **Fond** crème `#FBFBF7`, cartes blanches, séparateurs `#E7ECE5`.
- **Ombres teintées vert**, jamais grises.
- **Couleurs réservées** : rose `#E4405F` = cœur des favoris uniquement ; rouge `#DC2626` = rupture, suppression, erreurs uniquement ; cyan/teal `#50DCE6` / `#28BEAA` = la voix uniquement ; jaune `#F5C400` = badges, lune du mode fermé (encre dessus).
- **Dégradés autorisés seulement** : en-tête (qui suit « l'horloge du marché » : ouvert, soir, dernière heure en orange, fermé de nuit), tuiles de rayon, carte de commande vocale.
- **Motifs de marque** : le **« S »** du logo comme chemin (chemin de livraison, étapes de commande, route de l'onboarding avec le camion), la **feuille** verte, le **sac**.
- **Typo** : Poppins (latin, 400→900) + Tajawal (arabe). Chiffres tabulaires pour prix et comptes à rebours. En arabe : +1 pt et +30 % d'interligne, pas de capitales.
- **Mouvement** : courbe `ease-out (0.16, 1, 0.3, 1)`, durées 120 / 160 / 240 / 300 ms (plafond 300 ms), ressorts avec le doigt (damping 16, stiffness 220), enfoncement 0,97 de tout ce qui se touche, cascade d'entrée des sections (40 ms d'écart, montée de 14 pt), « Réduire les animations » respecté partout.
- **Contenu honnête** : rien qui n'existe pas. Pas de fausse note, faux avis, fausse réduction, faux « 12 personnes regardent ce produit », pas de bouton « Bientôt ».

### 4.2 Les écrans signature de l'iOS (à réinterpréter pour Android, pas à copier)

- **Intro de lancement « Le marché se réveille »** (≈ 2,2 s, une seule fois au démarrage à froid, touchable pour passer, variante de nuit 01h–08h).
- **Accueil** : en-tête vert qui suit l'horloge du marché, salutation, les deux cartes assistants (commande vocale, panier intelligent) juste sous l'en-tête, carte « Marché du jour » avec compte à rebours, rayons, livraison offerte, favoris, un rail par étagère, « Comment ça marche ».
- **Fiche produit** : photo sur fond `#F1F6EF`, prix géant tabulaire, unité, darija, sélecteur de quantité, barre d'achat collée en bas.
- **Commande vocale « Du mot au panier »** : une seule scène pour l'écoute et l'analyse ; « Vous avez dit » (la phrase en texte calme, une lumière cyan la parcourt groupe par groupe) ; au centre le produit compris en vedette, un seul à la fois (620 ms par groupe) ; en bas le plateau « Votre panier » qui se remplit et le total qui roule ; état « pas compris » avec exemples et « Écrire ma liste ».
- **Entrée** : un seul écran (scène du marché, Google, e-mail), l'e-mail d'abord puis mot de passe (compte existant) ou onboarding (nouveau compte).
- **Onboarding** : bienvenue + langue, seulement les informations manquantes (prénom, adresse sur carte, téléphone, chacune avec « Plus tard »), mot de passe, code, puis 3 écrans sur le service. Route en « S » avec le camion.
- **Dock** : capsule d'onglets flottante + mini-barre panier au-dessus dès le premier produit.

### 4.3 Le site et la PWA (ce qu'il ne faut PAS reprendre)

`apps/client/app/globals.css` montre l'ancienne base : `primary` = `#1E8A3C` avec texte blanc (sous AA), texte secondaire `#8A8A8A` (3,45:1, sous AA), orange avec texte blanc, mode sombre en gris génériques (`#1a1a1a`, `#262626`) sans aucune identité, rayons uniformes, look « template ». **Toutes ces erreurs sont corrigées dans l'iOS et ne doivent pas revenir sur Android.**

---

## 5. Le niveau d'exigence visuelle

Le client veut un design **« sharp »** : net, adulte, sûr de lui, qui ait l'air dessiné par une équipe senior et pas généré par une IA.

### Inspirations (des qualités, pas des looks à copier)

Ne reprends **ni le logo, ni les couleurs, ni les polices propriétaires, ni les mises en page** de ces entreprises. Prends leurs principes :

- **SpaceX** : contraste fort, typographie large et serrée, chiffres comme héros (le compte à rebours du marché est notre « T-minus »), images plein cadre, zéro décoration inutile.
- **OpenAI** : retenue extrême, beaucoup d'espace, une seule action évidente par écran, transitions fluides et sobres, texte qui fait le travail.
- **Anthropic** : chaleur humaine dans la rigueur, tons naturels et doux, typographie éditoriale, illustrations dessinées à la main, calme.
- **Les meilleures apps de commerce et de livraison** : vitesse perçue, ajout au panier en un geste, états de chargement qui ne bougent pas la page.

### Ce qui fait « fait main » (à appliquer)

- Une **grille de 4 dp** respectée au pixel, des alignements optiques (icônes rééquilibrées, chiffres alignés à la virgule).
- Une **hiérarchie typographique** qui porte l'écran avant la couleur.
- Des **vraies photos** de produits détourées ou sur fond `#F1F6EF`, cohérentes en lumière ; les illustrations de marque (`recolte-*.svg`, couronne de légumes) avec parcimonie.
- Des **détails signés** : le « S » comme chemin, la feuille qui bouge d'un degré au survol, le compte à rebours qui roule chiffre par chiffre.
- **Des rayons qui ont une logique** (un rayon par niveau d'élément), pas « tout à 16 ».
- **L'asymétrie maîtrisée** plutôt que tout centré.

### Ce qui fait « généré par IA » (à proscrire)

Dégradés violets ou arc-en-ciel, verre dépoli partout, ombres grises molles, emojis dans l'interface, icônes de tailles différentes, cartes dans des cartes dans des cartes, texte centré partout, illustrations 3D génériques, sur-titres en capitales sur chaque bloc, boutons géants arrondis à l'extrême, micro-copie « Boostez votre expérience ! », confettis à chaque action.

### Calme et envie de revenir

Le client a demandé : *« le meilleur UX/UI, garantir le professionnalisme et le confort à travers les animations et les visuels calmes qui attirent les utilisateurs à continuer à utiliser l'app »*. On fidélise par **l'utilité et le plaisir**, jamais par la manipulation :

- **Oui** : rendre le réachat évident (Recommander, favoris, abonnements), un compte à rebours honnête, des micro-animations de confirmation douces, un suivi de livraison rassurant, une app rapide même sur un vieux téléphone, se souvenir de la langue et de l'adresse.
- **Non** : fausse urgence, notifications de relance agressives, pop-ups d'offre, gamification creuse, roue de la fortune, dark patterns à la désinscription ou à la suppression du compte.

---

## 6. Android et Material 3 : ce qui change par rapport à l'iOS

Pars de **Material 3 (y compris Material 3 Expressive)** comme grammaire, habillé par l'identité SOUKI. Un utilisateur Android doit se sentir chez lui dès la première seconde.

### 6.1 Couleur

- Fournis les **rôles de couleur Material 3** complets (`primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`, `secondary…`, `tertiary…`, `error…`, `surface`, `surfaceDim`, `surfaceBright`, `surfaceContainerLowest → Highest`, `onSurface`, `onSurfaceVariant`, `outline`, `outlineVariant`, `inverseSurface`, `scrim`…) **construits à partir des tokens SOUKI** et de leurs règles de rôle (section 4.1). Donne la table de correspondance token SOUKI ↔ rôle M3.
- **Thème clair** = identité principale (crème, verts).
- **Thème sombre** : à créer, **avec une identité SOUKI** (verts nuit `#0A2814`, `#0C3B22`, menthe `#9BE7AE` sur sombre), pas des gris neutres. Il suit le réglage du système, avec un choix manuel dans Compte (Système / Clair / Sombre).
- **Couleur dynamique (Material You)** : **non** pour les surfaces de marque. SOUKI garde ses couleurs. Seule exception : l'**icône thématique** (couche monochrome) suit le thème du téléphone.
- Tous les couples texte/fond **≥ 4,5:1** (≥ 3:1 pour le gros texte et les icônes utiles). Donne le ratio de chaque couple dans les tokens.
- **États (state layers)** M3 : survol 8 %, focus 10 %, appui 10 %, glisser 16 %, désactivé 38 % (contenu) / 12 % (conteneur), et **ripple** teinté de la couleur du contenu.

### 6.2 Typographie

- Fournis l'**échelle typographique M3** (Display L/M/S, Headline L/M/S, Title L/M/S, Body L/M/S, Label L/M/S) **plus les styles SOUKI** (prix héros, prix carte, compte à rebours, unité de prix, sur-titre), en **sp**, avec interlignage et approche.
- **Le choix de police est ouvert.** Le client veut « la meilleure typographie du monde ». Poppins est la police actuelle (web + iOS) mais elle fait un peu « template ». Propose une **planche de comparaison** de 2 ou 3 couples latin + arabe, et **recommande-en un** :
  - contraintes : licence libre pour l'embarquer dans l'APK (OFL ou équivalent), graisses variables, **chiffres tabulaires**, latin et arabe qui s'harmonisent (même gris, mêmes hauteurs perçues), lisible à 12 sp sur un écran bon marché ;
  - pistes à évaluer (non imposées) : Geist, Inter / Inter Display, Instrument Sans, Manrope, Figtree pour le latin ; IBM Plex Sans Arabic, Readex Pro, Noto Kufi Arabic, Alexandria, Tajawal (actuelle) pour l'arabe ;
  - teste chaque couple sur de vrais contenus : `Tomate · ماطيشة · Mtecha`, `12,50 DH / kg`, `03:42:18`, `Livraison offerte dès 300 DH`, un paragraphe en arabe ;
  - si tu recommandes de quitter Poppins, dis ce que ça implique pour l'iOS et le site (cohérence de marque) et propose une transition ; le logo, lui, ne change pas.
- **Taille de police du système** : tout doit tenir jusqu'à **200 %** (mise à l'échelle non linéaire d'Android 14+). Aucune hauteur fixe sur du texte, montre les écrans clés à 130 % et 200 %.

### 6.3 Forme, espace, élévation

- Échelle de **formes** M3 (none, extra-small 4, small 8, medium 12, large 16, large-increased 20, extra-large 28, extra-large-increased 32, extra-extra-large 48, full) **mappée** sur les rayons SOUKI (8, 14, 18, 22, 24, 30, 40, pill) : choisis et justifie. Les formes de M3 Expressive (formes morphées, coins asymétriques) sont permises pour des moments signature, pas partout.
- Espaces en **dp**, grille de 4, marges d'écran 16 dp (20–24 sur grands écrans).
- **Élévation** : M3 privilégie les **niveaux de surface tonaux** plutôt que les ombres. Garde l'esprit SOUKI (ombres teintées vert) seulement pour les éléments flottants (barre panier, FAB, feuilles).

### 6.4 Navigation et structure

- **Barre de navigation du bas** M3 (pas la capsule flottante iOS) : **Accueil · Produits · Panier · Commandes · Compte**, icône active dans l'indicateur en pilule, libellés toujours visibles, badge de quantité sur Panier. Hauteur et variante (classique ou courte M3 Expressive) à justifier.
- **Mini-barre panier** au-dessus de la barre de navigation dès le premier produit (sauf sur l'onglet Panier et la fiche produit).
- **Top app bars** M3 (grande qui se replie au défilement sur les onglets, petite dans les sous-écrans), en-tête vert sur l'accueil uniquement.
- **Bouton d'action flottant** : à envisager pour la **commande vocale** (FAB étendu « Dicter ma liste » qui se réduit au défilement). Propose-le, ou dis pourquoi tu ne le fais pas.
- **Retour prédictif** (predictive back, Android 14+, obligatoire pour les apps récentes) : dessine l'animation de retour des écrans, des feuilles et de la recherche (aperçu de l'écran précédent pendant le geste).
- **Bord à bord** (edge-to-edge, imposé à partir d'Android 15) : contenu sous la barre d'état et la barre de navigation système, insets gérés, testés en **navigation par gestes** et en **3 boutons**.
- **Feuilles du bas** (bottom sheets) avec poignée, **dialogues** M3, **snackbars** (avec « Annuler » après une suppression du panier) au lieu des alertes iOS. **Menus** M3 à la place des menus contextuels iOS ; l'appui long sur une carte produit ou commande ouvre un menu.
- **Transitions** : *container transform* de la carte produit vers la fiche, *shared axis* entre étapes (checkout, onboarding), *fade through* entre onglets. Donne les durées et courbes.

### 6.5 Mouvement Android

- Courbes M3 : *emphasized* `(0.2, 0, 0, 1)`, *emphasized decelerate* `(0.05, 0.7, 0.1, 1)`, *emphasized accelerate* `(0.3, 0, 0.8, 0.15)`, *standard* ; et les **ressorts** de M3 Expressive (spatial / effets, rapide / standard / lent). Fusionne-les avec le langage SOUKI (section 4.1) en **un seul jeu de tokens** `motion.*` documenté.
- Règle d'or : **calme**. Les animations fréquentes (ajout au panier, appui) < 150 ms ; aucune animation n'empêche d'agir ; rien ne clignote ; pas de boucle infinie hors écoute vocale.
- **Accessibilité** : « Supprimer les animations » d'Android (échelle d'animation à 0) et le mode économie d'énergie = fondus courts ou rien, sans perte d'information.
- **Performance** : tout doit tourner à 60 i/s sur un téléphone d'entrée de gamme (Android 10, 3 Go de RAM). Indique pour chaque animation signature une **version allégée**.

### 6.6 Retours haptiques

Sur l'iOS ils étaient réservés à iPhone. Sur Android, utilise les constantes système (`CONFIRM`, `REJECT`, `CLOCK_TICK`, `CONTEXT_CLICK`, `GESTURE_START/END`, `KEYBOARD_TAP`, `LONG_PRESS`, `SEGMENT_TICK`…) : donne la table action → retour (ajout au panier, quantité, suppression, favori, erreur de saisie, fin de l'intro, commande validée). Toujours doublé d'un retour visuel.

### 6.7 Spécifique Android, à dessiner

- **Icône adaptative** : calques avant / arrière 108 × 108 dp, contenu utile dans la zone de sécurité (cercle de 66 dp), **calque monochrome** pour l'icône thématique. Base : le sac blanc et la feuille verte sur `#005B43` (`splash-symbol.png`, `app-icon-1024.png`). Vérifie le rendu en cercle, carré arrondi, goutte, squircle.
- **Écran de démarrage système** (SplashScreen API, Android 12+) : icône sans fond dans 288 dp (visible dans un cercle de 192 dp), fond `#005B43`, puis l'intro animée « Le marché se réveille » qui part **exactement** de cette image. Variante de nuit.
- **Notifications** (Android 13+ demande la permission `POST_NOTIFICATIONS`) :
  - **jamais** demandée à l'ouverture ni dans l'onboarding : un écran d'explication puis la demande système **après la première commande validée** ;
  - **canaux** : Suivi de commande, Abonnements (rappel avant la fermeture), Compte et sécurité, Nouveautés (désactivé par défaut) ;
  - dessine les notifications : statut de commande, livreur en route, commande livrée, rappel d'abonnement ; et la notification de **suivi en direct** de la livraison (notification de progression / *Live Updates* d'Android 16) avec les 4 étapes ;
  - petite icône de notification monochrome.
- **Raccourcis de l'app** (appui long sur l'icône) : Catalogue, Commande vocale, Mes commandes, Wallet.
- **Widget d'écran d'accueil** (phase 2, mais à dessiner maintenant) : compte à rebours du marché + « Commander », et suivi de la commande en cours. Tailles 2×2 et 4×2, clair, sombre.
- **Liens d'app** (`souki.io/produit/...`, `souki.io/r/<code>` du parrainage) qui ouvrent l'app.
- **Connexion Google** via Credential Manager (feuille système « Continuer en tant que… ») : sur Android, Google est **le** mode de connexion principal. Sign in with Apple n'est pas requis sur Android (on peut ne pas le montrer).
- **Clavier** : type de champ correct (e-mail, téléphone, numérique pour le code), saisie automatique du code reçu, remplissage automatique des mots de passe ; l'écran ne doit pas être caché par le clavier.
- **Carte** de l'adresse (Google Maps sur Android) avec « Me localiser » et la zone de Fès.
- **Mode hors ligne** : le dernier catalogue reste visible, bandeau discret « Hors ligne », actions qui demandent le réseau grisées avec explication.

### 6.8 Tailles d'écran

- Référence **360 × 800 dp** (le plus courant au Maroc) et **412 × 915 dp** (grand téléphone). Vérifie aussi **360 × 640 dp** (petit, ancien) : rien ne déborde, même en arabe à 130 %.
- Portrait verrouillé sur téléphone. **Tablettes et pliables** : la Play Store valorise les grands écrans ; propose au moins le comportement des écrans principaux en **largeur moyenne** (600–840 dp : rail de navigation, grille produits plus large, fiche en deux colonnes). À trancher avec le client avant d'aller plus loin.
- Encoches, perforations de caméra, coins arrondis : rien d'important dans ces zones.

---

## 7. Accessibilité (non négociable)

- Contraste AA partout (section 6.1), **zones de toucher ≥ 48 × 48 dp**.
- **TalkBack** : chaque bouton à icône seule a un libellé ; l'ordre de lecture est logique ; les prix se lisent « douze dirhams cinquante le kilo » ; les comptes à rebours ne sont pas annoncés à chaque seconde.
- **RTL** complet : miroir de la mise en page et des icônes directionnelles (flèches, chevrons, retour), mais **pas** des chiffres, des prix, des logos, des tracés de marque ni de la lecture audio.
- Rien qui ne repose sur la couleur seule (statuts = couleur + icône + texte).
- Taille de texte jusqu'à 200 %, « Supprimer les animations », contraste élevé du système.

---

## 8. Inventaire des écrans à livrer

Dans cet ordre de priorité (le même que l'iOS). Pour chaque écran : **clair et sombre, français et arabe**, et ses **états** : chargement (squelettes qui ne font pas sauter la page), vide, erreur, hors ligne, et les états métier listés.

**P0 : lancement et socle**
- Écran de démarrage système + intro « Le marché se réveille » (jour et nuit).
- Icône adaptative, icône thématique, petite icône de notification.

**P1 : marché**
- Accueil (états de l'horloge : ouvert, soir, dernière heure, fermé de nuit).
- Produits / catalogue : rayons, filtres, tri, recherche (avec historique et « aucun résultat »).
- Fiche produit (en stock, bientôt épuisé, épuisé, dans le panier).
- Panier (vide, sous le minimum, livraison offerte atteinte, suggestions en trois étagères, suppression avec « Annuler »).
- Favoris.

**P2 : compte**
- Entrée (Google, e-mail), e-mail, mot de passe, code (6 chiffres), mot de passe oublié.
- Onboarding complet (bienvenue + langue, prénom, adresse sur carte, hors zone, téléphone, mot de passe, code, 3 écrans service).
- Compte (style réglages Android), profil + photo, adresse, sécurité (sessions), changer de mot de passe, notifications, thème, langue, suppression du compte (honnête, sans piège).

**P3 : commande**
- Checkout (adresse, date et créneau, paiement à la livraison ; carte prévue mais masquée ; restriction de compte et demande de levée).
- Commande validée.

**P4 : après la commande**
- Historique (en cours / passées), suivi (4 étapes + incidents + « Contacter SOUKI »), gérer / modifier / annuler, réclamation (motifs, photo facultative, succès → Wallet), recommander.

**P5 : fidélité**
- Wallet (deux soldes, mouvements), abonnements (liste, détail, sauter, mettre en pause 1–4 semaines, reprendre), parrainage (dessiné, caché au lancement).

**P6 : IA**
- Consentement IA, commande vocale (écoute, analyse « Du mot au panier », liste prête modifiable, « pas compris »), liste écrite, panier intelligent, discussion avec la mascotte.

**P7 : Android en plus**
- Notifications (dont suivi en direct), widget, raccourcis, écran « Hors ligne », mise à jour de l'app disponible.

**P8 : fiche Google Play** (section 10).

---

## 9. Composants à documenter

Chaque composant : rôle, anatomie, variantes, **tous les états** (normal, appuyé, focus clavier, désactivé, chargement, erreur, sélectionné), tailles, comportement RTL, sombre, TalkBack, animation, tokens utilisés, et ce qu'il **ne faut pas** faire.

Base Material habillée SOUKI : boutons (rempli, tonal, contour, texte, icône, FAB étendu), champs de texte (rempli / contour, aide, erreur, compteur), chips (filtre, rayon, suggestion), barre de recherche M3, navigation du bas, top app bars, onglets, feuilles du bas, dialogues, snackbars, menus, interrupteurs, cases, radios, curseur, indicateurs de progression (linéaire, circulaire, ondulé M3 Expressive pour l'attente), badges, listes et éléments de liste, séparateurs.

Composants SOUKI (existent sur iOS, à adapter) : carte produit (grille et rail), ajout rapide, sélecteur de quantité, pastille de disponibilité, étiquette de prix (chiffres tabulaires), mini-barre panier, ligne du panier (glisser pour supprimer), jauge « livraison offerte », étagères de suggestions, carte « Marché du jour » + compte à rebours roulant, horloge du marché (en-tête), rail de rayons avec tuiles en dégradé, en-tête compact, cartes assistants, scène vocale (sphère, plateau, lumière), carte de statut de commande, étapes de commande en « S », chemin de livraison, carte d'abonnement, éléments du Wallet, emplacement photo, sélecteur de carte, groupe de réglages, état vide de marque, squelettes, sélecteur de langue, intro de lancement, route d'onboarding.

---

## 10. Fiche Google Play (à concevoir aussi)

- **Icône** 512 × 512 px PNG 32 bits (Google applique lui-même l'arrondi et l'ombre : ne pas les dessiner).
- **Image de présentation** (feature graphic) 1024 × 500 px, sans transparence, lisible en tout petit, sans texte essentiel près des bords.
- **Captures téléphone** : 8 cadres (minimum 4 pour être mis en avant), 1080 × 1920 px ou plus, 9:16, en **français et en arabe**. Une idée par capture, titre court au-dessus de l'écran réel (pas de faux contenu présenté comme réel, pas de prix trompeur, pas de « n°1 », pas de note inventée).
- Propose aussi les captures tablette si la section 6.8 est validée.
- **Textes** (proposition) : titre ≤ 30 caractères, description courte ≤ 80 caractères, description longue ≤ 4000 caractères, en français et en arabe, ton SOUKI, conforme aux règles Play (pas de mots-clés en vrac, pas d'emojis en excès, pas de superlatifs non prouvés).
- Vidéo de présentation facultative : storyboard de 20–30 s si tu as le temps.

---

## 11. Ton et micro-copie

- **Vouvoiement**, phrases courtes, verbes d'action (« Ajouter », « Valider la commande », « Dicter ma liste »).
- Chaleureux et précis, jamais familier ni publicitaire. On parle comme un bon marchand de Fès qui connaît ses clients.
- Les erreurs disent **quoi faire** (« Le code a expiré. Recevoir un nouveau code »), jamais « Une erreur est survenue ».
- Les états vides proposent une action utile.
- Arabe : rédigé, pas traduit mot à mot. Noms de produits en darija.
- Exemples dans les maquettes (prix, noms, numéros de commande, soldes) = **exemples réalistes** clairement fictifs ; l'app affichera les vraies données de l'API.

---

## 12. Ce que tu livres, et comment on suit l'avancement

Le client veut **pouvoir tester à tout instant et suivre l'avancement de bout en bout**. Organise le design system pour ça :

1. **`README` de marque** : principes, règles de rôle des couleurs, à faire / à ne pas faire, avec des exemples visuels.
2. **`tokens.json`** : couleurs (clair + sombre, rôles M3 + tokens SOUKI, ratios de contraste), typographie (sp), espaces, formes, élévation, mouvement (durées, courbes, ressorts), tailles (zones de toucher, barres). Noms stables, prêts à devenir un `theme.ts` React Native.
3. **Une fiche par composant** (section 9) avec son code de référence web et les **notes de traduction React Native** (Reanimated, react-native-svg, Compose via `@expo/ui`, ce qui est natif Android).
4. **Les écrans** (section 8) assemblés à partir des composants, aux tailles de la section 6.8.
5. **Un prototype cliquable** du parcours principal : lancement → accueil → fiche → panier → entrée → onboarding → checkout → commande validée → suivi ; et du parcours vocal.
6. **Une page « Avancement »** tenue à jour à chaque itération : tableau de chaque fondation, composant et écran avec son état (*à faire / en cours / à valider / validé*), la date, ce qui a changé, et les questions ouvertes. C'est la page que le client ouvre en premier.
7. **Une page « Passation au code »** : ordre de développement, correspondances composant → code, écarts volontaires avec l'iOS et pourquoi, liste des points qui demandent le back-end.
8. **La fiche Google Play** (section 10).

Travaille **par itérations courtes et montrables** : d'abord les fondations (couleurs, typo avec la planche de comparaison, formes, mouvement) **pour validation**, puis P0–P1, puis le reste. N'attends pas d'avoir tout fini pour montrer.

---

## 13. Fichiers à joindre à Claude Design

Depuis le dépôt Souki :

| Fichier | Pourquoi |
|---|---|
| `apps/mobile/src/theme.ts` | tous les tokens SOUKI 2027 et leurs règles de rôle |
| `apps/mobile/src/lib/motion.ts` | langage de mouvement actuel |
| `apps/mobile/DESIGN-HANDOFF.md` | règles de l'iOS, décisions déjà prises |
| `apps/mobile/FINITION.md` | écarts décidés volontairement (à respecter aussi sur Android) |
| `apps/mobile/assets/brand/*` | logo horizontal, symbole, sac de lancement, icône 1024 |
| `apps/mobile/assets/illustrations/*` | illustrations de marque (panier, célébration, couronne, mascotte « Récolte ») |
| `apps/client/public/brand/*` | déclinaisons du logo du site |
| `packages/shared/src/rules.ts` | règles du panier et de la fenêtre de commande |
| `packages/shared/src/orders.ts` | statuts et étapes de commande |
| quelques composants iOS clés : `home-hero.tsx`, `product-card.tsx`, `market-clock.tsx`, `voice-scene.tsx`, `launch-intro.tsx`, `onboarding-road.tsx` (dans `apps/mobile/src/components/`) | pour comprendre les écrans signature |
| captures d'écran de l'app iOS et de la PWA | pour voir le rendu actuel |

Ne joins **rien** du back-end, aucun fichier `.env`, aucune clé.

---

## 14. Décisions à faire valider par le client (pose la question, avec ta recommandation)

1. **Police** : garder Poppins + Tajawal ou passer au couple que tu recommandes (et l'étendre plus tard à l'iOS et au site) ?
2. **Thème sombre** au lancement ou en version 1.1 ?
3. **FAB de commande vocale** sur l'accueil et le catalogue ?
4. **Tablettes et pliables** : mises en page dédiées dès la v1 ou plus tard ?
5. **Nom de la mascotte** : « Souki » (site) ou « Récolte » (design iOS) ?
6. **Widget** d'écran d'accueil en v1 ou en v1.1 ?

---

## 15. Rappels finaux

- Même marque, même service, même logique métier que l'iOS et le site : **ne pas inventer de fonction** ni de règle (prix, minimum, horaires, zones).
- Android d'abord : un utilisateur Android ne doit jamais tomber sur un réflexe iOS (bouton retour en haut à gauche comme seul moyen de revenir, feuilles d'action iOS, interrupteurs iOS, police San Francisco, glisser depuis le bord gauche pour revenir).
- Calme, net, rapide, honnête. Chaque pixel a une raison.
