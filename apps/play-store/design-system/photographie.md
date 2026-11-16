# Photographie

La photo est ce qui donne faim. C'est elle, plus que la couleur ou la typographie, qui fait qu'une app de marché paraît « délicieuse ». Cette section est le brief de la séance photo et la règle d'usage des images dans l'app.

## Ce qui existe aujourd'hui

- **32 photos de légumes** du site, détourées pour l'app dans `kit/produits` (fond transparent, cadrage et taille homogènes). Elles servent de base aux maquettes.
- **Les images du catalogue** (`packages/shared/src/catalogue.ts`) sont des photos Pixabay prises en ambiance, toutes différentes de lumière et de cadrage. Elles ne conviennent ni aux cartes ni à la fiche produit.
- **Il manque** les fruits (Oranges, Citrons) et les herbes (Menthe fraîche, Persil, Coriandre). L'oignon photographié est jaune alors que le catalogue vend des oignons rouges.

## Direction

- **Un produit seul, de face, à hauteur de table** (angle de 15 à 25°), centré, qui occupe 75 à 80 % du cadre.
- **Lumière du matin** : une source douce latérale (fenêtre ou boîte à lumière à gauche, à 45°), un réflecteur blanc à droite. Pas de flash direct, pas de reflets brûlés.
- **Le produit tel qu'il arrive** : frais, quelques gouttes d'eau autorisées, feuilles et tiges gardées (fanes de carottes, pédoncules de tomates). Pas de cire, pas de produit parfait de banque d'images.
- **Une seule ombre**, douce, posée sous le produit. L'app ajoute la sienne : la photo livrée est détourée sans ombre.
- **Couleurs justes** : balance des blancs à la charte grise, profil sRGB. Les verts ne doivent pas tirer vers le jaune.
- **À éviter** : mains, couteaux, planches, assiettes, nappes, props, texte ; filtres, vignettage, saturation poussée.

## Livrables par produit

| Fichier | Format | Usage |
|---|---|---|
| `<slug>.png` | 2048 × 2048 px, fond transparent, sRGB | Source |
| `<slug>@1024.webp` | 1024 px, transparent, qualité 85 | Fiche produit |
| `<slug>@512.webp` | 512 px, transparent, qualité 85 | Cartes, panier, listes |

Le `<slug>` est le nom du catalogue en minuscules sans accents : `pommes-de-terre`, `oignons-rouges`, `menthe-fraiche`. Une variante « coupée » (tomate en deux, oignon en quartiers) est la bienvenue pour la fiche produit, en second visuel.

## Liste de prise de vue

**Légumes (20)** : Pommes de terre, Oignons rouges, Tomates, Carottes, Courgettes, Piments, Aubergines, Concombres, Poivrons (rouge, vert et jaune ensemble), Haricots verts, Laitue, Épinards, Ail, Betteraves, Radis, Navets, Céleri, Brocoli, Chou-fleur, Petit pois.

**Herbes (3)**, en lot attaché : Menthe fraîche, Persil, Coriandre.

**Fruits (2)** : Oranges, Citrons.

**Ambiance (8 à 10 images, en plein cadre, pas détourées)** : le marché de gros de Fès à l'aube ; des cagettes pleines ; les mains du marchand qui choisit ; un panier SOUKI prêt à partir ; la livraison à une porte de Fès ; une table familiale avec un tajine de légumes. Elles servent à l'intro, à l'onboarding, à l'état « fermé de nuit » et à la fiche Google Play. Les personnes photographiées signent une autorisation de droit à l'image.

## Règles dans l'app

- Une photo produit se pose toujours sur `photo-bg`, jamais sur blanc pur ni sur une couleur de marque.
- Ombre de l'app : `drop-shadow(0 6px 6px rgba(20, 60, 30, .16))`, la même partout.
- Produit épuisé : photo en niveaux de gris à 45 % d'opacité, jamais masquée.
- Pas de photo d'ambiance dans les cartes produit, pas de photo produit dans les en-têtes.
- Une photo ne montre que ce qui est vendu : la quantité et la variété correspondent à l'unité (un lot de menthe, 250 g d'ail).
