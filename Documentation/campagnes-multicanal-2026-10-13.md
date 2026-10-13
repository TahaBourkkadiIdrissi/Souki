# Campagnes multicanal — 13 octobre 2026

Branche de travail : `Upgrade-campagne`. Modifications locales ; aucun déploiement ni push effectué.

## Comportement livré

- Liens publics courts à la racine : `https://souki.io/fes-email`. Les anciens `/r/{nom}` continuent de fonctionner. Les variantes de casse et le slash final aboutissent directement à une redirection 302 avec `Cache-Control: private, no-store, max-age=0`.
- Le même lien peut être collé dans un email, une publication ou un statut, et être encodé en QR. Le QR devient une option de téléchargement dans la fiche ; le lien est présenté en premier.
- Rubrique affichée **Campagnes**, en conservant sa route admin existante `/admin/compaign` et son style. Préréglages flyer, email, Facebook, Instagram, WhatsApp, TikTok ; supports `social` et `paid` distincts. Source et support personnalisables, filtres dans le tableau. Créer une campagne/lien distinct par canal pour comparer les résultats.
- Le nom du lien est normalisé en minuscules. Nouveau nom de 3 à 48 caractères ASCII : lettres, chiffres, tirets intérieurs. Les noms réservés sont rejetés. Renommage permis tant qu'aucune visite admissible n'est enregistrée ; ensuite, refus côté serveur même en contournant l'interface.
- Un renommage conserve tous les anciens noms comme alias de la même campagne. Ils ne peuvent jamais être réattribués à une autre campagne. Les anciens QR restent utilisables ; un nouveau téléchargement encode le nouveau lien canonique.
- Suppression avec confirmation vers une corbeille restaurable. Aucun effacement physique des campagnes, visites ou commandes attribuées. Les liens supprimés/désactivés ouvrent le catalogue sans nouveau comptage ni nouveaux cookies. Une restauration laisse le lien désactivé ; l'administrateur peut ensuite le réactiver.
- Les statistiques historiques restent consultables dans la corbeille. Une commande peut encore être attribuée à une visite antérieure valide pendant 30 jours, même si la campagne a entre-temps été désactivée/supprimée.
- La fiche explique l'attribution **au dernier clic, par navigateur**, les limites des cookies et des navigateurs intégrés, et la distinction entre attribution et causalité. Les commandes annulées restent incluses dans « Commandes » ; « Dont livrées » utilise le statut existant `LIVRE`.

## Protections

La politique commune est `apps/client/lib/campaign-routes.json` : noms réservés, destinations publiques autorisées. Le frontend lit ce JSON localement, l'admin reçoit les noms via une API authentifiée, le backend utilise le même fichier (copié dans son image Docker). Aucun import de code entre applications.

Le test exécuté avant chaque build client compare les pages/routes App Router et les ressources publiques à cette liste. Ajouter une page nécessite de réserver sa racine. Une future page doit également éviter un nom de campagne déjà diffusé : le test du dépôt ne consulte pas la base de production.

Les routes statiques et fichiers existants gardent la priorité sur `[campaignSlug]`. Les adresses invalides comme `/wp-login.php` sont rejetées avant l'appel au backend. Un cache des noms introuvables évite les requêtes SQL répétées : 512 entrées maximum, 10 secondes, par processus. Ce cache ne conserve ni redirection, ni cookie, ni état actif/corbeille. La création et le renommage invalident leur entrée locale ; un autre worker peut conserver un ancien résultat négatif pendant au plus 10 secondes. Ce dispositif ne remplace pas une protection générale contre un déluge d'URL toutes différentes.

Les destinations sont limitées aux pages publiques autorisées du site configuré par `CAMPAIGN_PUBLIC_ORIGIN` (production : `https://souki.io`) et aux chemins de fiches produits. Les adresses externes, protocoles alternatifs, caractères de contrôle, antislashs, routes techniques et liens arbitraires de campagne sont rejetés. L'autorisation porte sur le chemin produit, pas sur l'existence en base du produit. Les liens campagne-vers-campagne sont interdits, y compris vers un nom pas encore créé.

Le filtrage s'applique avant l'enregistrement : HEAD, User-Agent absent, signatures de robots/aperçus connus et en-têtes `Purpose`, `Sec-Purpose`, `X-Purpose`, `X-Moz` indiquant prefetch/prerender/preview. Les navigateurs humains Instagram/Facebook ne sont pas exclus simplement à cause du nom de l'application. La redirection reste fonctionnelle pour les robots, sans cookies de suivi.

Ce filtre n'identifie pas tout robot qui imite un navigateur. Apple décrit le préchargement de **contenus distants** par Mail Privacy Protection, ce qui ne permet pas d'affirmer que chaque ouverture de lien d'email est automatiquement reconnaissable ([documentation Apple](https://support.apple.com/en-ca/102289)). Les statistiques restent des estimations ; elles ne garantissent pas un nombre minimal de personnes réelles.

Les balises catalogue Open Graph/Twitter utilisent un titre, une description et l'image de marque existante `/opengraph-image` (1200 × 630). Leur émission HTML et le rendu PNG sont testés localement ; l'aperçu réel dans chaque plateforme et son cache demandent une vérification après déploiement.

## Architecture et transactions

| Fichier | Rôle | flush() | commit()/rollback() | LocalSession() créé dans le service | Résultat |
|---|---|---|---|---|---|
| `back-end/dao/campaign_dao.py` | DAO, accès SQL uniquement | Oui, écritures | Aucun | Sans objet | Conforme |
| `back-end/services/campaign_service.py` | Service, règles et orchestration | Aucun | Fin des opérations d'écriture, rollback sur erreur | Non | Conforme |
| `back-end/controllers/campaign_controller.py` | Contrôleur HTTP | Aucun | Aucun | Session injectée depuis le contrôleur | Conforme |

Interfaces ABC étendues avec les mêmes signatures. DTOs dédiés pour options, version, état de corbeille et capacité de renommage. Les nouvelles routes admin utilisent la permission existante `admin.panel.access`. Aucune permission inventée.

Le renommage, la première visite admissible et la mise à la corbeille verrouillent la même ligne campagne sur PostgreSQL. Les écritures liées se font dans un seul commit ; tests de rollback en cas d'échec de commit. Les versions optimistes protègent les mises à jour admin concurrentes. L'attribution d'une commande reste incluse dans la transaction du checkout existant, sans commit supplémentaire.

Aucune violation flush/commit trouvée dans les fichiers métier campagne concernés. Aucune correction de module métier extérieur à cette fonctionnalité.

## Base et déploiement

La migration `back-end/sql/2026-10-13_campaign_links_lifecycle.sql` ajoute seulement :

- `t_campaign_links` : noms réservés et alias associés aux campagnes existantes ; clé primaire sur le nom.
- `t_campaign_lifecycle` : nom canonique courant et date de mise à la corbeille.
- Un index sur le rattachement des alias et RLS sur les deux nouvelles tables.

Elle réserve les noms déjà présents, détecte les collisions de casse/propriétaire et peut être rejouée sans remettre à zéro un renommage ou une corbeille. Elle ne modifie aucune table existante. Les définitions des entités existantes restent intactes ; seul leur fichier d'import reçoit les deux nouvelles entités.

Exécuter cette migration dans Supabase **après** `2026-10-11_campaigns.sql` et **avant** les nouvelles images. La migration PostgreSQL n'est pas exécutée sur Supabase pendant ce travail. Aucune nouvelle variable d'environnement : conserver `CAMPAIGN_PUBLIC_ORIGIN=https://souki.io`.

Sur le VPS, après publication et récupération de la branche/version souhaitée (préserver les éventuelles modifications locales de Nginx) :

```bash
cd /opt/souki
sudo docker compose --env-file infra/.env.production config --quiet
sudo docker compose --env-file infra/.env.production build backend client admin
sudo docker compose --env-file infra/.env.production up -d backend scheduler client admin
sudo docker compose --env-file infra/.env.production exec nginx nginx -t
sudo docker compose --env-file infra/.env.production restart nginx
sudo docker compose --env-file infra/.env.production ps
```

Le scheduler partage l'image backend. Le redémarrage de Nginx renouvelle la résolution des adresses des conteneurs recréés. Sa configuration actuelle relaie déjà les chemins racine vers le client, sans cache de redirection ; aucun changement Nginx nécessaire.

## Vérifications

- Backend : 443 tests réussis et 52 sous-tests ; 57 cas du module campagnes.
- Garde des routes et tests analytics existants : 8 réussis.
- TypeScript client et admin : sans erreur.
- Compilation Python : réussie ; avertissement d'accès au dossier non-source `.pytest_cache`.
- Contrôle des frontières frontend : réussi.
- Scénario navigateur complet : réussi (Edge, client et admin Next.js avec API locale isolée). Liens racine/anciens, casse/slash, no-store, HEAD/robots/préchargements, préréglage WhatsApp, renommage/gel, corbeille/restauration/réactivation, métadonnées/image, redirection canonique produit, export PNG, visites et attribution vérifiés. Régression panier invité, connexion, inscription et OTP également vérifiée.
- Builds de production Next.js/Turbopack client et admin : réussis, vérification TypeScript incluse. La liste produite contient `/[campaignSlug]`, l'ancien `/r/[slug]`, les routes produit et la rubrique admin existante.
- `git diff --check` : sans erreur.

Les tests navigateur utilisent une base SQLite éphémère, les véritables routes/service campagne et une authentification/catalogue simulés. Ils ne modifient aucune donnée de production. Les verrous PostgreSQL sont présents dans le DAO ; leur concurrence réelle n'est pas simulée par SQLite.

### Problèmes rencontrés et résolus

- Première compilation de l'image Open Graph en développement supérieure au délai du test : délai du contrôle adapté, réponse PNG 200 vérifiée.
- Deux libellés détectés pendant les essais (casse de WhatsApp et accent du bouton de corbeille) : corrigés, parcours rejoué jusqu'à réussite.
- Une lecture JSON Next.js temporairement invalide dans les fichiers générés : anciens caches de développement mis de côté à l'intérieur de `.next`, puis scénario complet réussi sur des caches reconstruits.
- Avertissement d'hydratation intermittent observé dans le bloc invité existant du catalogue lors d'un essai intermédiaire ; absent du dernier parcours validé. Aucun changement d'authentification effectué dans cette tâche. Les avertissements Next.js existants sur les images LCP et le défilement restent hors périmètre.
- Restrictions Windows sur certains caches générés : vérifications relancées avec l'autorisation locale requise, sans toucher aux données de production.

## Périmètre préservé

Aucun fichier supprimé, aucune dépendance npm/pip ajoutée, aucune table existante altérée. Authentification, panier, checkout, livreur, notifications, horaires, prix et remises inchangés. Redirections canoniques des produits conservées. Aucun outil d'alerte, code promo, question à l'inscription, chiffre d'affaires, entonnoir ou coût par commande ajouté.

## Fichiers et repères

Inventaire généré après vérification finale ci-dessous.

| Fichier | État | Lignes concernées / taille nouvelle | Rôle et justification |
|---|---|---|---|
| `.gitignore` | Modifié | 120 | Versionner la nouvelle migration SQL. |
| `apps/admin/app/admin/compaign/page.tsx` | Modifié | 9, 16, 35, 55, 66, 72, 76, 86, 92, 98, 101, 105, 120, 160, 166, 169, 171, 178, 184, 203, 211, 214, 227 | Formulaire multicanal, lien prioritaire, renommage, filtres et corbeille ; style existant conservé. |
| `apps/admin/app/admin/page.tsx` | Modifié | 71 | Libellé de navigation Campagnes. |
| `apps/admin/lib/api.ts` | Modifié | 24, 36, 40 | DTOs TypeScript et appels options, renommage, corbeille/restauration. |
| `apps/client/app/[campaignSlug]/route.ts` | Ajouté | 13 lignes | Nécessaire pour les liens racine, résolus après les routes statiques. |
| `apps/client/app/catalogue/page.tsx` | Modifié | 12, 18, 23 | Métadonnées Open Graph/Twitter du catalogue. |
| `apps/client/lib/api.ts` | Modifié | 7, 10 | Transport des signaux de préchargement, normalisation du nom et no-store. |
| `apps/client/lib/campaign-links.ts` | Ajouté | 12 lignes | Nécessaire pour partager la classification des chemins entre proxy et route. |
| `apps/client/lib/campaign-routes.json` | Ajouté | 9 lignes | Source unique nécessaire aux noms réservés et destinations autorisées. |
| `apps/client/lib/campaign-routes.test.cjs` | Ajouté | 35 lignes | Garde nécessaire contre les collisions lors de futurs ajouts de pages. |
| `apps/client/next.config.mjs` | Modifié | 34 | Déléguer la gestion du slash au proxy pour préserver les 302 des campagnes. |
| `apps/client/package.json` | Modifié | 9 | Exécuter le garde des noms réservés avant le build. |
| `apps/client/proxy.ts` | Modifié | 1, 5, 7, 22, 24, 32 | Slash final des campagnes sans 308 ; comportement canonique produit préservé. |
| `back-end/Dockerfile` | Modifié | 10 | Embarquer le fichier de politique partagé sans dépendance frontend exécutable. |
| `back-end/controllers/campaign_controller.py` | Modifié | 7, 11, 20, 22, 70 | Adaptateurs HTTP et autorisation des nouvelles actions. |
| `back-end/dao/campaign_dao.py` | Modifié | 5, 11, 22 | Requêtes/flush pour alias et cycle de vie ; verrou sur les visites admissibles. |
| `back-end/dto/campaign_dto.py` | Modifié | 2, 17, 25, 53 | Contrats de données, normalisation du nom, options et version. |
| `back-end/entities/__init__.py` | Modifié | 80 | Importer les deux nouvelles entités, sans changer les entités existantes. |
| `back-end/entities/campaign_lifecycle_entity.py` | Ajouté | 15 lignes | Nouvelles entités nécessaires aux deux tables additionnelles. |
| `back-end/interfaces/campaign_dao_interface.py` | Modifié | 6, 10 | Étendre le contrat ABC DAO. |
| `back-end/interfaces/campaign_service_interface.py` | Modifié | 6, 18 | Étendre le contrat ABC service. |
| `back-end/services/campaign_policy.py` | Ajouté | 26 lignes | Politique commune et classification du trafic, sans SQL ni HTTP. |
| `back-end/services/campaign_service.py` | Modifié | 6, 14, 17, 43, 48, 56, 60, 64, 67, 95, 99, 102, 107, 112, 117, 123, 137, 151, 195, 205, 208, 215, 217, 229 | Orchestration, destination sûre, renommage, aliases, corbeille, cache négatif, transactions. |
| `back-end/sql/2026-10-13_campaign_links_lifecycle.sql` | Ajouté | 31 lignes | Migration nécessaire pour réserver les noms et stocker la corbeille sans altérer les tables existantes. |
| `back-end/tests/test_campaigns.py` | Modifié | 12, 19, 23, 155, 173 | Régressions, sécurité, permissions, filtrage, cache et rollback. |
| `tools/campaign-runtime-check.mjs` | Modifié | 22, 25, 112, 117, 159, 163, 177, 289 | Scénario navigateur local avec vraies routes campagne et fixtures isolées. |

Ce rapport est également ajouté pour consigner les choix, les vérifications et les étapes de déploiement. Les repères des fichiers modifiés indiquent le début de chaque bloc changé dans le diff.
