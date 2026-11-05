# Deal finders: sold-price matching and history — design

Date: 2026-11-05
Status: built 2026-11-05 (see "Changes while building" at the end)

## Problem

Both deal finders (Reverb and Sweetwater) leave a large share of listings with no price data, and some of the prices they do show are wrong.

- **Matching is text-only.** `ReverbDealFinderClient.SearchCspPriceAsync` searches Reverb's product catalog (`/api/csps`) for `make + model` as the seller typed it. Reverb's search needs every word to match, so seller filler ("Artist Series Limited Edition", years, colors, "(Pre-Owned)") returns nothing, and part numbers (`0262311506`) never match. When the search does return results, loose `Contains` checks and a first-result fallback can pick the wrong product.
- **The benchmark is the wrong number.** `used_low_price` is the cheapest guitar listed right now, not what guitars sell for. One parts guitar or a wrong product drags it down.

## What we verified (2026-11-05)

- The single-listing call (`GET /api/listings/{id}`) returns `comparison_shopping_page_id`, the Reverb product the seller picked when listing. The bulk `/listings/all` call leaves it out. In a sample of 50 live Fender/Gibson solid-bodies, **42 (84%)** had one, including listings with junk model text.
- `GET /api/csps/{id}` returns the product's title, slug, web URL and a `_links.listings` URL whose `cp_ids[]` are the catalog variant IDs.
- Reverb's product page loads its sold-transaction table with a GraphQL query on `https://gql.reverb.com/graphql`, operation `Search_PriceGuideTool_TransactionTable`. It calls `priceRecordsSearch` with `canonicalProductIds` (the `cp_ids`), `listingConditionSlugs`, `sellerCountries`, `actionableStatuses: [shipped, picked_up, received]`, `createdAfterDate`, `limit` and `offset`. It works from a server with no login, given `X-Reverb-App: REVERB` and `X-Display-Currency: USD`. Each record has condition, `createdAt.seconds`, `amountProduct.amountCents` and `listingId`, and the response includes `total`. Example: Gibson Les Paul Standard '50s P-90 had 712 US sales in Good through Mint.
- Of the 8 unmatched listings in the sample, 5 matched the right product once the query was cut down to its core words. The 2 part-number listings matched nothing.

**Risk:** the GraphQL query is not an official API. Reverb could change or block it, like it retired `/api/priceguide`. The design keeps a loud failure when lookups break.

## Decisions

| Question | Decision |
|---|---|
| Benchmark | Median sold price across Good, Very Good, Excellent and Mint, US sellers |
| Window | Last 6 months. Fewer than 5 sales → widen to 12, then 24. Still fewer than 5 → low confidence |
| Storage | Shared per-product cache in Mongo (not per listing, not fetched live) |
| Deal threshold | Delivered price ≤ 110% of median (`DealFinder:DealThresholdPercent` = 110) - offers bring them down; first set to 80%, raised 2026-11-05 because 80% almost never fired |
| Manual fixes | "Set product" / "Wrong product?" by pasting a `reverb.com/p/...` link |
| Text-match fixes | Learned aliases + query cascade with scoring. AI fallback deferred |

## Architecture

### Collections

**`product_prices`**, one document per Reverb product (CSP):
- `productId` (CSP id), `title`, `slug`, `webUrl`, `canonicalProductIds`
- `sales`: the last 24 months of sales, each with `soldAt`, `condition`, `amount`, `listingId`
- `median`, `windowMonths` (6/12/24), `saleCount` (in that window), `low` and `high` (in that window)
- `isBroad`: true for products too generic to price from (see confidence)
- `fetchedAt`, refetched when older than `DealFinder:PriceGuideCacheMinutes` (1440)

**`product_overrides`**, mapping seller-typed text to a product:
- key: normalized `make + model` (lowercase, collapsed whitespace)
- `productId`, `source` (`manual` or `learned`), `updatedAt`
- `manual` always wins over `learned` and is never overwritten by learning

### Matching order (per listing)

1. **Override:** look up the normalized make + model in `product_overrides`. A `manual` hit is an exact match; a `learned` hit is an alias match.
2. **Product link** (Reverb only): reuse the product ID already stored on the listing's `potential_buys` record. Otherwise call `GET /api/listings/{id}` and read `comparison_shopping_page_id`. On a hit, upsert a `learned` override for this listing's make + model, unless a `manual` one exists.
3. **Query cascade** (any listing still unmatched, and always for Sweetwater after step 1):
   1. `make + model` as typed
   2. `make + cleaned model`: strip years, year ranges, colors and finishes, condition words, "(Pre-Owned)", "Limited Edition", "Artist Series", "FSR", weights, serial-like tokens, part-number-like tokens and parenthetical text
   3. `make + cleaned title`

   Stop at the first query that returns candidates, then score every candidate:
   - word overlap between the listing's cleaned text and the product title, minus the brand
   - a bonus when the listing year falls inside the product title's year range (e.g. "1986 - 2000")
   - penalties for one side having "Left-Handed", "Custom Shop", "Relic", "Junior" or "Special" and the other not
   - below a minimum score → unmatched. There is no first-result fallback anymore.

### Pricing

From `product_prices` (fetching on miss or stale):
- Fetch sales with `createdAfterDate` = 24 months ago, paging 100 at a time until `total` is reached.
- Median rule as in the decisions table, over Good through Mint.

### Confidence and deal rule

A listing's price is **reliable** only when all hold:
- the match came from an override (manual or learned) or the listing's own product link, not the query cascade
- the window has at least 5 sales
- the product isn't broad. Broad means the product title minus the brand is a single word ("Stratocaster", "Les Paul", "SG"), or the product has more than 4 `canonicalProductIds`. Tune after seeing real data.

**Deal** = reliable, and delivered ≤ median × `DealThresholdPercent` / 100, and median ≤ 3500 (existing budget cap), and it ships to us (Reverb). Unreliable prices still show with a reason badge and land in neither the Deals tab nor No price guide. Listings with no match land in No price guide as today.

### Listing fields (`potential_buys` and `sweetwater_potential_buys`)

Add: `productId`, `productTitle`, `soldMedian`, `soldSaleCount`, `soldWindowMonths`, `matchSource` (`manual`, `alias`, `listing_link`, `text_search`), `priceReliable`, `unreliableReason` (`text_match`, `few_sales`, `broad_product`, `stale`).

Change: `discountPercent` is computed against `soldMedian`. `priceGuideLow` and `priceGuideHigh` (used low / new low) stay as secondary info. `hasPriceGuide` now means "has a sold median".

### API

- `GET /api/admin/product-prices/{productId}`: the cached `product_prices` document for the dropdown.
- `POST /api/admin/potential-buys/{id}/product` with `{ url }`, and the same for Sweetwater: parse the slug from `reverb.com/p/<slug>`, resolve the product with `GET /api/csps/<slug>`, save a `manual` override for the listing's make + model, re-price the listing right away and return the updated listing.

## UI

On every card in both deal-finder tabs:
- The price line becomes "Sold median **$1,850** · 23 sales, 6 mo · Excellent", plus a badge for unreliable prices ("Text match", "Few sales", "Broad product").
- The −% corner badge uses the median.
- A **"Sold history ▾"** toggle opens a panel that loads `product-prices/{productId}`:
  1. Header: the matched product name linked to Reverb, the median, the low–high range and the sale count, with a **"Wrong product?"** button.
  2. Chart (recharts): monthly average sold price with a 6 months / 1 year / 2 years toggle, and this listing's delivered price as a horizontal reference line.
  3. Table: date, condition and price, newest first, 10 per page. Each row links to the sold Reverb listing.
- Unmatched listings show "No product match" and a **"Set product"** button in place of the toggle.
- Both buttons open a small input for a `reverb.com/p/...` link. Saving re-prices the card in place.
- It must work in the phone layout (see `design_handoff_mobile_revamp/`).

## Failures

- **Single-listing call fails:** go straight to the query cascade for that listing.
- **Sold-history query fails for a product:**
  - with a cached copy, use it and set `unreliableReason = stale`
  - without one, leave the listing unpriced and count a lookup error
- **Run-level check:** the existing "fail loudly" check stays, keyed on sold-history lookup errors, with a message naming the GraphQL query.
- **Pacing:** calls stay sequential with the existing delays. The first sweep after deploy is slower while `product_prices` fills.

## Rollout

- Existing listings are re-priced on the next full sweep, which already revisits every live listing.
- Set `DealFinder:DealThresholdPercent` to 80 in `appsettings.json` and in the Fly config if it's overridden there.
- The old `GuitarDb.Scraper` project's copy of the deal finder isn't touched.

## Testing

- **New xUnit project `GuitarDb.API.Tests`:**
  - median and window widening
  - confidence rules
  - query cleaning
  - candidate scoring, using the sample listings above as cases
  - `reverb.com/p/` URL parsing
  - make + model normalization
- **Frontend vitest:** monthly-average grouping for the chart.
- **Against real Reverb:** run both scans locally against live Reverb with the local API and Mongo. Compare the no-price count before and after, and spot-check dropdowns against Reverb's own product pages in the browser.

## Out of scope

- AI fallback for listings still unmatched. Revisit if No price guide is still too full after a few days of real scans.
- Borrowing product links from similar live listings.
- Renaming the "No price guide" tab.

## Changes while building

Found while testing against live Reverb:

- **Match order** is manual fix → the listing's own product link → learned alias → text search. A learned alias is shared text and can be wrong for one listing, so the listing's own link beats it. Text linked to two different products is marked `ambiguous` and never used.
- **Broad products** are only those whose title minus the brand is one word. A long list of `cp_ids` means finish/color variants of one model, not a broad product.
- **Strong text matches are trusted.** Sweetwater listings never carry a Reverb product link, so without this Sweetwater could never produce a deal. A text match is trusted when all of these hold:
  - every word of the product name is in the seller's model
  - at least two words are shared
  - at least 75% of the model's words are in the product name
  - there's no left-handed, Custom Shop or year conflict
  - a product with a year range counts only when the listing has a year
- **Cases, parts and accessories** (case, pickguard, pickups, neck, body...) are never text-matched. Without this filter, "Gibson SG 1978" matched "Gibson SG Original Hardshell Case".
- **Serial and part-number stripping** only removes tokens with five or more digits, or one hyphen-separated part of eleven or more characters. A looser rule stripped model names like OMC-15E.
- **Pasted links:** Reverb's API has no lookup by slug, so a pasted `reverb.com/p/<slug>` is resolved by searching the slug's words and taking the exact slug match.
- **No price guide tab:** it holds every listing without a *trusted* median, unmatched or not, so loose matches stay in front of you rather than vanishing from both tabs.

First local quick check (175 new listings, 2026-11-05):
- 82% matched a product and 70% got a trusted median, against a 27% no-price rate under the old method.
- 3 deals were flagged, against 17% of listings flagged under the old used-low comparison.
