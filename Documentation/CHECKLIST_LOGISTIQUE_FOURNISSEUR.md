# Checklist d'exécution — Logistique Fournisseur → Livreur → Client

> Pilotage lot par lot pour l'agent. Détail complet dans
> `INSTRUCTIONS_AGENT_LOGISTIQUE_FOURNISSEUR.md`. Ne lancer un lot que si le précédent
> passe son **critère ✅**.

## Décisions figées (v1)
- 1 commande → 1 fournisseur, résolu par **zone** ; chaque fournisseur porte tout le catalogue.
- Livreurs **répartis entre fournisseurs** selon la charge (≥ 1 par fournisseur).
- Écran admin de gestion des **zones** = prérequis.
- ⏳ Heure de verrouillage : 20h (à confirmer).

## Règle transverse (à respecter dans TOUS les lots)
Fournisseur & livreur = **jour courant + statuts actifs** seulement.
Jours précédents / pending / non livré / aberrant = **admin uniquement**. Jamais de suppression.

---

## Ordre d'exécution

- [x] **0. Migrations** — `Commande.fournisseur_id` ; `Tournee.fournisseur_id/pickup_lat/pickup_lng/ramasse_at` ; SQL + sync schéma.
  - ✅ `compileall` + `configure_mappers()` OK ; colonnes créées au boot.

- [x] **1. Lot E.1 — CRUD zones admin (PRÉREQUIS)** — endpoints `/api/admin/zones` + page `app/admin/zones` + entrée menu.
  - ✅ Créer une zone (centre+rayon) et y rattacher un fournisseur depuis l'admin.

- [x] **2. Lot A — Assignation au verrouillage (20h)** — `fournisseur_resolver` (zone→fournisseur) ; `verrouiller_commandes` fixe `Commande.fournisseur_id` ; notif réelle via `NotificationOutbox` ; (option) JIT régional dans le scheduler.
  - ✅ Après 20h, chaque commande verrouillée a un `fournisseur_id` + 1 notif/fournisseur.

- [x] **3. Lot B — Préparation du jour (fournisseur)** — `GET /api/supplier/preparation` (whitelist jour+statuts) + récap picking ; page `app/supplier/preparation`. **Corriger** `get_supplier_orders` (filtre jour+statuts, fini les `BROUILLON`).
  - ✅ Le fournisseur voit uniquement ses commandes du jour + quantités à préparer par produit.

- [x] **4. Lot C — Dispatch avec ramassage (21h35)** — grouper par fournisseur ; répartir le pool de livreurs selon la charge ; origine = localisation fournisseur ; tri proximité (haversine) ; tournées avec `pickup_*` ; sérialiser le bloc `pickup`.
  - ✅ 1 tournée = 1 fournisseur origine, commandes triées, 1ʳᵉ étape = localisation fournisseur.

- [x] **5. Lot D — Ramassage livreur** — `POST /api/livreur/tournees/{id}/ramassage` (→ `Tournee.ramasse_at`, commandes `EN_ATTENTE_LIVREUR→A_LIVRER`) ; UI livreur affiche le point de ramassage + bouton « J'ai ramassé », livraisons verrouillées tant que non ramassé.
  - ✅ Livreur ramasse puis livre (`A_LIVRER→EN_ROUTE→LIVRE`).

- [x] **6. Lot E.2 — Admin supervision + Backlog/Exceptions** — `GET /api/admin/commandes/exceptions` + page dédiée (jours précédents, pending, échecs, sans fournisseur, aberrants) avec actions de rattrapage ; tournées groupées par fournisseur.
  - ✅ Tout l'anormal apparaît ici et **nulle part ailleurs**.

- [x] **7. Lot F — Tests & vérif** — résolveur, lock pose `fournisseur_id`, dispatch groupé+origine, ramassage, **cloisonnement (règle 1bis)**, bout-en-bout 2 fournisseurs/2 zones, `compileall`+`configure_mappers()`.
  - ✅ Tous les tests verts.

---

## Garde-fous permanents
- Statuts via `changer_statut` uniquement ; aucune transition hors `TRANSITIONS`.
- Jobs scheduler : try/except + rollback par zone/fournisseur, jamais de crash.
- Idempotence dispatch (pas de tournées dupliquées).
- Commande sans fournisseur résolu → backlog admin, jamais d'assignation silencieuse.
- Fuseau `Africa/Casablanca`.
