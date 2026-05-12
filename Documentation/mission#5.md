# Mission #5 - Rapport Detaille

## Objectif

Cette mission concerne l'ajout et l'ajustement des pages admin clients et blacklist COD, avec respect strict des regles projet definies dans `regles.md`.

Les objectifs traites :

- Ajouter une vraie page `/admin/clients`.
- Separer la navigation admin entre `Clients` et `Blacklist COD`.
- Garder `/admin/blacklist` reservee aux clients blacklistes.
- Afficher uniquement les clients non blacklistes dans `/admin/clients`.
- Reutiliser la fiche client existante de `/admin/orders`.
- Enrichir le rapport blacklist avec les commandes refusees et la perte totale.
- Corriger les KPIs ambigus ou calcules seulement sur la page visible.
- Verifier si la blacklist bloque les commandes COD.

## Pages Concernees

### `/admin`

Fichier :

- `front-end/app/admin/page.tsx`

Modifications :

- L'ancien item `Clients & Blacklist` pointait vers `/admin/blacklist`.
- Il a ete separe en deux entrees :
  - `Clients` vers `/admin/clients`
  - `Blacklist COD` vers `/admin/blacklist`
- Les permissions ont ete separees :
  - `/admin/clients` utilise `clients.read`
  - `/admin/blacklist` garde `clients.blacklist`

Impact fonctionnel :

- L'administrateur peut acceder directement a la gestion clients sans passer par la blacklist.
- La blacklist reste une section specialisee pour les blocages COD.

## Page `/admin/clients`

Fichier :

- `front-end/app/admin/clients/page.tsx`

Fonctionnalites ajoutees :

- Nouvelle page admin clients.
- Recherche par email/telephone avec debounce de 300 ms.
- Pagination avec 20 clients par page.
- Auto-refresh toutes les 60 secondes.
- Tableau clients avec :
  - Client
  - Telephone
  - Nombre de commandes
  - Montant total
  - Mode paiement favori
  - Date inscription
  - Actions
- Clic sur une ligne ou bouton `Fiche client` pour ouvrir la fiche client inline.
- Reutilisation du composant partage `FicheClientPanel`.

Modifications apres critique :

- La page affiche maintenant uniquement les clients non blacklistes.
- L'appel API envoie `blacklisted: false`.
- Suppression du filtre blacklist dans cette page.
- Suppression de la colonne `Statut blacklist`.
- Suppression de la sidebar interne `Liste clients / Blacklist`.
- La page est dediee a la gestion des clients seulement.

KPIs affiches :

- `Clients` : nombre total de clients non blacklistes filtres.
- `Montant total` : montant total des commandes de la page courante.
- `Commandes` : nombre de commandes de la page courante.
- `Moyenne commandes` : moyenne calculee sur tous les clients filtres, pas seulement la page courante.

Correction importante :

- Au debut, `Moyenne commandes` etait calculee sur les 20 clients visibles.
- Maintenant le backend renvoie `total_commandes`.
- Le frontend calcule :

```ts
total_commandes / total_clients
```

Donc la moyenne reste correcte meme avec pagination.

## Fiche Client Partagee

Fichier cree :

- `front-end/components/admin/client-fiche-panel.tsx`

Raison de creation :

- La fiche client existait dans `front-end/app/admin/orders/page.tsx`, mais elle etait locale a cette page.
- La demande exigeait de reutiliser exactement le meme composant dans `/admin/clients`.
- Il etait donc necessaire de l'extraire dans un composant partage.

Fonctionnalites :

- Composant `FicheClientPanel`.
- Type exporte `ClientBlockKey`.
- Bloc vide exporte `EmptyClientBlock`.
- Tabs internes :
  - `Identite`
  - `Commandes`
  - `Vocal`
  - `Sessions`
  - `Notifs`
  - `Abonnement`

Details affiches :

- Identite client.
- Adresses.
- Historique commandes.
- Paiements lies aux commandes.
- Commandes vocales.
- Sessions.
- Preferences notifications.
- Abonnement.

Modification de compatibilite :

- Les libelles ont ete remis comme dans `/admin/orders` :
  - `Commandes` au lieu de `Historique`
  - `Vocal` au lieu de `Commandes vocales`
  - `Notifs` au lieu de `Notifications`

Fichier modifie :

- `front-end/app/admin/orders/page.tsx`

Modifications :

- Suppression du bloc local duplique de fiche client.
- Import du composant partage :

```ts
import { EmptyClientBlock, FicheClientPanel, type ClientBlockKey } from "@/components/admin/client-fiche-panel"
```

Impact :

- `/admin/orders` et `/admin/clients` utilisent maintenant le meme composant.
- La logique existante d'ouverture de fiche dans orders est conservee.

## Backend Admin Clients

Fichiers crees :

- `back-end/dto/client_admin_dto.py`
- `back-end/interfaces/client_admin_dao_interface.py`
- `back-end/interfaces/client_admin_service_interface.py`
- `back-end/dao/client_admin_dao.py`
- `back-end/services/client_admin_service.py`

Fichiers modifies :

- `back-end/controllers/admin_controller.py`
- `back-end/dependencies.py`
- `back-end/main.py`
- `back-end/controllers/__init__.py`

Endpoint ajoute :

```http
GET /api/admin/clients
```

Permissions :

```py
require_permission("admin.panel.access", "clients.read")
```

Parametres :

- `search` : recherche email, telephone ou id client.
- `page` : pagination.
- `blacklisted` : filtre optionnel boolean.

Pagination :

- Taille fixe cote service : 20 clients par page.

DTO principal :

```py
class AdminClientsPageDTO(BaseModel):
    items: List[AdminClientDTO]
    total: int
    total_commandes: int = 0
    page: int
    page_size: int
    total_pages: int
```

Champs client :

- `client_id`
- `email`
- `phone`
- `nb_commandes`
- `montant_total`
- `mode_paiement_favori`
- `is_blacklisted`
- `date_inscription`

Logique DAO :

- Recupere les clients avec jointure `Client -> User`.
- Applique la recherche.
- Applique le filtre blacklist si fourni.
- Calcule le total des clients filtres.
- Calcule `total_commandes` sur tous les clients filtres.
- Recupere les statistiques de commandes pour les clients de la page.
- Calcule le mode paiement favori par client.

Respect MVC2 :

- Controller : recoit HTTP, ouvre session, appelle service.
- Service : valide la page et fixe `PAGE_SIZE = 20`.
- DAO : contient les requetes SQLAlchemy.
- DTO : Pydantic.
- Interfaces ABC : creees pour DAO et service.
- Aucune entity modifiee.

## Page `/admin/blacklist`

Fichier :

- `front-end/app/admin/blacklist/page.tsx`

Fonctionnalites existantes conservees :

- Liste des clients blacklistes.
- Recherche.
- Filtre source `AUTO_REFUS` / `ADMIN`.
- Action `Lever`.
- Rapport mensuel.
- Tables :
  - Par client
  - Par livreur
  - Par quartier

Modifications ajoutees :

- Ajout du KPI `Perte totale`.
- Ajout du KPI `Commandes refusees`.
- Suppression du KPI ambigu `Taux blacklist COD`.
- Renommage du bouton `Generer` en `Actualiser`.

Raison :

- Le rapport est deja charge automatiquement au chargement de page et au changement mois/annee.
- Le bouton ne cree rien en base.
- Il sert seulement a recharger les donnees du rapport selectionne.

Liste blacklist :

- Ajout des colonnes :
  - `Commande refusee`
  - `Perte`

Chaque ligne affiche maintenant :

- Commande liee au refus.
- Date commande.
- Statut commande.
- Montant perdu.

Rapport mensuel :

- Ajout d'un total perte affiche dans l'encart orange.
- Ajout d'une nouvelle table `Commandes refusees`.

Colonnes de la table `Commandes refusees` :

- Commande
- Client
- Telephone
- Date refus
- Livreur
- Quartier
- Motif
- Perte

## Backend Blacklist

Fichiers modifies :

- `back-end/dto/client_blacklist_dto.py`
- `back-end/dao/client_blacklist_dao.py`

DTO enrichis :

`ClientBlacklistDTO` a recu :

- `commande_statut`
- `commande_date`
- `montant_perdu`

Nouveau DTO :

```py
class BlacklistCommandeRefuseeDTO(BaseModel):
    log_id: int
    commande_id: Optional[int] = None
    client_id: int
    client_label: Optional[str] = None
    phone: Optional[str] = None
    date_refus: Optional[datetime] = None
    date_commande: Optional[datetime] = None
    statut_commande: Optional[str] = None
    montant_perdu: float = 0.0
    livreur_nom: Optional[str] = None
    quartier: Optional[str] = None
    motif: Optional[str] = None
```

`BlacklistReportDTO` a recu :

- `total_perte`
- `commandes_refusees`

DAO blacklist :

- Enrichissement de `get_blacklisted_clients`.
- Jointure vers `Commande` pour afficher commande refusee et montant perdu.
- Enrichissement de `get_monthly_report`.
- Calcul de :
  - `total_refus`
  - `total_perte`
  - regroupement par client
  - regroupement par livreur
  - regroupement par quartier
  - details commandes refusees

Important :

- Aucune entity n'a ete modifiee.
- Les donnees viennent des tables existantes :
  - `t_client_blacklist_logs`
  - `t_commandes`
  - `t_clients`
  - `t_users`
  - `t_livreurs`
  - `t_addresses`

## API Frontend

Fichier :

- `front-end/lib/api.ts`

Ajouts :

- Types `AdminClientDTO`.
- Type `AdminClientsPageDTO`.
- Fonction `getAdminClients`.
- Champs blacklist supplementaires :
  - `commande_statut`
  - `commande_date`
  - `montant_perdu`
  - `total_perte`
  - `commandes_refusees`

Fonction ajoutee :

```ts
getAdminClients(token, params, signal)
```

Endpoint appele :

```http
/api/admin/clients
```

## Blacklist Et Blocage COD

Question :

Est-ce que le client blackliste est bloque de COD via la base de donnees ou seulement dans cette version du projet ?

Reponse :

Le blocage COD est lie a la base de donnees.

Le champ utilise est :

```py
t_clients.is_blacklisted
```

Dans `back-end/services/checkout_service.py`, le checkout relit le client depuis la base via le DAO, puis bloque si :

- `client.is_blacklisted == True`
- et le mode de paiement est COD.

Code logique existant :

```py
if bool(client.is_blacklisted) and self._is_cod_mode(payload.mode_paiement):
    raise HTTPException(status_code=403, detail="...")
```

Conclusion :

- Le blocage ne depend pas uniquement du frontend.
- Il persiste apres refresh, nouvelle session ou redemarrage serveur.
- Il depend de la valeur stockee dans la table `t_clients`.
- Si la meme base de donnees est utilisee, le blocage continue de fonctionner.

Regle metier importante :

- La blacklist bloque uniquement COD.
- Wallet et CMI restent autorises.
- Ce comportement respecte `regles.md`, rappel specifique numero 49.

## Verifications Effectuees

Commandes executees :

```bash
python -m compileall back-end
```

Resultat :

- OK.

```bash
npx tsc --noEmit
```

Resultat :

- OK.

```bash
git diff --check
```

Resultat :

- OK.
- Seulement des warnings CRLF Windows.

## Check Flush/Commit

| Fichier | Role | flush() OK ? | commit() OK ? | LocalSession() absent ? | Statut |
|---|---|---:|---:|---:|---|
| `back-end/dao/client_admin_dao.py` | DAO | N/A lecture | Oui, aucun commit | Oui | OK |
| `back-end/services/client_admin_service.py` | Service | N/A | N/A lecture | Oui | OK |
| `back-end/dao/client_blacklist_dao.py` | DAO | Oui | Oui, aucun commit | Oui | OK |
| `back-end/services/client_blacklist_service.py` | Service | N/A | Oui existant | Oui | OK |

Violations existantes non corrigees :

| Fichier | Probleme | Action |
|---|---|---|
| `back-end/dao/commande_dao.py` | commit/rollback dans DAO existant | Non corrige, selon consigne utilisateur |
| `back-end/services/commande_service.py` | LocalSession dans service existant | Non corrige, selon consigne utilisateur |
| `back-end/services/checkout_service.py` | LocalSession dans service existant | Non corrige, selon consigne utilisateur |

## Fichiers Crees

- `front-end/app/admin/clients/page.tsx`
- `front-end/components/admin/client-fiche-panel.tsx`
- `back-end/dto/client_admin_dto.py`
- `back-end/interfaces/client_admin_dao_interface.py`
- `back-end/interfaces/client_admin_service_interface.py`
- `back-end/dao/client_admin_dao.py`
- `back-end/services/client_admin_service.py`
- `mission#5.md`

## Fichiers Modifies

- `front-end/app/admin/page.tsx`
- `front-end/app/admin/clients/page.tsx`
- `front-end/app/admin/blacklist/page.tsx`
- `front-end/app/admin/orders/page.tsx`
- `front-end/components/admin/client-fiche-panel.tsx`
- `front-end/lib/api.ts`
- `back-end/controllers/admin_controller.py`
- `back-end/controllers/__init__.py`
- `back-end/dependencies.py`
- `back-end/main.py`
- `back-end/dto/client_blacklist_dto.py`
- `back-end/dao/client_blacklist_dao.py`
- `back-end/dto/client_admin_dto.py`
- `back-end/dao/client_admin_dao.py`

## Fichiers Non Touches Intentionnellement

- Entities existantes.
- Tables SQL existantes.
- `livreur_dao.py`.
- `livreur_service.py`.
- `NotificationOutboxService`.
- Logique checkout existante, sauf lecture pour verification.

## Points A Revoir / Critiquer

1. `/admin/clients`
   - Est-ce que la colonne `Montant total` doit rester page courante ou devenir globale par client uniquement ?
   - Est-ce que tu veux ajouter une action admin sur client plus tard ?

2. `/admin/blacklist`
   - Le rapport est charge automatiquement.
   - Le bouton `Actualiser` recharge la periode selectionnee.
   - Si tu veux un vrai bouton `Generer`, il faudrait definir une action metier differente, par exemple exporter PDF/CSV.

3. Blocage blacklist
   - Actuellement COD seulement.
   - Wallet/CMI restent autorises.
   - Conforme aux regles actuelles.

4. Violations existantes MVC2
   - Certaines violations anciennes existent encore.
   - Elles n'ont pas ete corrigees parce que la consigne etait de ne pas les toucher.

## Resume Final

Ajoute :

- Page admin clients.
- Endpoint admin clients.
- Service/DAO/DTO/interfaces admin clients.
- Composant fiche client partage.
- Rapport blacklist enrichi.
- Details commandes refusees.
- Total perte blacklist.

Modifie :

- Navigation admin.
- Page clients pour clients non blacklistes seulement.
- Page blacklist pour rapport plus clair.
- API frontend pour nouveaux DTO.

Supprime fonctionnellement :

- KPI taux blacklist ambigu.
- Filtre blacklist dans `/admin/clients`.
- Sidebar interne blacklist dans `/admin/clients`.

Non modifie :

- Entities.
- Tables SQL.
- Livreur.
- Regle metier COD blacklist.
