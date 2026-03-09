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

### Git Branch → Frontend Auto-Deploy

| Branch | Frontend Deployment | URL |
|--------|---------------------|-----|
| `master` | Production (auto) | lukesguitarshop.com |
| `dev` | Development (auto) | lgs-dev.vercel.app |

- **Push to `master`** → auto-deploys production frontend via Vercel
- **Push to `dev`** → auto-deploys development frontend via Vercel

### Deploy Commands

| What | Environment | Command |
|------|-------------|---------|
| **Frontend** | Production | `git push origin master` (auto-deploys via Vercel) |
| **Frontend** | Development | `git push origin master:dev` (auto-deploys via Vercel) |
| **Backend** | Production | `cd backend/GuitarDb.API && fly deploy` |
| **Backend** | Development | `cd backend/GuitarDb.API && fly deploy --app guitar-price-api-dev` |
| **Scraper** | Production | Runs automatically every 6 hours (GitHub Actions) |

### Full Deployment (Frontend + Backend)

```bash
# Deploy to PRODUCTION
git push origin master
cd backend/GuitarDb.API && fly deploy

# Deploy to DEVELOPMENT
git push origin master:dev
cd backend/GuitarDb.API && fly deploy --app guitar-price-api-dev
```

---

## Step-by-Step: Making Changes

### Frontend Changes
```bash
# 1. Make your changes in frontend/

# 2. Test locally
cd frontend && npm run dev

# 3. Commit & push (auto-deploys to Vercel)
git add . && git commit -m "Your message"
git push origin master        # Production
git push origin master:dev    # Development
```

### Backend Changes
```bash
# 1. Make your changes in backend/GuitarDb.API/

# 2. Test locally
cd backend/GuitarDb.API && dotnet run

# 3. Commit & push
git add . && git commit -m "Your message" && git push

# 4. Deploy to Fly.io
cd backend/GuitarDb.API
fly deploy                           # Production
fly deploy --app guitar-price-api-dev  # Development
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
fly logs                              # Production
fly logs --app guitar-price-api-dev   # Development

# Check scraper status
gh run list --workflow=scraper.yml

# Manually trigger scraper
gh workflow run scraper.yml

# Deploy frontend (auto via git push)
git push origin master        # Production
git push origin master:dev    # Development

# Deploy backend
cd backend/GuitarDb.API
fly deploy                           # Production
fly deploy --app guitar-price-api-dev  # Development
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
