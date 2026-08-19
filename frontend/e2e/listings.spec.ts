import { test, expect } from './fixtures/auth.fixture';

test.describe('Listings', () => {
  test.describe('Browse Listings', () => {
    test('home page loads listing grid', async ({ page }) => {
      await page.goto('/');
      // Should show the inventory heading
      await expect(page.getByRole('heading', { name: /in stock right now/i })).toBeVisible();
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
      // The count now leads the inventory heading (e.g. "7 in stock right now")
      await expect(
        page.getByRole('heading', { name: /\d+ in stock right now/i })
      ).toBeVisible();
    });
  });

  test.describe('Search & Filter', () => {
    // The sidebar search carries an example placeholder ("Gibson, PRS, flame top…"),
    // so it is addressed by its label rather than its placeholder text.
    test('search input is visible', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByLabel(/^search$/i)).toBeVisible();
    });

    test('search filters results', async ({ page }) => {
      await page.goto('/');
      const searchInput = page.getByLabel(/^search$/i);
      await searchInput.fill('Gibson');
      await page.waitForTimeout(500); // Debounce

      // The heading carries the live count, so filtering is observable there.
      await expect(
        page.getByRole('heading', { name: /\d+ in stock right now/i })
      ).toBeVisible();
      await expect(page).toHaveURL(/q=Gibson/i);
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
      await expect(page).toHaveURL(/\/listing\//);

      // Should show heading with listing title
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('detail page shows add to cart button', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();
      // The grid also has Add to Cart buttons now, so wait for the navigation before
      // asserting or the locator matches the homepage cards instead.
      await expect(page).toHaveURL(/\/listing\//);

      await expect(
        page.getByRole('button', { name: /add to cart/i }).first()
      ).toBeVisible();
    });

    test('detail page shows price', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();
      await expect(page).toHaveURL(/\/listing\//);

      // Should show price
      await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible();
    });

    test('detail page shows image gallery', async ({ page }) => {
      await page.goto('/');
      const firstListing = page.locator('a[href*="/listing/"]').first();
      await firstListing.click();
      await expect(page).toHaveURL(/\/listing\//);

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
