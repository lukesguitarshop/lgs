# Luke's Guitar Shop - Codebase Documentation

## Architecture Overview

### Backend (.NET 9 + MongoDB)
- **Location**: `backend/GuitarDb.API/`
- **Deployment**: Fly.io (`guitar-price-api` for prod, `guitar-price-api-dev` for dev)
- **Database**: MongoDB Atlas

### Frontend (Next.js 15 + TypeScript)
- **Location**: `frontend/`
- **Deployment**: Vercel (auto-deploys from GitHub)
- **Styling**: Tailwind CSS + shadcn/ui components

---

## Key Features

### 1. Sale Price System
**Files Modified:**
- `backend/GuitarDb.API/Models/MyListing.cs` - Added `OriginalPrice` field
- `backend/GuitarDb.API/Services/ScraperService.cs` - Sets `OriginalPrice` from Reverb, preserves admin-set `Price`
- `frontend/app/components/SearchClient.tsx` - Shows "ON SALE" badge and strikethrough pricing
- `frontend/app/listing/[id]/ListingDetail.tsx` - Sale indicator on detail page

**How it works:**
- `OriginalPrice` = scraped price from Reverb
- `Price` = admin-editable sale price
- When `Price < OriginalPrice`, displays "ON SALE" badge with strikethrough original price
- Scraper preserves admin-set `Price` when updating listings

**Admin Endpoints:**
- `POST /api/admin/initialize-original-prices` - One-time setup to populate `OriginalPrice` for existing listings

---

### 2. Review Scraper
**Files:**
- `backend/GuitarDb.API/Services/ReviewScraperService.cs` - Fetches reviews from Reverb shop feedback API
- `backend/GuitarDb.API/Models/Reverb/ReverbFeedback.cs` - Models for Reverb feedback response
- `backend/GuitarDb.API/Models/Review.cs` - Review model with optional fields for legacy data

**Features:**
- Scrapes seller reviews from Reverb shop feedback endpoint
- Tracks imported reviews via `ReverbOrderId` to prevent duplicates
- Handles legacy data with optional model fields

**Admin Endpoints:**
- `POST /api/admin/run-review-scraper` - Manually trigger review import

---

### 3. Recently Sold Carousel
**Files:**
- `frontend/app/components/SoldListingsCarousel.tsx` - Horizontal scroll carousel
- `frontend/app/sold/page.tsx` - Full page of all sold listings
- `backend/GuitarDb.API/Controllers/MyListingsController.cs` - `/sold` endpoint

**Features:**
- Shows 8 most recent sold listings on homepage
- Orange "SOLD" badges
- "View all sold listings" link to `/sold` page

---

### 4. Shop Info Page with Reviews
**File:** `frontend/app/shop-info/page.tsx`

**Features:**
- Tabbed interface: About, Reviews, FAQ
- Reviews tab with filtering and sorting
- White dropdown backgrounds, black review text
- Load more functionality

---

### 5. Admin Portal Features
**File:** `frontend/app/admin/page.tsx`

**Buttons/Actions:**
- Run Scraper - Fetches listings from Reverb
- Initialize Sale Prices - Sets `OriginalPrice` for all listings
- Run Review Scraper - Imports reviews from Reverb
- Delete listings (with confirmation)

---

## API Endpoints

### Listings
- `GET /api/listings` - All active listings
- `GET /api/listings/{id}` - Single listing
- `GET /api/listings/sold` - Recently sold listings

### Reviews
- `GET /api/reviews` - All reviews with pagination

### Admin (requires authentication)
- `POST /api/admin/run-scraper` - Trigger listing scraper
- `POST /api/admin/run-review-scraper` - Trigger review scraper
- `POST /api/admin/initialize-original-prices` - Initialize sale prices
- `DELETE /api/admin/listings/{id}` - Delete a listing
- `PUT /api/admin/listings/{id}/price` - Update listing price

---

## Models

### MyListing
```csharp
public class MyListing
{
    public string? Id { get; set; }
    public string ListingTitle { get; set; }
    public string? Description { get; set; }
    public List<string> Images { get; set; }
    public string? ReverbLink { get; set; }
    public string? Condition { get; set; }
    public decimal Price { get; set; }           // Admin-editable price
    public decimal? OriginalPrice { get; set; }  // Scraped Reverb price
    public string Currency { get; set; }
    public DateTime ScrapedAt { get; set; }
    public DateTime? ListedAt { get; set; }
    public bool Disabled { get; set; }           // True = sold
}
```

### Review
```csharp
public class Review
{
    public string? Id { get; set; }
    public string? ReverbOrderId { get; set; }   // Prevents duplicate imports
    public string? GuitarName { get; set; }
    public string? ReviewerName { get; set; }
    public DateTime ReviewDate { get; set; }
    public int Rating { get; set; }
    public string? ReviewText { get; set; }
}
```

---

## Deployment

### Backend (Fly.io)
```bash
cd backend/GuitarDb.API
fly deploy                              # Production
fly deploy --app guitar-price-api-dev   # Development
```

### Frontend (Vercel)
- Auto-deploys on push to `master` (prod) or `dev` branch

### Git Workflow
```bash
git push origin master      # Production frontend + backend
git push origin master:dev  # Development frontend
```

---

## Environment Variables

### Backend (Fly.io Secrets)
- `MongoDb__ConnectionString`
- `ReverbApi__ApiKey`
- `Stripe__SecretKey`, `Stripe__WebhookSecret`
- `PayPal__ClientId`, `PayPal__ClientSecret`
- `Email__*` (SMTP settings)
- `Jwt__SecretKey`
- `FrontendUrl`

### Frontend (Vercel)
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Recent Changes (March 2026)

1. **Sale Price Feature** - Added `OriginalPrice` field, strikethrough pricing, "ON SALE" badges
2. **Review Scraper** - Imports seller reviews from Reverb automatically
3. **Removed `/reviews` page** - Reviews now only on `/shop-info`
4. **Styling fixes** - White dropdown backgrounds, black review text
5. **Admin enhancements** - Initialize Sale Prices button, review scraper button
6. **Model updates** - Made Review fields optional for legacy data compatibility
