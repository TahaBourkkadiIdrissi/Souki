# Instructions pour l'agent — Implémentation du Mode Fournisseur (SOUKI)

> À donner tel quel à un agent codeur. Chaque tâche cite les **fichiers réels**, le
> **pattern existant à copier**, et un **critère d'acceptation**.
> Stack : FastAPI + SQLAlchemy + PostgreSQL/Supabase (back), Next.js (front).
> Architecture en couches stricte : `controller → service → dao → entity`, interfaces
> dans `interfaces/`, injection FastAPI dans `dependencies.py`.

## Contexte — état réel du code (déjà vérifié)

**Déjà présent, à NE PAS recréer :**
- `entities/fournisseur_entity.py` (`t_fournisseurs`), `dao/fournisseur_dao.py`,
  `dto/supplier_dto.py`, `services/fournisseur_service.py`,
  `controllers/fournisseur_controller.py` (routes `/api/supplier/*` et
  `/api/admin/suppliers/*`), enregistrées dans `main.py`.
- Cycle de validation admin complet (approve / reject / suspend / reactivate) +
  ajout/retrait du rôle `FOURNISSEUR` via `AuthorizationDao`.
- `services/supplier_schema_sync_service.py` (création auto de `t_fournisseurs` au boot).
- RBAC : rôle `FOURNISSEUR` + permissions `supplier.*` dans `rbac_config.py`
  (dont `supplier.products.read/create/update/delete` **déjà déclarées**).
- `T_Product.fournisseur_id` (FK → `t_fournisseurs.user_id`).
- `/auth/me` renvoie `roles` + `profiles.fournisseur` (voir `auth_service._load_profiles`).

**Ce qui MANQUE (objet de ces instructions) :**
1. Aucun endpoint n'utilise les permissions `supplier.products.*` → **pas de gestion
   produits côté fournisseur**.
2. Aucune matérialisation de la règle **« un fournisseur = au moins 1 produit,
   jusqu'à tous les produits du catalogue »**.
3. Modèle de rattachement produit↔fournisseur **mono-fournisseur** (`fournisseur_id`)
   → à faire évoluer vers une table d'offres multi-fournisseurs.
4. Tout le **frontend fournisseur** et le routage multi-rôles.

**Décision d'architecture imposée :** créer la table d'offres
`t_fournisseur_produits` (un fournisseur peut proposer 1..N produits du catalogue,
plusieurs fournisseurs peuvent proposer le même produit). Garder `fournisseur_id`
temporairement pour compatibilité, migrer les lectures ensuite.

---

## LOT 1 — Backend : modèle de données (offres)

### Tâche 1.1 — Créer l'entité `FournisseurProduit`
**Fichier :** `back-end/entities/fournisseur_produit_entity.py` (nouveau)
Copier le style de `entities/produit_b2b_entity.py` / `fournisseur_entity.py`.

```python
from sqlalchemy import (Boolean, Column, DateTime, Float, ForeignKey, Integer,
                        UniqueConstraint, func)
from sqlalchemy.orm import relationship
from config import Base


class FournisseurProduit(Base):
    __tablename__ = "t_fournisseur_produits"
    __table_args__ = (
        UniqueConstraint("fournisseur_id", "produit_id", name="uq_fournisseur_produit"),
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    fournisseur_id = Column(Integer, ForeignKey("t_fournisseurs.user_id"), nullable=False, index=True)
    produit_id     = Column(Integer, ForeignKey("T_Product.id"), nullable=False, index=True)
    prix_gros      = Column(Float, nullable=True)
    stock          = Column(Float, default=0.0)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    fournisseur = relationship("Fournisseur", back_populates="offres")
    produit     = relationship("Product", back_populates="offres_fournisseurs")
```

### Tâche 1.2 — Ajouter les relations inverses
- Dans `entities/fournisseur_entity.py`, ajouter dans la classe `Fournisseur` :
  `offres = relationship("FournisseurProduit", back_populates="fournisseur")`
- Dans `entities/product_entity.py`, ajouter dans la classe `Product` :
  `offres_fournisseurs = relationship("FournisseurProduit", back_populates="produit")`

### Tâche 1.3 — Enregistrer l'entité
**Fichier :** `back-end/entities/__init__.py`
Ajouter l'import `from entities.fournisseur_produit_entity import FournisseurProduit`
et l'entrée `"FournisseurProduit"` dans `__all__` (mêmes deux endroits que les autres
entités).

### Tâche 1.4 — Sync schéma au démarrage
**Fichier :** `back-end/services/fournisseur_produit_schema_sync_service.py` (nouveau)
Copier **exactement** la structure de `services/supplier_schema_sync_service.py`
(garde `if engine.dialect.name != "postgresql": return`, `with engine.begin()`).
SQL à exécuter :

```sql
CREATE TABLE IF NOT EXISTS t_fournisseur_produits (
  id             serial PRIMARY KEY,
  fournisseur_id integer NOT NULL REFERENCES t_fournisseurs(user_id),
  produit_id     integer NOT NULL REFERENCES "T_Product"(id),
  prix_gros      double precision,
  stock          double precision DEFAULT 0,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT uq_fournisseur_produit UNIQUE (fournisseur_id, produit_id)
);
CREATE INDEX IF NOT EXISTS idx_fp_fournisseur ON t_fournisseur_produits(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_fp_produit     ON t_fournisseur_produits(produit_id);
```

Reprise des données existantes (à exécuter après le CREATE) :
```sql
INSERT INTO t_fournisseur_produits (fournisseur_id, produit_id, is_active)
SELECT fournisseur_id, id, is_active FROM "T_Product" WHERE fournisseur_id IS NOT NULL
ON CONFLICT (fournisseur_id, produit_id) DO NOTHING;
```

**Fichier :** `back-end/main.py` — enregistrer la tâche au boot à côté de la ligne
existante `AppTask("supplier schema sync", SupplierSchemaSyncService.sync)` :
```python
AppTask("fournisseur produits schema sync", FournisseurProduitSchemaSyncService.sync),
```
(plus l'import en tête de fichier).

### Tâche 1.5 — Script SQL versionné
**Fichier :** `back-end/sql/2026-06-18_add_fournisseur_produits.sql` (nouveau)
Reprendre le même SQL (CREATE + index + reprise), enrobé de `BEGIN; … COMMIT;`,
sur le modèle de `sql/2026-05-12_add_fournisseurs.sql`.

**Critère d'acceptation LOT 1 :**
`python -m compileall back-end` OK **et** `configure_mappers()` ne lève pas (vérifier
comme dans `SUPPLIER_BACKEND_IMPLEMENTATION.md` §5). Au démarrage, la table
`t_fournisseur_produits` est créée si absente.

---

## LOT 2 — Backend : DAO des offres

### Tâche 2.1 — Interface DAO
**Fichier :** `back-end/interfaces/fournisseur_produit_dao_interface.py` (nouveau)
Copier le style de `interfaces/fournisseur_dao_interface.py`. Méthodes :
`list_by_fournisseur(session, fournisseur_id)`,
`find(session, fournisseur_id, produit_id)`,
`upsert(session, fournisseur_id, produit_id, prix_gros, stock, is_active)`,
`delete(session, fournisseur_id, produit_id)`,
`count_active(session, fournisseur_id) -> int`,
`replace_selection(session, fournisseur_id, produit_ids: list[int])`.

### Tâche 2.2 — Implémentation DAO
**Fichier :** `back-end/dao/fournisseur_produit_dao.py` (nouveau)
Copier le style de `dao/fournisseur_dao.py` (classe `FournisseurProduitDaoBD`,
requêtes SQLAlchemy, `session.flush()` sur write, pas de `commit` dans le DAO).
- `count_active` = `session.query(func.count(...)).filter(fournisseur_id==, is_active.is_(True)).scalar()`.
- `upsert` : chercher l'offre existante, mettre à jour sinon créer.
- `replace_selection` : désactiver/supprimer les offres hors liste, créer les manquantes.

**Critère d'acceptation LOT 2 :** méthodes typées, aucune logique métier (la garde
« ≥ 1 » est dans le service, pas le DAO).

---

## LOT 3 — Backend : DTOs

### Tâche 3.1 — Ajouter les DTOs produits fournisseur
**Fichier :** `back-end/dto/supplier_dto.py` (compléter, ne pas casser l'existant)

```python
class SupplierProductOfferDTO(BaseModel):
    produit_id: int
    nom_fr: str
    nom_darija: str
    unite: str
    prix_affiche: Optional[float] = None
    prix_gros: Optional[float] = None
    stock: float = 0
    is_active: bool = True

    class Config:
        from_attributes = True

class SupplierCatalogueItemDTO(BaseModel):       # pour l'écran de sélection
    produit_id: int
    nom_fr: str
    nom_darija: str
    unite: str
    prix_affiche: Optional[float] = None
    deja_propose: bool = False

class SupplierProductCreateDTO(BaseModel):
    produit_id: int
    prix_gros: Optional[float] = None
    stock: float = 0

class SupplierProductUpdateDTO(BaseModel):
    prix_gros: Optional[float] = None
    stock: Optional[float] = None
    is_active: Optional[bool] = None

class SupplierProductSelectionDTO(BaseModel):
    produit_ids: List[int] = Field(min_items=1)   # ← règle « au moins 1 produit »

class SupplierProductsListDTO(BaseModel):
    status: str = "success"
    items: List[SupplierProductOfferDTO] = Field(default_factory=list)
```

**Critère d'acceptation LOT 3 :** `produit_ids` avec `min_items=1` → un POST vide
renvoie 422 automatiquement.

---

## LOT 4 — Backend : service des offres + règle « ≥ 1 produit »

### Tâche 4.1 — Interface service
**Fichier :** `back-end/interfaces/fournisseur_produit_service_interface.py` (nouveau)
Style `interfaces/fournisseur_service_interface.py` (avec `__enter__`/`__exit__`).
Méthodes : `list_products(user_id)`, `list_catalogue(user_id)`,
`add_product(user_id, payload)`, `update_product(user_id, produit_id, payload)`,
`remove_product(user_id, produit_id)`, `set_selection(user_id, payload)`.

### Tâche 4.2 — Service
**Fichier :** `back-end/services/fournisseur_produit_service.py` (nouveau)
Copier la **gestion de session par context manager** de
`services/fournisseur_service.py` (`_ensure_session`, `__enter__`, `__exit__`,
`_close_owned_session`). Règles à coder :
- `_ensure_supplier_role(session, user_id)` (réutiliser le même contrôle que
  `FournisseurService` via `AuthorizationDao.get_active_role_codes`, exiger
  `FOURNISSEUR`).
- `add_product` : refuser si le produit n'existe pas ou `is_active == False` au
  catalogue (`409`/`404`). `upsert` puis `commit`.
- **`remove_product` : si `count_active(...) <= 1`, lever
  `HTTPException(409, "Un fournisseur doit conserver au moins un produit.")`** (règle R2).
- `set_selection` : valider `len(produit_ids) >= 1`, vérifier que tous existent et
  sont actifs, puis `replace_selection`.
- Gérer `IntegrityError → HTTPException(409)` (offre dupliquée).

### Tâche 4.3 — Pré-condition d'approbation « ≥ 1 produit »
**Fichier :** `back-end/services/fournisseur_service.py`
Dans `validate_supplier_request`, branche `AdminSupplierAction.APPROVE`, **avant** de
passer `statut = APPROVED` : compter les offres actives du candidat
(`FournisseurProduit` où `fournisseur_id == fournisseur.user_id`, `is_active`) ; si
`0`, lever `HTTPException(409, "Le fournisseur doit avoir au moins un produit avant approbation.")`.

**Critère d'acceptation LOT 4 :** impossible d'approuver un fournisseur sans produit ;
impossible de retirer le dernier produit d'un fournisseur.

---

## LOT 5 — Backend : contrôleur + injection

### Tâche 5.1 — Contrôleur produits fournisseur
**Fichier :** `back-end/controllers/supplier_products_controller.py` (nouveau)
Copier le style de `controllers/fournisseur_controller.py` (gardes `require_permission`,
`with service:`). Routes (préfixe `/api/supplier/products`) :

| Méthode | Route | Garde (permission) |
|---------|-------|--------------------|
| GET | `` (racine) | `supplier.products.read` |
| GET | `/catalogue` | `supplier.products.read` |
| POST | `` (racine) | `supplier.products.create` |
| PUT | `/selection` | `supplier.products.create` |
| PUT | `/{produit_id}` | `supplier.products.update` |
| DELETE | `/{produit_id}` | `supplier.products.delete` |

Récupérer l'identité via `principal.user_id` (comme l'existant). `response_model`
= les DTOs du LOT 3.

### Tâche 5.2 — Injection de dépendances
**Fichier :** `back-end/dependencies.py`
Ajouter, sur le modèle de `get_fournisseur_dao` / `get_fournisseur_service` :
```python
def get_fournisseur_produit_dao() -> IFournisseurProduitDao:
    return FournisseurProduitDaoBD()

def get_fournisseur_produit_service(
    dao: IFournisseurProduitDao = Depends(get_fournisseur_produit_dao),
) -> IFournisseurProduitService:
    return FournisseurProduitService(fournisseur_produit_dao=dao)
```
(+ imports en tête, comme les autres.)

### Tâche 5.3 — Enregistrer le router
**Fichier :** `back-end/main.py`
Importer `router_supplier_products` et l'ajouter à la liste des routers (à côté de
`router_supplier` / `router_admin_supplier`).

**Critère d'acceptation LOT 5 :** les 6 routes apparaissent dans `/docs` (OpenAPI),
protégées par les permissions `supplier.products.*`.

---

## LOT 6 — Backend : adapter stats & commandes

### Tâche 6.1 — Brancher stats/commandes sur les offres
**Fichier :** `back-end/services/fournisseur_service.py`
Dans `get_supplier_stats` et `get_supplier_orders`, remplacer la jointure actuelle
`Product.fournisseur_id == user_id` par une jointure via `t_fournisseur_produits` :
```
Commande → Panier → LignePanier → Product → FournisseurProduit(fournisseur_id == user_id, is_active)
```
- `products_count` = `count(offres)`, `active_products_count` = `count(offres actives)`.
- `revenue_total` / `supplier_total` : somme `LignePanier.sous_total` restreinte aux
  produits effectivement proposés par le fournisseur.

**Critère d'acceptation LOT 6 :** un fournisseur ne voit dans ses stats/commandes que
les lignes correspondant à ses offres.

---

## LOT 7 — RBAC (vérification, pas de création)

### Tâche 7.1 — Vérifier le mapping
**Fichier :** `back-end/rbac_config.py`
Confirmer que `FOURNISSEUR` possède bien `supplier.products.read/create/update/delete`
dans `ROLE_PERMISSION_MAP` (c'est déjà le cas). **Aucune nouvelle permission requise
pour la v1.** Si une permission `supplier.products.*` manquait, l'ajouter en
namespaçant la `resource` (ex. `resource="supplier.products"`) pour ne pas heurter la
contrainte `uq_permissions_resource_action`.

**Critère d'acceptation LOT 7 :** au boot, `rbac_bootstrap_service` synchronise les
permissions sans erreur de contrainte unique.

---

## LOT 8 — Frontend (Next.js / App Router)

Réutiliser `front-end/lib/api.ts`, `front-end/contexts/auth-context.tsx`, les
composants `front-end/components/admin/` et `front-end/components/ui/`.
Lire l'état fournisseur depuis `/auth/me` (`roles` + `profiles.fournisseur.statut`).

### Tâche 8.1 — Devenir fournisseur
**Route :** `front-end/app/devenir-fournisseur/page.tsx`
Formulaire boutique (`shop_name`, `phone`, `address`, …) **+ sélection d'au moins un
produit** du catalogue (`GET /api/catalogue`). Bloquer la soumission tant que 0
produit sélectionné. Appels : `POST /api/supplier/request` puis
`PUT /api/supplier/products/selection`.

### Tâche 8.2 — Statut de la demande
**Route :** `front-end/app/devenir-fournisseur/statut/page.tsx`
Afficher `PENDING` / `REJECTED` (+ `rejected_reason`).

### Tâche 8.3 — Espace fournisseur + sélecteur d'espace
**Routes :** `front-end/app/supplier/page.tsx` (dashboard, `GET /api/supplier/stats`),
`/supplier/produits` (gestion offres, `GET/POST/PUT/DELETE /api/supplier/products*`,
garde « dernier produit » côté UI), `/supplier/commandes`
(`GET /api/supplier/orders`), `/supplier/profil` (`GET/PUT /api/supplier/profile`).
Ajouter un **switch « Acheter / Vendre »** dans la navigation pour les comptes
CLIENT + FOURNISSEUR. Protéger les routes par présence du rôle `FOURNISSEUR`.

### Tâche 8.4 — Validation admin
**Route :** `front-end/app/admin/fournisseurs/page.tsx`
File `GET /api/admin/suppliers/pending`, liste `GET /api/admin/suppliers`, actions
`POST /api/admin/suppliers/validate` (+ suspend/reactivate). Afficher les produits
proposés par le candidat avant approbation.

**Critère d'acceptation LOT 8 :** parcours complet jouable : un client demande,
sélectionne ≥ 1 produit, l'admin approuve, le client (rafraîchi) accède à `/supplier`.

---

## LOT 9 — Tests & vérification finale

- **Tests unitaires service** (`back-end/tests/`) : règle « ≥ 1 produit » (refus
  approbation sans produit, refus retrait du dernier), upsert/replace, autorisations
  par permission.
- **Compilation/mappers** : `python -m compileall back-end` + `configure_mappers()`.
- **Smoke test** du parcours end-to-end (demande → sélection → approbation → accès).
- **Non-régression** : les endpoints `/api/supplier/*` et `/api/admin/suppliers/*`
  existants continuent de fonctionner.

---

## Ordre d'exécution recommandé

1 → 2 → 3 → 4 → 5 → 6 → 7 (backend complet et testable) puis 8 (frontend) puis 9
(vérif). Les LOTs 1–5 sont bloquants pour le reste ; le LOT 6 dépend du LOT 1 ; le
LOT 8 dépend de 5.

## Garde-fous (à respecter absolument)

- Ne jamais manipuler `t_users.role` directement → passer par `AuthorizationDao`.
- Pas de `commit` dans les DAO ; transactions gérées par les services.
- Conserver le pattern interface + injection FastAPI pour chaque DAO/service.
- La règle « au moins 1 produit, jusqu'à tout le catalogue » doit être appliquée à
  **3 niveaux** : Pydantic (`min_items=1`), service (retrait/approbation), et
  idéalement un trigger DB en filet de sécurité.
