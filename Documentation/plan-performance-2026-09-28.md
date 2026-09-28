# Plan de performance Souki — à valider

Statut : proposition uniquement. Les optimisations de ce plan ne sont pas appliquées dans le lot de corrections des logos et du prénom.

## Mesures de référence

[Rapport PageSpeed fourni](https://pagespeed.web.dev/analysis/https-souki-io/3l9mmncnii?form_factor=mobile), récupéré le 28 septembre 2026. Données Lighthouse 13.5.0 extraites du rapport, URL testée : `https://souki.io/`.

| Mesure | Mobile |
| --- | ---: |
| Performance | 63/100 |
| First Contentful Paint | 3,3 s |
| Largest Contentful Paint | 7,8 s |
| Speed Index | 5,8 s |
| Total Blocking Time | 140 ms |
| Cumulative Layout Shift | 0 |
| Accessibilité | 85/100 |
| Bonnes pratiques | 96/100 |
| SEO | 100/100 |

Le score desktop est de 74/100. Ces mesures de laboratoire concernent l'accueil public, pas `/pwa-welcome` en mode installé. Elles ne constituent pas des mesures terrain de tous les utilisateurs. Les économies annoncées ci-dessous sont les estimations du rapport et ne s'additionnent pas nécessairement.

## 1. Priorité haute : réduire le délai d'affichage de l'accueil

Constat : l'élément LCP mobile est la photo de fond du premier bloc (`photo-1542838132-92c53300491e`, opacité 0,16), et non le logo. Le rapport détecte la ressource dans le HTML mais ne détecte pas de priorité `fetchpriority=high`. La décomposition de la trace signale environ 2,31 s de délai de rendu après le téléchargement ; ce chiffre de trace n'est pas directement additionnable au LCP simulé de 7,8 s.

Travaux proposés dans `apps/client/app/home-client.tsx` et les styles associés :

- Auditer l'apparition du premier bloc, les animations d'opacité et les dépendances d'hydratation pour afficher immédiatement le contenu principal.
- Préparer une version mobile allégée de la photo de fond, avec dimensions et compression adaptées à son rôle décoratif. Comparer visuellement avant/après.
- Donner une priorité explicite à l'image réellement retenue comme LCP ; éviter de précharger plusieurs images concurrentes.
- Garder le chargement différé des photos sous la ligne de flottaison et réserver leurs dimensions pour préserver le CLS.

Validation : image LCP identifiée dans une nouvelle trace, priorité confirmée dans le réseau, rendu visuel inchangé, médiane de trois audits de production comparables. Premier objectif : LCP inférieur à 4 s ; cible finale inférieure ou égale à 2,5 s, sans garantie de score avant mesure.

## 2. Priorité haute : images et ressources PWA

Constat : environ 293 Kio d'économies d'images estimées. Le rapport cite la photo de fond, la photo de l'étal, celle du marché, des images de produits et les avatars des témoignages. Certaines ressources apparaissent plusieurs fois dans le détail : dédupliquer les URL lors de l'inventaire.

Travaux proposés dans `home-client.tsx`, `components/souki/optimized-image.tsx`, `next.config.mjs` et les ressources publiques :

- Ajuster `sizes`, dimensions et qualité par usage ; comparer WebP et AVIF pour les photos avec contrôle visuel.
- Optimiser les avatars actuellement chargés directement depuis Unsplash et les différer lorsqu'ils sont hors écran.
- Mesurer pourquoi `wreath.webp` est téléchargé pendant la visite publique : distinguer le DOM masqué de l'animation et le précache du service worker. Éviter sa concurrence avec le premier rendu public, tout en conservant un lancement installé et hors ligne fiable.
- Versionner les fichiers statiques dont on allonge le cache. Le rapport cite la couronne (~186 ko transférés, cache d'un jour), avec environ 73 Kio d'économies estimées lors des visites répétées.

Validation : captures comparées sur écrans à densité 2x et 3x, volumes réseau froid/chaud, démarrage PWA en ligne/hors ligne et mise à jour depuis un ancien cache. Ne jamais mettre en cache publiquement les API de profil ou les réponses authentifiées.

## 3. Priorité moyenne : JavaScript et CSS critiques

Constat : environ 94 Kio de JavaScript inutilisé, dont ~73 ko pour Google Analytics et ~24 ko pour un chunk applicatif. Le rapport estime 300 ms de gain sur le FCP pour deux feuilles CSS bloquantes (~39 ko et ~2 ko). Le TBT mobile est déjà satisfaisant à 140 ms ; conserver cette valeur.

Travaux proposés :

- Identifier le contenu du chunk applicatif avec une analyse du bundle de production avant de choisir les imports à différer.
- Charger les fonctionnalités non nécessaires au premier écran à leur usage. Évaluer un chargement plus tardif d'Analytics en préservant le consentement, les pages vues initiales et les changements de route, sans doublons.
- Examiner la répartition des styles globaux et spécifiques à la PWA ; extraire les styles non critiques lorsque cela réduit réellement le CSS initial, sans provoquer de flash de contenu non stylé.
- Examiner les animations et tâches du thread principal signalées par la trace avant de les modifier.

Validation : comparaison des bundles et du réseau, navigation et formulaires fonctionnels, vérification des événements Analytics et de leur absence de doublons, FCP cible ≤ 1,8 s et TBT ≤ 200 ms.

## 4. Contrôle de livraison et suivi

- Établir un nouvel audit de référence sur le commit à déployer : le rapport fourni peut correspondre à une version différente du dépôt.
- Livrer les étapes 1 à 3 séparément sur un environnement de validation ; trois mesures mobiles dans les mêmes conditions à chaque étape, comparaison des médianes.
- Vérifier Safari iOS et Chrome Android réels : première installation, ouverture suivante, mouvement réduit, mode hors ligne, connexion, inscription, changement de profil et commande.
- Mesurer `/pwa-welcome` séparément avec session de test ; ne pas attribuer le score public à la PWA installée.
- Viser un score mobile ≥ 90 après mesures, préserver CLS ≤ 0,1, SEO 100 et le fonctionnement métier. Déployer seulement après validation des résultats ; conserver un retour au lot précédent et tester l'invalidation du service worker.

Les audits de contraste, noms accessibles des boutons, attributs ARIA, repère `main` et erreurs console sont aussi signalés. Les examiner dans un lot de qualité distinct : ils n'expliquent pas à eux seuls le score de performance.

## Validation demandée

Valider l'exécution des étapes 1 → 2 → 3, puis les contrôles de l'étape 4. Chaque étape sera mesurée avant de poursuivre ; toute modification visuelle sensible sera présentée avec un comparatif. Aucun changement du cache Nginx, d'Analytics ou de la structure de l'accueil public n'a été appliqué dans ce lot.
