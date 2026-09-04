# Mobile revamp — design

Date: 2026-09-04

Implements `design_handoff_mobile_revamp/` (a bundled design artifact, kept local) as the
real mobile experience across the customer-facing site.

## Context

The August 2026 homepage overhaul (`2026-08-19-homepage-redesign-design.md`) introduced a new
design language — Anton / Archivo / JetBrains Mono, hard edges, a four-colour palette — but
landed it only on the global shell and the homepage. Eleven of thirty-two user-facing pages
used it. The other twenty-one kept their rounded shadcn layouts while inheriting the new fonts
and sticky header, so the site read as two websites.

Two measurements framed the work:

- `app/components/home/` contained **zero responsive breakpoint prefixes** and 43 `clamp()`
  calls. The homepage was authored at desktop and made *not to break* on a phone rather than
  designed for one; it ran 10,270px tall at 375×812.
- The sticky header measured **145px on every page** — 18% of the viewport — because a
  desktop-only Trade-in button rendered on phones and wrapped the bar onto a second row.

## Scope

In: the global shell, homepage, inventory, listing detail, cart, checkout, filter, sold
archive, and the shop-info / contact / trade-in trust pages, plus a shared-pattern sweep over
the remaining customer pages.

Out: `app/admin/**`, `/finances`, `/deal-finder` (owner tools), the backend, and desktop —
except three changes noted under "Deliberate desktop changes".

## The four rules

Every decision below follows from these, and ambiguity resolves in their favour.

1. **A 56px header, one row, always.** An explicit `grid-cols-[auto_1fr_auto]` mobile
   composition, never `flex-wrap`.
2. **Design the phone layout; don't clamp the desktop one.** Real breakpoints. `clamp()` is
   acceptable for type, never as a layout strategy.
3. **One primary action per screen, within thumb reach.** Solid crimson for the primary,
   outline for everything else, and a sticky bottom bar on listing, cart, checkout, contact
   and trade-in.
4. **One design language.** Anton headings, square edges, mono labels, four colours — on every
   page, including the twenty-one that missed the overhaul.

## Architecture

The safest structure for a page that already has a working desktop layout is a `md:hidden`
mobile block beside a `hidden md:block` block holding the existing markup verbatim. Most pages
use it. It means the mobile markup precedes the desktop markup in the DOM — see "Testing".

Six shared primitives carry the language so it isn't re-implemented per page:

| Component | Role |
|---|---|
| `components/ui/sticky-bar.tsx` | The 64px phone action bar; adds `body.has-sticky-bar` so content clears it |
| `components/ui/state-block.tsx` | The three state treatments — navy success, crimson error, warm-gray warning |
| `components/ui/collapsible-section.tsx` | `<details>`-based section, keyboard and screen-reader accessible for free |
| `components/ui/rating-squares.tsx` | Five crimson squares; replaces gold stars |
| `components/listing/ListingCard.tsx` | The most-repeated component on the site |
| `components/listing/FilterSheet.tsx` | Bottom sheet replacing the `/filter` route |

`app/globals.css` gained `--header-h` (56px, and the logo clamp from `md:` up), a `mobile-h1` /
`mobile-h2` / mono-label trio that applies Anton below `md` only, and `--spacing-13`.

## Key decisions

**`.btn-mono` moved from `@layer utilities` to `@layer components`.** It sets `display`, and in
`utilities` it sat after Tailwind's own generated utilities — same layer, same single-class
specificity — so source order decided and it beat `hidden`. Every element carrying both classes
rendered anyway. This is the root cause of the 145px header, and fixing the cascade rather than
the symptom is what un-wraps the bar. Nothing else in that block sets `display`, so
`.label-mono`, `.receipt` and `.photo-panel` stayed put.

**`/filter` became a redirect rather than a deletion.** Filtering now happens in a bottom sheet
over the inventory, but older links and indexed URLs still point at the route, so it forwards
the same `q` / `conditions` / `minPrice` / `maxPrice` / `sort` / `page` params and lands the
visitor on the grid with a hash.

**The cart and checkout summaries moved above the line items.** Both pages were
`grid-cols-1 lg:grid-cols-3` with the summary in the trailing column, so on a phone the total
and the pay button collapsed below every item. The running total lives in the sticky bar rather
than being printed twice, 500px apart.

**The sold archive got a compact row, not a two-column grid.** The grid gives bigger photos,
but this page is scanned for proof of sales rather than browsed for purchase, so density is the
job. "Photos are the product" governs live listings; it does not bind the archive.

**The shop-info tab strip is a scrolling underline below `sm`.** A fixed-height grid of four
tabs cannot work at 375px: `TabsList` hardcodes `h-9` while `grid-cols-2` wrapped four 34px
triggers into two rows, so Reviews and Contact fell out of the pill onto bare background. A
`<select>` was rejected — it hides that those two tabs exist and costs an extra tap.

**Trade-in split across two routes.** The handoff draws `2c` as a form on `/trade-in`, but that
route is a landing page and the form lives at `/trade-in/submit` behind auth. The landing page
took the Anton heading and the `01`/`02`/`03` numbered rows; the form took the mono section
labels, 48px controls, dashed drop zone and sticky submit. Restructuring the flow or the auth
gate was out of scope.

## Deliberate desktop changes

Three, all named in the handoff:

1. `--radius: 0` in `:root`, plus `--radius-xl` / `--radius-2xl` in `@theme inline` — those two
   do not derive from `--radius` and would otherwise survive at Tailwind's 0.75rem / 1rem.
   `rounded-full` is a literal `9999px`, so count badges and avatars stay circular.
   `border-radius` has no layout impact, so nothing reflows.
2. `.label-mono` tracking `0.2em` → `0.16em`. At 0.2em, "WHAT YOU GET, EVERY SINGLE TIME" is
   unreasonably wide.
3. `shadow` / `shadow-sm` removed from the Button variants — a soft drop shadow under a square
   crimson block reads as two design languages. Taste, not correctness; revert if unwanted.

## Testing

The dual-block structure puts mobile markup first in the DOM, so `.first()` in the Playwright
suite began resolving to hidden mobile elements at the default 1280px viewport — five specs
failed on the cart link, the logo link and the listing price. The markup is correct; the
selectors predate the pattern, so they are now visibility-scoped with `:visible` and
`filter({ visible: true })`.

Four e2e failures remain (three admin, one flaky expired-session). All four reproduce on a
clean checkout of the parent commit and are unrelated to this work.

## Verification

| | Before | After |
|---|---|---|
| Sticky header height | 145px | 58px |
| Sub-44px tap targets, listing detail | 19 | 0 |
| Sub-44px tap targets, sold archive | 11 | 0 |
| Off-palette colour classes, customer pages | ~1,300 | 0 |
| Breakpoint prefixes in `app/components/home/` | 0 | 46 |
| Lint problems | 55 (34 errors) | 34 (20 errors) |

Checked at 320, 375 and 430px with no horizontal overflow, and at 1280px to confirm the desktop
nav, Trade-in button and rotated receipt card are unchanged and no sticky bar mounts.
