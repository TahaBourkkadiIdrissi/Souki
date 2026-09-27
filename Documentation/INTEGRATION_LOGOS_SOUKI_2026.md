# Intégration des logos SOUKI — 26 septembre 2026

Les interfaces actives sont `apps/client`, `apps/livreur` et `apps/admin`, utilisées par `docker-compose.yml`. Aucun déploiement ni changement de logique métier n'a été effectué lors de cette intégration.

## Déclinaisons retenues

| Emplacement | Fichier / choix |
| --- | --- |
| Navigation ordinateur et mobile, catalogue, pages de compte et de commande | Logo primaire horizontal, hauteur 36 px ; le nom fourni reste visible sur mobile à 320 px |
| Pied de page sur fond sombre | Primaire horizontal, hauteur 40 px, support blanc discret |
| En-tête de l'accueil PWA | Primaire horizontal, hauteur 32 px, support blanc ; lien vers `/pwa-welcome` |
| Connexion, inscription, vérification et récupération du compte | Logo secondaire vertical, hauteur 104 px ; support blanc sur les fonds colorés |
| Attente de vérification des accès et page hors ligne | Logo secondaire vertical, hauteur 104 px |
| Animation de lancement | Logo secondaire vertical, hauteur 112 px sur support blanc ; ancien dessin et ancien lettrage recréé retirés |
| Navigation étroite des commandes admin | Symbole extrait intégralement du logo primaire fourni, hauteur 36 px |
| Onglet et favoris | Favicon fourni en ICO 16/32/48 px, PNG 16/32/48 px dérivés du PNG fourni |
| PWA client et livreur | Symbole blanc sur vert, PNG 192 et 512 px depuis le favicon fourni en 1254 px |
| Maskable client et livreur | PNG distincts 192 et 512 px, marges supplémentaires ; vert opaque jusqu'aux bords |
| Écran d'accueil iOS | Apple touch icon de 180 px ; 36 écrans de démarrage actualisés avec le secondaire |
| Submark circulaire | Conservé dans les ressources ; aucun nouvel usage ajouté là où une présentation circulaire n'était pas pertinente |

Les composants `SoukiLogo` et `SoukiLogoLink` centralisent le rendu à l'intérieur de chaque interface. Les copies locales respectent les frontières d'import imposées par le projet. Dimensions explicites, proportions natives, nom accessible `SOUKI — Accueil`. Tous les liens de marque rejoignent l'accueil de leur interface, ou directement l'accueil installé.

## Images et fabrication

Sources originales conservées sans modification dans `assets/branding/source/` : primaire 1920 × 819 px, secondaire 1254 × 1254 px, submark et favicon PNG 1254 × 1254 px, favicon ICO fourni. Primaire et secondaire comportent une couche alpha ; favicon et submark sont opaques, leur blanc n'a pas été traité comme transparent.

Seules les marges entièrement transparentes des logos complets sont recadrées. Le symbole isolé provient de la partie séparée du primaire ; il n'est pas redessiné. Pas de recoloration, de déformation ni de faux SVG. Les extensions de fond des maskable reprennent les pixels verts des bords du favicon original.

La [recommandation actuelle W3C](https://www.w3.org/TR/appmanifest/#icon-masks) et le [guide de la plateforme Chrome](https://web.dev/articles/maskable-icon) définissent une zone sûre circulaire centrée, de rayon 40 % de la dimension minimale. Le rayon maximal mesuré du symbole est 63,13 px pour la version 192 px (limite 76,8 px) et 168,22 px pour la version 512 px (limite 204,8 px).

Les nouveaux chemins sont sous `/brand/souki-2026/`. `theme_color` / `themeColor` utilisent le vert de marque `#005B43`. `background_color` reste blanc pour correspondre à la première image du lancement et aux écrans iOS existants. Identifiants, portée et URLs de démarrage des PWA conservés. L'admin reste sans manifeste ni service worker.

## Cache et données

Les workers client et livreur utilisent `v11-brand2026`, précachent les nouveaux logos, icônes et manifeste, et actualisent le manifeste par une stratégie réseau en premier avec repli hors ligne. L'enregistrement utilise `updateViaCache: "none"` ; le serveur conserve `Cache-Control: no-store` sur `/sw.js`.

La suppression est limitée aux anciennes versions numériques du cache de ressources de la PWA concernée. Les autres caches restent intacts. Aucun effacement de localStorage, IndexedDB, cookies, paniers, comptes ou données métier. Les URLs de précache sont dédupliquées pour éviter le doublon `/offline` déjà présent côté livreur.

## Vérifications

- TypeScript : succès sur client, livreur, admin.
- Builds de production Next.js : succès sur les trois interfaces, avec les changements finaux de présentation.
- Lint complet : aucune erreur ; avertissements existants (client 102, livreur 29, admin 21), surtout composants images et règles React déjà rétrogradées en avertissement dans la configuration.
- Frontières d'import : succès pour les trois interfaces.
- `git diff --check` : succès.
- Contrôle des images : dimensions, alpha / opacité, ICO multitailles, zone sûre circulaire maskable, existence des ressources de précache et 36 écrans iOS : succès.
- Chrome local : 13 vues ordinateur/mobile à 1440, 390 et 320 px, ressources chargées, absence de débordement horizontal et nom accessible des liens : succès.
- Manifeste client/livreur : zéro erreur de parsing Chrome ; quatre icônes PNG présentes avec les tailles et `purpose` attendus.
- Service workers réels : activation, nouvelles ressources en cache, manifeste et logo accessibles hors ligne, affichage de la page de repli : succès sur les deux PWA.
- Conservation de localStorage et d'un cache utilisateur témoin : vérifiée dans un profil de test isolé. Suppression ciblée des anciens caches : vérifiée par simulation des événements de worker.
- Animation : capture à 1450 ms ; logo fourni entier ; disparition contrôlée avec mouvement réduit. Le délai a été prolongé seulement dans le navigateur de capture pour figer l'image, pas dans le code produit.
- Accueil installé : aperçu à 390 px avec `navigator.standalone` et une session fictive interceptée uniquement dans le navigateur de test ; logo et lien de retour vérifiés.

Commandes reproductibles :

```text
node tools/generate-brand-assets.mjs
node tools/verify-brand-assets.mjs
node tools/check-frontend-boundaries.mjs
node tools/verify-brand-browser.mjs
```

La vérification navigateur attend les serveurs de production locaux client/livreur/admin sur les ports 3100/3101/3102. Pour chaque interface, les vérifications du projet ont été exécutées via ses binaires déjà installés (`node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`, `node node_modules/next/dist/bin/next build`) ; `pnpm` n'est pas disponible dans le shell de cette session.

## Captures et fichiers

Les captures et rapports de vérification sont générés localement dans `outputs/branding/`, qui n'est pas versionné. Pour les recréer, lancer les commandes reproductibles ci-dessus après avoir démarré les trois applications sur les ports 3100, 3101 et 3102. Les sources graphiques restent dans `assets/branding/source/` et les ressources servies dans le dossier `public/` de chaque application.

## Limites

Pas d'installation système réelle ni de lancement sur un téléphone Android/iOS. Chrome de test utilise un contexte privé : son seul diagnostic d'installation est `in-incognito`. Le manifeste et ses ressources sont validés, mais les masques du lanceur Android, la mise à jour d'une installation existante et les écrans de démarrage Apple restent à vérifier sur appareil.

Backend et identifiant Google OAuth non configurés dans cet aperçu local : certaines captures de connexion affichent l'avertissement Google déjà prévu par l'application. Aucun parcours de connexion, commande ou paiement réel exécuté. Certaines photos externes sont absentes des captures du test isolé ; les nouveaux logos sont tous locaux et ont été chargés et vérifiés. Ces éléments ne font pas partie des modifications de marque.
