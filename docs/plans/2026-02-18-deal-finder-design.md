# Deal Finder - Design Document

**Date:** 2026-02-18
**Status:** Approved

## Overview

A scraper that monitors the Reverb marketplace for guitars priced below their Price Guide estimated value. Runs hourly, compares listing prices against Reverb's price guide data, and surfaces potential deals in the admin portal.

## Requirements

- Monitor pre-filtered Reverb listings (specific brands, price cap, accepts offers)
- Compare listing prices against Reverb Price Guide estimated values
- Flag listings at or below a configurable threshold of the guide's low estimate
- Display potential buys in admin portal with quick actions
- Run hourly via Windows Task Scheduler

## Technical Discovery

### API Endpoints Confirmed

| Endpoint | Purpose |
|----------|---------|
| `GET /api/listings/all?...` | Search marketplace listings |
| `GET /api/priceguide/{id}` | Get price guide estimate |

### Key Finding

Only ~5% of listings have a `price_guide_id`. Listings without this field cannot be compared against the price guide.

### Price Guide Response Structure

```json
{
  "id": 2229,
  "title": "Gibson SG Special 2005 Cherry",
  "estimated_value": {
    "price_low": {"amount": "420.00", "display": "$420"},
    "price_high": {"amount": "780.00", "display": "$780"}
  }
}
```

## Data Model

### PotentialBuy (MongoDB Collection: `potential_buys`)

```csharp
public class PotentialBuy
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    // Listing data (mirrors MyListing)
    [BsonElement("listing_title")]
    public string ListingTitle { get; set; }

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("images")]
    public List<string> Images { get; set; }

    [BsonElement("reverb_link")]
    public string? ReverbLink { get; set; }

    [BsonElement("condition")]
    public string? Condition { get; set; }

    [BsonElement("price")]
    public decimal Price { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    // Reverb identifiers
    [BsonElement("reverb_listing_id")]
    public long ReverbListingId { get; set; }

    [BsonElement("price_guide_id")]
    public string? PriceGuideId { get; set; }

    // Price guide comparison
    [BsonElement("price_guide_low")]
    public decimal? PriceGuideLow { get; set; }

    [BsonElement("price_guide_high")]
    public decimal? PriceGuideHigh { get; set; }

    [BsonElement("discount_percent")]
    public decimal? DiscountPercent { get; set; }

    // Status
    [BsonElement("is_deal")]
    public bool IsDeal { get; set; }

    [BsonElement("has_price_guide")]
    public bool HasPriceGuide { get; set; }

    // Timestamps
    [BsonElement("first_seen_at")]
    public DateTime FirstSeenAt { get; set; }

    [BsonElement("last_checked_at")]
    public DateTime LastCheckedAt { get; set; }

    [BsonElement("listing_created_at")]
    public DateTime? ListingCreatedAt { get; set; }

    // User actions
    [BsonElement("dismissed")]
    public bool Dismissed { get; set; } = false;

    [BsonElement("purchased")]
    public bool Purchased { get; set; } = false;
}
```

### MongoDB Indexes

- `reverb_listing_id` (unique) - for upsert operations
- `is_deal` + `dismissed` - for filtering deals
- `first_seen_at` - for sorting by newest

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DealFinderOrchestrator                       │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ ReverbApiClient │  │ PriceGuideCache │  │ PotentialBuy    │
│ (extend)        │  │ (new)           │  │ Repository      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Scraper Flow

1. **Fetch listings** - `GET /api/listings/all` with configured filters
2. **For each listing:**
   - If no `price_guide_id` → store with `has_price_guide = false`
   - If has `price_guide_id`:
     - Check `PriceGuideCache` for cached data
     - If not cached, fetch `GET /api/priceguide/{id}` and cache
     - Calculate `DiscountPercent = (PriceGuideLow - Price) / PriceGuideLow * 100`
     - Set `IsDeal = DiscountPercent >= threshold`
3. **Upsert to MongoDB** - Match by `reverb_listing_id`
4. **Log summary** - Listings checked, deals found, without price guide

## Configuration

```json
{
  "DealFinder": {
    "SearchFilters": {
      "Makes": ["gibson", "prs", "fender", "ibanez", "jackson", "schecter", "esp-ltd", "esp"],
      "PriceMax": 3500,
      "AcceptsOffers": true,
      "PerPage": 100
    },
    "DealThresholdPercent": 10,
    "PriceGuideCacheMinutes": 1440
  }
}
```

## API Endpoints

### Backend (GuitarDb.API)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/admin/potential-buys` | List potential buys |
| `GET` | `/api/admin/potential-buys/stats` | Summary statistics |
| `POST` | `/api/admin/potential-buys/run-scraper` | Manual trigger |
| `PATCH` | `/api/admin/potential-buys/{id}/dismiss` | Mark dismissed |
| `PATCH` | `/api/admin/potential-buys/{id}/purchased` | Mark purchased |
| `DELETE` | `/api/admin/potential-buys/{id}` | Remove from list |
| `GET` | `/api/admin/deal-finder/settings` | Get threshold |
| `PUT` | `/api/admin/deal-finder/settings` | Update threshold |

### Query Parameters for GET /potential-buys

- `status`: `all`, `deals`, `no-price-guide`, `dismissed`, `purchased`
- `sort`: `newest`, `best-deal`, `price-low`, `price-high`
- `page`, `perPage`: Pagination

## Admin Interface

New "Deal Finder" tab in `/admin`:

### Header Section
- Last run timestamp
- Stats: listings checked, deals found
- Current threshold display
- "Run Now" button

### Filters
- Status filter tabs: All, Deals Only, No Price Guide, Dismissed
- Sort dropdown: Newest, Best Deal, Price Low, Price High

### Listing Cards
- Image thumbnail
- Title, price, condition
- Price guide comparison (e.g., "$350 vs $420-$780 guide")
- Deal indicator icon
- Time since first seen
- Actions: View on Reverb, Dismiss, Mark Purchased

## Scheduling

### Windows Task Scheduler

- **Name:** LGS Deal Finder
- **Trigger:** Hourly
- **Action:** `dotnet run --deal-finder --project G:\Projects\lgs\backend\GuitarDb.Scraper`
- **Working Directory:** `G:\Projects\lgs\backend\GuitarDb.Scraper`

### CLI Usage

```bash
# Run existing listing scraper
dotnet run

# Run deal finder
dotnet run --deal-finder

# Show help
dotnet run --help
```

## File Structure

### New Files in GuitarDb.Scraper

```
GuitarDb.Scraper/
├── Models/Domain/
│   └── PotentialBuy.cs
├── Services/
│   ├── DealFinderOrchestrator.cs
│   ├── PotentialBuyRepository.cs
│   └── PriceGuideCache.cs
├── Configuration/
│   └── DealFinderSettings.cs
└── Program.cs (modified - add --deal-finder flag)
```

### New Files in GuitarDb.API

```
GuitarDb.API/
├── Controllers/
│   └── AdminController.cs (modified - add deal finder endpoints)
├── Models/
│   └── PotentialBuy.cs (or shared from Scraper)
└── Services/
    └── MongoDbService.cs (modified - add potential_buys operations)
```

### New Files in Frontend

```
frontend/
└── app/admin/
    └── page.tsx (modified - add Deal Finder tab)
```

## Out of Scope (Future)

- Email/push notifications for high-value deals
- Price history tracking for potential buys
- Automatic offer submission
- Multiple saved search configurations
