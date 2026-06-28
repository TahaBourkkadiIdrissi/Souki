# 🚀 Guide de Démarrage Rapide - Projet Souki

## ✅ Ce qui a été installé

### Backend (FastAPI/Python)
```
✅ FastAPI, Uvicorn, Pydantic
✅ SQLAlchemy 2.0.51 (ORM)
✅ PostgreSQL driver (psycopg2-binary 2.9.12)
✅ JWT Authentication (python-jose, bcrypt)
✅ Supabase SDK 2.31.0
✅ Google Auth & Generative AI
✅ APScheduler (tâches planifiées)
```

### Frontend (Next.js)
```
✅ Next.js 16.2.4 + Turbopack
✅ React 19.2.4 + React DOM
✅ TailwindCSS 4.2.0
✅ Radix UI (30+ composants accessibles)
✅ React Hook Form + Zod
✅ Mapbox GL + react-map-gl
✅ Recharts (graphiques)
✅ 216 packages au total
```

### Mobile (Expo)
```
✅ Expo ~56.0.4
✅ React Native 0.85.3
✅ React Hook Form, Zod
✅ Supabase JS client
✅ React Query
✅ NativeWind (TailwindCSS pour React Native)
✅ Rnmapbox (cartes)
✅ 918 packages au total
```

### Outils
```
✅ Node.js v24.17.0 (LTS)
✅ npm v11.13.0
✅ pnpm v11.8.0
```

## 🔧 Configuration de l'Environnement

Les fichiers `.env` ont été créés avec les bonnes valeurs pour:
- Supabase PostgreSQL
- Google Authentication
- Google Gemini API
- HuggingFace API

**Aucune action requise** pour l'environnement - tout est configuré!

## 🎯 Commandes de Démarrage

### 1️⃣ Backend FastAPI
```bash
cd /home/hamzazmarou/Souki/back-end
python3 -m uvicorn main:app --reload --port 8000
```
📍 Accès: http://localhost:8000
📚 Docs: http://localhost:8000/docs

### 2️⃣ Frontend Next.js
```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
source "$NVM_DIR/nvm.sh"
cd /home/hamzazmarou/Souki/front-end
pnpm dev
```
📍 Accès: http://localhost:3000

### 3️⃣ Mobile Expo
```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
source "$NVM_DIR/nvm.sh"
cd /home/hamzazmarou/Souki/mobile
npm start
```
📱 Scannez le QR code avec Expo Go

## 📊 Vérification de l'Installation

```bash
# Vérifier Python
python3 -c "import fastapi, sqlalchemy, supabase; print('✅ Backend OK')"

# Vérifier Node.js
node --version && npm --version

# Vérifier Frontend
cd /home/hamzazmarou/Souki/front-end && pnpm list | head

# Vérifier Mobile
cd /home/hamzazmarou/Souki/mobile && npm list | head
```

## 📝 Structure du Projet

```
Souki/
├── back-end/              # FastAPI Python
│   ├── main.py           # Point d'entrée
│   ├── config.py         # Configuration
│   ├── requirements.txt   # Dépendances Python
│   ├── controllers/       # Routes API
│   ├── services/         # Logique métier
│   └── .env             # Configuration
│
├── front-end/             # Next.js
│   ├── app/             # Routes Next.js
│   ├── components/      # Composants React
│   ├── package.json     # Dépendances npm
│   └── .env.local       # Configuration locale
│
├── mobile/                # Expo/React Native
│   ├── app/             # Écrans de l'app
│   ├── components/      # Composants RN
│   ├── package.json     # Dépendances npm
│   └── .env            # Configuration
│
├── prisma/               # ORM Database
│   └── schema.prisma    # Schéma BD
│
└── Documentation/        # Docs du projet
```

## ⚠️ Notes Importantes

### ML Packages (PyTorch, Transformers)
Le projet est configuré pour utiliser une **API distante HuggingFace** (`SOUKI_ML_INFERENCE_URL`), donc les packages ML locaux (torch, transformers) ne sont pas nécessaires pour développer localement. Si vous avez besoin d'exécuter l'inférence ML localement, installez:
```bash
pip install torch transformers peft accelerate --break-system-packages
```

### PostgreSQL Local (optionnel)
Par défaut, le projet utilise **Supabase** (PostgreSQL en cloud). Si vous voulez tester localement:
```bash
# Créer une BD PostgreSQL locale
createdb souki_db

# Mettre à jour back-end/.env
user=votre_user
password=votre_password
host=localhost
port=5432
dbname=souki_db
```

### Prisma Migrations
```bash
# Générer les types Prisma
cd /home/hamzazmarou/Souki
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev --name initial
```

## 🔐 Sécurité

- **JWT_SECRET** en développement = OK pour tester
- **En production**: Utiliser une clé aléatoire forte (minimum 32 caractères)
- **API Keys**: Toutes les clés API sont stockées dans `.env` (ne jamais commit)

## 🐛 Troubleshooting

### "Module not found: fastapi"
```bash
python3 -m pip install fastapi --break-system-packages
```

### "Cannot find node"
```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
source "$NVM_DIR/nvm.sh"
```

### Erreur de connexion à Supabase
- Vérifier les credentials dans `back-end/.env`
- Vérifier la connexion internet
- Vérifier que les clés API sont valides

### Erreur de TypeScript
```bash
cd /home/hamzazmarou/Souki/front-end
pnpm install
```

## 📞 Ressources Utiles

- 📖 [FastAPI Docs](https://fastapi.tiangolo.com)
- 🎨 [Next.js Docs](https://nextjs.org)
- 📱 [Expo Docs](https://docs.expo.dev)
- 🗄️ [Prisma Docs](https://www.prisma.io/docs)
- 🔑 [Supabase Docs](https://supabase.com/docs)

---

**Installation Date**: 2026-06-18
**Status**: ✅ Prêt pour développement
**Environment**: Flatpak (Freedesktop SDK 25.08)
