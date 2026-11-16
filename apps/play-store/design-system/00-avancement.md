# Avancement

Mise à jour : 16 novembre 2026, itération 7. États : *à faire*, *en cours*, *à valider*, *validé*.

## Ce qui a changé dans cette itération

Plan d'amélioration en cinq étapes, validé : 1. photographie, 2. unification, 3. moments signature animés, 4. couverture complète, 5. test sur appareil.

- **Étape 1, photographie (faite)** : les 32 photos du site sont détourées et cadrées de la même façon, posées sur `photo-bg` avec une ombre commune ; brief complet de la séance photo dans la section **Photographie** (direction, livrables, liste des 25 produits du catalogue et des images d'ambiance).
- **Étape 2, unification (faite en partie)** : un seul kit pour tous les écrans ; six fiches de composants Material 3 avec leurs états, en clair et en sombre ; maquettes alignées sur le catalogue réel (noms, unités, format des prix sans « ,00 »).
- **Aperçus** : tous les écrans sont pré-rendus en HTML statique et s'affichent dans la page.
- **Étape 3** : prototype animé « SOUKI Android · Moments signature » (https://claude.ai/artifact/KnQY7Ea2EwMZKw7dQtRnFG). **Validée** : nouvelle animation d'entrée « Le chemin du marché ».
- **Étape 4, couverture (en cours)** : sombre partout (cartes `…Dark`), largeur moyenne (`ScreenTablet`), P7 (`ScreenSystem`), P8 (fiche Google Play, fichiers dans `apps/play-store/store-listing/`). Reste : l'arabe partout, y compris le prototype.

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
| P3 | Commande validée, explication puis demande système des notifications | à valider |
| P4 | Historique : en cours, passées | à valider |
| P4 | Suivi : en route, incident « destinataire absent » avec appel et WhatsApp | à valider |
| P4 | Gérer (feuille), modifier, annuler (dialogue), recommander | à valider |
| P4 | Réclamation : produits, motif et photo, succès, délai dépassé | à valider |
| P5 | Wallet : clair, sombre arabe, vide | à valider |
| P5 | Abonnements : liste, détail, pause, création | à valider |
| P5 | Parrainage (caché au lancement) | à valider |
| P6 | Consentement IA ; commande vocale : écoute (arabe), analyse, liste prête, pas compris | à valider |
| P6 | Liste écrite, panier intelligent (réglages, résultat), discussion avec Souki | à valider |
| P7 | Notifications, suivi en direct, widget, raccourcis, mise à jour disponible | à faire |
| P8 | Fiche Google Play | à faire |

## Ce qui manque encore sur P0 à P6

- P3 et P4 en arabe et en sombre au-delà du checkout et de la commande validée ; petit écran et texte à 200 %.
- Historique vide ; les incidents « Livraison refusée », « Retour au dépôt » et « Annulée » (même gabarit que « Destinataire absent », textes de `orders.ts`).
- Changement d'adresse et de date dans le checkout ; marché fermé pendant le checkout.
- L'intro en mouvement, le retour prédictif, les écrans avec clavier ouvert, la feuille système de Google.
- **Largeur moyenne** (600 à 840 dp) pour les écrans principaux : décidée pour la v1, pas encore dessinée.
- P5 et P6 en sombre et en arabe au-delà du Wallet et de l'écoute vocale ; abonnement suspendu ou arrêté ; panier intelligent « par plat ».
- L'analyse vocale en mouvement (la lumière qui parcourt la phrase, 620 ms par groupe) : image fixe seulement.
- Prototype cliquable.

## Composants

| Composant | État |
|---|---|
| Button, ProductCard, MarketCard, NavigationBar, OrderStatus | à valider |
| TextField, SearchAndChips, Selection, TabsAndSnackbar, SheetAndDialog, ProgressAndMenu (clair et sombre, avec états) | à valider |
| Sans fiche : ligne de liste, étapes en « S », jauge, carte de commande, scène vocale, squelette | en cours |
| Curseur, fiches des composants SOUKI restants | à faire |

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

Fin de l'étape 4 : passe de traduction arabe de tous les écrans et du prototype animé, captures arabes refaites en clair. Puis étape 5 : test sur un vrai téléphone Android d'entrée de gamme.
