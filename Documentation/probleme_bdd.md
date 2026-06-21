# Probleme BDD - Transactions bloquees et ALTER TABLE en timeout

## Symptome

Supabase peut afficher cette erreur pendant une migration ou un `ALTER TABLE` :

```text
Error: SQL query ran into an upstream timeout
```

Dans notre cas, la cause observee etait une session PostgreSQL restee ouverte :

```text
state: idle in transaction
duration: plus de 22h
query: SELECT t_commandes...
```

Une transaction `idle in transaction` peut bloquer ou retarder des changements de schema, meme si la requete ne fait plus rien activement.

## Cause probable

Le backend Python/FastAPI utilise SQLAlchemy. Avec SQLAlchemy, meme un simple `SELECT` ouvre une transaction.

Si la session n'est pas fermee correctement, PostgreSQL garde la transaction ouverte. Cela peut ensuite bloquer :

- `ALTER TABLE`
- `ADD COLUMN`
- `ADD CONSTRAINT`
- certaines migrations Supabase

Dans l'incident analyse, la requete venait probablement d'un endpoint admin qui lit les commandes :

```http
GET /api/commandes
GET /api/commandes/jour
```

Le fichier suspect cote lecture etait :

```text
back-end/dao/commande_dao.py
```

## Diagnostic rapide

Avant de tuer une session, executer :

```sql
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  client_port,
  backend_start,
  xact_start,
  query_start,
  state,
  wait_event_type,
  wait_event,
  now() - xact_start AS transaction_age,
  now() - query_start AS query_age,
  query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY xact_start NULLS LAST;
```

Chercher les lignes avec :

```text
state = idle in transaction
```

## Nettoyage manuel

Pour tuer une session precise :

```sql
SELECT pg_terminate_backend(<PID>);
```

Exemple :

```sql
SELECT pg_terminate_backend(2674342);
```

Pour nettoyer toutes les transactions idle trop anciennes :

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'idle in transaction'
  AND now() - xact_start > interval '5 minutes';
```

## Relancer une migration proprement

Apres nettoyage, utiliser des timeouts explicites :

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public."T_Product"
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
```

Pour rendre une colonne obligatoire, proceder par etapes :

```sql
UPDATE public."T_Product"
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE public."T_Product"
ALTER COLUMN is_active SET NOT NULL;
```

## Prevention en dev et production

### 1. Toujours fermer les sessions SQLAlchemy

Pattern recommande :

```python
session = LocalSession()
try:
    ...
    session.commit()
except Exception:
    session.rollback()
    raise
finally:
    session.close()
```

Pour une lecture seule, fermer aussi la session :

```python
session = LocalSession()
try:
    return dao.get_data(session)
finally:
    session.rollback()
    session.close()
```

### 2. Preferer une dependency FastAPI pour les sessions

Pattern cible :

```python
def get_db():
    db = LocalSession()
    try:
        yield db
    finally:
        db.close()
```

Cela garantit qu'une requete HTTP ne laisse pas une session ouverte.

### 3. Eviter les sessions longues dans les services

Les services ne doivent pas garder une session trop longtemps dans `self.session`.

Risque :

```python
self.session = LocalSession()
```

Puis une exception ou un chemin oublie peut laisser la transaction ouverte.

### 4. Encadrer strictement `with_for_update`

`with_for_update()` garde des locks. Il doit rester dans une transaction courte :

```python
try:
    row = dao.get_for_update(session, id)
    ...
    session.commit()
except Exception:
    session.rollback()
    raise
finally:
    session.close()
```

### 5. Ajouter des timeouts cote connexion

Dans `config.py`, ajouter des options PostgreSQL :

```python
connect_args={
    "connect_timeout": DB_CONNECT_TIMEOUT,
    "options": "-c statement_timeout=60000 -c idle_in_transaction_session_timeout=60000",
}
```

Effets :

- `statement_timeout=60000` : une requete ne depasse pas 60 secondes.
- `idle_in_transaction_session_timeout=60000` : une transaction idle est terminee apres 60 secondes.

En dev, 30 secondes peut suffire. En prod, 60 a 120 secondes est plus confortable.

## Procedure avant migration

En dev :

1. Arreter `python main.py` / `uvicorn`.
2. Arreter les scripts scheduler si actifs.
3. Verifier `pg_stat_activity`.
4. Terminer les transactions `idle in transaction`.
5. Lancer la migration.
6. Redemarrer le backend.

En production :

1. Planifier une courte fenetre de maintenance.
2. Desactiver temporairement les jobs scheduler si la migration touche leurs tables.
3. Verifier les transactions ouvertes.
4. Executer la migration avec `lock_timeout` et `statement_timeout`.
5. Reactiver les jobs.

## Recommandation SOUKI

Ouvrir un issue dedie :

```text
BUGFIX - Hygiene sessions SQLAlchemy
```

Objectif :

- Centraliser la gestion des sessions DB.
- Supprimer progressivement les `LocalSession()` dans les services.
- Garantir `commit`, `rollback`, `close` dans tous les chemins.
- Ajouter `idle_in_transaction_session_timeout` dans `config.py`.
- Auditer les endpoints admin commandes, COD, JIT et dispatch.

