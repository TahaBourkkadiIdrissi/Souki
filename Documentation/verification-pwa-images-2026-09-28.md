# Vérification du lot images PWA

Corrections réalisées dans le dépôt, sans déploiement :

- Animation : logo circulaire fourni (`submark.png`), WebP sans perte de 512 × 512 px, affiché à 136 px maximum avant le léger agrandissement final ; préchargement et précache cohérents.
- 36 écrans de lancement iOS régénérés, opaques, centrés et adaptés à la densité de chaque écran. Génération reproductible : `node tools/generate-launch-logo.mjs`.
- Connexion/inscription : logo secondaire de 72 px au lieu de 104 px, espacements mobiles réduits et débordement horizontal corrigé.
- Accueil PWA : symbole sac/S/feuille sans texte, dans la ligne localisation/favoris/profil.
- Prénom : lecture du profil enregistré, rafraîchissement après sauvegarde réussie ; repli sur nom, puis identifiant si nécessaire. Le nom chargé est associé à l'identifiant utilisateur.
- Cache client passé à `v12-launch-circle` ; nettoyage des anciens caches de ressources contrôlé, sans suppression des données utilisateur.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| TypeScript client (`tsc --noEmit --incremental false`) | Réussi |
| ESLint ciblé sur les quatre fichiers React modifiés | Aucune erreur ; avertissements présents |
| `node tools/verify-brand-assets.mjs` | Réussi, dont les 36 splashes et le cycle de cache |
| `node tools/verify-pwa-images.mjs` | Réussi à 320 × 667 et 390 × 844, densité 3× |
| Connexion sans message d'erreur, clavier fermé | Aucun défilement vertical ni débordement horizontal dans les deux formats |
| Taille du logo connexion et inscription | 72 px dans les deux modes |
| Alignement du logo et de la localisation | Écart vertical mesuré : 0 px |
| Profil modifié dans Paramètres puis accueil rechargé | Nouveau prénom affiché |
| Signal de mise à jour reçu sur l'accueil déjà monté | Prénom rafraîchi |
| Logo animé | Carré à bord circulaire, source de 512 px, composition avec couronne vérifiée visuellement |

Les captures et mesures locales sont dans `outputs/pwa-images/`. Le script attend un serveur client sur `127.0.0.1:3100`, lancé avec `NEXT_PUBLIC_GOOGLE_CLIENT_ID=local-ui-test` ; il simule Google, l'authentification et les API, sans compte ni sauvegarde réels. Le logo conserve la définition nécessaire en densité 3×, même pendant son agrandissement.

Limites : vérification sur Chromium desktop avec viewport mobile et mode standalone simulé, sans appareil iOS/Android réel. Le formulaire d'inscription reste défilable pour conserver l'accès à tous les champs. Le clavier, le zoom et les messages d'erreur peuvent légitimement ajouter du défilement. Le build de production et le parcours backend réel ne sont pas couverts par cette vérification.

Le plan PageSpeed est séparé dans `plan-performance-2026-09-28.md` et attend la validation demandée par l'utilisateur.
