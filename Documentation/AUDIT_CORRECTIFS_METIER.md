# SOUKI — Audit des correctifs métier / financiers

**Date :** 2026-06-09
**Source :** `checklist_correctifs_souki.md`
**Objet :** (1) statut réel d'implémentation, (2) ordre d'implémentation recommandé, (3) vérification de cohérence financière.
**Note :** distinct de `AUDIT_SECURITE.md` (sécurité) — ce document couvre la **stratégie de marge**.

---

## 1️⃣ Statut d'implémentation (vérifié dans le code)

Légende : ❌ non implémenté · 🟡 terrain prêt (colonne/entité existe, logique absente) · ✅ implémenté

| Correctif | Statut | Terrain déjà en place | Ce qui manque | Preuve |
|---|---|---|---|---|
| **C1** Coussin 5% N1 | ❌ 🟡 | Colonnes `coussin_securite`, `prix_khddar_reel`, `prix_gros_saisi` (`product_entity.py:20-24`) | `COUSSIN_OPS` sur N1 ; aujourd'hui N1 = `ceil(prix_gros*10)/10` sans marge | `produit_pricing_service.py:155` |
| **C2** Mix N3 35% + filtre catalogue | ❌ | — | Contrainte `valeur_N3 >= 0.35` (aucun algo box) ; filtre `prix_affiche !== null` absent (masqué par fallback `?? prix_kg`) | `catalogue/page.tsx:219,638` |
| **C3** Flux B2B invendus | ❌ 🟡 | Entité `t_produits_b2b` existe | DAO + interface + service + controller + déclencheur post-tournée (tout le flux) | aucun `produit_b2b_dao/service/controller` |
| **C4** Wallet 5% hors N1 | ❌ 🟡 | Wallet `balance` + transactions | Split `solde_principal`/`solde_bonus`, paliers BASIC/PLUS/PRO, restriction bonus N2/N3 au checkout | `souki_wallet_entity.py` (1 seule colonne `balance`) ; `credit_wallet` sans bonus |
| **C5** Box Coloc étudiant | ❌ 🟡 | Colonne `code_parrainage` (`client_entity.py:10`) | Champ `segment`, logique Box Coloc, parrainage conditionné `BOX_COLOC`, split paiements | aucun `segment`/`ETUDIANT`/`coloc` |
| **C6** `prix_gros_negocie` | ❌ | — | Colonne nullable + « utiliser si non NULL » dans le calcul | champ absent des entités |
| **C7** Khddar 1.00 haricots | ❌ | — | Exclusion/reclassement + alerte coefficient ≤ 1.05 | `produit_pricing_service.py:20` (`"haricots": 1.00`) |
| **C8** `delai_paiement_jours` B2B | ❌ | — | Colonne (défaut 7) | champ absent |

**Verdict :** aucun correctif n'est implémenté. 4 sur 8 ont un **terrain de données partiellement prêt** (C1, C3, C4, C5) → l'effort restant est surtout de la **logique métier**, pas du schéma.

---

## 2️⃣ Ordre d'implémentation recommandé

Critères : effort, dépendances, gain immédiat, contrôle (mécanique vs comportemental).
Contrainte projet (rappel checklist) : **MVC2** — `flush()` DAO / `commit()` Service / `LocalSession()` Controller, interfaces ABC, **ALTER additif uniquement** (jamais modifier une table/entité existante).

### 🥇 Sprint 1 — Quick wins pricing (faible effort, sous ton contrôle total)
| Ordre | Correctif | Pourquoi en premier | Dépendances |
|---|---|---|---|
| 1 | **C1 + C7** | Même fichier (`produit_pricing_service.py`), aucune migration (colonnes prêtes). Gain immédiat et **mécanique** (pas d'hypothèse comportementale). C7 (haricots) se traite dans le même `_calculer_prix_affiche` | Aucune |
| 2 | **C2a** (fix filtre) | Bug todo #7, correctif frontend rapide (`catalogue/page.tsx`) | Aucune |
| 3 | **C6 — la colonne** | `prix_gros_negocie` = simple `ALTER` additif + « si non NULL ». Le **champ** est gratuit à poser ; le **bénéfice** (négo) est Phase 2 | Aucune |
| 4 | **#16 audit sécu** | Tracer l'`actor_id` sur les mutations de prix **pendant** qu'on touche le pricing (cohérence avec `AUDIT_SECURITE.md`) | Aucune |

### 🥈 Sprint 2 — Wallet
| Ordre | Correctif | Notes | Dépendances |
|---|---|---|---|
| 5 | **C4** | `ALTER` additif (`solde_bonus`), paliers, restriction bonus aux lignes `niveau IN (2,3)` au checkout. Effort moyen, indépendant | `niveau` connu au checkout (✅ déjà le cas) |

### 🥉 Sprint 3 — Logique box (à construire from scratch)
| Ordre | Correctif | Notes | Dépendances |
|---|---|---|---|
| 6 | **C2b** (contrainte N3 35%) | **Aucun algo de composition box n'existe** → à créer (post-JIT 20h). Logger la répartition N1/N2/N3 dans `t_jit_logs.details_volumes` | Algo box à créer |
| 7 | **C5** Box Coloc | Le plus complexe : champ `segment`, concept Coloc, **split paiements** (1 livraison / N payeurs), agrégation JIT multi-payeurs | Partage l'algo box (C2b) ; touche checkout + JIT + paiements |

### 🏅 Sprint 4 — Module B2B
| Ordre | Correctif | Notes | Dépendances |
|---|---|---|---|
| 8 | **C3 + C8** | Module complet (DAO+interface+service+controller). Déclencheur = clôture tournée → se greffe sur `delivery_event` / `commande_state_machine` (✅ existent). C8 (`delai_paiement_jours`) posé avec | Événements livraison (✅ présents) |

### 🔮 Phase 2 — Business, pas code
- **C6 — activation négo** : dépend d'atteindre 50+ cmd/jour stables sur 4 semaines. Le code (colonne) est prêt dès Sprint 1 ; l'**effet** ne se déclenche qu'à l'échelle.

**Chemin critique :** Sprint 1 (C1/C7) donne le gain le plus sûr et le plus rapide. Les sprints 3-4 (box, B2B) sont les gros chantiers. C6 (le plus gros gain) ne dépend **pas** du code mais de l'échelle commerciale.

---

## 3️⃣ Vérification de cohérence financière

### Le pont de marge — l'arithmétique est juste ✅
| Étape | Δ | Cumul | Vérif |
|---|---|---|---|
| Départ | — | 13.5% | — |
| C1 | +1.5 | 15.0% | ✅ |
| C2 | +1.6 | 16.6% | ✅ |
| C3 | +2.5 | 19.1% | ✅ |
| C4 | +0.8 | 19.9% | ✅ |
| C5 | +1.0 | 20.9% | ✅ |
| C6 | +6.5 | 27.4% | ✅ |
| Frais ops | −4.5 | **22.9%** | ✅ |

Les additions sont **internes-cohérentes**. Mais l'arithmétique n'est pas le risque — **les hypothèses le sont.**

### Niveau de confiance par levier
| Levier | Type | Confiance | Commentaire |
|---|---|---|---|
| **C1** +1.5 | Mécanique (prix) | 🟢 Élevée (gain à revoir) | Sous ton contrôle total. Vérif interne OK : patates 5.00→5.30 (+0.30/kg) couvre porteur 0.13 + emballage 0.08 → reste +0.09. **MAIS** sur les 200 paniers réels, la part N1 ≈ **17%** (proxy), pas 30% → le gain serait plutôt **+0.8 à +1.0 pt**, à confirmer avec la vraie classification niveau. |
| **C2** +1.6 | Comportemental | 🟡 Moyenne | `0.05 × 32% = 1.6pp` arithmétiquement OK, **mais** suppose qu'on déplace réellement 5 pts de panier vers N3. Dépend de l'adoption des box. |
| **C3** +2.5 | Donnée-dépendant | 🔴 Non vérifiable | **Vérifié :** `200-compositions.json` = compositions de paniers (demande), **aucune donnée d'invendus/surplus/livré**. Le buffer 10% est une **pure hypothèse** — invalidable seulement avec des opérations réelles. |
| **C4** +0.8 | Adoption wallet | 🟡 Moyenne | Marginal, dépend du taux de recharge. L'ancien calcul (bonus 10% à 13.5%) était invalide — bien noté dans la checklist. |
| **C5** +1.0 | Comportemental | 🟡 Moyenne | Dépend du ratio Coloc/Solo (cible ≥60%). Mécanisme contrôlable, uptake non. |
| **C6** +6.5 | Conditionnel Phase 2 | 🔴 Incertain | `0.15×0.70×0.75 ≈ 7.9pp` (ils annoncent 6.5, conservateur). **MAIS** conditionné à l'échelle + accord fournisseur. À ne **pas** compter en base case. |

### ⚠️ Risques de cohérence à corriger

1. **~69% du gain dépend de C6 (Phase 2).** Sans C6 : `20.9% brut − 4.5 ops = 16.4% net`, pas 22.9%. Le « 23% net » est un **objectif Phase 2**, pas le near-term.
   - **Trajectoire réaliste : 13.5% → ~16% net (Phase 1) → ~23% net (Phase 2 avec négo).**
   - La slide prévue (« 13.5% → 21% → 23%, pas un chiffre unique ») est la **bonne façon de présenter** ✅ — à condition de bien étiqueter C6 comme conditionnel.

2. **Risque de double comptage porteur/emballage.** C1 indique « porteur 0.13 + emballage 0.08 couverts » dans le prix N1. Or les `−4.5 pts` de frais ops finaux englobent potentiellement **aussi** porteur/emballage → vérifier qu'ils ne sont pas déduits **deux fois**. Si c'est le cas, le net réel est meilleur que 22.9% (ou la base de coût est mal isolée).

3. **C6 conservateur mais binaire.** 6.5 vs 7.9 calculé = prudence saine, mais le levier est **tout-ou-rien** : tant que le volume n'est pas là, c'est **0**, pas une montée progressive.

4. **Les `−4.5 pts` ops sont un « plug ».** À détailler (porteurs, emballage, livraison, frais CMI ~2-3%, pertes) pour être défendable en soutenance. Aujourd'hui c'est un agrégat non décomposé.

### Recommandations finance
- [ ] Présenter **deux scénarios** : Phase 1 (sans C6, ~16% net) et Phase 2 (avec C6, ~23% net).
- [ ] Décomposer les `−4.5 pts` ops et **vérifier le non-double-comptage** porteur/emballage.
- [ ] Confirmer le **% buffer réel** (C3) avec `200-compositions.json` avant d'annoncer +2.5.
- [ ] Étiqueter C2/C5 comme **dépendants d'adoption** (KPI de suivi : mix N3, ratio Coloc/Solo).
- [ ] Recalculer le BP sur le panier témoin 191 DH avec ces réserves (todo #1 checklist).

---

## 🚀 Plan de démarrage codage

Ordonné pour **commencer par les points dont tous les prérequis sont déjà réglés** (zéro migration, infra existante), puis monter en complexité. Chaque étape respecte **MVC2**.

### Phase 0 — Prérequis DÉJÀ réglés → commencer ici (zéro migration)

**Étape 1 — C1 + C7 : coussin 5% N1 + garde haricots** · `back-end/services/produit_pricing_service.py`
- ✅ Prérequis réglés : colonnes `coussin_securite` / `prix_khddar_reel` existent ; l'alerte `PRIX_DEPASSE_KHDDAR` existe déjà (`produit_pricing_dao.py:148`).
- Actions :
  1. Dans `_calculer_prix_affiche`, remplacer la branche `niveau == 1` (actuellement `ceil(prix_gros*10)/10`) par `prix_gros * (1 + 0.05)` puis arrondi.
  2. Appliquer à N1 **le même garde-fou khddar** que N2/N3 (la boucle de réduction `while prix_arrondi > prix_khddar`). Pour haricots (coeff 1.00), le coussin dépasse le plafond → la boucle ramène au khddar et l'alerte existante se déclenche.
- Test : patates gros 5.00 → **5.30 DH** ; relancer `POST /api/produits/pricing/recalculer`.
- ⚠️ Revoir le **gain attendu** : part N1 réelle ≈ 17% (cf. §3) → gain ~+0.8–1.0 pt, pas +1.5.

**Étape 2 — C2a : fix filtre catalogue (bug todo #7)** · `front-end/app/catalogue/page.tsx`
- ✅ Prérequis réglés : aucun (frontend pur).
- Action : avant tri/affichage, exclure ou désactiver les produits `prix_affiche == null` (au lieu du fallback silencieux `?? prix_kg` ligne 219). Afficher « prix à venir » + bloquer l'ajout panier.
- Test : un produit sans prix saisi ne crashe pas et n'est pas commandable.

**Étape 3 — #16 sécu : traçabilité des prix** · `produit_pricing_controller.py` + service
- ✅ Prérequis réglés : le `principal` est déjà disponible (aujourd'hui jeté via `_ = principal`).
- Action : passer `principal.user_id` aux méthodes du service et persister `actor_id` + horodatage (petit ALTER additif `updated_by`/`updated_at`, ou table d'audit). Groupé ici car on touche déjà ces fichiers.

### Phase 1 — ALTER additifs (faible risque)
- **Étape 4 — C6** : colonne `prix_gros_negocie` (nullable) + champ DTO + « utiliser si non NULL, sinon `prix_gros_saisi` » dans `_calculer_prix_affiche`.
- **Étape 5 — C8** : colonne `delai_paiement_jours` (défaut 7) sur le profil client B2B.
- **Étape 6 — C4** : colonne `solde_bonus` (séparée de `balance`), paliers BASIC 3% / PLUS 4% / PRO 5%, et au checkout n'appliquer le bonus que sur lignes `niveau IN (2,3)`.

### Phase 2 — Nouveaux modules / algorithmes (gros effort)
- **Étape 7 — C2b** : créer l'algorithme de composition box (post-JIT 20h) avec contrainte `valeur_N3 >= 0.35 * valeur_box` + logger la répartition dans `t_jit_logs.details_volumes`.
- **Étape 8 — C5** : champ `segment` (ETUDIANT), Box Coloc en 1ʳᵉ position pour étudiants, parrainage conditionné `BOX_COLOC`, **split paiements** (1 livraison / N payeurs) + agrégation JIT multi-payeurs.
- **Étape 9 — C3 + C8** : module B2B complet (`produit_b2b_dao` + interface ABC, `produit_b2b_service`, `produit_b2b_controller`), déclencheur = clôture tournée (se greffe sur `delivery_event` / `commande_state_machine`), prix de cession = coût réel.

### Pourquoi cet ordre
- **Phase 0** = gain immédiat, **aucune migration**, risque minimal → idéal pour démarrer et sécuriser un premier point de marge avant soutenance.
- **Phase 1** = `ALTER` additifs seulement (conforme à la règle « jamais modifier une table existante »).
- **Phase 2** = chantiers structurants (algos + module), à planifier après validation des phases 0-1.

---

## Synthèse

| Question | Réponse |
|---|---|
| Combien implémenté ? | **0/8** (4 ont le terrain de données prêt) |
| Par où commencer ? | **C1+C7** (quick win mécanique, zéro migration) |
| Le 22.9% net tient ? | **Arithmétique oui, hypothèses non** : ~16% net en Phase 1, 23% net **uniquement** avec C6 (négo, Phase 2) |
| Plus gros risque ? | Dépendance à C6 (+6.5pp) + double-comptage possible des frais ops |

*Document d'analyse — aucun code modifié.*
