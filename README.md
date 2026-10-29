# Luke's Guitar Shop

A comprehensive price tracking system for Gibson guitars, leveraging real-time market data from Reverb to help collectors, dealers, and enthusiasts make informed buying and selling decisions.

## Overview

Reverb style shop page with a scraper that pulls Luke's Guitar Shop Listings from the reverb.

## Tech Stack

### Backend
- **.NET 9.0**: Modern C# backend services
  - **GuitarDb.API**: RESTful Web API for data access
  - **GuitarDb.Scraper**: Console application for automated data collection
- **MongoDB**: NoSQL database for storing guitar listings and historical data
- **Reverb API**: Source for guitar marketplace data

### Frontend
- **Next.js**: React-based framework for the web interface
- **TypeScript**: Type-safe frontend development
- **TailwindCSS**: Modern utility-first styling

## Project Structure

```
guitar-price-db/
├── backend/
│   ├── GuitarDb.API/          # Web API project
│   └── GuitarDb.Scraper/      # Data scraper console app
├── frontend/                   # Next.js application (coming soon)
├── docs/
│   ├── SETUP.md               # Setup and installation guide
│   └── DATABASE_SCHEMA.md     # MongoDB schema documentation
├── GuitarDb.sln               # .NET solution file
└── README.md                  # This file
```

## Getting Started

### Prerequisites

- .NET 9.0 SDK or later
- MongoDB (local or cloud instance)
- Node.js 18+ (for frontend development)
- Reverb API credentials

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd guitar-price-db
   ```

2. **Set up MongoDB**
   - Install MongoDB locally or set up a cloud instance (MongoDB Atlas)
   - Create a database named `GuitarPriceDb`

3. **Configure the backend**
   - Add your MongoDB connection string and Reverb API credentials to `appsettings.json`
   - See `docs/SETUP.md` for detailed configuration instructions

4. **Run the API**
   ```bash
   cd backend/GuitarDb.API
   dotnet run
   ```

5. **Run the scraper**
   ```bash
   cd backend/GuitarDb.Scraper
   dotnet run
   ```

6. **Set up the frontend** (coming soon)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Mobile layout audit

`frontend/audit/mobile-audit.spec.ts` is a Playwright check that every page fits a phone. It
discovers the routes from `frontend/app/**/page.tsx`, fills dynamic segments with real ids from
the local database, and runs each page signed out, as a customer and as an admin (admin pages
only for the admin) at 320, 360, 375, 390, 414 and 768px wide, plus 844x390 landscape, with a
mobile user agent and touch enabled. A page fails when:

- the document is wider than the viewport (horizontal page scroll), or
- a visible button, link, input, select, textarea or `[role=button]` sticks out past the
  viewport, or past an overflow container that clips it.

Tap targets smaller than 44x44px are flagged in the report but don't fail. The same checks run
again with the mobile menu, the dropdown menus, every tab and every "Add…/New…" dialog open.

It needs the local stack: MongoDB on `localhost:27017`, the API on `localhost:5000`
(`dotnet run --launch-profile http`) and `npm install` in `scripts/` (for the Mongo driver). The
setup step creates two throwaway accounts, `mobile-audit-customer@lgs.test` and
`mobile-audit-admin@lgs.test`, in the **local** database only; it refuses to run against any
non-localhost API or Mongo.

```bash
cd frontend
npm run audit:mobile
```

It starts `next dev` if nothing is on port 3000. It prints a summary table (route, role, width,
pass/fail, offending elements with how many px they stick out) and writes:

- `frontend/mobile-audit/report.json`: every route, role, width and UI state, with offenders and
  small tap targets
- `frontend/mobile-audit/<role>/<width>/<route>.png`: a full-page screenshot of each one

Narrow a run with environment variables: `AUDIT_ROLES=admin`, `AUDIT_WIDTHS=390,844x390`,
`AUDIT_ROUTES='^/finances$'` (a regex), `AUDIT_WORKERS=1`. In Git Bash, set
`MSYS_NO_PATHCONV=1` first, or the leading `/` of a route pattern gets turned into a Windows path.

`npm run audit:desktop` is the companion check that desktop didn't move: it compares full-page
1440px screenshots of the admin pages (every Finances tab) and a few storefront pages against a
baseline. Record the baseline on the old code with `npm run audit:desktop -- --update-snapshots`,
then run it again on the new code.

Admin tables are built with `components/ui/responsive-table.tsx`: declare the columns once, each
with a `priority` (`primary`, `badge`, `key`, `detail`, `actions` or `desktop`), and it renders a
table that scrolls inside its own box at `md` and up (with a sticky first column) and a card per
row below `md`. A new column then shows up on phones in the slot its priority names.

## Documentation

- **[Setup Guide](docs/SETUP.md)**: Detailed installation and configuration instructions
- **[Database Schema](docs/DATABASE_SCHEMA.md)**: MongoDB collection structure and data models
