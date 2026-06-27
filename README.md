# SignBridge AI

**Real-time Sign Language Translator** — Convert webcam hand gestures to text and speech.

| | |
|---|---|
| **Owner** | Pawan Bhatt |
| **Email** | [pawank88252@gmail.com](mailto:pawank88252@gmail.com) |
| **Stack** | Next.js · Express · FastAPI · MongoDB · TensorFlow · MediaPipe |

## Architecture

```
┌─────────────┐     REST/Socket.IO     ┌─────────────┐     REST      ┌─────────────┐
│   Frontend  │ ─────────────────────► │   Backend   │ ────────────► │ AI Service  │
│  (Next.js)  │                        │  (Express)  │               │  (FastAPI)  │
│  Port 3000  │                        │  Port 4000  │               │  Port 8000  │
└─────────────┘                        └──────┬──────┘               └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │   MongoDB   │
                                       │   Atlas     │
                                       └─────────────┘
```

## Features

- **Authentication** — Register, login, JWT access + refresh tokens, protected routes
- **Translator** — Webcam capture, MediaPipe hand landmarks, real-time ASL prediction, TTS
- **Dashboard** — Translation history, accuracy metrics, usage analytics
- **Dataset** — Upload labeled samples, statistics, export for training
- **Real-time** — Socket.IO streaming for low-latency predictions

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB (local or Atlas)
- Webcam

### 1. Clone & Setup

```bash
cd signbridge
```

### 2. MongoDB

```bash
# Option A: Docker
docker run -d --name signbridge-mongo -p 27017:27017 mongo:7

# Option B: MongoDB Atlas — update MONGODB_URI in backend/.env
```

### 3. AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python scripts/train_model.py   # Train initial ASL classifier
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and secrets
npm run seed    # Create demo user
npm run dev     # http://localhost:4000
```

### 5. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev     # http://localhost:3000
```

### Demo Credentials (after seed)

| Field | Value |
|-------|-------|
| Email | `pawank88252@gmail.com` |
| Password | `SignBridge1` |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| GET | `/api/auth/profile` | Yes | Get profile |
| POST | `/api/predict` | Yes | Predict from landmarks |
| POST | `/api/translate` | Yes | Translate & save history |
| GET | `/api/history` | Yes | Translation history |
| GET | `/api/analytics` | Yes | Usage analytics |
| POST | `/api/dataset/upload` | Yes | Upload labeled sample |
| GET | `/api/dataset/statistics` | Yes | Dataset stats |

## Docker (Full Stack)

```bash
cd docker
cp .env.example .env
docker compose up --build
```

Services: Frontend `:3000` · Backend `:4000` · AI `:8000` · MongoDB `:27017`

## Testing

```bash
# Backend
cd backend && npm test

# AI Service
cd ai-service && source venv/bin/activate && pytest

# Frontend
cd frontend && npm test
```

## Project Structure

```
signbridge/
├── frontend/          # Next.js App Router + Tailwind + shadcn/ui
├── backend/           # Express + Mongoose + Socket.IO
├── ai-service/        # FastAPI + MediaPipe + TensorFlow
├── datasets/          # ASL labels, samples, loader script
├── docker/            # Docker Compose configuration
└── docs/              # Deployment guide
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel + Render deployment instructions.

## License

MIT © Pawan Bhatt
