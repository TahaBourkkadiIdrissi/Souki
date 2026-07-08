# Audit cybersécurité — Répartition des corrections

Date : 21 juin 2026  
Branche de référence : `main` / `fournisseur` au commit `ed30bdb`  
Niveau de risque global : **Élevé**

Ce document répartit les failles entre les trois collaborateurs identifiés dans Git :

1. **Hamza Zmarou**
2. **Taha Bourkkadi Idrissi**
3. **Salah Sghiri**

Le rapport complet reste disponible dans [AUDIT_CYBERSECURITE_DETAIL_TECHNIQUE.md](AUDIT_CYBERSECURITE_DETAIL_TECHNIQUE.md).

## Règles d'attribution

- L'attribution repose sur `git blame`, les commits et les branches locales.
- Le responsable principal est la personne ayant introduit ou majoritairement modifié le code concerné.
- Cette répartition organise les corrections ; elle ne constitue pas un jugement personnel.
- Une faille transverse possède un responsable principal et un collaborateur d'appui.
- Une correction doit être relue par au moins un autre collaborateur.

## Vue d'ensemble

| Collaborateur | Périmètre principal | Tâches |
|---|---|---:|
| Hamza Zmarou | Authentification backend, WebSocket, CORS, branche Back-05 | 5 |
| Taha Bourkkadi Idrissi | Frontend, mobile, OTP, panier, uploads, dépendances | 8 |
| Salah Sghiri | Commandes, secrets de test, stock, DAO métier | 5 |

# Partie 1 — Hamza Zmarou

## Périmètre Git constaté

Branches locales principalement associées :

- `AssignationenTournéesBatchDispatching/hz`
- `Back-03/SAVRemboursementStratégiqueCréditWallet/hz`
- `Back-04/AlgorithmeBouclierdeMargeIA/hz`
- `Back-05/AlgorithmedeSubstitutionAbonnementsParentaux/hz`
- `Front-01/AuthentificationProfil/hz`
- `GestionDesAnomaliesDeLivraisonFraisRetourDépôt/hz`
- `Livreur-01/RéceptiondeTournée/hz`
- `Livreur-03/IndicateurdePaiementSécurisé/hz`

## HAMZA-01 — Sécuriser le WebSocket administrateur

- Référence : **VULN-007**
- Gravité : **Élevée**
- Preuve Git : `back-end/controllers/admin_controller.py:43-59` et `189-205` attribués à Hamza.
- Problèmes :
  - JWT transmis dans l'URL ;
  - absence de validation par `UserSessionService` ;
  - session révoquée potentiellement encore utilisable ;
  - état actif du compte non vérifié.
- Fichiers :
  - `back-end/controllers/admin_controller.py`
  - `back-end/services/user_session_service.py`
- À faire :
  - [ ] Créer un endpoint HTTP protégé qui émet un ticket WebSocket opaque.
  - [ ] Limiter sa durée à 30 secondes et son utilisation à une fois.
  - [ ] Vérifier la session active et le compte avant l'émission.
  - [ ] Retirer le JWT principal de la query string.
  - [ ] Tester token expiré, session révoquée et permission absente.
- Validation : après déconnexion, l'ancien token ne permet plus d'ouvrir le WebSocket.
- Relecteur : **Salah**.

## HAMZA-02 — Limiter les tentatives de connexion

- Référence : **VULN-009**
- Gravité : **Moyenne**
- Fichiers :
  - `back-end/controllers/auth_controller.py:33-55`
  - `back-end/services/auth_service.py:102-148`
- Problème : les connexions utilisateur et administrateur ne sont pas protégées contre le brute force.
- À faire :
  - [ ] Limiter `/auth/login` par IP et identifiant.
  - [ ] Appliquer une limite plus stricte à `/auth/admin/login`.
  - [ ] Utiliser un stockage partagé, par exemple Redis.
  - [ ] Ajouter un délai progressif après plusieurs échecs.
  - [ ] Ne pas révéler si un compte existe.
  - [ ] Alerter après plusieurs échecs administrateur.
- Validation : la tentative dépassant la limite reçoit HTTP 429.
- Relecteur : **Taha**.

## HAMZA-03 — Durcir CORS

- Référence : **RISK-004**
- Gravité : **Faible**
- Fichier : `back-end/main.py:219-244`
- Problème : toutes les origines HTTP locales et tous les ports sont acceptés par défaut, avec credentials.
- À faire :
  - [ ] Exiger `FRONTEND_ORIGINS` en production.
  - [ ] Désactiver la regex locale en production.
  - [ ] Restreindre les méthodes et en-têtes.
  - [ ] Tester une origine autorisée et une origine refusée.
- Validation : une origine non déclarée ne reçoit aucun accès CORS.

## HAMZA-04 — Revoir la branche Back-05

- Références : **BUG-001** et **BUG-004**
- Gravité : **Moyenne**
- Branche : `Back-05/AlgorithmedeSubstitutionAbonnementsParentaux/hz`
- Commit : `19375a9` — `in progress`
- Changements dangereux constatés :
  - désactivation du cutoff backend ;
  - retrait du verrou frontend de commande ;
  - dispatch étendu à `EN_ATTENTE` et `CONFIRMEE`.
- À faire :
  - [ ] Ne pas fusionner ce commit tel quel.
  - [ ] Confirmer les statuts autorisés avec l'équipe.
  - [ ] Séparer les changements métier en commits distincts.
  - [ ] Ajouter des tests sur les statuts de dispatch.
  - [ ] Restaurer les garde-fous non validés.
- Validation : aucune commande non validée ne peut entrer dans une tournée.
- Relecteur obligatoire : **Salah**.

## HAMZA-05 — Uniformiser les autorisations backend

- Références : dette d'architecture, **VULN-003** et **VULN-004**
- Gravité : **Moyenne**
- Fichiers :
  - `back-end/auth_dependencies.py`
  - `back-end/controllers/commande_controller.py`
  - `back-end/controllers/jit_controller.py`
  - `back-end/controllers/admin_controller.py`
- Problème : coexistence de plusieurs styles d'autorisation et oubli possible du contrôle de propriété.
- À faire :
  - [ ] Définir un standard unique pour authentification, permission et propriété.
  - [ ] Remplacer les vérifications manuelles de rôle par `require_permission`.
  - [ ] Créer une vérification réutilisable de propriété.
  - [ ] Documenter ce standard.
- Validation : aucune route privée n'ignore simplement le principal avec `_ = principal`.

## Ordre de correction — Hamza

1. `HAMZA-01`
2. `HAMZA-02`
3. `HAMZA-04`
4. `HAMZA-05`
5. `HAMZA-03`

# Partie 2 — Taha Bourkkadi Idrissi

## Périmètre Git constaté

Travaux principalement associés :

- frontend Next.js et PWA ;
- application mobile Expo ;
- flux panier et checkout ;
- upload audio et interaction IA ;
- authentification frontend ;
- commit `38fa798` ayant introduit l'affichage des OTP.

## TAHA-01 — Supprimer les OTP des logs

- Référence : **VULN-002**
- Gravité : **Élevée**
- Preuve Git : lignes sensibles introduites par `38fa798` le 20 juin 2026.
- Fichier : `back-end/services/auth_service.py:387-407`
- Problème : le code OTP et sa destination sont écrits en clair.
- À faire :
  - [ ] Supprimer l'affichage du code et de la destination.
  - [ ] Ne journaliser que l'identifiant interne et le canal.
  - [ ] Faire échouer proprement un canal non configuré.
  - [ ] Utiliser un faux fournisseur uniquement dans les tests.
  - [ ] Examiner et purger les anciens logs concernés.
- Validation : aucun OTP réel n'apparaît dans les logs.
- Relecteur obligatoire : **Hamza**.

## TAHA-02 — Corriger l'IDOR panier

- Référence : **VULN-004**
- Gravité : **Élevée**
- Preuve Git : route principalement attribuée à Taha.
- Fichiers :
  - `back-end/controllers/panier_controller.py:51-60`
  - `back-end/services/panier_service.py:204-212`
  - `back-end/dao/panier_dao.py:76-85`
- Problème : le principal est ignoré et le panier est chargé seulement par `panier_id`.
- À faire :
  - [ ] Transmettre `principal.user_id` au service.
  - [ ] Filtrer par `Panier.id` et `Panier.user_id`.
  - [ ] Retourner 404 pour le panier d'un autre utilisateur.
  - [ ] Ajouter un test utilisateur A contre panier B.
  - [ ] Vérifier les paniers générés par le service ML.
- Validation : un utilisateur ne lit que ses propres paniers.
- Relecteur : **Salah**.

## TAHA-03 — Limiter les uploads audio

- Référence : **VULN-008**
- Gravité : **Élevée**
- Preuve Git : majorité de `commande_controller.py:51-76` attribuée à Taha.
- Fichier : `back-end/controllers/commande_controller.py`
- Problème : le fichier est chargé intégralement en mémoire sans limite fiable.
- À faire :
  - [ ] Limiter la taille, par exemple à 10 Mo.
  - [ ] Lire au maximum `limite + 1` octets.
  - [ ] Autoriser uniquement WAV, MP3/MPEG et WebM.
  - [ ] Vérifier la signature réelle du fichier.
  - [ ] Ajouter un quota utilisateur pour les appels IA.
  - [ ] Configurer la limite au reverse proxy.
- Validation : un fichier trop volumineux reçoit HTTP 413 avant lecture complète.

## TAHA-04 — Mettre à jour Next.js et PostCSS

- Référence : **VULN-005**
- Gravité : **Élevée**
- Fichiers :
  - `front-end/package.json:49`
  - `front-end/package-lock.json`
- Version vulnérable : `next@16.2.4`
- Risques : bypass proxy/middleware, DoS, SSRF, XSS et cache poisoning selon la configuration.
- À faire :
  - [ ] Installer une version stable non affectée de Next.js.
  - [ ] Mettre à jour PostCSS.
  - [ ] Régénérer le lockfile.
  - [ ] Relancer `npm audit --omit=dev`.
  - [ ] Tester la route proxy `app/backend/[...path]/route.ts`.
  - [ ] Tester build, navigation, PWA et authentification.
- Validation : aucune vulnérabilité élevée dans l'audit npm frontend.

## TAHA-05 — Corriger les dépendances mobiles

- Référence : audit des dépendances mobiles
- Gravité : **Moyenne**
- Fichiers :
  - `mobile/package.json`
  - `mobile/package-lock.json`
- Résultat actuel : 13 vulnérabilités moyennes et 1 faible.
- Chaînes concernées : Expo, `js-yaml`, `uuid`, `xcode`, `@babel/core`.
- À faire :
  - [ ] Identifier la version Expo stable compatible.
  - [ ] Mettre à jour les dépendances par groupe.
  - [ ] Tester Android, iOS et le stockage sécurisé.
  - [ ] Relancer l'audit npm.
  - [ ] Documenter les risques sans correctif disponible.
- Validation : toute vulnérabilité restante est justifiée et compensée.

## TAHA-06 — Retirer le JWT de `localStorage`

- Référence : **VULN-010**
- Gravité : **Moyenne**
- Fichiers :
  - `front-end/contexts/auth-context.tsx:162-206`
  - `front-end/app/verify/page.tsx:81`
  - `front-end/lib/catalogue.ts`
- Problème : le token persistant est accessible à tout JavaScript exécuté sur l'origine.
- À faire :
  - [ ] Migrer vers un cookie `HttpOnly`, `Secure`, `SameSite`.
  - [ ] Adapter le proxy Next.js et le backend.
  - [ ] Ajouter une protection CSRF sur les écritures.
  - [ ] Réduire la durée de l'access token.
  - [ ] Conserver `expo-secure-store` sur mobile.
- Validation : le frontend web n'utilise plus `localStorage.getItem("token")`.
- Appui : **Hamza**.

## TAHA-07 — Sécuriser les images

- Référence : **RISK-001**
- Gravité : **Moyenne**
- Fichiers :
  - `back-end/controllers/settings_controller.py:47-59`
  - `back-end/controllers/produit_pricing_controller.py:96-110`
  - `back-end/services/supabase_storage_service.py:240-287`
- Problème : la validation repose principalement sur le MIME déclaré.
- À faire :
  - [ ] Vérifier la signature réelle.
  - [ ] Décoder et réencoder les images.
  - [ ] Retirer les métadonnées.
  - [ ] Contrôler la taille avant lecture complète.
  - [ ] Générer un nom aléatoire pour éviter les collisions.
- Validation : un faux JPEG est rejeté.

## TAHA-08 — Rendre le build strict et reproductible

- Références : **BUG-003**, **BUG-006**, **RISK-003**
- Gravité : **Moyenne**
- Fichiers :
  - `front-end/next.config.mjs:14-16`
  - `front-end/package.json`
  - `mobile/package.json`
- Problèmes :
  - erreurs TypeScript ignorées ;
  - `eslint` et `tsc` indisponibles dans l'installation auditée ;
  - en-têtes de sécurité incomplets.
- À faire :
  - [ ] Passer `ignoreBuildErrors` à `false`.
  - [ ] Choisir un seul gestionnaire de paquets par projet.
  - [ ] Réinstaller depuis les lockfiles dans une CI propre.
  - [ ] Rendre lint, typecheck et build obligatoires.
  - [ ] Ajouter CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy` et HSTS.
- Validation : une erreur TypeScript bloque le pipeline.

## Ordre de correction — Taha

1. `TAHA-01`
2. `TAHA-02`
3. `TAHA-03`
4. `TAHA-04`
5. `TAHA-06`
6. `TAHA-07`
7. `TAHA-05`
8. `TAHA-08`

# Partie 3 — Salah Sghiri

## Périmètre Git constaté

Travaux principalement associés :

- commandes, checkout et logique métier ;
- données de test administrateur ;
- DAO commande et historique ;
- tarification, stock et transactions ;
- workflows JIT, COD et blacklist.

## SALAH-01 — Révoquer et purger les secrets administrateur

- Référence : **VULN-001**
- Gravité : **Élevée**
- Preuve Git :
  - `back-end/test_api.http:173-189` attribué à Salah ;
  - commit principal `6c7f068` du 23 avril 2026.
- Problèmes : adresse administrateur, mot de passe en clair et JWT versionnés.
- État du JWT : expiré le 28 avril 2026 à 19:19:41 UTC.
- À faire :
  - [ ] Changer immédiatement le mot de passe.
  - [ ] Invalider toutes les sessions du compte.
  - [ ] Remplacer les valeurs par des variables d'environnement.
  - [ ] Purger les secrets de l'historique Git.
  - [ ] Vérifier leur éventuelle réutilisation.
  - [ ] Ajouter un scanner de secrets dans la CI.
- Validation : aucun secret n'est retrouvé dans les révisions publiées.
- Relecteur obligatoire : **Hamza**.

## SALAH-02 — Corriger l'IDOR commande

- Référence : **VULN-003**
- Gravité : **Élevée**
- Preuve Git : route initiale principalement attribuée à Salah ; authentification ajoutée ensuite par Hamza sans propriété.
- Fichiers :
  - `back-end/controllers/commande_controller.py:197-205`
  - `back-end/services/commande_service.py:97-111`
  - `back-end/dao/commande_dao.py:79-99`
- Problème : chargement par identifiant sans filtre sur le propriétaire.
- À faire :
  - [ ] Transmettre `principal.user_id` jusqu'au DAO.
  - [ ] Filtrer par commande et propriétaire.
  - [ ] Retourner 404 si la ressource n'est pas détenue.
  - [ ] Ajouter des tests client A/client B/administrateur.
  - [ ] Auditer les autres chargements de commande par ID.
- Validation : le client A ne peut jamais lire la commande du client B.
- Appui : **Hamza**.

## SALAH-03 — Rendre le stock atomique

- Référence : **VULN-006**
- Gravité : **Élevée**
- Preuve Git : logique partagée entre le checkout de Taha et les modifications prix/stock de Salah.
- Fichiers :
  - `back-end/services/checkout_service.py:107-141`
  - `back-end/dao/checkout_dao.py:17-23`
- Problème : lecture, validation et décrémentation sans verrou transactionnel.
- À faire :
  - [ ] Charger les produits avec `SELECT ... FOR UPDATE`.
  - [ ] Verrouiller dans un ordre stable.
  - [ ] Conserver contrôle et création dans une transaction unique.
  - [ ] Ajouter un test avec deux checkouts concurrents.
  - [ ] Vérifier le rollback du stock.
- Validation : le stock ne devient jamais négatif et aucune survente n'est possible.
- Relecteur : **Taha**.

## SALAH-04 — Supprimer la duplication DAO

- Référence : **BUG-002**
- Gravité : **Faible**
- Fichier : `back-end/dao/commande_dao.py`
- Lignes : définitions vers 509 et 610.
- Problème : `_build_commande_historique_dto` est définie deux fois.
- À faire :
  - [ ] Comparer les deux versions.
  - [ ] Conserver une seule implémentation.
  - [ ] Tester produits, paiement, COD et dates.
- Validation : une seule définition existe.

## SALAH-05 — Corriger la gestion des erreurs métier

- Références : **RISK-002** et **BUG-005**
- Gravité : **Moyenne**
- Fichiers prioritaires :
  - `back-end/controllers/commande_controller.py:93-147`
  - `back-end/controllers/jit_controller.py`
  - `back-end/dao/commande_dao.py`
  - `back-end/services/client_blacklist_service.py`
  - `back-end/services/produit_pricing_service.py`
- Problèmes :
  - texte brut des exceptions renvoyé au client ;
  - nombreux `except Exception` ;
  - erreurs remplacées silencieusement par des valeurs vides.
- À faire :
  - [ ] Définir des exceptions métier typées.
  - [ ] Renvoyer des messages publics génériques.
  - [ ] Journaliser les détails avec un identifiant de corrélation.
  - [ ] Ne plus masquer silencieusement les erreurs de base.
  - [ ] Vérifier rollback et fermeture des sessions.
- Validation : aucune réponse 500 ne contient de détail SQL ou interne.

## Ordre de correction — Salah

1. `SALAH-01`
2. `SALAH-02`
3. `SALAH-03`
4. `SALAH-05`
5. `SALAH-04`

# Coordination

## Matrice de relecture

| Sujet | Responsable | Relecteur/appui |
|---|---|---|
| WebSocket administrateur | Hamza | Salah |
| Rate limiting et écrans login | Hamza | Taha |
| Branche Back-05 et dispatch | Hamza | Salah |
| OTP | Taha | Hamza |
| IDOR panier | Taha | Salah |
| JWT en cookie | Taha | Hamza |
| Secrets administrateur Git | Salah | Hamza |
| IDOR commande | Salah | Hamza |
| Stock concurrent | Salah | Taha |

## Travaux communs

- [ ] CI avec lint, typecheck, tests, audits npm/Python et secret scanning.
- [ ] Tests d'autorisation horizontale sur toutes les ressources identifiées par ID.
- [ ] Tests de concurrence sur stock, COD, blacklist et dispatch.
- [ ] Découplage des migrations, du bootstrap et du scheduler.
- [ ] Nettoyage des branches anciennes, `__pycache__` et `.pyc`.
- [ ] Messages de commit explicites et revue obligatoire.

# Planning recommandé

## Jour 1

- Salah : rotation et purge des identifiants administrateur.
- Taha : suppression des OTP.
- Taha et Salah : correction des deux IDOR.
- Taha : mise à jour de Next.js.

## Jours 2 à 4

- Salah : verrouillage du stock.
- Hamza : ticket WebSocket.
- Taha : limite des uploads audio.
- Hamza : rate limiting.

## Semaine 2

- Taha et Hamza : cookie sécurisé.
- Taha : mobile, images et en-têtes HTTP.
- Salah : exceptions métier et DAO.
- Hamza : CORS et standard d'autorisation.

## Semaine 3

- CI complète ;
- tests de sécurité et concurrence ;
- nettoyage Git ;
- migrations et scheduler séparés ;
- revue croisée finale.

# Définition de « corrigé »

Une tâche est terminée uniquement si :

- [ ] le correctif est sur une branche dédiée ;
- [ ] un test prouve que la faille n'est plus exploitable ;
- [ ] aucun secret n'est ajouté ;
- [ ] lint, typecheck et tests passent ;
- [ ] les audits de dépendances sont relancés si nécessaire ;
- [ ] un autre collaborateur a relu la modification ;
- [ ] le commit correctif est renseigné ci-dessous.

# Tableau de suivi

| Tâche | Responsable | Priorité | Statut | Commit correctif |
|---|---|---|---|---|
| HAMZA-01 | Hamza | P0 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| HAMZA-02 | Hamza | P1 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| HAMZA-03 | Hamza | P2 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| HAMZA-04 | Hamza | P1 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| HAMZA-05 | Hamza | P1 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-01 | Taha | P0 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-02 | Taha | P0 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-03 | Taha | P1 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-04 | Taha | P0 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-05 | Taha | P2 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-06 | Taha | P1 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-07 | Taha | P2 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| TAHA-08 | Taha | P2 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| SALAH-01 | Salah | P0 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| SALAH-02 | Salah | P0 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| SALAH-03 | Salah | P1 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| SALAH-04 | Salah | P2 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |
| SALAH-05 | Salah | P1 | Corrigé | branche `AUDIT_CYBERSECURITE_DEBUG` |

# Suivi des corrections — 8 juillet 2026

Toutes les tâches du tableau ci-dessus sont corrigées sur la branche
`AUDIT_CYBERSECURITE_DEBUG` (renseigner le hash du commit correctif dans le
tableau au moment du merge).

## Preuves et validations

- Tests : `back-end/tests/test_security_*.py` (88 tests au total, tous verts) —
  OTP hors des logs, IDOR panier/commande (A vs B), stock `FOR UPDATE` +
  anti-survente, ticket WebSocket (expiration, session révoquée, permission
  absente), rate limiting 429 + délai progressif + alerte admin, CORS
  (origine acceptée/refusée), CSRF cookie, garde-fous dispatch/cutoff,
  uploads audio (413 avant lecture complète) et images (faux JPEG rejeté),
  erreurs internes génériques avec identifiant de corrélation.
- Front-end : `pnpm lint` (0 erreur), `pnpm typecheck` (0 erreur,
  `ignoreBuildErrors=false`), `pnpm build` OK (Next.js 16.2.10),
  `pnpm audit --prod` : aucune vulnérabilité connue.
- Mobile : `npm run typecheck` et `npm run lint` OK, `npm audit` :
  0 vulnérabilité (overrides `@babel/core`, `js-yaml`, `uuid`/`xcode`) —
  aucun risque résiduel à documenter.
- CI : `.github/workflows/ci.yml` — lint, typecheck, tests, audits npm/pip et
  scan de secrets (gitleaks) bloquants.

## Actions d'exploitation restantes (hors code — SALAH-01)

Ces actions se font sur les environnements, pas dans le dépôt :

- [ ] changer le mot de passe du compte administrateur exposé et invalider
      toutes ses sessions (`UserSession.is_active = false`) ;
- [ ] vérifier la non-réutilisation du mot de passe exposé sur d'autres comptes ;
- [ ] purger les secrets de l'historique Git avant toute publication du dépôt,
      par exemple : `git filter-repo --path back-end/test_api.http --invert-paths`
      (ou `--replace-text`), puis force-push et rotation des clones ;
- [ ] nettoyer les anciennes branches locales/distantes obsolètes.

Le JWT admin exposé est expiré depuis le 28 avril 2026 ; le fichier
`back-end/test_api.http` ne contient plus aucun secret (variables d'environnement
via `http-client.private.env.json`, ignoré par Git).

## Travaux communs

- CI complète : faite (voir ci-dessus).
- Tests d'autorisation horizontale : `test_security_idor.py`.
- Tests de concurrence stock/dispatch : `test_security_checkout_stock.py`,
  `test_security_dispatch_guardrails.py`.
- Découplage migrations/bootstrap/scheduler : indicateurs `SOUKI_SKIP_DB_INIT`,
  `SOUKI_SKIP_DATA_BOOTSTRAP`, `SOUKI_ENABLE_SCHEDULER` (back-end/main.py).
- `__pycache__`/`.pyc` retirés de l'index Git (déjà ignorés par .gitignore).
- Standard d'autorisation documenté : `Documentation/STANDARD_AUTORISATIONS.md`.
