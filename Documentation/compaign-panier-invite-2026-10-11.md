# Compagne et panier invité — 11 octobre 2026

## Résultat et périmètre

- Catalogue et panier manuel accessibles sans compte sur le web et la PWA. La validation déclenche la connexion, puis ramène au checkout.
- Fusion du panier invité avec celui du compte connecté, sans importer les données d'un autre compte. Les quantités d'un même produit s'additionnent. Le panier invité est vidé après transfert.
- Quantités et suppressions du panier manuel conservées au checkout ; nettoyage après confirmation réussie.
- Inscription : champs existants conservés. Les champs prénom et nom déjà présents sont désormais transmis et enregistrés dans les colonnes existantes. Le champ ville conserve son fonctionnement antérieur ; l'adresse et la ville de livraison restent saisies au checkout.
- Page `/admin/compaign`, intitulée **Compagne**, dans la navigation admin : plusieurs QR, création, édition, activation/désactivation, copie du lien, SVG et PNG, trafic total et par période. Le chemin reste compatible avec les liens existants.
- Lien imprimé permanent `/r/{slug}` : sa destination et ses paramètres UTM sont modifiables en base, avec redirection HTTP 302 sans cache. Le slug est immuable. Aucun passage sur le VPS pour les modifications courantes.
- Aucune récompense de 10 DH ni connexion WhatsApp/SMS ajoutée. Les fonctions IA et les espaces personnels conservent leurs protections existantes.

## Mesure

Une visite = une ouverture du lien court actif. Un QR désactivé redirige en 302 vers `/catalogue`, sans paramètres UTM ajoutés, sans nouvelle visite et sans émission ni renouvellement des cookies QR. Son historique et les attributions liées aux visites antérieures sont conservés. La réactivation reprend la destination configurée avec le même QR. Un identifiant inexistant reste une erreur 404.

Les visiteurs estimés sont des navigateurs reconnus par cookie signé pendant 30 jours ; ce n'est pas un décompte exact de personnes. Changer d'appareil, supprimer les cookies ou partager le lien affecte cette estimation. Les robots reconnus, HEAD et les requêtes indiquant une prélecture ne comptent pas. Ce filtrage ne garantit pas l'exclusion de tout trafic automatisé.

Les cookies sont HttpOnly et SameSite=Lax, Secure en production via la configuration existante. Les visites enregistrent un identifiant aléatoire haché et une date UTC, sans stocker d'adresse IP ni de User-Agent dans ces nouvelles tables. La période du graphique utilise UTC et inclut les journées sans visite.

Une commande peut être attribuée au dernier QR ouvert sur le navigateur dans les 30 jours. Les commandes annulées restent dans le total ; les commandes livrées sont affichées séparément. La période filtre la date de visite, pas la date de commande. L'attribution est enregistrée dans la transaction du checkout. Les téléchargements du QR et le bouton d'aperçu de destination ne comptent pas comme visites.

## Architecture et contrôle flush/commit

| Fichier | Rôle | flush() | commit()/rollback() | LocalSession() | Résultat |
|---|---|---|---|---|---|
| `back-end/dao/campaign_dao.py` | DAO + interface ABC | Après écritures | Aucun | Aucun | Conforme |
| `back-end/services/campaign_service.py` | Service + interface ABC | Aucun | Fin des écritures / erreurs | Aucun | Conforme |
| `back-end/controllers/campaign_controller.py` | Adaptateur HTTP et injection | Aucun | Aucun | Session injectée au service | Conforme |
| `back-end/services/checkout_service.py` | Service existant | Aucun ajout | Attribution avant le commit existant | Préexistant ligne 57 | Ajout transactionnel, dette conservée |
| `back-end/services/auth_service.py` | Service existant | Aucun ajout | Fonctionnement existant conservé | Préexistant lignes 54, 149, 182, 203, 283, 367, 404, 705 | Ajout du mapping nom/prénom seulement |
| `back-end/dao/user_dao.py` | DAO existant lu, non modifié | Préexistant | commit ligne 26 et rollback ligne 30 | N/A | Dette préexistante non corrigée |

Les anciennes créations de session dans AuthService et CheckoutService et le commit du UserDao ne sont pas refactorisés dans ce changement. Aucune nouvelle couche campagne ne reproduit ces exceptions. `attribute_order` participe à la transaction du service appelant sans commit intermédiaire.

AuthService contient aussi des `db.flush()` préexistants, notamment aux lignes 109, 384 et 573, et des commits intermédiaires dans certains parcours. Ils sont laissés en place ; la correction de ces dettes n'est pas comprise dans ce changement fonctionnel.

Les nouveaux appels admin utilisent `lib/api.ts` et `apiCall`, avec les cookies de session existants. Tous les endpoints d'administration exigent `admin.panel.access`. Le serveur valide les destinations sur le domaine public configuré, refuse les boucles et les destinations externes. Les modifications concurrentes sont détectées par version et verrou de ligne. Le frontend conserve les couleurs, cartes, tableaux et permissions de navigation de l'admin.

## Fichiers créés et justification

Les plages exactes et l'inventaire des modifications figurent en fin de document.

- `back-end/entities/campaign_entity.py` : trois nouvelles tables nécessaires pour conserver campagnes, visites et attribution sans changer les tables existantes.
- `back-end/dto/campaign_dto.py` : contrats Pydantic des formulaires, statistiques, redirections et aperçu QR.
- `back-end/interfaces/campaign_dao_interface.py`, `campaign_service_interface.py` : contrats ABC imposés par l'architecture.
- `back-end/dao/campaign_dao.py`, `services/campaign_service.py`, `controllers/campaign_controller.py` : séparation accès SQL, métier et HTTP.
- `back-end/sql/2026-10-11_campaigns.sql` : migration déployable sur Supabase, avec RLS sur les nouvelles tables.
- `back-end/vendor/qrcodegen.py`, `vendor/README.md` : générateur QR Nayuki 1.8.0, source MIT conservée sans modification, pour générer localement sans service tiers et sans nouvelle dépendance npm/pip. Source : https://github.com/nayuki/QR-Code-generator/blob/v1.8.0/python/qrcodegen.py.
- `apps/client/app/r/[slug]/route.ts` : redirection publique côté serveur ; transport dans `apps/client/lib/api.ts`.
- `apps/admin/app/admin/compaign/page.tsx` : gestion et suivi des campagnes.
- `back-end/tests/test_campaigns.py` : contrats, sécurité des destinations, statistiques et transactions.
- `tools/campaign-runtime-check.mjs` : parcours navigateur isolé avec vrai service campagne et catalogue/authentification de test, sans base de production.
- `apps/admin/AGENTS.md`, `apps/admin/CLAUDE.md` : fichiers générés automatiquement par Next.js au démarrage local, conservés.
- Ce rapport : traçabilité et déploiement.

## Vérifications

- Backend : 394 tests et 43 sous-tests réussis, dont 17 nouveaux cas campagne.
- Stockage client et analytics : 19 tests réussis.
- TypeScript client et admin : `tsc --noEmit --incremental false`, aucune erreur.
- Frontières des trois applications : `node tools/check-frontend-boundaries.mjs`, conforme.
- Compilation Python : réussie ; le répertoire de cache `.pytest_cache` inaccessible n'est pas une source Python.
- `git diff --check` : conforme, avertissement de conversion LF/CRLF sur le fichier d'inscription existant.
- Parcours navigateur : réussi (connexion, inscription avec les champs existants, confirmation OTP et retour checkout avec panier conservé ; catalogue rechargé et PWA publique ; création/édition/désactivation multi-QR ; QR inchangé après édition ; export PNG ; visites répétées et visiteurs distincts ; attribution de commande). Captures dans `outputs/campaign/` (artefacts locaux ignorés par Git).

Le banc d'essai a nécessité une base SQLite temporaire sur fichier pour isoler correctement les sessions simultanées du dashboard. La bannière d'installation PWA est fermée par le test avant d'utiliser les boutons de la fiche produit, comme dans le premier parcours. Les problèmes d'écriture des caches locaux ont été résolus en exécutant les vérifications avec les permissions locales autorisées.

Les tests utilisent SQLite et une API d'authentification de test ; ils ne constituent pas une validation des verrous PostgreSQL concurrents, de l'envoi réel des emails OTP ou d'un déploiement sur Supabase/VPS. Aucun changement de production n'a été effectué.

## Mise en service

1. Exécuter le contenu de `back-end/sql/2026-10-11_campaigns.sql` dans l'éditeur SQL de Supabase **avant** de déployer le backend. Le rôle SQL du backend doit pouvoir accéder aux tables RLS (comme le rôle serveur/owner actuel) ; les clients anonymes Supabase n'y accèdent pas.
2. Dans `infra/.env.production`, définir `CAMPAIGN_PUBLIC_ORIGIN=https://souki.io` (valeur par défaut). Conserver ce domaine pour préserver les QR déjà imprimés. Ce paramètre est lu par le backend via l'env_file existant.
3. Après publication des commits et récupération de la bonne branche sur le VPS, depuis `/opt/souki` :

```bash
sudo docker compose --env-file infra/.env.production up -d --build backend client admin scheduler
sudo docker compose --env-file infra/.env.production restart nginx
sudo docker compose --env-file infra/.env.production exec nginx nginx -t
sudo docker compose --env-file infra/.env.production ps
```

Le scheduler partage l'image du backend. Le redémarrage Nginx renouvelle sa résolution des adresses des services reconstruits. Aucun changement des domaines ni du template Nginx n'est nécessaire pour `/r/`, servi par le client.

4. Dans l'admin, ouvrir Compagne, créer un QR avec destination `/catalogue`, télécharger le SVG pour impression. Scanner avec un téléphone et vérifier la visite. Modifier ensuite la destination dans l'admin et rescanner **le même QR**.

## Correction des liens désactivés et du libellé

Le nom affiché est désormais **Compagne**, conformément à la demande. Les chemins, noms de tables et liens imprimés ne changent pas. Aucune migration SQL et aucune nouvelle variable d'environnement ne sont nécessaires pour cette correction.

La surveillance extérieure est reportée à la demande de l'utilisateur. Aucun service d'alerte n'a été activé. Les tests spécifiques au fournisseur et la procédure de configuration ont été retirés ; aucun code d'alerte applicatif n'avait été ajouté.

### Traçabilité de cette correction

- `back-end/services/campaign_service.py`, lignes 47–48, 110 et 113–114 : destination de repli dans le service, aucune écriture de visite en cas de désactivation ; mêmes contrats ABC et mêmes transactions. Le DAO reste inchangé, avec flush uniquement. Le service ne crée pas de LocalSession et n'exécute pas de SQL directement.
- `back-end/controllers/campaign_controller.py`, ligne 11 : libellé de documentation API Compagne ; adaptateur HTTP et injection de session conservés.
- `apps/admin/app/admin/page.tsx`, ligne 71, et `apps/admin/app/admin/compaign/page.tsx`, lignes 26, 128, 142 et 163 : titre et navigation Compagne, explications actualisées sur désactivation et attribution. Aucun changement de formulaire d'inscription.
- `back-end/tests/test_campaigns.py`, lignes 58–95 : désactivation/réactivation, historique, attribution antérieure et réponse 302 sans cookies.
- `tools/campaign-runtime-check.mjs`, lignes 110 et 171–173 : vérification du titre et du repli 302 sans émission de cookies.
- Ce rapport : comportement mis à jour et surveillance reportée. Aucun fichier créé ou supprimé pour cette correction. SQL, environnement, Nginx, livreur, checkout et authentification inchangés.

L'inventaire détaillé ci-dessous décrit la livraison initiale ; les lignes de ces fichiers peuvent se décaler avec cette correction.

Vérifications de la correction : 18 tests campagne relancés et réussis après retrait des deux cas de surveillance ; syntaxe du script navigateur vérifiée avec `node --check`. TypeScript admin et compilation Python avaient réussi ; `git diff --check` conforme. Le script navigateur avait terminé avec succès avant le retrait des assertions de surveillance, y compris le titre Compagne et le repli 302 d'un QR désactivé. L'avertissement Python concerne uniquement le répertoire `.pytest_cache` inaccessible, pas une erreur de compilation des sources.

Le serveur Next.js de développement a aussi signalé un problème intermittent d'hydratation dans l'encart invité du catalogue lors d'un Fast Refresh. Ce message avait déjà été observé avant cette correction ; le catalogue n'est pas modifié ici. Les assertions de parcours passent, mais ce test ne constitue pas une validation sans avertissement de toutes les pages en production.

## Checklist

- [x] Session demandée à la validation du panier manuel ; catalogue/PWA publics.
- [x] Conservation du panier à la connexion et après création du compte.
- [x] Champs d'inscription existants conservés, sans nouveau champ UI.
- [x] Gestion multi-QR, destinations modifiables et lien imprimé stable.
- [x] Statistiques expliquées, sans présenter les navigateurs comme des personnes certaines.
- [x] Architecture des nouveaux modules MVC2/ABC, DAOs sans commit.
- [x] Aucun fichier supprimé, aucune table existante ni entité existante modifiée.
- [x] Nginx, livreur, scheduler métier, notifications et dépendances npm/pip inchangés.
- [x] Migration et procédure livrées ; déploiement laissé à exécuter.

## Inventaire des lignes

Les numéros ci-dessous correspondent à l'état livré, avant commit.

| Fichier modifié | Lignes ajoutées/modifiées (ou point de suppression) |
|---|---|
| `.gitignore` | 119 |
| `apps/admin/app/admin/page.tsx` | 29, 71, 85 |
| `apps/admin/lib/api.ts` | 5-39 |
| `apps/client/app/catalogue/catalogue-client.tsx` | 665, 806, 816, 836, 851-852, 870, 912-913, 926, 930-931, 947, 1276, 1449, 1452, 1455, 2193, 2198, 2347, 2397 |
| `apps/client/app/checkout/page.tsx` | 45, 454, 465, 483, 503-515, 616 |
| `apps/client/app/home-client.tsx` | 20-22, 101-102, 124-130 |
| `apps/client/app/login/client/page.tsx` | 162-163 |
| `apps/client/app/login/page.tsx` | 2-10 |
| `apps/client/app/pwa-welcome/page.tsx` | 179, 190, 316-317 |
| `apps/client/app/verify/page.tsx` | 21-23, 39, 92-93, 106, 108, 112-113 |
| `apps/client/components/routing/route-guard.tsx` | 49 |
| `apps/client/contexts/auth-context.tsx` | 6-7, 210, 316, 321 |
| `apps/client/lib/api.ts` | 5-30 |
| `apps/client/lib/client-storage.ts` | 55-76 |
| `apps/client/public/sw.js` | 2 |
| `back-end/controllers/checkout_controller.py` | 1, 22, 27 |
| `back-end/dto/checkout_dto.py` | 5, 16 |
| `back-end/dto/user_dto.py` | 10-11 |
| `back-end/entities/__init__.py` | 79 |
| `back-end/main.py` | 31, 76 |
| `back-end/services/auth_service.py` | 92-93 |
| `back-end/services/checkout_service.py` | 258-261 |
| `infra/.env.example` | 21 |
| `tools/client-reliability.test.cjs` | 85, 126-149 |

| Fichier créé | Lignes |
|---|---|
| `apps/admin/AGENTS.md` | 1-9 |
| `apps/admin/CLAUDE.md` | 1-1 |
| `apps/admin/app/admin/compaign/page.tsx` | 1-169 |
| `apps/client/app/r/[slug]/route.ts` | 1-13 |
| `back-end/controllers/campaign_controller.py` | 1-59 |
| `back-end/dao/campaign_dao.py` | 1-56 |
| `back-end/dto/campaign_dto.py` | 1-58 |
| `back-end/entities/campaign_entity.py` | 1-32 |
| `back-end/interfaces/campaign_dao_interface.py` | 1-20 |
| `back-end/interfaces/campaign_service_interface.py` | 1-18 |
| `back-end/services/campaign_service.py` | 1-132 |
| `back-end/sql/2026-10-11_campaigns.sql` | 1-31 |
| `back-end/tests/test_campaigns.py` | 1-142 |
| `back-end/vendor/README.md` | 1-10 |
| `back-end/vendor/qrcodegen.py` | 1-909 |
| `tools/campaign-runtime-check.mjs` | 1-208 |
