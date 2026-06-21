# 🎬 Animations & Micro-interactions – Récolte

## 1. Architecture Animations

### Structure des fichiers Lottie

```
souki-avatar-animations/
├── idle-loop.json                    # Animation respiration + clignement (boucle)
├── idle-bounce.json                  # Petit balancement naturel (boucle)
├── interaction-welcome.json          # Apparition + salut (non-boucle, <2s)
├── interaction-hover-gaze.json       # Regard vers curseur (boucle simple)
├── interaction-hover-smile.json      # Sourire élargi (non-boucle, 1s)
├── interaction-cart-thumbsup.json    # Pouce levé de joie (non-boucle, 1.5s)
├── interaction-idle-wait.json        # Tête penchée, attente (boucle lente)
├── interaction-loading-spin.json     # Légère rotation patiente (boucle)
└── expression-surprise.json          # Yeux grands, bouche O (non-boucle)
```

---

## 2. Animation 1: IDLE LOOP – Respiration Douce

### Spécifications
- **Durée :** 3000 ms (3 secondes par cycle complet)
- **Easing :** ease-in-out
- **Loop :** oui (infini)
- **Opacité :** 100% (constante)
- **Intention :** avatar vivant mais calme, respire doucement

### Keyframes principaux

| Frame | Temps | Description |
|-------|-------|-------------|
| 0% | 0ms | Position Y: 0 px |
| 50% | 1500ms | Position Y: +6 px (exhale douce) |
| 100% | 3000ms | Position Y: 0 px (inhale) |

### Couches animées
- **Corps (groupe principal):** translation Y
- **Feuille (cheveux):** oscillation Y synchrone (-3 px)
- **Yeux :** clignement intercalé (~50% de la respiration)
  - 0-50% : ouvert
  - 50-60% : fermeture (2 frames)
  - 60-65% : fermé
  - 65-100% : ouverture (2 frames)

### Code pseudo-Lottie
```json
{
  "name": "idle-respiration",
  "duration": 3000,
  "frameRate": 60,
  "loop": true,
  "layers": [
    {
      "id": "body",
      "type": "group",
      "keyframes": [
        {"t": 0, "value": {"y": 0}},
        {"t": 1500, "value": {"y": 6}},
        {"t": 3000, "value": {"y": 0}}
      ],
      "easing": "ease-in-out"
    },
    {
      "id": "eyes-blink",
      "type": "layer",
      "keyframes": [
        {"t": 1800, "value": {"scale": [1, 0]}},
        {"t": 1900, "value": {"scale": [0, 0]}},
        {"t": 2000, "value": {"scale": [1, 0]}}
      ]
    }
  ]
}
```

---

## 3. Animation 2: IDLE BOUNCE – Balancement Léger

### Spécifications
- **Durée :** 2500 ms
- **Easing :** ease-in-out cubic
- **Loop :** oui
- **Intention :** avatar danse légèrement, impatient/joyeux

### Mouvement principal
- **Rotation légère :** ±3°, autour du centre de gravité
- **Oscillation panier** (si présent) : oscillation additionnelle +4°

| Frame | Temps | Rotation | Description |
|-------|-------|----------|-------------|
| 0% | 0ms | -3° | Penché gauche |
| 25% | 625ms | 0° | Centre |
| 50% | 1250ms | +3° | Penché droit |
| 75% | 1875ms | 0° | Centre |
| 100% | 2500ms | -3° | Penché gauche |

---

## 4. Animation 3: WELCOME – Apparition + Salut

### Spécifications
- **Durée :** 1800 ms
- **Easing :** ease-out (rebond subtil)
- **Loop :** non (joue une seule fois au chargement)
- **Intention :** accueil chaleureux, première impression positive

### Phases

#### Phase 1 (0-300ms) : Apparition "pop"
```
Opacity : 0% → 100%
Scale : 80% → 105% (rebond léger)
Y : +20 px → 0 px (descente)
```

#### Phase 2 (300-1200ms) : Stabilisation
```
Scale : 105% → 100%
Easing : ease-out
```

#### Phase 3 (300-1800ms) : Salut de la main 👋
```
Bras droit :
  ├─ Rotation : 0° → 45° → 0° (cycle)
  ├─ Durée : 1500 ms
  └─ Easing : ease-in-out
```

---

## 5. Animation 4: HOVER – Regard qui suit le curseur

### Spécifications
- **Durée :** variable (adaptatif au curseur)
- **Easing :** ease-out
- **Loop :** n/a (temps réel)
- **Intention :** interaction directe, sentiment de connection

### Fonctionnement (JavaScript)
```javascript
// Pseudo-code
document.addEventListener('mousemove', (e) => {
  const avatarRect = avatar.getBoundingClientRect();
  const avatarCenterX = avatarRect.left + avatarRect.width / 2;
  const avatarCenterY = avatarRect.top + avatarRect.height / 2;
  
  const angle = Math.atan2(e.clientY - avatarCenterY, e.clientX - avatarCenterX);
  const distance = Math.min(8, ...) // max 8px de décalage
  
  eyes.style.transform = `translate(
    ${Math.cos(angle) * distance}px, 
    ${Math.sin(angle) * distance}px
  )`;
});
```

### Sourire élargi (optionnel, phase 2)
```
Si hover > 0.5s:
  Bouche : sourire normal → sourire large (+15% hauteur)
  Yeux : léger fermeture (bonheur)
  Joues : blush +20% opacité
  Durée transition : 300ms
```

---

## 6. Animation 5: CART SUCCESS – Pouce Levé / Saut

### Spécifications
- **Déclencheur :** `onAddToCart()` event
- **Durée :** 1500 ms
- **Easing :** ease-out
- **Loop :** non
- **Intention :** célébration, renforcement positif

### Phases

#### Phase 1 (0-800ms) : Saut de joie
```
Y : 0 → -40 px → 0 px
Scale : 100% → 110% → 100%
Easing : ease-out
```

#### Phase 2 (200-1500ms) : Pouce levé
```
Bras droit :
  ├─ Rotation : 0° → -90° (pointing up)
  ├─ Scale : 100% → 120%
  └─ Durée : 800 ms
Pouce : animation d'apparition (opacity 0→1)
```

#### Phase 3 (1000-1500ms) : Clin d'œil
```
Oeil gauche : fermeture (blink) avec sourire large
```

### Émoji optionnel (overlay)
```
Position : top de l'avatar, +30px
Emoji : "✨" ou "🎉"
Animation : flottement vers le haut puis fade-out
Durée : 1500 ms
```

---

## 7. Animation 6: IDLE WAIT – Attente/Inactivité (>30s)

### Spécifications
- **Déclencheur :** inactivité > 30 secondes
- **Durée :** 2000 ms (cycle)
- **Easing :** ease-in-out
- **Loop :** oui
- **Intention :** attirer l'attention, invitation à interagir

### Comportement

#### Phase 1 (0-600ms) : Inclinaison de tête
```
Tête :
  ├─ Rotation : 0° → -15° (penché gauche)
  ├─ Yeux : normaux
  └─ Easing : ease-out
```

#### Phase 2 (600-1200ms) : Attente
```
Tête : reste à -15°
Yeux : clignement (1 fois)
Expression : curiosité (1 sourcil levé)
```

#### Phase 3 (1200-2000ms) : Retour normal
```
Tête : -15° → 0°
Easing : ease-out
Puis boucle...
```

---

## 8. Animation 7: LOADING – Spinner Patient

### Spécifications
- **Déclencheur :** loading state
- **Durée :** 2000 ms
- **Easing :** linear
- **Loop :** oui
- **Intention :** feedback non-verbal, "j'attends avec toi"

### Comportement
```
Rotation globale : 360° complète par cycle
├─ Durée : 2000 ms
├─ Easing : linear
└─ Direction : sens des aiguilles d'une montre

Couplage optionnel avec respiration douce :
└─ Amplitude réduite (-50%), maintient "vie"
```

### Indicateur optionnel
```
Anneau de chargement autour du personnage
├─ Couleur : vert #4CAF50
├─ Largeur : 3 px
├─ Pourcentage animé : 0% → 100% (inutile mais joli)
└─ Opacity : 60%
```

---

## 9. Animation 8: SURPRISE – Yeux Grands

### Spécifications
- **Déclencheur :** événement surprise (ex. validation inattendue)
- **Durée :** 600 ms
- **Easing :** ease-out
- **Loop :** non
- **Intention :** humour, réaction émotionnelle

### Phases

#### Keyframes
```
0ms :   Yeux normaux
100ms : Yeux à 150% de taille (O_O)
300ms : Maintien
450ms : Retour progressif (yeux normaux)
600ms : Fin
```

#### Bouche
```
0ms :   Sourire normal
100ms : Petite surprise (O)
300ms : Maintien léger
450ms : Retour sourire
```

---

## 10. Transitions Entre États

### Flow Chart d'Animation

```
Chargement (page load)
└─ Welcome animation (1.8s)
   └─ Idle Loop (continu)
       ├─ [Hover] → Gaze + Smile (overlay)
       │  └─ Exit hover → Idle Loop
       ├─ [Cart] → Cart Success (1.5s)
       │  └─ Idle Loop
       ├─ [>30s inactif] → Idle Wait (loop)
       │  └─ Click / Hover → Idle Loop
       ├─ [Loading] → Spinner (loop)
       │  └─ Load done → Idle Loop + pop
       └─ [Surprise event] → Surprise (0.6s)
          └─ Idle Loop
```

### Règles de Transition
- **Toujours smooth :** pas de "jump" visuel entre animations
- **Interruption gracieuse :** si une anim est coupée, retour progressif au state principal
- **Priorité :** animations déclenchées > idle (hover interrompt idle respiration)
- **Queueing :** 2 events rapides = queueing en séquence, pas de chevauchement

---

## 11. Performance & Optimisations

### Fichiers Lottie
- **Compression :** minifier JSON, supprimer métadonnées inutiles
- **Taille cible :** < 100 KB par animation (< 50 KB idéal)
- **Frame rate :** 30 FPS pour idle, 60 FPS pour interactions

### Rendu Web
- **Lottie-web** : library recommandée
- **Canvas vs SVG :** SVG pour simplicité, Canvas si +5 animations simultanées
- **Lazy load :** charger animations à la demande (page load = welcome seulement)

### Mobile
- **CPU saver :** reduce motion si batterie < 20%
- **FPS adaptatif :** 30 FPS sur mobile, 60 FPS sur desktop
- **Fallback statique :** PNG si perfs dégradées

---

## 12. Export & Validation

### Checklist avant livraison
- [ ] Chaque JSON valide (test via lottie.io/preview)
- [ ] Durée des animations confirmée
- [ ] Loop settings correctes
- [ ] Easing curves smooth
- [ ] Pas de glitches visuels en scrubbing
- [ ] Taille fichier < 100 KB
- [ ] Compatibilité navigateurs testée (Chrome, Firefox, Safari, Edge)
- [ ] Mobile rendering OK (iOS + Android)

---

## 13. Fallback Statique

Pour navigateurs sans support Lottie ou si JS désactivé :

```
— Format : PNG animé (APNG) ou WebP animé
— Durée : 3 secondes (respiration)
— Taille : 256 × 256 px
— Compression : 8-bit + dithering pour qualité
```

---

*Document créé le 2026-05-19 | Version 1.0*
