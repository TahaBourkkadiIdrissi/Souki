# Plan : de la PWA SOUKI à l'app iOS

Objectif : reprendre toute la PWA (`apps/client`), mais **repensée pour iOS**, pas recopiée.
Règle d'Expo (skill `expo-web-to-native`) : *si une capture de l'écran natif pourrait passer pour
la version web, c'est un simple habillage ; il faut redessiner jusqu'à ce qu'on croie l'écran fait par Apple.*

Tout se développe et se teste dans **Expo Go (SDK 58)**, sans compte Apple, sauf ce qui est marqué 🔒
(il faudra une build de développement EAS, donc un compte Apple Developer).

## 1. Ce que contient la PWA aujourd'hui

| Page PWA | Taille | API utilisées |
|---|---|---|
| Accueil `/` | 800 lignes | `/api/catalogue`, `/api/user/suggestions` |
| Catalogue `/catalogue` | 2 600 lignes | `/api/catalogue`, `/catalogue/categories`, `/catalogue/suggestions`, `/manual-basket`, `/order-schedule` |
| Fiche produit (sheet + `/produit/[slug]`) | 400 | `/api/catalogue` |
| Panier (tiroir + barre collante) | dans catalogue | local + `/api/manual-basket` |
| Checkout `/checkout` | 1 350 | `/api/user/bootstrap`, `/api/checkout`, `/api/paniers/{id}`, blacklist |
| Connexion / inscription / OTP / mot de passe oublié | 1 300 | `/auth/login`, `/auth/register`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password` |
| Historique `/historique` + suivi + modifier | 550 | `/api/commandes/historique`, `/commandes/{id}`, `/modification`, `/annuler`, `/api/v1/claims` |
| Wallet `/wallet` | 620 | `/api/user/wallet`, `/wallet/activate` |
| Parrainage `/parrainage` | 320 | `/api/user/parrainage`, `/generate` |
| Abonnements `/abonnements` | 270 + composant | `/api/commandes-recurrentes/*`, `/api/paniers-souki` |
| Favoris `/favoris` | 200 | `/api/user/favorites` |
| Paramètres `/parametres` (compte, notifications, sécurité, sessions) | 750 | `/api/user/profile`, `/profile/photo`, `/address`, `/notifications`, `/security/change-password`, `/sessions`, `DELETE /api/user/account`, push web |
| Onboarding | 230 | `/api/user/onboarding` |
| IA : panier intelligent, plats, commande vocale, mascotte | 1 000+ | `/api/paniers/generer`, `/paniers/plats`, … |
| Pages PWA uniquement : `pwa-welcome`, `offline`, guide d'installation iOS | — | aucune → **inutiles dans l'app** |
| À propos, FAQ, politique de confidentialité | — | statiques → lignes de réglages + lien web |

Côté back-end, c'est déjà prêt pour le mobile :
- `/auth/login` et `/auth/google` renvoient `access_token` dans la réponse, et toutes les routes acceptent `Authorization: Bearer`.
- La suppression de compte existe (`DELETE /api/user/account`), et Apple l'exige (règle 5.1.1(v)).

## 2. Les choix « feel iOS »

| PWA (web) | App iOS |
|---|---|
| Barre de navigation du bas en HTML + menu « Plus » | **NativeTabs** (vraie barre d'onglets iOS, effet verre « Liquid Glass » sur iOS 26) : **Marché · Panier · Commandes · Compte** |
| En-têtes de page | **Grands titres** iOS qui se réduisent au défilement, **barre de recherche native** dans l'en-tête du catalogue |
| Tiroirs, modales, fiche produit en « sheet » HTML | **Feuilles natives** (`@expo/ui` BottomSheet / formSheet), checkout en modale plein écran |
| Puces de rayons, filtres | **SegmentedControl** natif / menus contextuels (appui long sur un produit : favori, ajouter, partager) |
| Paramètres (formulaires) | Écrans façon **Réglages iOS** (`@expo/ui` List, Switch, Picker) |
| Sélecteur d'heure HTML | **DateTimePicker** natif (roue iOS) |
| Toasts | **Retour haptique** + bannière discrète (`expo-haptics`) |
| Icônes Lucide | **SF Symbols** (`expo-symbols`) |
| `<img>` | `expo-image` (cache, fondu) |
| Bouton « rafraîchir » | **Tirer pour rafraîchir** |
| Carte Mapbox (« Me localiser ») | `expo-location` + **Apple Plans** (`react-native-maps`) |
| Partage du code parrainage | **Feuille de partage iOS** (WhatsApp, SMS…) |
| Saisie OTP | Remplissage auto du code SMS (`oneTimeCode`) |
| localStorage | `expo-sqlite/kv-store` (panier, récents), Trousseau iOS (jeton) |
| Animations CSS | Reanimated + gestes (balayer pour supprimer du panier, transition « zoom » de la carte produit vers sa fiche) |

Bibliothèques à ajouter (toutes compatibles avec Expo Go SDK 58) : `@expo/ui`, `expo-symbols`, `expo-image`,
`expo-haptics`, `expo-glass-effect`, `react-native-reanimated`, `react-native-gesture-handler`,
`@tanstack/react-query` (cache des données + rafraîchissement), `expo-sqlite`, `expo-location`, `react-native-maps`.

Inchangé : français par défaut, arabe standard en option (RTL), darija seulement pour les noms de produits (`nom_ar`),
mêmes règles (minimum 50 DH livraison comprise, 15 DH ou offerte dès 300 DH, commandes 08h–01h), pas de faux avis.
Le code partagé passe par `@souki/shared` (types, règles, traductions).

## 3. Les phases

**Phase 0 : fondations.** Onglets natifs, couleurs et typographie SOUKI, composants de base
(carte produit, bouton, ligne de liste), cache des données, panier enregistré sur le téléphone, langue FR/AR.

**Phase 1 : le marché.** Accueil (produits du jour, rayons, compte à rebours avant la clôture de 01h00),
catalogue (recherche, rayons, tri), fiche produit (quantité au pas kg/lot/pièce), panier (balayer pour supprimer, total,
livraison, minimum 50 DH), favoris.

**Phase 2 : le compte.** Connexion e-mail/téléphone + mot de passe, inscription, code OTP, mot de passe oublié,
profil et photo, adresse, sessions, langue, **suppression du compte**, déconnexion. Google → phase 7 🔒.

**Phase 3 : la commande.** Checkout en étapes (adresse + localisation, créneau, paiement à la livraison ou Wallet,
récapitulatif), fermeture 01h–08h, restriction COD (blacklist), confirmation avec retour haptique.

**Phase 4 : après la commande.** Historique, suivi de livraison, modifier ou annuler avant 01h00,
« Signaler un problème » avec photo (appareil photo / galerie), recommander.

**Phase 5 : fidélité.** Wallet (deux soldes), parrainage (partage natif), abonnements (pause, sauter, reprendre).

**Phase 6 : l'IA SOUKI.** Panier intelligent, plats/recettes, commande vocale (micro), mascotte.

**Phase 7 : le natif avancé 🔒** (build de développement EAS, compte Apple). Connexion Google native, **Sign in with Apple**,
notifications push (APNs), raccourcis sur l'icône de l'app, et éventuellement une Live Activity pour suivre la livraison
sur l'écran verrouillé.

## 4. Changements back-end à prévoir (rien sans ton accord)

1. **Google sur iOS** : le back-end ne vérifie le jeton Google que pour l'identifiant client web. Il faudra accepter aussi l'identifiant client iOS (phase 7).
2. **Sign in with Apple** : nouvelle route `/auth/apple` (phase 7).
3. **Notifications push** : stocker le jeton Expo/APNs de l'appareil (aujourd'hui, seul le web push est géré) (phase 7).

Phases 0 à 6 : **aucun changement back-end**, l'app utilise les routes existantes.
