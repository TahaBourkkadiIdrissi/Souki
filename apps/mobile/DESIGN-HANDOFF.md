# Passation design → code : app iOS SOUKI 2027

Remarques courtes pour l'agent codeur. Le design est dans le design system **SOUKI 2027** :
https://claude.ai/artifact/PW752hkrnMLzXQvEYEriFj (privé : à lire avec l'outil Artifact de Claude Code, compte de Salah eddine).

## 0. Avant de commencer

- Lire dans le design system, dans cet ordre : `project/README.md` (règles de marque), `project/tokens.json` (valeurs), puis la fiche `project/components/<Composant>/README.md` du composant à coder. Le code de référence est dans `project/components/bundle.js` et `bundle.css` ; les écrans sont assemblés dans `screens*.js`, le parcours dans `prototype.js`.
- Ces composants sont écrits **pour le web** (HTML/CSS). Il faut les **traduire** en React Native, pas les copier.
- Respecter `Documentation/regles.md` (ne supprimer aucun fichier, pas de nouvelle dépendance sans accord, etc.) et `apps/mobile/PLAN-IOS.md` (phases).
- Les prix, noms, numéros de commande, codes et soldes des maquettes sont des **exemples** : tout vient de l'API.

## 1. Front-end (apps/mobile)

**F1. Tokens.** Mettre les valeurs de `tokens.json` dans `src/theme.ts` (garder les anciens noms en alias). Changements de rôle à appliquer partout :
- bouton principal = `souki-900` (#005B43), pas `market-600` ;
- `market-600` (#1E8A3C) seulement pour jauges, contours, icônes actives, jamais pour du petit texte blanc ;
- texte sur orange = `ink-900` (foncé), jamais blanc ; texte orange sur clair = `orange-700` ;
- texte secondaire = `ink-500` (#647366), pas #7C8B7D ;
- ombres teintées vert (`shadow-*`), jamais grises.

**F2. Typo.** Poppins 400/600/700/800/900 et Tajawal (déjà installées). Prix et comptes à rebours en chiffres tabulaires. Respecter la taille de texte iOS (pas de hauteur fixe sur du texte).

**F3. Traduction web → React Native** (dépendances déjà présentes) :

| Design system | App iOS |
|---|---|
| `div` / CSS | `View`, `Text`, styles |
| transitions CSS | Reanimated (`withSpring`, `withTiming`), durées `dur-*` |
| `RollingNumber` | `components/animated-digits.tsx` |
| verre (`glass`) | `expo-glass-effect` |
| dégradés | `expo-linear-gradient` |
| `SMotif`, `DeliveryPath`, `OrderSteps` (chemins en S) | `react-native-svg` |
| icônes Lucide | `lucide-react-native` |
| retours haptiques des fiches | `expo-haptics` |
| `TabBar` | `NativeTabs` d'Expo Router |
| `Toggle`, `SortMenu`, `ActionSheet` | `@expo/ui` (Switch, Menu) ou `ActionSheetIOS` / `Alert` |
| `ShareSheet` | `Share.share` de React Native |
| `OtpInput` | un `TextInput` caché avec `textContentType="oneTimeCode"` |
| « Réduire les animations » | `useReducedMotion` de Reanimated |

Dépendances **non installées**, à demander avant d'ajouter : `react-native-maps` (carte de `MapPicker`), `expo-location` (« Me localiser »), `expo-apple-authentication` (Sign in with Apple), `expo-image-picker` (photo de profil, photo de réclamation), `expo-notifications` (push).

**F4. Ordre de travail.** Suivre les priorités du design system : 1 marché (accueil, produits, fiche, panier), 2 compte, 3 commande, 4 après la commande, 5 fidélité, 6 IA. Mettre à jour les composants existants de `src/components` (`product-card`, `quick-add`, `cart-bar`, `home-hero`, `category-rail`, `quantity-stepper`…) plutôt que d'en créer des doublons.

**F5. Accueil.** Les deux assistants (`AssistantCards` : commande vocale + panier intelligent) vont **juste sous l'en-tête**, avant la carte du marché. Ils ouvrent les écrans de la priorité 6 (routes existantes `/api/voice-basket`, `/api/text-basket`, panier intelligent).

**F5 bis. Suggestions par niveau.** Composant `LevelSuggestions` (l'étal à trois étagères) dans le panier (« Complétez votre panier ») et le panier vide ; `LevelTag` sur la fiche produit et les rails de l'accueil (un rail par niveau). Le niveau vient du champ `niveau` (1, 2, 3) des produits ; données : `POST /catalogue/suggestions` (`exclude_ids`, `panier_total`) et le catalogue regroupé par `niveau`. Titres neutres : 1 « Les essentiels », 2 « Pour varier », 3 « Les petits plus » (pas « Les plus commandés »). Un produit ajouté reste visible dans l'étagère jusqu'à la sortie de l'écran.

**F5 ter. Lancement.**
- Écran de lancement iOS : dans `app.config.ts`, remplacer `./assets/brand/submark.png` par `./assets/brand/splash-symbol.png` (fichier ajouté : sac blanc, feuille verte, fond transparent), garder `backgroundColor: "#005B43"` et `imageWidth: 160`. `submark.png` a un fond **blanc** autour de son disque : il fait un carré blanc sur le vert.
- Puis l'intro animée `LaunchIntro` (« Le marché se réveille », ≈ 2,2 s) en surimpression du layout racine, déroulé exact dans sa fiche : une seule fois au démarrage à froid, touchable pour passer, variante nuit 01h–08h (heure `Africa/Casablanca`), « Réduire les animations » = fondu de 200 ms. Reanimated + react-native-svg uniquement (iOS 18+).

**F6. Arabe.** Interface entière en miroir (RTL) ; noms de produits en darija arabe (`nom_ar`) ; chiffres et prix restent en LTR. Écrans de référence : accueil et fiche produit.

**F7. Contenu honnête.** Ne rien afficher qui n'existe pas : pas de « Recharger », « Envoyer », « Premium » dans le Wallet ; pas de note, d'avis ou de réduction. Les entrées vers le **parrainage restent cachées** tant que le crédit n'est pas utilisable de bout en bout.

**F8. À trancher par Salah eddine.** Nom de la mascotte du chat : « Souki » (site) ou « Récolte » (design).

**F9. Contrôle.** Comparer chaque écran avec ceux du design system, sur iPhone 16 Pro (393 × 852) et iPhone SE (375 × 667) ; zones de toucher ≥ 44 pt ; libellés VoiceOver sur les boutons à icône seule ; tester le parcours du prototype de bout en bout.

## 2. Back-end (back-end/)

Suivre le modèle campaign / order_edit (controller → service → DAO, interfaces dans `interfaces/`). Ne jamais modifier une table existante : nouvelle table 1-1 + fichier `sql/AAAA-MM-JJ_*.sql`.

**Existe déjà, à réutiliser tel quel :**
- OTP : `auth_controller.py` (`/verify-otp`, `/resend-otp`) ; connexion Google.
- Compte : `settings_controller.py` (`/profile/photo`, `/sessions`, suppression d'une ou de toutes les sessions, `DELETE /account`, `/wallet`, `/wallet/activate`).
- Commandes : modification et annulation (`order_edit_controller.py`), historique (`commande_controller.py`).
- Réclamations : `POST /api/v1/claims` (livrée, 24 h, 6 motifs, remboursement Wallet).
- Abonnements : `commande_recurrente_controller.py` (créer depuis une commande ou un panier, sauter, pause…).
- IA : `/api/voice-basket`, `/api/text-basket`, assistant `/api/assistant/suggestions` et chat.
- Suggestions : `POST /catalogue/suggestions` (niveaux 2 et 3, choisis pour approcher 300 DH) et `GET /user/suggestions` (favoris et achats d'abord) ; champ `niveau` dans `ProductResponseDTO`.

**À faire (dans l'ordre) :**

- **B1. Sign in with Apple** (obligatoire pour l'App Store dès que Google est proposé) : nouvelle route `/auth/apple` qui vérifie le jeton d'identité Apple, comme la connexion Google. À la suppression du compte, révoquer aussi le jeton Apple.
- **B2. Google sur iOS** : accepter l'identifiant client iOS en plus de celui du web (voir `PLAN-IOS.md`).
- **B3. Notifications push iOS** : aujourd'hui seul le web push existe (`push_controller.py`). Stocker le jeton Expo/APNs de l'appareil et envoyer les notifications (statut de commande, rappels d'abonnement avant 21h).
- **B4. Zone de livraison Fès** : le checkout exige seulement une ville (`checkout_service.py`). Ajouter un contrôle « adresse dans une zone livrée » et une route pour le vérifier avant le checkout (états « hors zone » de l'inscription et du checkout).
- **B5. Photo de réclamation** : `claim_schema.py` ne reçoit pas de photo. Ajouter une photo **optionnelle** par ligne réclamée (stockage comme la photo de profil), dans une nouvelle table liée.
- **B6. « Contacter SOUKI »** (livraison absente ou refusée) : définir le canal (téléphone ou WhatsApp) et l'exposer par l'API ou la config.
- **B7. Wallet à deux soldes** : vérifier que `/wallet` renvoie séparément le crédit offert et les remboursements (le design les affiche séparément).
- **B8. Jeton mobile** : l'app envoie `Authorization: Bearer` (`src/lib/api.ts`), pas de cookie. Vérifier que toutes les routes ci-dessus l'acceptent.
- **B10. Suggestions du niveau 1** : `POST /catalogue/suggestions` ne renvoie que les niveaux 2 et 3. Si l'étagère « Les essentiels » doit venir du serveur (et pas du catalogue filtré côté app, comme le fait le checkout du site), ajouter un paramètre pour inclure le niveau 1.
- **B9. « Recommander »** : pas de route dédiée. Possible côté app avec les lignes de la commande et le catalogue du jour ; une route serait plus propre (prix du jour + disponibilité).

Avant de livrer : `python -m compileall back-end`, `pnpm typecheck`, `pnpm check:boundaries`, `git diff --check`, et le tableau « CHECK FLUSH/COMMIT » demandé par `regles.md`.
