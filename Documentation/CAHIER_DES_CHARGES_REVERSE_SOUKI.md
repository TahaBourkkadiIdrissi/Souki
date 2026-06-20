# Cahier des charges fonctionnel et technique — SOUKI

## Spécification reconstruite par rétro-ingénierie

**Projet :** SOUKI — plateforme AgriTech de produits frais en circuit court  
**Équipe d’origine :** ESISA — AgriDevs  
**Zone de lancement :** Fès, Maroc  
**Version du document :** 1.0  
**Date de référence de l’audit :** 20 juin 2026  
**Nature du document :** cahier des charges reverse, fondé sur le comportement observable du code et sur les livrables de `PFA.zip`

---

## 1. Objet du document

Ce document reconstruit le cahier des charges de SOUKI à partir :

- du dépôt applicatif complet `A:\Users\Desktop\Souki` ;
- des rapports, backlog, documents d’ingénierie, business plan, maquettes et documents de pilotage présents dans `PFA.zip` ;
- des routes API, modèles de données, services métier, interfaces Web et mobile, tests et configurations réellement présents.

Il décrit donc à la fois :

1. le besoin métier ayant conduit au projet ;
2. le périmètre réellement implémenté ;
3. les règles de gestion déduites du code ;
4. l’architecture et les contraintes techniques ;
5. les fonctions seulement amorcées ;
6. les fonctions prévues dans le PFA mais absentes du produit actuel ;
7. les critères de recette permettant de valider une version exploitable.

### 1.1 Convention de statut

| Statut | Signification |
|---|---|
| **Implémenté** | Fonction visible dans le code avec route, service et/ou interface exploitable |
| **Partiel** | Socle présent, mais parcours incomplet ou intégration externe non finalisée |
| **Prévu** | Exigence issue des documents PFA, sans implémentation fonctionnelle complète |
| **Hors périmètre actuel** | Vision ultérieure ne devant pas être présentée comme livrée |

Le présent document distingue volontairement le produit réel de sa vision initiale. En cas de contradiction, le code exécuté constitue la source de vérité pour l’existant, tandis que les documents PFA servent de source pour l’intention et la feuille de route.

---

## 2. Résumé exécutif

SOUKI est une plateforme marocaine de commerce et de logistique de fruits et légumes frais. Son objectif est de rapprocher le marché de gros, les fournisseurs locaux et les consommateurs urbains, avec un modèle de précommande en flux tendu.

La promesse principale est :

> permettre au client de commander des produits frais à prix maîtrisé, puis organiser leur sourcing, leur préparation et leur livraison matinale en limitant les stocks et les invendus.

Le produit analysé dépasse le simple site e-commerce. Il constitue un système multi-acteurs comprenant :

- une application Web responsive et PWA ;
- une API métier FastAPI ;
- une application mobile Expo/React Native ;
- un espace client ;
- un espace parent ;
- un espace livreur ;
- un espace fournisseur ;
- plusieurs espaces administratifs spécialisés ;
- un moteur de panier intelligent ;
- un système d’agrégation JIT par zone ;
- un système de dispatch et de tournées ;
- une gestion du paiement à la livraison ;
- un Wallet SOUKI ;
- un SAV avec remboursement en crédit Wallet ;
- une gestion RBAC des rôles et permissions ;
- des notifications et événements temps réel pour le back-office.

Le cœur fonctionnel actuellement le plus abouti est composé de l’authentification, du catalogue, du panier, du checkout, des commandes, de l’agrégation JIT, de la logistique fournisseur/livreur, de l’administration, du SAV et de la sécurité d’accès.

Les principales fonctions incomplètes sont le paiement CMI réel, la recharge/débit complet du Wallet au checkout, l’automatisation des abonnements parentaux, le parrainage actif, les recettes bidirectionnelles, la liquidation B2B, le bot WhatsApp, le forecasting et la détection de churn.

---

## 3. Contexte et problématique

### 3.1 Constat métier

Les documents PFA identifient plusieurs difficultés du marché urbain des produits frais :

- le déplacement au souk est chronophage ;
- les applications généralistes ajoutent des frais et marges élevés ;
- les plateformes premium ou biologiques restent coûteuses ;
- les intermédiaires augmentent le prix final ;
- la mauvaise anticipation des volumes entraîne invendus et gaspillage ;
- le paiement à la livraison expose l’opérateur aux fausses commandes et refus ;
- les fluctuations quotidiennes des prix de gros menacent la marge ;
- la logistique du dernier kilomètre est difficile à organiser sans regroupement géographique.

### 3.2 Réponse proposée

SOUKI répond à ces contraintes par :

- la précommande ;
- l’achat en flux tendu ;
- l’agrégation automatique des besoins ;
- une marge pilotée par produit ;
- la livraison organisée en tournées ;
- une application accessible sur Web et mobile ;
- une commande manuelle, textuelle ou vocale ;
- un suivi opérationnel multi-rôles ;
- une limitation du risque COD ;
- un remboursement SAV en Wallet plutôt qu’en espèces ;
- l’ouverture de la plateforme à des fournisseurs géolocalisés.

### 3.3 Cible initiale

La cible prioritaire décrite dans le PFA est constituée :

- d’étudiants vivant loin de leur famille ;
- de jeunes actifs urbains ;
- de familles souhaitant approvisionner un enfant ;
- de consommateurs recherchant fraîcheur, prix et gain de temps ;
- de fournisseurs locaux souhaitant proposer leurs produits ;
- de livreurs indépendants disponibles sur les créneaux matinaux.

---

## 4. Objectifs du système

### 4.1 Objectifs métier

- Réduire le gaspillage par l’achat au plus proche de la demande réelle.
- Proposer une facture compétitive face au commerce de détail.
- Centraliser les commandes avant l’approvisionnement matinal.
- Assurer la livraison des commandes sur un créneau matinal.
- Maîtriser le risque lié au paiement à la livraison.
- Maintenir une traçabilité des statuts, paiements, réclamations et actions administratives.
- Développer un réseau de fournisseurs et de livreurs.
- Fournir à l’administration les KPI nécessaires au pilotage.

### 4.2 Objectifs techniques

- Séparer interface, logique métier et persistance.
- Exposer une API REST documentable via OpenAPI/FastAPI.
- Prendre en charge plusieurs interfaces clientes.
- Sécuriser les accès par JWT et RBAC.
- Assurer l’idempotence des événements logistiques sensibles.
- Permettre l’exécution de traitements planifiés.
- Maintenir un fallback lorsque le service de panier intelligent distant est indisponible.
- Stocker les données transactionnelles dans PostgreSQL/Supabase.
- Permettre le suivi temps réel du back-office par WebSocket/outbox.

### 4.3 Indicateurs proposés

| Indicateur | Cible PFA ou cible recommandée |
|---|---|
| Commandes quotidiennes au point mort | au moins 7 |
| Livraison sur créneau matinal | objectif 100 % |
| Taux de commandes correctement agrégées | 100 % des commandes éligibles et rattachées à un fournisseur |
| Perte anticipée JIT | 10 % de buffer |
| Disponibilité API cible | au moins 99,5 % en phase opérationnelle |
| Temps de réponse API standard | inférieur à 1 seconde hors IA et services externes |
| Réclamations traitées dans la fenêtre prévue | 100 % des demandes éligibles |
| Traçabilité des transitions logistiques | 100 % |

---

## 5. Périmètre applicatif

### 5.1 Composants existants

| Composant | Technologie | Rôle |
|---|---|---|
| Frontend Web/PWA | Next.js 16, React 19, TypeScript, Tailwind, Radix UI | Interfaces client, parent, livreur, fournisseur et administration |
| API métier | FastAPI, Python, SQLAlchemy, Pydantic | Authentification, catalogue, commandes, JIT, logistique, Wallet, SAV |
| Application mobile | Expo 56, React Native, Expo Router | Interfaces mobiles client, livreur et administration |
| Base de données | PostgreSQL/Supabase | Données transactionnelles |
| Stockage objet | Supabase Storage | Avatars et médias |
| IA panier | Hugging Face, modèle Gemma personnalisé | Génération de paniers selon budget et profil |
| Planification | APScheduler | Alertes COD, JIT et dispatch quotidien |
| Cartographie | Mapbox | Géolocalisation et affichage des tournées |
| Notifications | SMTP, outbox, WebSocket | OTP, alertes et suivi opérationnel |

L’audit recense environ 34 fichiers d’entités, 105 déclarations de routes HTTP, 33 pages Web et 22 routes/écrans mobiles.

### 5.2 Interfaces Web

Le produit Web comprend notamment :

- accueil et présentation ;
- onboarding ;
- connexion générique et connexions par rôle ;
- vérification OTP ;
- catalogue ;
- panier et checkout ;
- historique des commandes ;
- espace parent ;
- espace livreur ;
- paramètres, sécurité, sessions et Wallet ;
- demande de statut fournisseur ;
- dashboard fournisseur ;
- produits, commandes, préparation et profil fournisseur ;
- dashboard administrateur ;
- clients et fiches clients ;
- blacklist ;
- commandes ;
- exceptions de commandes ;
- livreurs ;
- produits et pricing ;
- fournisseurs ;
- zones JIT.

### 5.3 Application mobile

L’application mobile reprend une partie importante des parcours :

- authentification et vérification ;
- catalogue ;
- checkout ;
- espace parent ;
- espace livreur ;
- paramètres ;
- administration des clients, blacklist, commandes, produits, pricing et livreurs.

L’espace fournisseur complet est principalement présent sur le Web.

---

## 6. Acteurs et droits

### 6.1 Client

Le client peut :

- créer et vérifier un compte ;
- se connecter par identifiants ou Google ;
- gérer son profil et son adresse ;
- consulter le catalogue ;
- créer un panier manuel ;
- demander un panier intelligent ;
- passer une commande textuelle ou vocale ;
- choisir un créneau et un mode de paiement ;
- consulter et masquer son historique ;
- suivre ses commandes ;
- créer un Wallet ;
- gérer ses préférences et sessions ;
- déposer une réclamation éligible ;
- demander à devenir fournisseur.

### 6.2 Parent

Le parent dispose des droits généraux de consultation, profil, checkout et historique. Le modèle de données prévoit une relation parent/enfant et des abonnements.

Le parcours d’abonnement récurrent, la génération automatique de commandes et le paiement mensuel ne sont pas complets dans le produit actuel.

### 6.3 Livreur

Le livreur peut :

- consulter sa tournée du jour ;
- voir le point de ramassage fournisseur ;
- confirmer le ramassage ;
- traiter les livraisons dans l’ordre prévu ;
- produire des événements de statut ;
- confirmer l’encaissement COD ;
- refuser une tournée ;
- déclencher une réaffectation ;
- consulter les coordonnées et informations nécessaires à la livraison.

### 6.4 Fournisseur

Le fournisseur peut :

- déposer une demande avec identité commerciale, adresse et produits ;
- consulter le statut de sa demande ;
- gérer son profil après validation ;
- consulter ses statistiques ;
- consulter ses commandes ;
- consulter la préparation et le picking agrégés ;
- sélectionner des produits du catalogue ;
- créer, modifier, activer ou supprimer ses offres ;
- renseigner prix de gros et stock.

### 6.5 Administrateur et rôles spécialisés

Les rôles présents comprennent :

- `ADMIN` ;
- `ADMIN_SUPER` ;
- `OPS_MANAGER` ;
- `CATALOG_MANAGER` ;
- `FINANCE_MANAGER` ;
- `SUPPORT_AGENT`.

Les permissions couvrent entre autres :

- accès au panneau admin ;
- lecture et gestion des commandes ;
- gestion des livraisons ;
- lecture et modification des produits ;
- lecture des paiements et Wallets ;
- lecture et blacklist des clients ;
- statistiques ;
- validation des fournisseurs ;
- dispatch ;
- traitement des exceptions.

### 6.6 Principe d’autorisation

Chaque route sensible doit vérifier :

- la validité du JWT ;
- l’activité du compte et de la session ;
- le rôle ou la permission requise ;
- lorsque nécessaire, la propriété de la ressource.

L’application doit refuser l’inscription directe en rôle administrateur et diriger les administrateurs vers un espace de connexion distinct.

---

## 7. Exigences fonctionnelles détaillées

## 7.1 Authentification et comptes

### AUTH-01 — Inscription

Le système doit permettre une inscription par email ou téléphone avec mot de passe et rôle utilisateur autorisé.

### AUTH-02 — Validation OTP

- Un code OTP à six chiffres doit être généré.
- Sa durée de validité est de 15 minutes.
- Le code doit être stocké sous forme hashée.
- Le nombre maximal de tentatives est de 5.
- Le renvoi est limité à 3 envois par fenêtre d’une heure.
- L’email est pris en charge par SMTP.
- Le canal téléphone existe dans le modèle, mais l’envoi SMS/WhatsApp réel reste à intégrer.

### AUTH-03 — Connexion

Le système doit accepter email ou téléphone comme identifiant, vérifier le mot de passe hashé et émettre un JWT.

### AUTH-04 — Connexion Google

Le backend doit vérifier le jeton Google avec le client OAuth configuré, créer ou mettre à jour l’utilisateur puis émettre le JWT SOUKI.

### AUTH-05 — Sessions

Le système doit enregistrer le hash du jeton, l’appareil, le navigateur, l’IP, la localisation éventuelle et l’activité de la session. L’utilisateur doit pouvoir révoquer une session ou toutes ses sessions.

### AUTH-06 — Profils de rôle

La vérification ou la connexion doit assurer l’existence du profil associé au rôle : client, parent, livreur ou fournisseur.

### AUTH-07 — Blacklist à l’inscription

Un numéro actuellement blacklisté ne doit pas pouvoir recréer un compte pour contourner la sanction.

---

## 7.2 Profil, adresse et paramètres

### PROF-01 — Informations personnelles

L’utilisateur doit pouvoir consulter et modifier ses informations autorisées.

### PROF-02 — Adresse de livraison

Une adresse comprend :

- rue ;
- quartier ;
- détails d’étage/appartement ;
- ville ;
- code postal ;
- latitude et longitude ;
- indicateur d’adresse par défaut.

### PROF-03 — Géolocalisation

L’interface doit pouvoir associer des coordonnées à l’adresse via Mapbox afin de permettre le zonage et l’optimisation logistique.

### PROF-04 — Avatar

L’utilisateur doit pouvoir envoyer une photo de profil dans Supabase Storage, sous réserve de format et de taille valides.

### PROF-05 — Préférences de notification

Les préférences prévues sont : email, push, SMS, promotions, suivi de commande, newsletter et livraison.

### PROF-06 — Sécurité

Le système doit permettre le changement de mot de passe, la révocation des sessions et la suppression de compte selon les validations métier.

---

## 7.3 Catalogue et produits

### CAT-01 — Consultation

Le catalogue doit afficher les produits actifs avec :

- nom français ;
- nom darija ;
- unité ;
- stock ;
- prix de référence ;
- prix affiché ;
- image ;
- disponibilité.

### CAT-02 — Suggestions

Le catalogue doit pouvoir retourner des produits suggérés en excluant une liste de produits déjà présents.

### CAT-03 — Stock

Une commande ne peut utiliser une quantité supérieure au stock disponible. Le stock doit être décrémenté lors du checkout.

### CAT-04 — Gestion administrative

Les administrateurs autorisés doivent pouvoir :

- créer un produit ;
- modifier les paramètres de prix ;
- désactiver un produit ;
- téléverser ou renseigner une image ;
- recalculer tous les prix.

### CAT-05 — Tarification

Les paramètres comprennent :

- prix de gros saisi ;
- marge cible, par défaut 25 % ;
- coussin de sécurité, par défaut 10 % ;
- niveau produit ;
- volatilité ;
- coefficient de comparaison au marchand.

Pour un produit de niveau 1, le prix est arrondi au dixième supérieur à partir du prix de gros. Pour les autres niveaux, le prix cible est calculé à partir de la marge et du coussin, puis réduit progressivement si le prix obtenu dépasse la référence « khddar ».

---

## 7.4 Panier manuel, textuel, vocal et intelligent

### PAN-01 — Panier manuel

Le client doit sélectionner des produits et quantités positives. Le système calcule les sous-totaux, le poids et le total.

### PAN-02 — Commande textuelle

Le client peut saisir une phrase naturelle décrivant sa commande. Le service interprète les produits et quantités puis renvoie un brouillon vérifiable.

### PAN-03 — Commande vocale

Le client peut envoyer un fichier audio WebM, WAV ou MP3. Le backend encode le contenu et le transmet au service d’interprétation.

### PAN-04 — Traçabilité vocale

La transcription brute, la réponse IA brute, la langue détectée, les quantités demandées, les quantités retenues et les ajustements doivent être persistés.

### PAN-05 — Panier intelligent

Le client peut demander un panier à partir de :

- budget supérieur à 0 et inférieur ou égal à 5 000 DH ;
- nombre de personnes entre 1 et 8 ;
- durée entre 3 et 14 jours ;
- profil de panier.

Le moteur doit choisir des produits réellement actifs et en stock, respecter le budget autant que possible et favoriser un mélange des niveaux 1, 2 et 3.

### PAN-06 — Résilience IA

Le service doit utiliser le modèle Hugging Face configuré. En cas d’indisponibilité, il doit sélectionner la composition locale la plus proche dans le jeu de données, sauf lorsque le mode « modèle distant obligatoire » est activé.

---

## 7.5 Checkout et commande

### CMD-01 — Données obligatoires

Le checkout doit exiger :

- au moins une ligne ;
- un téléphone ;
- une adresse ;
- une ville ;
- des quantités positives ;
- des produits existants ;
- un stock suffisant.

### CMD-02 — Minimum de commande

Le sous-total minimal est de **50 DH**.

### CMD-03 — Frais de livraison

- livraison gratuite à partir de **80 DH** ;
- sinon frais de **10 DH** ;
- une exemption peut être appliquée aux abonnements actifs ou cas B2B.

### CMD-04 — Statut initial

Après validation, la commande est créée au statut `EN_ATTENTE`.

### CMD-05 — Créneau

Le client doit sélectionner ou confirmer un créneau de livraison. Le produit actuel utilise notamment la valeur « Livraison demain » et des créneaux matinaux dans les interfaces.

### CMD-06 — Modes de paiement

Le modèle accepte au minimum :

- COD/cash ;
- Wallet ;
- CMI/carte.

Le paiement CMI est affiché mais désactivé dans l’interface de checkout actuelle. Le checkout enregistre le mode choisi mais ne réalise pas encore une transaction CMI complète.

### CMD-07 — Coupure de commande

Le code prévoit une fenêtre 20 h 00–8 h 00, mais son blocage est désactivé (`ORDER_CUTOFF_ENABLED = False`). L’exigence cible doit être précisée avant production : blocage strict, file d’attente pour le lendemain, ou message informatif.

### CMD-08 — Historique

Le client doit consulter son historique et peut masquer une commande de son propre historique sans supprimer les données opérationnelles.

---

## 7.6 Machine à états de commande

Les transitions autorisées sont :

```text
BROUILLON -> EN_ATTENTE
EN_ATTENTE -> CONFIRMEE | ANNULEE
CONFIRMEE -> VERROUILLEE | ANNULEE
VERROUILLEE -> EN_ATTENTE_LIVREUR | A_LIVRER
EN_ATTENTE_LIVREUR -> A_LIVRER | EN_ROUTE | REFUS_LIVREUR
REFUS_LIVREUR -> EN_ATTENTE_LIVREUR | ANNULEE
A_LIVRER -> EN_ROUTE | RETOUR_DEPOT | REFUS_LIVREUR
EN_ROUTE -> LIVRE | ABSENT | REFUS | RETOUR_DEPOT
RETOUR_DEPOT -> EN_ATTENTE | ANNULEE
```

Les statuts `LIVRE`, `ABSENT`, `REFUS` et `ANNULEE` sont terminaux.

Une exception contrôlée autorise `VERROUILLEE -> CONFIRMEE` lors d’un déverrouillage JIT.

Chaque changement doit :

- vérifier la transition ;
- augmenter `status_version` ;
- horodater les jalons concernés ;
- créer un événement de livraison lorsque l’acteur est un livreur valide ;
- supporter un identifiant client unique pour l’idempotence.

---

## 7.7 JIT et zones

### JIT-01 — Zones

Une zone JIT est définie par une ville, un centre géographique, un rayon, un fournisseur éventuel et un statut actif.

### JIT-02 — Éligibilité

Le traitement sélectionne les commandes du jour aux statuts `EN_ATTENTE` ou `CONFIRMEE`.

### JIT-03 — Agrégation

Pour chaque produit :

- additionner les quantités commandées ;
- calculer un buffer de perte de 10 % ;
- arrondir le volume final au kilogramme supérieur ;
- calculer chiffre d’affaires, coût d’achat et marge estimée.

### JIT-04 — Fournisseur

Avant verrouillage, la commande doit être rattachée à un fournisseur résolu selon sa zone et les offres disponibles. Une commande sans fournisseur doit rester dans le backlog d’exceptions administratives.

### JIT-05 — Verrouillage

Les commandes éligibles sont confirmées si nécessaire, puis passent à `VERROUILLEE`.

### JIT-06 — Exécution régionale

Chaque zone active est traitée dans une transaction indépendante. L’échec d’une zone ne doit pas bloquer les autres.

### JIT-07 — Journalisation

Chaque traitement enregistre :

- zone ;
- date ;
- volumes ;
- nombre de commandes ;
- nombre d’abonnements ;
- statut ;
- message d’alerte ;
- détails produits.

### JIT-08 — Relance

Une zone déjà exécutée le même jour ne doit pas être relancée sans déverrouillage explicite.

---

## 7.8 Fournisseurs

### FOUR-01 — Candidature

Un utilisateur doit pouvoir demander le statut fournisseur avec :

- nom commercial ;
- téléphone ;
- adresse ;
- ville et code postal ;
- coordonnées ;
- description ;
- sélection initiale de produits.

### FOUR-02 — Cycle de validation

Les états attendus sont `PENDING`, `APPROVED`, `REJECTED` et `SUSPENDED`. Un rejet doit comporter un motif.

### FOUR-03 — Gestion administrative

L’administration doit lister, rechercher, filtrer, valider, rejeter, suspendre et réactiver les fournisseurs.

### FOUR-04 — Offres

Le fournisseur validé doit gérer ses produits, prix de gros, stock et disponibilité.

### FOUR-05 — Préparation

Le fournisseur doit recevoir :

- les commandes qui lui sont rattachées ;
- les lignes à préparer ;
- une liste de picking agrégée ;
- les informations de créneau utiles ;
- l’état de préparation.

---

## 7.9 Dispatch et tournées

### LOG-01 — Déclenchement

Le dispatch quotidien traite les commandes verrouillées et éligibles à la livraison.

### LOG-02 — Allocation fournisseurs/livreurs

Les commandes sont groupées par fournisseur. Les livreurs disponibles sont répartis proportionnellement aux volumes, avec au moins un livreur par fournisseur lorsque l’effectif le permet.

### LOG-03 — Point de ramassage

Chaque tournée peut porter les coordonnées, l’adresse et l’identité du fournisseur de ramassage.

### LOG-04 — Ordonnancement

Les arrêts sont ordonnés par proximité selon une heuristique gloutonne utilisant la distance de Haversine. Les commandes sans coordonnées sont placées après celles géolocalisées.

### LOG-05 — Tournée

Une tournée contient :

- date ;
- livreur ;
- fournisseur ;
- statut ;
- distance totale ;
- point de ramassage ;
- heure de ramassage ;
- commandes et ordre de passage.

### LOG-06 — Réaffectation

L’administration peut réaffecter une commande à une autre tournée.

### LOG-07 — Exceptions

Les commandes sans fournisseur, sans tournée ou bloquées par une anomalie doivent apparaître dans un écran d’exception avec actions de rattachement, replanification, annulation ou réaffectation.

---

## 7.10 Parcours livreur

### LIV-01 — Disponibilité

La tournée du jour devient accessible à partir de **7 h 00**, heure du Maroc.

### LIV-02 — Ramassage

Le livreur confirme le ramassage chez le fournisseur. L’opération est idempotente et fait passer les commandes `EN_ATTENTE_LIVREUR` à `A_LIVRER`.

### LIV-03 — Événements

Le livreur peut faire évoluer une commande vers les statuts permis, notamment `EN_ROUTE`, `LIVRE`, `ABSENT`, `REFUS` ou `RETOUR_DEPOT`.

### LIV-04 — Contrôle de concurrence

Les événements doivent utiliser `status_version` et un identifiant unique du client mobile afin d’éviter les doubles clics, doublons réseau et mises à jour concurrentes.

### LIV-05 — Encaissement COD

Une commande COD doit être marquée comme encaissée avant ou pendant sa clôture selon le parcours retenu. La confirmation est idempotente et notifiée au back-office.

### LIV-06 — Refus de tournée

Le livreur peut refuser la tournée avant démarrage. Les commandes sont libérées, repassent en attente de livreur et doivent être réaffectées.

### LIV-07 — Fin de journée

Les commandes encore `A_LIVRER` ou `EN_ROUTE` après leur jour de tournée passent à `RETOUR_DEPOT`, sont détachées de la tournée et génèrent une anomalie.

---

## 7.11 COD, blacklist et risque client

### COD-01 — Confirmation administrative

Le back-office doit afficher les commandes COD verrouillées et permettre une confirmation individuelle ou en lot.

### COD-02 — Alerte

Une alerte COD est planifiée à 18 h 00.

### COD-03 — Restriction

Un client blacklisté ne peut plus passer de commande COD. Il peut toutefois utiliser un mode prépayé lorsque celui-ci est réellement opérationnel.

### COD-04 — Journal

Chaque confirmation COD doit conserver commande, administrateur, statut et date.

### BL-01 — Blacklist

L’administration doit pouvoir blacklister ou lever la blacklist avec motif, source et traçabilité.

### BL-02 — Rapport

Le back-office doit fournir des statistiques mensuelles par client, livreur, quartier et commande refusée.

---

## 7.12 SAV et Wallet

### SAV-01 — Éligibilité

Une réclamation n’est possible que :

- sur une commande `LIVRE` ;
- dans les 24 heures suivant la livraison ;
- sur une ligne appartenant à la commande ;
- pour une quantité positive ne dépassant pas la quantité livrée.

### SAV-02 — Motifs

Les motifs acceptés sont : produit abîmé, poids incorrect, erreur de produit, produit manquant, qualité ou autre.

### SAV-03 — Remboursement

Le montant est calculé proportionnellement à la quantité réclamée et crédité dans le Wallet SOUKI.

### SAV-04 — Détection de suspicion

À partir du troisième signalement récent dans une fenêtre de 30 jours, la réclamation est marquée suspecte et une alerte prioritaire est envoyée au back-office.

### WAL-01 — Activation

L’utilisateur peut créer un Wallet protégé par un mot de passe fort. Un code unique est généré et affiché intégralement une seule fois.

### WAL-02 — Consultation

L’utilisateur peut consulter son solde et l’historique de ses transactions.

### WAL-03 — Crédit

Le crédit du Wallet est utilisé par le SAV et journalisé.

### WAL-04 — Limites actuelles

La recharge par CMI, le débit transactionnel du Wallet pendant le checkout et le paiement mixte ne sont pas finalisés. Ils doivent être considérés comme exigences futures, et non comme fonctions livrées.

---

## 7.13 Administration et supervision

Le back-office doit proposer :

- KPI globaux ;
- chiffre d’affaires par mode de paiement ;
- commandes par statut ;
- volumes et tendances ;
- clients et fiches détaillées ;
- blacklist et rapports ;
- commandes du jour et historique ;
- confirmation COD ;
- fournisseurs ;
- produits et pricing ;
- zones JIT ;
- exécution et logs JIT ;
- tournées et dispatch ;
- anomalies ;
- commandes en exception ;
- suivi temps réel des changements de livraison.

Le WebSocket d’administration doit authentifier le jeton, accepter un curseur temporel et diffuser les changements issus de l’outbox.

---

## 8. Traitements planifiés

| Heure Maroc | Traitement | Résultat |
|---|---|---|
| 18 h 00 | Alerte COD | Mise à jour de l’état d’alerte pour les commandes à confirmer |
| 20 h 00 | Agrégation JIT | Volumes, rattachement fournisseur, verrouillage et logs |
| 21 h 35 | Dispatch quotidien | Création et attribution des tournées |

Le scheduler est activé par défaut et peut être désactivé par configuration.

---

## 9. Modèle de données fonctionnel

### 9.1 Identité et sécurité

- Utilisateur
- Rôle
- Permission
- Rôle utilisateur
- Permission de rôle
- Code de vérification
- Session utilisateur
- Préférences de notification

### 9.2 Clients

- Client
- Parent
- Adresse
- Abonnement
- Historique de blacklist

### 9.3 Commerce

- Produit
- Produit B2B
- Fournisseur
- Offre fournisseur-produit
- Panier
- Ligne de panier
- Commande
- Brouillon de commande vocale
- Ligne de commande vocale
- Paiement

### 9.4 Logistique

- Zone JIT
- Log JIT
- Livreur
- Tournée
- Événement de livraison
- Anomalie logistique
- Outbox de notification

### 9.5 Finance et SAV

- Wallet SOUKI
- Wallet historique/legacy
- Transaction Wallet
- Réclamation
- Log de confirmation COD

### 9.6 Relations principales

```text
Utilisateur
  -> profils Client / Parent / Livreur / Fournisseur
  -> Adresses
  -> Sessions
  -> Rôles et permissions
  -> Wallet

Client
  -> Paniers
  -> Commandes
  -> Réclamations
  -> Blacklist

Commande
  -> Panier -> Lignes -> Produits
  -> Fournisseur
  -> Livreur
  -> Tournée
  -> Paiement
  -> Événements
  -> Anomalies

Fournisseur
  -> Offres produits
  -> Zones JIT
  -> Commandes
  -> Tournées de ramassage
```

---

## 10. Architecture technique

### 10.1 Backend en couches

```text
Contrôleurs FastAPI
        |
Services métier
        |
Interfaces / contrats
        |
DAO SQLAlchemy
        |
Entités PostgreSQL
```

Cette séparation doit être maintenue pour les nouvelles fonctions. Les contrôleurs ne doivent pas porter les règles métier complexes.

### 10.2 Démarrage

Au démarrage, l’API :

1. vérifie la connexion à la base ;
2. crée les tables manquantes ;
3. exécute les synchronisations de schéma ;
4. initialise rôles et permissions ;
5. initialise le catalogue ;
6. prépare le stockage Supabase ;
7. charge éventuellement le moteur ML ;
8. démarre le scheduler.

### 10.3 Frontend

Le frontend utilise l’App Router de Next.js, un contexte d’authentification, des hooks métier et une bibliothèque de composants. Une route proxy interne relaie les appels vers le backend.

### 10.4 Mobile

L’application mobile utilise Expo Router, Secure Store, React Query, Zustand, Supabase et Mapbox. Les jetons sensibles doivent être stockés dans Secure Store plutôt que dans un stockage non chiffré.

---

## 11. API fonctionnelle

Les groupes de routes comprennent :

- `/auth` : inscription, connexion, admin, OTP, Google, utilisateur courant ;
- `/profile` et `/api/user` : profil, adresse, photo, notifications, sécurité, sessions, Wallet ;
- `/api/catalogue` : catalogue et suggestions ;
- `/api/manual-basket`, `/api/text-basket`, `/api/voice-basket`, `/api/paniers` : paniers ;
- `/api/checkout` : validation de commande ;
- `/api/commandes` : détail, historique, COD ;
- `/api/v1/claims` : réclamations ;
- `/api/jit` : zones, agrégation, exécution et logs ;
- `/api/supplier` : profil, statistiques, commandes et préparation ;
- `/api/supplier/products` : offres produits ;
- `/api/admin/suppliers` : validation fournisseur ;
- `/api/livreur` : tournée, ramassage, événements, refus et COD ;
- `/api/v1/admin/dispatch` : dispatch et réaffectation ;
- `/api/v1/admin/anomalies` : résolution d’anomalies ;
- `/api/admin` et `/admin` : clients, dashboard, blacklist et temps réel ;
- `/api/produits` : administration et pricing ;
- `/api/admin/zones` : gestion des zones ;
- `/api/admin/commandes` : exceptions.

Toutes les routes métier doivent renvoyer des statuts HTTP cohérents : 400 pour règle métier invalide, 401 pour absence d’authentification, 403 pour accès refusé, 404 pour ressource absente, 409 pour conflit d’état/idempotence et 422 pour données invalides.

---

## 12. Exigences non fonctionnelles

### 12.1 Sécurité

- Secrets exclusivement en variables d’environnement.
- Hash bcrypt pour les mots de passe, OTP et mots de passe Wallet.
- JWT avec expiration configurable.
- RBAC appliqué côté serveur.
- Validation stricte des fichiers envoyés.
- CORS limité aux origines autorisées.
- Révocation des sessions.
- Journalisation des opérations sensibles.
- HTTPS obligatoire en production.
- Aucun secret dans le frontend public.

### 12.2 Performance

- Objectif standard inférieur à 1 seconde.
- Les appels IA et services externes doivent avoir un timeout.
- Le backend ajoute un en-tête `X-Process-Time-ms`.
- Les requêtes dépassant le seuil configurable doivent être journalisées.
- Les listes administratives doivent être paginées.
- Les colonnes utilisées pour recherche et jointure doivent être indexées.

### 12.3 Disponibilité et résilience

- Fallback local pour le panier IA.
- Transactions séparées par zone JIT.
- Idempotence des événements livreur.
- Outbox pour découpler notifications et transactions.
- Possibilité de désactiver les bootstraps et traitements planifiés.
- Procédure de reprise pour les commandes en exception.

### 12.4 Compatibilité et ergonomie

- Responsive mobile, tablette et bureau.
- PWA installable.
- Interface en français, avec données produit en darija.
- États de chargement, vide, erreur et succès.
- Navigation adaptée au rôle.
- Formulaires accessibles au clavier.
- Contraste et libellés explicites.

### 12.5 Maintenabilité

- Architecture contrôleur/service/DAO.
- DTO Pydantic pour les échanges.
- Interfaces pour les contrats métier.
- Tests automatisés des règles critiques.
- Migrations versionnées.
- Documentation des variables d’environnement.
- Mise à jour progressive des validateurs Pydantic V1 dépréciés.

---

## 13. Intégrations externes

### 13.1 PostgreSQL/Supabase

Base transactionnelle principale et stockage objet. Les migrations doivent être exécutées de manière contrôlée en production.

### 13.2 Hugging Face

Le modèle par défaut est `TahaBDI/gemma-2-2b-panier-merged`. L’intégration nécessite un jeton HF et une URL d’inférence. Le fallback local doit rester disponible.

### 13.3 Google

Google OAuth est utilisé pour l’authentification sociale. Des fonctions Gemini existent dans le code historique, mais le moteur de panier principal actuel repose sur Hugging Face et le fallback local.

### 13.4 Mapbox

Mapbox fournit l’affichage cartographique et la géolocalisation. Les jetons Web, mobile et téléchargement natif doivent être séparés.

### 13.5 SMTP

SMTP sert à l’OTP et aux alertes. En absence de configuration, l’environnement de développement affiche l’OTP dans le terminal ; ce comportement doit être interdit en production.

### 13.6 CMI

CMI est une intégration prévue par le PFA. L’interface indique actuellement que le paiement est désactivé. L’intégration future devra couvrir redirection, signature, callback, idempotence, rapprochement et gestion d’échec.

---

## 14. État d’implémentation par rapport au PFA

| Fonction PFA | État constaté | Commentaire |
|---|---|---|
| Authentification email/téléphone | Implémenté | OTP, JWT, sessions |
| Google OAuth | Implémenté | Vérification serveur |
| Catalogue dynamique | Implémenté | Stock, images, prix |
| Panier manuel | Implémenté | Calcul et persistance |
| Commande textuelle/vocale | Implémenté | Audio et texte |
| Panier IA | Implémenté | Hugging Face + fallback |
| Checkout COD | Implémenté | Stock, minimum et frais |
| CMI | Partiel | Présent dans modèle/UI, désactivé |
| Wallet | Partiel avancé | Activation, solde, crédit SAV ; recharge/débit checkout incomplets |
| JIT 20 h 00 | Implémenté | Global et régional |
| Gestion des zones | Implémenté | CRUD et résolution géographique |
| Gestion fournisseurs | Implémenté | Demande, validation, produits, préparation |
| Dispatch | Implémenté | Tournées et réaffectations |
| Interface livreur | Implémenté | Ramassage, événements, COD, refus |
| Suivi temps réel | Implémenté/partiel | WebSocket back-office et outbox |
| COD téléphonique | Implémenté | Individuel, lot, alerte |
| Blacklist | Implémenté | Blocage COD et rapports |
| SAV Wallet | Implémenté | Fenêtre 24 h et suspicion |
| Abonnement parental | Partiel | Entité et lecture, pas de cycle complet |
| Parrainage | Partiel faible | Champ présent, pas de workflow |
| Recettes bidirectionnelles | Prévu | Non identifié dans le cœur applicatif |
| Substitution abonnement | Prévu | Pas de moteur complet |
| Liquidation B2B à 13 h | Partiel faible | Entité B2B sans parcours complet |
| WhatsApp fail-over | Prévu | Non intégré |
| Forecasting | Prévu | Non intégré |
| Churn detection | Prévu | Non intégré |
| CI/CD | Non vérifié/à compléter | Aucun pipeline actif constaté dans le périmètre lu |

---

## 15. Critères de recette

### 15.1 Authentification

- Un utilisateur non vérifié ne peut pas se connecter localement.
- Un OTP expiré ou dépassant le nombre d’essais est refusé.
- Un client ne peut pas accéder à une route admin.
- Une session révoquée ne doit plus être acceptée.

### 15.2 Commande

- Un panier vide est refusé.
- Une quantité négative ou supérieure au stock est refusée.
- Un sous-total inférieur à 50 DH est refusé.
- À 80 DH ou plus, les frais de livraison sont nuls.
- En dessous de 80 DH, les frais sont de 10 DH.
- Une commande validée crée panier, lignes et commande dans une transaction cohérente.

### 15.3 JIT

- Seules les commandes du jour éligibles sont agrégées.
- Le buffer de 10 % est appliqué et arrondi au supérieur.
- Une commande sans fournisseur apparaît en exception et n’est pas verrouillée.
- Une zone ne peut pas être exécutée deux fois sans action explicite.
- L’échec d’une zone n’annule pas les autres zones.

### 15.4 Logistique

- Une tournée n’est pas visible avant 7 h.
- Un autre livreur ne peut pas modifier la tournée.
- Le ramassage est idempotent.
- Un événement dupliqué ne crée pas deux transitions.
- Une transition interdite renvoie un conflit.
- Une commande non livrée en fin de journée génère un retour dépôt et une anomalie.

### 15.5 SAV

- Une commande non livrée n’est pas réclamable.
- Une réclamation après 24 h est refusée.
- Le remboursement est proportionnel et crédité au Wallet.
- Une quantité réclamée supérieure à la quantité livrée est refusée.
- Les réclamations répétées sont signalées.

### 15.6 Fournisseur

- Un fournisseur en attente ne dispose pas des droits d’un fournisseur validé.
- Un rejet nécessite un motif.
- Un fournisseur ne peut gérer que ses offres.
- Le picking reflète les commandes qui lui sont rattachées.

---

## 16. Qualité constatée

La suite backend exécutée pendant l’audit produit :

- **70 tests réussis** ;
- **6 sous-tests réussis** ;
- **22 avertissements**, principalement liés à des API Pydantic V1 dépréciées.

Les contrôles `eslint` Web et `tsc --noEmit` mobile n’ont pas pu être lancés, car les exécutables locaux correspondants ne sont pas disponibles dans les installations Node présentes. Cela doit être corrigé par une installation reproductible des dépendances puis intégré à la CI.

Les tests existants couvrent notamment :

- résolution de zones ;
- affectation fournisseur ;
- ramassage livreur ;
- JIT régional ;
- produits fournisseur ;
- logistique bout en bout ;
- dispatch ;
- cloisonnement des accès ;
- exceptions administratives.

---

## 17. Déploiement et exploitation

### 17.1 Environnements

Au minimum :

- développement local ;
- recette/staging ;
- production.

Les bases, clés OAuth, buckets, URL API, origines CORS et tokens Mapbox/Hugging Face doivent être distincts.

### 17.2 Variables principales

- connexion PostgreSQL ;
- `SECRET_KEY` et paramètres JWT ;
- `GOOGLE_CLIENT_ID` ;
- `SUPABASE_URL` ;
- `SUPABASE_SERVICE_ROLE_KEY` ;
- paramètres SMTP ;
- `HF_TOKEN` et paramètres ML ;
- origines frontend ;
- coordonnées du dépôt ;
- tokens Mapbox ;
- options de bootstrap et scheduler.

### 17.3 Observabilité

Le système cible doit centraliser :

- logs API ;
- temps de réponse ;
- erreurs 4xx/5xx ;
- exécutions JIT ;
- résultats de dispatch ;
- taille de l’outbox ;
- échecs SMTP et services externes ;
- commandes sans fournisseur ;
- anomalies non résolues ;
- événements COD et Wallet.

### 17.4 Sauvegarde

- sauvegarde quotidienne PostgreSQL ;
- politique de conservation ;
- test de restauration ;
- conservation séparée des médias ;
- journal des migrations.

---

## 18. Risques et mesures

| Risque | Impact | Mesure |
|---|---|---|
| Prix de gros volatil | Marge | Pricing par niveau, coussin, suivi quotidien |
| Commande COD refusée | Perte | Confirmation, blacklist, modes prépayés |
| Fournisseur introuvable | Commande bloquée | Backlog d’exception et rattachement manuel |
| Livreur indisponible | Retard | Réaffectation et refus de tournée |
| Mauvaises coordonnées | Tournée dégradée | Validation d’adresse et correction admin |
| Service IA indisponible | Panier intelligent bloqué | Fallback local |
| Double événement mobile | Statut incohérent | Idempotence et version |
| Paiement CMI incomplet | Risque financier | Maintenir désactivé jusqu’à recette bancaire |
| SMS non intégré | Vérification téléphone limitée | Fournisseur SMS/WhatsApp officiel |
| Scheduler exécuté sur plusieurs instances | Doubles traitements | Verrou distribué ou worker unique |
| Synchronisation de schéma au démarrage | Risque production | Remplacer par migrations contrôlées |
| Secrets mal gérés | Compromission | Coffre de secrets et rotation |
| Dépendances frontend incomplètes | Build non reproductible | Lockfile unique et CI propre |

---

## 19. Backlog recommandé

### Priorité P0 — Mise en production sûre

1. Fixer la règle de coupure des commandes.
2. Garantir qu’un seul scheduler exécute les jobs.
3. Reconstituer une installation Node reproductible.
4. Ajouter lint, typecheck et build à la CI.
5. Finaliser la configuration production des emails et notifications.
6. Auditer les secrets et retirer tout affichage d’OTP en production.
7. Remplacer les synchronisations opportunistes de schéma par des migrations.
8. Ajouter tests E2E checkout → JIT → dispatch → livraison → SAV.

### Priorité P1 — Finalisation métier

1. Finaliser le débit Wallet au checkout.
2. Ajouter recharge Wallet et journal financier complet.
3. Intégrer CMI avec callbacks idempotents.
4. Finaliser abonnements parentaux et commandes récurrentes.
5. Automatiser notifications client réelles.
6. Améliorer le suivi de préparation fournisseur.
7. Ajouter preuve de livraison et notation.

### Priorité P2 — Croissance

1. Parrainage.
2. Recettes et suggestions bidirectionnelles.
3. Liquidation B2B.
4. Substitution des paniers d’abonnement.
5. Promotions et segmentation.
6. Reporting financier et marge réelle.

### Priorité P3 — Vision

1. Bot WhatsApp de secours.
2. Prévision de demande.
3. Détection de churn.
4. Pricing prédictif.
5. Expansion multi-ville et multi-dépôt.
6. Découpage progressif en services si les volumes le justifient.

---

## 20. Livrables attendus pour considérer le projet complet

- code Web, API et mobile versionné ;
- schéma de base et migrations ;
- documentation d’installation ;
- documentation API OpenAPI ;
- matrice rôles/permissions ;
- jeux de données de démonstration ;
- procédure JIT et dispatch ;
- procédure de traitement des exceptions ;
- manuel client ;
- manuel fournisseur ;
- manuel livreur ;
- manuel administrateur ;
- rapport de tests ;
- rapport de sécurité ;
- procédure de sauvegarde/restauration ;
- plan de déploiement ;
- plan de maintenance ;
- registre des limites connues.

---

## 21. Conclusion

Le code analysé matérialise déjà un MVP avancé et cohérent de plateforme AgriTech multi-acteurs. Son identité fonctionnelle réelle est celle d’un système de commerce frais en flux tendu, enrichi par un moteur de panier intelligent, une orchestration JIT régionale, une place fournisseur, une logistique de tournées et un back-office opérationnel.

La priorité n’est plus de définir le produit de zéro, mais de stabiliser le périmètre existant, fermer les parcours financiers encore incomplets, industrialiser le déploiement et distinguer clairement les fonctions livrées de la vision PFA.

Ce cahier des charges doit servir de référence pour :

- la présentation académique ;
- la recette fonctionnelle ;
- la priorisation du backlog ;
- la poursuite du développement ;
- l’intégration de nouveaux membres ;
- la préparation d’une mise en production pilote à Fès.

---

## Annexe A — Sources analysées

- code source backend, frontend et mobile du projet SOUKI ;
- schémas SQLAlchemy, Prisma et SQL ;
- tests backend ;
- documents d’architecture et de conception du dépôt ;
- rapport PFA SOUKI ;
- backlog GitHub PFA ;
- business plan ;
- livrables du pôle Ingénierie & Technologie ;
- livrables du pôle Pilotage & Gestion de Projet ;
- documents de design et palettes présents dans l’archive.

## Annexe B — Glossaire

| Terme | Définition |
|---|---|
| JIT | Just-In-Time, agrégation et achat au plus proche de la demande |
| COD | Cash on Delivery, paiement à la livraison |
| CMI | Centre Monétique Interbancaire |
| RBAC | Contrôle d’accès par rôles et permissions |
| PWA | Application Web installable |
| Outbox | File transactionnelle d’événements à diffuser |
| Dispatch | Création et affectation des tournées |
| Picking | Liste consolidée des produits à préparer |
| Wallet | Portefeuille interne SOUKI |
| Fallback | Solution locale utilisée lorsque le service principal est indisponible |
