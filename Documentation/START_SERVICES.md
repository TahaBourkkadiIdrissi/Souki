# 🚀 Start Services - Copy & Paste Commands

## Terminal 1: Backend (FastAPI)
```bash
cd /home/hamzazmarou/Souki/back-end
python3 -m uvicorn main:app --reload --port 8000
```
📍 http://localhost:8000  
📚 Docs: http://localhost:8000/docs

---

## Terminal 2: Frontend (Next.js)
```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
source "$NVM_DIR/nvm.sh"
cd /home/hamzazmarou/Souki/front-end
pnpm dev
```
📍 http://localhost:3000

---

## Terminal 3: Mobile (Expo)
```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
source "$NVM_DIR/nvm.sh"
cd /home/hamzazmarou/Souki/mobile
npm start
```
📱 Scan QR code with Expo Go

---

## One-Liner Setup (Copy this into Terminal 1)
```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"; source "$NVM_DIR/nvm.sh"; bash /home/hamzazmarou/Souki/setup-dev.sh
```

---

## Check Status
```bash
# Backend status
python3 -c "import fastapi, sqlalchemy, supabase; print('✅ Backend OK')"

# Frontend status
cd /home/hamzazmarou/Souki/front-end && pnpm list next 2>&1 | head -3

# Mobile status
cd /home/hamzazmarou/Souki/mobile && npm list expo 2>&1 | head -3

# Node/npm status
node --version && npm --version
```

