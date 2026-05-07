# Dashboard Admin SOUKI - Refonte Complete

## Objectif

Remplacer le dashboard admin par une vue executive dense type Power BI/Shopify adaptee a SOUKI, avec KPIs en ligne, graphes en grille, filtre de periode sticky, auto-refresh silencieux et accents verts `#1E8A3C`.

## Endpoint

Endpoint modifie :

```http
GET /admin/dashboard?periode=today
```

Signature controller :

```python
@admin_router.get("/dashboard", response_model=DashboardDTO)
def get_admin_dashboard_context(
    periode: str = Query(default="today"),
    principal=Depends(require_permission("admin.panel.access")),
    service: IDashboardService = Depends(get_dashboard_service),
):
```

Parametres :

- `periode`: `today`, `7d`, `30d`, `month`
- Defaut: `today`

Permission :

```python
require_permission("admin.panel.access")
```

Flux MVC2 :

- Controller : ouvre `LocalSession()`, appelle le service, ferme la session.
- Service : valide la periode et calcule les bornes temporelles courantes et precedentes.
- DAO : execute les requetes SQLAlchemy lecture seule.

## DTO Complet

Fichier :

- `back-end/dto/dashboard_dto.py`

DTO principal :

```python
class DashboardDTO(BaseModel):
    periode: str
    date_debut: datetime
    date_fin: datetime
    derniere_maj: datetime

    total_commandes: int = 0
    total_commandes_precedent: int = 0
    commandes_livrees: int = 0
    commandes_livrees_precedent: int = 0
    commandes_en_route: int = 0
    commandes_annulees: int = 0
    commandes_absentes: int = 0
    commandes_confirmees: int = 0
    taux_livraison: float = 0.0

    ca_total: float = 0.0
    ca_total_precedent: float = 0.0
    ca_cod: float = 0.0
    ca_wallet: float = 0.0
    ca_cmi: float = 0.0
    ca_cash: float = 0.0
    panier_moyen: float = 0.0

    total_clients_actifs: int = 0
    nouveaux_clients: int = 0
    clients_blacklistes: int = 0

    dernier_jit_statut: Optional[str] = None
    dernier_jit_volume: float = 0.0
    dernier_jit_nb_commandes: int = 0
    dernier_jit_date: Optional[datetime] = None

    livreurs_disponibles: int = 0
    tournees_actives: int = 0

    cod_confirmes: int = 0
    cod_annules: int = 0
    taux_confirmation_cod: float = 0.0

    nouveaux_blacklistes: int = 0
    blacklists_leves: int = 0

    courbe_ca: List[DashboardPointDTO] = []
    repartition_statuts: List[DashboardStatutDTO] = []
    repartition_paiements: List[DashboardPaiementDTO] = []
```

DTO enfants :

```python
class DashboardPointDTO(BaseModel):
    date: str
    ca: float = 0.0
    nb_commandes: int = 0

class DashboardStatutDTO(BaseModel):
    statut: str
    count: int = 0
    pourcentage: float = 0.0

class DashboardPaiementDTO(BaseModel):
    mode: str
    count: int = 0
    montant: float = 0.0
    pourcentage: float = 0.0
```

Champ supprime :

- `total_soldes_wallets` retire du DTO backend, du type frontend et de la page dashboard.

Champs ajoutes pour variation frontend :

- `ca_total_precedent`
- `total_commandes_precedent`
- `commandes_livrees_precedent`

La variation frontend est calculee par :

```ts
((actuel - precedent) / precedent) * 100
```

Les KPIs `panier moyen`, `clients actifs` et `blacklistes` n'affichent pas de variation.

## Tables Utilisees Et Champs Lus

| Table | Champs lus | Usage |
|---|---|---|
| `t_commandes` | `id`, `date_commande`, `statut`, `montant_total`, `mode_paiement` | KPIs commandes, CA, panier moyen, courbe CA, statuts, paiements |
| `t_paiements` | `commande_id`, `methode` | Fallback mode paiement |
| `t_clients` | `user_id`, `is_blacklisted` | Clients blacklistes via `client_admin_dao` |
| `t_users` | `id`, `role`, `is_active`, `created_at` | Clients actifs et nouveaux clients via `client_admin_dao` |
| `t_jit_logs` | `id`, `statut`, `volume_total`, `nombre_commandes`, `date_execution` | Dernier job JIT |
| `t_livreurs` | `user_id`, `disponible` | Livreurs disponibles |
| `t_tournees` | `id`, `date_tournee`, `statut` | Tournees actives du jour |
| `t_cod_confirmation_logs` | `id`, `statut`, `created_at` | COD confirmes, annules et taux confirmation |
| `t_client_blacklist_logs` | `id`, `action`, `created_at` | Nouveaux blacklistes et blacklists leves via `client_blacklist_dao` |

## Regle Anti-Duplication Appliquee

`dashboard_dao.py` ne duplique plus les requetes clients et blacklist deja couvertes par les DAOs specialises.

DAOs reutilises :

- `ClientAdminDaoBD`
  - `count_active_clients()`
  - `count_new_clients()`
  - `count_blacklisted_clients()`
- `ClientBlacklistDaoBD`
  - `get_action_counts_by_period()`

Injection :

```python
def get_dashboard_dao(
    blacklist_dao: IClientBlacklistDao = Depends(get_blacklist_dao),
    client_admin_dao: IClientAdminDao = Depends(get_client_admin_dao),
) -> IDashboardDao:
    return DashboardDaoBD(
        client_blacklist_dao=blacklist_dao,
        client_admin_dao=client_admin_dao,
    )
```

## Filtre BROUILLON

Toutes les requetes basees sur `t_commandes` utilisent le filtre :

```python
func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON"
```

Cela couvre :

- total commandes
- commandes precedentes
- statuts commandes
- CA total
- CA precedent
- CA par paiement
- courbe CA 30 jours
- repartition paiements

## Frontend

Fichier modifie :

- `front-end/app/admin/page.tsx`

Fonctionnalites :

- Topbar admin conservee.
- Sidebar admin en icones conservee.
- Header `SOUKI Dashboard`.
- Derniere mise a jour basee sur `derniere_maj`.
- Filtre sticky :
  - Aujourd'hui
  - 7 jours
  - 30 jours
  - Ce mois
  - Actualiser
- 6 KPI cards horizontales :
  - CA Total
  - Commandes
  - Livrees
  - Panier moyen
  - Clients actifs
  - Blacklistes
- Variations uniquement sur :
  - CA Total
  - Commandes
  - Livrees
- Grille graphes :
  - AreaChart CA 30 jours
  - Donut statuts commandes
  - BarChart horizontal paiements
- Ligne operationnelle :
  - JIT
  - COD
  - Blacklist periode
- Loading state par skeleton cards et graphes.
- Auto-refresh silencieux toutes les 5 minutes.

Fichier API modifie :

- `front-end/lib/api.ts`

Types dashboard mis a jour pour correspondre au DTO backend.

## Fichiers Modifies

Backend :

- `back-end/dto/dashboard_dto.py`
- `back-end/interfaces/dashboard_dao_interface.py`
- `back-end/interfaces/client_admin_dao_interface.py`
- `back-end/interfaces/client_blacklist_dao_interface.py`
- `back-end/dao/dashboard_dao.py`
- `back-end/dao/client_admin_dao.py`
- `back-end/dao/client_blacklist_dao.py`
- `back-end/services/dashboard_service.py`
- `back-end/dependencies.py`

Frontend :

- `front-end/lib/api.ts`
- `front-end/app/admin/page.tsx`

Documentation :

- `dashboard.md`

## Fichiers Non Touches

- Aucune entity modifiee.
- Aucune table SQL creee ou modifiee.
- `back-end/dao/livreur_dao.py` non touche.
- `back-end/services/livreur_service.py` non touche.

## Check Flush/Commit

| Fichier | Role | flush() OK ? | commit() OK ? | LocalSession() absent ? | Statut |
|---|---|---:|---:|---:|---|
| `back-end/dao/dashboard_dao.py` | DAO | N/A lecture seule | Oui, aucun commit | Oui | OK |
| `back-end/services/dashboard_service.py` | Service | N/A | N/A lecture seule | Oui | OK |
| `back-end/dao/client_admin_dao.py` | DAO | N/A lecture seule | Oui, aucun commit | Oui | OK |
| `back-end/dao/client_blacklist_dao.py` | DAO | Oui, flush DAO existant | Oui, aucun commit | Oui | OK |
| `back-end/dependencies.py` | Injection | N/A | N/A | Oui | OK |
| `back-end/controllers/admin_controller.py` | Controller | N/A | N/A | Non, attendu controller | OK |

Violations trouvees dans les fichiers modifies :

- Aucune nouvelle violation.

## Verifications

Commandes executees :

```bash
npx tsc --noEmit
```

Resultat : OK.

```bash
python -m compileall back-end
```

Resultat : OK.

Contraintes confirmees :

- Aucune entity modifiee.
- Aucune table SQL creee.
- `livreur_dao.py` non touche.
- `livreur_service.py` non touche.
- `BROUILLON` exclu des requetes commandes.
- Blacklist dashboard basee sur `t_clients.is_blacklisted = true` via `client_admin_dao`.
