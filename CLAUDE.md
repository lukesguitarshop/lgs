# Luke's Guitar Shop

## Deploying

"Deploy to production" means: get the code onto `master` and push it. Nothing else needs running.

- **Frontend** (`frontend/`): Vercel deploys lukesguitarshop.com on every push to `master`.
- **Backend** (`backend/GuitarDb.API/`): the "Deploy backend" GitHub Actions workflow runs `fly deploy`
  for `guitar-price-api` when backend files change on `master`. It can also be run by hand from the
  Actions tab.

After pushing, check the "Deploy backend" run if backend files changed.

The dev site (`dev` branch, `guitar-price-api-dev`) is separate; see `docs/deployment.md`.
