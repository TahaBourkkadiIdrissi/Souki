# Rapport sur les tables `t_wallets` et `wallets`

Date d'analyse: 2026-05-04

## Resume executif

Il y a deux tables parce que le projet a garde une ancienne implementation de wallet, `t_wallets`, puis a ajoute une nouvelle implementation plus complete, `wallets`, sans supprimer totalement l'ancien modele.

- `t_wallets` est le wallet legacy: id entier, user_id, solde. Aujourd'hui, il n'est plus utilise par les services metier actifs.
- `wallets` est le Souki Wallet actif: id UUID, wallet_code, password_hash, balance decimal, created_at. C'est cette table qui est utilisee par les routes utilisateur, les reclamations/SAV et les transactions wallet.
- `t_transactions_wallet` a ete migree: au depart elle pointait vers `t_wallets.id` en entier; maintenant elle pointe vers `wallets.id` en UUID.
- `WalletSchemaSyncService` existe pour convertir les anciennes transactions de `t_wallets` vers `wallets` quand la base contient encore l'ancien schema.

## Origine Git

### `t_wallets`

Table/model cree dans:

- Commit: `2196611`
- Auteur: `TahaBourkkadiIdrissi <t.bourkkadiidrissi@esisa.ac.ma>`
- Date: `2026-04-17 21:21:20 +0100`
- Message: `1- Created all tables to start building fine-tunning model...`
- Fichier cree: `back-end/entities/wallet_entity.py`

Contenu initial:

- `Wallet.__tablename__ = "t_wallets"`
- `id` entier auto-incremente
- `user_id` FK vers `t_users.id`
- `solde` float
- relation `user`
- relation historique `transactions` vers `TransactionWallet`

Modifications importantes:

- Commit `adf80fe`, `TahaBourkkadiIdrissi`, `2026-04-23 23:45:32 +0100`: nettoyage/alignement du modele actuel, notamment imports et relation.
- Commit `e704ffc`, `TahaBourkkadiIdrissi`, `2026-04-25 12:47:03 +0100`: suppression de l'auto-creation du wallet legacy dans `AuthService` et remplacement des usages settings par `SoukiWallet`.

### `wallets`

Table/model cree dans:

- Commit: `e704ffc`
- Auteur: `TahaBourkkadiIdrissi <t.bourkkadiidrissi@esisa.ac.ma>`
- Date: `2026-04-25 12:47:03 +0100`
- Message: `feat(settings,wallet,profile,storage): ... implement manual Souki e-wallet creation with secure hashed password and wallet code, remove wallet auto-creation on auth ...`
- Fichier cree: `back-end/entities/souki_wallet_entity.py`

Contenu introduit:

- `SoukiWallet.__tablename__ = "wallets"`
- `id` UUID
- `user_id` unique, FK vers `t_users.id`
- `wallet_code` unique
- `password_hash`
- `balance` decimal `Numeric(12, 2)`
- `created_at`
- relation `user`

Modifications importantes:

- Commit `0875aa8`, `hamza-zmarou <hamzazmarou2006@gmail.com>`, `2026-04-29 22:18:49 +0100`: ajoute la relation `SoukiWallet.transactions`, migre `TransactionWallet.wallet_id` vers UUID et ajoute `WalletSchemaSyncService`.

## Structure actuelle des tables

### `t_wallets`

Definition SQLAlchemy: `back-end/entities/wallet_entity.py`

- Classe: `Wallet`
- Table: `t_wallets`
- Colonnes:
  - `id`: `Integer`, primary key, autoincrement
  - `user_id`: `Integer`, FK `t_users.id`
  - `solde`: `Float`, default `0`
- Relation:
  - `Wallet.user` vers `User.wallet`

Definition Prisma: `prisma/schema.prisma`

- Modele: `Wallet`
- Mapping: `@@map("t_wallets")`
- Relation: `User.wallet`

Etat fonctionnel actuel:

- Aucun service actif ne fait `query(Wallet)` ou ne cree `Wallet`.
- La table reste referencee par:
  - `back-end/entities/__init__.py`, pour charger le modele SQLAlchemy.
  - `back-end/entities/user_entity.py`, relation `User.wallet`.
  - `prisma/schema.prisma`, modele `Wallet`.
  - `back-end/services/wallet_schema_sync_service.py`, uniquement pour migrer les anciennes transactions.
- Donc `t_wallets` est aujourd'hui une table legacy/compatibilite.

### `wallets`

Definition SQLAlchemy: `back-end/entities/souki_wallet_entity.py`

- Classe: `SoukiWallet`
- Table: `wallets`
- Colonnes:
  - `id`: UUID, primary key
  - `user_id`: `Integer`, unique, FK `t_users.id`
  - `wallet_code`: `String(32)`, unique
  - `password_hash`: `String(255)`
  - `balance`: `Numeric(12, 2)`
  - `created_at`: timestamp serveur
- Relations:
  - `SoukiWallet.user` vers `User.souki_wallet`
  - `SoukiWallet.transactions` vers `TransactionWallet.wallet`

Definition Prisma: `prisma/schema.prisma`

- Modele: `SoukiWallet`
- Mapping: `@@map("wallets")`
- Relation: `User.soukiWallet`
- Relation: `WalletTransaction.wallet`

Etat fonctionnel actuel:

- C'est la table active du wallet Souki.
- Elle est lue et creee par `SettingsService`.
- Elle est lue/creee/creditee par `SoukiWalletService` via `SoukiWalletDaoBD`.
- Elle est utilisee dans le workflow reclamation/SAV pour crediter un remboursement.

## Services et fonctions qui utilisent `wallets`

### Activation et affichage du wallet utilisateur

Fichiers:

- `back-end/controllers/settings_controller.py`
- `back-end/services/settings_service.py`
- `front-end/hooks/useWallet.ts`
- `front-end/app/parametres/page.tsx`

Routes:

- `GET /api/user/wallet`
  - Controleur: `get_wallet`
  - Service: `SettingsService.get_wallet`
  - Table: `wallets`
  - Fonctionnement:
    - cherche `SoukiWallet` par `user_id`
    - si absent: retourne `has_wallet: False`, solde 0, pas de code
    - si present: retourne `has_wallet: True`, `balance_centimes`, `wallet_code_masked`, `created_at`

- `POST /api/user/wallet/activate`
  - Controleur: `activate_wallet`
  - Service: `SettingsService.activate_wallet`
  - DTO: `WalletActivationDTO`
  - Table: `wallets`
  - Fonctionnement:
    - valide `password` et `confirm_password`
    - refuse si un `SoukiWallet` existe deja pour l'utilisateur
    - genere un code `SOUKI-...`
    - hash le mot de passe avec bcrypt
    - cree une ligne `SoukiWallet(balance=0.00)`
    - retourne le code complet une seule fois cote frontend

Frontend:

- `useWallet.getWallet()` appelle `/api/user/wallet`.
- `useWallet.activateWallet()` appelle `/api/user/wallet/activate`.
- `app/parametres/page.tsx` affiche le solde, le code masque et le formulaire d'activation.

### Remboursements SAV/reclamations

Fichiers:

- `back-end/services/claim_service.py`
- `back-end/services/souki_wallet_service.py`
- `back-end/dao/souki_wallet_dao.py`
- `back-end/interfaces/souki_wallet_service_interface.py`
- `back-end/interfaces/souki_wallet_dao_interface.py`
- `front-end/app/catalogue/page.tsx`

Fonctions:

- `ClaimService.process_claim`
  - recupere ou cree un wallet via `souki_wallet_service.get_or_create_wallet`
  - calcule le remboursement
  - credite le wallet via `souki_wallet_service.credit_wallet`
  - type de transaction: `CREDIT_SAV`
  - retourne `new_wallet_balance`

- `SoukiWalletService.get_or_create_wallet`
  - table: `wallets`
  - lock l'utilisateur
  - cherche `SoukiWallet` par `user_id`
  - si absent, cree un wallet systeme avec code genere et mot de passe aleatoire hash

- `SoukiWalletService.credit_wallet`
  - table: `wallets`
  - ajoute le montant au champ `balance`
  - cree une ligne dans `t_transactions_wallet`

- `SoukiWalletDaoBD.get_by_user_id`
  - requete `SoukiWallet` par `user_id`

- `SoukiWalletDaoBD.create_wallet`
  - cree une ligne dans `wallets`

- `SoukiWalletDaoBD.create_transaction`
  - cree une ligne dans `t_transactions_wallet` avec `wallet_id = wallets.id`

Frontend reclamation:

- `front-end/app/catalogue/page.tsx` envoie la reclamation.
- Au succes, affiche que le remboursement est credite sur le wallet SOUKI et emet l'evenement `souki-wallet-updated`.

## Services et fonctions qui utilisent `t_wallets`

### Usage actuel

En usage metier courant: aucun.

Les seules references actuelles a `t_wallets` sont structurelles ou de migration:

- `back-end/entities/wallet_entity.py`
  - garde la classe SQLAlchemy `Wallet`
  - `Base.metadata.create_all(bind=engine)` peut encore creer la table si absente

- `back-end/entities/user_entity.py`
  - garde `wallet = relationship("Wallet", ...)`

- `prisma/schema.prisma`
  - garde le modele `Wallet`

- `back-end/services/wallet_schema_sync_service.py`
  - lit `t_wallets` comme table legacy pour migrer `t_transactions_wallet.wallet_id` vers les UUID de `wallets`

### Usage historique

Avant le commit `e704ffc`, `t_wallets` etait utilisee par:

- `AuthService._ensure_wallet`
  - appelee apres verification OTP
  - appelee apres login Google
  - creait automatiquement `Wallet(user_id=user.id, solde=0)` pour les utilisateurs verifies

- `SettingsService.get_wallet`
  - lisait `Wallet`
  - retournait `solde_centimes`
  - listait les `TransactionWallet` liees a `t_wallets.id`

- `SettingsService.activate_wallet`
  - creait un `Wallet` legacy si absent
  - retournait un identifiant derive du type `SKW-{user_id}-{wallet_id}`

Ce comportement a ete remplace le `2026-04-25` par le wallet manuel avec code et mot de passe.

## Role de `t_transactions_wallet`

La table `t_transactions_wallet` a change de parent.

Historique:

- Creee dans le commit `2196611`, le `2026-04-17`, avec `wallet_id` entier FK vers `t_wallets.id`.
- Migree dans le commit `0875aa8`, le `2026-04-29`, avec `wallet_id` UUID FK vers `wallets.id`.

Etat actuel:

- Modele SQLAlchemy: `back-end/entities/transaction_wallet_entity.py`
- `wallet_id = UUID`, FK `wallets.id`
- Relation: `TransactionWallet.wallet` vers `SoukiWallet`
- Les transactions sont creees par `SoukiWalletDaoBD.create_transaction`.

`WalletSchemaSyncService` gere la transition:

- supprime l'ancienne contrainte `t_transactions_wallet_wallet_id_fkey`
- si `wallet_id` n'est pas UUID:
  - cree `wallet_id_souki`
  - fait la correspondance:
    - `t_transactions_wallet.wallet_id = t_wallets.id`
    - `t_wallets.user_id = wallets.user_id`
    - `wallet_id_souki = wallets.id`
  - echoue si une transaction legacy n'a pas de `SoukiWallet` correspondant
  - remplace `wallet_id` par `wallet_id_souki`
- ajoute la contrainte FK finale vers `wallets(id)`

## Pourquoi les deux tables existent encore

Raisons probables d'apres le code et l'historique:

1. `t_wallets` etait la premiere version simple du wallet, creee avec les tables initiales.
2. `wallets` a ete introduite plus tard pour supporter une activation explicite, un code wallet, un mot de passe hash et une balance decimal plus adaptee a l'argent.
3. La migration n'a pas supprime `t_wallets`; elle l'utilise meme comme source pour convertir les anciennes transactions.
4. Le modele `Wallet` est encore importe dans `entities/__init__.py`, donc `Base.metadata.create_all` continue a connaitre cette table.
5. Prisma garde encore `Wallet`, donc le schema frontend/outillage voit encore l'ancienne table.

## Conclusion

La table a considerer comme source de verite aujourd'hui est `wallets`.

`t_wallets` est un vestige legacy. Elle ne sert plus a l'activation, au solde affiche, au remboursement SAV, ni a la creation de transactions modernes. Elle reste seulement pour compatibilite/migration et parce que le modele n'a pas ete supprime.

## Recommandations

Avant de supprimer `t_wallets`, verifier en base:

- nombre de lignes dans `t_wallets`
- nombre de transactions dans `t_transactions_wallet`
- presence de `wallets` pour chaque `t_wallets.user_id`
- existence d'anciens environnements non migres

Si la migration est confirmee partout:

- supprimer `Wallet` de `back-end/entities/wallet_entity.py`
- retirer l'import `Wallet` de `back-end/entities/__init__.py`
- retirer `User.wallet` de `back-end/entities/user_entity.py`
- retirer le modele `Wallet` de `prisma/schema.prisma`
- supprimer ou limiter `WalletSchemaSyncService` apres une vraie migration SQL versionnee
- garder `wallets` + `t_transactions_wallet` comme schema final
