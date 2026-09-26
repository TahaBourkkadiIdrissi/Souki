# Mise en production et validation SEO de SOUKI

Le code SEO est dans `apps/client`, application servie sur `souki.io`. Les
applications `apps/admin` et `apps/livreur` émettent `noindex, nofollow`.

## Avant le déploiement

1. Déployer les images des trois frontends après un build réussi. Le build du
   client reçoit `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-E83WRB1CEL` via
   `docker-compose.yml` ; vérifier cette valeur dans l'environnement réellement
   utilisé par le serveur.
2. Ne pas soumettre le sitemap à Google avant que les routes ci-dessous soient
   accessibles en production. Le catalogue et le sitemap lisent le backend
   interne depuis le conteneur client.
3. `soukiapp.com` nécessite son propre DNS et un certificat TLS couvrant ce
   domaine avant de pouvoir vérifier une redirection HTTPS 308 vers
   `https://souki.io`. Ces éléments ne figurent pas dans ce dépôt local.

## Contrôles après le déploiement

- `https://souki.io/robots.txt` : réponse 200, `Content-Type: text/plain`, lien
  vers `https://souki.io/sitemap.xml` ; les assets `/_next/` restent crawlables.
- `https://souki.io/sitemap.xml` : réponse 200, XML valide ; les URLs produit
  correspondent aux produits actifs de l'API et répondent en 200.
- Source HTML de `/`, `/catalogue`, `/a-propos`, `/faq` et d'une page
  `/produit/{slug}` : un seul `<h1>`, titre, description, canonical et contenu
  visible sans exécuter JavaScript.
- Une URL produit inconnue renvoie 404 ; un ancien slug d'un produit actif
  renvoie 308 vers son URL canonique.
- `/checkout`, `/verify`, `/login` et `/parametres` affichent la balise
  `<meta name="robots" content="noindex, nofollow">`. Vérifier aussi les
  sous-domaines admin et livreur.
- Tester une page produit et `/faq` dans le Rich Results Test de Google. Puis
  mesurer `/` et `/catalogue` sur mobile avec PageSpeed Insights. Les cibles du
  plan sont LCP < 2,5 s, INP < 200 ms, CLS < 0,1 et score mobile ≥ 90.
- Dans GA4 DebugView, valider `view_item`, `add_to_cart`, `begin_checkout`,
  `purchase` et `voice_order_used` sur le parcours réel.

Le modèle produit actuel ne contient pas de `updated_at` ; le sitemap ne publie
donc pas de `lastModified` inventé.

## Search Console et suivi

Après les contrôles HTTP : vérifier `souki.io` comme propriété de domaine,
soumettre le sitemap, inspecter l'accueil, le catalogue et plusieurs produits,
puis demander l'indexation des pages clés. Ajouter ensuite `soukiapp.com` comme
seconde propriété, vérifier sa redirection, et importer la propriété dans Bing
Webmaster Tools si souhaité.

Lier GA4 à Search Console, ajouter les UTM aux campagnes et créer la fiche
Google Business Profile en zone desservie pour Fès. Suivre chaque semaine les
clics, impressions, pages indexées et erreurs de crawl ; contrôler les Core Web
Vitals, résultats enrichis et liens entrants chaque mois. Les contenus FR/AR/
Darija, les articles et les liens externes demandent une validation éditoriale.
