# Plan d'implémentation : app Android SOUKI (Google Play)

Mis à jour le 17 novembre 2026 (passe d'implémentation n° 1). À tenir à jour à la fin de chaque phase.

- **Code** : `apps/play-store` (Expo SDK 58, React Native 0.88, Expo Router, `@souki/shared`).
- **Design** : `apps/play-store/design-system/` (tokens, composants, écrans, `android.md`, `passation.md`, `00-avancement.md`).
- **But** : une app Android publiée sur Google Play, conforme à toutes les règles de la Play Console, au niveau du design system Android.

---

## Avancement

États : à faire · en cours · à tester (fait, à vérifier sur un téléphone) · fait.

| Phase | Contenu | État | Ce qui reste |
|---|---|---|---|
| 0 | Socle, outillage | à tester | Créer le projet EAS, le compte Play et l'app dans la Play Console (§ 10) |
| 1 | Fondations : thème clair/sombre, polices, texte, toucher, haptique, mouvement | à tester | Essai sur téléphone d'entrée de gamme |
| 2 | Navigation : barre M3, mini-barre panier, en-têtes, retour prédictif, feuilles, snackbars | à tester | Titres « grande barre » sur Panier, Commandes, Compte (barre M3 petite pour l'instant) |
| 3 | Marché : accueil, catalogue, fiche, panier, favoris, icônes | à tester | Intro animée « Le chemin du marché » (l'intro iOS est gardée), écrans « largeur moyenne » |
| 4 | Compte : entrée, Google, code, onboarding, compte, suppression | à tester | Écrans hérités de l'iOS habillés par le thème ; passe de fidélité aux maquettes P2 |
| 5 | Commande : checkout, carte, commande validée, demande des notifications | à tester | Passe de fidélité aux maquettes P3 ; clé Google Maps |
| 6 | Après la commande | à tester | Passe de fidélité aux maquettes P4 |
| 7 | Fidélité | à tester | Passe de fidélité aux maquettes P5 |
| 8 | IA (dont signalement des réponses) | à tester | Passe de fidélité aux maquettes P6 ; route back-end A4 |
| 9 | Android système : canaux, permission, raccourcis, liens d'app, langue par app | à tester | Route back-end B3 (push), suivi en direct, Firebase |
| 10 | Qualité | à faire | Protocole `design-system/test-appareil.md`, TalkBack, rapport de pré-lancement |
| 11 | Publication | à faire | § 10 (actions de l'équipe) |
| 12 | Fin de l'installation PWA sur le site | prêt, inactif | Mettre `NEXT_PUBLIC_ANDROID_APP_PUBLISHED=true` le jour de la publication |

### Ce qui est fait (passe n° 1)

- **Thème** (`src/theme.ts`, `contexts/theme-context.tsx`) : jetons du design Android, rôles Material 3 (`m3`), thème **sombre par rôles** (chaque couleur SOUKI a sa valeur sombre), couleurs fixes `brand` / `scene` pour les surfaces qui restent vert foncé ; réglage Compte > Thème (comme le téléphone, clair, sombre) sans perdre l'écran ni le panier. Contrôle : `pnpm --filter @souki/play-store check:theme` (aucune couleur figée en clair).
- **Typographie** : Instrument Sans + IBM Plex Sans Arabic, échelle M3 + styles SOUKI, texte jusqu'à 200 %.
- **Composants** : bouton M3 (coins 12 dp, ripple, désactivé opaque), barre de navigation M3 + mini-barre panier, carte produit, sélecteur de quantité, pastilles, jauge de livraison offerte, ligne de panier, recherche M3, chips de filtre, FAB vocal, snackbar, feuille du bas, en-têtes M3 avec flèche Android.
- **Écrans refaits d'après les maquettes** : accueil (horloge du marché : jour, soir, dernière heure, fermé), produits (recherche, chips, tri, aucun résultat avec recherches récentes), fiche produit, panier. Les autres écrans héritent du thème, des polices, des boutons et du sombre.
- **Android** : retours haptiques système, `ActionSheetIOS` remplacé, partage Android, icône adaptative + monochrome, petite icône de notification, raccourcis de l'icône, liens d'app vérifiés, langue par app, permissions minimales vérifiées dans le manifeste généré, R8.
- **Play Store** : notifications (canaux, explication puis demande après la 1re commande, état dans Compte > Notifications), connexion Google (Credential Manager), signalement des réponses de l'IA, suppression du compte (app + page web), 1 035 textes en arabe.
- **Site** : `/.well-known/assetlinks.json`, fin de l'installation PWA prête derrière un réglage, politique de confidentialité mentionne l'app Android.

---

## 1. Les règles de Google Play à respecter

Vérifiées le 17 novembre 2026. Chaque ligne indique où elle est traitée dans ce plan.

| Exigence | Valeur | Ce qu'on fait | Phase |
|---|---|---|---|
| Niveau d'API cible | **Android 16 (API 36)** obligatoire pour toute nouvelle app depuis le 31 août 2026 | SDK 58 cible déjà l'API 36 (`targetSdk = 36`, `compileSdk = 37`, `minSdk = 24`). Ne pas baisser. | 0 |
| Format | **Android App Bundle (AAB)** + signature par Google Play (Play App Signing) | profil EAS `production` en `app-bundle` ; EAS garde la clé d'envoi | 0, 11 |
| Pages mémoire de 16 Ko | obligatoires pour les apps qui ciblent Android 15+ | RN 0.88 et SDK 58 compatibles ; vérifier chaque `.so` de l'AAB (`zipalign -c -P 16`) | 10 |
| Bord à bord | imposé à partir de l'API 35, sans désactivation à l'API 36 | insets gérés partout, barres système transparentes | 1, 2 |
| Retour prédictif | actif par défaut à l'API 36 | aucun écran ne bloque le retour en silence ; animations de retour du design | 2 |
| Grands écrans | à l'API 36, l'orientation portrait et la taille fixe sont **ignorées** sur tablettes et pliables (≥ 600 dp) | mises en page « largeur moyenne » du design (P7) ; rien ne casse en paysage | 3, 10 |
| Compte personnel récent | **test fermé avec au moins 12 testeurs inscrits pendant 14 jours d'affilée** avant d'avoir accès à la production (comptes personnels créés après le 13 nov. 2023) | lancer le test fermé **le plus tôt possible** (fin de la phase 6) ; liste de 15 à 20 testeurs | 11 |
| Vérification du développeur | identité vérifiée dans la Play Console ; l'app doit être enregistrée par un développeur vérifié | à faire à la création du compte | 0 |
| Règles de confidentialité | URL publique dans la fiche **et** dans l'app | `souki.io/politique-confidentialite` (existe) ; lien dans Entrée et Compte | 4, 11 |
| Suppression du compte | si l'app crée des comptes : suppression **dans l'app** **et** une **page web** pour la demander sans l'app | écran « Supprimer mon compte » (existe) ; page web à vérifier ou créer sur souki.io ; URL déclarée dans la Play Console | 4, 11 |
| Section « Sécurité des données » | déclaration exacte de toutes les données collectées, partagées, chiffrées, supprimables | tableau au § 6 | 11 |
| Permissions | seulement celles qui servent, demandées au moment où elles servent | tableau au § 5 ; permissions en trop bloquées dans `app.config.ts` | 0, 10 |
| Photos et vidéos | pas d'accès large à la galerie (`READ_MEDIA_IMAGES/VIDEO`) sans besoin central : utiliser le **sélecteur de photos** d'Android | `expo-image-picker` (sélecteur système) ; bloquer `READ_MEDIA_*` | 0, 6 |
| Position | premier plan uniquement, justifiée | « Me localiser » de l'adresse ; aucune position en arrière-plan | 4, 5 |
| Notifications | permission `POST_NOTIFICATIONS` (Android 13+) | demandée après la première commande validée, jamais au lancement | 5, 9 |
| Contenu généré par IA | les apps avec IA générative doivent permettre de **signaler** une réponse choquante, et filtrer les contenus interdits | bouton « Signaler cette réponse » dans la discussion et sur les résultats IA ; filtrage côté serveur | 8 |
| Paiements | biens physiques livrés : **pas** de Google Play Billing | paiement à la livraison ; carte CMI plus tard, hors Play Billing | 5 |
| Classification du contenu | questionnaire IARC obligatoire (une app non classée est retirée) | à remplir : pas de violence, pas de jeux d'argent, achats de biens physiques | 11 |
| Public cible | à déclarer ; < 13 ans = règles « Familles » | public **18 ans et plus** (achats, livraison) | 11 |
| Accès pour l'examen | si une partie de l'app demande un compte : identifiants de test fournis | compte de test dédié, avec adresse à Fès et historique | 11 |
| Fiche Play | titre ≤ 30 caractères, description courte ≤ 80, longue ≤ 4000 ; icône 512 × 512 ; image de présentation 1024 × 500 ; 2 à 8 captures par type d'appareil | fichiers prêts dans `apps/play-store/store-listing/` (capture AR 04 à refaire) | 11 |
| Qualité technique (Android vitals) | au-delà des seuils, l'app perd en visibilité : **plantages perçus < 1,09 %**, **ANR perçus < 0,47 %** des utilisateurs par jour | suivi des plantages, tests sur entrée de gamme, rapport de pré-lancement | 10 |

Sources : [exigences de niveau d'API cible (Play Console)](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-EN), [Google Play Policies](https://developer.android.com/distribute/play-policies), [annonce des règles du 15 avril 2026](https://support.google.com/googleplay/android-developer/answer/16926792?hl=en), [test fermé 12 testeurs × 14 jours, guide 2026](https://dev.to/founder_can/google-play-12-testers-for-14-days-the-complete-guide-2026-18o8), [publier une app Android en 2026 (AAB, API 36)](https://foresightmobile.com/blog/complete-guide-to-android-app-publishing-in-2026). Les règles bougent plusieurs fois par an : relire le centre d'aide de la Play Console avant la phase 11.

---

## 2. Décisions (tranchées le 17 novembre 2026)

| # | Décision | Choix | Pourquoi |
|---|---|---|---|
| D1 | Type de compte Play | **Organisation** au nom de SOUKI (numéro D-U-N-S) ; à défaut, compte personnel et test fermé lancé dès la phase 6 | Nom « SOUKI » sur la fiche, pas de test fermé obligatoire de 14 jours |
| D2 | Nom du paquet | **`io.souki.app`** | Même identifiant que l'iOS ; définitif une fois l'app créée |
| D3 | Notifications push | **FCM** via un projet Firebase dans le projet Google Cloud SOUKI ; `google-services.json` fourni par EAS (fichier secret `GOOGLE_SERVICES_JSON`) | Standard Android, aucun fichier dans le dépôt |
| D4 | Google Maps | Clé **restreinte** au paquet et aux empreintes SHA-1 (clé d'envoi + clé Play), variable EAS `GOOGLE_MAPS_ANDROID_API_KEY` | Pas de clé dans le dépôt, pas d'usage par d'autres apps |
| D5 | Dépendances ajoutées | Polices (Instrument Sans, IBM Plex Sans Arabic), `expo-system-ui`, `expo-localization`, `expo-notifications`, `expo-device`, `expo-updates`, `expo-build-properties`, `expo-asset`, `react-native-credentials-manager` | Chacune répond à une règle Play ou du design (§ 4.3) |
| D6 | Enregistrements vocaux | **Non conservés** après l'analyse (à confirmer côté back-end, puis à déclarer tel quel) | Moins de données, déclaration plus simple, plus de confiance |
| D7 | Connexion Google | **`react-native-credentials-manager`** (MIT, Credential Manager) plutôt que la version gratuite de `google-signin`, qui repose sur des API Google dépréciées | API actuelle d'Android, feuille système « Continuer en tant que… » |
| D8 | Suivi des plantages | **Android vitals de la Play Console**, sans SDK tiers en v1 | Aucune donnée partagée en plus, rien à déclarer en plus |
| D9 | Thème sombre | **Par rôles** sur la palette existante (et non une réécriture des 81 fichiers) + couleurs fixes `brand` / `scene` + contrôle `check:theme` | Sombre dès la v1 sans risque de régression |
| D10 | Montant dans « Valider la commande » | **Affiché** (fiche Button du design Android validé) | Le design Android est la référence la plus récente ; écart E8 de l'iOS levé sur Android |
| D11 | Signalement IA | Réponse masquée tout de suite ; envoi à la route A4 quand elle existe, sinon **WhatsApp pré-rempli** vers l'équipe | Conforme à la règle Play dès la v1, sans attendre le back-end |
| D12 | Fin de la PWA | Derrière `NEXT_PUBLIC_ANDROID_APP_PUBLISHED` (site) : rien ne change avant la publication | Le site reste le site web ; seule l'installation PWA disparaît |

---

## 3. Comment tester et suivre l'avancement à tout moment

### Trois façons de lancer l'app, selon la phase

| Moyen | Quand | Ce qu'il permet | Limite |
|---|---|---|---|
| **Expo Go** (`pnpm dev:play-store`, QR code) | phases 0 à 3, et ensuite pour tout ce qui est visuel | rechargement instantané à chaque sauvegarde | pas de connexion Google native, pas de push, pas de polices ou modules hors Expo Go |
| **Build de développement** (APK EAS `development`, installé une fois) | dès la phase 4 | comme Expo Go, avec tous les modules natifs de l'app | à refaire seulement quand on ajoute un module natif |
| **Build de test** (APK `preview`, puis piste **test interne** de la Play Console) | dès la phase 5 | l'app réelle, partageable avec l'équipe ; mises à jour JS envoyées sans réinstaller (EAS Update, canal `preview`) | le test interne est limité à 100 testeurs |

### Suivi

- Le tableau **Avancement** en tête de ce fichier, mis à jour à la fin de chaque phase.
- Une **pull request par phase** (ou par lot d'écrans), avec dans la description : ce qui est fait, comment le tester, des captures en clair, sombre et arabe.
- `design-system/00-avancement.md` reste la référence du design ; un écran n'est « fait » que s'il correspond à sa carte (clair, sombre, arabe).
- Un compteur de migration (phase 1) : `pnpm --filter @souki/play-store check:theme` liste les fichiers qui utilisent encore les couleurs fixes de l'iOS. Il doit arriver à zéro.

### Vérifications avant chaque PR

```bash
pnpm --filter @souki/play-store typecheck
pnpm check:boundaries
pnpm --filter @souki/play-store doctor
git diff --check
```

Puis un essai sur le téléphone : parcours de la phase, en français et en arabe, en clair et en sombre.

---

## 4. Architecture

### 4.1 Ce qu'on garde de l'iOS

- La **logique** : `@souki/shared` (règles du panier, fenêtre de commande, statuts, Wallet, voix, traductions), `src/lib/api.ts` (jeton `Bearer`), `src/contexts/` (langue, compte, panier, favoris), `src/hooks/` (catalogue, commandes, horloge du marché). Toute règle métier nouvelle va dans `@souki/shared`, jamais dans un écran.
- Les **routes** (`src/app/`) : mêmes adresses que l'iOS et le site (`/produit/[slug]`…), pour les liens d'app.
- Le **stockage** : jeton dans `expo-secure-store` (Keystore Android), données non sensibles dans `expo-sqlite/kv-store`.

### 4.2 Ce qui change pour Android

| Domaine | iOS (base copiée) | Android (cible) |
|---|---|---|
| Thème | `palette` fixe, clair seulement | `ThemeProvider` + `useTheme()` : rôles Material 3 clair et sombre de `tokens.json`, réglage Système / Clair / Sombre |
| Polices | Poppins + Tajawal | **Instrument Sans + IBM Plex Sans Arabic** (décision 1 du design), embarquées dans l'APK |
| Toucher | `PressableScale` | même enfoncement 0,97 + **ripple** Android + zone de 48 dp minimum |
| Haptique | iOS seulement | constantes Android (`CONFIRM`, `SEGMENT_TICK`, `REJECT`…) via `expo-haptics` (`performAndroidHapticsAsync`) |
| Onglets | capsule flottante dessinée | **barre de navigation M3** (64 dp, indicateur `primary-container`) + mini-barre panier au-dessus |
| En-têtes | grands titres iOS | top app bars M3 (grande qui se replie, petite dans les sous-écrans) |
| Feuilles et alertes | `ActionSheetIOS`, `Alert`, `formSheet` iOS | feuille du bas (`components/action-sheet.tsx`, déjà fait), dialogues M3, **snackbars** avec « Annuler » |
| Verre (`expo-glass-effect`) | barres en verre | surfaces opaques `surface-container` (le flou coûte trop sur l'entrée de gamme) |
| Connexion | Apple + Google (masqués) | **Google seulement** (Credential Manager), Apple non requis sur Android |
| Saisie | `textContentType` (iOS) | `autoComplete` Android (`email`, `password`, `new-password`, `sms-otp`, `postal-address`, `tel`) |

Règle : on **ajoute** des fichiers Android ou on fait évoluer les fichiers copiés ; on ne supprime aucun fichier (règle du projet). Un composant devenu inutile est d'abord débranché, puis signalé dans la PR.

### 4.3 Dépendances à ajouter (à valider, décision D5)

| Paquet | Pour | Phase |
|---|---|---|
| `@expo-google-fonts/instrument-sans`, `@expo-google-fonts/ibm-plex-sans-arabic` | polices du design (les `.woff2` du design system ne se lisent pas sur Android) | 1 |
| `expo-system-ui` | couleur de fond de la fenêtre en clair et en sombre (pas de flash blanc) | 1 |
| `expo-localization` | langue par app d'Android 13+, sens d'écriture au démarrage | 1 |
| `react-native-credentials-manager` (décision D7) | feuille système « Continuer avec Google » (Credential Manager) | 4 |
| `expo-notifications` | notifications push (FCM), canaux | 9 |
| `expo-updates` | mises à jour JS des builds de test sans réinstaller (EAS Update) | 5 |
| `expo-build-properties` | réglages Gradle si besoin (R8, ressources réduites) | 10 |
| `expo-device`, `expo-asset` | jeton de notification sur un vrai appareil ; dépendance requise par `expo-audio` hors Expo Go | 9 |

`expo-glass-effect`, `expo-symbols` et `@expo/ui` (SwiftUI) restent installés pour ne pas casser les imports copiés, mais ne doivent plus être utilisés dans les écrans Android.

---

## 5. Permissions Android (cible finale)

| Permission | Pour | Quand elle est demandée |
|---|---|---|
| `INTERNET` | API | jamais (automatique) |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | « Me localiser » de l'adresse | au toucher de « Me localiser », jamais avant |
| `RECORD_AUDIO` | commande vocale | au premier « Dicter ma liste », après le consentement IA |
| `CAMERA` | photo de profil, photo de réclamation | au choix « Prendre une photo » |
| `POST_NOTIFICATIONS` | suivi de commande, abonnements | après la première commande validée, après un écran d'explication ; jamais redemandée en boucle |
| `VIBRATE` | haptique | jamais (automatique) |

**À bloquer** dans `app.config.ts` (`android.blockedPermissions`) : `SYSTEM_ALERT_WINDOW` (déjà fait), `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, `ACCESS_BACKGROUND_LOCATION`, `WRITE_EXTERNAL_STORAGE`, et toute permission ajoutée par un module qui ne sert pas. Contrôle à chaque phase : `npx expo prebuild --platform android --no-install` dans un dossier temporaire, puis lecture de `AndroidManifest.xml` (le dossier `android/` n'est pas versionné).

---

## 6. Brouillon de la section « Sécurité des données »

À relire avec le back-end avant la phase 11 (décision D6).

| Donnée | Collectée | Pourquoi | Facultative | Partagée |
|---|---|---|---|---|
| Nom, e-mail, téléphone | oui | compte, livraison | non (téléphone : au checkout) | non |
| Adresse | oui | livraison | non pour commander | avec le livreur, pour la livraison |
| Position précise | oui, ponctuellement | placer l'adresse | oui | non |
| Historique d'achats, Wallet | oui | commandes, remboursements | non | non |
| Photos | oui | profil, réclamation | oui | non |
| Enregistrements audio | oui | commande vocale | oui | traités par un prestataire IA pour notre compte (à préciser) |
| Messages à l'assistant | oui | discussion IA | oui | idem |
| Identifiant d'appareil (jeton push) | oui | notifications | oui | non |
| Données chiffrées en transit | oui (HTTPS) | | | |
| Suppression à la demande | oui (dans l'app et sur le web) | | | |

Pas de publicité, pas de pistage, pas d'identifiant publicitaire (bloquer `com.google.android.gms.permission.AD_ID` si un module l'ajoute).

---

## 7. Les phases

Chaque phase : **ce qu'on fait**, **comment le tester**, **critère de fin**. Les écrans suivent l'ordre de `design-system/passation.md` et leurs cartes `Screen…` (clair, `…Dark`, `…Ar`).

### Phase 0 : socle, outillage, comptes

- Fait : projet Expo dans `apps/play-store`, code iOS adapté (feuille d'actions Android, bouton « Vider »), lanceur `scripts/expo.mjs` (chemins `c:\` de Windows), `app.config.ts` Android, `eas.json` (APK de test, AAB de production), `pnpm dev:play-store`.
- Bloquer les permissions du § 5 dans `app.config.ts`.
- Créer le projet EAS (`eas init`), le compte Google Play (décision D1), la vérification du développeur, l'app `io.souki.app` dans la Play Console.
- Ajouter `apps/play-store` aux exports et contrôles du dépôt (`check:boundaries` couvre déjà `apps/*` ; à vérifier).
- **Test** : l'app actuelle s'ouvre dans Expo Go, tous les onglets, tri du catalogue, panier.
- **Fin** : compte Play créé, première build `preview` installée sur un téléphone.

### Phase 1 : fondations

- `src/theme.android.ts` (ou `src/theme/`) généré depuis `design-system/tokens.json` : rôles M3 clair et sombre, tokens SOUKI (`motion`, `price`…), formes (8, 12, 16, 20, 28, 32), espaces, tailles (48 dp, barre 64 dp), ombres teintées pour les éléments flottants.
- `ThemeProvider` + `useTheme()` ; réglage Système / Clair / Sombre enregistré sur le téléphone ; `userInterfaceStyle: "automatic"` quand tous les écrans sont migrés.
- Migration des 81 fichiers qui importent `palette` / `colors` : écran par écran, en suivant les phases 2 à 8. Script `check:theme` qui compte ce qui reste.
- Polices Instrument Sans + IBM Plex Sans Arabic ; `Text` : échelle M3 + styles SOUKI (prix, compte à rebours), règle arabe (taille et interligne), `maxFontSizeMultiplier` 2 (1,15 pour les libellés de la barre de navigation), chiffres tabulaires.
- `Pressable` commun : enfoncement 0,97 (120 ms), `android_ripple` de la couleur du contenu, zone 48 dp.
- `lib/haptics.ts` : table Android de `design-system/android.md`.
- `lib/motion.ts` : courbes M3 (`emphasized`, `emphasized-decelerate`, `standard`) + ressorts + courbe SOUKI ; respect de « Supprimer les animations ».
- Bord à bord : barre d'état et barre de navigation système transparentes, icônes claires ou sombres selon l'écran et le thème.
- RTL : `I18nManager` + `supportsRTL`, langue par app (Android 13+).
- **Test** : un écran de contrôle (développement seulement) qui montre couleurs, textes et boutons en clair, sombre et arabe, à 100 % et 200 %.
- **Fin** : fondations conformes à la section Fondations du design system.

### Phase 2 : navigation

- Barre de navigation M3 (Accueil, Produits, Panier, Commandes, Compte), badge du panier, mini-barre panier au-dessus dès le premier produit (pas sur Panier ni sur la fiche).
- Top app bars M3 ; en-tête vert seulement sur l'accueil.
- Transitions : container transform carte → fiche, shared axis pour les étapes, fade through entre onglets (`design-system/android.md`).
- Retour prédictif : vérifier chaque écran plein écran (checkout, onboarding, commande vocale) ; demander confirmation seulement quand on perd une saisie.
- Dialogues M3 à la place des `Alert` iOS à plus de deux choix ; snackbars (suppression du panier, abonnement arrêté…).
- **Test** : naviguer partout avec le geste de retour **et** en navigation à 3 boutons ; tablette ou émulateur en paysage.
- **Fin** : plus aucun réflexe iOS (bouton retour seul en haut, feuilles iOS).

### Phase 3 : marché

- Écran de démarrage Android 12+ (symbole sur `#005B43`) puis intro « Le chemin du marché » (prototype animé du design), version allégée.
- Icône adaptative (avant, arrière, **monochrome** pour l'icône thématique) depuis `components/AppIcon`.
- Accueil (horloge du marché : ouvert, dernière heure, fermé ; heure du serveur), bouton vocal flottant (étendu sur l'accueil, réduit sur le catalogue).
- Catalogue (rayons, chips, tri, recherche), fiche produit (barre d'achat collée), panier (jauge livraison offerte, minimum, trois étagères, suppression + « Annuler »), favoris.
- États : chargement (squelettes), vide, erreur, hors ligne (dernier catalogue gardé), épuisé.
- Largeur moyenne (≥ 600 dp) : grille élargie, panier en deux volets.
- **Test** : Expo Go ; parcours ajout → panier → minimum → livraison offerte ; 360 × 640 dp ; arabe à 130 %.
- **Fin** : cartes `ScreenLaunch`, `ScreenHome`, `ScreenCatalog`, `ScreenProduct`, `ScreenCart(States)`, `ScreenFavorites` respectées.

### Phase 4 : compte

- Entrée : « Continuer avec Google » (Credential Manager, bouton officiel Google), « Continuer avec l'e-mail ». Le back-end accepte déjà les jetons Google mobiles (`/auth/google`) ; ajouter le client OAuth **Android** (SHA-1 de la clé d'envoi et de la clé Play) dans le projet Google Cloud.
- E-mail → mot de passe ou onboarding (`/auth/check-email`), code à 6 chiffres (`autoComplete="sms-otp"`, coller), mot de passe oublié.
- Onboarding (seulement les informations manquantes), compte, profil (photo par le sélecteur système), adresse, sécurité, notifications, thème, langue.
- Suppression du compte dans l'app (existe) + **page web de demande de suppression** sur souki.io (à vérifier ou créer : URL obligatoire dans la Play Console).
- **Test** : build de développement (première build EAS `development`).
- **Fin** : création de compte, connexion, déconnexion, suppression, en Google et en e-mail.

### Phase 5 : commande

- Checkout (adresse, créneaux, paiement à la livraison ; carte masquée), compte restreint et demande de levée, marché fermé pendant la commande, hors zone.
- Carte Google Maps (clé D4), « Me localiser ».
- Commande validée, puis explication et demande `POST_NOTIFICATIONS`.
- `expo-updates` + canal `preview` ; première build `preview` sur la piste **test interne** de la Play Console.
- **Test** : vraie commande de bout en bout sur l'API de production avec un compte de test (puis annulation).
- **Fin** : commande réelle passée depuis l'app Android.

### Phase 6 : après la commande

- Historique, suivi (étapes en « S », incidents, Appeler / WhatsApp), gérer / modifier / annuler (dialogue), réclamation (motifs, photo par le sélecteur système, succès → Wallet), recommander.
- **Démarrer le test fermé** (piste « test fermé », 15 à 20 testeurs inscrits) dès la fin de cette phase si le compte est personnel : les 14 jours tournent pendant les phases 7 à 10.
- **Fin** : toutes les cartes P4 du design respectées.

### Phase 7 : fidélité

- Wallet (deux soldes), abonnements (création, rythme, paiement, pause 1 à 4 semaines, arrêt), parrainage dessiné mais caché (`features.ts`).
- **Fin** : cartes P5 respectées.

### Phase 8 : IA

- Consentement IA (texte validé, décision D6), commande vocale (écoute, analyse « Du mot au panier », liste prête, « pas compris »), liste écrite, panier intelligent (dont « Pour un plat »), discussion avec Souki.
- **Signaler une réponse** (règle Play sur le contenu généré par IA) : sur chaque réponse de la discussion et sur les résultats IA ; envoi au back-end (route à créer) ou à l'e-mail de support.
- Version allégée des animations sur entrée de gamme.
- **Fin** : cartes P6 respectées ; signalement fonctionnel.

### Phase 9 : Android système

- Notifications push : `expo-notifications`, FCM (`google-services.json`, décision D3), jeton enregistré côté back-end (tâche B3 de l'iOS, commune aux deux apps). Canaux : Suivi de commande, Abonnements, Compte et sécurité, Nouveautés (désactivé par défaut). Petite icône monochrome.
- Suivi en direct de la livraison (notification de progression d'Android 16, repli en notification classique avant Android 16).
- Raccourcis de l'icône : Catalogue, Commande vocale, Mes commandes, Wallet.
- Liens d'app : `souki.io/produit/…`, `souki.io/r/<code>` ; fichier `/.well-known/assetlinks.json` sur souki.io avec l'empreinte SHA-256 de la clé de signature Play.
- Mise à jour disponible (in-app updates) : facultatif, sinon écran simple vers la fiche Play.
- Widget : v1.1 (décision 6 du design), hors de ce plan.
- **Test** : piste test interne ; notification reçue pour chaque statut ; lien `souki.io/produit/…` ouvert dans l'app.

### Phase 10 : qualité

- Accessibilité : TalkBack sur tous les écrans (libellés, ordre, prix lus correctement, compte à rebours non annoncé chaque seconde), contrastes, 48 dp, texte à 200 %, « Supprimer les animations » (protocole `design-system/test-appareil.md`).
- Appareils : un téléphone d'entrée de gamme (Android 10, 3 Go), 360 × 640 dp, un grand écran ou émulateur pliable, navigation à gestes et à 3 boutons.
- Performance : 60 i/s sur les listes, démarrage à froid mesuré, taille de l'AAB (objectif < 40 Mo), R8 et réduction des ressources.
- Hors ligne et réseau lent (3G simulée) : aucun écran bloqué sans explication.
- Stabilité : suivi des plantages branché ; **rapport de pré-lancement** de la Play Console sans erreur bloquante ; pages de 16 Ko vérifiées.
- **Fin** : aucune anomalie bloquante ; Android vitals sous les seuils sur la piste de test.

### Phase 11 : publication

- Fiche Play en français et en arabe : titre, descriptions (`store-listing/fiche-play.md`), icône 512, image de présentation, 8 captures (refaire l'arabe 04).
- Déclarations : règles de confidentialité, suppression du compte (URL web), sécurité des données (§ 6), classification du contenu, public cible 18+, publicité (non), accès pour l'examen (compte de test), fonctionnalités financières (Wallet = avoir d'achat non retirable, à déclarer avec précision), actualités (non), santé (non).
- Pays : Maroc d'abord.
- Compte personnel : demande d'accès à la production après 14 jours de test fermé avec 12 testeurs ou plus (questionnaire sur le test à remplir).
- Mise en production **progressive** (10 %, 50 %, 100 %) en surveillant les plantages.
- **Fin** : app visible sur Google Play au Maroc.

### Phase 12 : après la publication

- Site souki.io : retirer l'**installation** de la PWA (pas le site) sans supprimer de fichier : désactiver les invitations d'installation, ajouter `related_applications` (Play, `io.souki.app`) et `prefer_related_applications: true` au manifeste pour que Chrome propose l'app Play, remplacer les boutons « Installer » par le badge « Disponible sur Google Play ».
- Les utilisateurs qui ont déjà installé la PWA : bandeau « La nouvelle app SOUKI est sur Google Play ».
- Garder la PWA pour iPhone sans app ? Non : l'iOS a son app App Store ; ajouter le lien App Store au même endroit.

---

## 8. Ce qui dépend du back-end

| # | Besoin | Contrat attendu par l'app | Interrupteur côté app |
|---|---|---|---|
| A1 | Client OAuth Android dans le projet Google Cloud | Aucun code : `/auth/google` accepte déjà le client « Web » ; fournir son identifiant à la build (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) et créer le client Android (SHA-1) | bouton caché tant que l'identifiant manque |
| A2 | Page web de suppression du compte | Fait : site (Paramètres) et `souki.io/politique-confidentialite#suppression` (mentionne l'app Android) | — |
| A3 | Jetons push (B3, commun à l'iOS) | `POST /api/push/appareils` `{ token, plateforme }` (jeton Expo), authentifié ; envoi d'une notification à chaque changement de statut sur le canal `commandes` | `PUSH_TOKEN_REGISTRATION_ENABLED` |
| A4 | Signalement IA | `POST /api/assistant/signalements` `{ surface, motif, contenu }`, authentifié ; à relire par l'admin | `AI_REPORT_ENDPOINT_ENABLED` |
| A5 | Liens d'app | Fait : `/.well-known/assetlinks.json` ; renseigner `ANDROID_APP_SHA256_FINGERPRINTS` (empreinte SHA-256 de la clé de signature Play) sur le serveur du site | — |
| A6 | Heures du suivi | Heure serveur et heure de chaque étape (déjà demandées par le design) | — |
| A7 | Noms de rayon en arabe | Remplir `nom_ar` des rayons dans l'admin (« Fruits de saison » s'affiche en français en arabe) | — |

---

## 9. Actions de l'équipe (impossibles depuis le code)

1. **Compte Google Play** (D1) : création, vérification d'identité, D-U-N-S si organisation ; créer l'app `io.souki.app`.
2. **EAS** : `cd apps/play-store && eas init` (renseigne `EAS_PROJECT_ID`), puis variables et fichiers secrets : `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_SERVICES_JSON`.
3. **Google Cloud / Firebase** : client OAuth Android et clé Maps avec les SHA-1 (clé d'envoi EAS : `eas credentials` ; clé Play : Play Console > Intégrité de l'app) ; projet Firebase.
4. **Première build** : `eas build -p android --profile preview` (APK à installer), puis `--profile production` et `eas submit -p android` (piste interne, brouillon).
5. **Site** : `ANDROID_APP_SHA256_FINGERPRINTS` sur le serveur de souki.io ; le jour de la publication, `NEXT_PUBLIC_ANDROID_APP_PUBLISHED=true`.
6. **Play Console** : fiche (`store-listing/`), sécurité des données (§ 6), classification, public 18+, accès pour l'examen (compte de test), URL de suppression du compte, test fermé si compte personnel, déploiement progressif.

## 10. Risques

| Risque | Effet | Parade |
|---|---|---|
| Compte personnel | 14 jours de test fermé minimum + examen avant la production | décision D1 tout de suite ; test fermé lancé dès la phase 6 |
| Migration du thème (81 fichiers) | écrans à moitié sombres | app en clair tant que `check:theme` n'est pas à zéro |
| Entrée de gamme | animations saccadées, ANR | versions allégées, tests sur un vrai appareil dès la phase 3 |
| Permissions ajoutées par un module | refus à l'examen | contrôle du manifeste à chaque phase |
| Contenu IA | refus ou retrait | signalement + filtrage + texte de consentement clair |
| Divergence avec l'iOS | deux apps qui se contredisent | toute règle métier dans `@souki/shared` ; correctifs métier reportés dans les deux apps |
