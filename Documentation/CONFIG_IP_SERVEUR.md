# Configuration serveur — Capture fiable de l'IP client (parrainage)

> **À qui s'adresse ce document ?** À la personne qui déploie le backend SOUKI en
> production. Il explique comment faire en sorte que l'IP réelle des clients soit
> correctement capturée (utilisée par l'anti-fraude du parrainage), quel que soit
> l'hébergeur choisi.

---

## 1. Le problème

Le backend lit l'IP du client pour le **plafond anti-farming** du parrainage
(plusieurs inscriptions depuis la même IP → signal d'alerte). En FastAPI, l'IP
« brute » est `request.client.host`, c'est-à-dire l'IP du **pair TCP**.

- **En local** : `request.client.host` = vraie IP du client. ✅
- **En production derrière un proxy / load balancer / CDN** (Nginx, Cloudflare,
  Vercel, Render, AWS ALB…) : `request.client.host` = IP **du proxy**, pas du
  client. Tous les clients apparaîtraient avec la même IP. ❌

La vraie IP du client est alors transmise par le proxy dans un **en-tête HTTP**
(souvent `X-Forwarded-For`, parfois un en-tête propriétaire). Mais attention :

> ⚠️ **`X-Forwarded-For` est falsifiable** si l'application est joignable
> directement. Un client malveillant peut envoyer un faux en-tête. Il ne faut
> donc lui faire confiance **que** derrière un proxy de confiance qui le réécrit.

---

## 2. Comment le backend gère ça

Le helper `extract_client_ip` (`back-end/services/client_ip.py`) applique cette
stratégie, de la plus fiable à la plus générale :

1. **`SOUKI_TRUSTED_IP_HEADER`** — si défini, lit l'IP dans cet en-tête précis
   (celui que votre hébergeur réécrit de façon fiable).
2. **`X-Forwarded-For`** — utilisé **seulement** si `SOUKI_TRUST_FORWARDED` est
   activé (à n'activer que derrière un proxy de confiance).
3. **Repli** sur `request.client.host` (comportement correct en local).

Deux variables d'environnement pilotent donc tout :

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `SOUKI_TRUSTED_IP_HEADER` | Nom de l'en-tête de confiance à lire en priorité | *(vide)* |
| `SOUKI_TRUST_FORWARDED` | Autorise la lecture de `X-Forwarded-For` (`1`/`true`) | *(désactivé)* |

**Tant que rien n'est configuré, le comportement reste sûr** (repli sur l'IP du
pair TCP). Aucune valeur falsifiable n'est utilisée par défaut.

---

## 3. Réglage selon l'hébergement

### 3.1 Développement local (rien à faire)
Aucune variable. `request.client.host` renvoie déjà la bonne IP.

### 3.2 Cloudflare (devant le serveur)
Cloudflare réécrit toujours `CF-Connecting-IP` avec la vraie IP client.
```env
SOUKI_TRUSTED_IP_HEADER=CF-Connecting-IP
```
> Ne pas activer `SOUKI_TRUST_FORWARDED` : l'en-tête dédié est plus sûr.

### 3.3 Nginx en reverse proxy
Dans la conf Nginx, transmettre la vraie IP :
```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header X-Real-IP        $remote_addr;
    proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
    proxy_set_header Host             $host;
}
```
Puis côté backend, lire l'en-tête fiable posé par **votre** Nginx :
```env
SOUKI_TRUSTED_IP_HEADER=X-Real-IP
```
> `X-Real-IP` est posé par votre propre Nginx → fiable. Préférez-le à
> `X-Forwarded-For` que le client pourrait pré-remplir.

### 3.4 Vercel / Render / hébergeurs PaaS
Ces plateformes posent en général `X-Forwarded-For` (et parfois `X-Real-IP`)
avec la vraie IP en première position. Si la plateforme garantit l'écrasement
de cet en-tête :
```env
SOUKI_TRUST_FORWARDED=1
```
ou, s'ils exposent un en-tête dédié (vérifier leur doc) :
```env
SOUKI_TRUSTED_IP_HEADER=X-Real-IP
```

### 3.5 AWS ALB / autre load balancer
Le LB ajoute la vraie IP en tête de `X-Forwarded-For`. Comme l'app n'est
joignable **que** via le LB (groupe de sécurité fermé) :
```env
SOUKI_TRUST_FORWARDED=1
```

### 3.6 Alternative au niveau Uvicorn (sans variable applicative)
Au lieu d'utiliser les variables ci-dessus, on peut laisser Uvicorn reconstruire
l'IP. Il remplit alors lui-même `request.client.host` avec la vraie IP, et le
repli (étape 3 du helper) suffit :
```bash
uvicorn main:app --proxy-headers --forwarded-allow-ips="10.0.0.0/8"
```
> Renseigner dans `--forwarded-allow-ips` l'IP/réseau **du proxy** uniquement
> (jamais `*` en prod : ce serait faire confiance à tout le monde).

---

## 4. Vérifier que ça marche

1. Déployer, puis s'inscrire depuis deux appareils sur des réseaux différents.
2. Inspecter la table `t_parrainages`, colonne `ip_inscription` : les deux
   inscriptions doivent montrer des **IP différentes** (pas l'IP du proxy).
3. Si toutes les lignes ont la **même** IP → l'en-tête n'est pas le bon :
   reprendre la section 3 correspondant à votre hébergeur.

Astuce debug : exposer temporairement un endpoint qui renvoie
`request.client.host` et tous les `request.headers` pour voir quel en-tête
contient la vraie IP chez votre hébergeur.

---

## 5. Rappels de sécurité

- **Ne jamais** activer `SOUKI_TRUST_FORWARDED` si l'app est joignable
  directement (sans proxy) : `X-Forwarded-For` serait falsifiable.
- **Ne jamais** mettre `--forwarded-allow-ips="*"` en production.
- Préférer **toujours** un en-tête réécrit par votre propre infra
  (`CF-Connecting-IP`, `X-Real-IP`) à `X-Forwarded-For` brut.

---

## 6. Important : l'IP n'est qu'un filet secondaire

Même si l'IP était mal configurée en production, **le parrainage reste sûr**.
L'IP ne sert qu'à un **plafond souple** (anti-farming) + alerte. Les vraies
garanties n'en dépendent **pas** :

- le crédit n'est versé qu'à la **1ère commande livrée ET payée** du filleul ;
- un filleul ne peut être parrainé qu'**une seule fois** (`filleul_id` unique) ;
- même **téléphone/compte** = blocage **dur**, indépendant de l'IP.

Une IP imparfaite **dégrade en douceur** (plafond moins efficace), elle n'ouvre
jamais la porte à de l'argent gratuit.
