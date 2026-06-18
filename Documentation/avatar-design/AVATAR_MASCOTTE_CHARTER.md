# 📘 Charte Mascotte Récolte

## 1. Identité & Personnage

### Profil de Récolte
```
Nom:           Récolte (Chéri/e en variante affectueuse)
Espèce:        Tomate anthropomorphe joyeuse
Sexe:          Neutre / Inclusive (pas de marqueurs genrés)
Âge:           Jeune (5-7 ans en apparence, mais sagesse enfantine)
Personnalité:  Enthousiaste, accueillante, honnête, généreuse

Origine:       Directement de la ferme Souki
Mission:       Accueillir les visiteurs et célébrer les produits frais
Relation:      Ami(e) du consommateur, pas de relation de vente

Style:         2D vectoriel premium, doux, lumineux, moderne
```

### Personnalité en 3 mots
1. **Accueillante** – souriante, ouverte, positive
2. **Authentique** – fière de ses racines fermières, sincère
3. **Espiègle** – ludique, un brin taquine, amusante

### Valeurs incarnées
✅ Fraîcheur (produits) & fraîcheur (design moderne)  
✅ Authenticité (ferme réelle, pas d'artifice)  
✅ Convivialité (communauté, partage, générosité)  
✅ Durabilité (nature, responsabilité écologique)  

---

## 2. Vocabulaire & Ton de Voix

### Registre de langage
- **Tutoiement** : toujours, pour proximité
- **Formalité** : zéro – très décontracté
- **Emojis** : oui, utilisés avec parcimonie et pertinence
- **Ponctuation** : points d'exclamation et d'interrogation abondants

### Phrases-types (bulles de texte)

#### Accueil
```
"Bienvenue à la ferme Souki! 🌾"
"Salut! Je m'appelle Récolte!"
"Heureux(se) de te voir par ici 😊"
"Viens goûter la fraîcheur!"
```

#### Incitation action
```
"Explore nos produits! 🧺"
"Qu'est-ce qui te tente aujourd'hui?"
"Construis ton panier parfait! 🥗"
"Direct de la ferme à ton assiette"
```

#### Validation & positivité
```
"Excellent choix! 👍"
"Tu as du goût, toi!"
"Yay! Dans ton panier! 🎉"
"Parfait pour ce soir?"
```

#### Attente / Amusement
```
"T'as besoin d'aide?"
"Quelque chose te plaît?"
"Je t'attends, je t'attends... ⏳"
"Dis-moi si tu veux des conseils!"
```

#### Remerciement
```
"Merci pour ta confiance! ❤️"
"À bientôt sur Souki!"
"Bon marché! 🛒"
```

---

## 3. Poses & Expressions

### Pose 1: Stance Neutre (défaut)

```
Description:
  Debout, de face, sourire doux
  Bras légèrement écartés (position détente)
  Feuille verte droite, légèrement penchée à droite
  Panier à la main gauche

Usage: 
  Idle loop, page d'attente, background
  
Dimensions: 256 × 256 px
```

### Pose 2: Accueil Chaleureux

```
Description:
  Bras levés, paumes ouvertes vers le haut
  Sourire large et sincère
  Légère inclinaison du corps vers l'avant (invitation)
  Yeux brillants, légèrement fermés (bonheur)

Usage: 
  Welcome animation, hero section, onboarding
  
Message émotionnel:
  "Je suis ravi(e) de te voir! Bienvenue!"
```

### Pose 3: Pouce Levé (Victoire)

```
Description:
  Bras droit levé, pouce pointé vers le haut
  Sourire radieux, clin d'œil (gauche)
  Petit saut (animation)
  Énergie positive maximale

Usage: 
  Cart success, validation, achievement
  
Message:
  "Excellent! Bravo! 👍"
```

### Pose 4: Curiosité (Hover)

```
Description:
  Tête légèrement inclinée (~10°)
  Un sourcil levé, sourire mystérieux
  Yeux qui regardent vers le curseur
  Corps légèrement penché

Usage: 
  Hover state, interactive moment
  
Message:
  "Dis-moi tout... J'écoute!"
```

### Pose 5: Attente Patient(e)

```
Description:
  Tête penchée à la gauche (~20°)
  Expression douce, légèrement inquiète
  Main sur la joue (pensif/réflexif)
  Bras droit à la verticale, panier

Usage: 
  Inactivity (>30s), "wait" animation
  
Message:
  "T'es sûr(e) que tout va bien? 😊"
```

### Pose 6: Surprise / Étonnement

```
Description:
  Yeux très grands (O_O) 
  Bouche en petit "O" (astonishment)
  Bras levés sur les côtés (shocked but happy)
  Léger vibration (énergie surprise)

Usage: 
  Surprise event, unexpected interaction
  
Message:
  "Wow! Vraiment?? 😲"
```

### Pose 7: Pensif/Consultation

```
Description:
  Main sur le menton (réflexion)
  Regard légèrement vers le haut
  Sourire doux et encourageant
  Posture détendue mais active

Usage: 
  Help section, FAQ, consultation
  
Message:
  "Laisse-moi t'aider à trouver ce qu'il te faut!"
```

---

## 4. Expressions Faciales

### Matrice d'émotions

| Émotion | Yeux | Sourcils | Bouche | Joues |
|---------|------|----------|--------|-------|
| **Neutre** | Normal | Horizontal | Sourire doux | Blush léger |
| **Joie** | Grand, brillant ✨ | Légèrement levé | Sourire large | Blush prononcé |
| **Surprise** | Très grand (O_O) | Levé au max | Petit "O" | Blush max |
| **Curiosité** | Normal | 1 levé (smirk) | Sourire mystérieux | Blush normal |
| **Attente** | Normal | Légèrement baissé | Sourire léger | Blush normal |
| **Amusement** | Fermé (bonheur) | Levé | Sourire large | Blush prononcé |
| **Réflexion** | Regardant haut | Neutre | Sourire doux | Blush léger |
| **Fierté** | Normal, brillant | Normal | Sourire confiant | Blush chaleureux |

---

## 5. Interactions Spécifiques

### 5.1 Quand l'utilisateur arrive sur le site
```
Déroulement:
  1. Chargement (opacité 0%)
  2. Pop d'apparition (scale 80% → 105%)
  3. Salut de main (3 cycles rapides)
  4. Expression accueil chaleureux
  5. Transition vers idle-loop

Durée totale: 1.8s
Bulle de texte: "Bienvenue sur Souki! 🌾"
Ressenti: Enthousiasme, chaleur humaine
```

### 5.2 Quand l'utilisateur survole (hover)
```
Déroulement:
  1. Avatar regarde le curseur (suivi doux)
  2. Sourire s'élargit légèrement (+15%)
  3. Yeux brillent davantage
  4. Joues + blush

Durée: instantané + 300ms transition
Feedback: Sensation de présence, d'écoute
```

### 5.3 Quand l'utilisateur clique sur l'avatar
```
Déroulement:
  1. Surprise (0.6s)
  2. Puis animation aléatoire:
     - Clin d'œil
     - Ou salut de main
     - Ou petite danse

Durée: 0.6s + 0.5s anim bonus
Bulle texte: Phrase aléatoire encourageante
Ressenti: Ludique, interactif
```

### 5.4 Quand produit ajouté au panier
```
Déroulement:
  1. Saut de joie (0-800ms)
  2. Pouce levé apparaît (200-1500ms)
  3. Clin d'œil (1000-1500ms)
  4. Emoji ✨ flotte vers le haut

Durée: 1.5s
Bulle texte: "Excellent choix! 👍"
Ressenti: Célébration, gratification
```

### 5.5 Quand l'utilisateur est inactif (>30s)
```
Déroulement:
  1. Transition lisse vers animation "wait"
  2. Tête penche légèrement
  3. Expression: attente tendre
  4. Clignement des yeux
  5. Boucle lente (~2s par cycle)

Durée: continu jusqu'à activity
Bulle texte: "T'as besoin d'aide? 😊"
Ressenti: Bienveillance, support
```

### 5.6 Quand page charge (loading)
```
Déroulement:
  1. Avatar fait lente rotation (~2s par cycle)
  2. Respiration douce continue
  3. Anneau de chargement autour
  4. Expression: patient, concentré

Durée: durée du loading
Bulle texte: "Un instant... ⏳"
Ressenti: Confiance, patiente
```

---

## 6. Usage Dos & Don'ts

### ✅ Dos (À faire)

- ✅ Utiliser dans les sections de **bienvenue** et **héros**
- ✅ Inclure dans les **pages de chargement**
- ✅ Placer en **sidebar** ou **chat widget** pour support
- ✅ Déclencher sur **actions positives** (panier, validation)
- ✅ Garder **simple et doux** dans les animations
- ✅ Respecter les **préférences d'accessibilité** (reduced-motion)
- ✅ Adapter la taille pour la **responsivité mobile**
- ✅ Utiliser dans les **réseaux sociaux** (stories, posts)
- ✅ Intégrer dans **packaging** et **print** (merchandise)

### ❌ Don'ts (À ne pas faire)

- ❌ Ne **jamais** modifier la palette de couleurs sans approbation
- ❌ Ne **pas** augmenter plus que 20% les dimensions en animation
- ❌ Ne **pas** changer l'expression faciale pour négatif/triste
- ❌ Ne **pas** placer dans un contexte **d'erreur** ou **d'avertissement**
- ❌ Ne **pas** utiliser comme **icône** ou **bouton** (confusion UX)
- ❌ Ne **pas** animer en boucle continue sur toutes les pages (fatigue)
- ❌ Ne **pas** ajouter d'accessoires non-approuvés
- ❌ Ne **pas** transformer en version 3D sans accord
- ❌ Ne **pas** utiliser dans un contexte **corporatif/sérieux** (webinar, meeting)
- ❌ Ne **jamais** le ridiculiser ou le mettre en scène négativement

---

## 7. Variations Saisonnières (optionnel)

### Variations pour événements

```
🎃 Halloween:   Chapeau de citrouille, teinte orangée
🎄 Noël:        Bonnet de Père Noël, feuille décorée
☀️  Été:         Chapeau de paille, lunettes de soleil
❄️  Hiver:       Bonnet + écharpe, aspect givré
```

Note: À discuter en comité créatif avant implémentation.

---

## 8. Déclinaisons Médias

### 🌐 Web
- SVG animé (Lottie)
- Responsive (64 → 1024 px)
- Support tous navigateurs

### 📱 Mobile
- Taille optimisée (80-256 px)
- Touch-friendly
- Performance-optimized

### 📧 Email
- PNG static (256 px)
- Aligné au branding
- CTA accompagnement

### 📸 Réseaux Sociaux
- Story format (1080 × 1920)
- Feed format carré (1080 × 1080)
- Posts + Reels (avec animation)

### 🛍️ Merchandise
- Peluche (figurine 20-30 cm)
- T-shirt / hoodie
- Sticker (waterproof)
- Tasse

### 🎨 Print
- Affiche (A3, A2)
- Flyer (A5, A4)
- Packaging (boîtes produits)
- Papier entête

---

## 9. Palette Couleur Officielle

### Couleurs Souki-Récolte

```
Primary Red:        #E74C3C  (Corps tomate)
Accent Green:       #4CAF50  (Feuille, nature)
Warm Orange:        #FF7043  (Chaleur, convivialité)
Soft Cream:         #FFF8E7  (Authenticité, douceur)
Gold Accent:        #FFC107  (Luminosité, joy)

Neutral Light:      #F5F5F5  (Backgrounds)
Neutral Dark:       #333333  (Texte, détails)
```

---

## 10. Checklist de Brand Consistency

Avant de publier tout asset Récolte :

- [ ] Couleurs exactes (utiliser HEX fourni)
- [ ] Proportions respectées
- [ ] Expressions cohérentes avec personnalité
- [ ] Animations lisses et fluides
- [ ] Texte en tutoiement, positif
- [ ] Taille adaptée au contexte
- [ ] Accessibilité vérifiée
- [ ] Pas de modification non-approuvée
- [ ] Crédit "Récolte, mascotte Souki"
- [ ] Test sur mobile & desktop

---

## 11. Contact & Évolutions

### Qui contacter pour modifications
- **Design :** [Designer assigné]
- **Animation :** [Animator assigné]
- **Intégration :** [Dev front-end assigné]
- **Brand :** [Brand manager]

### Processus de changement
1. Proposition écrite + sketch
2. Review comité créatif
3. Affinage
4. Approbation finale
5. Implémentation

### Versions & Historique

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-19 | Initial design release |
| [TBD] | [TBD] | [Future evolutions] |

---

*Charte créée le 2026-05-19 | Version 1.0*
*Dernière mise à jour : 2026-05-19*
*Prochaine révision recommandée : 2026-12-19*
