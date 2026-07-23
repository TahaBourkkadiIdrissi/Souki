# Notifications SOUKI (push / email)

Toutes les notifications passent par une file transactionnelle unique
(`t_notification_outbox`) et respectent les preferences de
`/api/user/notifications` (ecran **Parametres > Notifications**).

## Chaine complete

```
evenement metier
   -> NotificationService.notify(...)        services/notification_service.py
        applique les preferences + heures de silence
   -> 1 ligne outbox par canal autorise      t_notification_outbox
   -> DeliveryOutboxWorker (toutes les 15 s) services/delivery_outbox_worker.py
        PUSH -> VAPID | EMAIL -> Resend
```

> Le canal SMS n'est pas active pour l'instant : seuls le push et l'email sont
> livres. Le catalogue est concu pour rebrancher un canal (ex. SMS) en ajoutant
> un `_deliver_*` au worker, sans toucher au fan-out.

Les entrees sont ecrites **dans la transaction metier** : si la commande est
annulee, sa notification l'est aussi. Aucun envoi ne peut donc parler d'un
evenement qui n'a pas eu lieu.

## Ajouter un evenement

Un seul fichier a toucher : `back-end/services/notification_catalog.py`.
On y declare la categorie de preference qui gouverne l'evenement, ses canaux et
son rendu. Le service metier appelle ensuite :

```python
notification_service.notify(
    session,
    user_id=...,
    event_key="MON_EVENEMENT",
    data={...},
    dedupe_suffix="identifiant-de-l-occurrence",   # rend l'envoi idempotent
)
```

Pour les commandes, rien a faire : `changer_statut()`
(`services/commande_state_machine.py`) est le point de passage unique de toutes
les transitions et notifie deja le client. Le catalogue filtre les statuts
purement internes via `STATUS_TO_CLIENT_EVENT`.

## Regles appliquees

| Regle | Ou |
|---|---|
| Un interrupteur de canal off (email/push) ecarte le canal | `_resolve_recipient` |
| Une categorie off (commandes, livraison, promotions, newsletter) ecarte tout | `_is_category_enabled` |
| Aucun push marketing entre 21 h et 8 h (heure marocaine) | `_defer_past_quiet_hours` |
| Un meme evenement ne part qu'une fois par canal | index unique `dedupe_key` |
| Echec temporaire : 4 reprises (1 min, 5 min, 15 min, 1 h) puis abandon | `_schedule_retry` |
| Abonnement push expire (404/410) : revoque, pas de reprise | `_deliver_push` |
| Canal non configure : ignore, pas de reprise | `NotificationSkipped` |

Les preferences sont lues, jamais creees, par le fan-out : un compte qui n'a
jamais ouvert ses reglages recoit les defauts (email + push actifs, SMS inactif).

## Configuration

### Push (Web Push / VAPID)

```bash
cd back-end
python scripts/generate_vapid_keys.py   # a ne faire qu'une seule fois
```

Coller les deux lignes dans `back-end/.env`. La cle publique est servie par
`GET /api/user/push/public-key` : ne jamais la dupliquer dans une variable
`NEXT_PUBLIC_*`, sinon une rotation de cle imposerait un rebuild du front.

**Regenerer la paire invalide tous les abonnements existants** : chaque
navigateur devra re-souscrire.

### Email

Rien a faire : Resend est deja configure pour les OTP
(`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Ajouter `SOUKI_PUBLIC_URL` pour que les
liens des emails pointent vers la bonne racine.

## Tester le push en local

Le service worker est **volontairement desinscrit en `next dev`** (voir
`components/souki/pwa-service-worker.tsx`) : les notifications push ne
fonctionnent donc pas avec `npm run dev`. Il faut un build de production :

```bash
cd front-end && npm run build && npm start
```

Puis, dans **Parametres > Notifications**, activer l'interrupteur « Notifications
push » (l'autorisation navigateur n'est demandee qu'a ce moment, sur geste
utilisateur) et cliquer sur « Envoyer une notification de test ».

## Depannage

```sql
-- Etat de la file
SELECT status, type, count(*) FROM t_notification_outbox GROUP BY 1, 2;

-- Dernieres erreurs
SELECT id, type, event, attempts, last_error
FROM t_notification_outbox
WHERE status IN ('FAILED', 'SKIPPED')
ORDER BY id DESC LIMIT 20;

-- Appareils abonnes d'un utilisateur
SELECT endpoint, user_agent, last_seen_at, revoked_at
FROM t_push_subscriptions WHERE user_id = :id;
```

| Symptome | Cause probable |
|---|---|
| `SKIPPED` « canal non configure » | variables d'environnement absentes |
| `SKIPPED` « aucun abonnement push actif » | l'utilisateur n'a active le push sur aucun appareil |
| Rien n'est mis en file | preference ou categorie desactivee, ou evenement absent du catalogue |
| Le push part mais n'arrive pas | cles VAPID changees depuis l'abonnement : faire re-souscrire |
