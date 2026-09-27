# État d'exécution SEO — 27 septembre 2026

Le plan est **en cours**. Les corrections du dépôt sont vérifiées localement ;
déploiement, comptes propriétaires et suivi de quatre semaines restent requis.
Le domaine secondaire est exclu.

## Preuves

- `outputs/seo/baseline-2026-09-27/` : réponses brutes accueil, catalogue, 26
  fiches, checkout, admin/livreur, robots/sitemap. Catalogue : 26 liens HTML ;
  accueil : aucun lien produit avant correction. Les 32 URL du sitemap répondent
  200 avec leur canonical ; comparaison à l'API active et chaîne `www` conservées.
- Ce relevé confirme les doublons HSTS/`nosniff`/Referrer-Policy et le cache HTML
  d'un an. Il décrit la production existante, pas les corrections non déployées.
- PageSpeed relancé par API : **429** sur les deux pages, enregistré dans
  `outputs/seo/pagespeed-baseline/summary.json`. Référence disponible : audit du
  27/09, accueil 68 / LCP 6,8 s / CLS 0,068 ; catalogue 63 / LCP 8,2 s / CLS 0.
  Les données terrain/INP étaient indisponibles dans cet audit.
- Nouvelle tentative PageSpeed à **14:31 UTC le 27/09** : encore HTTP 429 sur
  les deux pages, preuve dans `outputs/seo/pagespeed-recheck/summary.json`.
- Dépendances frontend réinstallées depuis le fichier verrouillé : trois builds
  et typage réussis sous Next.js **16.3.6**. Lint : **0 erreur**, avertissements
  historiques visibles dans `outputs/seo/lint-{client,admin,livreur}.log`.
- Backend, identifiants factices et secrets développeur désactivés : **191 tests
  réussis**, dont date/disponibilité et lignes confirmées du checkout. Les 13
  tests ciblés passent également.
- Node : **6 tests GA4** et **1 test PostgreSQL embarqué** réussis. Migration
  idempotente, dates historiques inconnues conservées, changements publics datés.
- Nginx 1.28 Windows : configuration valide ; frontends standalone testés avec
  catalogue isolé en 200/308/404/502, cache, en-têtes uniques, protection privée,
  sitemap et Product/Offer. Preuves et captures dans `outputs/seo/runtime/`.
  Le `nginx -t` du conteneur de production reste obligatoire.
- Image locale identique : **110 424 octets** en PNG → **4 434 octets** en WebP
  à 384 px, soit environ −96 %. Cette mesure locale ne prouve pas un gain de LCP
  en production. Accueil/catalogue/fiche vérifiés à 390 px, photos visibles
  chargées et absence de débordement horizontal.
- Les **26 sources d'images** du catalogue public capturé répondent en 200 via
  l'optimiseur à 384 px, y compris les images Supabase et Bing.

`outputs/` conserve les preuves locales et est ignoré par Git. Les outils de
reproduction sont versionnés. Voir [la procédure de livraison](SEO_DEPLOYMENT.md).

## État par phase

| Phase | Correction locale | Reste à prouver |
| --- | --- | --- |
| 0 — Référence | HTML/matrice HTTP capturés, audit conservé | PageSpeed complet : LCP/images/scripts ; rapports Search Console actuels |
| 1 — Découverte | Accueil sur catalogue actif, liens HTML ; sitemap comparé au catalogue | Livraison, sitemap Google accepté, inspections, J+7/J+14/J+28 |
| 2 — Cache/sécurité | Doublons masqués, pages sans cache partagé, assets en erreur sans cache long, `X-Robots-Tag` privé | Configuration et réponses du conteneur/production |
| 3 — Mobile | Next Image, WebP, tailles/priorités, replis locaux, modales IA différées, mesure de poids | PageSpeed avant/après comparable, coût JS initial, terrain et parcours réel achat/PWA |
| 4 — Fraîcheur/schémas | Migration suivie par Git, date API→sitemap, disponibilité API→Offer/UI ; Organization/Service conservés | Migration réelle, Rich Results Test/inspection, règles commerciales et données locales |
| 5 — GA4 | Données serveur, déduplication, développement désactivé, debug et Web Vitals, tests | DebugView des cinq événements, filtres du compte, achat unique et rapports hors debug |
| 6 — Bing/local | Remise directe confirmée ; informations inconnues non inventées | Accès Bing, propriété/sitemap, fiche existante/unique, informations officielles et suivi local |

## Accès et décisions

L'utilisateur indique disposer de Search Console et GA4. L'inventaire de cette
session ne contient aucun navigateur connecté ; Chrome renvoie « Browser is
not available ». Aucune soumission, inspection ou configuration GA4 n'a donc
été effectuée. Aucun accès au serveur ni Docker local n'est disponible ici.
La nouvelle vérification de cette session confirme un inventaire navigateur
vide. Le client SSH existe, mais aucune connexion serveur utilisable n'a été
fournie. Une demande précise d'accès serveur et navigateur est en attente.

La réponse « oui » confirme la remise directe. Elle ne fournit pas d'adresse,
coordonnées, zones précises ou règles de retour, et n'établit pas l'existence
d'une fiche sous un autre compte. `LocalBusiness`, livraison/retour et fiche
Google Business restent conditionnés aux informations exactes.

## Journal externe

| Contrôle | Date | Statut actuel | Preuve attendue |
| --- | --- | --- | --- |
| Google — sitemap | À renseigner | Non effectué ici | Statut accepté, URL découvertes, erreurs |
| Google — catalogue/produits | À renseigner | Non effectué ici | Test direct, canonical choisie, indexation |
| Bing — propriété/sitemap | À renseigner | Accès indisponible | Propriété vérifiée, XML traité |
| GA4 — événements/achat | À renseigner | DebugView inaccessible ici | Paramètres, transaction unique, rapports ultérieurs |
| Google Business | À renseigner | Informations partielles | Compte/fiche existante, éligibilité et données exactes |

| Depuis J0 réel | Catalogue | Pommes de terre | Tomates | Pages/exploration | Action |
| --- | --- | --- | --- | --- | --- |
| J0 | À relever | À relever | À relever | À relever/indisponible | Soumettre/inspecter après contrôles HTTP |
| J+7 | À relever | À relever | À relever | À relever/indisponible | Traiter les motifs observés |
| J+14 | À relever | À relever | À relever | À relever/indisponible | Contrôler les corrections |
| J+28 | À relever | À relever | À relever | À relever/indisponible | Audit final du plan |

## Reproduction

Après dépendances verrouillées et builds des trois applications :

```sh
node tools/check-frontend-boundaries.mjs
node --test tools/seo-analytics.test.cjs
python back-end/scripts/test_local.py
npm install --prefix tmp/seo-node --no-save @electric-sql/pglite
node --test tools/seo-migration.test.mjs
# Windows : Nginx 1.28 officiel dans tmp/nginx-1.28.0,
# OpenSSL (Git for Windows), Chrome et Playwright installés.
node tools/seo-runtime-check.mjs
```

Le test runtime démarre/arrête ses propres services (3310–3312, 3319, 3380/3443),
utilise un certificat local vérifié et un catalogue synthétique, bloque les
requêtes Analytics et ne crée aucune commande réelle. Ne pas le lancer pendant
un build. Le suivi terrain et les comptes restent nécessaires à la fin du plan.
