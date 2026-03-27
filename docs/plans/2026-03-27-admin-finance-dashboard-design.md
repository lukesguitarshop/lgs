# Admin Finance Dashboard - Design Document

## Overview

Add a finance tracking dashboard to the admin portal, replacing Google Sheets for tracking guitar transactions, expenses, and profitability. Introduces two-tier navigation to the admin portal (Operations | Finances) with the Finances section containing sub-tabs for transaction management, analytics, monthly breakdowns, and expense tracking.

## Navigation Structure

### Top-Level Tabs
- **Operations** — houses all current admin functionality (Listings, Deals, Messages, Offers, Orders, Users)
- **Finances** — new finance dashboard

Both levels persist active state to localStorage.

### Finance Sub-Tabs
1. **Transactions** — full history table with CRUD + CSV import
2. **Dashboard** — auto-calculated totals, per-platform breakdown, trade chain visualization
3. **Monthly Breakdown** — month-by-year grid with monthly AND cumulative views
4. **Extra Expenses** — non-transaction costs with CRUD

## Data Models

### Transaction (MongoDB)
```
{
  id: ObjectId
  date: DateTime                     // when the transaction occurred
  guitarName: string
  purchasePrice: decimal?            // null for items received via trade
  transactionType: "sold" | "traded"
  soldVia: "Reverb" | "Cash" | "PayPal" | "eBay" | "Venmo" | null
  tradeFor: string?                  // what it was traded for (trades only)
  revenue: decimal?                  // sale price (sold only)
  shippingCost: decimal?             // shipping cost (sold only)
  profit: decimal?                   // auto-calc: revenue - purchasePrice - shippingCost
  trackingCarrier: string?           // UPS, USPS, FedEx
  trackingNumber: string?
  createdAt: DateTime
  updatedAt: DateTime
}
```

### ExtraExpense (MongoDB)
```
{
  id: ObjectId
  date: DateTime
  category: string                   // "Boxes", "Packing Materials", "Tool", etc.
  cost: decimal
  createdAt: DateTime
}
```

## API Endpoints (all admin-protected)

### Transactions
- `GET    /api/admin/transactions`          — list all, supports ?year=&month= filters
- `POST   /api/admin/transactions`          — create new transaction
- `PUT    /api/admin/transactions/{id}`     — update transaction
- `DELETE /api/admin/transactions/{id}`     — delete transaction
- `POST   /api/admin/transactions/import`   — CSV import (one-time bootstrap)

### Extra Expenses
- `GET    /api/admin/extra-expenses`        — list all
- `POST   /api/admin/extra-expenses`        — create
- `PUT    /api/admin/extra-expenses/{id}`   — update
- `DELETE /api/admin/extra-expenses/{id}`   — delete

### Finance Summary
- `GET    /api/admin/finance-summary`       — computed totals, monthly breakdown, per-platform stats

## UI Details

### Transactions Tab
- Table columns: Date, Guitar, Purchase Price, Type (Sold/Traded), Platform, Trade For, Revenue, Shipping, Profit, Tracking
- Profit column color-coded: green for positive, red for negative
- "Add Transaction" button opens a form dialog
- Row click for inline edit
- CSV import button for one-time data migration
- Sorting by any column

### Dashboard Tab
- Summary cards: Total Revenue, Total Expenses, Total Profit (large numbers)
- Per-platform breakdown (Reverb, Cash, PayPal, eBay, Venmo) showing count + total profit
- Trade chain visualization showing chains of trades
- Win/loss stats (count of profitable vs unprofitable transactions)

### Monthly Breakdown Tab
- Year-by-year grid (columns: year, rows: months) like the existing spreadsheet
- Toggle between: monthly-only profit view and cumulative running total view
- Yearly totals row, monthly average row, "this month" indicator

### Extra Expenses Tab
- Table columns: Date, Category, Cost
- Add/edit/delete functionality
- Category subtotals at bottom (total per category)
- Grand total

### CSV Import
- Upload button on Transactions tab
- Parses the existing Google Sheets CSV format
- Preview before committing
- One-time use to bootstrap existing data

## Tech Stack
- Backend: .NET 9 API endpoints + MongoDB collections (matches existing architecture)
- Frontend: Next.js + shadcn/ui Tabs + existing admin patterns
- No new dependencies needed beyond what's already in the project
