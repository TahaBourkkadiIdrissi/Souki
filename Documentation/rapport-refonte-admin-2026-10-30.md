# Rapport — Refonte UX/UI du dashboard admin SOUKI

Date : 30 octobre 2026 — Analyse seule, aucun code modifié.

Sources : code des 12 pages admin et de leurs API (`apps/admin`, `back-end`), historique git, `Documentation/rapport_homogeneisation_backoffice.md`, `Documentation/dashboard.md`, `Documentation/changement-horraire.md`, `regles.md`, guide « View transitions » de Next 16 (`node_modules/next/dist/docs`). L'admin en ligne n'a pas été vu (connexion requise) : une revue visuelle reste à faire.

---

## 1. Corrections de ma première analyse

J'ai vérifié le « pourquoi » de chaque comportement. Cinq points que j'avais présentés comme des défauts sont en réalité voulus :

| Ce que j'avais dit | Ce qui est vrai | Conséquence |
|---|---|---|
| Le dispatch fusionne plusieurs livreurs dans une colonne | La fusion n'a lieu qu'en **mode fournisseur** (un point de ramassage servi par plusieurs livreurs). En production `SOUKI_ENABLE_SUPPLIERS=0` (`docker-compose.yml:14`) : chaque tournée a sa propre colonne (clé `fournisseur-inconnu-{id}`). | Garder les deux modes. Le défaut réel est ailleurs (voir §3). |
| Statuts « hors liste » (`EN_ATTENTE_LIVREUR`, `REFUS_LIVREUR`, `RETOUR_DEPOT`, `PLANIFIEE`) | Ils existent bien dans le dispatch et la machine d'états (`dispatch_service.py:31-40`, `commande_state_machine.py`). C'est la règle 48 de `regles.md` qui est incomplète. | Mettre à jour la règle 48, pas l'écran. |
| « Commandes du jour » mélange jour et lendemain | Voulu : les commandes passées de 08h à 23h59 sont livrées le lendemain. L'endpoint lit `date_livraison` entre aujourd'hui et demain (`commande_dao.py:117`). | Garder les deux jours, mais les **séparer visuellement**. |
| Le dispatch n'affiche que le jour courant | Règle métier : le back-end ne sert et ne réassigne que les tournées du jour (`dispatch_controller.py:34-44`, `dispatch_service.py` « Seules les tournées du jour peuvent être réassignées »). | Un historique ne peut être qu'en **lecture seule**, avec un nouvel endpoint. |
| « Lancer JIT » dans l'en-tête est une erreur | C'est le **secours manuel** du job de 01h00, protégé (bouton désactivé si des commandes sont déjà verrouillées, double exécution bloquée par `JITAlreadyExecutedError`). | Garder la fonction, la déplacer dans une page JIT dédiée. |

---

## 2. Ce qu'il faut garder (et pourquoi)

| Élément | Pourquoi le garder |
|---|---|
| KPI du dashboard avec période, variation et graphiques Recharts | Logique de comparaison soignée (`dashboard.md`), filtre BROUILLON, anti-duplication. |
| Fiche client à 6 onglets | Règle 50. Riche et déjà réutilisée dans les commandes. |
| Confirmation COD groupée par client | Un seul appel par client pour plusieurs commandes. |
| Aperçu JIT + confirmation avant exécution, déverrouillage | Sécurité du lot de 01h00. |
| Dispatch automatique après le JIT, réassignation limitée au jour, résolution des retours dépôt | Logique métier correcte (seules les commandes `VERROUILLEE` entrent en tournée, BUG-004). |
| Exceptions / Backlog (raisons `JOUR_PRECEDENT`, `ECHEC_LIVRAISON`, `ABERRANT`…) | Filet de sécurité opérationnel. |
| Style des pages Campagnes et Abonnements | Tableaux, filtres et `AlertDialog` cohérents. |
| Briques déjà installées : Radix (Dialog, AlertDialog, Tabs), `sonner` (Toaster déjà monté dans `app/layout.tsx:8`), Recharts, `mapbox-gl`, `tw-animate-css` | Aucune nouvelle dépendance n'est nécessaire. |

---

## 3. Vrais problèmes, classés par gravité

### Logique et données

| # | Problème | Preuve | Pourquoi c'est important |
|---|---|---|---|
| L1 | **Les KPI du dashboard sont calculés sur `date_commande`**, y compris le CA « livrées uniquement ». Avec le modèle « commande avant minuit = livraison le lendemain », le CA et les livraisons d'« Aujourd'hui » sont quasi nuls. | `dashboard_dao.py:168, 186, 219` | Le chiffre le plus regardé est trompeur. **À valider avec vous** : CA livré et taux de livraison sur `date_livraison`, commandes passées et nouveaux clients sur `date_commande`. |
| L2 | La marge brute utilise le prix de gros **actuel** (`prix_gros_saisi`), pas celui du jour de la commande. | `dashboard_dao.py:258` | La marge des périodes passées change quand on modifie un prix. À afficher comme « estimation » tant qu'il n'y a pas d'historique de prix. |
| L3 | **« Générer le dispatch » ignore les alertes renvoyées par l'API** : `commandes_sans_livreur`, `available_livreurs`, `fournisseurs_sans_livreur`, `commandes_sans_coordonnees_fournisseur`, `retours_depot`. Seuls deux compteurs sont affichés. | `livreur/page.tsx:302` vs `dispatch_service.py:240-252` | Si aucun livreur n'est disponible, l'admin croit que tout est assigné. |
| L4 | **La disponibilité des livreurs décide du dispatch, mais aucun écran ne permet de la changer.** Pas de liste, pas de création, pas de statistiques livreur. | `livreur_dao.py:147-155` (`disponible = true` requis) | Aujourd'hui il faut passer par la base pour retirer un livreur absent. |
| L5 | **« Marchandise périmée – Annuler » s'exécute sans confirmation** (annulation en perte, irréversible). | `livreur/page.tsx:605` | Un clic de trop = commande perdue. |
| L6 | Données renvoyées mais jamais affichées : statut et distance de la tournée, téléphone et véhicule du livreur, créneau, mode de paiement, téléphone et produits de chaque commande ; `livreurs_disponibles` au dashboard. | `dispatch_service.py:737-805`, `dashboard_dao.py:135` | Le livreur et l'admin doivent appeler ou ouvrir d'autres pages. |
| L7 | Le suivi en direct existe côté back-end (WebSocket `/admin/ws/deliveries` + ticket, et `GET /admin/deliveries/changes`) mais **l'admin ne s'en sert pas**. Nginx ne transmet pas l'en-tête `Upgrade` (`infra/nginx/proxy.conf`). | `admin_controller.py:88, 145, 267` | Le dispatch ne montre pas l'avancement réel. Le polling de `/deliveries/changes` marche sans toucher à Nginx. |
| L8 | Texte client « Payez à la porte, confirmation appel la veille », alors que les appels COD portent sur les commandes **du jour**, après le verrouillage de 01h00 (alerte à 07h00). | `checkout/page.tsx:100, 1104`, `commande_dao.py:575` | À clarifier : changer le texte ou le processus. |

### Navigation et cohérence

| # | Problème | Preuve |
|---|---|---|
| N1 | Quatre façons de construire une page : menu commun (dashboard, catégories, campagnes, parrainage, abonnements, pricing), menu propre (commandes, blacklist), **aucun menu** (clients, livreurs, zones, exceptions). | En-têtes de chaque `page.tsx` |
| N2 | La liste du menu est recopiée dans 5 fichiers et a divergé. « Gestion Produits & Prix » et « Pricing » mènent à la même page. | `produits/page.tsx` redirige vers `/admin/pricing` |
| N3 | La police Poppins est déclarée (`--font-sans`, `globals.css:87`) mais **jamais chargée dans l'admin** (pas de `next/font`, pas de fichiers). L'admin s'affiche dans la police système. | `app/layout.tsx:17` |
| N4 | Notifications et fenêtres faites maison (livreurs) alors que `Toaster` et `Dialog` existent. | `livreur/page.tsx` |
| N5 | Commandes : pas de colonne ni d'onglet de date, filtre de statut en codes bruts, seule vue groupée par client, titre « Gestion des Commandes » répété 3 fois, emoji dans l'alerte COD. | `orders/page.tsx:1879` |
| N6 | Accents manquants (« Generer », « Tournees », « renseignee », « Jour precis », « Deconnexion »…), vocabulaire « Inspections » / « Retour dépôt ». | Plusieurs pages |
| N7 | Fichiers énormes : commandes 2 800 lignes (5 vues), pricing 1 200, blacklist 1 080. | — |

---

## 4. Direction artistique

Objectif : un outil de pilotage **dense, lisible et rapide**, aux couleurs SOUKI, qui ne ressemble pas à un template.

- **Police** : Poppins auto-hébergée comme sur le client (`next/font/local`, déjà fourni par Next, aucune dépendance). Chiffres tabulaires pour les montants.
- **Couleurs** : vert `#1E8A3C` pour l'action principale et le positif ; orange `#F07C00` pour « à traiter » ; rouge seulement pour le risque et le destructif ; bleu `#1A4F8A` pour l'information (en route). Un seul fond de page.
- **Cadre** : barre latérale fixe (vert SOUKI, compacte, repliable en icônes), en-tête de page avec fil d'Ariane, actions à droite, filtres collants au défilement.
- **Composants** : en-tête de page, carte KPI (valeur, variation, mini-courbe), tableau (tri, filtres, sélection, état vide, chargement), badge de statut à partir d'**une seule** table de libellés, panneau latéral de détail, fenêtre de confirmation à deux niveaux (normal / destructif), notifications `sonner`.
- **Densité** : deux modes, confortable et compact, pour les longues listes.
- **Accessibilité** : contrastes AA, focus visibles, navigation clavier dans les tableaux.

---

## 5. Animations et transitions

Next 16.3 gère `<ViewTransition>` de React **sans configuration** (guide officiel). Sans support du navigateur, rien ne casse : les animations sont simplement absentes.

| Effet | Où | Comment |
|---|---|---|
| Fondu-glissé du contenu entre pages | Toutes les pages | Le cadre (menu, en-tête) reste fixe, seule la zone de contenu change. |
| Sens de navigation | Menu (vers le haut ou vers le bas selon l'ordre), détail (avant / arrière) | `transitionTypes` sur `<Link>` (Next 16.2+). |
| Élément partagé qui se transforme | Carte KPI → page détaillée ; ligne de commande → panneau de détail ; carte livreur → fiche livreur | `<ViewTransition name=…>`. |
| Squelette → contenu | Toutes les listes | `<Suspense>` + `<ViewTransition>`. |
| Micro-interactions | Apparition en cascade des lignes, compteurs KPI animés, barres de progression des tournées, changement de statut en direct (flash discret) | CSS (`tw-animate-css` déjà installé). |

Règles : 150 à 250 ms, courbes douces, **toutes désactivées avec `prefers-reduced-motion`**, jamais d'animation qui retarde une action.

---

## 6. Plan page par page

| Page | Refonte proposée |
|---|---|
| **Connexion** | Même identité visuelle, messages d'erreur clairs. |
| **Dashboard** | Bandeau « À traiter maintenant » cliquable : COD non confirmés, exceptions, retours dépôt, commandes sans livreur, abonnements en échec, statut du JIT. Puis KPI métier (selon la décision L1), livreurs disponibles et tournées, graphiques actuels. |
| **Commandes** (nouvelle découpe) | Onglets **Aujourd'hui / Demain**, liste simple ou groupée par client au choix, filtres (statut lisible, paiement, créneau, récurrente, blacklist), panneau latéral de détail avec la fiche client. |
| **COD** (sortie des commandes) | File d'appels par client, progression, confirmation / annulation, alerte de 07h00. |
| **JIT** (sorti des commandes) | Aperçu, lancement avec confirmation, déverrouillage, journal. Le lancement quitte l'en-tête. |
| **Dispatch** | Sélecteur de date (historique en lecture seule) ; bandeau d'avancement (planifiées, en route, livrées, absentes, refus, COD à encaisser) ; **une carte par tournée et par livreur** avec arrêts ordonnés, téléphone, véhicule, progression ; carte Mapbox des arrêts colorés par statut ; « Déplacer vers… » avec la charge de chaque livreur ; panneau « À traiter » pour les retours dépôt avec confirmation ; « Générer le dispatch » avec **affichage de toutes les alertes** (L3) ; mode fournisseur conservé. |
| **Livreurs** (nouvelle) | Liste (nom, téléphone, véhicule, disponibilité modifiable, tournée du jour), fiche livreur avec statistiques 7 / 30 jours (taux de livraison, absences, refus, COD encaissé, note) et historique. |
| **Exceptions** | Dans le cadre commun, filtres par raison, actions avec confirmation. |
| **Clients + fiche** | Dans le cadre commun, recherche et pagination serveur, panneau latéral. |
| **Blacklist** | Dans le cadre commun, logique inchangée (logs `t_client_blacklist_logs`). |
| **Pricing / Produits** | Un seul lien de menu, tableau dense, édition en ligne, formulaire produit (votre `product-create-dialog.tsx`, non commité). |
| **Catégories, Parrainage, Campagnes, Abonnements** | Dans le cadre commun, peu de changements. |
| **Zones** | Choix du centre et du rayon **sur une carte Mapbox** au lieu de saisir latitude et longitude. |
| **404 / erreurs** | Mêmes couleurs, bouton de retour. |

---

## 7. Back-end nécessaire

Tout en nouveaux fichiers, sans toucher `livreur_dao.py` ni `livreur_service.py` (règle 34) :

1. **Livreurs admin** : liste, modification de la disponibilité et du véhicule, statistiques par période.
2. **Tournées par date** en lecture seule (historique du dispatch).
3. **Dashboard** : option de calcul sur `date_livraison` si vous validez L1.
4. **Infra (optionnel)** : en-têtes `Upgrade` / `Connection` dans Nginx pour le WebSocket ; sinon polling de `/admin/deliveries/changes`.

---

## 8. Décisions à prendre

1. **Règles 14 à 17** (ne pas modifier `useState`, `useEffect`, gestionnaires, appels API) : dérogation nécessaire pour les pages refondues.
2. **Règle 48** : ajouter `EN_ATTENTE_LIVREUR`, `REFUS_LIVREUR`, `RETOUR_DEPOT` à la liste des statuts.
3. **Règle 51** : le nouveau cadre devient la référence de style à la place de `/admin/orders`.
4. **L1** : sur quelle date calculer chaque KPI du dashboard.
5. **L8** : texte « confirmation appel la veille » ou processus.
6. **Suivi en direct** : polling (sans infra) ou WebSocket (modification Nginx).

---

## 9. Ordre de réalisation

| Phase | Contenu |
|---|---|
| 0 — Fondations | Cadre commun (menu unique avec permissions et compteurs), police, couleurs, composants partagés, transitions de page, corrections de textes et du doublon de menu. Toutes les pages passent dans le cadre sans changer leur logique. |
| 1 — Dispatch et Livreurs | Endpoints livreurs et historique, page Dispatch, page Livreurs, alertes de génération, confirmation des annulations, suivi en direct. |
| 2 — Commandes, COD, JIT | Découpe en trois pages. |
| 3 — Dashboard | Bandeau « À traiter », KPI selon la décision L1. |
| 4 — Finitions | Clients, blacklist, pricing, zones (carte), exceptions, revue visuelle complète. |
