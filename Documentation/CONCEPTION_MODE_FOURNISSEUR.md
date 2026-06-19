# Conception du Mode Fournisseur — SOUKI

> Document de conception fonctionnelle et technique du **Mode Fournisseur**, intégré
> à l'architecture existante (FastAPI + Next.js + PostgreSQL/Supabase).
>
> Principe directeur : **transformation d'un compte client existant en compte
> fournisseur**, sans création d'un second compte. Un compte = un `user_id`, et le
> rôle `FOURNISSEUR` s'**ajoute** au rôle `CLIENT` (modèle multi-rôles).
>
> Règle métier centrale : **un fournisseur = au moins 1 produit, jusqu'à tous les
> produits du catalogue.**

---

## 1. Objectif et périmètre

### 1.1. Objectif

Permettre à un utilisateur déjà inscrit comme **client** de devenir **fournisseur**
sur la plateforme SOUKI, afin de proposer à la vente un ou plusieurs produits du
catalogue, tout en conservant ses capacités de client (commander, panier, etc.).

### 1.2. Principes de conception

1. **Pas de nouveau compte.** Le fournisseur réutilise son `user_id`. On ajoute un
   profil métier (`t_fournisseurs`) et un rôle RBAC (`FOURNISSEUR`) au compte
   existant. Le compte reste unique et conserve `CLIENT`.
2. **Multi-rôles additif.** L'autorisation repose sur `user_roles` : un même
   utilisateur peut détenir simultanément `CLIENT` et `FOURNISSEUR`. Aucun rôle
   n'est retiré lors de la transformation.
3. **Validation administrateur.** La transformation passe par un cycle de demande
   `PENDING → APPROVED / REJECTED`, puis `SUSPENDED / réactivation`.
4. **Contrainte produit.** Un fournisseur approuvé doit être rattaché à **au moins
   un produit** du catalogue. Il peut aller jusqu'à **l'ensemble** du catalogue.
5. **Intégration, pas de refonte.** On réutilise les couches existantes
   (`entities / dao / dto / services / controllers / interfaces`) et le RBAC déjà
   en place. Le frontend Next.js ajoute des écrans dédiés sans modifier le socle.

### 1.3. Ce qui existe déjà (à conserver)

Le backend du parcours fournisseur est **déjà partiellement implémenté** :

- Entité `Fournisseur` (`t_fournisseurs`), DAO, DTO, service et contrôleur.
- Cycle de validation administrateur complet (approve / reject / suspend /
  reactivate) avec notifications via `t_notification_outbox`.
- Rôle `FOURNISSEUR` et permissions `supplier.*` déclarés dans `rbac_config.py`.
- Colonne `T_Product.fournisseur_id` reliant un produit à un fournisseur.

### 1.4. Ce qui manque (objet de cette conception)

- **La gestion des produits côté fournisseur** : il existe des permissions
  `supplier.products.*` mais **aucun endpoint** ne les utilise (le contrôleur
  produits actuel est réservé à l'admin).
- **L'application de la règle « ≥ 1 produit »** lors de la transformation.
- **Le choix du modèle de rattachement produit↔fournisseur** (mono-fournisseur
  actuel vs. multi-fournisseurs cible) — voir section 5.
- **Tout le frontend fournisseur** (demande, dashboard, produits, commandes, stats)
  et le routage multi-rôles post-login.

---

## 2. Architecture cible

```
┌──────────────────────────── Frontend (Next.js / App Router) ────────────────────────────┐
│  /devenir-fournisseur     → formulaire de demande (rôle CLIENT)                           │
│  /supplier (dashboard)    → stats, raccourcis (rôle FOURNISSEUR)                          │
│  /supplier/produits       → sélection catalogue + gestion offres (≥ 1 produit)           │
│  /supplier/commandes      → commandes contenant ses produits                              │
│  /supplier/profil         → édition boutique                                              │
│  /admin/fournisseurs      → file de validation (permission admin.panel.access)            │
└───────────────────────────────────────────────┬──────────────────────────────────────────┘
                                                 │  HTTP / JWT (roles + permissions)
┌────────────────────────────────────────────────▼──────────────────────────── Backend (FastAPI) ──┐
│  controllers/fournisseur_controller.py        → /api/supplier/* , /api/admin/suppliers/*           │
│  controllers/supplier_products_controller.py  → /api/supplier/products/*   (À CRÉER)               │
│  services/fournisseur_service.py              → cycle de vie + stats + commandes                    │
│  services/supplier_product_service.py         → rattachement produits, règle ≥1   (À CRÉER)        │
│  dao/fournisseur_dao.py + supplier_product_dao.py (À CRÉER)                                         │
│  dto/supplier_dto.py (+ offres produits)                                                            │
│  RBAC : roles / permissions / role_permissions / user_roles                                        │
└────────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                                 │  SQLAlchemy
┌────────────────────────────────────────────────▼──────────────────────── PostgreSQL / Supabase ──┐
│  t_users · t_clients · t_fournisseurs · T_Product · t_fournisseur_produits (À CRÉER)               │
│  roles · permissions · role_permissions · user_roles · t_notification_outbox                       │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Le respect strict de la séparation en couches existante est conservé :
**controller → service → dao → entity**, avec injection de dépendances FastAPI et
interfaces (`interfaces/`) pour chaque service et DAO.

---

## 3. Modèle de domaine

### 3.1. Acteurs et rôles

| Rôle          | Code RBAC      | Description |
|---------------|----------------|-------------|
| Client        | `CLIENT`       | Compte de base. Peut soumettre une demande fournisseur. |
| Fournisseur   | `FOURNISSEUR`  | Client transformé. Gère sa boutique, ses produits, ses commandes. |
| Administrateur| `ADMIN`        | Valide / rejette / suspend les demandes (`admin.panel.access`). |

Un fournisseur **est aussi** un client : il garde `CLIENT` et reçoit `FOURNISSEUR`
en plus. C'est le cœur de la « transformation de compte ».

### 3.2. Entités principales (existantes)

`t_users` (PK `id`) — compte unique.

`t_clients` (PK/FK `user_id → t_users.id`) — profil client.

`t_fournisseurs` (PK/FK `user_id → t_users.id`) — profil boutique :
`shop_name`, `shop_slug` (unique), `description`, `phone`, `address`, `ville`,
`code_postal`, `latitude`, `longitude`, `siret`, `logo_url`, `couverture_url`,
`horaires` (JSONB), `rating`, `nb_avis`, `statut`
(`PENDING|APPROVED|REJECTED|SUSPENDED`), `rejected_reason`, `validated_by`,
`validated_at`, `created_at`, `updated_at`.

`T_Product` (PK `id`) — catalogue : `nom_fr`, `nom_darija` (unique), `prix_kg`,
`unite`, `stock`, `is_active`, `image_url`, colonnes pricing
(`marge_cible`, `coussin_securite`, `niveau`, `volatilite`, `prix_gros_saisi`,
`prix_affiche`) et **`fournisseur_id`** (FK `→ t_fournisseurs.user_id`, nullable).

### 3.3. Relation « un fournisseur ↔ ses produits »

C'est le point d'architecture clé de cette conception. Deux modèles sont possibles ;
voir la décision en **section 5**. Quel que soit le modèle retenu, la règle métier
est la même :

> **Cardinalité : 1 fournisseur → [1 .. N] produits du catalogue.**
> Minimum 1 produit (obligatoire pour être `APPROVED` et actif), maximum = taille du
> catalogue.

---

## 4. Parcours fonctionnel — transformation client → fournisseur

### 4.1. Machine à états du profil fournisseur

```
                 submit_supplier_request
   (CLIENT) ───────────────────────────────►  PENDING
                                                 │
                       ┌─────────────────────────┼─────────────────────────┐
              approve  │                 reject   │                          │
                       ▼                          ▼                          │
                   APPROVED  ◄───────────────  REJECTED                      │
                       │   ▲     reactivate                                  │
               suspend │   │                                                 │
                       ▼   │                                                 │
                   SUSPENDED ───────────────────────────────────────────────┘
```

- **APPROVED** → le rôle `FOURNISSEUR` est ajouté/réactivé dans `user_roles`.
- **SUSPENDED** → le rôle `FOURNISSEUR` est désactivé (le compte reste `CLIENT`).
- **REJECTED** → aucun rôle ajouté ; l'utilisateur reste `CLIENT`.

### 4.2. Étapes détaillées

1. **Demande (client).** Un utilisateur `CLIENT` soumet sa demande via
   `POST /api/supplier/request` avec les informations de boutique. Le service
   vérifie qu'aucune demande n'existe déjà (`409` sinon), génère un `shop_slug`
   unique et crée la ligne `t_fournisseurs` en `PENDING`.
2. **Sélection des produits (client).** Dès la demande (ou juste après), le candidat
   choisit **au moins 1 produit** du catalogue qu'il souhaite fournir. Cette
   sélection est rattachée à son `user_id` (voir section 5 pour le stockage).
   → C'est ici qu'on applique la règle **≥ 1 produit**.
3. **Revue (admin).** L'admin consulte la file `GET /api/admin/suppliers/pending`,
   examine la boutique **et la liste des produits proposés**, puis décide.
4. **Approbation (admin).** `POST /api/admin/suppliers/validate` avec `action=APPROVE` :
   - passe `statut = APPROVED` ;
   - ajoute le rôle `FOURNISSEUR` ;
   - active le rattachement des produits sélectionnés ;
   - pousse une notification `SUPPLIER_APPROVED`.
   **Pré-condition de validation : au moins 1 produit rattaché.**
5. **Reconnexion / refresh.** Le JWT contient les rôles ; après approbation,
   l'utilisateur doit rafraîchir sa session (re-login ou refresh `/auth/me`) pour
   accéder à l'espace fournisseur.
6. **Exploitation (fournisseur).** Le fournisseur gère ses produits, consulte ses
   commandes (`/api/supplier/orders`) et ses statistiques (`/api/supplier/stats`).

### 4.3. Règles de gestion

- **R1.** Un compte ne peut avoir qu'**une seule** demande/profil fournisseur.
- **R2.** Un fournisseur **APPROVED** doit conserver **≥ 1 produit actif**. Le
  retrait de son dernier produit est refusé (`409`) ou bascule la boutique en état
  « sans produit » non visible côté catalogue (selon variante choisie en 5.4).
- **R3.** La suspension désactive le rôle mais **conserve** les données (produits,
  profil) pour une réactivation sans ressaisie.
- **R4.** Un produit ne peut être proposé par un fournisseur que s'il est `is_active`
  au catalogue.
- **R5.** Le prix de vente public reste piloté par le moteur de pricing existant
  (`prix_affiche`) ; le fournisseur saisit éventuellement son prix de gros
  (`prix_gros_saisi`) selon le modèle d'offre retenu.

---

## 5. Décision d'architecture : rattachement produit ↔ fournisseur

La règle « au moins 1 produit, jusqu'à tous les produits du catalogue » impose de
choisir comment un fournisseur est relié aux produits.

### 5.1. Option A — Mono-fournisseur par produit (existant)

On réutilise `T_Product.fournisseur_id`. Un produit appartient à **un seul**
fournisseur. « Tous les produits du catalogue » = le fournisseur met son `id` sur
tous les produits qu'il « possède ».

- ✅ Déjà en base, aucune migration de schéma.
- ✅ Simple à requêter (les stats actuelles l'utilisent déjà :
  `Product.fournisseur_id == user_id`).
- ❌ **Un même produit ne peut pas être proposé par deux fournisseurs** → pas de
  vraie place de marché concurrentielle ; un produit « pris » est indisponible pour
  les autres.
- ❌ Mélange « référentiel catalogue » et « offre commerciale » dans une seule table.

### 5.2. Option B — Table d'offres multi-fournisseurs (recommandée)

On introduit une table d'association `t_fournisseur_produits` (une **offre**) :

```
t_fournisseur_produits
  id              serial PK
  fournisseur_id  int  FK → t_fournisseurs.user_id
  produit_id      int  FK → T_Product.id
  prix_gros       numeric        -- prix fournisseur (optionnel)
  stock           numeric DEFAULT 0
  is_active       boolean DEFAULT true
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
  UNIQUE (fournisseur_id, produit_id)   -- une offre par couple
```

- ✅ Un produit du catalogue peut être proposé par **plusieurs** fournisseurs (prix,
  stock, statut propres à chacun).
- ✅ Sépare proprement le **référentiel** (`T_Product`) de l'**offre** commerciale.
- ✅ La règle « ≥ 1 produit » devient un simple
  `COUNT(*) FROM t_fournisseur_produits WHERE fournisseur_id = :id AND is_active`.
- ✅ « Jusqu'à tous les produits » = autant de lignes que de produits catalogue.
- ❌ Nécessite une migration et l'adaptation des requêtes stats/commandes.

### 5.3. Recommandation

**Adopter l'Option B** (`t_fournisseur_produits`) comme modèle cible, car elle seule
exprime correctement « jusqu'à tous les produits du catalogue » dans un contexte
multi-fournisseurs, et isole l'offre du référentiel.

Stratégie de migration douce : conserver `T_Product.fournisseur_id` à court terme
(compatibilité avec les stats actuelles), créer `t_fournisseur_produits`, puis
migrer progressivement les lectures vers la table d'offres. À terme,
`fournisseur_id` sur `T_Product` peut être déprécié.

### 5.4. Application concrète de la règle « ≥ 1 produit »

Trois niveaux de garde, du plus permissif au plus strict :

1. **Validation applicative (service).** À l'approbation et à chaque retrait
   d'offre, le service vérifie `count(offres actives) ≥ 1`. Refus `409` si la
   suppression viderait la boutique.
2. **Pré-condition d'approbation.** `validate_supplier_request(APPROVE)` lève `409`
   si le candidat n'a rattaché aucun produit.
3. **Garde-fou base (optionnel).** Un trigger PostgreSQL `BEFORE DELETE/UPDATE`
   empêchant qu'un fournisseur `APPROVED` tombe à zéro offre active.

Recommandé : niveaux 1 + 2 (logique métier dans le service, testable), le niveau 3
en filet de sécurité si l'intégrité doit être garantie hors application.

---

## 6. Modèle de données — récapitulatif

### 6.1. Tables impactées

| Table | Statut | Rôle dans le Mode Fournisseur |
|-------|--------|-------------------------------|
| `t_users` | existant | compte unique, porte `role` legacy + relations |
| `t_clients` | existant | profil client conservé |
| `t_fournisseurs` | existant | profil boutique + machine à états |
| `T_Product` | existant | référentiel catalogue ; `fournisseur_id` (Option A) |
| `t_fournisseur_produits` | **à créer** | offres fournisseur (Option B) |
| `roles` / `permissions` / `role_permissions` / `user_roles` | existant | RBAC multi-rôles |
| `t_notification_outbox` | existant | événements `SUPPLIER_*` |

### 6.2. Entité SQLAlchemy à créer (Option B)

```python
# entities/fournisseur_produit_entity.py
class FournisseurProduit(Base):
    __tablename__ = "t_fournisseur_produits"
    __table_args__ = (
        UniqueConstraint("fournisseur_id", "produit_id",
                         name="uq_fournisseur_produit"),
    )
    id             = Column(Integer, primary_key=True, autoincrement=True)
    fournisseur_id = Column(Integer, ForeignKey("t_fournisseurs.user_id"),
                            nullable=False, index=True)
    produit_id     = Column(Integer, ForeignKey("T_Product.id"),
                            nullable=False, index=True)
    prix_gros      = Column(Float, nullable=True)
    stock          = Column(Float, default=0.0)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(),
                            onupdate=func.now())

    fournisseur = relationship("Fournisseur", back_populates="offres")
    produit     = relationship("Product", back_populates="offres_fournisseurs")
```

Relations à ajouter : `Fournisseur.offres` et `Product.offres_fournisseurs`.

### 6.3. Migration SQL (esquisse, alignée sur `sql/`)

```sql
BEGIN;

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

-- Reprise depuis l'existant (Option A → B) :
INSERT INTO t_fournisseur_produits (fournisseur_id, produit_id, is_active)
SELECT fournisseur_id, id, is_active
FROM "T_Product"
WHERE fournisseur_id IS NOT NULL
ON CONFLICT (fournisseur_id, produit_id) DO NOTHING;

COMMIT;
```

Le pattern (script dans `back-end/sql/AAAA-MM-JJ_*.sql` + service de sync au
démarrage type `supplier_schema_sync_service.py`) est identique à celui utilisé pour
`t_fournisseurs`.

---

## 7. RBAC — rôles et permissions

### 7.1. Existant (à conserver)

Rôle `FOURNISSEUR` et permissions déjà déclarées dans `rbac_config.py` :

| Permission | Usage |
|------------|-------|
| `supplier.request.create` | rattachée à `CLIENT` — soumettre une demande |
| `supplier.dashboard.view` | accès dashboard fournisseur (route `/supplier`) |
| `supplier.profile.read` / `supplier.profile.update` | profil boutique |
| `supplier.products.read` / `.create` / `.update` / `.delete` | gestion produits |
| `supplier.orders.read` / `.update_status` | commandes du fournisseur |
| `supplier.stats.read` | statistiques de vente |

Mapping `ROLE_PERMISSION_MAP` : `CLIENT → supplier.request.create` ;
`FOURNISSEUR → supplier.*`.

> Note technique (déjà documentée) : la contrainte
> `uq_permissions_resource_action` impose de **namespacer** les resources
> (`supplier.products`, `supplier.orders`…) pour ne pas entrer en collision avec
> `products.read` du back-office.

### 7.2. À exploiter (aujourd'hui non câblé)

Les permissions `supplier.products.*` existent mais **ne sont rattachées à aucun
endpoint**. La conception les branche sur le nouveau contrôleur produits fournisseur
(section 8.2). Aucune nouvelle permission n'est requise pour la v1.

### 7.3. Garde d'autorisation

Réutilisation des dépendances existantes :
`require_role("CLIENT")`, `require_role("FOURNISSEUR")`,
`require_permission("supplier.products.update")`,
`require_permission("admin.panel.access")`. La source d'autorité reste la base
(`user_roles`), rechargée à chaque requête par `require_auth`.

---

## 8. Conception des API

### 8.1. Endpoints existants (réutilisés)

| Méthode | Route | Garde | Rôle |
|---------|-------|-------|------|
| POST | `/api/supplier/request` | `require_role("CLIENT")` | Demande de transformation |
| GET  | `/api/supplier/profile` | `require_role("FOURNISSEUR")` | Profil boutique |
| PUT  | `/api/supplier/profile` | `supplier.profile.update` | Édition boutique |
| GET  | `/api/supplier/stats` | `supplier.stats.read` | Statistiques |
| GET  | `/api/supplier/orders` | `supplier.orders.read` | Commandes |
| GET  | `/api/admin/suppliers/pending` | `admin.panel.access` | File de validation |
| GET  | `/api/admin/suppliers` | `admin.panel.access` | Liste paginée + filtres |
| POST | `/api/admin/suppliers/validate` | `admin.panel.access` | Approve/Reject/Suspend |
| PUT  | `/api/admin/suppliers/{id}/suspend` | `admin.panel.access` | Suspension |
| PUT  | `/api/admin/suppliers/{id}/reactivate` | `admin.panel.access` | Réactivation |

### 8.2. Endpoints à créer — gestion des produits fournisseur

Nouveau contrôleur `controllers/supplier_products_controller.py`
(préfixe `/api/supplier/products`) :

| Méthode | Route | Garde | Description |
|---------|-------|-------|-------------|
| GET | `/api/supplier/products` | `supplier.products.read` | Offres du fournisseur connecté |
| GET | `/api/supplier/products/catalogue` | `supplier.products.read` | Catalogue avec flag « déjà proposé » pour sélection |
| POST | `/api/supplier/products` | `supplier.products.create` | Ajouter une/des offre(s) (par `produit_id`) |
| PUT | `/api/supplier/products/{produit_id}` | `supplier.products.update` | MAJ prix/stock/activation d'une offre |
| DELETE | `/api/supplier/products/{produit_id}` | `supplier.products.delete` | Retirer une offre (refus si dernière — R2) |

Endpoint optionnel pour la sélection groupée à la demande :

| Méthode | Route | Garde | Description |
|---------|-------|-------|-------------|
| PUT | `/api/supplier/products/selection` | `supplier.products.create` | Remplace la sélection (liste de `produit_id`), valide « ≥ 1 » |

### 8.3. DTO à ajouter (`dto/supplier_dto.py`)

```python
class SupplierProductOfferDTO(BaseModel):          # réponse
    produit_id: int
    nom_fr: str
    nom_darija: str
    unite: str
    prix_affiche: float | None = None
    prix_gros: float | None = None
    stock: float = 0
    is_active: bool = True

class SupplierProductCreateDTO(BaseModel):          # requête création
    produit_id: int
    prix_gros: float | None = None
    stock: float = 0

class SupplierProductUpdateDTO(BaseModel):          # requête maj
    prix_gros: float | None = None
    stock: float | None = None
    is_active: bool | None = None

class SupplierProductSelectionDTO(BaseModel):       # sélection groupée
    produit_ids: list[int] = Field(min_items=1)     # garantit ≥ 1 produit
```

`min_items=1` sur `produit_ids` matérialise la règle « au moins 1 produit » dès la
validation Pydantic, complétée par la vérification service (section 5.4).

### 8.4. Adaptation des statistiques et commandes (Option B)

Avec la table d'offres, les agrégats actuels de `fournisseur_service`
(`get_supplier_stats`, `get_supplier_orders`) qui joignent sur
`Product.fournisseur_id == user_id` sont remplacés par une jointure via
`t_fournisseur_produits` :

```
Commande → Panier → LignePanier → Product → FournisseurProduit(fournisseur_id = user_id)
```

`products_count` devient `COUNT(offres)`, `active_products_count` =
`COUNT(offres WHERE is_active)`.

---

## 9. Conception Frontend (Next.js)

### 9.1. Routage et rôles

Le frontend lit les rôles depuis `/auth/me` (bloc `roles` + `profiles.fournisseur`).
Logique d'accès :

- Utilisateur **CLIENT sans profil fournisseur** → voit l'entrée « Devenir
  fournisseur ».
- Profil **PENDING** → écran « Demande en cours de validation ».
- Profil **APPROVED** (+ rôle `FOURNISSEUR`) → accès à l'espace `/supplier`.
- Profil **SUSPENDED/REJECTED** → message dédié + recours.

Un compte multi-rôles (CLIENT + FOURNISSEUR) nécessite un **sélecteur d'espace**
(switch « Acheter » / « Vendre ») dans la navigation.

### 9.2. Écrans à créer

| Écran | Route | Contenu |
|-------|-------|---------|
| Devenir fournisseur | `/devenir-fournisseur` | Formulaire boutique + **sélection ≥ 1 produit** du catalogue |
| Statut de la demande | `/devenir-fournisseur/statut` | État PENDING / REJECTED + raison |
| Dashboard | `/supplier` | KPIs (produits, commandes, CA) depuis `/api/supplier/stats` |
| Mes produits | `/supplier/produits` | Catalogue sélectionnable, prix/stock, activation, garde « dernier produit » |
| Mes commandes | `/supplier/commandes` | Liste depuis `/api/supplier/orders` |
| Mon profil | `/supplier/profil` | Édition via `/api/supplier/profile` |
| Validation (admin) | `/admin/fournisseurs` | File `pending`, approve/reject/suspend |

### 9.3. Intégration technique

- Réutiliser le client API (`front-end/lib/api.ts`) et le `auth-context.tsx`.
- Composants admin alignés sur `front-end/components/admin/`.
- Le formulaire de demande impose la sélection d'au moins un produit avant envoi
  (validation côté UI), en miroir de la garde backend.

---

## 10. Sécurité, intégrité et cas limites

- **Unicité de la demande** : `exists_by_user_id` empêche les doublons (`409`).
- **Slug unique** : génération incrémentale `boutique`, `boutique-2`, … (déjà géré).
- **Cohérence des rôles** : approbation/suspension passent par
  `AuthorizationDao.assign_role_to_user` / `deactivate_role_for_user` ; pas de
  manipulation directe de `t_users.role` (legacy).
- **Règle ≥ 1 produit** : double garde (Pydantic `min_items=1` + vérification
  service au retrait), trigger DB optionnel.
- **Produit inactif au catalogue** : une offre sur un produit `is_active = false`
  est masquée et non commandable (R4).
- **JWT obsolète** : après approbation, prévoir refresh/`/auth/me` pour matérialiser
  le nouveau rôle sans re-login forcé.
- **Suspension sans perte** : données conservées pour réactivation (R3).
- **Concurrence** : `UNIQUE (fournisseur_id, produit_id)` empêche les offres
  dupliquées ; gérer `IntegrityError → 409`.

---

## 11. Plan de mise en œuvre

### Backend
1. Créer l'entité `FournisseurProduit` + relations, migration SQL `t_fournisseur_produits` et service de sync schéma.
2. Créer `dao/supplier_product_dao.py` (+ interface) : list, upsert, delete, count actif.
3. Créer `services/supplier_product_service.py` : sélection, MAJ, retrait avec garde « ≥ 1 ».
4. Créer `controllers/supplier_products_controller.py` (section 8.2), enregistrer le router dans `main.py`.
5. Ajouter les DTO (section 8.3) à `supplier_dto.py`.
6. Adapter `get_supplier_stats` / `get_supplier_orders` vers la table d'offres.
7. Ajouter la pré-condition « ≥ 1 produit » dans `validate_supplier_request(APPROVE)`.

### Frontend
8. Écran « Devenir fournisseur » avec sélection catalogue (≥ 1).
9. Sélecteur d'espace multi-rôles + garde de routes.
10. Dashboard, Mes produits, Mes commandes, Profil.
11. Écran admin de validation.

### Transverse
12. Tests : machine à états, règle « ≥ 1 produit », autorisations par permission.
13. Vérifier `configure_mappers()` et `compileall` (comme pour l'ajout `t_fournisseurs`).

---

## 12. Synthèse

| Brique | État actuel | Action |
|--------|-------------|--------|
| Profil `t_fournisseurs` + cycle de validation | ✅ implémenté | Réutiliser |
| Rôle `FOURNISSEUR` + permissions `supplier.*` | ✅ déclaré | Réutiliser |
| Transformation additive CLIENT → CLIENT+FOURNISSEUR | ✅ implémenté | Réutiliser |
| Lien produit↔fournisseur | ⚠️ mono (`fournisseur_id`) | Migrer vers `t_fournisseur_produits` (Option B) |
| Règle « ≥ 1 produit, jusqu'à tout le catalogue » | ❌ absente | Implémenter (Pydantic + service + pré-condition admin) |
| Endpoints produits fournisseur | ❌ absents | Créer `/api/supplier/products/*` |
| Frontend fournisseur | ❌ absent | Créer les écrans + routage multi-rôles |

La transformation client → fournisseur s'appuie sur un compte **unique** enrichi
d'un profil boutique et d'un rôle additif ; la valeur ajoutée de cette conception est
de **brancher la gestion des produits** (modèle d'offres multi-fournisseurs) et
d'**imposer la règle métier « au moins 1 produit, jusqu'à tout le catalogue »** à
chaque étape — UI, API et base de données.
