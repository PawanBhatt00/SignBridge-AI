# SignBridge AI — Deployment Guide

Deploy SignBridge AI to production using Vercel (frontend), Render (backend + AI service), and MongoDB Atlas.

## Overview

| Service | Platform | URL Pattern |
|---------|----------|-------------|
| Frontend | Vercel | `https://signbridge.vercel.app` |
| Backend API | Render Web Service | `https://signbridge-api.onrender.com` |
| AI Service | Render Web Service | `https://signbridge-ai.onrender.com` |
| Database | MongoDB Atlas | `mongodb+srv://...` |

---

## 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user with read/write access
3. Whitelist IP `0.0.0.0/0` (or Render's IP ranges)
4. Copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/signbridge?retryWrites=true&w=majority
   ```

---

## 2. AI Service (Render)

### Create Web Service

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `signbridge/ai-service`
   - **Runtime**: Docker
   - **Instance Type**: Starter (or higher for TensorFlow)

### Environment Variables

```
AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8000
MODEL_PATH=./models/asl_classifier.keras
CONFIDENCE_THRESHOLD=0.5
CORS_ORIGINS=https://your-frontend.vercel.app,https://your-backend.onrender.com
```

### Build Command (if not using Docker)

```bash
pip install -r requirements.txt && python scripts/train_model.py
```

### Start Command

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Note: Render sets `$PORT` automatically.

---

## 3. Backend API (Render)

### Create Web Service

1. New → Web Service
2. Settings:
   - **Root Directory**: `signbridge/backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Environment Variables

```
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/signbridge
JWT_ACCESS_SECRET=<generate-64-char-random-string>
JWT_REFRESH_SECRET=<generate-64-char-random-string>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AI_SERVICE_URL=https://signbridge-ai.onrender.com
CORS_ORIGIN=https://your-frontend.vercel.app
COOKIE_SECURE=true
```

### Generate Secrets

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Seed Production Database

```bash
# Run locally with production MONGODB_URI
MONGODB_URI="mongodb+srv://..." npm run seed
```

---

## 4. Frontend (Vercel)

### Deploy

1. Go to [vercel.com](https://vercel.com) → Import Git Repository
2. Settings:
   - **Root Directory**: `signbridge/frontend`
   - **Framework Preset**: Next.js

### Environment Variables

```
NEXT_PUBLIC_API_URL=https://signbridge-api.onrender.com/api
NEXT_PUBLIC_SOCKET_URL=https://signbridge-api.onrender.com
```

### Deploy Command

Vercel auto-detects Next.js. No custom build command needed.

```bash
# Or deploy via CLI
cd signbridge/frontend
npx vercel --prod
```

---

## 5. Post-Deployment Checklist

- [ ] AI service `/health` returns `status: ok`
- [ ] Backend `/api/health` shows `aiService: connected`
- [ ] Frontend loads and can register/login
- [ ] Webcam permissions work (HTTPS required)
- [ ] Socket.IO connects from frontend to backend
- [ ] Translations save to MongoDB
- [ ] Text-to-speech works in browser

---

## 6. Custom Domain (Optional)

### Vercel
1. Project Settings → Domains → Add `app.yourdomain.com`

### Render
1. Service Settings → Custom Domains → Add `api.yourdomain.com`

Update `CORS_ORIGIN` and `CORS_ORIGINS` accordingly.

---

## 7. Monitoring

- **Render**: Built-in logs and metrics
- **Vercel**: Analytics and function logs
- **MongoDB Atlas**: Performance advisor and alerts

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| AI service cold start slow | Upgrade Render plan or use health check ping |
| CORS errors | Verify `CORS_ORIGIN` matches frontend URL exactly |
| Webcam not working | Ensure HTTPS (required by browsers) |
| Socket.IO disconnects | Check `NEXT_PUBLIC_SOCKET_URL` points to backend |
| MongoDB connection failed | Verify Atlas IP whitelist and credentials |

---

## Local Docker Production Test

```bash
cd signbridge/docker
cp .env.example .env
# Edit JWT secrets
docker compose up --build
```

Test at `http://localhost:3000`
