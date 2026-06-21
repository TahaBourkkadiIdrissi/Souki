# Instructions agent — Chaîne logistique Fournisseur → Livreur → Client

> À donner à l'agent codeur. Conception du flux : **après le verrouillage du soir,
> chaque fournisseur reçoit ses commandes du jour à préparer ; les livreurs ramassent
> chez le fournisseur (sa localisation) et livrent selon la localisation du client.**
> Intégré à l'existant (FastAPI + APScheduler + Next.js + PostgreSQL).

---

## 0. État réel du code (déjà vérifié — à réutiliser, ne pas réécrire)

**Cycle de vie commande** (`services/commande_state_machine.py`) :
```
BROUILLON → EN_ATTENTE → CONFIRMEE → VERROUILLEE → EN_ATTENTE_LIVREUR → A_LIVRER → EN_ROUTE → LIVRE/ABSENT/REFUS/RETOUR_DEPOT
```
`changer_statut(session, commande, nouveau_statut, actor_id, reason)` est le **seul**
point d'entrée pour changer un statut (génère un `DeliveryEvent`, incrémente
`status_version`). Toute nouvelle transition doit passer par `TRANSITIONS`.

**Planificateur** (`services/scheduler_service.py`, fuseau `Africa/Casablanca`) :
- 18h00 : alerte COD.
- **20h00 : JIT** (`job_agregation_jit` → `JITService.executer_job_jit`) → agrège +
  **verrouille** les commandes du jour (`EN_ATTENTE/CONFIRMEE → VERROUILLEE`).
- **21h35 : Dispatch** (`job_dispatch_daily` → `DispatchService.generate_daily_routes(demain)`).

**Dispatch actuel** (`services/dispatch_service.py`) : prend les commandes `VERROUILLEE`,
récupère les livreurs disponibles, **trie par coordonnées du CLIENT** et **répartit à
parts égales** (`_split_equally`). ⚠️ Aucune notion de **point de ramassage** ni de
**fournisseur** : la tournée n'a pas d'origine. C'est le cœur à faire évoluer.

**Zones** (`entities/zone_jit_entity.py`, `services/zone_resolver.py`) :
`ZoneJIT(nom_ville, lat_centre, lng_centre, rayon_km, fournisseur_id, actif)`.
`resoudre_zone(lat, lng, zones)` rend la zone contenant un point (haversine).
Le JIT régional (`executer_job_jit_regional`) agrège par zone et appelle
`notifier_fournisseur(zone, resultat)` — mais c'est un **stub** (log) et il **n'est pas
branché au scheduler** (le scheduler utilise la version globale).

**Fournisseur** (`entities/fournisseur_entity.py`) : possède `latitude`, `longitude`,
`ville`, `address` → utilisable comme **origine de ramassage**.

**Tournée** (`entities/tournee_entity.py`) : `livreur_id`, `date_tournee`, `statut`,
`distance_totale_km`, `commandes` (triées par `ordre_passage`). Pas d'origine/pickup.

**Commande** : a déjà `livreur_id`, `tournee_id`, `ordre_passage`. **Pas** de
`fournisseur_id`.

---

## 1. DÉCISION D'ARCHITECTURE (DÉCIDÉE)

**Modèle v1 : « 1 commande → 1 fournisseur expéditeur », résolu par ZONE, et on
suppose que chaque fournisseur propose TOUT le catalogue.**

- **Hypothèse v1 (validée)** : un fournisseur peut servir n'importe quel produit. Donc
  **aucun filtrage par produit n'est nécessaire** pour la logistique : le fournisseur de
  la zone du client prépare toute la commande. (Le modèle `FournisseurProduit` reste pour
  le catalogue/prix, mais n'intervient pas dans l'assignation logistique en v1.)
- À chaque client correspond une **zone** (`ZoneJIT`) selon ses coordonnées ; la zone
  porte le fournisseur responsable (`ZoneJIT.fournisseur_id`).
- Au verrouillage, on fige le fournisseur expéditeur sur la commande
  (`Commande.fournisseur_id`) = fournisseur de la zone du client. **C'est l'unique règle
  d'assignation** : un point de ramassage par commande.

*Évolution future (hors v1)* : lever l'hypothèse « tout le catalogue » et éclater un
panier multi-fournisseurs en sous-commandes (une par fournisseur). À garder en tête, ne
pas coder maintenant.

> **Garde-fou** : si la zone d'un client n'a pas de `fournisseur_id` (ou client hors de
> toute zone), prévoir un fournisseur par défaut (config) **ou** marquer la commande
> « non assignable » → file admin (Lot E). Ne jamais planter le job.

---

## 1bis. RÈGLE TRANSVERSE OBLIGATOIRE — Cloisonnement des vues

> **Principe** : pour ne pas figer le travail du fournisseur ni du livreur, leurs
> interfaces ne montrent que le **flux propre du jour courant**. Toute commande
> ancienne, en attente non validée, non livrée, ou au statut anormal **n'apparaît que
> dans l'interface admin**. L'admin est le **seul** filet de rattrapage.

### Partition des statuts

| Vue | Filtre exact (whitelist) |
|-----|--------------------------|
| **Fournisseur** (`/supplier/*`) | `fournisseur_id == moi` **ET** `date_commande == aujourd'hui` **ET** `statut ∈ {VERROUILLEE, EN_ATTENTE_LIVREUR, A_LIVRER}` |
| **Livreur** (`/livreur/*`) | commandes de **mes tournées du jour** **ET** `statut ∈ {EN_ATTENTE_LIVREUR, A_LIVRER, EN_ROUTE}` |
| **Admin** (`/admin/*`) | **tout le reste**, sans filtre de nettoyage (voir ci-dessous) |

### Vont exclusivement dans l'admin (backlog / exceptions)
- Commandes des **jours précédents**, quel que soit le statut non finalisé
  (ex. `A_LIVRER`/`EN_ROUTE` d'hier non livrées).
- `BROUILLON` (panier non finalisé) et `EN_ATTENTE`/`CONFIRMEE` non verrouillées qui
  traînent (pending non validé).
- Échecs : `RETOUR_DEPOT`, `ABSENT`, `REFUS`, `REFUS_LIVREUR`.
- `ANNULEE` (historique).
- Commandes **sans `fournisseur_id` résolu** (hors zone).
- Tout statut **aberrant/inconnu** (non listé dans `TRANSITIONS`).

### Application (obligatoire)
1. **Fournisseur** : l'endpoint `GET /api/supplier/preparation` (Lot B) applique la
   whitelist ci-dessus. **Corriger aussi l'existant** `get_supplier_orders`
   (`/api/supplier/orders`) qui montre actuellement TOUS les statuts (dont `BROUILLON`) :
   y appliquer le même filtre (jour courant + whitelist), sinon ajouter un paramètre
   `?scope=today|all` avec `today` par défaut.
2. **Livreur** : tous les endpoints de tournées/commandes filtrent sur la whitelist
   livreur (jour courant). Une commande retombée en `RETOUR_DEPOT`/`REFUS_LIVREUR`
   **disparaît** de sa vue et repart vers l'admin.
3. **Admin** : voir Lot E.2 — écran « Backlog / Exceptions » qui agrège précisément tout
   ce qui est listé ci-dessus, avec actions (réassigner, replanifier, annuler, rattacher
   un fournisseur). Réutiliser les anomalies déjà gérées
   (`AnomalieLogistique`, `process_end_of_day_returns`, `get_tournees_details`).

> Garde-fou : ce filtrage est une **règle de présentation**, il ne change pas la machine
> à états. Une commande non traitée n'est jamais supprimée — elle est juste routée vers
> l'admin jusqu'à résolution.

---

## 2. Modèle de données (migrations)

### Tâche 2.1 — `Commande.fournisseur_id`
`entities/commande_entity.py` : ajouter
```python
fournisseur_id = Column(Integer, ForeignKey("t_fournisseurs.user_id"), nullable=True, index=True)
fournisseur = relationship("Fournisseur", foreign_keys=[fournisseur_id])
```
Migration SQL (`sql/AAAA-MM-JJ_add_commande_fournisseur.sql` + service de sync, sur le
modèle de `supplier_schema_sync_service.py`) :
```sql
ALTER TABLE t_commandes ADD COLUMN IF NOT EXISTS fournisseur_id integer
  REFERENCES t_fournisseurs(user_id);
CREATE INDEX IF NOT EXISTS idx_commandes_fournisseur ON t_commandes(fournisseur_id);
```

### Tâche 2.2 — Tournée = ramassage chez un fournisseur
`entities/tournee_entity.py` : une tournée est désormais rattachée à **un** fournisseur
(point de ramassage). Ajouter :
```python
fournisseur_id   = Column(Integer, ForeignKey("t_fournisseurs.user_id"), nullable=True, index=True)
pickup_lat       = Column(Float, nullable=True)
pickup_lng       = Column(Float, nullable=True)
ramasse_at       = Column(DateTime(timezone=True), nullable=True)   # horodatage du ramassage
fournisseur = relationship("Fournisseur", foreign_keys=[fournisseur_id])
```
Migration SQL équivalente (`ALTER TABLE t_tournees ADD COLUMN IF NOT EXISTS ...`).

### Tâche 2.3 — Statut « ramassé »
Étendre la machine à états pour matérialiser le ramassage avant la livraison.
Dans `services/commande_state_machine.py`, `TRANSITIONS` :
```
"A_LIVRER": ["EN_ROUTE", "RETOUR_DEPOT", "REFUS_LIVREUR"]   # inchangé
```
On ajoute le statut de **tournée** `RAMASSAGE`/`RAMASSEE` (côté `Tournee.statut` :
`PLANIFIEE → RAMASSAGE → EN_COURS → CLOTUREE`). Les commandes passent
`EN_ATTENTE_LIVREUR → A_LIVRER` au moment du ramassage (transition déjà autorisée).
> Choix simple : ne pas ajouter de statut commande ; utiliser `A_LIVRER` = « ramassée,
> prête à livrer », et tracer le ramassage via `Tournee.ramasse_at`. Garder le DeliveryEvent.

---

## 3. LOT A — Verrouillage : assigner chaque commande à son fournisseur + le notifier

### Tâche A.1 — Résolveur commande → fournisseur (par zone)
Nouveau `services/fournisseur_resolver.py` : fonction
`resoudre_fournisseur_pour_commande(session, commande, zones) -> Optional[int]` :
1. récupérer l'adresse par défaut du client (lat/lng) ;
2. `zone = resoudre_zone(lat, lng, zones)` ;
3. retourner `zone.fournisseur_id` si présent, sinon `None` (→ garde-fou Tâche 1).

### Tâche A.2 — Brancher l'assignation dans le verrouillage JIT
`services/jit_service.py`, méthode `verrouiller_commandes` : **après** être passé en
`VERROUILLEE`, fixer `commande.fournisseur_id = resoudre_fournisseur_pour_commande(...)`.
Charger les zones actives une fois (`zone_jit_dao.get_zones_actives`). Logger les
commandes sans fournisseur résolu.

### Tâche A.3 — Notification réelle « commandes du jour » au fournisseur
`services/notification_jit_service.py` : remplacer le stub par un envoi réel via la
**`NotificationOutbox`** existante (comme `fournisseur_service._queue_notification`),
type `WEBSOCKET`, `event="SUPPLIER_DAILY_BATCH"`, canal par fournisseur, payload =
{ fournisseur_id, date, nombre_commandes, liste produits agrégés à préparer }.
Brancher cet appel dans le job de verrouillage (par fournisseur résolu).

### Tâche A.4 — Activer le JIT par zone dans le scheduler (optionnel mais recommandé)
`services/scheduler_service.py`, `job_agregation_jit` : si des zones actives existent,
appeler `executer_job_jit_regional` (qui notifie déjà par zone) au lieu de la version
globale. Sinon conserver la globale en fallback.

**Critère A :** après 20h, chaque commande verrouillée a un `fournisseur_id`, et une
entrée `t_notification_outbox` par fournisseur récapitule ses commandes du jour.

---

## 4. LOT B — Interface fournisseur « Préparation du jour »

### Tâche B.1 — Endpoint backend
Nouveau dans `controllers/fournisseur_controller.py` (ou un contrôleur dédié) :
`GET /api/supplier/preparation` (permission `supplier.orders.read`) →
service qui renvoie, pour `principal.user_id` :
- les commandes **du jour** où `Commande.fournisseur_id == user_id` et
  `statut IN ('VERROUILLEE','EN_ATTENTE_LIVREUR','A_LIVRER')` ;
- pour chaque commande : id, client (nom/téléphone), créneau, adresse, lignes (produit,
  quantité_kg), montant ;
- un **récap picking** : somme des quantités par produit (liste de préparation).

Optionnel : `PUT /api/supplier/preparation/{commande_id}/prete` (permission
`supplier.orders.update_status`) pour marquer une commande « préparée / prête au
ramassage » (drapeau ou sous-statut applicatif ; ne pas casser la machine à états).

### Tâche B.2 — Page frontend
`front-end/app/supplier/preparation/page.tsx` : appelle `GET /api/supplier/preparation`,
affiche d'abord la **liste de picking agrégée** (ex. « Tomates : 14 kg, Oignons : 9 kg »),
puis le détail commande par commande. Lien depuis le dashboard `/supplier`.
Réutiliser `useAuth`, `API_BASE_URL`, le style des pages supplier existantes.

**Critère B :** un fournisseur approuvé voit, après 20h, exactement ses commandes du
jour + la quantité totale à préparer par produit.

---

## 5. LOT C — Dispatch avec ramassage chez le fournisseur (cœur)

Réécrire `DispatchService.generate_daily_routes` pour passer d'un découpage « parts
égales » à un découpage **par fournisseur (point de ramassage) puis par proximité client**.

### Tâche C.1 — Grouper les commandes verrouillées par fournisseur
Après avoir récupéré les commandes `VERROUILLEE` non assignées, **grouper par
`commande.fournisseur_id`**. Les commandes sans fournisseur → liste « à traiter par
admin » (ne pas planter).

### Tâche C.2 — Répartir le pool de livreurs entre les fournisseurs (DÉCIDÉ)
Politique v1 : **répartir le nombre total de livreurs disponibles entre les fournisseurs
qui ont des commandes**, proportionnellement à leur charge.

Algorithme :
1. soit `S` = fournisseurs ayant ≥ 1 commande du jour, `L` = livreurs disponibles
   (`get_available_livreurs`) ;
2. **garantir au moins 1 livreur par fournisseur** : si `len(L) < len(S)`, prévenir
   (alerte admin) et traiter en priorité les fournisseurs à plus forte charge ;
3. sinon, allouer à chaque fournisseur un nombre de livreurs **proportionnel à son nombre
   de commandes** : `nb_livreurs_f = max(1, round(len(L) * commandes_f / commandes_total))`,
   puis ajuster pour que la somme = `len(L)` (distribuer/retirer les restes) ;
4. affecter les livreurs concrets aux fournisseurs (les plus proches d'abord si tu as les
   positions, sinon ordre stable).

### Tâche C.3 — Construire les tournées d'un fournisseur
Pour chaque fournisseur et ses `k` livreurs alloués :
1. localisation du fournisseur (`Fournisseur.latitude/longitude`) = **origine de ramassage** ;
2. **trier les commandes par proximité** au point de ramassage puis entre elles
   (réutiliser `haversine` de `zone_resolver`, « plus proche voisin ») ;
3. **découper la liste triée en `k` sous-tournées** (réutiliser/adapter `_split_equally`),
   une par livreur alloué à ce fournisseur ;
4. pour chaque sous-tournée : créer la `Tournee` avec `fournisseur_id`, `pickup_lat`,
   `pickup_lng` renseignés ; assigner les commandes (`tournee_id`, `livreur_id`,
   `ordre_passage`) et passer `VERROUILLEE → EN_ATTENTE_LIVREUR`
   (logique existante `_mettre_commande_en_attente_livreur`).

### Tâche C.4 — Sérialisation tournée avec le ramassage
`_serialize_tournee` : ajouter le bloc `pickup` (fournisseur : nom boutique, adresse,
lat/lng, téléphone) pour que l'app livreur affiche **où ramasser** avant la 1ʳᵉ livraison.

**Critère C :** chaque tournée générée référence **un fournisseur** comme origine, ne
contient que des commandes de ce fournisseur, le pool de livreurs est réparti entre les
fournisseurs selon la charge, et la 1ʳᵉ étape de l'itinéraire est la localisation du
fournisseur.

---

## 6. LOT D — Livreur : étape de ramassage

### Tâche D.1 — Backend : marquer le ramassage
`services/livreur_service.py` + `controllers/livreur_controller.py` : endpoint
`PUT /api/livreur/tournees/{tournee_id}/ramassage` (rôle `LIVREUR`) qui :
- vérifie que la tournée appartient au livreur connecté ;
- pose `Tournee.ramasse_at = now`, `Tournee.statut = 'EN_COURS'` ;
- passe chaque commande de la tournée `EN_ATTENTE_LIVREUR → A_LIVRER` via `changer_statut`
  (reason `RAMASSAGE_FOURNISSEUR`).

### Tâche D.2 — Frontend livreur
Dans l'app livreur (`front-end/app/livreur/...`) : avant la liste des livraisons,
afficher la **carte/adresse du fournisseur** (depuis le bloc `pickup`) + un bouton
« J'ai ramassé la commande » qui appelle l'endpoint D.1. Tant que le ramassage n'est pas
fait, les livraisons sont verrouillées.

**Critère D :** un livreur voit son point de ramassage, confirme le ramassage (toutes ses
commandes passent `A_LIVRER`), puis peut démarrer les livraisons (`A_LIVRER → EN_ROUTE → LIVRE`).

---

## 7. LOT E — Admin : gestion des zones + supervision

### Tâche E.1 — CRUD des zones JIT (PRÉREQUIS du Lot A)
Sans zones rattachées à un fournisseur, la résolution commande→fournisseur ne peut pas
fonctionner. Ajouter la gestion admin des `ZoneJIT` :

- **Backend** : endpoints admin (permission `admin.panel.access`) sur un
  `zone_controller.py` :
  - `GET /api/admin/zones` — lister les zones (id, nom_ville, centre lat/lng, rayon_km,
    fournisseur rattaché, actif) ;
  - `POST /api/admin/zones` — créer (nom_ville, lat_centre, lng_centre, rayon_km,
    `fournisseur_id`, actif) ;
  - `PUT /api/admin/zones/{id}` — éditer (dont **rattacher/changer le fournisseur**) ;
  - `DELETE /api/admin/zones/{id}` (ou désactiver via `actif=false`).
  Réutiliser `zone_jit_dao` / `IZoneJITDao` (déjà présents) ; compléter le DAO si besoin.
- **Frontend** : `front-end/app/admin/zones/page.tsx` — carte/formulaire pour créer une
  zone (centre + rayon), choisir le fournisseur dans la liste `GET /api/admin/suppliers`,
  activer/désactiver. Ajouter l'entrée « Zones » au menu admin (`app/admin/page.tsx`,
  même structure que « Fournisseurs »).

### Tâche E.2 — Supervision dispatch + écran « Backlog / Exceptions »
- Dans l'admin dispatch existant : afficher les tournées **groupées par fournisseur**
  avec leur point de ramassage. Réutiliser `get_tournees_details`.
- **Écran « Backlog / Exceptions »** (applique la règle 1bis) — endpoint
  `GET /api/admin/commandes/exceptions` (permission `admin.panel.access`) renvoyant, avec
  filtres et pagination, **toutes** les commandes :
  - des **jours précédents** non finalisées ;
  - `BROUILLON`, `EN_ATTENTE`/`CONFIRMEE` non verrouillées qui traînent ;
  - `RETOUR_DEPOT`, `ABSENT`, `REFUS`, `REFUS_LIVREUR`, `ANNULEE` ;
  - **sans `fournisseur_id`** (hors zone) ;
  - statut **aberrant** (hors `TRANSITIONS`).
  Page `front-end/app/admin/commandes/exceptions/page.tsx` avec actions par ligne :
  rattacher un fournisseur, replanifier (`EN_ATTENTE`), réassigner, annuler — réutiliser
  les méthodes existantes de `DispatchService` (`reassign_*`, `resolve_anomalie_*`) et la
  validation commande. Lien depuis le menu admin.
- Ces écrans sont le **seul** endroit où ces commandes apparaissent (cf. règle 1bis).

---

## 8. LOT F — Tests & vérification

- **Unitaires** : `resoudre_fournisseur_pour_commande` (zone trouvée / sans fournisseur) ;
  verrouillage pose bien `fournisseur_id` ; dispatch groupe par fournisseur et fixe
  l'origine ; ramassage fait passer les commandes en `A_LIVRER`.
- **Machine à états** : aucune transition interdite introduite ; `Tournee.statut`
  `PLANIFIEE→EN_COURS→CLOTUREE` cohérent.
- **Cloisonnement (règle 1bis)** : une commande d'hier non livrée, une `BROUILLON`, une
  `RETOUR_DEPOT` et une commande sans `fournisseur_id` **n'apparaissent PAS** dans
  `/api/supplier/preparation` ni `/api/supplier/orders` ni les vues livreur, et
  **apparaissent** dans `/api/admin/commandes/exceptions`.
- **Scénario bout-en-bout** : 2 fournisseurs, 2 zones, N clients → après 20h chaque
  fournisseur a ses commandes + picking ; après 21h35, une tournée par fournisseur avec
  ramassage ; un livreur ramasse puis livre.
- `python -m compileall back-end` + `configure_mappers()`.

---

## 9. Ordre d'exécution & garde-fous

Ordre : **2 (migrations) → E.1 (CRUD zones, prérequis) → A → B → C → D → E.2 → F.**
La résolution par zone (Lot A) suppose des zones rattachées à un fournisseur, donc
**coder E.1 d'abord** (ou créer quelques zones en base pour tester A). A/B sont livrables
sans toucher au dispatch ; C est le gros morceau ; D dépend de C.

Garde-fous :
- Toujours changer un statut via `changer_statut` (jamais d'écriture directe de `statut`).
- Aucune transition hors `TRANSITIONS`.
- Les jobs scheduler ne doivent **jamais** planter : `try/except` + rollback par
  fournisseur/zone (suivre le pattern de `executer_job_jit_regional`).
- Idempotence : un 2ᵉ passage du dispatch ne doit pas dupliquer les tournées
  (réutiliser le filtre « commandes non assignées » existant).
- Fuseau horaire : tout en `Africa/Casablanca` (déjà en place).
- Commande sans fournisseur résolu → file admin, jamais d'assignation silencieuse erronée.

---

## 10. Décisions (statut)

1. ✅ **Modèle d'expédition** : 1 commande → 1 fournisseur par **zone**. Hypothèse v1 :
   chaque fournisseur propose tout le catalogue (pas de filtrage produit en logistique).
2. ⏳ **Heure de verrouillage** : 20h actuel — à confirmer (le besoin évoquait 8h/20h).
   Si tu veux un autre horaire, changer le `CronTrigger` du job JIT dans `scheduler_service.py`.
3. ✅ **Affectation livreur↔fournisseur** : répartir le pool de livreurs entre les
   fournisseurs proportionnellement à leur charge (≥ 1 livreur par fournisseur).
4. ✅ **Zones** : écran admin de gestion des `ZoneJIT` + rattachement fournisseur → Lot E.1
   (prérequis du Lot A).
