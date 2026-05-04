# Rapport - Homogeneisation du Back-Office SOUKI

## Objectif

Rendre l'ensemble du back-office plus homogene, professionnel et maintenable, en alignant les pages admin sur le niveau visuel et ergonomique de `/admin/orders` : structure claire, tableaux coherents, badges lisibles, actions explicites et etats loading/error propres.

## Constats principaux

### Front-end

- La page `/admin/orders` sert de meilleure reference actuelle : cards blanches, bordures grises, ombres legeres, tableaux `bg-gray-50`, badges arrondis et boutons d'action bien differencies.
- Certaines pages admin peuvent encore avoir des styles disperses : espacements, titres, boutons, empty states et toolbars pas toujours identiques.
- La couleur principale SOUKI est bien definie dans `app/globals.css` via `--green-market: #1E8A3C`.
- Les composants shadcn/ui disponibles permettent de standardiser : `button`, `card`, `table`, `badge`, `dialog`, `alert-dialog`, `select`, `input`, `tabs`, `skeleton`, `spinner`.

### Back-end

- L'architecture MVC2 est claire : controllers -> services -> DAOs -> entities/DTOs.
- Les permissions RBAC existent et doivent rester la source unique d'autorisation.
- Certaines donnees BO dependent de logs metier. Exemple : la blacklist affiche les logs `t_client_blacklist_logs`, pas seulement `t_clients.is_blacklisted`.
- Les etats historiques peuvent manquer de logs si la logique a ete ajoutee apres coup. Cela peut creer des ecarts entre la realite en base et l'affichage BO.

## Changements front potentiels

| Priorite | Changement | Impact |
|---|---|---|
| Haute | Creer un pattern commun de page admin : top bar sticky, KPI bar, sidebar/tabs, section cards | Homogeneite immediate sur toutes les pages BO |
| Haute | Standardiser les tableaux : header gris, `px-4/px-6`, `divide-y`, hover subtil | Lecture plus professionnelle et coherente |
| Haute | Standardiser les boutons d'action : primaire vert, danger rouge, secondaire blanc | Actions plus previsibles |
| Moyenne | Centraliser les empty states et skeleton loaders | Moins de duplication et meilleure experience utilisateur |
| Moyenne | Harmoniser les badges de statut, paiement, blacklist, livraison | Reconnaissance visuelle rapide |
| Moyenne | Ajouter des toolbars coherentes : recherche, filtres, actualisation | Navigation plus fluide |
| Basse | Ajouter des micro-transitions homogenes | Interface plus polie sans changer la logique |

## Changements back potentiels

| Priorite | Changement | Impact |
|---|---|---|
| Haute | Ajouter des endpoints BO dedies aux vues complexes au lieu de recomposer cote front | Pages plus rapides et plus fiables |
| Haute | Ajouter ou completer les logs metier manquants pour les donnees historiques | Evite les listes vides ou incoherentes |
| Haute | Normaliser les DTOs de reponse admin : `items`, `total`, `stats`, `filters` | Front plus simple et plus stable |
| Moyenne | Standardiser les erreurs API : `message`, `code`, `details` | Error states plus propres |
| Moyenne | Ajouter pagination/filtrage serveur sur les grandes listes | Performance BO |
| Moyenne | Documenter les permissions RBAC par page admin | Maintenance plus sure |
| Basse | Ajouter endpoints de KPI par module | Evite des calculs fragiles cote front |

## Pages a aligner visuellement

| Page | Action recommandee |
|---|---|
| `/admin/orders` | Garder comme reference design |
| `/admin/blacklist` | Deja redesign : continuer a verifier les donnees back |
| `/admin/livreur` | Aligner top bar, cards, tableaux, actions |
| `/admin/produits` | Harmoniser toolbar, table, badges stock/prix |
| `/admin` dashboard | Clarifier les KPIs et raccourcis admin |

## Recommandations design system

- Utiliser `#1E8A3C` pour les actions principales et les etats positifs SOUKI.
- Utiliser orange `#F07C00` pour les alertes metier non bloquantes.
- Utiliser rouge uniquement pour les risques, refus, blocages ou actions destructives.
- Garder les cards en `rounded-2xl border border-gray-200 bg-white shadow-sm`.
- Garder les tableaux avec :
  - `thead`: `bg-gray-50 border-b border-gray-200`
  - `th`: `px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`
  - `tbody`: `divide-y divide-gray-100`
  - `tr`: `hover:bg-gray-50 transition-colors duration-100`

## Recommandations data/back-office

- Chaque action admin importante doit produire un log exploitable en BO : qui, quand, quoi, pourquoi.
- Les pages BO ne doivent pas dependre uniquement d'un flag si une trace historique est attendue.
- Prevoir des scripts de backfill lors de l'ajout de nouvelles tables de logs.
- Les endpoints BO devraient retourner les champs deja prets pour l'affichage : label client, statut lisible, dates, badges possibles, compteurs.

## Roadmap courte

1. Aligner toutes les pages admin sur le layout `/admin/orders`.
2. Creer des composants internes reutilisables : `AdminPageHeader`, `AdminKpiCard`, `AdminTable`, `AdminEmptyState`.
3. Ajouter pagination et filtres serveur sur les listes longues.
4. Auditer les logs metier existants et backfiller les donnees historiques critiques.
5. Documenter les permissions RBAC et les endpoints utilises par chaque page.

## Point d'attention blacklist

La page blacklist s'appuie sur `t_client_blacklist_logs`. Si des clients ont `is_blacklisted = true` mais aucun log `BLACKLISTED`, ils ne remontent pas dans la liste BO. Il faut soit backfiller les logs historiques, soit adapter temporairement l'endpoint pour inclure les anciens cas sans log.
