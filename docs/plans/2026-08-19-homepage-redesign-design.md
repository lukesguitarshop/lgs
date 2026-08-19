# Homepage redesign — design

Date: 2026-08-19

Implements the mockup in `Lukes Guitar Shop.html` (a bundled design artifact) as the real
homepage, plus the global shell it implies.

## Context

The mockup's palette is already the site's palette — `--background` is `#FFFFF3`,
`--foreground` is `#020E1C`, `--primary` is `#6E0114`, `--muted-foreground` is `#B8B0A4`.
Nothing about the colour system changes. What changes is typography and layout.

Typography moves from Playfair Display / Lato to **Anton** (display), **Archivo** (body) and
**JetBrains Mono** (eyebrow labels, prices, metadata). All three are Google Fonts, so they load
through `next/font/google` exactly as the current pair does.

The mockup ships two image assets. The logo is byte-for-byte the file already at
`public/images/logo-transparent.png`. The About headshot is new and must be added.

## Scope

In: the global shell (`layout.tsx`, `Header`, `Footer`, fonts, `globals.css`) and a full
homepage rebuild.

Out: `app/admin/**`, the backend, and the internals of listing detail, cart, checkout, sold,
shop-info and account. Those pages inherit the new fonts and colours and keep working; their
layouts are a later pass.

## Architecture

The homepage stays a **server component**. It fetches listings and shop stats, then composes
section components that render server-side. Only the inventory block is a client island.

```
app/page.tsx  (server)
├─ Hero              server   — headline + "receipt" stats card
├─ TrustBar          server   — five static promises
├─ SearchClient      client   — inventory: search, filter, sort, paging, cards
├─ About             server   — dark band, headshot, story
├─ SoldStrip         server   — last 8 sold, links to /sold
├─ ContactCta        server   — wine band, email, socials
└─ TermsGrid         server   — six policy cards, links to /shop-info
```

Rejected alternatives:

- **One `'use client'` page.** Would push every word of marketing copy out of the initial HTML.
  Commit e7f7e4d moved `/sold` in the opposite direction for exactly this reason.
- **Inventory on its own route.** Breaks every `page.goto('/')` in the e2e suite and discards
  the existing homepage URL parameters.

## Styling

Tailwind v4 utility classes, not the mockup's inline styles. The design repeats a handful of
primitives often enough to justify utilities in `globals.css`:

- `.font-display` — Anton, uppercase, tight leading
- `.label-mono` — JetBrains Mono, ~11px, `0.2em` tracking, uppercase
- `.receipt` — cream card, wine top rule, punch-hole dot, dashed row separators
- `.btn-outline` / `.btn-solid` — the mono-labelled bordered and filled buttons

`--font-heading` and `--font-sans` are remapped in `@theme inline`, so existing pages that use
`font-heading` pick up Anton with no edit.

## Data wiring

| Value | Source |
|---|---|
| Sold count (hero card, About copy, Sold heading) | length of `/api/listings/sold` |
| Rating | `average_rating` from `/api/reviews/stats` |
| Years in business | computed from a 2022 founding constant |
| Platforms | hardcoded `5` |
| Inventory | `/api/listings`, as today |
| Last 8 sold | `/api/listings/sold`, sliced |

Stats are fetched server-side alongside listings. Each fetch degrades independently — a failed
stats call renders the section without those numbers rather than failing the page.

## Navigation

Anchors for homepage sections, real routes for real pages.

| Link | Target |
|---|---|
| Listings | `#inventory` |
| About | `#about` |
| Sold | `/sold` |
| Shop info | `/shop-info` |
| Trade-in | `/trade-in` |
| Cart | `/cart` |
| "All N sold →" | `/sold` |
| Terms footer note | `/shop-info` |

The header keeps everything the mockup omits but the site needs: `ProfileButton`, the admin
banner, the Admin Portal link, the mobile menu, and the cart + pending-offer count badge.

## Listing card

Built as designed — 4:5 photo, photo count, ON SALE flag, rotated receipt price tag, and an
`Add to cart` / `Details` button pair — with two live features folded back in that the mockup
drops:

- the favourites heart, restyled to sit against the cream photo panel
- the reservation badge (`On Hold`, `Pending Trade-In`, `On hold for you`)

Add-to-cart is suppressed for reserved items, matching the listing detail page.

## Deliberate deviations from the mockup

1. **Price filter.** The mockup replaces min/max inputs with preset chips
   (All / Under $1.5k / $1.5k–2k / $2k+). Chips alone are a capability loss, so both ship: chips
   for the common case, a styled min/max pair beneath for everything else. The existing
   `minPrice` / `maxPrice` URL parameters keep working.

2. **Mobile filters.** The mockup's sidebar wraps above the grid on narrow screens, which buries
   the inventory. The existing behaviour is kept instead — sidebar hidden below `lg`, a filter
   button routing to `/filter`.

3. **Facebook.** The mockup's Facebook link points at `facebook.com/` with no page. Instagram,
   TikTok and YouTube are wired to their real URLs; Facebook is omitted pending a real link.

## Testing

`e2e/listings.spec.ts` asserts a heading matching `/listings/i` and body text matching
`/\d+ listings?/i`. The redesigned inventory heading is "N in stock right now" and the count
appears as a mono label, so both assertions are updated to match the new markup. The design is
not bent to preserve the old selectors.

Everything else in the suite keys off `a[href*="/listing/"]`, `getByRole('checkbox')`,
`getByRole('combobox')` and `input[type="number"]`, all of which survive — the last one because
of deviation 1 above.
