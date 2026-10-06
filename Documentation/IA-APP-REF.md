# IA-APP-REF — Plan d'implémentation : panier malin, installation PWA, header, mascotte assistante

> Date : 2026-10-05 · Mise à jour : 2026-10-06 · Statut : quatre phases implémentées, vérifications locales terminées
> Périmètre : `back-end/` (FastAPI) et `apps/client/` (Next.js, PWA)

## Suivi d'implémentation — 6 octobre 2026

- Phase 1 : terminée (`7e4e795`), moteur de composition et garde-fous du panier malin.
- Phase 2 : terminée (`31d3925`), installation PWA et guides visuels.
- Phase 3 : terminée (`15cda8f`), adresse enregistrée et header persistant.
- Phase 4 : terminée, chatbot mascotte avec réponses en flux, questions rapides sans clé, historique de session par utilisateur, quota et fournisseurs Groq / compatible OpenAI / Anthropic. Le catalogue respecte aussi les produits disponibles en précommande. Les flux vides, coupés ou en erreur renvoient une erreur générique.

Validation locale : 41 tests Python ciblés réussis (`test_assistant.py`, `test_basket_composer.py`, `test_ml_panier_groq.py`), TypeScript et build de production client réussis. ESLint ciblé : aucune erreur, un avertissement sur la restauration de session dans un effet React. `node tools/verify-ia-app-ref.cjs` vérifie les largeurs 320/375/430 px, le header au défilement, les réponses rapides, la reprise après 503, le flux Unicode et sa mise en forme, une fenêtre réduite simulant le clavier, la nouvelle conversation, le guide iOS et l'événement d'installation desktop. Captures locales dans `outputs/ia-app-ref/` ; revue visuelle du chat et de l'accueil à 320 px effectuée.

À valider sur appareils réels : clavier et installation Safari/iPhone et Android. Les fournisseurs ont été testés avec des réponses simulées, sans appel payant. Pour activer les réponses libres, configurer `SOUKI_ASSISTANT_API_KEY` et le fournisseur dans l'environnement serveur ; les suggestions restent disponibles sans clé. Aucun déploiement effectué.

## Sommaire

1. [Panier malin : des quantités réalistes pour une famille marocaine](#1-panier-malin--des-quantités-réalistes-pour-une-famille-marocaine)
2. [Bouton « Télécharger l'application »](#2-bouton--télécharger-lapplication-)
3. [Header de l'accueil PWA](#3-header-de-laccueil-pwa)
4. [La mascotte devient une assistante Souki (chatbot)](#4-la-mascotte-devient-une-assistante-souki-chatbot)
5. [Ordre d'exécution et décisions](#5-ordre-dexécution-et-décisions)
6. [Sources](#6-sources)

> Note : le panier malin utilise **Groq** (modèle Llama 3.3 70B, `back-end/services/ml_panier_service.py`), et non Grok (xAI).

---

## 1. Panier malin : des quantités réalistes pour une famille marocaine

### 1.1 Problème constaté

Exemple : un panier équilibré pour 5 personnes avec un budget de 210 DH propose 0,5 kg de pommes de terre, alors qu'une famille de 5 en consomme plusieurs kilos sur la période.

### 1.2 Causes identifiées dans le code

| # | Cause | Emplacement |
|---|---|---|
| 1 | Le prompt ne donne aucune référence de consommation : on demande au modèle d'être « réaliste » sans lui dire combien une famille consomme par jour. Il répartit donc le budget au hasard. | `ml_panier_service.py`, `build_system_prompt` et `_build_user_input` |
| 2 | `_fill_to_budget` réduit toutes les lignes en kg du même facteur (jusqu'à 0,05) quand Llama dépasse le budget. Les pommes de terre tombent alors au minimum de 0,5 kg, comme les produits secondaires. | `ml_panier_service.py`, lignes 565-584 |
| 3 | Le remplissage choisit d'abord les produits les moins chers, pas les produits essentiels. | `ml_panier_service.py`, ligne 539 |
| 4 | Le repli sans IA prend le produit le moins cher de chaque niveau, à 0,5 kg. | `build_catalogue_fallback`, ligne 220 |
| 5 | Aucune hiérarchie entre les produits : pomme de terre, persil ou céleri ont le même poids. | ensemble du service |

### 1.3 Fichier de référence : `back-end/data/paniers-equilibres-maroc.json`

Trois parties :

**a) `normes`** : la consommation par personne et par jour, avec un rôle pour chaque produit. Les valeurs s'appuient sur les chiffres du HCP (environ 138 kg de légumes et 40 kg de fruits par personne et par an, soit environ 0,38 kg de légumes et 0,11 kg de fruits par jour), ajustés aux habitudes marocaines.

| Rôle | Produits | Norme (kg/pers/jour) | Priorité |
|---|---|---|---|
| **Essentiel** | Pommes de terre, Tomates, Oignons | 0,12–0,15 / 0,10–0,12 / 0,07–0,09 | 1 (jamais sacrifié) |
| **Base tajine** | Carottes, Courgettes, Poivrons, Navets | 0,04–0,06 chacun | 2 |
| **Secondaire** | Aubergines, Haricots verts, Petits pois, Chou-fleur… | 0,02–0,04 | 3 |
| **Aromates** | Persil, Coriandre, Menthe, Ail | 1 lot par semaine (ne dépend pas du nombre de jours) | 2 |
| **Fruits** | Oranges, Bananes, Pommes… (selon la saison) | 0,10–0,15 | 3 |

**b) `paniers_reference`** : des compositions types pour 100, 150, 200, 250… jusqu'à 500 DH (pas de 50 DH), pour un foyer de référence de 4 personnes sur 7 jours. Au-delà de 500 DH, on extrapole avec les normes.

**c) `alias`** : pour relier chaque norme au catalogue réel par nom FR ou darija (pas par identifiant figé, puisque le catalogue évolue).

### 1.4 Moteur déterministe : `back-end/services/basket_composer_service.py`

- **Quantité cible** = norme × personnes × jours, arrondie au palier (0,5 kg, lot, 250 g).
- **Ajustement au budget par priorité :**
  - On remplit d'abord les essentiels, puis la base tajine et les aromates, puis le secondaire et les fruits.
  - **Budget trop juste :** on retire d'abord le secondaire et les fruits. On ne descend jamais les essentiels sous leur plancher. On affiche alors un message honnête, par exemple : « Votre budget couvre environ 4 jours pour 5 personnes ».
  - **Budget large :** on ajoute de la variété et des fruits. Chaque produit reste plafonné à environ 1,3 × sa norme haute, donc jamais 15 kg d'oignons. Le panier s'arrête quand les besoins de la famille sont couverts, même s'il reste du budget.

### 1.5 Groq garde son rôle, mais encadré (`ml_panier_service.py`)

- **Prompt :** il reçoit le plan cible du moteur (fourchette min/max par produit) et les 2 paniers de référence les plus proches du budget comme exemples. Llama choisit la variété, la saison et les substitutions.
- **Contrôle après réponse (`_apply_guardrails`) :** chaque quantité est ramenée dans sa fourchette, les essentiels manquants sont ajoutés automatiquement, et une réponse aberrante est rejetée puis corrigée.
- **Remplacements :** `_fill_to_budget` et le repli « produit le moins cher » sont remplacés par le moteur. Sans Groq, le panier reste donc cohérent.
- **Cache :** la clé de cache est versionnée pour vider les anciennes compositions.
- **Mode « plat marocain » :** inchangé. Il ne dépend que du nombre de personnes et n'était pas concerné par le bug.

### 1.6 Exemple attendu : 210 DH, 5 personnes, 7 jours

Prix du catalogue ; prix de la tomate supposé à environ 8 DH (absent du catalogue de démarrage).

| Produit | Quantité | Sous-total |
|---|---|---|
| Pommes de terre | 5 kg | 35 DH |
| Tomates | 4 kg | ≈ 32 DH |
| Oignons | 3 kg | 51 DH |
| Carottes | 2 kg | 20 DH |
| Courgettes | 1,5 kg | 22,5 DH |
| Poivrons | 1 kg | 14 DH |
| Persil + Coriandre | 1 lot chacun | 4,5 DH |
| Oranges | 3 kg | 30 DH |
| **Total** | | **≈ 209 DH** |

### 1.7 Tests

J'étends `back-end/tests/test_ml_panier_groq.py` et j'ajoute un test pour le moteur. Exemples de règles vérifiées :

- 210 DH / 5 personnes / 7 jours donne au moins 4 kg de pommes de terre, 3 kg de tomates et 2,5 kg d'oignons.
- 100 DH / 6 personnes / 14 jours conserve les essentiels et affiche le message de couverture.
- Une réponse Groq avec 0,5 kg de pommes de terre est corrigée.

> ⚠️ **Le catalogue de démarrage n'a pas de tomates et seulement 2 fruits** (oranges, citrons). Le catalogue réel en base sera vérifié. S'il manque des essentiels, le moteur fera sans et le signalera dans les logs.

---

## 2. Bouton « Télécharger l'application »

### 2.1 La contrainte à connaître

**Sur iPhone, aucun site web ne peut installer une application automatiquement.** Apple ne donne pas cette possibilité à Safari : pas d'événement `beforeinstallprompt`, et la nouvelle Web Install API (`navigator.install`) n'existe que sur Chrome et Edge, en phase d'essai. Sur iOS, on ne peut pas éviter le passage par « Partager → Sur l'écran d'accueil », sauf à publier l'app sur l'App Store.

Sur **Android avec Chrome, Samsung Internet ou Edge**, l'installation en un tap fonctionne déjà. Le code actuel (`apps/client/components/souki/pwa-install-prompt.tsx`) la rate souvent, pour deux raisons :

- l'événement d'installation est intercepté seulement une fois React chargé, alors que le navigateur l'envoie souvent avant ;
- la bannière ne s'affiche que si l'écran fait moins de 768 px.

### 2.2 Option A, retenue (gratuite, environ 1 jour)

C'est le maximum possible avec une PWA :

- **Interception immédiate de l'événement Android** : un script dans `<head>` de `apps/client/app/layout.tsx` le capture au tout début. Résultat : 1 tap sur « Télécharger » puis 1 tap sur « Installer ». Si le navigateur propose `navigator.install()`, on l'utilise.
- **Navigateurs intégrés** (Instagram, Facebook, WhatsApp, TikTok) : l'installation y est impossible. Sur Android, le bouton rouvre directement le site dans Chrome via un lien `intent://`. Sur iOS, on affiche « Ouvrir dans Safari » en un écran.
- **iPhone avec Safari ou Chrome** : plus de texte d'instructions. À la place, un écran plein illustré avec une flèche animée qui montre le vrai bouton Partager de l'appareil, en 2 étapes visuelles, sans jargon.
- **Manifest** : ajout de captures d'écran (`apps/client/app/manifest.ts`) pour qu'Android affiche sa fenêtre d'installation enrichie.
- **Fichiers :** un nouveau `apps/client/lib/pwa-install.ts` (détection de la plateforme), une réécriture de `pwa-install-prompt.tsx`, et un composant pour le guide iOS.

### 2.3 Option B, plus tard (seule vraie installation en un tap sur iPhone)

- **Principe :** emballer la PWA en application native (Capacitor ou PWABuilder) et la publier sur l'App Store et Google Play. Le bouton redirige alors vers la fiche de l'app, avec le bouton « Obtenir ».
- **Coûts :** compte Apple Developer à 99 $ par an, Google Play à 25 $ une fois, une compilation sur Mac ou un service cloud, et la revue d'Apple.
- **Risque :** Apple refuse parfois les simples emballages de site web (règle 4.2). Les notifications push de Souki aident à passer ce contrôle.

À envisager si les utilisateurs iPhone représentent une part importante.

---

## 3. Header de l'accueil PWA

### 3.1 Problèmes actuels (`apps/client/app/pwa-welcome/page.tsx`, lignes 383-432)

- **La localisation est codée en dur** : « Fès, Maroc » s'affiche même si l'utilisateur a une autre adresse.
- **La mise en page est fragile** : `justify-between` sur 3 groupes, un décalage manuel du logo (`-left-2`) et un texte sans retour à la ligne (`whitespace-nowrap`). Sur un écran de 320–360 px, la pastille de localisation déborde ou se colle aux icônes.
- **Le bouton profil n'apparaît qu'une fois le prénom chargé**, ce qui fait sauter la mise en page.
- **Tailles et formes incohérentes** : logo de 32 px, pastille de hauteur différente, boutons de 44 px.
- **Le header disparaît au défilement** (effet de parallaxe) et rien ne le remplace : localisation, favoris et profil ne sont plus accessibles.

### 3.2 Proposition

```
┌──────────────────────────────────────────────┐
│ (◉logo)  📍 Livraison à        ▾   (♡³) (👤) │  ← une seule hauteur : 44 px
│          Saïss, Fès                          │
├──────────────────────────────────────────────┤
│ Bonjour 👋 …                       [mascotte] │
│ [ 🔍 Rechercher un produit…              ]   │
└──────────────────────────────────────────────┘
Au défilement, une barre compacte reste collée en haut :
┌──────────────────────────────────────────────┐
│ (◉)  📍 Saïss, Fès ▾                (♡) (👤) │  ← fond vert, flou d'arrière-plan
└──────────────────────────────────────────────┘
```

- **Grille à 3 colonnes** : logo et pastille, puis les icônes. Le logo est placé dans un cercle de 44 px aligné sur les autres boutons. La pastille prend l'espace disponible et coupe le texte avec « … » si besoin.
- **Vraie adresse** : on lit `profile.address` (quartier ou rue, puis ville). Sans adresse, on affiche « Ajouter une adresse ». Un tap mène directement à la section adresse des Paramètres.
- **Profil toujours affiché** : un emplacement réservé pendant le chargement, puis la photo ou l'initiale. Plus de saut de mise en page.
- **Favoris** : pastille de compteur plafonnée à « 9+ ».
- **Barre compacte au défilement** : elle apparaît quand le grand header sort de l'écran.
- **Code** : le header est extrait dans `apps/client/components/souki/pwa/pwa-home-header.tsx` pour alléger `pwa-welcome/page.tsx`, qui fait 822 lignes.
- **Contrôle** : vérification visuelle à 320, 375 et 430 px.

---

## 4. La mascotte devient une assistante Souki (chatbot)

### 4.1 Expérience utilisateur

1. **La mascotte devient cliquable.** Le médaillon en haut à droite de l'accueil PWA (`pwa-welcome/page.tsx`) devient un bouton « Discuter avec Souki ». À la première visite, une petite bulle « Une question ? 👋 » apparaît quelques secondes, puis disparaît.
2. **Le chat s'ouvre en feuille glissante depuis le bas** (environ 85 % de l'écran, via le composant existant `components/souki/pwa/sheet.tsx`), avec :
   - **en-tête :** la mascotte en petit, qui passe à l'expression `explain` pendant qu'elle « écrit » ;
   - **message d'accueil**, puis des **suggestions rapides** : « Comment ça marche ? », « Horaires de livraison », « Frais de livraison », « Moyens de paiement », « C'est quoi le panier malin ? » ;
   - **réponse affichée au fil de l'eau**, mot par mot, avec un indicateur « Souki écrit… » ;
   - **zone de saisie** qui reste visible au-dessus du clavier iPhone et Android ;
   - **bouton « Nouvelle conversation »**. L'historique est gardé le temps de la session.
3. **Langue :** elle répond dans celle de l'utilisateur (français, darija ou arabe), avec le ton chaleureux de la mascotte.

### 4.2 Ce que l'assistante sait

**Un fichier de connaissances, `back-end/data/souki-assistant-connaissances.md`**, construit à partir de sources déjà dans le projet : FAQ, page À propos, cahier des charges, horaires de commande. Il couvre :

- le concept (produits frais du marché de gros de Fès) et l'identité de la marque ;
- les horaires : commande avant 20h, livraison le lendemain entre 8h et 15h ;
- les frais : 15 DH, livraison offerte dès 300 DH ;
- le paiement : à la livraison, Wallet, CMI ;
- les fonctionnalités : panier malin, commande vocale, abonnements, parrainage, favoris, suivi de commande.

Chaque fait sera vérifié dans le code avant d'être écrit.

**Des données en direct ajoutées à chaque conversation :** les produits disponibles aujourd'hui et leurs prix. Elle ne peut donc pas inventer de prix.

### 4.3 Règles fixées côté serveur

- **Sujets autorisés :** Souki, et les questions liées comme les fruits, les légumes ou la cuisine marocaine. Pour le reste, elle refuse poliment et revient vers Souki.
- **Pas d'invention :** si l'information manque, elle le dit et oriente vers le support ou la page concernée.
- **Aucune action :** elle ne passe pas de commande et ne promet pas de remboursement. Pour un problème de commande précis, elle renvoie vers « Suivi de commande ».
- **Résistance aux détournements :** elle ignore les tentatives de lui faire changer de rôle et ne révèle pas ses instructions.

### 4.4 La clé API dans l'environnement

L'assistante lit sa configuration dans `back-end/.env`. Ces lignes vides seront ajoutées à `back-end/.env.example` :

```env
# Assistant mascotte (chatbot Souki)
SOUKI_ASSISTANT_API_KEY=          # clé à ajouter par le responsable du projet
SOUKI_ASSISTANT_PROVIDER=groq     # groq | openai_compatible | anthropic
SOUKI_ASSISTANT_MODEL=            # vide = modèle par défaut du fournisseur
SOUKI_ASSISTANT_BASE_URL=         # seulement pour openai_compatible
```

- **Clé présente :** l'assistante utilise cette clé et ce fournisseur.
- **Clé absente :**
  - pas de plantage : le serveur renvoie « assistante momentanément indisponible » ;
  - le chat reste utile : les suggestions rapides répondent quand même, à partir de réponses prêtes à l'emploi stockées dans le fichier de connaissances, sans appel à l'API.
- **Indépendance :** sa clé est séparée de `GROQ_API_KEY`, ce qui permet de suivre la consommation du chatbot à part et de la couper sans toucher au panier malin.

Fournisseurs pris en charge : Groq (Llama, déjà intégré), Claude (Anthropic), ou tout fournisseur compatible OpenAI (OpenAI, Mistral, xAI Grok…) via `openai_compatible`.

### 4.5 Fichiers

**Back-end :**

- `services/assistant_service.py` : construction des instructions, appel au fournisseur, réponse en flux.
- `controllers/assistant_controller.py` : route `POST /api/assistant/chat`, réservée aux clients connectés.
- **Limites :**
  - quota de 30 messages par heure et par utilisateur via l'outil de quota existant (`services/rate_limit_service.py`) ;
  - 500 caractères maximum par message ;
  - seuls les 10 derniers échanges sont envoyés au fournisseur ;
  - aucun texte de conversation dans les logs.

**Front-end :**

- `components/souki/pwa/mascot-chat-sheet.tsx` (le chat).
- La mascotte rendue cliquable dans le nouveau header (point 3).
- Mise en forme simple des réponses (gras, listes) sans HTML brut.

**Tests :**

- sans clé, la route renvoie 503 et les réponses rapides fonctionnent ;
- quota et longueur des messages respectés ;
- les instructions contiennent bien le catalogue du jour ;
- les questions hors sujet sont gérées (fournisseur simulé).

---

## 5. Ordre d'exécution et décisions

### Ordre

1. **Panier malin** (JSON, moteur, contrôle des réponses Groq, tests).
2. **Installation** (option A).
3. **Header.**
4. **Chatbot mascotte**, après le header, car les deux touchent la même page.

Tout se fait sur une nouvelle branche, avec un commit par point.

### Décisions

| Sujet | Décision |
|---|---|
| Installation | Option A seule pour l'instant ; option B à réévaluer selon la part d'utilisateurs iPhone |
| Budget large du panier malin | Le panier s'arrête quand les besoins de la famille sont couverts, même s'il reste du budget |
| Fournisseur du chatbot | À confirmer (Groq, Claude ou compatible OpenAI) ; les trois sont pris en charge par le code |

---

## 6. Sources

- [Web Install API en phase d'essai sur Chrome et Edge (InfoQ)](https://www.infoq.com/news/2026/03/web-install-api-origin-trial)
- [What PWA Can Do Today, section Installation](https://whatpwacando.today/installation/)
- [MDN : installer et désinstaller une web app](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Developer_guide/Installing)
- [Apple Developer Forums : PWA sur iOS](https://developer.apple.com/forums/thread/762073)
- [Aujourd'hui le Maroc : « Les Marocains consomment mieux » (chiffres HCP)](https://aujourdhui.ma/actualite/les-marocains-consomment-mieux-32841)
- [Hespress : le panier alimentaire marocain](https://fr.hespress.com/412540-412540.html)
