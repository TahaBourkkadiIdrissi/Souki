# Dashboard Admin SOUKI - Correctifs Metriques Et Comparaison

## Objectif

Corriger les metriques du dashboard admin SOUKI, ajouter le filtre `Jour precis`, documenter la comparaison automatique avec la periode precedente, et retirer les champs devenus ambigus.
Raffiner ensuite les KPIs et la courbe CA : KPI contextuel, nouveaux clients avec variation, badge JIT du jour et courbe adaptee a la periode.

## Endpoint

Endpoint modifie :

```http
GET /admin/dashboard?periode=today&date_custom=2026-05-07
```

Signature controller :

```python
@admin_router.get("/dashboard", response_model=DashboardDTO)
def get_admin_dashboard_context(
    periode: str = Query(default="today"),
    date_custom: str | None = Query(default=None),
    principal=Depends(require_permission("admin.panel.access")),
    service: IDashboardService = Depends(get_dashboard_service),
):
```

Parametres acceptes :

- `periode`: `today`, `7d`, `30d`, `month`, `custom`
- `date_custom`: format `YYYY-MM-DD`, requis uniquement si `periode=custom`

Permission :

```python
require_permission("admin.panel.access")
```

Flux MVC2 :

- Controller : recoit HTTP, ouvre `LocalSession()`, appelle le service, ferme la session.
- Service : valide `periode`, parse `date_custom`, calcule les bornes temporelles.
- DAO : execute les requetes SQLAlchemy lecture seule.

## Logique Periode Et Comparaison

| Periode | Periode actuelle | Periode precedente |
|---|---|---|
| `today` | aujourd'hui 00:00 -> aujourd'hui 23:59:59 | hier 00:00 -> hier 23:59:59 |
| `7d` | aujourd'hui - 7j 00:00 -> aujourd'hui 23:59:59 | aujourd'hui - 14j 00:00 -> aujourd'hui - 7j 23:59:59 |
| `30d` | aujourd'hui - 30j 00:00 -> aujourd'hui 23:59:59 | aujourd'hui - 60j 00:00 -> aujourd'hui - 30j 23:59:59 |
| `month` | 1er du mois 00:00 -> aujourd'hui 23:59:59 | 1er du mois precedent 00:00 -> dernier jour du mois precedent 23:59:59 |
| `custom` | `date_custom` 00:00 -> `date_custom` 23:59:59 | jour precedent 00:00 -> jour precedent 23:59:59 |

Erreurs :

- `periode` inconnue -> `HTTPException(400, "Periode invalide.")`
- `periode=custom` sans `date_custom` -> `HTTPException(400, "date_custom est requis pour la periode custom.")`
- `date_custom` invalide -> `HTTPException(400, "date_custom doit etre au format YYYY-MM-DD.")`

## DTO Complet

Fichier :

- `back-end/dto/dashboard_dto.py`

```python
class DashboardDTO(BaseModel):
    periode: str
    date_custom: Optional[str] = None
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
    taux_livraison: float = 0.0
    taux_absence: float = 0.0

    ca_total: float = 0.0
    ca_total_precedent: float = 0.0
    ca_cod: float = 0.0
    ca_wallet: float = 0.0
    ca_cmi: float = 0.0
    panier_moyen: float = 0.0

    total_clients_actifs: int = 0
    nouveaux_clients: int = 0
    nouveaux_clients_precedent: int = 0
    clients_blacklistes: int = 0

    dernier_jit_statut: Optional[str] = None
    dernier_jit_volume: float = 0.0
    dernier_jit_nb_commandes: int = 0
    dernier_jit_date: Optional[datetime] = None
    jit_execute_aujourdhui: bool = False

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

## Metriques Ajoutees Et Supprimees

Ajoute :

- `date_custom`
- `taux_absence`
- `nouveaux_clients_precedent`
- `jit_execute_aujourdhui`

Conserve pour les variations :

- `ca_total_precedent`
- `total_commandes_precedent`
- `commandes_livrees_precedent`
- `nouveaux_clients_precedent`

Supprime :

- `ca_cash`
- `commandes_confirmees`
- `total_soldes_wallets`

## Tables Utilisees Et Champs Lus

| Table | Champs lus | Usage |
|---|---|---|
| `t_commandes` | `id`, `date_commande`, `statut`, `montant_total`, `mode_paiement` | KPIs commandes, CA, panier moyen, taux livraison, taux absence, courbe CA, statuts, paiements |
| `t_paiements` | `commande_id`, `methode` | Fallback mode paiement |
| `t_clients` | `user_id`, `is_blacklisted` | Clients blacklistes via `client_admin_dao` |
| `t_users` | `id`, `role`, `is_active`, `created_at` | Clients actifs et nouveaux clients via `client_admin_dao` |
| `t_jit_logs` | `id`, `statut`, `volume_total`, `nombre_commandes`, `date_execution` | Dernier job JIT |
| `t_livreurs` | `user_id`, `disponible` | Livreurs disponibles |
| `t_tournees` | `id`, `date_tournee`, `statut` | Tournees actives du jour |
| `t_cod_confirmation_logs` | `id`, `statut`, `created_at` | COD confirmes, annules et taux confirmation |
| `t_client_blacklist_logs` | `id`, `action`, `created_at` | Nouveaux blacklistes et blacklists leves via `client_blacklist_dao` |

## Regle Anti-Duplication

`dashboard_dao.py` conserve l'injection constructeur :

```python
def __init__(
    self,
    client_blacklist_dao: IClientBlacklistDao,
    client_admin_dao: IClientAdminDao,
) -> None:
```

DAOs reutilises :

- `ClientAdminDaoBD`
  - `count_active_clients()`
  - `count_new_clients()`
  - `count_blacklisted_clients()`
- `ClientBlacklistDaoBD`
  - `get_action_counts_by_period()`

Aucun `LocalSession()` dans `dashboard_dao.py`.
Aucune instanciation directe de `ClientAdminDaoBD()` ou `ClientBlacklistDaoBD()` dans `dashboard_dao.py`.

## Filtre BROUILLON

Toutes les requetes basees sur `t_commandes` utilisent :

```python
func.upper(func.coalesce(Commande.statut, "")) != "BROUILLON"
```

Cela couvre :

- total commandes actuel
- total commandes precedent
- commandes livrees precedentes
- statuts commandes
- CA total
- CA precedent
- CA par paiement
- courbe CA 30 jours
- repartition paiements

## Courbe CA

La courbe CA suit maintenant la periode selectionnee :

| Periode | Fenetre courbe |
|---|---|
| `today` | aujourd'hui |
| `7d` | periode `7d` selectionnee |
| `30d` | periode `30d` selectionnee |
| `month` | du 1er du mois courant a aujourd'hui |
| `custom` | 30 jours fixes, de `date_custom - 29j` a `date_custom` |

La courbe exclut toujours les commandes `BROUILLON`.

## JIT Execute Aujourd'hui

Champ ajoute :

```python
jit_execute_aujourdhui: bool = False
```

Calcul DAO :

```python
func.date(JITLog.date_execution) == today
func.lower(JITLog.statut).in_(["succès", "succes", "success"])
```

Le champ vaut `True` si au moins un log JIT du jour existe avec un statut de succes robuste.

## Frontend

Fichiers modifies :

- `front-end/lib/api.ts`
- `front-end/app/admin/page.tsx`

Changements API :

- `DashboardPeriod` accepte maintenant `custom`.
- `getAdminDashboard()` accepte `date_custom`.
- `DashboardDTO` TypeScript retire `ca_cash` et `commandes_confirmees`.
- `DashboardDTO` TypeScript ajoute `date_custom` et `taux_absence`.

Changements page :

- Filtre sticky :
  - Aujourd'hui
  - 7 jours
  - 30 jours
  - Ce mois
  - Jour precis
  - Actualiser
- Si `Jour precis` est actif :
  - input `type=date`
  - `max` = date du jour
  - changement de date -> refetch via changement d'etat
- Texte discret de comparaison :
  - hier
  - 7 jours precedents
  - 30 jours precedents
  - mois precedent
  - jour precedent
- KPIs principaux :
  - CA Total
  - Total commandes
  - Livrees + taux
  - En route si `today`, sinon Panier moyen
  - Nouveaux clients
  - Taux absence
- `Blacklistes` retire des KPIs principaux.
- `commandes_confirmees` retire de l'affichage.
- Variations affichees uniquement sur :
  - CA Total
  - Total commandes
  - Livrees
  - Nouveaux clients
- Badge JIT sur la card `Commandes` uniquement si `periode=today` :
  - `JIT execute` en vert si `jit_execute_aujourdhui=true`
  - `JIT en attente` en amber sinon
- Titre de la courbe CA dynamique selon la periode :
  - `CA du jour (DH)`
  - `CA 7 derniers jours (DH)`
  - `CA 30 derniers jours (DH)`
  - `CA ce mois (DH)`
  - `CA autour du {date_custom} (DH)`
- Card JIT enrichie :
  - statut
  - tournees actives
  - volume
  - nombre commandes
  - panier moyen physique
  - dernier job
- Card COD simplifiee :
  - taux confirmation
  - progress bar
  - confirmes / annules
- Card Blacklist enrichie :
  - blacklistes actifs
  - nouveaux periode
  - leves periode
  - solde net

## Fichiers Modifies

Backend :

- `back-end/controllers/admin_controller.py`
- `back-end/dto/dashboard_dto.py`
- `back-end/interfaces/dashboard_dao_interface.py`
- `back-end/interfaces/dashboard_service_interface.py`
- `back-end/services/dashboard_service.py`
- `back-end/dao/dashboard_dao.py`
- `back-end/dao/client_admin_dao.py`
- `back-end/dao/client_blacklist_dao.py`

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
