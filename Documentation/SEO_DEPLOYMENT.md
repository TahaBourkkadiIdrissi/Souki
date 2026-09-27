# Déploiement et validation SEO de SOUKI

Périmètre : `souki.io`, `apps/client` et protection admin/livreur. Le domaine
secondaire est exclu. Voir [le plan](SEO_IMPLEMENTATION_PLAN.md) et
[l'état d'exécution](SEO_IMPLEMENTATION_STATUS.md).

## Livraison

Sauvegarder la base, construire les images depuis les dépendances verrouillées,
puis appliquer la migration **avant la nouvelle API** :

```sh
docker compose --env-file infra/.env.production build
docker compose --env-file infra/.env.production run --rm backend python scripts/apply_seo_migration.py --apply
docker compose --env-file infra/.env.production run --rm --no-deps nginx nginx -t
docker compose --env-file infra/.env.production up -d backend client admin livreur nginx
docker compose --env-file infra/.env.production exec nginx nginx -t
docker compose --env-file infra/.env.production exec nginx nginx -s reload
```

Sans `--apply`, le script de migration affiche une simulation et ne se connecte
pas à la base. Le SQL versionné est
`back-end/sql/2026-09-27_product_public_updated_at.sql`. Les dates historiques
restent `NULL` ; aucun remplissage artificiel après migration. Le déclencheur
couvre les créations et les changements publics de nom, alias, unité, image,
prix affiché, activation, disponibilité et présentation commerciale. Une
variation de quantité sans changement de disponibilité ne réinitialise pas la
date. Un changement global de mode précommande ou de texte éditorial demande
un contrôle spécifique des pages lors du déploiement.

Déployer l'API avant le client : elle doit déjà exposer `updated_at`,
`availability` et les lignes confirmées du checkout. Vérifier l'argument de
build client `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-E83WRB1CEL` ; ces variables sont
intégrées au build. Le démarrage HTTP ne migre pas automatiquement le schéma.

## Cache et sécurité

| Réponse | Politique |
| --- | --- |
| HTML public/privé, redirections et erreurs | `no-store` |
| `/backend/` | `no-store` |
| Assets Next.js versionnés en 200/206/304 | `public, max-age=31536000, immutable` |
| Images ordinaires en 200/206/304 | `public, max-age=86400` |
| Assets/images en erreur | `no-store` |
| `/_next/image` | Cache de l'optimiseur Next.js, minimum une heure |
| Sitemap et robots | `public, max-age=0, must-revalidate` |

Le cache HTML d'un an observé venait du pré-rendu Next.js. Nginx remplace
désormais ce cache pour les pages. Le catalogue SEO est lu sans cache persistant ;
React mutualise la lecture entre métadonnées et contenu dans un même rendu.

Nginx émet les en-têtes communs à la frontière publique et masque les copies
amont. Les protections directes Next.js restent disponibles. La CSP de
l'application est relayée telle quelle ; une CSP restrictive couvre les erreurs
produites par Nginx. Permissions-Policy et X-Frame-Options sont aussi conservées
sur ces erreurs. Chaque emplacement
ajoutant un en-tête inclut également les en-têtes de sécurité. Admin/livreur
émettent un seul `X-Robots-Tag: noindex, nofollow`, y compris en 404/502, tout en
conservant les balises HTML. Vérifier `/checkout` et les connexions/redirections.

## Contrôles après déploiement

```sh
python tools/seo_snapshot.py --output outputs/seo/after-deploy --private https://admin.souki.io/ --private https://livreur.souki.io/ --strict
python tools/seo_pagespeed.py --output outputs/seo/pagespeed-after-deploy
```

Le relevé conserve HTML brut, en-têtes non fusionnés, redirections, canonical,
robots et liens produit ; il compare sitemap et catalogue actif. Contrôler les
200, le 404 d'un produit inconnu, le 308 d'un ancien slug et la redirection
`www`. Vérifier titres, contenu, liens HTML et prix sans JavaScript ; tester les
cas stock/précommande/indisponible réellement présents, sans modifier de stock
réel pour fabriquer les tests. Comparer aussi le JSON-LD au contenu visible.

Les ressources locales, photos Unsplash/Pixabay, uploads publics du projet
Supabase et miniature Bing utilisés par le catalogue actuel sont autorisés par
hôte et chemin. Ils utilisent Next Image/WebP et `sizes`. Une image administrée
en base prévaut sur la photo de présentation, pour que sa modification et sa
date correspondent réellement à la page. Les anciens placeholders conservent
les photos de présentation. Les médias `/backend/` et les hôtes supplémentaires non
configurés restent directs, pour éviter les problèmes d'authentification ou un
optimiseur ouvert à tout hôte. Les fiches/cartes disposent de replis locaux.
Tester chaque nouvel hôte réel avant de l'ajouter à `remotePatterns`.

Les modales IA sont chargées à l'ouverture. Le logo demande une taille adaptée
et l'image placée sous le texte de l'accueil mobile n'est plus préchargée.
Les composants de lancement PWA nécessaires à la première peinture restent
immédiats. Mesurer le JavaScript initial et décider des reports supplémentaires
à partir de son coût, en contrôlant achat et installation PWA.

Comparer PageSpeed mobile dans les mêmes conditions : élément LCP, poids et
dimensions d'images, scripts initiaux et mesures de laboratoire. Objectifs :
score ≥ 90 et LCP ≤ 2,5 s. Au 75e percentile terrain : LCP ≤ 2,5 s, INP ≤ 200 ms,
CLS ≤ 0,1. « No Data » ne constitue pas une conformité terrain.

## Schémas et informations métier

`Product`/`Offer` reprennent prix visible en MAD, SKU interne, image, canonical
et disponibilité API. Tester produit, organisation et FAQ dans le
[Rich Results Test](https://search.google.com/test/rich-results), puis l'inspection
d'URL. Les tests locaux ne remplacent pas ces validations externes. Aucun avis,
score ou GTIN fictif ; l'absence d'affichage enrichi FAQ ne constitue pas un échec.

La remise directe aux clients est confirmée par l'utilisateur. Adresse,
coordonnées, zones précises, fiche existante et règles de retour restent à
confirmer. Conserver `Organization`/`Service` tant qu'un `LocalBusiness` exact
n'est pas établi. Ajouter livraison/retour seulement après validation des règles
publiables et maintenables ; conserver les avertissements facultatifs jusque-là.

## GA4 et Web Vitals

GA4 est désactivé en développement par défaut. Pour un test volontaire,
`NEXT_PUBLIC_GA_DEBUG=true` au build, ou `?ga_debug=1` en production/Tag Assistant.
Les événements métier de test portent `debug_mode` et `traffic_type=developer`.
Configurer et tester le filtre développeur dans GA4 avant tout achat de test ;
le code ne modifie pas les réglages du compte.

Observer `view_item`, `add_to_cart`, `begin_checkout`, `purchase` et
`voice_order_used` dans DebugView avec devise, valeur, articles et quantités.
`purchase` part après confirmation serveur : identifiant, prix, quantités et
frais viennent de la commande. `value` est le sous-total produit, la livraison
est dans `shipping`. Un ancien backend sans lignes confirmées ne produit pas
de montant reconstruit. Le stockage local et l'identifiant préviennent les
réémissions usuelles ; si le stockage est bloqué, la mémoire locale ne persiste
que dans le contexte courant. Vérifier réellement une seule transaction puis
la collecte hors débogage.

`web_vitals` publie nom, identifiant, valeur, qualité et chemin du document chargé,
sans paramètres d'URL. Enregistrer les dimensions/métriques utiles dans GA4,
puis suivre les distributions par page/appareil. LCP/INP sont en ms, CLS est
sans unité ; ce suivi applicatif ne remplace pas CrUX.

## Comptes et quatre semaines de suivi

Après réussite des contrôles publics :

1. Soumettre `https://souki.io/sitemap.xml` dans la propriété de domaine
   `souki.io`, relever date/statut/URL découvertes/erreurs.
2. Inspecter catalogue, pommes de terre, tomates et un troisième produit
   représentatif ; demander l'indexation après test en direct, sans répétition inutile.
3. Vérifier Bing Webmaster Tools puis soumettre/importer le même sitemap.
4. Rechercher une fiche Google Business dans les comptes propriétaires, confirmer
   l'éligibilité et les données métier avant de revendiquer/créer une seule fiche.
5. Fixer J0 à la date réelle de livraison/soumission. À J+7, J+14 et J+28, relever
   découverte, dernière exploration, canonical choisie, indexation et motif
   d'exclusion par URL. Relever Pages et Statistiques d'exploration chaque semaine,
   ou « indisponible » tant que ces rapports ne sont pas prêts.
6. Suivre « Souki Fès » depuis Fès avec une méthode constante sans personnalisation ;
   consigner date/méthode/résultat, cohérence des profils et améliorations éditoriales
   soumises au métier.

Les validations externes et J+28 sont requis avant de déclarer le plan terminé.
Aucune indexation ou position n'est garantie.
