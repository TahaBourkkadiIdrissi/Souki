# Plan d'implémentation SEO — SOUKI

**Référence :** [audit SEO du 27 septembre 2026](SEO_AUDIT_2026-09-27.md)  
**Application concernée :** `apps/client`, servie sur `https://souki.io`  
**Périmètre exclu :** le domaine secondaire (`soukipp.com` dans la demande, `soukiapp.com` dans l'audit). Aucune tâche DNS, redirection ou Search Console ne le concerne.

## Objectif et définition de terminé

Rendre les pages publiques de SOUKI faciles à découvrir et à explorer, corriger les problèmes techniques constatés, améliorer les performances mobiles et rendre les mesures SEO et commerciales vérifiables. L'indexation et le classement restent des décisions des moteurs de recherche : la réussite du plan se juge sur les contrôles techniques, les soumissions acceptées et le suivi des résultats, sans promettre de position ni de délai d'indexation.

Le plan est terminé lorsque :

- le sitemap ne contient que des URL canoniques accessibles en 200, est traité sans erreur par Google et Bing, et les pages prioritaires sont inspectées ;
- le HTML brut des pages publiques contient leurs titres, contenu et liens utiles ; les pages privées restent non indexables ;
- les en-têtes HTTP sont cohérents, non dupliqués, et le cache du HTML correspond à la fraîcheur des pages ;
- les images principales sont adaptées au mobile, les mesures PageSpeed ont été refaites, et les Core Web Vitals disposent d'un suivi dès que les données terrain existent ;
- les dates et données structurées publiées sont exactes, et les événements GA4 métier sont observés avec leurs paramètres ;
- la présence locale de SOUKI est traitée selon l'éligibilité réelle de l'entreprise et les comptes propriétaires ;
- chaque changement est vérifié après déploiement, puis suivi dans Search Console pendant au moins quatre semaines.

## Phase 0 — Référence et preuves (½ journée)

**Responsable :** développement / SEO.

1. Conserver une copie datée des réponses de `/`, `/catalogue`, d'au moins deux fiches produit, de `/checkout`, des sous-domaines admin et livreur, de `/robots.txt` et de `/sitemap.xml` : code HTTP, en-têtes, canonical et meta robots.
2. Sauvegarder le HTML brut de `/catalogue` et vérifier sans JavaScript la présence de noms de produits et de liens `<a href="/produit/...">`. Faire le même contrôle pour les fiches produit et leur contenu principal.
3. Relancer PageSpeed mobile pour l'accueil et le catalogue ; noter l'élément LCP, le poids et la dimension des images concernées, les scripts chargés avant l'affichage, le LCP, l'INP et le CLS disponibles. Distinguer mesures de laboratoire et données utilisateurs réelles.
4. Relever les statuts du sitemap, des URL prioritaires, du rapport Pages et des statistiques d'exploration dans Search Console. Noter « indisponible » plutôt que supposer une absence d'erreur si le rapport n'est pas encore prêt.

**Validation :** un relevé daté et reproductible existe pour les constats B3, B5, C2 à C5 et C8. Les points déjà conformes de l'audit (`robots.txt`, canonical, balises `noindex`, redirection `www`) entrent dans les contrôles de non-régression.

## Phase 1 — Découverte et indexation (½ à 1 journée, puis suivi)

**Responsables :** développement pour les URL et liens ; propriétaire Search Console pour les soumissions.

1. Comparer les URL de `apps/client/app/sitemap.ts` avec le catalogue actif. Pour chaque URL, contrôler le 200 final, la canonical, l'absence de `noindex`, la présence d'un contenu utile et l'absence de redirection inattendue.
2. Vérifier que l'accueil et le catalogue exposent des liens HTML explorables vers les pages importantes, y compris dans le rendu mobile. Corriger les liens manquants ou les fiches trop pauvres avant de demander l'indexation.
3. Soumettre `https://souki.io/sitemap.xml` dans la propriété de domaine `souki.io` déjà vérifiée. Consigner la date, le statut de traitement, les URL découvertes et les erreurs éventuelles.
4. Inspecter `/catalogue` et deux ou trois produits représentatifs avec l'outil d'inspection d'URL ; demander l'indexation une fois les contrôles précédents réussis. Ne pas répéter inutilement les demandes.
5. À J+7, J+14 et J+28, relever par URL : découverte, dernière exploration, canonical choisie, indexation et motif d'exclusion. Traiter chaque motif observé plutôt que d'imputer automatiquement l'attente au sitemap.

**Validation :** sitemap traité sans erreur ; URL prioritaires accessibles et inspectables ; état d'indexation documenté sur quatre semaines. Une soumission n'est pas une garantie d'indexation.

## Phase 2 — En-têtes, cache et pages privées (1 à 2 jours)

**Responsable :** infrastructure / développement.

**Fichiers principaux :** `infra/nginx/default.conf.template`, `infra/nginx/proxy.conf`, `apps/client/next.config.mjs`, `apps/admin/next.config.mjs`, `apps/livreur/next.config.mjs`.

1. Tracer l'origine de `Cache-Control: s-maxage=31536000` observé sur le HTML. Définir une politique par catégorie : pages privées sans cache partagé ; HTML public dynamique avec une durée compatible avec la fraîcheur effective ; assets Next.js versionnés avec cache long ; sitemap et robots vérifiables après mise à jour.
2. Choisir une seule couche pour émettre HSTS, `X-Content-Type-Options` et les autres en-têtes communs ; retirer les doublons constatés. Garder la politique CSP fonctionnelle.
3. Ajouter `X-Robots-Tag: noindex, nofollow` aux réponses HTML admin et livreur, y compris les erreurs pertinentes, sans perdre les en-têtes de sécurité. Conserver les balises meta robots déjà présentes. Vérifier aussi `/checkout` et les redirections vers la connexion.
4. Tester la configuration Nginx et les réponses réelles après déploiement sur plusieurs codes HTTP, pas seulement sur l'accueil.

**Validation :** aucun en-tête HSTS ou `nosniff` dupliqué ; politique de cache documentée et observée ; admin et livreur répondent avec `X-Robots-Tag` ; les routes et assets publics restent accessibles aux robots.

## Phase 3 — Performance mobile (2 à 4 jours)

**Responsable :** développement frontend.

**Fichiers principaux :** `apps/client/next.config.mjs`, `apps/client/app/home-client.tsx`, `apps/client/app/catalogue/catalogue-client.tsx`, `apps/client/components/souki/product-card.tsx`, `apps/client/app/produit/[slug]/page.tsx`.

1. Partir de l'élément LCP identifié en phase 0 sur chaque page. Mesurer taille téléchargée, dimension affichée et délai de découverte de son image.
2. Générer des ressources adaptées aux dimensions mobiles et choisir le format pertinent. Fournir `sizes` corrects, réserver les dimensions pour éviter le CLS et charger tôt uniquement l'image réellement prioritaire.
3. Retirer le réglage global `images: { unoptimized: true }` après avoir configuré et testé les sources locales et distantes nécessaires. Vérifier les images de produit, les illustrations, les URL distantes et les cas de repli. Ne garder `unoptimized` que pour les exceptions justifiées.
4. Mesurer ensuite le coût du JavaScript initial et différer les fonctions qui ne servent pas au premier écran, notamment les composants PWA ou interactifs coûteux, sans casser le parcours d'achat ni la mesure GA4.
5. Comparer avant/après sur mobile avec les mêmes pages et conditions. Contrôler aussi visuellement l'accueil, le catalogue et une fiche produit.

**Validation :** baisse mesurée du poids d'image et du LCP ; aucune image cassée ; aucun recul fonctionnel. Viser LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1 au 75e percentile quand les données réelles existent, ainsi qu'un score mobile Lighthouse ≥ 90 comme objectif de laboratoire, sans les confondre.

## Phase 4 — Fraîcheur du sitemap et données structurées (1 à 3 jours)

**Responsables :** backend, frontend et responsable des informations commerciales.

**Fichiers principaux :** `back-end/entities/product_entity.py`, `back-end/dto/product_dto.py`, `back-end/services/catalogue_service.py`, une migration SQL **versionnée**, `apps/client/lib/api.ts`, `apps/client/lib/seo-catalogue.ts`, `apps/client/app/sitemap.ts`, `apps/client/app/layout.tsx`, `apps/client/app/produit/[slug]/page.tsx`.

1. Définir quels changements de produit constituent une modification significative de la page publique : nom, description, image, prix, disponibilité ou liens affichés. Ajouter une date fiable à la source de données et la transmettre jusqu'au sitemap. Ne pas attribuer artificiellement la date de migration aux produits existants : laisser `lastModified` absent si la date réelle est inconnue. Le dossier `back-end/sql/` a une règle d'ignorance Git ; prévoir explicitement le suivi de la nouvelle migration.
2. Vérifier que `Product` et `Offer` reflètent exactement la page : prix en MAD, disponibilité réelle, image, URL canonique et identifiant interne pertinent. Tester plusieurs produits, dont un indisponible. Ne créer ni GTIN, ni avis, ni note fictifs.
3. Valider la politique réelle de livraison et de retour avec l'entreprise. Ajouter les données structurées correspondantes au niveau de l'organisation ou du produit uniquement lorsqu'elles sont publiées et maintenables.
4. Décider si `LocalBusiness` décrit réellement SOUKI. Confirmer l'adresse physique, le mode de contact avec les clients et les informations à publier. Si les critères ne sont pas réunis, conserver `Organization` et `Service` et consigner cette décision : l'absence de `LocalBusiness` n'est alors pas une anomalie à masquer.
5. Tester `Product`, `Offer`, `Organization`, le cas éventuel `LocalBusiness` et la FAQ avec le Rich Results Test et l'inspection d'URL. Corriger les erreurs critiques ; examiner les avertissements facultatifs sans inventer de données. Ne pas prendre l'absence de résultat enrichi FAQ pour un échec : Google le réserve principalement aux sites gouvernementaux et de santé reconnus.

**Validation :** dates `lastmod` vérifiables pour les produits réellement modifiés ; sitemap toujours limité aux pages publiques ; données structurées conformes aux informations visibles et sans erreur critique.

## Phase 5 — GA4 et événements métier (1 à 2 jours)

**Responsables :** développement / analyste.

**Fichiers principaux :** `apps/client/lib/analytics.ts`, `apps/client/app/produit/[slug]/product-purchase.tsx`, `apps/client/app/catalogue/catalogue-client.tsx`, `apps/client/app/checkout/page.tsx`, `apps/client/components/souki/ai-modals.tsx`.

1. Vérifier l'ID de mesure servi en production et activer DebugView sur un appareil de test avec Tag Assistant. Le fait que DebugView affiche zéro appareil sans mode débogage ne prouve pas que les événements sont absents.
2. Exécuter un parcours maîtrisé et vérifier `view_item`, `add_to_cart`, `begin_checkout`, `purchase` et `voice_order_used`. Ces appels existent déjà dans le code : corriger seulement les événements absents, mal déclenchés ou mal renseignés.
3. Contrôler `currency`, `value`, `items`, quantités et `transaction_id`. `purchase` doit partir une seule fois après confirmation par le serveur, avec une valeur conforme à la commande réellement créée. Éviter les doubles envois lors des retours arrière ou rechargements.
4. Exclure le trafic de développement et les transactions de test des rapports commerciaux selon la configuration GA4 retenue.

**Validation :** les cinq événements et leurs paramètres apparaissent dans DebugView ; un achat de test contrôlé ne produit qu'une transaction ; les rapports GA4 confirment ensuite la collecte hors débogage.

## Phase 6 — Bing et présence locale (1 à 3 jours, selon l'accès aux comptes)

**Responsable :** propriétaire des comptes, avec appui SEO.

1. Vérifier si une fiche Google Business existe sous un autre compte avant toute création. Confirmer l'éligibilité de SOUKI : contact direct avec les clients lors des livraisons, zone desservie réelle et informations professionnelles vérifiables. Revendiquer ou créer une seule fiche si éligible ; renseigner Fès et les zones effectivement livrées, les horaires, le téléphone et `https://souki.io`. Si l'activité est uniquement en ligne sans contact direct, consigner l'inéligibilité et ne pas créer de fiche artificielle.
2. Vérifier `souki.io` dans Bing Webmaster Tools, puis importer ou soumettre le sitemap. Examiner son statut et les éventuelles erreurs.
3. Suivre « Souki Fès » avec une localisation et une méthode constantes. Vérifier la cohérence des informations locales publiées sur le site et sur les profils officiels. Préparer ensuite des améliorations éditoriales utiles pour les recherches locales, soumises à validation métier ; ne pas promettre une position donnée.

**Validation :** état de la fiche Google Business connu et documenté ; propriété Bing vérifiée et sitemap traité ; base de suivi des requêtes locales établie.

## Découpage de livraison et contrôles

| Lot | Livrable | Dépendance | Contrôles avant et après déploiement |
| --- | --- | --- | --- |
| 1 | Sitemap, liens explorables, soumission Search Console | Phase 0 | URL 200, canonical, HTML brut, sitemap traité, inspection d'URL |
| 2 | Cache, en-têtes et `X-Robots-Tag` | Phase 0 | Configuration Nginx valide ; matrice de réponses HTTP sur public/privé/erreurs |
| 3 | Images et JavaScript initial | Mesures de phase 0 | Build, parcours d'achat, comparaison PageSpeed, contrôle visuel mobile |
| 4 | Date produit et données structurées | Politique métier et migration | Tests API, sitemap, produits actifs/inactifs, Rich Results Test |
| 5 | Validation et correction GA4 | Parcours de test | DebugView, paramètres ecommerce, achat unique, rapports ultérieurs |
| 6 | Bing et Google Business Profile | Accès et éligibilité | Statut des propriétés, sitemap, vérification de la fiche |

À chaque lot : vérifier le build des trois applications concernées, le typage, les tests utiles, puis les URL de production après déploiement. Les contrôles déjà réussis dans l'audit doivent rester conformes. Les rapports Search Console « Pages » et « Statistiques d'exploration », indisponibles lors de l'audit, sont relevés chaque semaine dès qu'ils apparaissent ; toute exclusion est traitée selon son motif réel.

## Sources de référence

- [Google Search Central — créer et soumettre un sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) et [demander une nouvelle exploration](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
- [Google Search Central — données structurées des offres marchandes](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing), [LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business) et [limites d'affichage des FAQ](https://developers.google.com/search/blog/2023/08/howto-faq-changes).
- [Next.js — composant Image](https://nextjs.org/docs/app/api-reference/components/image) et [Web Vitals](https://web.dev/articles/vitals/).
- [Google Analytics — événements ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce) et [DebugView](https://support.google.com/analytics/answer/7201382).
- [Google Business Profile — éligibilité](https://support.google.com/business/answer/13763036) et [zones desservies](https://support.google.com/business/answer/9157481) ; [Bing Webmaster Tools — sitemaps](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed).
