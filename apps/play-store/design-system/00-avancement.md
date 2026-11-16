# Avancement

Mise à jour : 16 novembre 2026, itération 10. États : *à faire*, *en cours*, *à valider*, *validé*.

## Itération 10 : prototype complet

- Les onglets **Produits** (tout le catalogue de l'exemple, ajout au panier, fiche produit), **Commandes** (commande en cours après une validation, « Suivre » vers le suivi ; historique vide ; commande passée avec « Recommander » qui remet les produits au panier aux prix du jour) et **Compte** (profil, adresse, sécurité, notifications ; « Thème » et « Langue » changent vraiment l'app ; « Se déconnecter » ramène à l'entrée) sont cliquables dans le prototype, en français et en arabe, en clair et en sombre.
- Le bouton vocal flottant est étendu sur l'accueil et réduit sur le catalogue (décision 3).
- Vérifié en parcourant chaque onglet : aucun texte français oublié en arabe.

## Itération 9 : fin de l'étape 4 (couverture complète)

Nouvelles cartes, chacune en clair, en sombre et en arabe (textes repris du code : `orders.ts`, `loyalty.ts`, `rules.ts`, `plats-marocains.json`) :

- **`ScreenOrderIssues` (P4)** : historique vide ; incidents « Livraison refusée » et « Retour au dépôt » sur le gabarit de « Destinataire absent » (message officiel, étapes en « S » avec l'étape en incident, Appeler et WhatsApp) ; commande « Annulée » (rien à payer, « Recommander le même panier »).
- **`ScreenSubscriptionStates` (P5)** : abonnement suspendu avec sa raison réelle (« Paiement à la livraison bloqué pour ce compte. ») et qui contacter ; arrêt en deux temps (dialogue) ; la liste après l'arrêt, avec la snackbar « Abonnement arrêté. ».
- **`ScreenAssistantDish` (P6)** : panier intelligent « Pour un plat » : choisir parmi les plats marocains, nombre de personnes ; résultat du zaalouk (5 ingrédients sur 8 au marché, les 3 autres nommés en haut et listés « Pas vendu par SOUKI ») ; un plat peu couvert (tajine de poulet) dit clairement qu'il demande surtout des produits que SOUKI ne vend pas.
- **`ScreenCheckoutStates` (P3)** : changer d'adresse (feuille), nouvelle adresse sur la carte, « Pourquoi demain ? » (la date n'est pas un choix : livraison le lendemain, seule l'heure se choisit), marché fermé pendant la commande (panier gardé, bouton « Validation dès 08h00 » avec le compte à rebours, livraison décalée).
- **`ScreenScale2` (P3)** : checkout et suivi en petit écran (360 × 640 dp), à 130 % en arabe et à 200 %.
- **`ScreenKeyboard` (P2)** : clavier ouvert : e-mail (le compte du téléphone proposé), code (pavé numérique, « Coller »), recherche, liste écrite (suggestions en darija). Le bouton principal reste au-dessus du clavier ; le clavier ne se met jamais en miroir en arabe.
- **`ScreenTablet2` (P7)** : largeur moyenne : panier en deux volets (liste, récapitulatif collé) et commandes en liste et détail.
- **Fiches de composants** : `Slider` (curseur du budget), `OrderCard` (carte de commande), `ListRow` (ligne de liste et groupe).

Corrections dans le kit, appliquées à tous les écrans (tous refaits) :
- **Texte à 200 %** : les étapes en « S » avaient une hauteur fixe et leurs libellés se chevauchaient. Au-delà de 120 %, elles deviennent un trait droit et prennent la hauteur de leur texte.
- **Arabe** : un texte traduit dans une zone de chiffres s'affichait mélangé (« 1 4 · كيلو DH » sur la commande vocale, d'où le défaut de la capture Play 04). La zone passe de droite à gauche quand elle est traduite. Les heures du suivi sont alignées du bon côté ; les numéros de commande s'écrivent « الطلب رقم 1042 ».

## Itération 8 : passe arabe (fin de l'étape 4, première partie)

Où suivre le travail : ce design system (https://claude.ai/artifact/75jEKoiQ23PV9h5sUXbj4a) et le prototype animé (https://claude.ai/artifact/TBHG8WS9pgxUPr3nVSDZz9), tous deux sur le compte de Salah eddine ; les mêmes fichiers sont recopiés dans `apps/play-store/design-system/` du dépôt.

- **Écrans en arabe : vérifiés un par un.** Chaque écran a été rendu en arabe et chaque texte français restant a été listé. Il n'en reste presque aucun : sur 70 textes signalés, 64 sont des prix, des unités, des e-mails, des noms d'appareils ou de marque, qui restent en caractères latins comme prévu (chiffres et prix de gauche à droite). Les 6 vrais oublis sont corrigés dans `kit/ar.json` : les heures du checkout et de la commande validée s'écrivent « 10:00 » (et non « 10h00 »), les prénoms du parrainage sont en arabe (« نادية », « ياسين »). `ScreenCheckoutAr`, `ScreenOrderDoneAr` et `ScreenWalletAr` sont refaits.
- **Prototype en arabe : vérifié écran par écran**, en clair et en sombre (lancement, accueil, fiche, panier, entrée, onboarding, commande validée, suivi, commande vocale). Aucun texte français oublié. Deux défauts corrigés : le numéro de commande restait « n° 1042 » (il devient « رقم 1042 », dans le bon sens), et la feuille de connexion Google restait affichée par-dessus les autres écrans quand on changeait d'écran depuis le panneau « Aller à ».
- **Captures Google Play en arabe** : déjà en thème clair. Un défaut d'affichage repéré sur la capture 04 (commande vocale) : « 1 4 · كيلو DH » au lieu de « 1 كيلو · 4 DH ». À refaire avec la prochaine série de captures.

## Ce qui a changé dans l'itération 7

Plan d'amélioration en cinq étapes, validé : 1. photographie, 2. unification, 3. moments signature animés, 4. couverture complète, 5. test sur appareil.

- **Étape 1, photographie (faite)** : les 32 photos du site sont détourées et cadrées de la même façon, posées sur `photo-bg` avec une ombre commune ; brief complet de la séance photo dans la section **Photographie** (direction, livrables, liste des 25 produits du catalogue et des images d'ambiance).
- **Étape 2, unification (faite en partie)** : un seul kit pour tous les écrans ; six fiches de composants Material 3 avec leurs états, en clair et en sombre ; maquettes alignées sur le catalogue réel (noms, unités, format des prix sans « ,00 »).
- **Aperçus** : tous les écrans sont pré-rendus en HTML statique et s'affichent dans la page.
- **Étape 3** : prototype animé « SOUKI Android · Moments signature » (https://claude.ai/artifact/TBHG8WS9pgxUPr3nVSDZz9, copie de travail de Salah eddine ; original de Taha : https://claude.ai/artifact/KnQY7Ea2EwMZKw7dQtRnFG). **Validée** : nouvelle animation d'entrée « Le chemin du marché ».
- **Étape 4, couverture** : sombre partout (cartes `…Dark`), largeur moyenne (`ScreenTablet`, `ScreenTablet2`), P7 (`ScreenSystem`), P8 (fiche Google Play, fichiers dans `apps/play-store/store-listing/`), arabe partout (itération 8), états manquants (itération 9). **Faite**, sauf la capture Play 04 à refaire.

## Décisions

| # | Question | Décision |
|---|---|---|
| 1 | Police | **validé** : Instrument Sans + IBM Plex Sans Arabic. |
| 2 | Thème sombre | **validé** : dès la v1. |
| 3 | Bouton vocal flottant | **validé** : accueil (étendu) et catalogue (réduit). |
| 4 | Tablettes et pliables | **validé** : comportement en largeur moyenne en v1, écrans dédiés en v1.1. |
| 5 | Mascotte | **validé** : « Souki ». |
| 6 | Widget | **validé** : v1.1, dessiné dans P7. |
| 7 | Boutons en coins de 12 dp | **validé**. |

## Fondations

| Élément | État |
|---|---|
| Couleurs, formes, espaces, élévation, typographie | validé |
| Mouvement, états, haptique | à valider sur appareil |

## Écrans

| Lot | Écrans | État |
|---|---|---|
| P0 | Démarrage, intro, icônes | à valider |
| P1 | Accueil, catalogue, fiche, panier et ses états, favoris, états communs, tailles | à valider |
| P2 | Entrée, mot de passe, code, onboarding, compte, réglages, suppression | à valider |
| P3 | Checkout (clair français, sombre arabe), compte restreint, demande de levée | à valider |
| P3 | Changer d'adresse, nouvelle adresse, date fixée expliquée, marché fermé pendant la commande ; petit écran et texte à 200 % | à valider |
| P3 | Commande validée, explication puis demande système des notifications | à valider |
| P4 | Historique : en cours, passées | à valider |
| P4 | Suivi : en route, incident « destinataire absent » avec appel et WhatsApp | à valider |
| P4 | Historique vide ; incidents « livraison refusée », « retour au dépôt » ; commande annulée | à valider |
| P4 | Gérer (feuille), modifier, annuler (dialogue), recommander | à valider |
| P4 | Réclamation : produits, motif et photo, succès, délai dépassé | à valider |
| P5 | Wallet : clair, sombre arabe, vide | à valider |
| P5 | Abonnements : liste, détail, pause, création | à valider |
| P5 | Abonnement suspendu (avec sa raison), arrêter, après l'arrêt | à valider |
| P5 | Parrainage (caché au lancement) | à valider |
| P6 | Consentement IA ; commande vocale : écoute (arabe), analyse, liste prête, pas compris | à valider |
| P6 | Liste écrite, panier intelligent (réglages, résultat), discussion avec Souki | à valider |
| P6 | Panier intelligent « Pour un plat » : choix, ce que SOUKI ne vend pas, plat peu couvert | à valider |
| P2 | Clavier ouvert : e-mail, code, recherche, liste écrite | à valider |
| P7 | Notifications, suivi en direct, widget, raccourcis, mise à jour disponible | à valider |
| P7 | Largeur moyenne : catalogue, fiche, panier en deux volets, commandes en liste et détail | à valider |
| P8 | Fiche Google Play | à valider (capture arabe 04 à refaire depuis `ScreenVoiceAr`, corrigé) |

## Ce qui manque encore

- **Capture Play 04 en arabe** : à refaire depuis `ScreenVoiceAr` (corrigé dans cette itération). La source des captures n'est pas dans le dépôt (seulement les PNG).
- **Test sur appareil** (étape 5) et TalkBack.

L'intro en mouvement, le retour prédictif, la feuille de connexion Google et l'analyse vocale en mouvement sont dans le prototype animé.

## Composants

| Composant | État |
|---|---|
| Button, ProductCard, MarketCard, NavigationBar, OrderStatus | à valider |
| TextField, SearchAndChips, Selection, TabsAndSnackbar, SheetAndDialog, ProgressAndMenu (clair et sombre, avec états) | à valider |
| CartLine, FreeDeliveryGauge, OrderSteps, MarketHeader, VoiceScene, SkeletonsAndEmpty | à valider |
| Slider (curseur), OrderCard (carte de commande), ListRow (ligne de liste et groupe) | à valider |

## Questions ouvertes

- **Compte restreint** : le texte de la raison et la forme de la demande de levée (message libre) sont des hypothèses.
- **Annulation** : ce que devient le crédit Wallet utilisé n'est pas écrit ; à préciser avec le back-end.
- **Remboursement d'une réclamation** : montré comme immédiat ; à confirmer (immédiat ou après vérification).
- **Suivi** : les heures de chaque étape supposent que le back-end les fournit. Aucun nom de livreur n'est affiché.
- **Numéros de commande** : le format « n° 1042 » est un exemple.
- **Photos** : détourées, mais toujours sans fruits ni herbes, et l'oignon photographié est jaune alors que le catalogue vend des oignons rouges. La séance photo règle les trois. **Mascotte** : fond blanc opaque, non utilisée en sombre.
- Sessions, changement d'e-mail, durée du code : hypothèses de l'itération 3, toujours à confirmer.
- **Parrainage** : le montant (« 20 DH » dans les maquettes) vient du back-end (`credit_par_filleul`) ; l'exemple est fictif.
- **Wallet** : le partage entre « Remboursements » et « Crédit offert » suppose que le back-end distingue les deux soldes.
- **Abonnements** : la commande « la veille avant 01h00, aux prix du jour » et l'arrêt « sans frais, effet immédiat » sont des hypothèses à confirmer.
- **IA** : le texte du consentement ne dit rien de la conservation des enregistrements ; la page « Comment nous traitons ces données » est à rédiger avec le juridique.
- **Panier intelligent** : budget de 50 à 500 DH dans la maquette ; le code n'a qu'une valeur par défaut (150 DH). Bornes à confirmer.
- Vérifié dans un navigateur, pas encore sur appareil ni avec TalkBack.

## Prochaine itération

Le design est complet pour la v1 (étapes 1 à 4). Reste l'étape 5 : test sur un vrai téléphone Android d'entrée de gamme et avec TalkBack (protocole dans **Test sur appareil**), à faire par l'équipe sur un appareil, puis les corrections qui en sortent. En parallèle : refaire la capture Play 04 en arabe, organiser la séance photo (section **Photographie**) et trancher les **Questions ouvertes** avec le back-end.
