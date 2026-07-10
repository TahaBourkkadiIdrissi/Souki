# SOUKI — Checklist Correctifs Financiers
> Objectif : 13.5% brut → ~23% net | Vérification code + finance
> Juin 2026 — avant soutenance

---

## CORRECTIF 1 — Coussin 5% sur Niveau 1 (+1.5 pt)

### Côté code
- [ ] `produit_pricing_service.py` : remplacer `if produit.niveau == 1: prix_arrondi = prix_gros` par :
  ```python
  if produit.niveau == 1:
      COUSSIN_OPS = 0.05
      prix_arrondi = math.ceil(prix_gros * (1 + COUSSIN_OPS) * 10) / 10
  ```
- [ ] Vérifier que le garde-fou khddar s'applique APRÈS le coussin : `prix_arrondi <= prix_gros * COEFFICIENT_KHDDAR[produit]`
- [ ] Cas limite : produits à coefficient khddar ≤ 1.05 (haricots 1.00) → le coussin dépasse le khddar → lever alerte admin au lieu d'afficher
- [ ] Endpoint `POST /api/produits/pricing/recalculer` : relancer après déploiement
- [ ] Test : patates gros 5.00 DH → prix affiché attendu 5.30 DH

### Côté finance
- [ ] Marge/kg N1 : −0.21 DH → +0.09 DH (porteur 0.13 + emballage 0.08 couverts)
- [ ] Prix patates 5.30 DH < khddar 6.00 DH → écart −12% maintenu ✓
- [ ] Impact panier : 30% du panier × +5% ≈ +1.5 pt marge brute

---

## CORRECTIF 2 — Mix Niveau 3 à 35% dans les box (+1.6 pt)

### Côté code
- [ ] Algorithme composition box (post-JIT 20h) : contrainte `valeur_N3 >= 0.35 * valeur_box`
- [ ] Vérifier `catalogue/page.tsx` : filtrer `prix_affiche !== null` avant tri N3 (bug todo #7 — crash si prix non saisi)
- [ ] Logger la répartition N1/N2/N3 réelle de chaque box dans `t_jit_logs.details_volumes` pour audit

### Côté finance
- [ ] Déplacement 5 pts de panier : N1 (0%) → N3 (~32%) = +1.6 pt
- [ ] Vérifier que la valeur perçue de la box reste > prix payé (comparaison khddar)
- [ ] Suivi mensuel : marge réelle par box vs marge théorique

---

## CORRECTIF 3 — Flux B2B invendus / buffer (+2.5 pt) ← TODO #12

### Côté code
- [ ] Implémenter le flux complet sur `t_produits_b2b` (entity existe, aucun flux) :
  - DAO + interface ABC (`produit_b2b_dao.py`, `produit_b2b_dao_interface.py`)
  - Service + interface (`produit_b2b_service.py`) — commit() à la fin uniquement
  - Controller (`produit_b2b_controller.py`) — LocalSession() ici uniquement
- [ ] Déclencheur : après clôture tournée, calculer `surplus = volume_final − quantite_livree` par produit
- [ ] Endpoint `GET /api/b2b/invendus-du-jour` + notification snacks partenaires (phase manuelle OK : liste affichée admin)
- [ ] Prix de cession = coût réel (prix gros + porteur/kg), pas prix affiché
- [ ] Respect MVC2 : flush() DAO, commit() Service, session Controller

### Côté finance
- [ ] Coût buffer actuel : ~10% des achats non facturés = perte sèche (~8% du CA en COGS perdu)
- [ ] Récupération à prix coûtant : ~95% du coût buffer récupéré → +2.5 pt
- [ ] L'argument "zéro gaspillage" devient vérifiable (KPI : % surplus revendu)

---

## CORRECTIF 4 — Wallet plafonné 5% hors Niveau 1 (+0.8 pt)

### Côté code
- [ ] Paliers bonus : BASIC 3% / PLUS 4% / PRO 5% (au lieu de 5/8/10)
- [ ] Bonus stocké comme crédit séparé du solde rechargé (2 colonnes : `solde_principal`, `solde_bonus`)
- [ ] Au checkout : `solde_bonus` applicable uniquement sur lignes produits `niveau IN (2,3)`
- [ ] Affichage client transparent : "Bonus utilisable sur tout le catalogue sauf produits essentiels"

### Côté finance
- [ ] Recalcul avec marge réelle : recharge 1000 → dette 1050 → coût ~830 (à 21% brut) → profit ~170 DH = 17% brut, ~12% net après CMI ✓
- [ ] Ancien calcul (bonus 10% à 13.5% marge) : profit ~3–5% → INVALIDE, ne plus présenter
- [ ] Règle de remontée : paliers réaugmentables quand marge brute mesurée ≥ 25% sur 2 mois

---

## CORRECTIF 5 — Box Coloc format étudiant par défaut (+1.0 pt)

### Côté code
- [ ] Parcours étudiant (`client.segment == 'ETUDIANT'`) : Box Coloc en première position, Box Solo en second
- [ ] Parrainage 15 DH : condition `premiere_commande.type == 'BOX_COLOC'` pour débloquer le crédit
- [ ] Une commande Coloc = 1 livraison, N paiements (split par membre via wallet/CMI/COD)
- [ ] Vérifier exclusion BROUILLON et agrégation JIT correcte pour commandes multi-payeurs

### Côté finance
- [ ] Coût livraison/client : 10 DH (Solo) → ~3.3 DH (Coloc 3 membres)
- [ ] Marge nette Box Solo : 1–4 DH/commande → présenter comme CAC, pas comme profit
- [ ] KPI à suivre : ratio Coloc/Solo (cible ≥ 60% Coloc sur segment étudiant)

---

## CORRECTIF 6 — Négociation fournisseur −15% (+6.5 pt, Phase 2)

### Côté code
- [ ] Champ `prix_gros_negocie` (nullable) sur pricing — utilisé si non NULL, sinon `prix_gros_saisi`
- [ ] Dashboard admin : volume hebdo cumulé par produit (argument de négociation chiffré)
- [ ] Alerte automatique quand volume hebdo ≥ 1 500 kg : "Seuil négociation atteint"

### Côté finance
- [ ] Déclencheur : 50+ cmd/jour stables sur 4 semaines (~1 500 kg/sem)
- [ ] Cible : −15 à −25% sur N1 + N2 (≈ 70% du volume d'achat)
- [ ] Impact : −15% × 70% du COGS × COGS/CA 75% ≈ +6.5 pt
- [ ] Préparation dès maintenant : même grossiste, paiement cash quotidien irréprochable, historique de volume
- [ ] Engagement : volume hebdo ferme, PAS d'exclusivité (garder 2e grossiste en backup)

---

## FAILLES MOYENNES — Actions rapides

### 7. Coefficient khddar 1.00 (haricots)
- [ ] Code : exclure du catalogue OU reclasser N2 après revérification terrain du coefficient
- [ ] Finance : tout produit à coefficient ≤ 1.05 = vente à perte structurelle garantie

### 8. BFR B2B
- [ ] Code : champ `delai_paiement_jours` par client B2B, défaut 7 (pas 15)
- [ ] Finance : provisionner BFR = (commandes B2B hebdo × délai/7) en trésorerie avant signature

### 9. Plafond auto-entrepreneur
- [ ] Finance : CA annuel projeté à 10 cmd/jour ≈ 500 000 DH = plafond AE commerce
- [ ] Budgéter bascule SARL AU : ~15 000 DH (comptable, frais constitution, CNSS)
- [ ] Déclencheur dans le BP : 10 cmd/jour, pas "levée de fonds"

### 10. Salaires fondateurs
- [ ] Finance : intégrer ligne "coût d'opportunité fondateurs" (~3 000 DH/mois/pers au SMIG) dans le BP en note
- [ ] À 50 cmd/jour : ~48 000 DH/mois net → 2 salaires + réinvestissement couverts

---

## VÉRIFICATION FINALE — Pont de marge

| Étape | Levier | Δ pts | Cumul brut |
|---|---|---|---|
| Départ | BP actuel | — | 13.5% |
| C1 | Coussin N1 5% | +1.5 | 15.0% |
| C2 | Mix N3 35% | +1.6 | 16.6% |
| C3 | Flux B2B buffer | +2.5 | 19.1% |
| C4 | Wallet 5% hors N1 | +0.8 | 19.9% |
| C5 | Box Coloc | +1.0 | 20.9% |
| C6 | Négo gros −15% (Ph.2) | +6.5 | 27.4% |
| — | Frais ops nets | −4.5 | **22.9% NET** |

- [ ] Recalculer le BP complet avec ces hypothèses (panier témoin 191 DH)
- [ ] Mettre à jour `Documentation/pricing_strategy.md` (todo #19)
- [ ] Slide soutenance : trajectoire 13.5% → 21% → 23%, pas un chiffre unique

---
*Toutes les modifications backend doivent respecter MVC2 : flush() DAO / commit() Service / LocalSession() Controller, interfaces ABC obligatoires, ne jamais modifier entities ou tables existantes (mixin + ALTER TABLE additif uniquement).*
