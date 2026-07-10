# 🔒 Rapport d'audit de sécurité — Projet Souki

**Date :** 2026-06-09
**Périmètre :** Backend FastAPI (Python) + Frontend Next.js 16 / React 19 + Prisma + Supabase
**Branches auditées :** `Back-02`, `Back-07`, `Back-08`, `Back-09`, `Back01-JIT`, `Front02-Vocale`, auth, RBAC, pricing, uploads, wallet
**Statut :** Analyse seule — aucune modification de code effectuée.

---

## 📋 Sommaire

1. [Synthèse globale priorisée](#-synthèse-globale-priorisée)
2. [Backend — Critique](#-backend--critique)
3. [Backend — Élevé](#-backend--élevé)
4. [Backend — Moyen](#-backend--moyen)
5. [Backend — Points positifs](#-backend--points-positifs)
6. [Frontend — Critique](#-frontend--critique)
7. [Frontend — Élevé](#-frontend--élevé)
8. [Frontend — Moyen](#-frontend--moyen)
9. [Frontend — Points positifs](#-frontend--points-positifs)
10. [À déléguer au serveur / hébergeur](#-à-déléguer-au-serveur--hébergeur)
11. [Pistes complémentaires](#-pistes-complémentaires)

---

## 🎯 Synthèse globale priorisée

| #  | Sévérité | Problème | Zone | Effort |
|----|----------|----------|------|--------|
| 1  | 🔴 | `SECRET_KEY` JWT hardcodée + double définition incohérente | Back | Faible |
| 2  | 🔴 | Aucun rate-limiting (brute-force login/OTP) | Back | Moyen |
| 3  | 🔴 | `ignoreBuildErrors: true` (bugs TS en prod) | Front | Moyen |
| 4  | 🔴 | Token JWT 7 jours stocké en `localStorage` | Back+Front | Moyen-élevé |
| 5  | 🟠 | Codes OTP loggés en clair systématiquement | Back | Faible |
| 6  | 🟠 | Upload lu en RAM avant contrôle de taille (DoS) | Back | Faible |
| 7  | 🟠 | Schéma DB modifié au runtime (pas de migrations) | Back | Élevé |
| 8  | 🟠 | Aucun en-tête de sécurité / CSP | Front | Faible |
| 9  | 🟡 | Validation de formulaire côté client absente | Front | Moyen |
| 10 | 🟡 | Tokens Mapbox/Google à restreindre par domaine | Front | Faible |
| 11 | 🟠 | Autorisation incohérente (rôle en dur vs RBAC) sur JIT + commandes | Back | Faible |
| 12 | 🟠 | Aucune traçabilité sur les changements de prix | Back | Faible |
| 13 | 🟠 | Admin ne peut pas suspendre/réactiver un compte (`is_active`) | Back | Faible |
| 14 | 🟠 | Sessions sans expiration ni purge | Back | Moyen |
| 15 | 🟡 | `print()` au lieu de `logging` (secrets en clair sur stdout) | Back | Moyen |

> Les **4 critiques (#1 à #4)** sont à régler avant toute mise en ligne, quel que soit l'hébergeur.

---

## 🔴 Backend — Critique

### 1. Clé secrète JWT hardcodée dans le code
**Fichier :** `back-end/config.py:54`
```python
SECRET_KEY = "VOTRE_CLE_REELLEMENT_SECRETE_POUR_FES"  # À mettre en variable d'env
```
- Cette clé signe **tous** les tokens. Quiconque lit le repo peut **forger un token admin** et prendre le contrôle total de l'application.
- **Pire** : il existe **deux définitions différentes** de `SECRET_KEY` :
  - `back-end/config.py:54` → valeur hardcodée
  - `back-end/api/keys.py:14` → `os.getenv("SECRET_KEY", "VOTRE_CLE_SECRETE")` (fallback **différent** !)
- Selon le module importé, **deux clés différentes** peuvent être utilisées → incohérence + faille.
- **Correctif :** une seule source de vérité, lue **exclusivement** depuis l'environnement, sans fallback (lever une erreur si absente, comme c'est déjà fait pour `user`/`password`). Générer une vraie clé aléatoire : `secrets.token_urlsafe(64)`.

### 2. Aucune limitation de débit (rate-limiting)
**Constat :** aucun `slowapi` / limiter dans tout le backend.
- `/auth/login`, `/auth/admin/login`, `/auth/google` → **brute-force illimité** sur les mots de passe.
- `/auth/resend-otp` → spam d'envoi d'emails/SMS (coût + harcèlement).
- **Correctif :** rate-limiting par IP sur les endpoints d'auth (et idéalement global), au niveau applicatif (`slowapi`) **ou** délégué au reverse-proxy (Nginx / Cloudflare / API Gateway).

### 3. Token JWT valable 7 jours + stocké en `localStorage`
**Fichiers :** `back-end/config.py:56`, `front-end/contexts/auth-context.tsx:169`, `front-end/hooks/useApi.ts:20`
```python
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 jours
```
- `localStorage` est lisible par **n'importe quel JS** → une seule faille XSS = vol de session de 7 jours.
- **Correctif :** réduire la durée de vie (access token court + refresh token), envisager un cookie `httpOnly` + `Secure` + `SameSite`. Vérifier que `UserSessionService` révoque réellement les sessions.

---

## 🟠 Backend — Élevé

### 4. Le code OTP est imprimé en clair dans les logs — systématiquement
**Fichier :** `back-end/services/auth_service.py:382-390`
```python
print("SOUKI OTP DEBUG")
print(f"Code OTP    : {code}")
```
- En production, **tous les codes OTP** finissent dans les logs serveur (lisibles par quiconque a accès aux logs / à l'hébergeur). Casse complètement la valeur du 2FA.
- **Correctif :** conditionner à `if DEBUG:` (variable d'env) et désactiver en production.

### 5. Lecture complète du fichier en mémoire AVANT vérification de taille
**Fichiers :** `back-end/controllers/produit_pricing_controller.py:113` (et upload audio vocal)
```python
content = await file.read()        # lit TOUT en RAM
... puis len(content) > MAX        # vérifie après
```
- Un attaquant peut uploader un fichier de plusieurs Go → la limite n'est vérifiée qu'**après** avoir tout chargé en RAM → **DoS mémoire**.
- **Correctif :** limiter la taille du body en amont (middleware / config serveur), ou lire par chunks avec coupure.

### 6. CORS — configuration permissive par défaut
**Fichier :** `back-end/main.py:91-105`
- `allow_credentials=True` + `allow_headers=["*"]` + regex par défaut autorisant tout `localhost`/`127.0.0.1`.
- **Correctif :** en prod, `FRONTEND_ORIGINS` doit impérativement être positionné (domaine réel uniquement).

### 7. `uvicorn` lancé avec `reload=True` et `host="0.0.0.0"`
**Fichier :** `back-end/main.py:136`
- `reload=True` ne doit **jamais** tourner en prod (perf, sécurité, watcher fichiers).
- **Correctif :** lancement prod via Gunicorn/Uvicorn workers, paramètres délégués au serveur.

### 8. Création / altération de schéma automatique au démarrage
**Fichier :** `back-end/main.py:36-57`
- `Base.metadata.create_all`, `WalletSchemaSyncService.sync()`, `ALTER TABLE …` exécutés à **chaque boot**.
- Risque en prod : modifications de schéma non contrôlées, conditions de course au déploiement multi-instances. Les `ALTER TABLE` en dur sont des migrations déguisées.
- **Correctif :** migrations versionnées (Alembic), ne pas modifier le schéma au runtime en prod.

---

## 🟡 Backend — Moyen

### 9. Endpoint Google OAuth « legacy » dupliqué
**Fichier :** `back-end/controllers/auth_controller.py:65-80`
- `/google` et `/google-login` font exactement la même chose → surface d'attaque dupliquée, dette technique. Supprimer le legacy.

### 10. Le rôle est choisi par le client lors du Google login
**Fichier :** `back-end/services/auth_service.py:251, 264`
- `google_login(token, role)` — le `role` vient du **body de la requête**. `_assert_target_access` protège derrière, mais à la création d'un nouveau compte Google le rôle demandé est assigné directement. Vérifier qu'un client ne peut pas s'auto-attribuer un rôle privilégié au premier login.

### 11. `register` : un `role=ADMIN` est silencieusement rétrogradé en CLIENT
**Fichier :** `back-end/services/auth_service.py:58`
- Bon réflexe, mais cela signifie que la création d'admin passe ailleurs. Vérifier qu'il n'existe **aucun** chemin public pour créer un admin.

### 12. Sessions DB ouvertes manuellement partout
**Constat :** pattern `LocalSession()` + `try/finally` répété dans tous les controllers/services au lieu d'une dépendance FastAPI `get_db`.
- Risque : une session oubliée = fuite de connexion (pool limité à 10+5). Beaucoup de code, facile d'en rater une.
- **Correctif :** refactorer en dépendance unique injectée.

### 13. Messages d'erreur de validation renvoyés au client
**Fichier :** `back-end/main.py:108-114`
- Renvoie tous les `msg` d'erreur concaténés → peut fuiter des détails internes de structure. Mineur, à surveiller.

### 14. `/docs` et `/openapi.json` FastAPI exposés par défaut
- À désactiver ou protéger en prod si l'API est publique.

### 15. 🟠 Modèle d'autorisation incohérent : vérification de rôle en dur vs RBAC
**Fichiers :** `back-end/controllers/jit_controller.py:14-24`, `back-end/controllers/commande_controller.py:41-51`
- Deux controllers définissent un helper **dupliqué** `get_admin_user` qui vérifie le rôle **en dur** :
```python
if not user or user.primary_role != "ADMIN":
    raise HTTPException(403, ...)
```
- Or le reste de l'admin utilise le **système RBAC par permissions** : `Depends(require_permission("admin.panel.access"))`.
- **Endpoints concernés par le check en dur** (donc hors RBAC) :
  - JIT : `/api/jit/agreguer`, `/executer`, `/deverrouiller`, `/logs/dernier`, `/logs/{plage}`
  - Commandes : `/api/commandes`, `/api/commandes/jour`, **`/api/commandes/clients/{client_id}`** (fiche client complète — donnée sensible)
- **Problèmes :**
  - Un compte avec la permission `admin.panel.access` mais dont `primary_role` n'est pas exactement `"ADMIN"` (futur rôle « manager », « superviseur ») serait bloqué ici mais autorisé ailleurs → deux modèles d'autorisation contradictoires.
  - Le check en dur sur la chaîne `"ADMIN"` court-circuite le RBAC construit précisément pour éviter ça.
- **Correctif :** remplacer les deux `get_admin_user` par `Depends(require_permission("admin.panel.access"))` (ou une permission dédiée type `jit.execute` / `orders.read`). Détail : `import os` inutilisé dans `jit_controller.py:2`.

### 16. 🟠 Aucune traçabilité (audit trail) sur les changements de prix
**Fichiers :** `back-end/controllers/produit_pricing_controller.py:54,85,99,157`, `back-end/services/produit_pricing_service.py`
- Les mutations de pricing (`create_product`, `update_pricing`, `deactivate_product`, `recalculer_tous`) récupèrent le `principal` puis le **jettent** (`_ = principal`) : il n'est **jamais transmis au service**.
- Conséquence : **aucune trace de qui a modifié un prix, quand**. Pour une action financière sensible, c'est une lacune d'accountability.
- À noter : les actions blacklist, elles, **enregistrent bien l'`admin_id`** (`client_blacklist_service.py:84,114,170`) ✅ — à répliquer sur le pricing.
- **Correctif :** persister `actor_id` + horodatage sur chaque mutation de prix (table d'audit ou colonnes `updated_by`/`updated_at`).

### 17. 🟡 Endpoint déprécié toujours exposé
**Fichier :** `back-end/controllers/commande_controller.py:211`
- `/api/commandes/cod/demain` est marqué `DEPRECATED` mais reste actif. Surface d'attaque inutile → à supprimer une fois le front migré vers `/verouillees`.

---

## 🟢 Backend — Points positifs

- ✅ Mots de passe : **bcrypt** correct (`back-end/security.py`).
- ✅ OTP : hashé en base, compteur de tentatives, fenêtre de renvoi limitée (`auth_service.py:146-249`).
- ✅ `.env` bien gitignoré et **jamais committé** (vérifié dans l'historique git).
- ✅ RBAC permissions/rôles propre ; endpoints pricing protégés par `require_permission` (`produit_pricing_controller.py`).
- ✅ Uploads : vérification MIME + taille + validation d'URL (anti `data:`) présentes.
- ✅ SQL : usage ORM SQLAlchemy partout ; les `text()` sont du DDL statique → **pas d'injection SQL** détectée.
- ✅ Token Google vérifié côté serveur via `id_token.verify_oauth2_token`.

---

## 🔴 Frontend — Critique

### 1. Les erreurs TypeScript sont ignorées au build
**Fichier :** `front-end/next.config.mjs:14-16`
```js
typescript: { ignoreBuildErrors: true }
```
- Le build **réussit même si le typage est cassé** → déploiement possible de code avec des bugs de type (champs undefined, mauvais types de props…).
- **Correctif :** passer à `false`, corriger les erreurs TS révélées. Priorité n°1 du frontend.

### 2. Token JWT dans `localStorage` (rappel côté front)
**Fichier :** `front-end/contexts/auth-context.tsx:169`
- Le token vit dans `localStorage`, lu à chaque requête. Toute faille XSS = **vol du token pour 7 jours**.
- Aggravant : **aucun en-tête de sécurité (CSP)** configuré (voir Frontend #6).
- **Correctif :** durée de vie courte + refresh, idéalement cookie `httpOnly`. Le proxy `/backend` existant permettrait de gérer un cookie httpOnly proprement.

---

## 🟠 Frontend — Élevé

### 3. Aucune validation de formulaire côté client (zod présent mais inutilisé)
**Constat :** `zod` + `@hookform/resolvers` sont dans les dépendances, mais **aucun `zodResolver` / `safeParse`** dans le code.
- Les formulaires (register, login, checkout, pricing admin) envoient les données brutes ; toute la validation repose sur le backend Pydantic.
- Pas une faille (backend valide), mais **mauvaise UX** (erreurs tardives) + dépendance morte.
- **Correctif :** valider les champs critiques (email, téléphone, mot de passe, montants) côté client avec zod, déjà installé.

### 4. Token Mapbox public exposé sans restriction
**Fichiers :** `front-end/app/livreur/page.tsx:53`, `front-end/components/souki/mapbox-locator.tsx:70`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` est visible par tous dans le bundle client (normal pour Mapbox).
- **Risque :** si ce token n'est pas restreint par URL/domaine dans le dashboard Mapbox, n'importe qui peut le copier et **consommer ton quota / ta facturation**.
- **Correctif :** restreindre le token aux domaines de prod dans Mapbox. Idem pour `GOOGLE_CLIENT_ID` (origines autorisées dans Google Cloud Console).

### 5. Protection des routes admin uniquement côté client
**Fichier :** `front-end/app/admin/layout.tsx`
- Le garde de route (`can("admin.panel.access")` + `router.replace`) est purement **client-side** : confort UX, **pas** sécurité.
- La **vraie** barrière est le backend (`require_permission`), qui est correct. ✅
- **À retenir :** ne jamais mettre de logique sensible (calcul de prix, données d'autres clients) dans les composants admin en se reposant sur ce garde. Tout doit rester protégé côté API.

---

## 🟡 Frontend — Moyen

### 6. Aucun en-tête de sécurité HTTP configuré
**Fichier :** `front-end/next.config.mjs` (pas de bloc `async headers()`)
- Manquent : `Content-Security-Policy`, `X-Frame-Options` (anti-clickjacking), `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`.
- Avec un token en localStorage, une **CSP** est la meilleure défense anti-XSS.
- **Correctif :** ajouter ces en-têtes (dans `next.config` ou délégué au reverse-proxy).

### 7. Proxy `/backend/[...path]` ouvert à toutes les méthodes
**Fichier :** `front-end/app/backend/[...path]/route.ts`
- Relaie GET/POST/PUT/PATCH/DELETE/OPTIONS et recopie tous les headers. Fonctionnel, cible figée par env (pas de SSRF). ✅
- **Point d'attention :** transmet aussi des headers falsifiables (`x-forwarded-for`…). Si le backend fait un jour confiance à ces headers (rate-limit par IP), les nettoyer ici.

### 8. Versions très récentes / cutting-edge
- `next@^16`, `react@19.2`, `tailwindcss@^4` : versions de pointe → risque de bugs/instabilités et failles non encore patchées.
- **Correctif :** figer des versions stables (enlever les `^` pour next/react), lancer `npm audit` régulièrement.

### 9. `images: { unoptimized: true }`
**Fichier :** `front-end/next.config.mjs:17`
- Désactive l'optimisation d'images Next (perf/bande passante). Acceptable selon l'hébergeur, à reconsidérer en prod.

---

## 🟢 Frontend — Points positifs

- ✅ **Aucun secret hardcodé** : tous les tokens (Mapbox, Google, API) viennent de l'environnement, fallback vide.
- ✅ Pas de `eval` / `new Function`. `dangerouslySetInnerHTML` uniquement dans `chart.tsx` (composant shadcn standard, sûr).
- ✅ Appels API **centralisés** (`lib/api.ts`, `useApi.ts`) → facile à durcir au même endroit.
- ✅ Bonne gestion réseau : timeouts, retries, AbortController, messages clairs.
- ✅ Le proxy serveur évite d'exposer l'URL réelle du backend au navigateur.
- ✅ `.env.local` gitignoré, ne contient que `NODE_OPTIONS` (aucun secret).

---

## 📦 À déléguer au serveur / hébergeur

### Backend

| À externaliser | État actuel |
|---|---|
| `SECRET_KEY` (vraie clé aléatoire, obligatoire) | hardcodé `config.py:54` |
| `FRONTEND_ORIGINS` (domaine réel, pas localhost) | fallback localhost `main.py:83` |
| Rate-limiting | reverse-proxy / gateway (absent) |
| `DEBUG=false` → couper les logs OTP | toujours actif `auth_service.py:384` |
| Lancement prod sans `reload`, avec workers | `main.py:136` |
| Limite taille body upload | proxy (Nginx `client_max_body_size`) |
| Migrations DB (Alembic) au lieu de `create_all` / `ALTER` runtime | `main.py:36-57` |
| `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, SMTP | déjà en env ✅ |
| HTTPS / TLS | hébergeur |

### Frontend

| À configurer en prod | État actuel |
|---|---|
| En-têtes de sécurité (CSP, HSTS, X-Frame-Options…) | absents → proxy/hébergeur |
| `BACKEND_INTERNAL_URL` (URL interne du backend) | fallback `127.0.0.1:8000` `route.ts:10` |
| `NEXT_PUBLIC_API_URL` (domaine prod) | défaut `/backend` |
| Restriction domaine du token Mapbox | dashboard Mapbox |
| Origines autorisées Google OAuth | Google Cloud Console |
| HTTPS obligatoire + cookies `Secure` | hébergeur |

---

## 🛡️ Focus — Sécurité du Dashboard Admin

Audit ciblé de tout ce qui alimente le back-office (`front-end/app/admin/*` ↔ endpoints backend).

### Ce qui est bien fait ✅
- **RBAC granulaire** sur la majorité des endpoints admin (`back-end/controllers/admin_controller.py`, `dispatch_controller.py`, `produit_pricing_controller.py`) : `require_permission("admin.panel.access", "clients.read" | "clients.blacklist" | "deliveries.read" | "orders.read" …)`. Modèle propre et fin.
- **Vraie barrière côté backend** : la protection ne dépend pas du front. Le garde de route `front-end/app/admin/layout.tsx` est purement cosmétique (UX), mais chaque endpoint vérifie les permissions côté serveur.
- **Audit trail blacklist** : les actions (blacklist manuel, levée, rejet) enregistrent l'`admin_id` de l'auteur (`client_blacklist_service.py`).
- **Section « Logs » du dashboard = donnée métier** (dernier cycle JIT), stockée en DB et servie par `GET /api/jit/logs/dernier`. **Déjà côté serveur, rien à déléguer** — c'est de l'applicatif, pas un log technique.

### Failles / incohérences ❌
- **Autorisation incohérente** (cf. Backend #15) : les endpoints JIT et `/api/commandes*` utilisent une vérif de rôle en dur (`primary_role != "ADMIN"`) au lieu du RBAC. L'endpoint **`/api/commandes/clients/{client_id}`** (fiche client complète, donnée sensible) est protégé par ce check fragile.
- **Pas de traçabilité pricing** (cf. Backend #16) : modifier un prix ne laisse aucune trace de l'auteur.
- **Pas de rate-limiting** sur `/auth/admin/login` → brute-force du compte admin (cf. Backend #2).
- **Garde admin uniquement client-side** côté front (acceptable car backend protège, mais ne jamais y mettre de logique sensible).

### Que déléguer au serveur / hébergeur pour l'admin
| Élément | Nature | Où le gérer |
|---|---|---|
| Logs **techniques** (stdout, erreurs, prints OTP) | Observabilité | Hébergeur (agrégation de logs, monitoring) |
| Logs **métier** (JIT, blacklist, commandes) | Donnée applicative | **Reste en DB + API backend** (déjà le cas) |
| Audit trail des actions admin (pricing, levées, JIT) | Accountability | Application (table d'audit en DB) — à compléter pour le pricing |
| Rate-limiting `/auth/admin/login` | Protection brute-force | Reverse-proxy / gateway |
| Restriction d'accès au back-office par IP (optionnel) | Durcissement | Reverse-proxy / firewall |
| HTTPS + en-têtes de sécurité sur les routes `/admin` | Transport | Hébergeur / proxy |

**En résumé sur ta question initiale :** la section « Logs » de l'admin est de la **donnée métier déjà servie par le backend** → on ne la délègue pas à l'infra. Ce qu'on délègue à l'hébergeur, ce sont les **logs techniques/système** (monitoring), une catégorie différente.

---

## 👤 Focus — Gestion des utilisateurs, sessions & état actif

Audit ciblé : où sont gérées les fiches utilisateurs, les connexions et l'état actif/inactif. **Tous les manques ci-dessous ont été vérifiés dans le code.**

### Où c'est géré aujourd'hui
| Élément | Emplacement | Verdict |
|---|---|---|
| **Fiches utilisateurs** | DB (`user_entity` + profils client/parent/livreur), API backend ; lecture admin via `/api/admin/clients` et `/api/commandes/clients/{id}` ; self-service via `settings_service` | Bon endroit (serveur/DB) ✅ |
| **Sessions / connexion** | DB (`user_session_entity`), `user_session_service` ; token **hashé SHA-256**, validé à chaque requête ; self-service (liste, déconnexion une/toutes) | Bon endroit (sessions serveur) ✅ |
| **État actif/inactif** | Colonne `user.is_active`, vérifiée à **chaque requête** (`auth_dependencies.py:30`) → effet immédiat | Bon mécanisme ✅ |

→ **Tout ceci est de la logique applicative (serveur + DB), à NE PAS déléguer à l'infra d'hébergement.**

### Manques vérifiés ❌
1. **🟠 L'admin ne peut pas suspendre/réactiver un compte.** Le seul write sur `user.is_active` est l'auto-désactivation (`settings_service.py:302`). Aucun endpoint admin ne gère `is_active`. La **blacklist** (COD, par téléphone) est un mécanisme **séparé** qui ne désactive pas le compte. → Ajouter un endpoint admin (RBAC + audit) pour suspendre/réactiver.
2. **🟠 Sessions sans expiration ni purge.** `user_session_entity` n'a **aucune colonne `expires_at`** ; les lignes `is_active=True` s'accumulent indéfiniment. → Ajouter `expires_at` + job de purge planifié (scheduler).
3. **🟡 `last_active` jamais mis à jour** après la création (`user_session_service.py:46` est le seul write). → La « Dernière activité » affichée est fausse.
4. **🟡 Aucune limite du nombre de sessions** par utilisateur. → Accumulation possible.
5. **🟡 `delete_account` = soft delete** (`is_active=False`, `settings_service.py:296`) sans suppression ni anonymisation des données personnelles. → **Risque de conformité (RGPD / loi marocaine 09-08)**.

### À déléguer au serveur / hébergeur (sur ce périmètre)
- **Purge planifiée des sessions expirées** → job dans `scheduler_service` (applicatif) ou cron côté serveur.
- **HTTPS + stockage sécurisé** → hébergeur.
- **Store de sessions type Redis** → optionnel, seulement en cas de montée en charge.

> La priorité n'est pas de « déléguer » mais de **combler les manques applicatifs**, surtout #1 (suspension de compte par l'admin) et #2 (expiration/purge des sessions).

---

## 🪵 Stratégie de logs — 3 couches distinctes

Clarification importante : le projet a **trois types de logs** qu'il ne faut pas confondre. Nginx ne couvre que le premier.

| Couche | Qui l'écrit | Contenu | Où en prod |
|---|---|---|---|
| **1. Logs Nginx / reverse-proxy** | Le proxy | Requêtes HTTP (IP, méthode, URL, statut, latence, user-agent) | `access.log` / `error.log` — **uniquement si déployé derrière Nginx (VPS)**. Sur PaaS : fournis automatiquement. |
| **2. Logs applicatifs** | Le code Python → stdout | Erreurs, debug, **codes OTP** (`auth_service.py`) | Capturés par le gestionnaire de process (systemd / Docker / PaaS). **Nginx ne les voit pas.** |
| **3. Logs métier / audit** | L'application → **DB** | JIT, blacklist (+ pricing/suspension à ajouter) | Restent en DB ✅ |

### Points clés
- **Nginx ne voit que la couche 1.** Il ne capte pas les `print()` OTP (couche 2) → le problème des OTP en clair (#5) se corrige **dans le code**, pas via Nginx.
- **État actuel du code :** ~14 fichiers utilisent `print()`, seulement 2 utilisent `logging`. → **Remplacer les `print()` par le module `logging`** (niveaux, pas de secrets) pour un stdout propre, capturable par n'importe quel hébergeur.
- **Nginx en prod : pertinent SI VPS.** Il résout alors plusieurs points de l'audit d'un coup :
  - `access.log` → détection brute-force (#2)
  - `limit_req` → rate-limiting (#2)
  - `add_header` → en-têtes de sécurité / CSP (Front #6)
  - `client_max_body_size` → limite taille upload (#6)
  - terminaison TLS/HTTPS
- **Sur PaaS (Render/Railway/Vercel)** : pas de `nginx.conf` à écrire ; access logs + HTTPS automatiques ; rate-limiting/headers via middleware applicatif.
- **Recommandation (hébergement non décidé) :** ne pas configurer Nginx maintenant, mais **nettoyer dès maintenant la couche 2** (`logging` au lieu de `print()`) et garder la couche 3 en DB.

---

## 🔎 Pistes complémentaires

Zones non encore auditées en profondeur, recommandées avant la mise en production :

1. **Logique financière** (`souki_wallet_service`, `claim_service`, transactions) — vérifier l'idempotence, le double-crédit, les conditions de course. C'est souvent là que se cachent les bugs les plus coûteux.
2. **Audit frontend approfondi** — XSS sur les champs riches, gestion fine des erreurs, fuites de données dans les logs console.
3. **`npm audit` / `pip audit`** — vulnérabilités connues dans les dépendances.
4. **Tests de charge / DoS** — sur les endpoints d'upload et d'auth.

---

*Rapport généré dans le cadre d'une revue de sécurité interne. Aucun code n'a été modifié.*
