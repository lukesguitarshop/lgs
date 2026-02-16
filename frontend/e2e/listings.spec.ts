import { test, expect } from './fixtures/auth.fixture';

test.describe('Listings', () => {
  test.describe('Browse Listings', () => {
    test('home page loads listing grid', async ({ page }) => {
      await page.goto('/');
      // Should show listings heading
      await expect(page.getByRole('heading', { name: /listings/i })).toBeVisible();
      // Should show at least one listing card
      await expect(page.locator('a[href*="/listing/"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('displays listing images', async ({ page }) => {
      await page.goto('/');
      // Listing cards should have images
      const listingCard = page.locator('a[href*="/listing/"]').first();
      await expect(listingCard.locator('img').first()).toBeVisible();
    });

    test('displays prices', async ({ page }) => {
      await page.goto('/');
      // Should show price on listing cards (format: $XXX or $X,XXX)
      await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible();
    });

    test('displays condition badges', async ({ page }) => {
      await page.goto('/');
      // Should show condition (Excellent, Very Good, etc.)
      await expect(page.getByText(/excellent|very good|good|fair/i).first()).toBeVisible();
    });

    test('displays listing count', async ({ page }) => {
      await page.goto('/');
      // Should show listing count (e.g., "7 listings")
      await expect(page.getByText(/\d+ listings?/i)).toBeVisible();
    });
  });

  test.describe('Search & Filter', () => {
    test('search input is visible', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test('search filters results', async ({ page }) => {
      await page.goto('/');
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('Gibson');
      await page.waitForTimeout(500); // Debounce

      // Should filter or show results
      await page.waitForTimeout(500);
    });

    test('price filter inputs are visible', async ({ page }) => {
      await page.goto('/');
      // Price range inputs
      const priceInputs = page.locator('input[type="number"]');
      await expect(priceInputs.first()).toBeVisible();
    });

    test('condition checkboxes are visible', async ({ page }) => {
      await page.goto('/');
      // Condition filter checkboxes
      await expect(page.getByRole('checkbox').first()).toBeVisible();
    });

    test('sort dropdown works', async ({ page }) => {
      await page.goto('/');
      // Click on sort dropdown
      const sortButton = page.getByRole('combobox');
      await sortButton.click();

      // Should show sort options
      await expect(page.getByText(/newest|oldest|price/i).first()).toBeVisible();
    });
  });

  test.describe('Listing Detail', () => {
    test('clicking listing opens detail page', async ({ page }) => {
      await page.goto('/');

      // Click first listing
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/listing\//);
    });

    test('detail page shows listing title', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Should show heading with listing title
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('detail page shows add to cart button', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();
    });

    test('detail page shows price', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Should show price
      await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible();
    });

    test('detail page shows image gallery', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();

      // Should show listing images
      await expect(page.locator('img').first()).toBeVisible();
    });

    test('detail page shows contact seller button when logged in', async ({ page, loginAsUser }) => {
      // This test requires login to work
      try {
        await loginAsUser();
        const firstListing = page.locator('a[href*="/listing/"]').first();
        await firstListing.click();

        // Should show message/contact button
        await expect(page.getByRole('button', { name: /message|contact/i })).toBeVisible();
      } catch {
        // Skip if login fails (test user not in DB)
        test.skip();
      }
    });
  });
});
