# Passation : terminer l'app Android SOUKI

Pour le développeur qui reprend `apps/play-store`. À lire avant de toucher au code.
État au 17 novembre 2026, branche `feat/android-play-store`.

Les autres documents :
- `PLAN-ANDROID.md` : règles Google Play, décisions (D1 à D12), phases, contrats back-end, actions de l'équipe.
- `design-system/` : la référence visuelle. `00-avancement.md` (décisions du design), `android.md` (Material 3,
  transitions, haptique), `passation.md` (notes écran par écran), `components/Screen…/preview.html` (maquettes).
- `README.md` : lancer l'app, variables de build, vérifications.

---

## 1. Démarrer en 5 minutes

```bash
pnpm install
pnpm dev:play-store                      # QR code à scanner avec Expo Go (Android)
pnpm --filter @souki/play-store check    # types + contrôle du thème sombre
```

- Expo Go suffit pour tout ce qui est visuel. La connexion Google et les notifications push demandent une
  build de développement (`eas build -p android --profile development`).
- **Windows** : toujours lancer via les scripts (`pnpm dev:play-store`, `node scripts/expo.mjs …`). Lancé
  directement depuis un terminal en `c:\` minuscule, Metro casse les chemins (`c:\C:\…`) ; le lanceur corrige.
- **Comparer avec les maquettes** : `pnpm --filter @souki/play-store web` (serveur web de développement,
  port 8090), puis `pnpm --filter @souki/play-store captures marche produits panier compte`. Images dans
  `apps/play-store/captures/` (clair et sombre, 360 × 800). Pour une maquette :
  ouvrir `design-system/components/<Écran>/preview.html` dans le navigateur.
- Si le web montre l'ancienne version après une modification, relancer `web` (cache de Metro sous Windows).

---

## 2. Où en est l'app

| Zone | État |
|---|---|
| Fondations (thème clair/sombre, polices, échelle de texte, formes, mouvement, haptique) | fait |
| Navigation (barre M3, mini-barre panier, flèche Android, feuilles, snackbars) | fait |
| Accueil, Produits, fiche produit, panier | **refaits d'après les maquettes** |
| Entrée, onboarding, compte, checkout, commandes, suivi, réclamation, Wallet, abonnements, IA | thème, polices, boutons et sombre appliqués ; **mise en page encore celle de l'iOS** |
| Notifications, Google, signalement IA, raccourcis, liens d'app, permissions, icônes | fait côté app ; dépend parfois du back-end ou des comptes (§ 6, § 7) |
| Site : fin de la PWA, `assetlinks.json` | prêt, inactif (variables) |

Captures de référence de ce qui est fait : lancer `captures` (§ 1) sur `marche produits panier compte`.

---

## 3. Les règles du code (à respecter pour ne rien casser)

### 3.1 Couleurs : quatre sources, une seule bonne à chaque fois

Le thème sombre fonctionne **par rôles** : `applyColorScheme()` remplace les valeurs de `palette`, `colors`,
`m3`, `gradients`, `shadows` et l'arbre des écrans est redessiné (`contexts/theme-context.tsx`).

| Source | Quand l'utiliser | Exemple |
|---|---|---|
| `m3.*` | **Tout code nouveau** : rôles Material 3 du design (`primary`, `onSurface`, `surfaceContainerHigh`, `secondaryContainer`…) | `color={m3.onSurfaceVariant}` |
| `palette.*` / `colors.*` | Code repris de l'iOS : chaque nom a sa valeur sombre | `palette.white` = carte (sombre en thème sombre) |
| `scene.*` | Illustrations et surfaces qui restent **identiques** dans les deux thèmes : en-tête vert, scène vocale, tuiles de rayon, onboarding, « Commande validée », et ce qui est posé dessus | `color={scene.white}` sur l'en-tête vert |
| `brand.*` | Quelques couleurs de marque fixes (encre sur orange, texte sur vert foncé) | `brand.onDark`, `brand.ink` |

Règles :
- **Jamais de couleur lue hors d'un composant** (constante de module) : elle resterait en clair.
  `pnpm --filter @souki/play-store check:theme` le détecte et doit rester vert.
- Pas de couleur écrite en dur (`#…`) dans un écran : passer par `m3`, `palette` ou `scene`.
- Texte sur orange ou jaune : toujours `scene.ink900` / `brand.ink` (foncé dans les deux thèmes).
- Les styles sont en ligne (pas de `StyleSheet.create`) : c'est voulu, les couleurs sont lues au rendu.

### 3.2 Texte, formes, toucher

- Toujours le composant `Text` (`components/text.tsx`) avec une variante M3 : `displaySmall`, `headlineLarge`…
  `titleMedium`, `bodyLarge`, `labelLarge`, plus `priceHero`, `priceCard`, `priceUnit`, `eyebrow`. Il gère l'arabe
  (police, taille, interligne) et la taille de texte du téléphone (jusqu'à 200 %). Aucune hauteur fixe sur du texte.
- Coins : `radius.xs` 8, `control` 12 (boutons, champs), `photo`/`tile` 16, `card` 20, `feature` 28, `hero` 32.
  **Pas de bouton en pilule** (décision 7 du design).
- Zone de toucher ≥ 48 dp (`sizes.touchMin`). Ripple Android : `android_ripple={{ color: withAlpha(couleurDuContenu, states.pressed) }}`.
- Haptique : `lib/haptics.ts` (constantes Android), toujours avec un retour visuel.
- Mouvement : `lib/motion.ts` (courbes M3, durées, ressorts). Respecter `useReducedMotion()`.

### 3.3 Composants à réutiliser (ne pas en recréer)

| Besoin | Composant |
|---|---|
| Bouton (rempli, tonal, contour, texte, danger, avec montant) | `components/brand-button.tsx` (`tone`, `trailing`, `loading`) |
| Titre d'onglet, recherche, chips, bouton icône, FAB vocal | `components/m3.tsx` |
| Carte produit, sélecteur de quantité, prix, pastille de stock | `product-card`, `quantity-stepper`, `price-tag`, `availability-badge` |
| Ligne de panier, jauge livraison offerte | `cart-line-row`, `free-delivery-gauge` |
| Feuille d'actions (menu) | `showActionSheetWithOptions` de `components/action-sheet.tsx` (jamais `ActionSheetIOS`) |
| Message en bas d'écran (+ « Annuler ») | `showSnackbar` de `components/snackbar.tsx` |
| Titre de section + « Tout voir » | `components/section-header.tsx` |

### 3.4 Métier, textes, fichiers

- Toute règle métier (prix, minimum, horaires, statuts) vient de `@souki/shared`, jamais d'un calcul dans un écran.
- Tout texte passe par `t("…")` et **doit exister en arabe** dans `packages/shared/src/i18n.ts` (dictionnaire
  partagé avec l'iOS ; ce fichier est en fins de ligne CRLF, les garder). La table `design-system/kit/ar.json`
  (≈ 440 traductions relues) sert de source.
- Pas d'emoji dans l'interface, pas de contenu inventé (notes, avis, « bientôt »).
- Règles du projet (`Documentation/regles.md`) : ne supprimer aucun fichier, accord avant toute nouvelle dépendance.
- Ne jamais modifier `apps/mobile` (app iOS) pour l'Android : les deux apps sont indépendantes, seul `@souki/shared` est commun.

---

## 4. Méthode pour refaire un écran d'après sa maquette

1. Ouvrir la maquette `design-system/components/Screen<Nom>/preview.html` (et `…Dark`, `…Ar`) et sa note dans
   `design-system/passation.md`.
2. Garder la logique de l'écran (hooks, appels API, navigation) ; ne changer que la présentation.
3. Remplacer les couleurs iOS par les rôles `m3` (§ 3.1), les styles de texte par les variantes M3, les rayons
   par `radius.*`, les cartes à ombre par une bordure `m3.outlineVariant` (pas d'ombre au repos).
4. Remplacer les éléments iOS : chevrons → flèches (`ArrowLeft`/`ArrowRight` selon `isRtl`), `Share` → `Share2`,
   pilules → coins 12 dp, verre (`expo-glass-effect`) → surface opaque, `Alert` à plus de deux choix → feuille.
5. Vérifier : `pnpm --filter @souki/play-store check`, captures clair / sombre / arabe, puis le téléphone.
6. Cocher l'écran dans le tableau « Avancement » de `PLAN-ANDROID.md`.

Exemples complets à imiter : `screens/products-screen.tsx`, `app/(tabs)/(marche)/marche.tsx`,
`components/home-android.tsx`, `screens/product-detail-screen.tsx`, `app/(tabs)/(panier)/panier.tsx`.

---

## 5. Ce qui reste à faire, par ordre

### Priorité 1 : avant la première build de test

1. **Tester sur un vrai téléphone Android** (Expo Go puis APK `preview`) : accueil, produits, fiche, panier,
   thème sombre, arabe, texte à 200 %, navigation par gestes et à 3 boutons. Protocole : `design-system/test-appareil.md`.
2. **Titres des onglets Panier, Commandes, Compte** : passer au grand titre dans le contenu (`ScreenTitle` de
   `components/m3.tsx`, `headerShown: false` dans le `_layout` de l'onglet), comme Produits.

### Priorité 2 : fidélité aux maquettes (écrans hérités de l'iOS)

| Lot | Écrans (fichiers) | Maquettes |
|---|---|---|
| P2 Compte | `app/(auth)/*`, `app/bienvenue.tsx`, `app/(tabs)/(compte)/*` | `ScreenAuth`, `ScreenKeyboard`, `ScreenOnboarding`, `ScreenOnboarding2`, `ScreenAccount`, `ScreenSettings` |
| P3 Commande | `app/checkout.tsx`, `components/checkout-parts.tsx`, `app/commande-validee.tsx` | `ScreenCheckout`, `ScreenCheckoutStates`, `ScreenOrderDone` |
| P4 Après | `app/(tabs)/(commandes)/*`, `components/order-parts.tsx`, `order-status-card.tsx` | `ScreenOrders`, `ScreenOrderManage`, `ScreenOrderIssues`, `ScreenClaim` |
| P5 Fidélité | `wallet.tsx`, `abonnements.tsx`, `abonnement/[id].tsx`, `components/loyalty-parts.tsx`, `subscription-card.tsx` | `ScreenWallet`, `ScreenSubscriptions`, `ScreenSubscriptionStates` |
| P6 IA | `app/commande-vocale.tsx`, `components/voice-scene.tsx`, `app/panier-intelligent.tsx`, `app/souki-chat.tsx`, `components/ai-parts.tsx` | `ScreenVoice`, `ScreenAssistant`, `ScreenAssistantDish` |
| Favoris, états | `app/(tabs)/(compte)/favoris.tsx`, `components/empty-state.tsx`, `skeleton.tsx` | `ScreenFavorites`, `ScreenStates`, `SkeletonsAndEmpty` |

### Priorité 3 : Android en plus

- **Intro de lancement** « Le chemin du marché » (prototype animé du design) à la place de l'intro iOS
  (`components/launch-intro.tsx`), avec sa version allégée.
- **Largeur moyenne** (≥ 600 dp, tablettes et pliables) : grille élargie, panier en deux volets (`ScreenTablet`,
  `ScreenTablet2`). Obligatoire en pratique : avec l'API 36, Android ignore le verrouillage en portrait sur grand écran.
- **Transitions** de `design-system/android.md` (carte → fiche, étapes du checkout).
- **Suivi en direct** de la livraison en notification (Android 16), quand le back-end envoie les statuts.
- Widget d'écran d'accueil : v1.1 (hors v1).

---

## 6. Interrupteurs : ce qui attend le back-end ou une clé

| Interrupteur (`src/lib/features.ts` ou build) | Quand l'activer | Contrat |
|---|---|---|
| `PUSH_TOKEN_REGISTRATION_ENABLED` | route B3 déployée | `POST /api/push/appareils` `{ token, plateforme }` (jeton Expo), authentifié |
| `AI_REPORT_ENDPOINT_ENABLED` | route A4 déployée (sinon le signalement part par WhatsApp) | `POST /api/assistant/signalements` `{ surface, motif, contenu }` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (EAS) | client OAuth « Web » du projet Google SOUKI fourni | `/auth/google` existe déjà ; le bouton Google reste caché sans cette variable |
| `GOOGLE_MAPS_ANDROID_API_KEY` (EAS) | clé créée | carte de l'adresse en build réelle |
| `GOOGLE_SERVICES_JSON` (fichier EAS) | projet Firebase créé | notifications push FCM |
| `CARD_PAYMENT_ENABLED` | paiement CMI prêt | — |
| Site : `ANDROID_APP_SHA256_FINGERPRINTS` | clé de signature Play connue | `/.well-known/assetlinks.json` |
| Site : `NEXT_PUBLIC_ANDROID_APP_PUBLISHED=true` | **le jour de la publication** | fin de l'installation PWA, renvoi vers Google Play |

Autres demandes au back-end : noms de rayon en arabe (`nom_ar`, ex. « Fruits de saison »), heures de chaque étape
du suivi, non-conservation des enregistrements vocaux à confirmer (décision D6).

---

## 7. Publication (résumé, détail dans `PLAN-ANDROID.md` § 1, § 6, § 9)

1. Compte Play (organisation, D-U-N-S), app `io.souki.app`, `eas init`, variables du § 6.
2. `eas build -p android --profile preview` → APK à tester ; puis `--profile production` → AAB ;
   `eas submit -p android` (piste interne, en brouillon).
3. Play Console : fiche (`store-listing/`, capture arabe 04 à refaire), sécurité des données (§ 6 du plan),
   classification, public 18+, compte de test pour l'examen, URL de suppression du compte :
   `https://souki.io/politique-confidentialite#suppression`.
4. Test fermé si le compte est personnel (12 testeurs, 14 jours), puis production en déploiement progressif.

---

## 8. Pièges connus

- `expo-image-picker` avec `microphonePermission: false` retire `RECORD_AUDIO` de **toute** l'app (commande vocale
  cassée). Garder le texte du micro. Après chaque ajout de module, vérifier le manifeste :
  `node scripts/expo.mjs prebuild --platform android --no-install --clean`, lire
  `android/app/src/main/AndroidManifest.xml`, puis supprimer le dossier `android/` (il est généré, jamais commité).
- `react-native-credentials-manager` et `expo-notifications` (push) n'existent pas dans Expo Go : ils sont chargés
  à la demande et désactivés là (`lib/google-sign-in.ts`, `lib/notifications.ts`). Ne pas les importer en haut d'un écran.
- `react-native-maps` n'existe pas sur le web : `components/map-picker.web.tsx` sert l'aperçu.
- Après `npx expo install`, relancer `pnpm --filter @souki/play-store doctor` (versions en double, dépendances manquantes).
- Le dépôt mélange LF et CRLF : un script qui remplace du texte doit normaliser avant de comparer.

---

## 9. Avant chaque pull request

```bash
pnpm --filter @souki/play-store check
pnpm --filter @souki/play-store doctor
pnpm --filter @souki/play-store export:android
pnpm check:boundaries
git diff --check
```

Puis : captures clair, sombre et arabe des écrans touchés dans la description de la PR, tableau « Avancement »
de `PLAN-ANDROID.md` mis à jour. Commits avec l'adresse GitHub `…@users.noreply.github.com`, jamais une adresse
d'école ou personnelle.
