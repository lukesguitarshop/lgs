# Sweetwater Gear Exchange bulk export

Date: 2026-08-05

## Problem

Listings are exported to Facebook Marketplace in bulk from the admin Listings
tab, but getting the same inventory onto Sweetwater's Gear Exchange means
retyping every listing into their web form. Sweetwater accepts a bulk upload CSV
(`GX_Mass_Upload.csv`, 45 columns), so the work is a mapping problem.

## Approach

Mirror the existing FB export: a bulk action on selected listings, computed
entirely client-side, no backend involvement. The difference is that the FB
template has 5 columns and the Sweetwater template has 45, most of them drawn
from controlled vocabularies that reject unknown values. So the export opens a
review table rather than downloading immediately.

### Category vocabulary comes from Sweetwater, not from guesswork

The CSV template documents only one example `sub_category` per top category,
which is not enough to fill the column. Sweetwater's Gear Exchange is backed by
a public Algolia index -- the same one `SweetwaterScraperClient` already queries
for the deal finder. Its `cat_lvl_1` / `cat_lvl_2` / `brand` facets carry the
full tree.

`scripts/fetch-sweetwater-vocabulary.mjs` pulls those facets and generates
`frontend/lib/sweetwater/vocabulary.ts` (12 top categories, 221 subcategories,
998 brands, 14 decades). Slugifying a facet leaf reproduces the template's codes
exactly, verified against all 12 documented examples.

Two findings worth recording:

- **Top-level codes are not derivable by slugifying.** Algolia says `Bass`,
  `Drum & Percussion`, `Studio & Recording Gear`; the CSV requires `bass-gear`,
  `drums-and-percussion`, `studio-recording-gear`. The 12 top-level codes are
  therefore hardcoded from the template, with an explicit Algolia-name map.
- **Both tree levels are valid `sub_category` values.** An initial "leaf nodes
  only" rule dropped `brass-instruments`, which the template lists even though
  it has children. Both levels are emitted.

### Derivation

`MyListing` stores only title, description, condition, price and images -- no
brand, category or year -- so the remaining columns are derived from the title:

| Column | Rule |
|---|---|
| `brand` | Matched against the real Sweetwater brand list, earliest occurrence wins, ties to the longer name |
| `top_category` / `sub_category` | Ordered keyword rules, falling back to `guitars` / `solidbody-guitars` |
| `year` | `\b(18[5-9]\d\|19\d\d\|20[0-3]\d)\b` |
| `decade` | Derived from year, snapped to the 14 valid values |
| `condition` | Site conditions map onto Sweetwater's five; `Brand New`→`Mint`, `Very Good`→`Good` |
| `description` | Existing `htmlToPlainText` plus the shop return policy |
| `product_image_1..25` | Existing `getFullQualityUrl`, capped at 25 |

Two brand-matching hazards showed up in testing and are handled explicitly:

- Sweetwater's brand facet contains descriptive placeholders (`Vintage`,
  `Custom Build`, `Partscaster`, `Handmade`, ...). Longest-match picked
  `Vintage` over `Fender` on "Fender American Vintage II". These are excluded
  from auto-derivation but remain selectable in the review dropdown.
- Longest-match also picked `Heritage` over `Gibson` on "Gibson Les Paul
  Standard 50s Heritage Cherry Sunburst". Resolved by preferring the earliest
  match, since sellers lead with the manufacturer and trailing words are
  finishes.

### Pricing

`price` exports unchanged. The modal shows a read-only net payout column
computed from Sweetwater's published fees -- 5% seller + 2.5% transaction for a
cash payout, both waived for store credit -- with a toggle to compare the two.

### Fixed defaults

Every row: `delivery_method` = `Shipping and Local Pickup`, `shipping_price` = 0,
`offers_enabled` = TRUE, `sale_optin` = FALSE, `sale_percent` = 10.
`handedness`, `Item_ID`, `serial`, `sku`, `mpn` and `video` are left blank.

`Item_ID` would prefill tech specs from Sweetwater's catalog, but matching it
needs a new backend scraper and misses on vintage and one-off gear. Deferred.

## Components

| File | Role |
|---|---|
| `scripts/fetch-sweetwater-vocabulary.mjs` | Regenerates the vocabulary from Algolia |
| `frontend/lib/sweetwater/vocabulary.ts` | Generated categories, brands, conditions, decades |
| `frontend/lib/sweetwater/derive.ts` | Title → brand / category / year / condition, fees, return policy |
| `frontend/lib/sweetwater/csv.ts` | RFC 4180 serializer |
| `frontend/lib/sweetwater/bulk-upload.ts` | 45-column row assembly |
| `frontend/components/admin/SweetwaterExportModal.tsx` | Review table |
| `frontend/lib/html-text.ts` | `htmlToPlainText` / `getFullQualityUrl`, extracted from the admin page so both exports share one copy |

## Testing

The frontend had no unit runner, only Playwright. Vitest was added for the pure
modules (`npm test`), covering derivation rules, CSV quoting, column layout, and
an end-to-end listing→CSV pipeline test that parses the output the way
Sweetwater will read it. 80 tests.

The keyword rules assert their outputs against the generated vocabulary, so a
Sweetwater category rename fails the suite instead of silently producing a CSV
the importer rejects.

## Not addressed

- Sweetwater's per-upload row limit is undocumented in the template; no cap is
  imposed.
- The return policy's "all sales final" and 15% restocking terms may conflict
  with Gear Exchange buyer protection. Exported verbatim as requested; Sweetwater
  may trim it.
- Visual confirmation of the modal against a live admin session was not
  performed -- the page is behind authentication.
