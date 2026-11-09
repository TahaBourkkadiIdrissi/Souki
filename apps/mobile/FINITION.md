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
| E29 | Panier intelligent | Fermé : le back-end n'utilise pas `panier_id` au checkout, il n'y a rien à lier. |

## 2. Écarts gardés volontairement

| # | Écran | Écart | Pourquoi |
|---|---|---|---|
| E8 | Panier | « Valider la commande » sans montant | Demande de Salah eddine : même logique que le site et la PWA. |
| E21 | Wallet | Pas d'activation du Wallet avec mot de passe | Aucune fonction de l'app n'en a besoin : le Wallet se crée seul au premier crédit. |
| E26 | Abonnements | Contenu modifié dans l'écran de l'abonnement | Même logique que le site. |
| E30 | Discussion avec Souki | Pas de bouton micro dans le champ | La dictée du clavier iOS fait ce travail. |
| E31 | Discussion avec Souki | Conversation gardée pendant la session de l'app | Comme le site. |

## 3. Écarts qui attendent le back-end

| # | Écran | Écart | Tâche back-end |
|---|---|---|---|
| E11 | Checkout, adresse | Hors de Fès : avertissement, pas de blocage | B4 : contrôle de la zone de livraison |
| E13 | Checkout, paiement | Carte CMI « Bientôt » | Paiement CMI |
| E15 | Réclamation | Pas de photo par ligne | B5 : photo de réclamation (l'app a déjà `expo-image-picker`) |
| E20 | Recommander | Calculé dans l'app | B9 : route « Recommander » |
| E24 | Wallet, historique | Pas de « Commande N-… » sous les mouvements | `commande_id` dans la transaction |
| E27 | Commande vocale | Pas de transcription en direct | Transcription en continu |

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
- À faire : numéro de déclaration ou d'autorisation CNDP dans la politique, une fois obtenu ; accord explicite avant d'envoyer des données à une IA externe (règle Apple 5.1.2(i)).
