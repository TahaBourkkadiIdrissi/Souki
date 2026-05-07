# Dashboard Admin SOUKI

## Objectif

Remplacer le contenu du dashboard admin par une vue back-office dense, connectee a `GET /admin/dashboard`, avec filtre de periode, KPIs, graphiques Recharts, cards operationnelles et auto-refresh silencieux.

## Tables Utilisees

| Table | Champs lus | Usage |
|---|---|---|
| `t_commandes` | `id`, `date_commande`, `statut`, `montant_total`, `mode_paiement` | KPIs commandes, CA, courbe CA 30 jours, repartition statuts, repartition paiements |
| `t_paiements` | `commande_id`, `methode` | Fallback mode paiement avec jointure commande |
| `t_clients` | `user_id`, `is_blacklisted` | Clients blacklistes, jointure clients/users |
| `t_users` | `id`, `role`, `is_active`, `created_at` | Clients actifs et nouveaux clients |
| `t_jit_logs` | `id`, `statut`, `volume_total`, `date_execution` | Dernier statut JIT, volume, date |
| `t_livreurs` | `user_id`, `disponible` | Livreurs disponibles |
| `t_tournees` | `id`, `date_tournee`, `statut` | Tournees actives du jour |
| `t_cod_confirmation_logs` | `id`, `statut`, `created_at` | COD confirmes et annules |
| `t_client_blacklist_logs` | `id`, `action`, `created_at` | Nouveaux blacklistes et blacklists leves |
| `t_wallets` | `solde` | Total soldes wallets |

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
- defaut: `today`

Permission :

```python
require_permission("admin.panel.access")
```

Flux MVC2 :

- Controller : ouvre `LocalSession()`, appelle le service, ferme la session.
- Service : valide la periode et calcule les bornes temporelles.
- DAO : execute toutes les requetes SQLAlchemy.

## DTO

Fichier :

- `back-end/dto/dashboard_dto.py`

DTO principal :

```python
class DashboardDTO(BaseModel):
    total_commandes: int = 0
    commandes_livrees: int = 0
    commandes_en_route: int = 0
    commandes_annulees: int = 0
    commandes_absentes: int = 0
    taux_livraison: float = 0.0

    ca_total: float = 0.0
    ca_cod: float = 0.0
    ca_wallet: float = 0.0
    ca_cmi: float = 0.0

    total_clients_actifs: int = 0
    nouveaux_clients: int = 0
    clients_blacklistes: int = 0

    dernier_jit_statut: Optional[str] = None
    dernier_jit_volume: float = 0.0
    dernier_jit_date: Optional[datetime] = None

    livreurs_disponibles: int = 0
    tournees_actives: int = 0

    cod_confirmes: int = 0
    cod_annules: int = 0

    nouveaux_blacklistes: int = 0
    blacklists_leves: int = 0

    total_soldes_wallets: float = 0.0

    courbe_ca: List[CourbeCADTO] = []
    repartition_statuts: List[RepartitionStatutDTO] = []
    repartition_paiements: List[RepartitionPaiementDTO] = []
```

DTO enfants :

```python
class CourbeCADTO(BaseModel):
    date: str
    ca: float = 0.0
    nb_commandes: int = 0

class RepartitionStatutDTO(BaseModel):
    statut: str
    count: int = 0

class RepartitionPaiementDTO(BaseModel):
    mode: str
    count: int = 0
    montant: float = 0.0
```

## Backend Cree

| Fichier | Role |
|---|---|
| `back-end/dto/dashboard_dto.py` | DTO de sortie dashboard |
| `back-end/interfaces/dashboard_dao_interface.py` | Contrat DAO |
| `back-end/interfaces/dashboard_service_interface.py` | Contrat service |
| `back-end/dao/dashboard_dao.py` | Requetes SQLAlchemy lecture seule |
| `back-end/services/dashboard_service.py` | Validation periode et orchestration |

## Backend Modifie

| Fichier | Modification |
|---|---|
| `back-end/controllers/admin_controller.py` | `GET /admin/dashboard` retourne maintenant `DashboardDTO` |
| `back-end/dependencies.py` | Ajout providers `get_dashboard_dao()` et `get_dashboard_service()` |

## Frontend Modifie

| Fichier | Modification |
|---|---|
| `front-end/lib/api.ts` | Ajout types Dashboard et fonction `getAdminDashboard()` |
| `front-end/app/admin/page.tsx` | Remplacement du contenu dashboard par une vue connectee avec periode sticky, KPIs, AreaChart, PieChart, cards JIT/COD/Wallet |

## Check Flush/Commit

| Fichier | Role | flush() OK ? | commit() OK ? | LocalSession() absent ? | Statut |
|---|---|---:|---:|---:|---|
| `back-end/dao/dashboard_dao.py` | DAO | N/A lecture seule | Oui, aucun commit | Oui | OK |
| `back-end/services/dashboard_service.py` | Service | N/A | N/A lecture seule | Oui | OK |
| `back-end/controllers/admin_controller.py` | Controller | N/A | N/A | Non, attendu controller | OK |
| `back-end/dependencies.py` | Injection | N/A | N/A | Oui | OK |

Violations trouvees dans les nouveaux fichiers :

- Aucune.

Violations existantes :

- Non traitees dans cette mission, conformement au scope.

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

Contraintes respectees :

- Aucune entity modifiee.
- Aucune table SQL creee.
- `livreur_dao.py` non touche.
- `livreur_service.py` non touche.
- Aucun backend non lie au dashboard modifie dans cette mission.
