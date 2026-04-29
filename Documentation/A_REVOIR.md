# A revoir

## `back-end/services/delivery_schema_sync_service.py`

Revenir plus tard sur ce fichier.

Constat actuel :
- Le fichier synchronise automatiquement une partie du schema livraison au demarrage du backend.
- Il modifie `t_commandes` directement : statuts, colonnes de suivi livraison, validation paiement, contrainte SQL.
- La modification de `Salah-Sghiri <sghirisalaheddine@gmail.com>` a ajoute les statuts `REFUS` et `ANNULEE`, puis a change la logique pour supprimer et recreer la contrainte `ck_t_commandes_statut_allowed`.

Avis actuel :
- La modification semble techniquement logique et utile.
- Elle evite que PostgreSQL garde une ancienne contrainte qui refuserait les nouveaux statuts.
- Point a revoir : ce type de modification SQL automatique au demarrage devrait idealement etre remplace par des migrations controlees.

Action future :
- Verifier si ce service doit rester actif au demarrage.
- Decider si les changements de schema doivent etre deplaces vers des migrations SQL.
- Documenter clairement les statuts autorises et leur cycle de vie.

blabla
