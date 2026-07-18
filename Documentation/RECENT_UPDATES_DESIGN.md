# 🚀 SOUKI - Récentes Mises à Jour & Changements (Juin 2026)

**Document de suivi des modifications récentes**  
**Dernière mise à jour**: 17 Juin 2026

---

## Table des Matières

1. [Intégration du Service ML Hugging Face](#intégration-du-service-ml-hugging-face)
2. [Profils de Panier Intelligents](#profils-de-panier-intelligents)
3. [Améliorations de Design (Glassmorphism)](#améliorations-de-design-glassmorphism)
4. [Configuration Recommandée](#configuration-recommandée)
5. [Tests & Validation](#tests--validation)

---

## Intégration du Service ML Hugging Face

> ⚠️ **SECTION HISTORIQUE — MIGRÉE VERS GROQ.** Le service de panier IA n'utilise plus
> Hugging Face ni le modèle fine-tuné Gemma-2-2B ni le fallback `200-compositions.json`.
> Il repose désormais sur du **prompt engineering avec l'API Groq (Llama, mode JSON)** :
> `build_system_prompt` (catalogue live + schéma JSON) → `call_groq` → `validate_composition`,
> avec un retry puis `BasketGenerationError` (HTTP 503) en cas d'échec. Le champ `source`
> de la réponse vaut désormais `"groq_llama"`. Les descriptions Hugging Face ci-dessous
> sont conservées à titre d'archive.

### 📋 Vue d'ensemble

Le service de génération intelligente de paniers a été complètement intégré dans le backend SOUKI, permettant une génération automatique de compositions de produits basées sur les profils utilisateur.

### 🏗️ Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                        │
│  Écrans de génération de panier avec sélection de profil   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /api/paniers/generer
                      │ {budget, personnes, duree, profil}
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Backend API (FastAPI)                          │
│  panier_controller.generer_panier_intelligent()            │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼─────────┐      ┌──────▼────────┐
    │ Hugging Face │      │ Fallback JSON │
    │ (Gemma-2-2B) │      │ (200-compos)  │
    │  (en ligne)  │      │   (local)     │
    └──────────────┘      └───────────────┘
         │                         │
         └────────────┬────────────┘
                      │
    ┌─────────────────▼──────────────────┐
    │  MLPanierService.generer_panier()  │
    │  - Extraction JSON                 │
    │  - Mapping produits                │
    │  - Calcul prix                     │
    └─────────────────┬──────────────────┘
                      │
              PanierResponseDTO
                      │
        ┌─────────────┴────────────┐
        │                          │
    ┌───▼──────┐          ┌─────────▼───┐
    │ BD/DAO   │          │ Frontend    │
    │ Sauvegarde│          │ Affichage   │
    └──────────┘          └─────────────┘
```

### 📦 Composants Clés

#### **Service Principal**: `MLPanierService`

**Fichier**: `back-end/services/ml_panier_service.py`

```python
class MLPanierService:
    def __init__(self, panier_dao: IPanierDao | None = None):
        self._loaded = False
        self._load_error: str | None = None
        self._fallback_compositions: list[dict] = []
        self._repo_id = os.getenv("SOUKI_ML_REPO_ID", "TahaBDI/gemma-2-2b-panier-merged")
        self._inference_url = f"https://api-inference.huggingface.co/models/{self._repo_id}"
        self._timeout_seconds = 45

    def load_model(self):
        """Initialise le modèle HF et le fallback local"""
        # Charge les compositions de fallback (200-compositions.json)
        # Vérifie HF_TOKEN
        # Configure l'URL d'inférence

    def generer_panier(self, payload: PanierRequestDTO) -> PanierResponseDTO:
        """Génère un panier intelligent"""
        # 1. Essaie Hugging Face
        # 2. Si échoue, utilise le fallback local
        # 3. Sauvegarde en BD
        # 4. Retourne les détails du panier
```

#### **Endpoint API**:

```
POST /api/paniers/generer
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}

Request Body:
{
  "budget": 150,
  "personnes": 3,
  "durée": 7,
  "profil": "equilibre"
}

Response (200 OK):
{
  "status": "success",
  "source": "huggingface_inference" | "dataset_fallback",
  "panier_id": 12345,
  "criteres": {
    "budget": 150,
    "personnes": 3,
    "duree": 7,
    "profil": "equilibre",
    "niveaux": [1, 2, 3]
  },
  "lignes_panier": [
    {
      "product_id": 14,
      "nom_produit": "Tomates",
      "quantite_kg": 2.0,
      "prix_unitaire": 12,
      "sous_total": 24.0,
      "unite": "kg"
    },
    ...
  ],
  "total_dh": 147.50,
  "nombre_articles": 8,
  "model_warning": null
}
```

### 🔄 Flux de Traitement

#### **1. Chargement du Modèle**
```
MLPanierService.load_model()
├── Charge 200-compositions.json (fallback local)
├── Vérifie HF_TOKEN
├── Configure l'URL d'inférence Hugging Face
└── État: ready pour inférence
```

#### **2. Génération via Hugging Face**
```
_generate_with_hugging_face(payload, products)
├── Construit le prompt:
│   "Tu es le modèle SOUKI..."
│   "Criteres client: {budget, personnes, duree, profil}"
│   "Catalogue: [{produit_id, nom, prix, stock, ...}]"
├── Appel API HF avec timeout 45s
├── Extrait JSON from response
└── Retourne dict composition ou None
```

#### **3. Fallback Local**
```
_generate_from_fallback(payload)
├── Si HF échoue ou non disponible
├── Filtre par profil identique
├── Scoring par proximité budget/personnes/duree
├── Retourne composition la plus proche
└── Flag "model_warning" dans réponse
```

#### **4. Mapping & Enrichissement**
```
_build_response_lines(generated, products, payload)
├── Mappe produit_id → Product entity
├── Ajoute image, unite
├── Calcule sous_total ligne
├── Ajoute frais livraison
└── Retourne LignePanierResponseDTO[]
```

### 🛠️ Configuration

#### **Variables d'Environnement** (back-end/.env):

```env
# Obligatoire pour Hugging Face
HF_TOKEN=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

# Optionnel - Précharge le modèle au démarrage (améliore latence)
SOUKI_ML_PRELOAD_MODEL=1

# Optionnel - ID du repo Hugging Face
SOUKI_ML_REPO_ID=TahaBDI/gemma-2-2b-panier-merged

# Optionnel - Chemin du fichier fallback
SOUKI_ML_COMPOSITIONS_PATH=200-compositions.json

# Optionnel - Timeout inférence (secondes)
SOUKI_ML_TIMEOUT_SECONDS=45

# Optionnel - Désactiver complètement HF (utilise fallback uniquement)
SOUKI_ML_DISABLE_MODEL=0
```

### ✅ État de Fonctionnement

```
Configuration Détectée:
✓ HF_TOKEN: Défini
✓ Repo ID: TahaBDI/gemma-2-2b-panier-merged
✓ Fallback: 200-compositions.json (local)
✓ Timeout: 45 secondes
✓ Service: Chargé avec succès

Mode d'Opération:
1. Première requête → Charge le modèle (lazy loading)
2. Erreur HF → Bascule fallback automatique
3. Fallback exhaustif → Scoring intelligent par paramètres
```

---

## Profils de Panier Intelligents

### 🎯 Profils Supportés (10 Total)

Le modèle entraîné supporte **10 profils de panier** distincts, chacun optimisé pour des préférences utilisateur spécifiques:

| # | Profil | Description | Produits Typiques |
|---|--------|-------------|-------------------|
| 1 | **aromates_herbes** | Herbes aromatiques & condiments | Persil, menthe, coriandre, ail |
| 2 | **cuisine_couscous** | Ingrédients pour couscous | Oignons, tomates, pois chiche, courges |
| 3 | **cuisine_tajine** | Ingrédients pour tajine | Oignons, tomates, gingembre, citrons |
| 4 | **equilibre** | Panier équilibré (défaut) | Mix légumes, fruits, racines |
| 5 | **fruits_dominant** | Priorité fruits frais | Raisins, fraises, pommes, fruits secs |
| 6 | **legumes_base** | Légumes basiques complets | Pommes de terre, oignons, tomates, courges |
| 7 | **legumes_verts** | Légumes verts & feuillages | Épinards, brocoli, poivrons verts, laitue |
| 8 | **racines_tubercules** | Racines & tubercules | Navets, carottes, pommes de terre, betteraves |
| 9 | **salade_fraicheur** | Produits frais pour salades | Laitue, concombre, tomate, radis, persil |
| 10 | **soupe_hiver** | Légumes pour soupes/ragoûts | Poireaux, carottes, navets, champignons |

### 📊 Données d'Entraînement

**Composition des datasets:**

```
200-compositions.json:
├── Profils: 6 (legacy)
│   └── legumes_base, salade_fraicheur, soupe_hiver, 
│       cuisine_tajine, fruits_dominant, equilibre
└── Compositions: 200 exemples

1500-compositions.json:
├── Profils: 10 (complet)
│   └── + aromates_herbes, cuisine_couscous, legumes_verts, 
│       racines_tubercules
└── Compositions: 1500 exemples (production)
```

### 🎨 Implémentation Frontend

#### **Type TypeScript** (`front-end/lib/catalogue.ts`):

```typescript
export type SmartBasketProfile =
  | "aromates_herbes"
  | "cuisine_couscous"
  | "cuisine_tajine"
  | "equilibre"
  | "fruits_dominant"
  | "legumes_base"
  | "legumes_verts"
  | "racines_tubercules"
  | "salade_fraicheur"
  | "soupe_hiver"
```

#### **Options UI** (`front-end/components/souki/ai-modals.tsx`):

```typescript
const profileOptions: Array<{ id: SmartBasketProfile; label: string }> = [
  { id: "aromates_herbes", label: "Aromates & Herbes" },
  { id: "cuisine_couscous", label: "Cuisine Couscous" },
  { id: "cuisine_tajine", label: "Cuisine Tajine" },
  { id: "equilibre", label: "Equilibre" },
  { id: "fruits_dominant", label: "Fruits Dominant" },
  { id: "legumes_base", label: "Legumes de Base" },
  { id: "legumes_verts", label: "Legumes Verts" },
  { id: "racines_tubercules", label: "Racines & Tubercules" },
  { id: "salade_fraicheur", label: "Salade Fraicheur" },
  { id: "soupe_hiver", label: "Soupe Hiver" },
]
```

#### **Formulaire de Génération**:

```tsx
<Select value={profile} onChange={(e) => setProfile(e.target.value)}>
  <SelectTrigger>Profil du panier</SelectTrigger>
  <SelectContent>
    {profileOptions.map((option) => (
      <SelectItem key={option.id} value={option.id}>
        {option.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 📝 DTO Backend (`back-end/dto/panier_dto.py`):

```python
ProfilPanier = Literal[
    "aromates_herbes",
    "cuisine_couscous",
    "cuisine_tajine",
    "equilibre",
    "fruits_dominant",
    "legumes_base",
    "legumes_verts",
    "racines_tubercules",
    "salade_fraicheur",
    "soupe_hiver",
]

class PanierRequestDTO(BaseModel):
    """Criteres stricts pour generer un panier intelligent."""
    budget: float = Field(gt=0, le=5000)
    personnes: int = Field(ge=1, le=8)
    duree: int = Field(alias="durée", ge=3, le=14)
    profil: ProfilPanier = "equilibre"  # Défaut
```

---

## Améliorations de Design (Glassmorphism)

### 🎨 Améliorations Visuelles

Le design glassmorphic a été considérablement renforcé pour améliorer l'expérience utilisateur et la lisibilité.

### 📐 Changements CSS (`front-end/app/globals.css`)

#### **Avant:**
```css
.glass-ios26 {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.2)) !important;
  backdrop-filter: blur(25px) saturate(195%) !important;
  background-color: rgba(255, 255, 255, 0.15) !important;
}
```

#### **Après:**
```css
.glass-ios26 {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.6)) !important;
  backdrop-filter: blur(40px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(210%) !important;
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  background-color: rgba(255, 255, 255, 0.6) !important;
}

.dark .glass-ios26 {
  background: linear-gradient(135deg, rgba(38, 38, 38, 0.8), rgba(20, 20, 20, 0.7)) !important;
  background-color: rgba(38, 38, 38, 0.75) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  backdrop-filter: blur(40px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(210%) !important;
}
```

### 🎯 Améliorations Quantitatives

| Paramètre | Avant | Après | Impact |
|-----------|-------|-------|--------|
| **Opacité Light** | 15-35% | 60-75% | ✓ Contenu moins visible |
| **Blur Effet** | 25px | 40px | ✓ Plus flou, meilleur masquage |
| **Saturation** | 195% | 210% | ✓ Couleurs plus naturelles |
| **Opacité Dark** | 40-55% | 75-80% | ✓ Contraste amélioré |

### 🖥️ Classes Backdrop Globales

```css
/* Override backdrop blur classes to increase blur effect globally */
.backdrop-blur,
.backdrop-blur-sm {
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
}

.backdrop-blur-md {
  backdrop-filter: blur(35px) !important;
  -webkit-backdrop-filter: blur(35px) !important;
}

.backdrop-blur-lg {
  backdrop-filter: blur(45px) !important;
  -webkit-backdrop-filter: blur(45px) !important;
}

.backdrop-blur-xl {
  backdrop-filter: blur(60px) !important;
  -webkit-backdrop-filter: blur(60px) !important;
}

.backdrop-blur-2xl {
  backdrop-filter: blur(80px) !important;
  -webkit-backdrop-filter: blur(80px) !important;
}
```

### 📍 Emplacements Affectés

**Composants utilisant `.glass-ios26`:**
- Header sticky (toutes pages)
- Navbar principale
- Navigation du catalogue
- Filtres & sélecteurs
- Modales & overlays

**Composants utilisant `backdrop-blur-*`:**
- Modales d'IA (voix/panier)
- Overlays d'authentification
- Popups & confirmations
- Mobile nav overlay

### 🎬 Résultat Visuel

```
AVANT (Transparent):
┌────────────────────────┐
│   Glassmorphism Item   │ ← Contenu en arrière visible
│   (opaque 15%)         │
└────────────────────────┘
Scroll → Contenu visible & distracteur

APRÈS (Opaque & Flou):
┌────────────────────────┐
│   Glassmorphism Item   │ ← Contenu masqué
│   (opaque 60-75%)      │
│   (blur 40px)          │
└────────────────────────┘
Scroll → Contenu masqué complètement
```

---

## Configuration Recommandée

### 🔧 Variables d'Environnement Recommandées

#### **back-end/.env**

```env
# ===== ML SERVICE =====
# Activation du préchargement (chargement au démarrage vs lazy)
SOUKI_ML_PRELOAD_MODEL=1

# HF_TOKEN est REQUIS (déjà configuré)
HF_TOKEN=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

# Optionnel: chemin du fallback
SOUKI_ML_COMPOSITIONS_PATH=1500-compositions.json

# Optionnel: override du repo
SOUKI_ML_REPO_ID=TahaBDI/gemma-2-2b-panier-merged

# Optionnel: timeout
SOUKI_ML_TIMEOUT_SECONDS=45
```

#### **Impact des Configurations**

```
SOUKI_ML_PRELOAD_MODEL=1:
├── ✓ Réduit latence première requête (pas de chargement)
├── ✓ Meilleure UX (réponse rapide)
├── ✗ Augmente démarrage appli (+2-3s)
└── Recommandé: YES pour production

SOUKI_ML_COMPOSITIONS_PATH=1500-compositions.json:
├── ✓ Fallback plus riche (1500 vs 200 compos)
├── ✓ Meilleure couverture profils
├── ✗ Fichier plus gros (5MB vs 1MB)
└── Recommandé: YES si espace disque OK

SOUKI_ML_DISABLE_MODEL=0:
├── ✓ Force fallback local (pas d'appel HF)
├── ✓ Zéro dépendance internet
├── ✗ Moins de variabilité compositions
└── Recommandé: NO pour production
```

### 📋 Checklist de Déploiement

```
ML Service Integration:
☑ HF_TOKEN configuré dans .env
☑ SOUKI_ML_PRELOAD_MODEL=1 activé
☑ Fichier 1500-compositions.json présent
☑ Permissions lecture fichier vérifiées
☑ Connexion HF testée

Design Updates:
☑ Glassmorphism CSS appliqué
☑ Tests visuels en light mode
☑ Tests visuels en dark mode
☑ Tests scroll (contenu masqué)
☑ Tests mobile (overlay visible)

Frontend:
☑ 10 profils affichés dans select
☑ Typage TypeScript cohérent
☑ Appel API panier testé
☑ Affichage résultats OK

Backend:
☑ Service ML chargé
☑ DTO profiles à jour (10 profils)
☑ Endpoint /api/paniers/generer fonctionnel
☑ Fallback testée (avec + sans HF)
```

---

## Tests & Validation

### 🧪 Tests du Service ML

#### **Test 1: Configuration**

```bash
cd back-end
python -c "
from services.ml_panier_service import ml_panier_service
import os

print('HF_TOKEN:', 'OK' if os.getenv('HF_TOKEN') else 'MISSING')
print('Repo:', ml_panier_service._repo_id)
print('Fallback:', ml_panier_service._fallback_path)
"
```

**Résultat attendu:**
```
HF_TOKEN: OK
Repo: TahaBDI/gemma-2-2b-panier-merged
Fallback: C:\...\200-compositions.json
```

#### **Test 2: Génération Panier**

```bash
curl -X POST http://localhost:8000/api/paniers/generer \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 150,
    "personnes": 3,
    "durée": 7,
    "profil": "cuisine_tajine"
  }'
```

**Résultat attendu (200 OK):**
```json
{
  "status": "success",
  "source": "huggingface_inference",
  "panier_id": 12345,
  "lignes_panier": [...],
  "total_dh": 148.50,
  "nombre_articles": 8
}
```

### 🎨 Tests Design

#### **Test 1: Light Mode Glassmorphism**
- [ ] Headers sticky masquent complètement le contenu lors du scroll
- [ ] Opacité suffisante (pas de "voir à travers")
- [ ] Blur appliqué correctement

#### **Test 2: Dark Mode Glassmorphism**
- [ ] Background assez foncé (lisible sur contenu sombre)
- [ ] Border visible (contraste OK)
- [ ] Blur consistent avec light mode

#### **Test 3: Mobile**
- [ ] Overlays de navigation opaques
- [ ] Modales bien visibles
- [ ] Performance acceptable (pas de lag)

---

## Résumé des Modifications

### 📊 Impact Global

| Composant | Avant | Après | Statut |
|-----------|-------|-------|--------|
| **Profils Panier** | 6 | 10 | ✅ +66% couverture |
| **Glassmorphism Opacité** | 15-40% | 60-80% | ✅ +50% solidité |
| **Blur Effect** | 25px | 40-80px | ✅ +60% masquage |
| **ML Service** | Non intégré | Intégré | ✅ Production-ready |
| **Frontend Types** | Partiel | Complet | ✅ Synchronized |

### 🎯 Objectifs Atteints

✅ Service ML Hugging Face complètement intégré  
✅ 10 profils de panier supportés & affichés  
✅ Glassmorphism renforcé (opaque + flou)  
✅ UX améliorée (meilleur masquage contenu)  
✅ Documentation complète  

### 🚀 Prochaines Étapes Recommandées

1. **Tests A/B Design**: Valider les préférences utilisateurs
2. **Optimisation ML**: Fine-tuner sur données réelles Souki
3. **Monitoring**: Logger les performances ML en production
4. **Analytics**: Tracker taux d'acceptation par profil
5. **Expansion**: Ajouter d'autres critères (allergies, régimes, etc.)

---

**Document généré le**: 17 Juin 2026  
**Version**: 1.0  
**Auteur**: Architecture Souki
