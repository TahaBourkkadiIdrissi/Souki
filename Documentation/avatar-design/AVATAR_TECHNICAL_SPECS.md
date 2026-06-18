# ⚙️ Spécifications Techniques – Récolte Avatar

## 1. Vue d'ensemble

Document de référence pour tous les aspects techniques de Récolte (mascotte tomate Souki) : formats, résolutions, performances, compatibilité, et livrables.

---

## 2. Formats & Exports

### 2.1 Format Vectoriel (Source)

**Figma File**
```
Projet:           souki-avatar
Fichier:          Recolte-MasterFile.fig
Vers 2026-05-19:  V1.0-Final
Structure:        
  ├─ Full-Body (256 × 256)
  ├─ Bust (128 × 128)
  ├─ Head-Only (64 × 64)
  ├─ Expressions (variations émotionnelles)
  └─ Animations (keyframes pour Lottie)

Accès:            [Team Souki Figma workspace]
Collaborateurs:   Designer, Dev Front-end
```

**SVG Clean Export**
```
Chemin:           /public/avatar/illustrations/
Fichiers:
  ├─ recolte-full.svg       (256 × 256)
  ├─ recolte-bust.svg       (128 × 128)
  ├─ recolte-head.svg       (64 × 64)

Spécifications SVG:
  ├─ Version:              1.1
  ├─ Encoding:            UTF-8
  ├─ Color space:         sRGB
  ├─ Embedded fonts:       Non (utiliser fonts système)
  ├─ Metadata:            Minimal (supprimer Figma tags)
  └─ Optim:               SVGO (compresser)

Taille cible:     < 50 KB par fichier
```

---

### 2.2 Format PNG (Fallback statique)

**PNG Standard**
```
Resolutions:
  ├─ 256 × 256 px (@1x)     → recolte-256.png
  ├─ 512 × 512 px (@2x)     → recolte-512.png
  └─ 1024 × 1024 px (@1x)   → recolte-1024.png

Spécifications:
  ├─ Color depth:          24-bit + 8-bit alpha (PNG-32)
  ├─ Compression:          9 (pngquant ou similar)
  ├─ Interlacing:          Adam7 (optionnel, pour UX)
  ├─ Gamma:               sRGB (2.2)
  ├─ Background:          Transparent
  └─ DPI:                 72 (web standard)

Optimisation:
  └─ Utiliser imagemin-pngquant ou TinyPNG
  
Taille cible:     < 150 KB par fichier
```

---

### 2.3 Format WebP (Modern, optimisé)

**WebP Animated**
```
Resolutions:
  ├─ 256 × 256 px
  ├─ 512 × 512 px
  └─ 1024 × 1024 px

Spécifications:
  ├─ Format:               WebP VP8L (lossless) ou VP8 (lossy)
  ├─ Qualité:             85% (balance taille/qualité)
  ├─ Animation:           Yes, si breathing effect
  ├─ Background:          Transparent (RGBA)
  └─ Method:              6 (meilleure compression)

Compatibilité:
  └─ Support navigateurs: Chrome 23+, Edge 18+, Firefox 65+, Safari 16+
  
Taille cible:     < 80 KB par fichier (30-40% réduction vs PNG)
```

---

### 2.4 Format Lottie (Animations)

**Lottie JSON Files**

```
Chemin:           /public/avatar/animations/

Fichiers:
├─ idle-loop.json              (Respiration ~3s)
├─ idle-bounce.json            (Balancement ~2.5s)
├─ welcome.json                (Apparition + salut, 1.8s)
├─ hover-gaze.json             (Regard curseur, adaptif)
├─ hover-smile.json            (Sourire élargi, 1s)
├─ cart-success.json           (Pouce + saut, 1.5s)
├─ wait.json                   (Attente patient, 2s)
├─ loading.json                (Spinner, 2s)
├─ surprise.json               (Yeux grands, 0.6s)
├─ clin-doeil.json             (Clin d'œil, 0.8s)
└─ dance.json                  (Petite danse, 2.5s)

Spécifications JSON:
├─ Exporter depuis:   Figma → Figma Prototyping / Rive / LottieFiles
├─ Version Lottie:    5.7.0+
├─ Frame rate:        30 FPS (idle), 60 FPS (interactions)
├─ Format output:     JSON minifié (pas de commentaires)
├─ Loop:              Variable par animation
└─ Size limit:        < 100 KB par fichier

Tools de création:
├─ Option 1: Adobe Animate → export Lottie
├─ Option 2: Figma + LottieFiles plugin
├─ Option 3: Rive (vecteur + animation native)
└─ Validation: lottie.io/preview (test avant livraison)
```

---

## 3. Résolutions & Points d'Arrêt

### 3.1 Grille de résolutions

| Contexte | Taille | Format | Mobile | Desktop |
|----------|--------|--------|--------|---------|
| **Favicon** | 16 × 16 | PNG | ✓ | ✓ |
| **Avatar profil** | 64 × 64 | PNG | ✓ | ✓ |
| **Chat widget** | 80 × 80 | SVG/PNG | ✓ | ✓ |
| **Hero section** | 128 × 128 | SVG | ✓ | |
| **Hero section** | 256 × 256 | SVG/WebP | | ✓ |
| **Social media** | 512 × 512 | PNG/WebP | | ✓ |
| **Merchandise** | 1024 × 1024 | PNG | | ✓ |

### 3.2 Responsive Breakpoints (CSS)

```css
/* Extra small */
@media (max-width: 320px) {
  .avatar { width: 64px; height: 64px; }
}

/* Small */
@media (min-width: 321px) and (max-width: 640px) {
  .avatar { width: 96px; height: 96px; }
}

/* Medium */
@media (min-width: 641px) and (max-width: 1024px) {
  .avatar { width: 128px; height: 128px; }
}

/* Large */
@media (min-width: 1025px) {
  .avatar { width: 256px; height: 256px; }
}
```

---

## 4. Performance & Optimisation

### 4.1 Budgets Web

**Recommandations Mozilla / Web.dev**

```
Initial page load (3G):
├─ Avatar SVG:        < 50 KB
├─ Lottie JSON:       < 50 KB (lazy-loaded)
├─ PNG fallback:      < 150 KB
└─ Total:            < 150 KB au chargement

FCP (First Contentful Paint):
└─ Avatar doit être visible < 2s

LCP (Largest Contentful Paint):
└─ Hero avatar chargé < 3s

CLS (Cumulative Layout Shift):
└─ Avatar placé avec dimensions fixes → CLS = 0
```

### 4.2 Optimisation Images

```bash
# SVG: SVGO
svgo recolte-full.svg -o recolte-full.min.svg

# PNG: ImageMin
imagemin recolte-256.png --out-dir=dist --plugin=pngquant

# WebP: cwebp
cwebp recolte-256.png -o recolte-256.webp -q 85
```

### 4.3 Caching

```html
<!-- Long-term caching (1 year) pour assets immuables -->
<img src="/avatar/recolte-256.png?v=1.0" 
     cache-control="public, max-age=31536000">

<!-- Service Worker pour offline support -->
precacheAndRoute([
  '/avatar/animations/idle-loop.json',
  '/avatar/illustrations/recolte-full.svg',
  // ...
]);
```

---

## 5. Compatibilité Navigateurs

### 5.1 Support Minimal

```
Chrome/Chromium:   80+  (99% utilisateurs)
Firefox:           75+  (95% utilisateurs)
Safari:            13+  (95% utilisateurs)
Edge:              80+  (99% utilisateurs)
```

### 5.2 Feature Support

| Feature | IE11 | Chrome | Firefox | Safari | Edge |
|---------|------|--------|---------|--------|------|
| **SVG** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Lottie** | ✓ (transpile) | ✓ | ✓ | ✓ | ✓ |
| **PNG** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **WebP** | ✗ | ✓ | ✓ | ✗ (Safari < 16) | ✓ |
| **CSS Grid** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Flexbox** | Partial | ✓ | ✓ | ✓ | ✓ |

### 5.3 Fallback Strategy

```
Navigateur moderne (Chrome, Firefox, Safari 14+)?
  └─ Lottie JSON → SVG animation
  
Navigateur ancien (IE11, Safari 12)?
  └─ PNG static (pas d'animation)
  
JS désactivé?
  └─ PNG static avec `<noscript>`
  
WebP support?
  └─ WebP ; sinon PNG
```

---

## 6. Accessibilité (WCAG 2.1 AA)

### 6.1 Attributs ARIA

```html
<!-- Avatar statique -->
<div role="img" 
     aria-label="Récolte, mascotte Souki">
  <svg>...</svg>
</div>

<!-- Avatar interactif (clickable) -->
<button aria-label="Interagir avec Récolte"
        aria-pressed="false"
        onClick={...}>
  <svg>...</svg>
</button>

<!-- Avec description supplémentaire -->
<figure role="img">
  <img alt="Récolte, mascotte tomate" src="..." />
  <figcaption>Récolte t'accueille sur Souki</figcaption>
</figure>
```

### 6.2 Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  .avatar-animation {
    animation: none !important;
    transition: none !important;
  }

  .lottie-container {
    display: none; /* Fallback PNG instead */
  }
}

@supports not (animation-timeline: view()) {
  /* Fallback pour vieux navigateurs */
  .avatar { opacity: 0.8; }
}
```

### 6.3 Color Contrast

```
Récolte sur fond blanc:
├─ Couleur tomate (#E74C3C) vs blanc (#FFF):
│  └─ Ratio: 3.7:1 (WCAG AA) ✓
├─ Yeux noirs (#000) vs blanc:
│  └─ Ratio: 21:1 (WCAG AAA) ✓
└─ Texte sur tomate:
   └─ Contrast testée via WebAIM Contrast Checker
```

---

## 7. Performance Budgets (Lighthouse)

### Scores cibles

```
Métrique                Cible    Priority
─────────────────────────────────────────
Performance            90+      Critique
Accessibility          95+      Critique
Best Practices         90+      Élevée
SEO                    90+      Élevée
CLS (Layout shift)     < 0.1    Critique
LCP (Largest paint)    < 2.5s   Critique
FCP (First paint)      < 1.8s   Élevée
```

### Audit avec Lighthouse

```bash
# Local audit
npx lighthouse https://souki.dev/avatar --view

# CI/CD integration
npm install -g @lhci/cli@^0.10.0
lhci autorun
```

---

## 8. Livrables Finaux

### Checklist de livraison

```
📦 ASSETS
├─ Figma file (master)
├─ SVG exports (full, bust, head)
├─ PNG exports (256, 512, 1024)
├─ WebP exports (256, 512, 1024)
└─ Lottie JSONs (11 animations)

📋 DOCUMENTATION
├─ AVATAR_CONCEPTS.md (3 propositions)
├─ AVATAR_DESIGN_SYSTEM.md (design détaillé)
├─ AVATAR_ANIMATIONS.md (specs animations)
├─ AVATAR_INTEGRATION_GUIDE.md (intégration front)
├─ AVATAR_MASCOTTE_CHARTER.md (charte marque)
└─ AVATAR_TECHNICAL_SPECS.md (ce document)

🔧 CODE
├─ Avatar.tsx (composant React)
├─ Avatar.module.css (styles)
├─ useAvatarState.ts (hook état)
├─ useAvatarAnimation.ts (hook Lottie)
├─ usePreferredMotion.ts (hook a11y)
└─ [Autres composants selon intégration]

🧪 TESTS
├─ Responsive testing (64-1024 px)
├─ Accessibility audit (WCAG AA)
├─ Browser compatibility (Chrome, FF, Safari, Edge)
├─ Performance audit (Lighthouse > 90)
└─ Animation smoothness (60 FPS target)

📸 ASSETS ADDITIONNELS (optionnel)
├─ Variations saisonnières (Halloween, Noël)
├─ Emojis Récolte (16, 32, 64 px)
├─ GIF animé (fallback si Lottie échoue)
└─ Print assets (affiche A3, flyer A5)
```

---

## 9. Contrôle Qualité

### 9.1 Checklist de QA

#### SVG & PNG
- [ ] Rendu correct dans tous navigateurs
- [ ] Fond transparent OK
- [ ] Dimensions exactes
- [ ] Pas d'artefacts ou pixelisation
- [ ] Taille fichier dans les budgets

#### Lottie
- [ ] JSON valide (test lottie.io/preview)
- [ ] Animations smooth (no frame drops)
- [ ] Loop settings correctes
- [ ] Easing curves fluides
- [ ] Pas de glitches au scrubbing
- [ ] Taille < 100 KB

#### Accessibilité
- [ ] Alt texts descriptifs
- [ ] ARIA labels présents
- [ ] Keyboard navigation OK
- [ ] prefers-reduced-motion respecté
- [ ] Contrast ratio ≥ 3:1 (AA)

#### Performance
- [ ] Lighthouse performance ≥ 90
- [ ] CLS < 0.1
- [ ] LCP < 2.5s
- [ ] FCP < 1.8s
- [ ] Aucun jank en scrolling

#### Mobile
- [ ] Responsive sur 320px - 1400px
- [ ] Touch-friendly (tap zones ≥ 48px)
- [ ] Performance sur 3G slow
- [ ] Battery usage acceptable

---

## 10. Processus de Livraison

### Timeline recommandée

```
Semaine 1 : Concepts & feedback initial
Semaine 2 : Design final + animations
Semaine 3 : Lottie export + optimisation
Semaine 4 : Intégration front-end + tests
Semaine 5 : QA complète + ajustements
Semaine 6 : Déploiement en staging
Semaine 7 : Déploiement production
```

### Sign-off Process

```
1. Designer : Validation design final
2. Brand Manager : Approbation charte mascotte
3. Dev Lead : Approbation intégration technique
4. QA : Approbation tests complets
5. Product Owner : Approbation UX/concept
6. Executive : Approbation finale
```

---

## 11. Maintenance & Évolutions

### Support post-launch

```
Bugs critiques:        < 24h response
Questions design:      < 48h response
Feature requests:      Review mensuel
Maintenance:           Patchs SVG/Lottie au besoin
Analytics:             Track engagement avatar
```

### Version Control

```
Git repo:   /avatar-assets/ (private)
Releases:   v1.0, v1.1, etc.
Changelog:  CHANGELOG.md (détaillé)
Tags:       git tag v1.0-recolte-launch
```

---

## 12. Contacts & Ressources

### Team Souki
- **Design Lead :** [Name] – avatar@souki.dev
- **Dev Lead :** [Name] – frontend@souki.dev
- **Brand Manager :** [Name] – brand@souki.dev

### Ressources
- Figma Workspace : [Link]
- Lottie Documentation : https://lottie.js.org/
- WCAG Guidelines : https://www.w3.org/WAI/WCAG21/quickref/
- Lighthouse : https://web.dev/lighthouse/

---

*Document créé le 2026-05-19 | Version 1.0*
*Prochaine révision : 2026-09-19*
