# Rapport d'audit — Cybersécurité, débogage et qualité

Date de l'audit : 21 juin 2026  
Dépôt audité : `Souki`  
Branche active : `fournisseur` (`ed30bdb`, identique à `main`)  
Mode d'audit : lecture seule du code et de Git. Aucun correctif n'a été appliqué.

## Résumé exécutif

- Niveau de risque global : **Élevé**
- Vulnérabilités confirmées : **10**
- Bugs et défauts de robustesse confirmés : **6**
- Principaux risques :
  - identifiants et ancien JWT administrateur versionnés ;
  - codes OTP et destinations écrits en clair dans les logs ;
  - accès horizontal possible aux paniers et commandes vocales d'autres utilisateurs ;
  - dépendance Next.js 16.2.4 affectée par plusieurs avis de sécurité élevés ;
  - concurrence non maîtrisée pendant la décrémentation du stock ;
  - JWT WebSocket transmis dans l'URL et non rattaché au registre de sessions ;
  - uploads audio chargés intégralement en mémoire sans limite de taille ;
  - absence de limitation globale des tentatives de connexion.

Le JWT administrateur versionné expirait le **28 avril 2026 à 19:19:41 UTC**. Il n'est donc plus directement réutilisable le 21 juin 2026. En revanche, le mot de passe administrateur présent dans le même fichier doit être considéré comme compromis tant que sa rotation n'a pas été vérifiée.

## Périmètre et méthode

### Éléments examinés

- Backend FastAPI, SQLAlchemy et PostgreSQL ;
- frontend Next.js ;
- application mobile Expo/React Native ;
- fichiers de configuration, lockfiles et scripts ;
- historique et branches Git locales ;
- usages JWT, RBAC, OTP, uploads, stockage Supabase, CORS, SQL et appels réseau.

### Vérifications exécutées

- recherche statique ciblée de secrets et constructions dangereuses ;
- inventaire des routes et de leurs dépendances d'autorisation ;
- analyse des flux d'authentification, session, panier, commande, checkout et stockage ;
- comparaison des branches et inspection des commits sensibles ;
- `npm audit --omit=dev --json` sur le frontend et le mobile.

### Limites vérifiées

- `eslint`, `tsc`, Bandit, pip-audit et Semgrep ne sont pas installés ou exécutables dans les sous-projets ;
- le lint frontend et le typecheck mobile n'ont donc pas pu être menés ;
- aucun test d'intégration n'a été lancé, car il pourrait se connecter à la base configurée et modifier ses données ;
- l'audit Python de syntaxe n'a pas abouti à cause de l'environnement d'exécution local ;
- aucune tentative d'authentification avec les identifiants exposés n'a été faite.

## Vulnérabilités

### VULN-001 — Identifiants et JWT administrateur versionnés

- Gravité : **Élevée**
- CWE : CWE-798, CWE-522
- OWASP : A02 — Cryptographic Failures, A07 — Identification and Authentication Failures
- Fichier : `back-end/test_api.http`
- Lignes : 173-189
- Commit introducteur principal : `6c7f068` du 23 avril 2026
- Description : le fichier contient une adresse administrateur, un mot de passe en clair et un JWT administrateur signé. Le JWT est expiré, mais le mot de passe peut encore être valide et le secret reste présent dans tout l'historique Git.
- Risque : prise de contrôle du compte administrateur si le mot de passe n'a pas été changé ; réutilisation du mot de passe sur d'autres environnements ; exposition de métadonnées internes du JWT.
- Exemple d'exploitation : un lecteur du dépôt récupère l'identifiant et tente une connexion sur `/auth/admin/login`.
- Correctif recommandé :
  1. changer immédiatement le mot de passe du compte concerné ;
  2. invalider toutes ses sessions ;
  3. supprimer les valeurs du fichier suivi ;
  4. purger le secret de l'historique Git avec `git filter-repo` ou BFG ;
  5. ajouter un scanner de secrets en pré-commit et en CI.
- Code corrigé proposé :

```http
@admin_login_id = {{$processEnv ADMIN_LOGIN_ID}}
@admin_password = {{$processEnv ADMIN_PASSWORD}}
@admin_token = {{admin_login.response.body.access_token}}

POST {{BASE_URL}}/auth/admin/login
Content-Type: application/json

{
  "login_id": "{{admin_login_id}}",
  "password": "{{admin_password}}"
}
```

### VULN-002 — Codes OTP et destinations exposés dans les logs

- Gravité : **Élevée**
- CWE : CWE-532
- OWASP : A09 — Security Logging and Monitoring Failures
- Fichier : `back-end/services/auth_service.py`
- Lignes : 387-407, particulièrement 391-395
- Commit introducteur : `38fa798` du 20 juin 2026
- Description : chaque OTP, ainsi que l'email ou le téléphone associé, est écrit au niveau `ERROR`.
- Risque : toute personne ou plateforme ayant accès aux logs peut valider un compte ou détourner une vérification OTP pendant sa fenêtre de 15 minutes.
- Exemple d'exploitation : lecture du journal applicatif, récupération du `user_id` par l'API, puis appel de `/auth/verify-otp`.
- Correctif recommandé : ne jamais journaliser un OTP, même en développement partagé. Utiliser un fournisseur de test dédié ou un faux service injecté uniquement dans des tests locaux.
- Code corrigé proposé :

```python
def _send_otp(self, user: User, channel: str, code: str) -> None:
    destination = user.email if channel == "email" else user.phone
    if channel == "email":
        _email_service.send_otp_email(destination, code)
        logger.info("OTP envoyé", extra={"channel": channel, "user_id": user.id})
        return
    raise HTTPException(status_code=503, detail="Canal OTP indisponible")
```

### VULN-003 — IDOR sur les commandes vocales

- Gravité : **Élevée**
- CWE : CWE-639
- OWASP : A01 — Broken Access Control
- Fichiers et lignes :
  - `back-end/controllers/commande_controller.py:197-205`
  - `back-end/services/commande_service.py:97-111`
  - `back-end/dao/commande_dao.py:79-99`
- Description : l'utilisateur doit être authentifié, mais `principal.user_id` est ignoré. La requête DAO filtre uniquement sur l'identifiant de commande.
- Risque : un utilisateur authentifié peut énumérer les identifiants et lire la transcription, les produits, quantités et prix d'autres clients.
- Exemple d'exploitation : `GET /api/commandes/42` avec le JWT d'un utilisateur différent du propriétaire de la commande 42.
- Correctif recommandé : transmettre l'identifiant du propriétaire jusqu'au DAO et filtrer simultanément par commande et utilisateur.
- Code corrigé proposé :

```python
@router_voice.get("/commandes/{commande_id}", response_model=CommandeCheckoutDTO)
def get_commande_checkout(
    commande_id: int,
    principal=Depends(require_auth),
    service: ICommandeVocaleService = Depends(get_voice_service),
):
    with service:
        detail = service.get_commande_checkout(commande_id, principal.user_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Commande non trouvée")
        return detail
```

```python
cmd = (
    session.query(CommandeVocale)
    .filter(
        CommandeVocale.id == commande_id,
        CommandeVocale.client_id == user_id,
    )
    .first()
)
```

### VULN-004 — IDOR sur les paniers

- Gravité : **Élevée**
- CWE : CWE-639
- OWASP : A01 — Broken Access Control
- Fichiers et lignes :
  - `back-end/controllers/panier_controller.py:51-60`
  - `back-end/services/panier_service.py:204-212`
  - `back-end/dao/panier_dao.py:76-85`
- Description : le principal authentifié est ignoré et le panier est chargé uniquement par son identifiant.
- Risque : exposition des produits, quantités et montants d'un autre utilisateur.
- Exemple d'exploitation : `GET /api/paniers/100` avec n'importe quel JWT valide.
- Correctif recommandé : filtrer `Panier.id` et `Panier.user_id`, puis appliquer le même filtre aux lignes.
- Code corrigé proposé :

```python
def get_panier_by_id(
    self, session: Session, panier_id: int, user_id: int
) -> Optional[Panier]:
    return (
        session.query(Panier)
        .filter(Panier.id == panier_id, Panier.user_id == user_id)
        .first()
    )
```

### VULN-005 — Next.js 16.2.4 vulnérable

- Gravité : **Élevée**
- CWE principales : CWE-288, CWE-770, CWE-918
- Fichiers :
  - `front-end/package.json:49`
  - `front-end/package-lock.json:737-857` et entrée `node_modules/next`
- Version résolue : **16.2.4**
- Résultat outil : `npm audit` signale une dépendance directe de gravité élevée et une dépendance PostCSS modérée.
- Risques confirmés par les avis npm/GitHub :
  - contournements de middleware/proxy ;
  - dénis de service ;
  - SSRF dans certains scénarios WebSocket ;
  - XSS dans certains usages App Router ;
  - empoisonnement de cache.
- Avis principaux :
  - https://github.com/advisories/GHSA-492v-c6pp-mqqv
  - https://github.com/advisories/GHSA-c4j6-fc7j-m34r
  - https://github.com/advisories/GHSA-26hh-7cqf-hhc6
  - https://github.com/advisories/GHSA-8h8q-6873-q5fj
- Correctif recommandé : mettre à jour Next.js vers une version stable non affectée, au minimum celle proposée par `npm audit`, puis reconstruire et tester les routes proxy.
- Code corrigé proposé :

```json
{
  "dependencies": {
    "next": "^16.2.6"
  }
}
```

La version finale doit être validée avec un nouvel `npm audit` au moment de la correction.

### VULN-006 — Course critique sur le stock au checkout

- Gravité : **Élevée**
- CWE : CWE-362
- Fichiers et lignes :
  - `back-end/services/checkout_service.py:107-141`
  - `back-end/dao/checkout_dao.py:17-23`
- Description : les produits sont lus, leur stock est contrôlé, puis décrémenté sans verrou de ligne ni mise à jour atomique conditionnelle.
- Risque : deux checkouts simultanés peuvent tous deux observer le même stock et créer des commandes dépassant le stock réel.
- Exemple : stock 5 ; deux requêtes concurrentes commandent chacune 4 ; les deux validations peuvent réussir.
- Correctif recommandé : verrouiller les produits dans un ordre déterministe avec `SELECT ... FOR UPDATE` ou utiliser une mise à jour atomique `stock = stock - quantité WHERE stock >= quantité`.
- Code corrigé proposé :

```python
def get_products_by_ids_for_update(
    self, session: Session, product_ids: list[int]
) -> list[Product]:
    return (
        session.query(Product)
        .filter(Product.id.in_(sorted(set(product_ids))))
        .order_by(Product.id.asc())
        .with_for_update()
        .all()
    )
```

### VULN-007 — JWT WebSocket dans l'URL et révocation non vérifiée

- Gravité : **Élevée**
- CWE : CWE-598, CWE-613
- Fichier : `back-end/controllers/admin_controller.py`
- Lignes :
  - 43-59 : validation JWT et permissions ;
  - 189-198 : récupération du token dans `query_params`.
- Description :
  - le JWT est placé dans l'URL WebSocket, qui peut être conservée dans les logs, outils de monitoring et historiques ;
  - `_authorize_delivery_stream` ne consulte pas `UserSessionService`, contrairement à `require_auth` ;
  - l'état actif de l'utilisateur n'est pas contrôlé.
- Risque : une session révoquée peut rester utilisable jusqu'à expiration du JWT ; fuite du bearer token par journalisation d'URL.
- Correctif recommandé : émettre un ticket WebSocket opaque, à courte durée et usage unique depuis un endpoint HTTP protégé par `require_auth`.
- Code corrigé proposé :

```python
@admin_router.post("/ws-ticket")
def create_ws_ticket(principal=Depends(require_permission(
    "admin.panel.access", "deliveries.read"
))):
    return ws_ticket_service.issue(principal.user_id, ttl_seconds=30)

# Le WebSocket reçoit uniquement le ticket opaque et le consomme une fois.
```

### VULN-008 — Upload audio sans limite de taille

- Gravité : **Élevée**
- CWE : CWE-400
- Fichier : `back-end/controllers/commande_controller.py`
- Lignes : 51-76
- Description : le fichier est lu entièrement en mémoire, puis encodé en base64, sans limite de taille ni validation fiable du type.
- Risque : épuisement mémoire, saturation des workers et coûts externes élevés lors de l'envoi à Gemini.
- Exemple d'exploitation : envoi authentifié répété de fichiers de plusieurs centaines de mégaoctets.
- Correctif recommandé :
  - imposer une limite au serveur/reverse proxy ;
  - lire par blocs avec arrêt au seuil ;
  - autoriser une liste stricte de MIME/types ;
  - appliquer un quota par utilisateur.
- Code corrigé proposé :

```python
MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_AUDIO_TYPES = {"audio/wav", "audio/mpeg", "audio/webm"}

if audio.content_type not in ALLOWED_AUDIO_TYPES:
    raise HTTPException(status_code=415, detail="Format audio non supporté")

audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
if len(audio_bytes) > MAX_AUDIO_BYTES:
    raise HTTPException(status_code=413, detail="Audio trop volumineux")
```

### VULN-009 — Absence de limitation globale des connexions

- Gravité : **Moyenne**
- CWE : CWE-307
- Fichiers et lignes :
  - `back-end/controllers/auth_controller.py:33-55`
  - `back-end/services/auth_service.py:102-148`
- Description : les endpoints utilisateur et administrateur ne disposent d'aucun limiteur par IP, compte ou empreinte. Les limites présentes concernent uniquement les OTP.
- Risque : brute force, credential stuffing et charge bcrypt volontaire.
- Correctif recommandé : limiter par IP et identifiant, introduire un délai progressif et alerter sur les échecs administrateur.
- Code corrigé proposé :

```python
@limiter.limit("5/minute")
@auth_router.post("/admin/login")
def admin_login(request: Request, data: AdminLoginRequest):
    ...
```

Le stockage des compteurs doit être partagé, par exemple Redis, pour fonctionner avec plusieurs workers.

### VULN-010 — Jeton navigateur stocké dans `localStorage`

- Gravité : **Moyenne**
- CWE : CWE-922
- Fichiers et lignes :
  - `front-end/contexts/auth-context.tsx:162-206`
  - `front-end/app/verify/page.tsx:81`
  - plusieurs lectures dans `front-end/lib/catalogue.ts`
- Description : le JWT est persistant et accessible à tout JavaScript exécuté sur l'origine.
- Risque : une XSS ou une dépendance frontend compromise peut exfiltrer le bearer token et l'utiliser pendant sa durée de sept jours.
- Correctif recommandé : préférer un cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict`, avec protection CSRF adaptée. À défaut, réduire fortement la durée de l'access token et utiliser une rotation de refresh token.
- Code corrigé proposé :

```python
response.set_cookie(
    "access_token",
    token,
    httponly=True,
    secure=True,
    samesite="lax",
    max_age=900,
    path="/",
)
```

## Risques complémentaires

### RISK-001 — Validation des images fondée sur le MIME déclaré

- Gravité : **Moyenne**
- Fichiers et lignes :
  - `back-end/controllers/settings_controller.py:47-59`
  - `back-end/controllers/produit_pricing_controller.py:96-110`
  - `back-end/services/supabase_storage_service.py:240-287`
- Constat : le type déclaré par le client est contrôlé, mais la signature réelle de l'image n'est pas vérifiée. Les fichiers sont lus intégralement avant le contrôle de taille.
- Recommandation : décoder et réencoder les images côté serveur, retirer les métadonnées et limiter la taille au reverse proxy.

### RISK-002 — Détails d'exception retournés aux clients

- Gravité : **Moyenne**
- Exemples :
  - `back-end/controllers/panier_controller.py:44-47`
  - `back-end/controllers/jit_controller.py:40-273`
  - `back-end/controllers/commande_controller.py:93-147`
  - `back-end/controllers/settings_controller.py:60-63`
- Constat : plusieurs réponses HTTP incorporent `str(exception)`.
- Risque : fuite de noms de tables, contraintes, services externes, chemins ou détails d'infrastructure.
- Recommandation : journaliser un identifiant de corrélation côté serveur et renvoyer un message générique.

### RISK-003 — En-têtes de sécurité HTTP incomplets

- Gravité : **Faible**
- Fichier : `front-end/next.config.mjs:46-70`
- Constat : les seuls en-têtes personnalisés concernent le service worker et le manifeste. Aucune CSP, protection anti-framing, politique de référent ou HSTS n'est définie ici.
- Recommandation : définir au minimum CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` et HSTS sur HTTPS.

### RISK-004 — CORS de développement permissif

- Gravité : **Faible**
- Fichier : `back-end/main.py:219-244`
- Constat : sans configuration explicite, toute origine HTTP locale et tout port sont acceptés par regex, avec credentials, toutes méthodes et tous en-têtes.
- Recommandation : exiger une liste explicite d'origines en production et échouer au démarrage si elle est absente.

## Bugs et défauts de robustesse

### BUG-001 — Règle de fermeture des commandes désactivée

- Gravité : **Moyenne**
- Fichier : `back-end/services/checkout_service.py`
- Lignes : 19-24 et 66
- Description : la logique temporelle existe, mais `ORDER_CUTOFF_ENABLED = False` la rend inactive.
- Impact : les commandes sont acceptées pendant toute la plage que le code décrit comme fermée.
- Correctif : déplacer l'activation dans une variable d'environnement validée et ajouter des tests aux limites horaires.

### BUG-002 — Duplication d'une méthode dans le DAO commande

- Gravité : **Faible**
- Fichier : `back-end/dao/commande_dao.py`
- Lignes : 509 et 610
- Description : `_build_commande_historique_dto` est définie deux fois. La seconde définition écrase silencieusement la première.
- Impact : dette technique, risque de corriger la mauvaise copie et divergence future.
- Correctif : conserver une seule implémentation et ajouter un test de mapping.

### BUG-003 — Le build Next.js ignore les erreurs TypeScript

- Gravité : **Moyenne**
- Fichier : `front-end/next.config.mjs`
- Lignes : 14-16
- Description : `ignoreBuildErrors: true` permet de produire un build malgré des erreurs de types.
- Impact : régressions masquées, erreurs runtime et contrats API incohérents.
- Correctif :

```javascript
typescript: {
  ignoreBuildErrors: false,
},
```

### BUG-004 — Commit unique de branche désactivant des garde-fous

- Gravité : **Moyenne**
- Branche : `Back-05/AlgorithmedeSubstitutionAbonnementsParentaux/hz`
- Commit : `19375a9` — `in progress`
- Description vérifiée :
  - désactive le cutoff backend ;
  - retire le verrou frontend de commande ;
  - élargit les statuts éligibles au dispatch de `VERROUILLEE` à `EN_ATTENTE`, `CONFIRMEE`, `VERROUILLEE`.
- Impact : si ce commit est fusionné sans validation métier, des commandes non verrouillées peuvent entrer dans le dispatch.
- Correctif : ne pas fusionner tel quel ; documenter les statuts autorisés et les couvrir par tests.

### BUG-005 — Gestion d'erreurs trop large et silencieuse

- Gravité : **Moyenne**
- Exemples :
  - `back-end/dao/commande_dao.py:297-379`
  - `back-end/services/client_blacklist_service.py:48-112`
  - `back-end/services/produit_pricing_service.py:79-140`
- Description : de nombreux `except Exception` remplacent une erreur par une valeur vide ou générique.
- Impact : incohérences de données invisibles, diagnostic difficile, transactions potentiellement poursuivies après une erreur logique.
- Correctif : intercepter les exceptions attendues, journaliser avec contexte et laisser remonter les erreurs inattendues.

### BUG-006 — Outillage de validation non reproductible

- Gravité : **Moyenne**
- Fichiers : `front-end/package.json`, `mobile/package.json`
- Description : les scripts `lint` et `typecheck` existent mais les exécutables correspondants ne sont pas disponibles dans les installations locales des sous-projets.
- Impact : le dépôt ne peut pas reproduire les contrôles annoncés dans son état actuel.
- Correctif : standardiser un seul gestionnaire de paquets par projet, réinstaller à partir du lockfile en CI et rendre lint/typecheck obligatoires.

## Dépendances

### Frontend

Commande : `npm audit --omit=dev --json`

- 1 paquet de gravité élevée : `next@16.2.4` ;
- 1 paquet de gravité moyenne : `postcss` ;
- 2 paquets vulnérables au total selon l'agrégation npm ;
- correctifs annoncés comme disponibles.

### Mobile

Commande : `npm audit --omit=dev --json`

- 13 paquets de gravité moyenne ;
- 1 paquet de gravité faible ;
- 14 paquets vulnérables au total selon l'agrégation npm ;
- chaînes principales : Expo CLI/config/plugins, `js-yaml`, `uuid`, `xcode`, `@babel/core` ;
- plusieurs correctifs ne sont pas proposés automatiquement à cause des contraintes Expo.

Avis directs notables :

- `js-yaml` — déni de service quadratique : https://github.com/advisories/GHSA-h67p-54hq-rp68
- `uuid` — contrôle de bornes manquant : https://github.com/advisories/GHSA-w5hq-g745-h8pq
- `@babel/core` — lecture locale de fichier via sourcemap : https://github.com/advisories/GHSA-4x5r-pxfx-6jf8

### Python

- Les versions sont figées partiellement dans `back-end/requirements.txt`, mais plusieurs dépendances restent non bornées ou utilisent des minima (`supabase`, `python-multipart`, `phonenumbers`, `transformers>=...`).
- `pip-audit` n'était pas disponible ; aucune conclusion d'absence de CVE Python ne peut donc être donnée.
- Recommandation : générer un lockfile Python avec hashes et exécuter `pip-audit -r back-end/requirements.txt` en CI.

## Analyse Git

### Branches locales

| Branche | Écart par rapport à `main` | Conclusion |
|---|---:|---|
| `main` | identique à `fournisseur` | référence actuelle |
| `fournisseur` | 0 ahead / 0 behind | même commit que `main`, branche active en avance d'un commit sur `origin/fournisseur` |
| `AssignationenTournéesBatchDispatching/hz` | 0 ahead / 111 behind | ancêtre de `main`, aucun changement unique |
| `Back-03/SAVRemboursementStratégiqueCréditWallet/hz` | 0 / 133 | ancêtre, aucun changement unique |
| `Back-04/AlgorithmeBouclierdeMargeIA/hz` | 0 / 55 | ancêtre, aucun changement unique |
| `Back-05/AlgorithmedeSubstitutionAbonnementsParentaux/hz` | 1 / 105 | un commit unique à revoir |
| `Front-01/AuthentificationProfil/hz` | 0 / 220 | ancêtre, aucun changement unique |
| `GestionDesAnomaliesDeLivraisonFraisRetourDépôt/hz` | 0 / 107 | ancêtre, aucun changement unique |
| `Livreur-01/RéceptiondeTournée/hz` | 0 / 192 | ancêtre, aucun changement unique |
| `Livreur-02/MiseàJourdesStatutsenTempsRéel/hz` | 0 / 176 | ancêtre, aucun changement unique |
| `Livreur-03/IndicateurdePaiementSécurisé/hz` | 0 / 151 | ancêtre, aucun changement unique |

Les branches sans commit unique sont déjà entièrement représentées dans l'historique de `main`. Leur risque actuel est donc couvert par l'analyse de la branche courante.

### Commits potentiellement dangereux

1. `6c7f068` — ajoute les identifiants et le JWT administrateur dans `test_api.http`.
2. `38fa798` — ajoute la journalisation explicite du code OTP et de sa destination.
3. `604e630` — ajoute l'authentification aux endpoints panier/commande, mais sans contrôle de propriété ; le correctif d'accès est incomplet.
4. `19375a9` — commit unique non fusionné qui désactive ou retire plusieurs garde-fous de commande et élargit le dispatch.

### Hygiène Git

- Des fichiers `__pycache__` et `.pyc` apparaissent dans l'historique et certaines comparaisons.
- Des messages de commit tels que `sdfs`, `qqqq`, `daad` ou `in progress` rendent l'audit et le rollback difficiles.
- Recommandation : convention de commits, branches courtes, revue obligatoire et blocage CI des secrets/binaires générés.

## Analyse d'architecture et dette technique

### Points positifs

- séparation controllers/services/DAO/interfaces globalement visible ;
- usage majoritaire de SQLAlchemy ORM et paramètres liés ;
- contrôles RBAC centralisés avec `require_role` et `require_permission` ;
- registre de sessions et hash SHA-256 des tokens côté base ;
- bcrypt pour les mots de passe et OTP ;
- transactions explicites sur plusieurs workflows critiques ;
- taille et MIME contrôlés pour les avatars et images produits.

### Dette prioritaire

- coexistence de plusieurs styles d'autorisation (`get_admin_user`, `require_auth`, `require_permission`) ;
- responsabilités très larges dans certains services, notamment `dispatch_service.py`, `livreur_service.py`, `jit_service.py` et `fournisseur_service.py` ;
- migrations de schéma exécutées au démarrage de l'application ;
- bootstrap RBAC et catalogue couplé au démarrage ;
- scheduler lancé par défaut dans le processus web, avec risque de duplication sous plusieurs workers ;
- duplication de logique entre frontend web et mobile ;
- nombreux `except Exception` et messages internes retournés ;
- dépendances Python partiellement non verrouillées ;
- absence de pipeline visible imposant tests, SAST, audit de dépendances et détection de secrets.

## Éléments recherchés non confirmés

L'analyse statique n'a pas confirmé, dans la branche actuelle :

- injection SQL exploitable depuis une entrée utilisateur ;
- exécution de commande système ;
- désérialisation `pickle`/YAML non sûre ;
- path traversal direct ;
- SSRF contrôlée par un utilisateur dans les appels backend Supabase/Hugging Face ;
- XSS applicative directe via `dangerouslySetInnerHTML` avec donnée utilisateur ;
- secret réel dans les fichiers `.env` suivis par Git.

Cette absence de confirmation ne remplace pas un SAST complet ni des tests dynamiques.

## Recommandations prioritaires

### Priorité 1 — Immédiate

- changer les identifiants administrateur exposés et invalider les sessions ;
- retirer les OTP des logs ;
- corriger les deux IDOR panier/commande ;
- mettre à jour Next.js et PostCSS ;
- protéger la décrémentation du stock par verrou ou mise à jour atomique ;
- limiter la taille des uploads audio ;
- remplacer l'authentification WebSocket par un ticket court et révocable.

### Priorité 2 — Court terme

- ajouter un rate limiting partagé sur login, admin login, OTP et endpoints coûteux ;
- remplacer le stockage JWT `localStorage` ;
- uniformiser les contrôles d'autorisation ;
- cesser d'exposer `str(exception)` ;
- réactiver les erreurs TypeScript au build ;
- valider le contenu réel des images.

### Priorité 3 — Industrialisation

- CI obligatoire : tests, lint, typecheck, Bandit/Semgrep, pip-audit, npm audit et secret scanning ;
- migrations Alembic séparées du démarrage ;
- scheduler dans un worker unique ;
- lockfile Python avec hashes ;
- tests d'autorisation horizontale et tests de concurrence ;
- politique Git et revue de code obligatoire.

## Plan d'action

### P0 — Sous 24 heures

- [ ] Rotation du mot de passe administrateur exposé.
- [ ] Invalidation de toutes les sessions du compte.
- [ ] Suppression/purge des secrets dans Git.
- [ ] Suppression de la journalisation OTP.
- [ ] Correction des IDOR panier et commande.
- [ ] Mise à jour de Next.js vers une version corrigée.

### P1 — Sous 7 jours

- [ ] Verrouillage transactionnel du stock.
- [ ] Limite d'upload et quotas audio.
- [ ] Ticket WebSocket court et usage unique.
- [ ] Rate limiting login/admin/OTP.
- [ ] Messages d'erreur génériques et corrélation serveur.
- [ ] Tests automatisés de contrôle d'accès.

### P2 — Sous 30 jours

- [ ] Migration des JWT web vers cookies sécurisés.
- [ ] En-têtes HTTP de sécurité et CSP.
- [ ] Validation/réencodage des images.
- [ ] CI sécurité complète.
- [ ] Verrouillage reproductible des dépendances Python.
- [ ] Découplage migrations/bootstrap/scheduler du processus web.
- [ ] Nettoyage des branches historiques et des artefacts générés.

## Critères de validation après correction

- un utilisateur A reçoit 404 sur les paniers et commandes de B ;
- un OTP n'apparaît dans aucun log ;
- un token révoqué ne peut plus ouvrir le WebSocket ;
- deux checkouts concurrents ne peuvent jamais rendre le stock négatif ;
- un upload audio dépassant la limite reçoit 413 avant chargement complet ;
- `npm audit --omit=dev` ne retourne plus de vulnérabilité élevée ;
- le build échoue sur une erreur TypeScript ;
- les scanners de secrets bloquent la réintroduction d'un mot de passe ou JWT.
