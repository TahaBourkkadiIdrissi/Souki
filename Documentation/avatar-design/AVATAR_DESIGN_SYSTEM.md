# 🎨 Système de Design – Récolte la Tomate

## 1. Identité Visuelle de Récolte

### Caractéristiques principales
- **Nom :** Récolte (ou **Chéri/Chérie** en variante affectueuse)
- **Espèce :** Tomate anthropomorphe joyeuse
- **Âge conceptuel :** jeune, énergique, ~5-7 ans (apparence naïve positive)
- **Personnalité :** 
  - Enthousiaste, accueillante, généreuse
  - Légèrement espiègle et ludique
  - Fière de ses origines fermières
  - Toujours heureuse de partager

---

## 2. Design Principal – Vue de Face

### 2.1 Proportions & Anatomie

```
Tête : Tomate ronde (corps principal)
├─ Hauteur totale : 200 px (pour export base)
├─ Largeur max : 160 px
├─ Ratio tête/corps : 100% (tête = corps)
└─ Petite base/pied : ~40 px de hauteur

Yeux : 2 cercles brillants
├─ Diamètre : ~24 px chacun
├─ Écart : ~50 px
├─ Iris bleu/vert : ~16 px
├─ Pupille noire : ~10 px
└─ Highlight blanc : 4 px (pour brillance)

Bouche : Sourire arc de cercle
├─ Largeur : ~60 px
├─ Épaisseur trait : 3 px
└─ Arrondi : très doux

Feuille "cheveux" : Feuille stylisée
├─ Longueur : ~80 px
├─ Largeur : ~35 px
├─ Angle : légèrement penchée (15°)
├─ Nervures : fines, transparence 30%
└─ Couleur : vert frais (#4CAF50)

Bras : 2 petit bras arrondis
├─ Longueur : ~50 px chacun
├─ Épaisseur : ~18 px
├─ Mains : petits cercles de ~14 px
└─ Couleur : rouge plus clair que le corps

Pieds : petit pied/base
├─ Largeur totale : ~90 px
├─ Hauteur : ~20 px
└─ Forme : légèrement arrondie
```

### 2.2 Palette de Couleurs Détaillée

#### Couleur primaire (Corps tomate)
```
— Principal rouge : #E74C3C (RGB: 231, 76, 60)
— Dégradé sup. (plus clair) : #FF6B5B
— Dégradé inf. (plus sombre) : #C0392B
— Reflet/highlight lumineux : #FFAA88 (top-left, opacité 40%)
— Ombre portée : #8B2E1F (opacité 20%)
```

#### Feuille (cheveux verts)
```
— Vert frais principal : #4CAF50 (RGB: 76, 175, 80)
— Vert plus clair : #81C784
— Vert plus sombre : #388E3C
— Nervures : #2E7D32 (opacité 50%)
```

#### Yeux
```
— Blanc de l'œil : #FFFFFF
— Iris : #5DADE2 (bleu doux) ou #66BB6A (vert doux)
— Pupille : #000000
— Highlight : #FFFFFF (brillance)
— Cils : #333333
```

#### Visage
```
— Joues (blush) : #FF9E9E (rose doux, opacité 35%)
— Nez : #FFB6A3
— Bouche/lèvres : #E74C3C (rouge)
```

#### Accessoires optionnels
```
— Panier : #D4A574 (marron clair, osier)
— Panier ombre : #A0826D
```

---

## 3. Détails Visuels – Stylisation

### Ombres & Profondeur
- **Ombre générale (drop shadow)** : `0 8px 16px rgba(0,0,0,0.15)`
- **Ombre interne du corps** : dégradé vertical subtil (RGB plus sombre bas)
- **Highlights lumineux** : arc blanc translucide top-gauche (10% opacité)
- **Ligne de séparation** (feuille/corps) : aucune, fusion naturelle

### Arrondi & Finitions
- Tous les angles : **radius 8-16 px** (zéro coin angulaire)
- Trait de contour : **aucun** (fusion douce avec fond)
- Texture : **lisse, brillant** (pas de grain ou pattern)

### Style Visuel Global
- **Soft shading** : pas de bordures dures, dégradés fluides
- **Illustration premium** : finition Stripe / Notion level
- **Vectoriel pur** : SVG/Figma, pas de bitmap

---

## 4. Variations de Design

### 4.1 Pose – Demi-corps (pour intégration réduite)

```
— Délimitation : couper à la hauteur du milieu du corps
— Repositionner bras pour balance visuelle
— Ajouter petit panier à l'avant
— Dimensions : 160 × 160 px
— Utilité : sidebar, chat widget, notifications
```

### 4.2 Pose – Tête seule (pour favicon, avatar)

```
— Isoler la tête + feuille
— Taille : 64 × 64 px base (scalable en SVG)
— Simplifier légèrement les détails (lisibilité petite taille)
— Utilité : favicon, profil user, notifications
```

### 4.3 Expressions

#### Joie maximale (CTA clics, victoires)
- Yeux : plus grands, brillants ⭐
- Bouche : sourire très large (+10 px)
- Joues : blush plus prononcé
- Hausse légère (animation +5px)

#### Curiosité (hover, attente)
- Yeux : légèrement penché, 1 sourcil levé
- Bouche : petit sourire mystérieux
- Tête : inclinée 10°

#### Surprise (loading, chargement)
- Yeux : très grands (O_O)
- Bouche : petit "O" (astonishment)
- Bras : levés vers haut
- Animation : vibration légère

#### Approbation (validation, succès)
- Sourire chaleureux
- Clin d'œil (un œil fermé)
- Pouce levé (bras)
- Animation : saut léger

---

## 5. Accessoires & Objets

### Panier d'osier
```
— Dimensions : 80 × 50 px
— Couleur : #D4A574
— Texture : légères lignes diagonales (grille osier)
— Tenu à la main ou porté au bras
— Rempli de miniatures de produits :
   ├─ Tomates cerises rouges
   ├─ Laitue verte
   ├─ Carotte orange
   └─ Œufs (crème/blanc)
```

### Autres objets (cas spécifiques)
```
— Pouce levé : représentation stylisée (pas photoréaliste)
— Cœur : ♥ stylisé, rouge #E74C3C
— Fleur : simple, 5 pétales
— Signe check ✓ : vert #4CAF50
```

---

## 6. Responsive & Scalabilité

### Points d'arrêt (breakpoints)

| Contexte | Taille | Notes |
|----------|--------|-------|
| **Favicon** | 16 × 16 px | Très simplifié |
| **Avatar profile** | 64 × 64 px | Tête seule |
| **Chat bubble** | 80 × 80 px | Demi-corps |
| **Hero (desktop)** | 256 × 256 px | Pleine résolution |
| **Hero (mobile)** | 128 × 128 px | Adapté mobile |
| **Merchandise** | 1024 × 1024 px | Haute résolution |

### Simplification pour petites tailles (<80 px)
- Réduire détails des cils
- Merger les highlights en un seul
- Épaissir légèrement les traits pour lisibilité
- Maintenir expression (yeux, sourire)

---

## 7. Format & Exports

### Fichiers source
- **Figma** : master file avec tous les states
- **SVG** : export vectoriel clean pour web
- **Lottie JSON** : animations (voir document dédié)

### Exports PNG (fallback)
```
— 256 × 256 px @ 2x (512 px source)
— 512 × 512 px @ 1x
— 1024 × 1024 px @ 1x (merchandise)
— Fond : transparent (PNG-24)
— Compression : 8-bit indexed color si possible
```

### WebP (optimisé pour web)
```
— Même résolutions que PNG
— Compression qualité : 85%
— Champ alpha : oui (transparence)
```

---

## 8. Accessibilité

### Alt text / Description
```
Pour attribut `alt` :
"Récolte, mascotte tomate souriante Souki, agitant la main"

Ou version plus courte :
"Récolte, mascotte Souki"
```

### Motion preferences
```css
@media (prefers-reduced-motion: reduce) {
  /* Désactiver animations, garder 1 frame statique */
  animation: none !important;
}
```

### Contraste
- Vérifier rapport WCAG AA pour tous les textes/éléments
- Tomate rouge sur fond blanc : ✓ conforme

---

## 9. Checklist de Finalisation

- [ ] Design haute résolution Figma finalisé
- [ ] Palette couleurs validée (HEX + RGB)
- [ ] SVG clean exporté (test render)
- [ ] PNG 256/512/1024 exportés
- [ ] WebP versioning générée
- [ ] Animations Lottie créées & testées
- [ ] Responsive testing (64/128/256/512 px)
- [ ] Accessibilité validée (WCAG)
- [ ] Guide d'utilisation rédigé

---

*Document créé le 2026-05-19 | Version 1.0*
