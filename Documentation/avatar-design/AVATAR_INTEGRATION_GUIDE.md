# 🚀 Guide d'Intégration – Récolte Avatar (Front-end)

## 1. Vue d'ensemble

Ce guide décrit comment intégrer Récolte (mascotte tomate) dans le site Souki (Next.js 13+), avec support complet des animations, de la responsivité et de l'accessibilité.

### Stack technologique
- **Framework :** Next.js 13+ (App Router)
- **Animation :** Lottie (lottie-web)
- **Styles :** Tailwind CSS + CSS Modules optionnels
- **Formats :** SVG primaire, PNG/WebP fallback
- **Assets :** Hébergés dans `/public/avatar/`

---

## 2. Structure des fichiers

### Arborescence recommandée

```
front-end/
├── public/
│   └── avatar/
│       ├── illustrations/
│       │   ├── recolte-full.svg           # SVG principal
│       │   ├── recolte-bust.svg           # Demi-corps
│       │   ├── recolte-head.svg           # Tête seule
│       │   └── recolte-256.png            # PNG fallback
│       └── animations/
│           ├── idle-loop.json             # Respiration
│           ├── idle-bounce.json           # Balancement
│           ├── welcome.json               # Accueil
│           ├── hover-gaze.json            # Regard
│           ├── cart-success.json          # Succès panier
│           ├── wait.json                  # Attente
│           ├── loading.json               # Chargement
│           └── surprise.json              # Surprise
├── components/
│   └── Avatar/
│       ├── Avatar.tsx                     # Composant principal
│       ├── Avatar.module.css              # Styles spécifiques
│       ├── useAvatarState.ts              # Hook d'état
│       └── useAvatarAnimation.ts          # Hook animations Lottie
└── hooks/
    └── usePreferredMotion.ts              # Hook accessibilité
```

---

## 3. Installation des dépendances

```bash
# Dans front-end/
npm install lottie-web
# ou
yarn add lottie-web
pnpm add lottie-web
```

### Versions testées
- `lottie-web` >= 5.10.0
- Next.js 13+ ou 14+

---

## 4. Composant Principal – Avatar.tsx

### Implémentation simple

```typescript
// components/Avatar/Avatar.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import lottie from 'lottie-web';
import { usePreferredMotion } from '@/hooks/usePreferredMotion';
import styles from './Avatar.module.css';

type AnimationType = 
  | 'idle-loop' 
  | 'welcome' 
  | 'hover-gaze' 
  | 'cart-success' 
  | 'wait' 
  | 'loading'
  | 'surprise';

interface AvatarProps {
  /** Taille de l'avatar: 'small' (80px), 'medium' (128px), 'large' (256px) */
  size?: 'small' | 'medium' | 'large';
  /** Animation initiale au montage */
  initialAnimation?: AnimationType;
  /** Afficher l'avatar ou non */
  visible?: boolean;
  /** Callback quand l'avatar est cliquable */
  onClick?: () => void;
  /** Classes CSS supplémentaires */
  className?: string;
  /** Variation de pose: 'full' (corps complet), 'bust' (demi-corps), 'head' */
  variant?: 'full' | 'bust' | 'head';
}

export const Avatar: React.FC<AvatarProps> = ({
  size = 'medium',
  initialAnimation = 'welcome',
  visible = true,
  onClick,
  className = '',
  variant = 'full',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lottieRef = useRef<any>(null);
  const [currentAnimation, setCurrentAnimation] = useState<AnimationType>(initialAnimation);
  const [isHovering, setIsHovering] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState<NodeJS.Timeout | null>(null);
  const prefersReducedMotion = usePreferredMotion();

  // Tailles en pixels
  const sizeMap = {
    small: 80,
    medium: 128,
    large: 256,
  };

  const currentSize = sizeMap[size];

  // Charger l'animation Lottie
  useEffect(() => {
    if (!containerRef.current || !visible || prefersReducedMotion) {
      return;
    }

    // Déterminer quelle animation charger
    const animationPath = `/avatar/animations/${currentAnimation}.json`;

    if (lottieRef.current) {
      lottie.destroy();
    }

    lottieRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: currentAnimation.includes('idle') || currentAnimation === 'wait' || currentAnimation === 'loading',
      autoplay: true,
      path: animationPath,
    });

    return () => {
      if (lottieRef.current) {
        lottie.destroy();
      }
    };
  }, [currentAnimation, visible, prefersReducedMotion]);

  // Gérer l'inactivité (afficher "wait" après 30s)
  useEffect(() => {
    if (prefersReducedMotion || !visible) return;

    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);

      const timeout = setTimeout(() => {
        if (currentAnimation === 'idle-loop') {
          setCurrentAnimation('wait');
        }
      }, 30000); // 30 secondes

      setInactivityTimeout(timeout);
    };

    // Événements qui reset l'inactivité
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('click', resetInactivityTimer);
    document.addEventListener('keydown', resetInactivityTimer);

    resetInactivityTimer(); // Init au montage

    return () => {
      document.removeEventListener('mousemove', resetInactivityTimer);
      document.removeEventListener('click', resetInactivityTimer);
      document.removeEventListener('keydown', resetInactivityTimer);
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
    };
  }, [inactivityTimeout, currentAnimation, prefersReducedMotion, visible]);

  // Hover: regard qui suit + sourire
  const handleMouseEnter = () => {
    if (!prefersReducedMotion) {
      setIsHovering(true);
      setCurrentAnimation('hover-gaze');
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setCurrentAnimation('idle-loop');
  };

  // Click
  const handleClick = () => {
    if (prefersReducedMotion) return;
    setCurrentAnimation('surprise');
    // Relancer idle après surprise
    setTimeout(() => setCurrentAnimation('idle-loop'), 600);
    onClick?.();
  };

  // API publique pour déclencher des animations desde l'extérieur
  useEffect(() => {
    // Exposer une méthode globale pour déclencher des animations
    (window as any).avatarTrigger = (anim: AnimationType) => {
      setCurrentAnimation(anim);
      // Relancer idle après animations non-boucle
      if (!anim.includes('idle') && anim !== 'wait' && anim !== 'loading') {
        setTimeout(() => setCurrentAnimation('idle-loop'), 1500);
      }
    };

    return () => {
      delete (window as any).avatarTrigger;
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className={`${styles.avatarContainer} ${className}`}
      style={{
        width: `${currentSize}px`,
        height: `${currentSize}px`,
        cursor: 'pointer',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="img"
      aria-label="Récolte, mascotte Souki"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    />
  );
};

export default Avatar;
```

---

## 5. Styles CSS – Avatar.module.css

```css
/* components/Avatar/Avatar.module.css */

.avatarContainer {
  display: inline-block;
  position: relative;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
  user-select: none;
  -webkit-user-select: none;
  transition: filter 0.3s ease-out;
}

.avatarContainer:hover {
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.25));
}

.avatarContainer:active {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

/* Accessibilité: désactiver animations si préférence utilisateur */
@media (prefers-reduced-motion: reduce) {
  .avatarContainer {
    animation: none !important;
  }

  .avatarContainer * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Responsive */
@media (max-width: 640px) {
  .avatarContainer {
    /* Avatar peut être légèrement plus petit sur mobile si désiré */
    /* width: 90% !important; */
  }
}
```

---

## 6. Hooks Utilitaires

### Hook 1: usePreferredMotion.ts

```typescript
// hooks/usePreferredMotion.ts
import { useEffect, useState } from 'react';

/**
 * Hook pour respecter la préférence utilisateur `prefers-reduced-motion`
 * Retourne `true` si l'utilisateur a activé "réduire les animations"
 */
export const usePreferredMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Vérifier la préférence au montage
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Écouter les changements
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};
```

---

## 7. Intégration dans les Pages

### Exemple 1: Page d'accueil (Hero)

```typescript
// app/page.tsx
import Avatar from '@/components/Avatar/Avatar';

export default function Home() {
  return (
    <section className="relative min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Contenu texte */}
          <div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Bienvenue sur Souki
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Des produits frais, directement de la ferme à ton panier.
            </p>
            <button className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg">
              Découvrir
            </button>
          </div>

          {/* Avatar */}
          <div className="flex justify-center">
            <Avatar 
              size="large"
              initialAnimation="welcome"
              variant="full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

### Exemple 2: Sidebar / Chat Widget

```typescript
// components/ChatWidget.tsx
import Avatar from '@/components/Avatar/Avatar';

export function ChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white rounded-lg shadow-lg">
      <div className="flex items-center gap-3">
        <Avatar 
          size="small"
          variant="head"
          initialAnimation="idle-loop"
        />
        <div>
          <p className="font-semibold">Besoin d'aide ?</p>
          <p className="text-sm text-gray-600">Parle avec Récolte!</p>
        </div>
      </div>
    </div>
  );
}
```

### Exemple 3: Déclencher animation depuis l'extérieur (ajout panier)

```typescript
// hooks/useAddToCart.ts
export function useAddToCart() {
  const handleAddToCart = (productId: string) => {
    // ... logique métier
    
    // Déclencher animation du avatar
    if (typeof window !== 'undefined' && window.avatarTrigger) {
      window.avatarTrigger('cart-success');
    }
  };

  return { handleAddToCart };
}
```

---

## 8. États & Cas d'Usage

### Matrice de placement

| Contexte | Taille | Variant | Animation | Note |
|----------|--------|---------|-----------|------|
| **Hero page** | large (256px) | full | welcome → idle | Premier impact |
| **Chat widget** | small (80px) | head | idle-loop | Sidebar fixe |
| **Panier (success)** | medium (128px) | full | cart-success | Feedback positif |
| **Loading page** | medium (128px) | head | loading | Distraction patiente |
| **Profil user** | small (80px) | head | idle-loop | Avatar profile |
| **Notification** | small (64px) | head | pulse | Toast/alert |

---

## 9. Accessibilité

### ARIA Labels
```html
<!-- Avatar principal -->
<div 
  role="img" 
  aria-label="Récolte, mascotte Souki accueillante"
></div>

<!-- Avatar interactive -->
<button 
  aria-label="Cliquer pour interagir avec Récolte"
  onClick={handleClick}
>
  <Avatar />
</button>
```

### Keyboard Navigation
```typescript
// Avatar doit être focusable et clickable au clavier
<div
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
/>
```

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  /* Toutes les animations s'arrêtent */
  animation: none !important;
}
```

---

## 10. Optimisations Performance

### Code Splitting
```typescript
// Charger Avatar au besoin (lazy)
import dynamic from 'next/dynamic';

const Avatar = dynamic(() => import('@/components/Avatar/Avatar'), {
  loading: () => <div className="w-32 h-32 bg-gray-200 rounded-full animate-pulse" />,
  ssr: false, // Éviter SSR complexity
});
```

### Image Optimization
```typescript
// Utiliser next/image pour PNG fallback
import Image from 'next/image';

<Image
  src="/avatar/illustrations/recolte-256.png"
  alt="Récolte"
  width={256}
  height={256}
  priority // Pour hero section
/>
```

### Lottie Lazy Loading
```typescript
// Charger animations à la demande, pas toutes au démarrage
const animationPath = `/avatar/animations/${animation}.json`;
// Lottie charge le JSON via fetch au moment du besoin
```

---

## 11. Déploiement & Build

### Build Next.js
```bash
npm run build
npm start

# Ou pour production
npm run export  # Static generation
```

### Vérifications pré-deployment
- [ ] Avatar se charge correctement (SVG + Lottie)
- [ ] Animations fluides (no jank) sur desktop et mobile
- [ ] Fallback PNG fonctionne si Lottie échoue
- [ ] Accessibility audit (WCAG AA) passed
- [ ] Performance score > 90 (Lighthouse)

---

## 12. Troubleshooting

| Problème | Solution |
|----------|----------|
| Avatar ne charge pas | Vérifier path JSON en `/public/avatar/animations/` |
| Animation saccadée | Réduire FPS Lottie, vérifier perf du device |
| Lottie bloque le rendu | Utiliser `dynamic()` pour lazy loading |
| Texte pas accessible | Ajouter `role="img"` + `aria-label` |
| Animations lentes sur mobile | Activer Canvas rendering au lieu de SVG |

---

## 13. Évolutions Futures

- [ ] Intégration voice (Récolte parle avec AI)
- [ ] Touch gestures (swipe, pinch)
- [ ] Companion mode (suit le scroll)
- [ ] Merchandise tie-in (achat de figurine Récolte)
- [ ] AR filter (réalité augmentée sur mobile)

---

*Document créé le 2026-05-19 | Version 1.0*
