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

| Service | URL |
|---------|-----|
| **Live Site** | https://frontend-eta-seven-13.vercel.app |
| **API** | https://guitar-price-api.fly.dev/api |
| **API Docs** | https://guitar-price-api.fly.dev/swagger |
| **GitHub Repo** | https://github.com/lukesguitarshop/guitar-price-database |
| **MongoDB Atlas** | https://cloud.mongodb.com |

---

## Project Structure

```
guitar-price-db/
│
├── frontend/                    # Next.js frontend
│   ├── app/                     # Pages & components
│   ├── .env.production          # Production API URL
│   └── package.json
│
├── backend/
│   ├── GuitarDb.API/            # .NET Web API
│   │   ├── Dockerfile           # For Fly.io deployment
│   │   ├── fly.toml             # Fly.io config
│   │   └── appsettings.json     # Config (no secrets!)
│   │
│   └── GuitarDb.Scraper/        # .NET Scraper
│       └── appsettings.json     # Local config
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

| What | Command | When |
|------|---------|------|
| **Frontend** | `cd frontend && vercel --prod` | Auto on git push, or manual |
| **Backend** | `cd backend/GuitarDb.API && flyctl deploy` | Manual only |
| **Scraper** | Runs automatically every 6 hours | Or trigger manually in GitHub Actions |

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

## Costs

| Service | Cost |
|---------|------|
| Vercel | **Free** |
| Fly.io | **Free** (auto-sleeps when idle) |
| MongoDB Atlas | **Free** (512MB) |
| GitHub Actions | **Free** |
