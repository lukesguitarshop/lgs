# Deployment & Development Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR SETUP                                      │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐         ┌──────────────┐         ┌──────────────────┐
    │   FRONTEND   │         │   BACKEND    │         │    DATABASE      │
    │   (Next.js)  │ ──────► │  (.NET API)  │ ──────► │  (MongoDB Atlas) │
    │              │         │              │         │                  │
    │   Vercel     │         │   Fly.io     │         │   Cloud Cluster  │
    └──────────────┘         └──────────────┘         └──────────────────┘
                                    ▲
                                    │
                             ┌──────────────┐
                             │   SCRAPER    │
                             │   (.NET)     │
                             │              │
                             │GitHub Actions│
                             │ (every 6hrs) │
                             └──────────────┘
```

---

## URLs

### Production
| Service | URL |
|---------|-----|
| **Live Site** | https://lukesguitarshop.com |
| **API** | https://guitar-price-api.fly.dev/api |
| **API Docs** | https://guitar-price-api.fly.dev/swagger |
| **Database** | GuitarDb (MongoDB Atlas) |

### Development
| Service | URL |
|---------|-----|
| **Frontend** | https://lgs-dev.vercel.app |
| **API** | https://guitar-price-api-dev.fly.dev/api |
| **Database** | GuitarDb_Dev (MongoDB Atlas - same cluster) |

### Other
| Service | URL |
|---------|-----|
| **GitHub Repo** | https://github.com/lukesguitarshop/guitar-price-database |
| **MongoDB Atlas** | https://cloud.mongodb.com |

---

## Environments

| Component | Production | Development |
|-----------|------------|-------------|
| **Frontend** | lukesguitarshop.com | lgs-dev.vercel.app |
| **API** | guitar-price-api.fly.dev | guitar-price-api-dev.fly.dev |
| **Database** | GuitarDb | GuitarDb_Dev |
| **Fly.io Config** | `fly.toml` | `fly.dev.toml` |

---

## Project Structure

```
guitar-price-db/
│
├── frontend/                    # Next.js frontend
│   ├── app/                     # Pages & components
│   ├── .env.production          # Production API URL
│   ├── .env.development         # Development API URL
│   └── package.json
│
├── backend/
│   ├── GuitarDb.API/            # .NET Web API
│   │   ├── Dockerfile           # For Fly.io deployment
│   │   ├── fly.toml             # Fly.io config (production)
│   │   ├── fly.dev.toml         # Fly.io config (development)
│   │   └── appsettings.json     # Config (no secrets!)
│   │
│   └── GuitarDb.Scraper/        # .NET Scraper
│       └── appsettings.json     # Local config
│
├── scripts/
│   └── mirror-prod-to-dev.js   # Copies prod data to dev database
│
└── .github/
    └── workflows/
        └── scraper.yml          # Auto-runs every 6 hours
```

---

## Local Development

```bash
# 1. Start backend (in one terminal)
cd backend/GuitarDb.API
dotnet run

# 2. Start frontend (in another terminal)
cd frontend
npm run dev

# 3. Open browser
http://localhost:3000        # Frontend
http://localhost:5000/swagger # API docs
```

---

## Deployment Workflow

```
  LOCAL CHANGES
       │
       ▼
  ┌─────────┐      git add . && git commit && git push
  │   Git   │ ─────────────────────────────────────────►  GitHub
  └─────────┘
                                                            │
                   ┌────────────────────────────────────────┼────────────────┐
                   │                                        │                │
                   ▼                                        ▼                ▼
            ┌─────────────┐                          ┌───────────┐    ┌───────────┐
            │   Vercel    │  (auto-deploys frontend) │  Fly.io   │    │  Actions  │
            │             │                          │  (manual) │    │  (auto)   │
            └─────────────┘                          └───────────┘    └───────────┘
```

### Deploy Commands

| What | Environment | Command |
|------|-------------|---------|
| **Frontend** | Production | `cd frontend && vercel --prod` |
| **Frontend** | Development | Auto on PR/branch (Vercel Preview) |
| **Backend** | Production | `cd backend/GuitarDb.API && flyctl deploy` |
| **Backend** | Development | `cd backend/GuitarDb.API && flyctl deploy --config fly.dev.toml` |
| **Scraper** | Production | Runs automatically every 6 hours (GitHub Actions) |

---

## Step-by-Step: Making Changes

### Frontend Changes
```bash
# 1. Make your changes in frontend/

# 2. Test locally
cd frontend && npm run dev

# 3. Deploy to Vercel
vercel --prod

# 4. Commit & push
git add . && git commit -m "Your message" && git push
```

### Backend Changes
```bash
# 1. Make your changes in backend/GuitarDb.API/

# 2. Test locally
cd backend/GuitarDb.API && dotnet run

# 3. Deploy to Fly.io
cd backend/GuitarDb.API
flyctl deploy

# 4. Commit & push
git add . && git commit -m "Your message" && git push
```

---

## Secrets / Environment Variables

| Location | Secrets Stored |
|----------|---------------|
| **Fly.io** | `MongoDb__ConnectionString`, `Stripe__SecretKey`, `Stripe__SuccessUrl`, `Stripe__CancelUrl` |
| **GitHub Actions** | `MONGODB_CONNECTION_STRING`, `REVERB_API_KEY` |
| **Vercel** | `NEXT_PUBLIC_API_BASE_URL` (in .env.production) |

### Manage Secrets
```bash
# View Fly.io secrets
flyctl secrets list

# Add/update Fly.io secret
flyctl secrets set KEY="value"

# GitHub secrets: https://github.com/lukesguitarshop/guitar-price-database/settings/secrets/actions
```

---

## Useful Commands

```bash
# Check API logs on Fly.io
flyctl logs

# Check scraper status
gh run list --workflow=scraper.yml

# Manually trigger scraper
gh workflow run scraper.yml

# Redeploy frontend
cd frontend && vercel --prod

# Redeploy backend
cd backend/GuitarDb.API && flyctl deploy
```

---

## Development Environment

### Mirror Production Data to Dev

To copy all data from production database to development:

```bash
mongosh "mongodb+srv://lukeydude17:PASSWORD@lukesguitarshop.dode96j.mongodb.net" --file scripts/mirror-prod-to-dev.js
```

This copies all collections from `GuitarDb` to `GuitarDb_Dev`.

### Dev Environment Secrets

The dev Fly.io app (`guitar-price-api-dev`) has the same secrets as production but points to:
- `MongoDb__DatabaseName=GuitarDb_Dev`
- `FrontendUrl=https://lgs-dev.vercel.app` (or preview URLs)

To view/update dev secrets:
```bash
flyctl secrets list --app guitar-price-api-dev
flyctl secrets set --app guitar-price-api-dev KEY="value"
```

### Dev API Logs

```bash
flyctl logs --app guitar-price-api-dev
```

### Deploy Dev Frontend

After deploying a new preview, update the stable alias:

```bash
# Deploy and get new preview URL
vercel

# Re-alias to stable URL (replace <preview-url> with the URL from above)
vercel alias <preview-url> lgs-dev.vercel.app
```

---

## Costs

| Service | Cost |
|---------|------|
| Vercel | **Free** |
| Fly.io | **Free** (auto-sleeps when idle) - includes dev app |
| MongoDB Atlas | **Free** (512MB) - includes dev database |
| GitHub Actions | **Free** |
