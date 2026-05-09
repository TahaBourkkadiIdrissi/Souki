# SOUKI — Stratégie Pricing & Psychologie des Prix
> Fès, Maroc — 2026
> Marge nette cible : 25-35%
> Modèle : Zéro Gaspillage / Flux Tendu JIT

---

## Table des Matières

1. [Fondation — L'Avantage Structurel SOUKI](#1-fondation)
2. [Les 3 Niveaux de Catalogue](#2-les-3-niveaux)
3. [Le Coussin de Sécurité](#3-coussin-de-securite)
4. [Stratégie Livraison](#4-strategie-livraison)
5. [Psychologie des Prix](#5-psychologie-des-prix)
6. [Matrice par Segment](#6-matrice-par-segment)
7. [Projection Marge Nette](#7-projection-marge-nette)
8. [Règles Absolues](#8-regles-absolues)

---

## 1. Fondation — L'Avantage Structurel SOUKI

Le khddar achète 100 kg pour en vendre 75 (15-25% invendus).
SOUKI avec le JIT achète exactement ce qui est commandé.
Cette efficacité seule donne 15-20% de marge "gratuite" avant même de fixer les prix.

### Formule Coût Réel
```
Coût réel = (Prix gros × poids caisse + 4 DH porteur) ÷ (poids caisse - 10% perte)
```

### Structure de Coûts Fixes
```
Livraison (1 livreur salarié) : ~6 DH/commande (base 30 cmd/jour)
Emballage                     : ~5 DH/commande
CMI 2%                        : si paiement digital
─────────────────────────────────────────────────
Frais ops totaux              : 12-15% du panier
```

### Règle Absolue
```
Prix affiché SOUKI < Prix khddar — toujours, sans exception

Garde-fou code :
prix_khddar_estimé = coût_réel × 1.12
if prix_affiché > prix_khddar_estimé:
    → alerte admin
    → réduire coussin automatiquement
    → jamais afficher un prix > khddar
```

---

## 2. Les 3 Niveaux de Catalogue

Le panier client est découpé en 3 parts avec des rôles distincts.

```
NIVEAU 1 (30%)     NIVEAU 2 (40%)        NIVEAU 3 (30%)
──────────         ──────────            ──────────
Marge   0%         Marge   25-30%        Marge   40-50%
Coussin 0%         Coussin 10%           Coussin 5%
──────────         ──────────            ──────────
Attirer            Payer les frais       Générer le
le client          opérationnels         vrai profit
```

### Niveau 1 — Produits d'Appel (30% du panier)

**Rôle :** Électrochoc prix. Le client compare ces produits en premier.
**Règle :** Prix = coût réel strict. Zéro marge. Zéro coussin.

| Produit | Prix gros | Coût réel | Prix SOUKI | Prix khddar |
|---|---|---|---|---|
| Pommes de terre | 5.00 DH | 5.67 DH | 6.00 DH | 6.50 DH |
| Oignons | 6.00 DH | 6.83 DH | 7.00 DH | 8.00 DH |
| Tomates | 6.00 DH | 6.89 DH | 7.00 DH | 7.50 DH |
| Carottes | 4.50 DH | 5.11 DH | 5.50 DH | 6.00 DH |

**Formule :**
```python
prix_affiche = cout_reel  # strict, pas de marge
```

**Pourquoi ça marche :**
Le client voit immédiatement qu'il économise sur les produits qu'il connaît le mieux.
Il fait confiance et achète TOUT chez SOUKI, y compris les Niveaux 2 et 3
où tu génères ta vraie marge.

### Niveau 2 — Produits Courants (40% du panier)

**Rôle :** Payer le livreur, l'emballage, les frais opérationnels.
**Règle :** Marge 25-30% + coussin sécurité 10%.

| Produit | Coût réel | Prix SOUKI | Prix khddar | Marge brute |
|---|---|---|---|---|
| Courgettes | 8.00 DH | 11.00 DH | 14.00 DH | 27% |
| Aubergines | 9.00 DH | 12.00 DH | 13.00 DH | 25% |
| Poivrons | 10.00 DH | 13.00 DH | 14.00 DH | 23% |
| Concombre | 11.00 DH | 14.00 DH | 15.00 DH | 21% |

**Formule :**
```python
prix_affiche = cout_reel * (1 + 0.25) * (1 + 0.10)
# = cout_reel * 1.375
# Arrondi au 0.10 DH supérieur
prix_affiche = math.ceil(prix_affiche * 10) / 10
```

**Exemple courgettes :**
```
coût réel    = 8.00 DH
prix affiché = 8.00 × 1.375 = 11.00 DH
prix khddar  = 14.00 DH → SOUKI moins cher ✅
```

### Niveau 3 — Produits Haute Valeur (30% du panier)

**Rôle :** Générer le profit réel. Le client compare moins ces produits au khddar.
**Règle :** Marge 40-50% + coussin sécurité 5%.

| Produit | Coût réel | Prix SOUKI | Prix khddar | Marge brute |
|---|---|---|---|---|
| Herbes fraîches | 2.00 DH | 3.10 DH | 3.00 DH | 50% |
| Avocats | 15.00 DH | 22.00 DH | 23.00 DH | 32% |
| Œufs beldi (×6) | 12.00 DH | 18.00 DH | 20.00 DH | 33% |
| Citrons | 5.00 DH | 8.00 DH | 9.00 DH | 37% |

**Formule :**
```python
prix_affiche = cout_reel * (1 + 0.45) * (1 + 0.05)
# = cout_reel * 1.5225
prix_affiche = math.ceil(prix_affiche * 10) / 10
```

---

## 3. Le Coussin de Sécurité

### Définition
Réserve cachée dans le prix pour absorber les hausses du marché de gros
sans vendre à perte et sans changer le prix affiché client.

### Pourquoi c'est indispensable
```
Scénario SANS coussin :
Courgettes gros : 7 DH → prix affiché 11 DH → marge 36% ✅
Lendemain gros  : 9 DH → prix affiché 11 DH → marge 18% ⚠️
Surlendemain    :11 DH → prix affiché 11 DH → marge  0% ❌

Scénario AVEC coussin 10% :
Le prix de 11 DH intègre déjà une hausse possible de 10%
Gros monte à 9 DH → tu absorbes sans changer le prix ✅
```

### Règles par Niveau
```
Niveau 1 : coussin = 0%   (prix coûtant strict, pas de fluctuation à absorber)
Niveau 2 : coussin = 10%  (produits volatils, marché fluctue beaucoup)
Niveau 3 : coussin = 5%   (produits plus stables, moins de risque)
```

### Garde-fou Code
```python
# Avant d'afficher un prix, toujours vérifier
prix_khddar_estime = cout_reel * 1.12

if prix_affiche > prix_khddar_estime:
    # Option 1 : réduire le coussin
    coussin_securite = coussin_securite - 0.02
    prix_affiche = cout_reel * (1 + marge_cible) * (1 + coussin_securite)
    # Option 2 : lever une alerte admin
    alerte_admin("Prix dépasse khddar estimé pour produit X")
```

---

## 4. Stratégie Livraison

### Le Problème Psychologique
```
Client voit :
Tomates      7.00 DH
Oignons      7.00 DH
Courgettes  11.00 DH
─────────────────────
Total        25.00 DH
+ Livraison  10.00 DH  ← 40% du panier — client abandonne
```

### Règles de Livraison par Segment

```
SEGMENT           SEUIL GRATUIT      SINON        ASTUCE
──────────────────────────────────────────────────────────────
Familles          80 DH              10 DH        Progress bar
Étudiants solo    jamais gratuit     10 DH        Pousser coloc
Étudiants coloc   2+ personnes       5 DH/pers    Viral naturel
Abonnés           toujours gratuit   —            Rétention
B2B               toujours gratuit   —            Volume justifie
```

### Règle Seuil Intelligent
```
Panier < 80 DH  → livraison 10 DH
Panier ≥ 80 DH  → livraison gratuite

Effet :
Client à 65 DH → ajoute 15 DH de produits Niveau 3
→ tu gagnes la livraison ET 40-50% de marge sur les 15 DH ajoutés
→ c'est SOUKI qui gagne, pas le client
```

### Hack Coloc Étudiants
```
3 étudiants commandent ensemble :
→ Chacun paie 5 DH livraison
→ Coût réel SOUKI : 8 DH
→ SOUKI encaisse 15 DH
→ Profit livraison : +7 DH

Sans groupage : 3 × 10 DH = 30 DH encaissés, 3 × 8 DH = 24 DH coût
Avec groupage : 15 DH encaissés, 8 DH coût → meilleur ratio
```

### Impact sur Marge Nette
```
Panier moyen 80 DH  → frais ops livraison = 12.5% → marge nette ~9%  ❌
Panier moyen 120 DH → frais ops livraison =  8.3% → marge nette ~14% ✅

La progress bar fait monter le panier moyen de 30-40%
C'est le levier le plus simple à implémenter
```

---

## 5. Psychologie des Prix

### Technique 1 — Ancrage Prix Khddar
```
Afficher toujours le prix khddar barré :
Tomates  ~~7.50 DH~~  →  7.00 DH SOUKI  (-7%)

Le client voit l'économie, pas la livraison.
Son cerveau fait : "je gagne de l'argent" au lieu de "je paye la livraison"
```

### Technique 2 — Livraison Incluse Psychologique
```
❌ Mauvais affichage :
   Panier    : 150 DH
   Livraison :  10 DH
   Total     : 160 DH

✅ Bon affichage :
   Total     : 160 DH — Livraison offerte ✅

Même montant, perception totalement différente.
```

### Technique 3 — Progress Bar Panier
```
[████████░░] Tu es à 15 DH de la livraison gratuite 🎁

→ Client ajoute des produits Niveau 3 pour débloquer
→ Ces 15 DH ajoutés ont une marge de 40-50%
→ SOUKI gagne sur chaque DH ajouté
```

### Technique 4 — Arrondi Psychologique
```
Ne jamais afficher :  11.37 DH
Toujours arrondir à : 11.40 DH (math.ceil au 0.10 supérieur)

Prix en .90 DH perçus comme moins chers :
11.90 DH perçu < 12.00 DH même si différence = 0.10 DH
```

### Technique 5 — Transparence Inversée
```
Email/WhatsApp hebdomadaire au client :
"Cette semaine vous avez économisé 28 DH vs le khddar 🌿"

→ Preuve de valeur concrète
→ Fidélisation sans cashback
→ Client parle de SOUKI naturellement
```

### Technique 6 — Parrainage à Valeur Perçue Haute
```
"Invite un ami → 20 DH wallet pour vous deux"

Valeur perçue : 20 DH
Coût réel SOUKI en légumes (marge 30%) : ~14 DH
ROI : nouveau client acquis pour 14 DH ✅
```

---

## 6. Matrice par Segment

### Familles
```
Panier moyen    : 150-220 DH
Livraison       : gratuite dès 80 DH
Marge catalogue : 22%
Marge nette     : 14-18% (avant wallet)
Levier          : abonnement hebdo, wallet PLUS
```

### Étudiants
```
Panier moyen    : 45-80 DH
Livraison       : 10 DH (solo) / 5 DH (coloc)
Marge catalogue : 18-22%
Marge nette     : 8-12% (faible mais viral)
Levier          : Box Solo composée JIT, hack coloc
Valeur cachée   : ambassadeur famille dans ville natale
```

### Restaurants B2B
```
Commande moyenne : 600-1200 DH
Livraison        : gratuite (volume justifie)
Prix             : coût réel + 15-18%
Marge nette      : 13-16% × gros volume
Créneau          : 7h-9h dédié
Levier           : contrat semaine, paiement différé 15j
```

---

## 7. Projection Marge Nette

### Marge Brute Catalogue (mix 30/40/30)
```
Niveau 1 (30%) : marge  2% × 0.30 =  0.6%
Niveau 2 (40%) : marge 25% × 0.40 = 10.0%
Niveau 3 (30%) : marge 38% × 0.30 = 11.4%
────────────────────────────────────────────
Marge brute catalogue              = 22.0%
```

### Marge Nette par Phase
```
MOIS 1-2 (lancement) :
  Marge catalogue          : 22%
  - Frais ops              : -12%
  - CMI 2% (40% clients)   : -0.8%
  ─────────────────────────────────
  Marge nette              : ~9%  ⚠️ insuffisant seul

MOIS 3 (avec leviers) :
  Mix clients :
    60% familles (22%)  × 0.60 = 13.2%
    25% étudiants (18%) × 0.25 =  4.5%
    15% B2B (14%)       × 0.15 =  2.1%
  Marge catalogue nette          = 19.8%
  + Wallet (30% clients)         = +1.5%
  + Seuil 80 DH (panier monte)   = +2.0%
  + B2B volume croissant         = +2.0%
  ─────────────────────────────────────
  Marge nette estimée            = 25.3% ✅

MOIS 6 (achat direct producteurs) :
  Marge nette estimée            = 30-33% ✅✅
```

### Les 3 Leviers Non Négociables
```
1. Wallet SOUKI
   Recharge 500 DH → 540 DH de courses (8%)
   Coût réel légumes (marge 30%) : 378 DH
   Profit réel : 500 - 378 = 122 DH = 24.4%
   Tu offres 8% → tu gardes 16.4% net sur le float
   Impact global (30% clients wallet) : +4 à 5%

2. Seuil livraison 80 DH
   Panier moyen : 80 DH → 120 DH (+50%)
   Frais ops    : 12.5% → 8.3%
   Impact global : +2 à 3%

3. B2B restaurants (mois 2)
   Volume × fréquence = stabilité cashflow
   Impact global : +2 à 3%
```

---

## 8. Règles Absolues

### Pricing
```
✅ Niveau 1 toujours à prix coûtant (0% marge, 0% coussin)
✅ Prix affiché toujours < prix khddar estimé (coût_réel × 1.12)
✅ Prix calculé après JIT 20h — pas statique
✅ Arrondi au 0.10 DH supérieur (math.ceil)
✅ Alerte admin si prix_gros manquant
✅ Coussin réduit automatiquement si prix dépasse khddar
```

### Ce qu'il ne faut pas faire
```
❌ Appliquer une marge sur Niveau 1 → plus cher que le khddar
❌ Livraison gratuite dès 50 DH → frais ops explosent
❌ Prix fixe sans coussin sur Niveau 2/3 → vente à perte si gros monte
❌ Lancer B2B dès mois 1 → trop complexe avant d'avoir le rythme
❌ Annoncer un "rendement" wallet en DH → risque Bank Al Maghrib
❌ Rembourser en cash si marché baisse → méfiance client
❌ Trop de niveaux fidélité complexes → client veut du simple
```

### Plan d'Implémentation Technique
```
Mois 1 : Champs SQL sur T_Product (marge_cible, coussin_securite, niveau)
         Page /admin/pricing pour gérer les paramètres
         Calcul automatique prix_affiche après JIT

Mois 2 : Wallet activé (BASIC 5%, PLUS 8%, PRO 10%)
         Progress bar checkout
         Seuil livraison gratuite 80 DH

Mois 3 : Box Solo étudiants composée par JIT
         B2B créneau 7h-9h
         Rapport marges par produit dans dashboard

Mois 6 : Contrats directs producteurs Meknès/Sefrou
         Algorithme box optimisé par marge
```

---

*Dernière mise à jour : Mai 2026*
*Projet SOUKI — PFA 3ème année — Fès*

---

## 9. Cas Critique — Client 100% Niveau 1

### Le Problème
```
Client commande 5 kg patates + 5 kg oignons = 100% Niveau 1
Coût réel SOUKI : 62.50 DH
Prix SOUKI      : 65.00 DH
Marge brute     :  2.50 DH = 3.8%
- Livraison     : -8.00 DH
────────────────────────────────
Marge nette     : -5.50 DH ❌ perte sèche
```

Ce scénario est réaliste — ~70% des clients commandent
majoritairement des produits de base (Niveau 1).

### Ce qu'il ne faut pas faire
```
❌ Changer les prix selon la composition du panier
   → Confusion client, méfiance, abandon panier

❌ Marge glissante invisible sur le Niveau 1
   → Complexité technique pour un gain marginal
   → Prix qui bougent = perte de confiance
```

### La Vraie Solution — 3 règles simples

**Règle 1 — Panier minimum 50 DH**
```
Impossible de commander sous 50 DH
→ Élimine les commandes à 25 DH de patates
→ Marge minimale garantie sur chaque commande
→ Implémenté dans checkout_service.py
```

**Règle 2 — Livraison jamais gratuite sous 80 DH**
```
Panier < 80 DH → livraison 10 DH obligatoire, aucune exception
Panier ≥ 80 DH → livraison gratuite

Effet sur client 100% Niveau 1 :
  Produits  : 65.00 DH
  Livraison : 10.00 DH
  Total     : 75.00 DH
  Coût réel : 62.50 + 8 DH livraison = 70.50 DH
  Marge     : 75 - 70.50 = 4.50 DH = 6% ✅ acceptable
```

**Règle 3 — Progress bar vers 80 DH**
```
[████████░░] Tu es à 15 DH de la livraison gratuite 🎁

Client 100% Niveau 1 à 65 DH voit la progress bar
→ Il ajoute naturellement du Niveau 2/3 pour débloquer
→ Tu ne bloques pas, tu incites
→ Marge monte à 14-18% si il ajoute 15 DH de Niveau 2/3
```

### Simulation Complète

```
Scénario A — Client 100% Niveau 1, panier 65 DH :
  Produits  : 65.00 DH  (marge brute 3.8%)
  Livraison : 10.00 DH
  Total     : 75.00 DH
  Coût réel : 70.50 DH
  Marge     : +4.50 DH = 6% ✅ pas catastrophique

Scénario B — Client ajoute 15 DH Niveau 2 (progress bar) :
  Produits  : 80.00 DH  (marge brute ~14%)
  Livraison :  0.00 DH  (seuil atteint)
  Total     : 80.00 DH
  Coût réel : 61.50 DH
  Marge     : +18.50 DH = 23% ✅✅

Scénario C — Client mix naturel 120 DH :
  Produits  : 120.00 DH (marge brute ~22%)
  Livraison :   0.00 DH
  Total     : 120.00 DH
  Coût réel :  98.00 DH
  Marge     : +22.00 DH = 18.3% ✅✅
```

### Projection Réaliste Mix Clients

```
30% clients → 100% Niveau 1, panier ~65 DH   marge 6%
50% clients → mix N1/N2, panier ~95 DH        marge 16%
20% clients → mix N1/N2/N3, panier ~140 DH    marge 22%

Moyenne pondérée :
0.30 × 6% + 0.50 × 16% + 0.20 × 22%
= 1.8% + 8% + 4.4%
= 14.2% avant wallet et B2B ✅
```

### Implémentation Technique

**checkout_service.py — 2 validations**
```python
# Validation 1 — Panier minimum
PANIER_MINIMUM_DH = 50.0
if total_produits < PANIER_MINIMUM_DH:
    raise HTTPException(
        status_code=400,
        detail=f"Commande minimum {PANIER_MINIMUM_DH} DH"
    )

# Validation 2 — Calcul livraison
SEUIL_LIVRAISON_GRATUITE = 80.0
FRAIS_LIVRAISON = 10.0

if total_produits >= SEUIL_LIVRAISON_GRATUITE:
    frais_livraison = 0.0
elif client.abonnement_actif:
    frais_livraison = 0.0   # abonné = toujours gratuit
elif commande.is_b2b:
    frais_livraison = 0.0   # B2B = toujours gratuit
else:
    frais_livraison = FRAIS_LIVRAISON

total_final = total_produits + frais_livraison
```

**Frontend checkout — Progress bar**
```typescript
const SEUIL = 80
const reste = Math.max(0, SEUIL - totalProduits)

{reste > 0 && (
  <div className="progress-bar-container">
    <div
      className="progress-bar-fill"
      style={{ width: `${(totalProduits / SEUIL) * 100}%` }}
    />
    <span>Tu es à {reste.toFixed(2)} DH de la livraison gratuite 🎁</span>
  </div>
)}

{reste === 0 && (
  <span className="text-green-600">✅ Livraison offerte !</span>
)}
```

### Résumé — Ce qui protège SOUKI

```
GARDE-FOU 1 : Panier minimum 50 DH
→ Aucune commande à perte structurelle

GARDE-FOU 2 : Livraison 10 DH sous 80 DH
→ Compense la marge faible du Niveau 1

GARDE-FOU 3 : Progress bar
→ Convertit les clients 100% N1 en clients mix
→ Sans bloquer, sans frustrer

RÉSULTAT :
Même le pire cas (100% Niveau 1) génère 6% de marge nette
Le cas moyen génère 14% avant wallet
Le cas idéal génère 22%+
```

---

*Mise à jour : Mai 2026 — Ajout cas critique 100% Niveau 1*
