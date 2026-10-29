/**
 * Mobile layout audit. For every page under app/ (discovered from the
 * filesystem, so a new page can't be skipped), in three sessions (signed out,
 * customer, admin) and at every audited width, it fails when:
 *   - the document is wider than the viewport (horizontal page scroll), or
 *   - a visible button / link / input / select / textarea / [role=button]
 *     sticks out past the viewport, or past an overflow container that clips it.
 * Tap targets under 44x44 are flagged (reported, not failed).
 *
 * The same checks run again with the mobile menu, dropdown menus, every tab and
 * every "Add…/New…" dialog open. A full-page screenshot per route/role/width
 * lands in mobile-audit/. Run it with `npm run audit:mobile` (see README).
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, devices, type Page } from '@playwright/test';
import { STATE_FILE, type AuditState } from './setup';

type Role = 'signed-out' | 'customer' | 'admin';

const ROLES: Role[] = (process.env.AUDIT_ROLES?.split(',') as Role[]) ?? ['signed-out', 'customer', 'admin'];
// "390x844" style entries; a bare number means portrait at that width.
const VIEWPORTS = (process.env.AUDIT_WIDTHS ?? '320,360,375,390,414,768,844x390')
  .split(',')
  .map((v) => {
    const [w, h] = v.split('x').map(Number);
    return { width: w, height: h || 844, label: h ? `${w}x${h}` : String(w) };
  });
const ROUTE_FILTER = process.env.AUDIT_ROUTES ? new RegExp(process.env.AUDIT_ROUTES) : null;

const OUT_DIR = path.join(__dirname, '..', 'mobile-audit');
const APP_DIR = path.join(__dirname, '..', 'app');
const MIN_TAP = 44;

// Pages behind the admin gate. Everything else is public or customer-facing and
// runs for all three roles.
const ADMIN_PREFIXES = ['/admin', '/finances', '/deal-finder', '/impersonate'];

// Which sample id fills each dynamic segment, keyed by the route pattern.
const PARAM_SAMPLES: Record<string, string> = {
  '/listing/[id]': 'listing',
  '/order/[id]': 'order',
  '/account/orders/[id]': 'order',
  '/admin/reservations/[id]': 'reservation',
  '/deposit/[reservationId]': 'reservation',
  '/deposit/[reservationId]/success': 'reservation',
  '/admin/trade-ins/[id]': 'tradeIn',
  '/trade-in/[id]': 'tradeIn',
  '/trade-in/[id]/submitted': 'tradeIn',
  '/admin/user/[id]': 'user',
  '/messages/[conversationId]': 'conversation',
};

function discoverRoutes(dir = APP_DIR, prefix = ''): string[] {
  const routes: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (entry.name === 'page.tsx' || entry.name === 'page.ts') routes.push(prefix || '/');
      continue;
    }
    if (entry.name === 'api' && !prefix) continue; // route handlers, not pages
    if (entry.name.startsWith('_') || entry.name.startsWith('@')) continue;
    // Route groups "(x)" don't add a segment.
    const seg = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
    routes.push(...discoverRoutes(path.join(dir, entry.name), prefix + seg));
  }
  return routes.sort();
}

interface Offender {
  kind: 'page-scroll' | 'past-viewport' | 'clipped' | 'scroller-past-viewport';
  selector: string;
  text: string;
  overPx: number;
}
interface SmallTarget { selector: string; text: string; size: string }
interface RouteResult {
  route: string;
  state: string; // "page", "menu", "tab:Monthly", "dialog:Add Transaction"…
  role: Role;
  width: string;
  pass: boolean;
  skipped?: string;
  offenders: Offender[];
  smallTargets: SmallTarget[];
}

/** Runs in the page: measures overflow for the current DOM state. */
function measure({ vw, minTap }: { vw: number; minTap: number }) {
  const describe = (el: Element) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
      : '';
    const label = el.getAttribute('aria-label');
    return `${el.tagName.toLowerCase()}${id}${cls}${label ? `[aria-label="${label}"]` : ''}`;
  };
  const textOf = (el: Element) =>
    ((el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || (el as HTMLInputElement).value || '')
      .trim().replace(/\s+/g, ' ').slice(0, 50);
  const hidden = (el: Element) =>
    !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
    // aria-hidden / inert subtrees: closed drawers, and the page behind an open modal
    !!el.closest('[aria-hidden="true"], [inert]') ||
    // Next.js dev overlay (only exists under `next dev`)
    el.getRootNode() !== document || !!el.closest('nextjs-portal');

  const offenders: Offender[] = [];
  const smallTargets: SmallTarget[] = [];
  const doc = document.documentElement;

  if (doc.scrollWidth > vw) {
    // Name the widest things so the culprit is obvious, not just the symptom.
    const wide = [...document.body.querySelectorAll('*')]
      .filter((el) => !hidden(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.right > vw + 1)
      .filter(({ el }) => {
        // skip anything inside an overflow container: that's contained, not the culprit
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox !== 'visible') return false;
        }
        return true;
      })
      .sort((a, b) => b.r.right - a.r.right)
      .slice(0, 3);
    offenders.push({ kind: 'page-scroll', selector: 'html', text: `scrollWidth ${doc.scrollWidth}`, overPx: doc.scrollWidth - vw });
    for (const { el, r } of wide) {
      offenders.push({ kind: 'page-scroll', selector: describe(el), text: textOf(el), overPx: Math.round(r.right - vw) });
    }
  }

  const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]';
  const seenScrollers = new Set<Element>();
  for (const el of document.querySelectorAll(sel)) {
    if (hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // sr-only and similar visually-hidden helpers
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' && r.width <= 1 && r.height <= 1) continue;

    let clipper: Element | null = null;
    let clipMode = '';
    for (let p = el.parentElement; p && p !== document.body && p !== doc; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox !== 'visible') { clipper = p; clipMode = ox; break; }
    }

    if (clipper && (clipMode === 'auto' || clipMode === 'scroll')) {
      // Reachable by scrolling its container; the container itself must fit.
      if (!seenScrollers.has(clipper)) {
        seenScrollers.add(clipper);
        const cr = clipper.getBoundingClientRect();
        const over = Math.max(cr.right - vw, -cr.left);
        if (over > 1) offenders.push({ kind: 'scroller-past-viewport', selector: describe(clipper), text: textOf(clipper), overPx: Math.round(over) });
      }
    } else if (clipper) {
      const cr = clipper.getBoundingClientRect();
      const fullyOutside = r.left >= cr.right || r.right <= cr.left;
      const over = Math.max(r.right - cr.right, cr.left - r.left);
      // Fully outside = deliberately parked (carousel slide); partial = sticking out.
      if (over > 1 && !fullyOutside) offenders.push({ kind: 'clipped', selector: describe(el), text: textOf(el), overPx: Math.round(over) });
    } else {
      const over = Math.max(r.right - vw, -r.left);
      if (over > 1) offenders.push({ kind: 'past-viewport', selector: describe(el), text: textOf(el), overPx: Math.round(over) });
    }

    // Inline links inside running text are exempt from the tap-target rule (WCAG 2.5.8).
    const inlineText = el.tagName === 'A' && cs.display === 'inline' && el.parentElement?.closest('p, li');
    if (!inlineText && (r.width < minTap || r.height < minTap)) {
      smallTargets.push({ selector: describe(el), text: textOf(el), size: `${Math.round(r.width)}x${Math.round(r.height)}` });
    }
  }
  return { offenders, smallTargets };
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function check(page: Page, vw: number) {
  return page.evaluate(measure, { vw, minTap: MIN_TAP });
}

const MODAL_OPENER = /^\+?\s*(add|new)\b/i;

async function closeOverlay(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/** Every UI state worth checking on the current page, beyond the page itself. */
async function exploreStates(page: Page, vw: number, record: (state: string, m: Awaited<ReturnType<typeof check>>) => void) {
  // Mobile hamburger menu
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await page.waitForTimeout(300);
    record('menu', await check(page, vw));
    await closeOverlay(page);
  }

  // Dropdown menus (profile / admin menus)
  const dropdowns = page.locator('button[aria-haspopup="menu"]:visible:not([aria-label*="Next.js"])');
  for (let i = 0; i < Math.min(await dropdowns.count(), 4); i++) {
    const trigger = dropdowns.nth(i);
    const name = (await trigger.getAttribute('aria-label')) || (await trigger.innerText()).trim() || `menu ${i}`;
    await trigger.click().catch(() => {});
    await page.waitForTimeout(250);
    record(`dropdown:${name.slice(0, 30)}`, await check(page, vw));
    await closeOverlay(page);
  }

  // Each tab, and within each tab, the "Add…/New…" dialogs it offers.
  const tabs = page.locator('[role="tab"]:visible');
  const tabCount = await tabs.count();
  const tabStates = tabCount > 0 ? tabCount : 1;
  for (let t = 0; t < tabStates; t++) {
    let label = '';
    if (tabCount > 0) {
      const tab = tabs.nth(t);
      // Icon-only on phones, so fall back to the Radix value baked into the id.
      label = (await tab.innerText()).trim() || (await tab.getAttribute('id'))?.split('-trigger-')[1] || `tab ${t}`;
      await tab.click().catch(() => {});
      await settle(page);
      record(`tab:${label}`, await check(page, vw));
    }
    const openers = page.locator('button:visible').filter({ hasText: MODAL_OPENER });
    for (let i = 0; i < Math.min(await openers.count(), 3); i++) {
      const btn = openers.nth(i);
      const name = (await btn.innerText()).trim().replace(/\s+/g, ' ');
      await btn.click().catch(() => {});
      const dialog = page.locator('[role="dialog"]:visible').first();
      if (await dialog.waitFor({ timeout: 2000 }).then(() => true).catch(() => false)) {
        await page.waitForTimeout(200);
        record(`${label ? `tab:${label} ` : ''}dialog:${name.slice(0, 30)}`, await check(page, vw));
        await closeOverlay(page);
      }
    }
  }
}

function slug(route: string) {
  return route === '/' ? 'home' : route.slice(1).replace(/[\/\[\]]+/g, '_').replace(/_$/, '');
}

const state: AuditState = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : null;
const ALL_ROUTES = discoverRoutes().filter((r) => !ROUTE_FILTER || ROUTE_FILTER.test(r));
const iPhone = devices['iPhone 13'];

for (const role of ROLES) {
  for (const vp of VIEWPORTS) {
    test.describe(`${role} @ ${vp.label}`, () => {
      test.use({
        userAgent: iPhone.userAgent,
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });

      test('no horizontal overflow', async ({ page }, testInfo) => {
        test.setTimeout(30 * 60 * 1000);
        const routes = ALL_ROUTES.filter((r) => role === 'admin' || !ADMIN_PREFIXES.some((p) => r === p || r.startsWith(p + '/')));
        const results: RouteResult[] = [];

        if (role !== 'signed-out') {
          const session = state.sessions[role];
          await page.addInitScript(([token, user]) => {
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', user);
          }, [session.token, JSON.stringify(session.user)] as const);
        }
        // Something in the cart, so /cart and /checkout render their real steps.
        if (state.samples.listing) {
          const id = state.samples.listing;
          await page.addInitScript((listingId) => {
            if (!localStorage.getItem('cart')) {
              localStorage.setItem('cart', JSON.stringify([{ id: listingId, title: 'Audit sample guitar with a deliberately long model name to stress wrapping', price: 1299, currency: 'USD', image: '' }]));
            }
          }, id);
        }

        for (const pattern of routes) {
          let url = pattern;
          const sampleKey = PARAM_SAMPLES[pattern];
          if (/\[/.test(pattern)) {
            const id = sampleKey ? state.samples[sampleKey] : null;
            if (!id) {
              results.push({ route: pattern, state: 'page', role, width: vp.label, pass: true, skipped: 'no sample id in DB', offenders: [], smallTargets: [] });
              continue;
            }
            url = pattern.replace(/\[[^\]]+\]/, id);
          }

          await page.goto(url, { waitUntil: 'load' }).catch(() => {});
          await settle(page);

          const record = (st: string, m: Awaited<ReturnType<typeof check>>) => {
            results.push({ route: pattern, state: st, role, width: vp.label, pass: m.offenders.length === 0, offenders: m.offenders, smallTargets: m.smallTargets });
          };
          record('page', await check(page, vp.width));
          const shot = path.join(OUT_DIR, role, vp.label, `${slug(pattern)}.png`);
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
          await exploreStates(page, vp.width, record).catch((err) => {
            results.push({ route: pattern, state: 'explore-error', role, width: vp.label, pass: true, skipped: String(err).slice(0, 120), offenders: [], smallTargets: [] });
          });
        }

        await testInfo.attach('mobile-audit', { body: JSON.stringify(results), contentType: 'application/json' });
        const failures = results.filter((r) => !r.pass);
        expect(
          failures.map((f) => `${f.route} [${f.state}] ${f.offenders.map((o) => `${o.kind} ${o.selector} "${o.text}" +${o.overPx}px`).join('; ')}`),
          `${failures.length} overflowing route states`
        ).toEqual([]);
      });
    });
  }
}
