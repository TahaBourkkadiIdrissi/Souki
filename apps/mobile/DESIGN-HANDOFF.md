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

**F5 quater. Analyse vocale.** Entre l'écoute et la liste, l'écran `VoiceAnalysis` (« Du mot au panier ») remplace le simple « Analyse en cours… ». Trois zones : (1) « Vous avez dit », la phrase en texte calme, **sans aucune étiquette ni nom de produit dedans**, seulement une lumière qui la parcourt (groupe en cours en `voice-cyan`, mot hors marché souligné en pointillés orange) ; (2) au centre, le produit compris en vedette, un seul à la fois (photo dans un anneau, nom, quantité · prix), 620 ms par groupe ; (3) en bas, le plateau « Votre panier » qui reçoit une vignette par produit et le total qui roule. À la fin, le plateau s'ouvre en liste complète avec « Ajouter au panier ». État « pas compris » avec exemples et « Écrire ma liste » (`/api/text-basket`). Si `/api/voice-basket` ne renvoie pas le lien mot → produit, le retrouver côté app avec `nom_darija`, `nom_ar` et les alias du catalogue. **Écoute** : `VoiceListening`, même scène (étapes, encart qui se remplit en direct, sphère, bouton « J'ai terminé ») ; une seule vue pour écoute + analyse, sans transition de navigation. **Liste modifiable** : toucher une ligne l'ouvre avec « Retirer » et le sélecteur de quantité (pas du catalogue) ; total et bouton d'ajout recalculés aussitôt, avec les prix du jour du catalogue. La phrase dite s'affiche pendant l'écoute, l'analyse et « pas compris », **pas sur la liste prête** (chaque ligne la cite déjà). Vérifié sur iPhone SE (page « EcranPetit »).

**F5 sexies. Entrée (connexion / inscription).** Composant `AuthFlow` (fiche `project/components/AuthFlow/README.md`), à la place des écrans actuels `(auth)/connexion.tsx` et `(auth)/inscription.tsx` (ne pas supprimer les fichiers : les faire évoluer). Un seul écran : « Continuer avec Apple » (`expo-apple-authentication`, à installer avec accord, route B1), « Continuer avec Google » (connexion Google existante, client iOS B2), « Continuer avec l'e-mail ». E-mail : l'adresse d'abord, puis route B12 → compte existant : mot de passe (`/login`) → accueil ; nouveau : mot de passe + code (`/register` avec seulement e-mail et mot de passe, déjà permis par `UserRegister`, puis `/verify-otp`) → onboarding. Après Apple / Google : `is_new` dans la réponse (à ajouter, voir B12) décide accueil ou onboarding. Ouvrir l'entrée en modal seulement quand un compte est nécessaire (Compte, validation, favori, Wallet) : l'app s'ouvre déjà sur le Marché sans compte. Champs : `textContentType` `emailAddress`, `password`, `newPassword`, `oneTimeCode`.

**F5 quinquies. Onboarding.** Composant `Onboarding` (fiche `project/components/Onboarding/README.md`). Montré une seule fois après la **création** d'un compte (inscription e-mail + code validé, ou première connexion Google / Apple qui crée le compte), jamais après une simple connexion : nouvelle route `/bienvenue` (plein écran, sans onglets), « vu » mémorisé avec `writeItem("souki.onboarding.v1", "1")` de `src/lib/device-storage.ts`. Étapes : Bienvenue + langue, puis **seulement ce qui manque** (`missing`) parmi prénom, adresse, téléphone, chacune avec « Plus tard », puis 3 écrans sur le service (« Passer » → accueil). Aujourd'hui `AuthService.google_login` crée l'utilisateur avec l'e-mail seul : prénom, adresse et téléphone manquent (voir B11). Une information remise à plus tard est redemandée là où elle sert : bandeau « Ajoutez votre adresse pour commander » sur l'accueil, et le checkout (le back-end exige téléphone, adresse et ville). Enregistrer les réponses avec les routes existantes du profil et de l'adresse. **Pas de demande de notifications dans l'onboarding** : un écran d'explication puis la demande iOS après la 1re commande validée (quand B3 et `expo-notifications` existent).

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
- **B11. Prénom Google / Apple** : `google_login` ne garde que l'e-mail. Enregistrer aussi `given_name` / `family_name` du jeton Google (et le nom donné par Apple à la 1re connexion, qu'Apple ne renvoie plus ensuite) pour que l'onboarding saute l'étape « Prénom ».
- **B12. Compte existant ou nouveau** : nouvelle route `POST /auth/check-email` → `{ exists, has_password, providers }` pour l'écran « Votre e-mail » (limiter le débit, comme l'OTP, pour éviter qu'on teste des adresses en masse). Et renvoyer `is_new: true` dans les réponses de `/auth/google` et `/auth/apple` quand le compte vient d'être créé, pour envoyer vers l'onboarding.
- **B9. « Recommander »** : pas de route dédiée. Possible côté app avec les lignes de la commande et le catalogue du jour ; une route serait plus propre (prix du jour + disponibilité).

Avant de livrer : `python -m compileall back-end`, `pnpm typecheck`, `pnpm check:boundaries`, `git diff --check`, et le tableau « CHECK FLUSH/COMMIT » demandé par `regles.md`.
