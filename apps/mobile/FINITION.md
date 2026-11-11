# Finition : ce qui reste à régler dans l'app iOS

Liste tenue à jour à chaque phase. Les 6 phases du design system SOUKI 2027 sont codées
(marché, compte, commande, après la commande, fidélité, IA). Mise à jour du 9 novembre 2026,
après le passage sur les écarts (E).

## 1. Écarts réglés

| # | Écran | Ce qui a été fait |
|---|---|---|
| E1 | Mot de passe | **Décision : on garde 3 règles** (8 caractères, majuscule, chiffre), comme le site et le back-end. Écart accepté. |
| E3 | Inscription | Champ « Code de parrainage » facultatif, comme le site. Confirmé par Salah eddine. |
| E4 | Compte | Wallet, Parrainage et Abonnements affichés (Compte > Fidélité). Confirmé par Salah eddine. |
| E5 | Profil | Photo de profil modifiable : appareil photo ou Photos, recadrage carré, JPEG de 2 Mo au plus (`expo-image-picker`, validé). |
| E9 | Accueil, catalogue | Les cartes des assistants ouvrent les écrans IA de l'app. |
| E12 | Checkout | La demande de levée de restriction s'écrit dans une feuille native ; le checkout relit l'état au retour. |
| E16 | Réclamation réussie | Bouton « Voir mon Wallet ». |
| E17 | Recommander | « Répéter automatiquement » (abonnement depuis la commande). |
| E18 | Historique | Appui long sur une carte : aperçu et menu natif (Suivre, Gérer, Signaler, Recommander). |
| E19 | Gérer ma commande | Les lignes se retirent en balayant, comme dans le panier (action VoiceOver « Supprimer »). |
| E22 | Parrainage | « Copier » copie directement le code, coche et « Copié » pendant 1,6 s (`expo-clipboard`, validé). |
| E23 | Abonnements | Feuille « Mettre en pause » avec les dates de reprise en boutons (dans 1 à 4 semaines). |
| E25 | Parrainage | Couronne de légumes du design system dans l'en-tête (`assets/illustrations/couronne-legumes.webp`). |
| E28 | Commande vocale | Le brouillon vocal est lié à la commande (`brouillon_vocal_id`), comme sur le site. |
| E14 | Suivi, incident | Carte « Contacter SOUKI » (Appeler, WhatsApp avec le numéro de commande) quand le client est absent, la livraison refusée ou la commande retournée au dépôt. Numéro +212 7 03 43 39 54 dans `packages/shared/src/contact.ts`, aussi sur la politique de confidentialité du site. |
| E15 | Réclamation | Photo facultative par produit (`PhotoSlot`), envoyée après la réclamation. Le serveur vérifie le vrai format, refuse les images géantes, réencode en JPEG sans métadonnées (ni EXIF ni GPS), réduit à 1600 px, range dans un bucket Supabase privé `reclamations` sans écrasement ; l'admin la lit par URL signée de 5 min. Aucune table modifiée. |
| E20 | Recommander | Route `GET /api/commandes/{id}/recommander` (prix et disponibilité du jour, propriétaire vérifié) ; l'app retombe sur le catalogue si la route ne répond pas. |
| Voix | Commande vocale | Refaite selon `VoiceListening` + `VoiceAnalysis` (design du 9 novembre 2026) : une seule scène (étapes, « Vous avez dit », sphère, plateau), écoute dès l'ouverture, analyse « Du mot au panier » groupe par groupe (620 ms), produit en vedette, plateau qui se remplit, liste prête modifiable (quantité, « Retirer ») sans l'encart de la phrase, « pas compris » avec exemples et « Écrire ma liste ». Tailles réduites sur iPhone SE. Lien mot → produit retrouvé dans la phrase (`packages/shared/src/voice.ts`). « Ajouter au panier » remplace « Aller au checkout » : le brouillon vocal reste lié à la commande (`lib/voice-draft.ts`). |
| Onboarding | Après l'inscription | Codé selon `Onboarding` (design du 10 novembre 2026) : route `/bienvenue`, une seule fois après la création du compte (fin du code d'inscription), « vu » gardé avec `souki.onboarding.v1`. Bienvenue + langue, seulement les informations manquantes (prénom, adresse, téléphone, chacune avec « Plus tard »), trois écrans sur le service, chemin du « S » avec le camion, glisser pour changer d'étape. Scènes dessinées sur un canevas mis à l'échelle (iPhone SE compris) : aucun texte ne déborde, même en arabe. Réponses enregistrées à la fin (`updateProfile`, `updateAddress`). En développement : Compte > « Revoir l'onboarding (dev) » montre toutes les étapes sans rien enregistrer. |
| Entrée | Connexion / inscription | Codée selon `AuthFlow` / `EcranEntree` (design du 10 novembre 2026) : un seul écran (scène du marché, « Continuer avec Apple » noir en premier, Google, e-mail, politique de confidentialité). E-mail : l'adresse d'abord (`POST /auth/check-email`, B12) → compte existant : mot de passe → accueil ; nouveau : tout se fait dans l'onboarding (`/bienvenue?email=`) — bienvenue + langue, prénom et nom, adresse sur la carte (obligatoire : le serveur exige la position pour créer le compte, zone de Fès), téléphone (« Plus tard »), mot de passe (règles, parrainage replié) → le compte est créé avec tout → code reçu par e-mail (validé au 6e chiffre) → trois écrans sur le service → accueil. `inscription.tsx` redirige vers ce parcours. Un numéro de téléphone (compte créé sur le site) va directement au mot de passe. Apple et Google : boutons faits mais masqués pour la publication (`SOCIAL_LOGIN_ENABLED = false` dans `src/lib/features.ts`) tant que B1 / B2 ne sont pas branchés : l'App Store refuse un bouton qui ne marche pas (règle 2.1). La déconnexion ramène à l'entrée. Fichiers gardés et modifiés : `connexion.tsx` (entrée), `inscription.tsx` (« Créons votre compte »), `verification.tsx` (code) ; nouveaux : `email.tsx`, `mot-de-passe.tsx`. |
| Session | Toute l'app | Le client reste connecté jusqu'à « Se déconnecter » : le jeton (24 h) est renouvelé au lancement et au retour dans l'app (`POST /auth/refresh`) tant que la session est active (déconnexion, « Déconnecter tous les appareils » ou suppression du compte la ferment) et moins de 30 jours après son expiration. « Se souvenir de moi » supprimé (toujours mémorisé dans le Trousseau). |
| E29 | Panier intelligent | Fermé : le back-end n'utilise pas `panier_id` au checkout, il n'y a rien à lier. |

## 2. Écarts gardés volontairement

| # | Écran | Écart | Pourquoi |
|---|---|---|---|
| E8 | Panier | « Valider la commande » sans montant | Demande de Salah eddine : même logique que le site et la PWA. |
| E21 | Wallet | Pas d'activation du Wallet avec mot de passe | Aucune fonction de l'app n'en a besoin : le Wallet se crée seul au premier crédit. |
| E26 | Abonnements | Contenu modifié dans l'écran de l'abonnement | Même logique que le site. |
| E30 | Discussion avec Souki | Pas de bouton micro dans le champ | La dictée du clavier iOS fait ce travail. |
| E24 | Wallet, historique | Pas de « Commande N-… » sous les mouvements | Décision de Salah eddine (9 novembre 2026) : pas nécessaire, et il faudrait une colonne dans `t_transactions_wallet`. |
| Niveaux | Panier (« Complétez votre panier »), fiche produit | Pas de « Niveau 1/2/3 » ni de pastille numérotée : seulement les titres neutres (Les essentiels, Pour varier, Les petits plus) | Demande de Salah eddine (9 novembre 2026) : le niveau ne se montre pas au client. |
| Lancement | Animation d'ouverture | Ni promesse ni pastille d'état du marché : seulement l'animation et le logo | Demande de Salah eddine (10 novembre 2026). |
| E31 | Discussion avec Souki | Conversation gardée pendant la session de l'app | Comme le site. |

## 3. Écarts qui attendent le back-end

| # | Écran | Écart | Tâche back-end |
|---|---|---|---|
| E11 | Checkout, adresse | Hors de Fès : avertissement, pas de blocage | B4 : contrôle de la zone de livraison |
| E13 | Checkout, paiement | Carte CMI masquée (`CARD_PAYMENT_ENABLED = false`, `src/lib/features.ts`) : paiement à la livraison seulement | Paiement CMI |
| E27 | Commande vocale | Pendant l'écoute, l'encart « Vous avez dit » attend la fin (« Vos mots s'affichent ici ») ; la phrase apparaît à l'analyse | Transcription en continu |

## 4. Écarts qui attendent la build native (EAS + compte Apple Developer)

| # | Écran | Écart |
|---|---|---|
| E2 | Connexion, inscription | Sign in with Apple et Google (et routes B1, B2) |
| E6 | Mot de passe oublié | Lien de réinitialisation ouvert dans l'app (liens universels) |
| E7 | Notifications | Notifications push (B3, `expo-notifications`) |

## 5. iOS récents (iOS 26 et plus)

Demande de Salah eddine (9 novembre 2026) : le natif sur les versions récentes d'iOS, le rendu
dessiné restant sur iOS 18. Il n'y a pas d'iOS 19 à 25 : Apple est passé d'iOS 18 à iOS 26.

- Verre natif (Liquid Glass) sur iOS 26 là où le design met du verre : barre d'onglets, mini-barre panier, barre d'achat de la fiche, en-têtes compacts, dock du checkout. `GlassView` derrière `isLiquidGlassAvailable()`, rendu dessiné actuel sur iOS 18 (`NATIVE_GLASS` est aujourd'hui forcé à `false`).
- `NativeTabs` + `BottomAccessory` sur iOS 26 (version gardée sous le nom `NativeTabsLayout`), dock dessiné sur iOS 18 (E10).
- Boutons de la barre du haut en verre natif sur iOS 26 (`Stack.Toolbar`), boutons ronds dessinés sur iOS 18.
- Tester sur un iPhone ou un simulateur iOS 26 (build EAS), l'iPhone de test étant sur iOS 18.

## 6. À vérifier sur l'iPhone

**Vérification du code (9 novembre 2026)** : aucun bouton sans libellé VoiceOver ; les positions gauche/droite sont symétriques ou dans des blocs forcés de gauche à droite (coupon de parrainage, curseur d'heure, tracés) ; aucune largeur fixe plus grande que l'iPhone SE. Reste à regarder sur l'appareil ou le simulateur :

- Photos produit sur fond blanc : `mixBlendMode: multiply` (`ProductImage variant="inset"`).
- Écrans sur iPhone SE (375 × 667) et iPhone 16 Pro (393 × 852), VoiceOver sur les boutons à icône seule (F9).
- Arabe (RTL) sur les nouveaux écrans : compte, checkout, confirmation, fidélité, IA.

## 7. Bugs connus

- **Réglé (9 novembre 2026, avec l'accord de Salah eddine, règle 14)** : favoris rechargés à chaque connexion, déconnexion ou changement de compte, avec une liste par compte et une pour l'invité, comme `useFavorites.ts` du site (`src/contexts/favorites-context.tsx`).
- **Réglé (9 novembre 2026)** : commande vocale et photo de profil. Le `fetch` global du SDK 58 (celui d'Expo) refuse les fichiers `{ uri }` ; l'envoi passe par `postLocalFile` (XMLHttpRequest de React Native) dans `src/lib/api.ts`.
- **Réglé (9 novembre 2026)** : écran « Commande validée » qui plantait (Reanimated refuse la chaîne `cubic-bezier(...)`, remplacée par `cubicBezier()`).
- **Réglé (9 novembre 2026)** : « Suivre ma commande » ouvrait le suivi sans retour quand l'onglet Commandes n'avait jamais été ouvert (pile créée sans la liste). Navigations d'un onglet à l'autre avec `withAnchor` (suivi, Wallet, Abonnements, Favoris) et retour de secours dans toutes les piles d'onglets (`src/navigation/header-fallback.tsx`).
- Option : le back-end pose encore son cookie de session lors d'une connexion depuis l'app (inutile, l'app l'ignore avec `credentials: "omit"`).

## 8. Back-end

- **Réglé (9 novembre 2026, avec l'accord de Salah eddine)** : `settings_service.py` ne crée plus de `LocalSession()` ni de requête. Session ouverte par `get_settings_service()` dans `settings_controller.py`, requêtes dans `dao/settings_dao.py` (flush seulement), commit/rollback dans le service, interfaces `ISettingsDao` et `ISettingsService`. Routes et réponses inchangées. Test `tests/test_settings_profile_names.py` adapté, à lancer dans le conteneur du back-end.
- **Suppression du compte (9 novembre 2026)** : la suppression ne faisait que désactiver le compte (e-mail et téléphone bloqués, données gardées). Elle anonymise maintenant le compte (App Store 5.1.1(v), loi 09-08) : e-mail et téléphone libérés, identité, adresses, photo, sessions, abonnements, favoris, push et codes OTP effacés ou arrêtés ; commandes, Wallet, réclamations, liste noire et parrainage gardés. Bloquée tant qu'une commande est en cours. Script `back-end/sql/2026-11-09_anonymisation_comptes_supprimes.sql` pour les comptes supprimés avant (à lancer à la main), test `tests/test_settings_account_deletion.py`. À faire avec B1 : révoquer le jeton Apple à la suppression. À ajouter dans la politique de confidentialité : ce qui est gardé après suppression et pourquoi.
- Tâches B1 à B10 de `DESIGN-HANDOFF.md` (voir sections 3 et 4).

## 9. Publication (9 novembre 2026)

- Icône App Store 1024 × 1024 px sans transparence : `assets/brand/app-icon-1024.png` (sac de l'écran de lancement sur `souki-900`), branchée dans `app.config.ts`. Visible à partir de la build EAS (Expo Go garde sa propre icône).
- Politique de confidentialité du site : section « Supprimer votre compte » (ce qui est effacé, ce qui est gardé et pourquoi) et prestataires techniques dans « Partage » (Google Gemini, Groq, Resend, Supabase).
- Accord pour les assistants IA (règle Apple 5.1.2(i)) : feuille `accord-ia` avant le premier usage de la commande vocale, du panier intelligent ou de la discussion (une fois par compte, retirable dans Compte > Assistants IA et données).
- À faire : numéro de déclaration ou d'autorisation CNDP dans la politique, une fois obtenu ; bucket `reclamations` à créer (`back-end/sql/2026-11-09_reclamations_private_bucket.sql`).
- Admin : page « Réclamations » (`apps/admin/app/admin/reclamations/page.tsx`, menu Clients, permission `orders.read`) : chiffres des 30 jours, 100 dernières réclamations, filtres « À vérifier » et « Avec photo », photo en lien signé de 5 min, fiche client. Route `GET /api/v1/admin/claims`.

## 10. Onboarding : à faire plus tard

- Bandeau « Ajoutez votre adresse pour commander » sur l'accueil quand l'adresse a été remise à plus tard (utile seulement pour les comptes Google / Apple, qui n'existent pas encore dans l'app : l'inscription par e-mail donne déjà prénom, adresse et téléphone). Le checkout redemande déjà adresse et téléphone.
- B11 : garder le prénom donné par Google / Apple pour sauter l'étape « Prénom ».
- Demande de notifications après la 1re commande validée (pas dans l'onboarding), avec B3 et `expo-notifications`.

## 11. Entrée : à faire

- B1 Sign in with Apple (`expo-apple-authentication`, avec accord) et B2 Google sur iOS : brancher les boutons puis passer `SOCIAL_LOGIN_ENABLED` à `true` et renvoyer `is_new` (B12) pour choisir accueil ou onboarding.
- Pas de page « Conditions d'utilisation » sur le site : les mentions citent seulement la politique de confidentialité.

## Publication App Store (11 novembre 2026)

- Retiré : la ligne « Revoir l'onboarding (dev) » du Compte et le mode démo de l'onboarding (`?demo=`).
- Masqué par drapeau (`src/lib/features.ts`) : Apple / Google (`SOCIAL_LOGIN_ENABLED`) et la carte CMI (`CARD_PAYMENT_ENABLED`). Le code reste, il suffit de passer le drapeau à `true` une fois branché.
- `app.config.ts` : version 1.0.0, icône 1024 px, manifeste de confidentialité (`ios.privacyManifests`, pas de pistage), textes d'autorisation précis (position pendant l'utilisation, micro, photos, appareil photo). Retirés : position en arrière-plan, mouvement, précision temporaire, Face ID (non utilisés).
- `NSLocalNetworkUsageDescription` vient d'`expo-dev-client` : il est retiré automatiquement des builds Release (profil `production`).
