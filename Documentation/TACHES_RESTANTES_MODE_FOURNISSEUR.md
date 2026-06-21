# Tâches restantes — Mode Fournisseur (à donner à l'agent)

> LOTs 1–7 (backend offres) faits. Reste : 2 correctifs bloquants, 1 vérif fichiers,
> 1 correctif mineur, puis frontend (LOT 8) et tests (LOT 9).
> Ordre imposé : **A → B → C → 8 → 9**. Ne pas commencer le frontend tant que A n'est
> pas résolu (sinon aucun fournisseur ne peut être approuvé).

---

## A. [BLOQUANT] Corriger l'impasse d'autorisation (chicken‑and‑egg)

**Problème :** avant approbation le candidat n'a que le rôle `CLIENT`. Or
`POST /api/supplier/products` et `PUT /api/supplier/products/selection` exigent la
permission `supplier.products.create` (réservée à `FOURNISSEUR`) + `_ensure_supplier_role`.
Mais `validate_supplier_request(APPROVE)` refuse l'approbation s'il y a 0 produit.
→ Le client ne peut pas ajouter de produit avant d'être fournisseur, et ne peut pas
devenir fournisseur sans produit. **Deadlock.**

**Correctif retenu (Option 3) : la sélection des produits se fait DANS la demande.**

1. **DTO** — `back-end/dto/supplier_dto.py`, classe `SupplierRequestDTO` : ajouter
   ```python
   produit_ids: List[int] = Field(min_items=1)   # au moins 1 produit dès la demande
   ```
2. **Service** — `back-end/services/fournisseur_service.py`, méthode
   `submit_supplier_request` : après avoir créé et `flush` le `Fournisseur` (avant le
   `commit`), créer les offres dans la **même transaction** :
   - vérifier que chaque `produit_id` existe et est `is_active` (sinon `404`/`409`) ;
   - insérer une ligne `FournisseurProduit(fournisseur_id=user_id, produit_id=pid, is_active=True)` par id ;
   - puis `commit`.
   Réutiliser `FournisseurProduit` (déjà importé) ; ne pas créer de doublons
   (`UNIQUE (fournisseur_id, produit_id)` → gérer `IntegrityError → 409`).
3. **Garde d'approbation** — laisser la pré‑condition « ≥ 1 offre active » dans
   `validate_supplier_request(APPROVE)` : elle devient une simple sécurité (toujours
   vraie après l'étape 2).
4. **Cohérence des endpoints produits** : `POST /api/supplier/products`, `PUT /selection`,
   `PUT /{id}`, `DELETE /{id}` restent réservés au rôle `FOURNISSEUR` (gestion
   **post‑approbation**). C'est correct : un fournisseur approuvé gère son catalogue ;
   un candidat passe par `submit_supplier_request`.

**Critère d'acceptation A :** un `CLIENT` peut soumettre une demande avec ≥ 1 produit
sans erreur 403 ; un POST sans `produit_ids` renvoie 422 ; l'admin peut approuver.

---

## B. [BLOQUANT] Vérifier / réparer 2 fichiers tronqués

À la compilation sandbox, ces 2 fichiers reviennent **coupés** (probable artefact de
sync, à confirmer côté disque) :

- `back-end/services/fournisseur_service.py` doit se terminer par les méthodes
  `_to_profile_dto`, `_to_pending_dto`, `_to_list_item_dto`, `_clean_optional_text`
  (sinon `SyntaxError: '(' was never closed`).
- `back-end/dependencies.py` doit se terminer par **tous** les providers `get_*`
  (dont `get_souki_wallet_service` complet ; sinon `SyntaxError: expected ':'` sur
  `) -> ISoukiWalletSe`).

**Action :**
```bash
# depuis back-end/, avec le venv du projet
python -m compileall .
python -c "import entities; from sqlalchemy.orm import configure_mappers; configure_mappers(); print('mappers OK')"
```
Si l'un des deux fichiers est réellement tronqué, le régénérer/compléter avant tout.

**Critère d'acceptation B :** `compileall` sans erreur **et** `configure_mappers()` OK.

---

## C. [MINEUR] Durcir `remove_product`

`back-end/services/fournisseur_produit_service.py` : `remove_product` bloque dès que
`count_active <= 1`, sans tenir compte du fait que l'offre ciblée peut être déjà
inactive. Corriger pour compter les offres actives **hors** produit ciblé :

> Refuser le retrait uniquement si, après suppression, il resterait 0 offre active.
> (ex. récupérer l'offre, calculer `count_active - (1 si offre.is_active else 0)`,
> refuser `409` si le résultat est `< 1`.)

**Critère d'acceptation C :** retirer une offre inactive alors qu'il reste 1 offre
active est autorisé ; retirer la dernière offre active reste refusé (409).

---

## LOT 8 — Frontend Next.js

Réutiliser `front-end/lib/api.ts`, `front-end/contexts/auth-context.tsx`, composants
`front-end/components/admin/` et `ui/`. État lu via `/auth/me`
(`roles` + `profiles.fournisseur.statut`).

1. **Devenir fournisseur** — `front-end/app/devenir-fournisseur/page.tsx`
   Formulaire boutique **+ sélection ≥ 1 produit** (catalogue via `GET /api/catalogue`).
   Bloquer la soumission si 0 produit. Un seul appel : `POST /api/supplier/request`
   avec `produit_ids` (voir correctif A).
2. **Statut de la demande** — `front-end/app/devenir-fournisseur/statut/page.tsx`
   Afficher `PENDING` / `REJECTED` (+ `rejected_reason`).
3. **Espace fournisseur** (rôle `FOURNISSEUR`) :
   - `app/supplier/page.tsx` — dashboard KPIs (`GET /api/supplier/stats`)
   - `app/supplier/produits/page.tsx` — offres (`GET/POST/PUT/DELETE /api/supplier/products*`),
     garde UI « dernier produit »
   - `app/supplier/commandes/page.tsx` — `GET /api/supplier/orders`
   - `app/supplier/profil/page.tsx` — `GET/PUT /api/supplier/profile`
   - **Switch « Acheter / Vendre »** dans la nav pour les comptes CLIENT + FOURNISSEUR
4. **Validation admin** — `front-end/app/admin/fournisseurs/page.tsx`
   File `GET /api/admin/suppliers/pending`, liste `GET /api/admin/suppliers`, actions
   `POST /api/admin/suppliers/validate` + suspend/reactivate. Afficher les produits du
   candidat avant approbation.

**Critère d'acceptation LOT 8 :** parcours complet jouable — demande (avec produits)
→ approbation admin → accès `/supplier` après refresh.

---

## LOT 9 — Tests & vérification finale

- **Tests service** (`back-end/tests/`) :
  - demande avec 0 produit → 422 ; avec produits inactifs → 409 ;
  - approbation impossible sans offre → 409 ; possible avec ≥ 1 ;
  - `remove_product` : refus dernière offre active, OK sinon (cas C) ;
  - autorisations par permission (`supplier.products.*` refusées à un `CLIENT`).
- **Compilation/mappers** : `compileall` + `configure_mappers()`.
- **Smoke test end‑to‑end** : demande → approbation → gestion produits → stats/commandes.
- **Non‑régression** : `/api/supplier/*` et `/api/admin/suppliers/*` existants OK.

---

## Rappels (garde‑fous)

- Jamais de manipulation directe de `t_users.role` → passer par `AuthorizationDao`.
- Pas de `commit` dans les DAO ; transactions gérées par les services.
- Règle « au moins 1 produit, jusqu'à tout le catalogue » garantie à 3 niveaux :
  Pydantic (`min_items=1` sur la demande **et** la sélection), service (retrait /
  approbation), trigger DB optionnel en filet de sécurité.
