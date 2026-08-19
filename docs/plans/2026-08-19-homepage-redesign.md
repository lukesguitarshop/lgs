# Homepage Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the homepage and global shell with the design in `Lukes Guitar Shop.html`, keeping every live feature (favourites, reservations, cart, auth, admin) wired.

**Architecture:** `app/page.tsx` stays a server component that fetches listings and shop stats, then composes seven section components. Six render on the server; only the inventory (`SearchClient`) is a client island. Shared visual primitives live as utilities in `globals.css` rather than being repeated per section.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, `next/font/google` (Anton, Archivo, JetBrains Mono), Playwright, Vitest.

**Design doc:** `docs/plans/2026-08-19-homepage-redesign-design.md`

**Palette (already in `globals.css`, do not change):**
`#FFFFF3` background · `#020E1C` foreground · `#6E0114` primary · `#B8B0A4` muted-foreground · `#F2F0E3` photo panel

---

## Task 1: Add the About headshot asset

**Files:**
- Create: `frontend/public/images/luke.png`

**Step 1: Extract the asset from the bundle**

The mockup is a bundled artifact. The headshot is manifest entry `ef3130fa-afc9-455a-8b9b-8d7b3287ef96`, gzip-compressed base64. This script pulls the manifest out of the HTML and writes the PNG:

```js
// scratchpad/extract-headshot.js
const fs = require('fs'), zlib = require('zlib');
const html = fs.readFileSync('C:/Users/Luke/Downloads/Lukes Guitar Shop.html', 'utf8');
const m = /<script type="__bundler\/manifest"[^>]*>/i.exec(html);
const start = m.index + m[0].length;
const manifest = JSON.parse(html.slice(start, html.indexOf('</script>', start)));
const e = manifest['ef3130fa-afc9-455a-8b9b-8d7b3287ef96'];
let buf = Buffer.from(e.data, 'base64');
if (e.compressed) buf = zlib.gunzipSync(buf);
fs.writeFileSync('frontend/public/images/luke.png', buf);
console.log(buf.length, buf.slice(0, 8).toString('hex'));
```

Run: `node scratchpad/extract-headshot.js`
Expected: prints `1872260 89504e470d0a1a0a` (the PNG magic number).

**Step 2: Verify it is a real image**

Read `frontend/public/images/luke.png` with the Read tool. Expected: a headshot of a man in a
white patterned shirt, outdoors, square crop.

**Step 3: Commit**

```bash
git add frontend/public/images/luke.png
git commit -m "feat(home): add the About section headshot"
```

The logo asset in the mockup is byte-identical to `public/images/logo-transparent.png`. Do not
re-add it.

---

## Task 2: Swap the fonts

**Files:**
- Modify: `frontend/app/layout.tsx:3` (the font imports and their consts)
- Modify: `frontend/app/layout.tsx:176-178` (the `<body>` className)
- Modify: `frontend/app/globals.css:33-37` (the `@theme inline` block)
- Modify: `frontend/tailwind.config.ts:11-15` (`fontFamily`)

**Step 1: Replace the font imports in `layout.tsx`**

Replace the `Playfair_Display, Lato` import and both consts with:

```tsx
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: ["400"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});
```

**Step 2: Update the `<body>` className**

Change `${playfairDisplay.variable} ${lato.variable}` to
`${anton.variable} ${archivo.variable} ${jetbrainsMono.variable}`. Leave the rest of the
className list alone.

**Step 3: Remap the theme variables in `globals.css`**

```css
@theme inline {
  --font-sans: var(--font-archivo), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
  --font-heading: var(--font-anton), Impact, sans-serif;
}
```

In the `@layer base` block below it, change `body`'s `font-family` from
`var(--font-lato), sans-serif` to `var(--font-archivo), system-ui, sans-serif`.

**Step 4: Update the utility classes in `globals.css`**

The existing `.font-heading`, `.font-body`, `.font-nav`, `.font-btn` utilities reference the old
variables. Point them at the new ones:

```css
@layer utilities {
  .font-heading {
    font-family: var(--font-anton), Impact, sans-serif;
    font-weight: 400;
    text-transform: uppercase;
    line-height: 0.95;
    letter-spacing: -0.005em;
  }
  .font-body {
    font-family: var(--font-archivo), system-ui, sans-serif;
  }
  .font-nav {
    font-family: var(--font-archivo), system-ui, sans-serif;
    font-weight: 500;
    font-size: 17px;
    letter-spacing: 0.02em;
  }
  .font-btn {
    font-family: var(--font-jetbrains), ui-monospace, monospace;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
}
```

`.font-heading` gains `text-transform: uppercase` because Anton is a display face designed for
caps — this is what makes every other page pick up the new look for free.

**Step 5: Update `tailwind.config.ts`**

```ts
fontFamily: {
  heading: ['var(--font-anton)', 'Impact', 'sans-serif'],
  body: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
  nav: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
  mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
},
```

**Step 6: Verify no references to the old fonts remain**

Run: `grep -rn "playfair\|font-lato\|Lato\|Playfair" frontend/app frontend/components frontend/tailwind.config.ts`
Expected: no output.

**Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

**Step 8: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/globals.css frontend/tailwind.config.ts
git commit -m "feat(design): move typography to Anton, Archivo and JetBrains Mono"
```

---

## Task 3: Add the shared visual primitives

**Files:**
- Modify: `frontend/app/globals.css` (append to the `@layer utilities` block)

The design repeats four primitives across every section. Defining them once keeps the section
components readable and stops the mockup's inline styles from being copy-pasted seven times.

**Step 1: Append the utilities**

```css
@layer utilities {
  /* Small mono eyebrow above headings, and metadata inside cards. */
  .label-mono {
    font-family: var(--font-jetbrains), ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  /* Tighter variant for dense card metadata. */
  .label-mono-sm {
    font-family: var(--font-jetbrains), ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  /* The rotated paper card used for the hero stats and the card price tag. */
  .receipt {
    background: hsl(var(--background));
    border: 1px solid hsl(var(--foreground) / 0.22);
    box-shadow: 0 20px 44px -30px hsl(var(--foreground) / 0.7);
  }
  .receipt-rule {
    height: 6px;
    background: hsl(var(--primary));
  }
  /* Mono-labelled buttons. */
  .btn-mono {
    font-family: var(--font-jetbrains), ui-monospace, monospace;
    font-size: 12.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color 150ms, border-color 150ms, color 150ms;
  }
  /* Diagonal hatch used behind listing photos while they load and for empties. */
  .photo-panel {
    background:
      repeating-linear-gradient(135deg,
        hsl(var(--foreground) / 0.055) 0 9px,
        transparent 9px 18px),
      #F2F0E3;
  }
}
```

**Step 2: Verify the build still compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds. (Tailwind v4 fails loudly on malformed `@layer` blocks, so this is the
real check.)

**Step 3: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat(design): add the shared label, receipt and button primitives"
```

---

## Task 4: Rebuild the Header

**Files:**
- Modify: `frontend/app/components/Header.tsx` (full rewrite of the returned markup)

The mockup's header is: oversized logo, text nav, an outlined Trade-in link, a solid cart
button. Everything the mockup omits but the site needs must survive: the admin banner, the
Admin Portal link, `ProfileButton`, the mobile menu, and the cart + pending count badge.

**Step 1: Rewrite the desktop header markup**

Keep the entire existing hooks block (`cartCount`, `pendingCount`, `mobileMenuOpen`, both
`useEffect`s, `closeMobileMenu`) untouched. Replace `navLinkClass` and everything from
`<header>` onward.

```tsx
const navLinkClass =
  "font-nav text-foreground/62 hover:text-primary transition-colors cursor-pointer";
const navLinkActiveClass = "font-nav text-foreground hover:text-primary transition-colors cursor-pointer";
```

The header shell:

```tsx
<header className="sticky top-0 z-50 border-b border-primary bg-background/93 backdrop-blur-sm">
  <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-5 px-5 py-2.5">
    <Link href="/" className="mr-auto block leading-none cursor-pointer">
      <Image
        src="/images/logo-transparent.png"
        alt="Luke's Guitar Shop — Ohio"
        width={256}
        height={256}
        priority
        className="block h-[clamp(64px,9vw,128px)] w-auto object-contain"
      />
    </Link>
    {/* nav, trade-in, cart, profile */}
  </div>
</header>
```

Desktop nav — anchors for homepage sections, routes for real pages, per the design doc:

```tsx
<nav className="hidden items-center gap-[27px] md:flex">
  <Link href="/#inventory" className={navLinkActiveClass}>Listings</Link>
  <Link href="/sold" className={navLinkClass}>Sold</Link>
  <Link href="/#about" className={navLinkClass}>About</Link>
  <Link href="/shop-info" className={navLinkClass}>Shop info</Link>
</nav>
```

Trade-in (hidden for admins, matching current behaviour):

```tsx
{!isAdmin && (
  <Link
    href="/trade-in"
    className="btn-mono hidden min-h-[55px] border border-foreground/35 px-[19px] py-[11px] text-[13.5px] text-foreground whitespace-nowrap hover:border-primary hover:text-primary md:inline-flex"
  >
    Trade-in →
  </Link>
)}
```

Cart — solid ink block, count inline in mono rather than a floating red bubble:

```tsx
<Link
  href="/cart"
  aria-label={`Cart, ${cartCount + pendingCount} items`}
  className="relative inline-flex min-h-[55px] min-w-[55px] items-center justify-center gap-[11px] bg-foreground px-[18px] py-[11px] text-background transition-colors hover:bg-primary cursor-pointer"
>
  <ShoppingCart className="h-6 w-6" />
  <span className="font-mono text-[13.5px] tracking-[0.1em]">
    {(cartCount + pendingCount) > 99 ? '99+' : cartCount + pendingCount}
  </span>
</Link>
```

Admins get the Admin Portal link in place of the cart, exactly as today. `<ProfileButton />` sits
after it inside a `hidden md:flex` wrapper.

**Step 2: Keep the mobile menu working**

The existing mobile overlay is fine functionally; restyle its buttons to square wine blocks
(`bg-primary text-background`, no `rounded-lg`) and add the new destinations so mobile nav
matches desktop:

- Listings → `/#inventory`
- Sold → `/sold`
- About → `/#about`
- Shop info → `/shop-info`
- Trade-in → `/trade-in` (non-admin only)
- `<MobileProfileButton onNavigate={closeMobileMenu} />`

Every entry calls `closeMobileMenu` on click.

**Step 3: Remove the now-redundant main padding**

**Files:** `frontend/app/layout.tsx:180`

The design's sections manage their own max-width and padding, and the hero must run full-bleed
against the sticky header. Change:

```tsx
<main className="flex-grow container mx-auto px-4 py-8">
```

to:

```tsx
<main className="flex-grow">
```

This moves the container responsibility into each page. Because inner pages relied on it, each
one now needs its own wrapper — handled in Task 10.

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

**Step 5: Commit**

```bash
git add frontend/app/components/Header.tsx frontend/app/layout.tsx
git commit -m "feat(design): rebuild the header as a sticky bar with the new nav"
```

---

## Task 5: Build the server sections

Five presentational server components. None take client state; all are plain functions.

**Files:**
- Create: `frontend/app/components/home/Hero.tsx`
- Create: `frontend/app/components/home/TrustBar.tsx`
- Create: `frontend/app/components/home/About.tsx`
- Create: `frontend/app/components/home/SoldStrip.tsx`
- Create: `frontend/app/components/home/ContactCta.tsx`
- Create: `frontend/app/components/home/TermsGrid.tsx`
- Create: `frontend/app/components/home/shopStats.ts`

**Step 1: Write the stats module**

`shopStats.ts` owns the numbers the design surfaces, so no section invents its own.

```ts
/** The shop opened in 2022; the hero's "Years" figure counts from there. */
const FOUNDED_YEAR = 2022;

/** Reverb, eBay, Sweetwater Gear Exchange, Facebook Marketplace, and here. */
export const PLATFORM_COUNT = 5;

export interface ShopStats {
  soldCount: number;
  averageRating: number | null;
  years: number;
  platforms: number;
}

interface ReviewStats {
  total_count: number;
  average_rating: number;
}

/**
 * Stats for the hero card and the sold heading. Each source degrades on its own —
 * a dead reviews endpoint costs the rating, not the page.
 */
export async function getShopStats(soldCount: number): Promise<ShopStats> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
  let averageRating: number | null = null;

  try {
    const res = await fetch(`${apiBaseUrl}/reviews/stats`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const stats: ReviewStats = await res.json();
      averageRating = stats.average_rating ?? null;
    }
  } catch (error) {
    console.error('Error fetching review stats:', error);
  }

  return {
    soldCount,
    averageRating,
    years: new Date().getFullYear() - FOUNDED_YEAR,
    platforms: PLATFORM_COUNT,
  };
}
```

**Step 2: Write `Hero.tsx`**

Takes `stats: ShopStats`. Two columns that wrap: copy on the left, the rotated receipt card on
the right.

- Eyebrow: `label-mono text-primary` with a 34px rule before it, reading "One person. No warehouse."
- `<h1 className="font-heading text-[clamp(38px,7.2vw,80px)]">` — three lines, the third
  (`Free shipping, always.`) in `text-primary`
- Body paragraph, `max-w-[47ch] text-foreground/72`
- Two CTAs: solid wine `#inventory`, underlined `/trade-in`
- Receipt card: `receipt -rotate-2 w-[clamp(230px,26vw,290px)]`, a `receipt-rule` bar, a punch
  dot, the "The record" label, then a `<dl>` of four rows with dashed separators

Rows render `stats.soldCount`, `stats.averageRating` (with a wine ★, omitting the row when
`null`), `stats.years`, `stats.platforms`. Values use `font-heading text-[30px]`.

**Step 3: Write `TrustBar.tsx`**

A bordered band, `bg-foreground/[0.022]`, with an `h2` eyebrow "What you get, every single time"
and a five-cell grid: `grid-cols-[repeat(auto-fit,minmax(200px,1fr))]`, cells separated by
`border-t border-l` with the wrapper carrying `border-b border-r`. Copy is static — take the
five headings and bodies verbatim from the mockup (lines 84–103 of the extracted markup).

**Step 4: Write `About.tsx`**

Takes `stats: ShopStats`. Dark band: `bg-foreground text-background`. Left column the headshot
(`/images/luke.png`, `next/image`, `aspect-square object-cover saturate-[0.85]`) with a mono
caption. Right column the eyebrow, `I sell what I'd keep.`, four paragraphs, and two CTAs
(mailto and `/sold`).

The second paragraph interpolates the live count:

```tsx
<p>
  There&apos;s no team. I find the guitars, I photograph them, I answer your questions, I pack
  the box. {stats.soldCount} rehomed guitars and counting
  {stats.averageRating !== null && `, ${stats.averageRating} stars across every platform I sell on`}.
  If I wouldn&apos;t play it, I don&apos;t list it.
</p>
```

**Step 5: Write `SoldStrip.tsx`**

Takes `listings: SoldListing[]` (already sliced to 8 by the page) and `totalSold: number`.
Header row with the eyebrow, `{totalSold} sold. Here are the last eight.`, and an
`All {totalSold} sold →` link to `/sold`. Then an `<ol>` of rows: 74px thumbnail (real
`next/image` when `images[0]` exists, `photo-panel` otherwise), a wine `Sold` chip, the title
(linking to `/listing/{id}`), and the price right-aligned in `font-heading`.

Prices use the same `formatPrice` helper as the rest of the site — copy the implementation from
`SearchClient.tsx:62-69`. If it is needed by three components, lift it to `lib/format.ts`
instead of duplicating.

**Step 6: Write `ContactCta.tsx`**

Wine band, `bg-primary text-background`. Left: `Tell me what you're hunting for.`, body copy,
a mailto button and a `#inventory` link. Right: the "See the guitars on video" list.

Wire Instagram (`https://www.instagram.com/lukesguitarshop_oh/`), TikTok
(`https://www.tiktok.com/@lukesguitarshop`) and YouTube
(`https://www.youtube.com/@lukesguitarshop`). **Omit Facebook** — the mockup's href is a bare
`https://www.facebook.com/` placeholder. All three get `target="_blank"` and
`rel="noopener noreferrer"`.

**Step 7: Write `TermsGrid.tsx`**

Left column: `Read this before you buy`, a lede, and a `Full terms on Shop Info` line that links
to `/shop-info`. Right: a six-cell grid built with `gap-px bg-foreground/14` so the background
shows through as hairlines. The six heads and bodies are static — verbatim from the mockup
(lines 330–335 of the extracted markup); they already match `app/shop-info/page.tsx`.

**Step 8: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

**Step 9: Commit**

```bash
git add frontend/app/components/home
git commit -m "feat(home): add the hero, trust bar, about, sold, CTA and terms sections"
```

---

## Task 6: Rebuild the listing card

**Files:**
- Modify: `frontend/app/components/SearchClient.tsx:409-500` (the `ListingCard` component)

This is the most detailed piece of the design. Build it as designed, then fold back the two live
features the mockup drops.

**Step 1: Restructure the card**

An `<article className="flex flex-col">`, not a `Card`. The photo is a `Link` to
`/listing/{id}` with `aspect-[4/5]` and the `photo-panel` background; `Image` fills it with
`object-cover`. Drop `Card`/`CardContent` from this component's imports if nothing else uses
them.

Overlays on the photo:

- photo count, top-left: `absolute top-3 left-3 label-mono-sm border border-foreground/22 bg-background/90 px-[9px] py-[5px]` reading `{n} photos`
- ON SALE flag, top-right, flush to the corner: `absolute top-0 right-0 bg-primary text-background font-heading text-[15px] px-[14px] py-[9px]` — only when on sale **and not reserved**, matching today's logic
- reservation badge, top-right below the sale flag: same wine block treatment, `bg-green-600` when `reserved_for_me`, `bg-yellow-400 text-yellow-900` otherwise, text from `reservation_badge` defaulting to `On Hold`
- favourites heart, bottom-left: `absolute bottom-3 left-3` so it clears the price tag, `bg-background/80` square, `text-primary fill-current` when favourited

The price tag is the design's signature element — a small receipt hanging off the bottom-right
of the photo:

```tsx
<span className="receipt absolute bottom-0 right-3.5 min-w-[104px] translate-y-[38%] -rotate-2 pb-2.5">
  <span className="block h-1 bg-primary" />
  <span className="flex justify-center pt-[7px] pb-[3px]">
    <span className="block h-2 w-2 rounded-full bg-foreground" />
  </span>
  <span className="block px-[13px] pt-0.5 text-center font-heading text-[21px] leading-[1.1]">
    {formatPrice(listing.price, listing.currency)}
  </span>
  <span className="label-mono-sm block px-[13px] pt-px text-center text-[8.5px] text-primary">
    Free shipping
  </span>
</span>
```

Because the tag overhangs by 38%, the body below needs `pt-[26px]` to clear it.

**Step 2: Build the card body**

Mono meta line (condition, with a hairline divider), then the title as
`<h3 className="font-heading text-[19px]">` wrapping a `Link`, then the description clamped to
two lines. `mt-auto` pushes a bordered footer down: the was/save line when on sale, then the
button row.

**Step 3: Wire Add to cart**

The mockup's card gains a button the site does not have today. Mirror
`ListingDetail.tsx:285-307` so behaviour matches the detail page:

```tsx
const handleAddToCart = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  addToCart({
    id: listing.id,
    title: listing.listing_title,
    price: listing.price,
    currency: listing.currency,
    image: listing.images?.[0] || '',
  });
  logAddToCart(listing.id, listing.listing_title);
  trackAddToCart({
    id: listing.id,
    name: listing.listing_title,
    price: listing.price,
    currency: listing.currency,
  });
  setInCart(true);
};
```

Imports: `addToCart, isInCart` from `@/lib/cart`, `logAddToCart` from `@/lib/activity`,
`trackAddToCart` from `@/lib/analytics`.

Button states, in priority order:

| Condition | Label | State |
|---|---|---|
| `listing.is_reserved` | `Reserved` | disabled, `bg-foreground/30` |
| `inCart` | `In cart` | disabled, `bg-foreground/60` |
| otherwise | `Add to cart` | `bg-foreground hover:bg-primary` |

`inCart` initialises from `isInCart(listing.id)` inside a `useEffect` — never during render,
because `isInCart` reads `localStorage` and would break SSR hydration.

Beside it, a `Details` link to `/listing/{id}` with `border border-foreground/30`.

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

**Step 5: Commit**

```bash
git add frontend/app/components/SearchClient.tsx
git commit -m "feat(home): rebuild the listing card with the receipt price tag and add-to-cart"
```

---

## Task 7: Rebuild the inventory shell

**Files:**
- Modify: `frontend/app/components/SearchClient.tsx:240-407` (the layout around the cards)

All existing state, URL syncing, filtering, sorting and paging logic is correct — **do not
touch the hooks**. This task is markup only.

**Step 1: Rebuild the section header**

The mockup's heading is dynamic:

```tsx
<h2 className="font-heading text-[clamp(30px,4.6vw,54px)]">
  {filteredListings.length} in stock right now
</h2>
```

with the standing lede beneath it, and the sort control on the right as a `label` wrapping a
native `<select>` styled `border border-foreground/35 font-mono text-[11px]`. Replace the Radix
`Select` here — the mockup uses a native control, it is one less client dependency, and
Playwright's `getByRole('combobox')` matches a native `<select>` just as well.

**Step 2: Rebuild the filter sidebar**

`<aside className="hidden lg:block lg:w-[232px] lg:sticky lg:top-[100px] border-t-2 border-primary pt-[22px]">`

Sections, in order:

1. **Search** — mono label, bordered input, `focus:border-primary`
2. **Price** — the mockup's four preset chips (All / Under $1.5k / $1.5k–2k / $2k+), each
   setting `minPrice`/`maxPrice`; a chip is active when the current values match its range.
   **Then** the existing min/max number inputs beneath, styled to match. Both ship — see
   deviation 1 in the design doc. Keeping `input[type="number"]` also keeps
   `listings.spec.ts:56-60` passing.
3. **Condition** — checkboxes with `accent-primary`, each row `flex justify-between` with a live
   count of matching listings on the right, per the mockup
4. **Clear filters** — shown only when `hasActiveFilters`
5. The closing "Not seeing it?" note linking to `/trade-in`

**Step 3: Restyle the grid, empty state and pagination**

Grid: `grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-[clamp(20px,2.4vw,32px)]`.

Empty state: drop the `Card` and the 🎸 emoji for a bordered block with a `font-heading`
"Nothing matches that" and the clear-filters button.

Pagination: replace the `Button` components with `btn-mono` bordered links, keeping the existing
`goToPage` handler and disabled logic exactly as-is.

**Step 4: Keep the mobile filter route**

The `lg:hidden` search + filter button block stays, restyled. It still links to `/filter` with
the current search params — see deviation 2 in the design doc.

**Step 5: Typecheck and lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: no errors.

**Step 6: Commit**

```bash
git add frontend/app/components/SearchClient.tsx
git commit -m "feat(home): restyle the inventory header, filters and grid"
```

---

## Task 8: Compose the page

**Files:**
- Modify: `frontend/app/page.tsx` (full rewrite)
- Delete: `frontend/app/components/SoldListingsCarousel.tsx`

**Step 1: Rewrite `page.tsx`**

Keep the existing `Listing` interface and `getListings()`. Add a sold fetch and compose:

```tsx
export default async function HomePage() {
  const [listings, soldListings] = await Promise.all([getListings(), getSoldListings()]);
  const stats = await getShopStats(soldListings.length);

  return (
    <>
      <Hero stats={stats} />
      <TrustBar />
      <SearchClient initialListings={listings} />
      <About stats={stats} />
      <SoldStrip listings={soldListings.slice(0, 8)} totalSold={soldListings.length} />
      <ContactCta />
      <TermsGrid />
    </>
  );
}
```

`getSoldListings()` mirrors the one in `app/sold/page.tsx:5-24` — same endpoint, same
`next: { revalidate: 300 }`, same catch-and-return-`[]`.

**Step 2: Do not add a Suspense boundary**

The current file wraps `SearchClient` in `Suspense`. Commit b5d778b removed exactly this pattern
from `/sold` because it made React stream a duplicate grid. `SearchClient` reads
`useSearchParams`, which in Next 16 no longer requires a boundary at the page level when the
page is dynamic. If the build complains about a missing boundary, wrap **only** `SearchClient`
and verify in the browser that the grid renders once.

**Step 3: Add the section anchors**

Each section component renders its own `id` (`top`, `inventory`, `about`, `sold`, `terms`,
`trade`) so the header anchors land correctly. Add `scroll-margin-top: 140px` to those ids so
the sticky header does not cover the heading — a single rule in `globals.css`:

```css
@layer base {
  :target { scroll-margin-top: 140px; }
}
```

**Step 4: Delete the carousel**

`SoldListingsCarousel` is replaced by `SoldStrip`. Confirm nothing else imports it:

Run: `grep -rn "SoldListingsCarousel" frontend/app frontend/components`
Expected: no output after deletion.

**Step 5: Update the page metadata**

Title and description from the mockup's `<helmet>`:

```tsx
export const metadata = {
  title: "Luke's Guitar Shop — Used and vintage guitars, 15 photos of the actual instrument",
  description:
    "A one-person shop in Ohio. Every listing has 14–15 photos of the guitar you're actually buying, every flaw disclosed, free insured shipping, case included on most. Payment plans and trade-ins.",
};
```

Drop the mockup's hardcoded "360 guitars sold at 4.9 stars" from the description — metadata is
static and those numbers go stale.

**Step 6: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds, `/` listed as a dynamic route.

**Step 7: Commit**

```bash
git add frontend/app/page.tsx
git rm frontend/app/components/SoldListingsCarousel.tsx
git commit -m "feat(home): compose the redesigned homepage from the new sections"
```

---

## Task 9: Rebuild the Footer

**Files:**
- Modify: `frontend/app/components/Footer.tsx`

**Step 1: Rewrite**

`border-t border-primary`, a `max-w-[1320px]` row that wraps: the brand block
(`font-heading text-[20px]` name, a mono line reading
`Ohio · PayPal & credit card · free insured shipping`), a nav
(Listings `/#inventory`, Shop info `/shop-info`, Sold `/sold`, Contact `mailto:`), and the
copyright in mono. Keep `new Date().getFullYear()` — do not hardcode 2026 as the mockup does.

**Step 2: Commit**

```bash
git add frontend/app/components/Footer.tsx
git commit -m "feat(design): rebuild the footer to match the new shell"
```

---

## Task 10: Restore page containers

**Files:**
- Modify: every `app/*/page.tsx` that relied on `<main>`'s container

Task 4 removed `container mx-auto px-4 py-8` from `<main>`. Pages that already wrap their own
content (`app/sold/page.tsx`, `app/page.tsx`) are fine. Everything else now renders edge-to-edge.

**Step 1: Find the affected pages**

Run: `grep -rLn "container mx-auto" frontend/app/*/page.tsx frontend/app/*/*/page.tsx`

**Step 2: Wrap each one**

Add `<div className="container mx-auto px-4 py-8">` around the returned content of each page
found, **excluding anything under `app/admin/`** — admin is out of scope and its pages must be
left byte-for-byte unchanged.

**Step 3: Verify admin is untouched**

Run: `git status --short frontend/app/admin`
Expected: no output.

**Step 4: Build and commit**

Run: `cd frontend && npm run build`
Expected: succeeds.

```bash
git commit -am "fix(layout): restore per-page containers after the shell change"
```

---

## Task 11: Update the e2e tests

**Files:**
- Modify: `frontend/e2e/listings.spec.ts:6-35`

Two assertions target markup the redesign removes. Per the design doc, the tests move, not the
design.

**Step 1: Fix the heading assertion**

`listings.spec.ts:8` expects a heading matching `/listings/i`. The inventory heading is now
"N in stock right now". Replace with:

```ts
await expect(page.getByRole('heading', { name: /in stock right now/i })).toBeVisible();
```

**Step 2: Fix the count assertion**

`listings.spec.ts:33` expects `/\d+ listings?/i`. The count now lives in the heading, so this
test is redundant with step 1. Replace its body with an assertion that the heading carries a
number:

```ts
await expect(page.getByRole('heading', { name: /\d+ in stock right now/i })).toBeVisible();
```

**Step 3: Verify the rest of the suite still matches**

These selectors must all still resolve against the new markup — check each by reading the
rebuilt components, not by assuming:

- `a[href*="/listing/"]` — the card photo, title and Details link
- `getByPlaceholder(/search/i)` — the sidebar search input
- `input[type="number"]` — the min/max price inputs kept per deviation 1
- `getByRole('checkbox')` — the condition filters
- `getByRole('combobox')` — the native sort `<select>`
- `getByRole('button', { name: /add to cart/i })` on the **detail** page — untouched by this work

**Step 4: Run the suite**

Run: `cd frontend && npm run test:e2e`
Expected: passes. Requires the backend and a seeded local Mongo — see the local full-stack notes
in memory. If the backend is not running, say so plainly rather than reporting a pass.

**Step 5: Commit**

```bash
git add frontend/e2e/listings.spec.ts
git commit -m "test(e2e): match the redesigned inventory heading"
```

---

## Task 12: Verify in the browser

**Step 1: Start the dev server**

Use `preview_start` with `.claude/launch.json`, never `npm run dev` through Bash.

**Step 2: Check for errors**

`read_console_messages` and `preview_logs` — expected: no errors, no hydration warnings. A
hydration mismatch here almost certainly means `isInCart` or `getCartCount` was read during
render instead of inside an effect.

**Step 3: Check the layout at three widths**

`resize_window` to desktop (1280), tablet (768) and mobile (375), reloading after each switch.
Confirm at each: the header does not overflow, the receipt price tags do not clip at the grid
edge, the sidebar hides below `lg`, and the body never scrolls horizontally.

**Step 4: Exercise the wiring**

- click a nav anchor → the section heading clears the sticky header
- type in the sidebar search → grid filters and the URL gains `?q=`
- click a price chip → grid filters, chip goes active
- click **Add to cart** on a card → header count increments, button reads `In cart`
- click the heart while logged out → login modal opens
- click **Details** → lands on `/listing/{id}`
- click `All N sold →` → lands on `/sold`

**Step 5: Screenshot the finished page**

`computer {action: "screenshot"}` at desktop width, and share it.

---

## Task 13: Deploy to dev

**Step 1: Confirm the full check passes**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
Expected: all three clean.

**Step 2: Push the branch**

The work is on `master`. Branch it first — do not push the redesign straight to `master`:

```bash
git checkout -b feat/homepage-redesign
git push -u origin feat/homepage-redesign
```

**Step 3: Deploy**

Deploy to the dev site for testing. `fly deploy` needs the sandbox disabled and an explicit
`FLY_API_TOKEN` from `~/.fly/config.yml` — see the deploy notes in memory.

**Ask before deploying.** Deployment is outward-facing and is the user's call, not something to
trigger off the back of a green build.

---

## Out of scope

Do not modify: `app/admin/**`, `backend/**`, or the internals of listing detail, cart, checkout,
sold, shop-info, trade-in and account pages. Those inherit the new fonts and colours through the
shell; restyling their layouts is a separate pass.
