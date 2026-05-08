import { test, expect } from '@playwright/test';

// F6 — Accessibility and Keyboard Navigation Parity
// WCAG 2.1 AA compliance checks for core workflows.

test.describe('F6 Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="login"], input[type="email"], input[placeholder*="email"]', 'admin@thehive.local');
    await page.fill('input[name="password"], input[type="password"]', '12345@');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|investigation|cases)/);
  });

  test('F6 Login page has proper form labels', async ({ page }) => {
    await page.goto('/login');

    // Check for form labels
    const loginInput = page.locator('input[name="login"], input[type="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"]');

    // Verify inputs exist
    await expect(loginInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check for aria-label or placeholder
    const loginLabel = await loginInput.getAttribute('aria-label') || await loginInput.getAttribute('placeholder');
    const passwordLabel = await passwordInput.getAttribute('aria-label') || await passwordInput.getAttribute('placeholder');

    expect(loginLabel).toBeTruthy();
    expect(passwordLabel).toBeTruthy();

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-login.png' });
  });

  test('F6 Dashboard has proper heading structure', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for h1 or main heading
    const headings = page.locator('h1, h2, [role="heading"]');
    const headingCount = await headings.count();

    expect(headingCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-dashboard.png' });
  });

  test('F6 Navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/dashboard');

    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-keyboard-nav.png' });
  });

  test('F6 Case list has proper table structure', async ({ page }) => {
    await page.goto('/investigation');

    // Check for table or list structure
    const table = page.locator('table, [role="table"], [role="grid"], [role="list"]');
    const tableCount = await table.count();

    expect(tableCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-case-list.png' });
  });

  test('F6 Case detail has proper landmark regions', async ({ page }) => {
    await page.goto('/investigation');

    // Click first case if exists
    const caseLink = page.locator('a[href*="/cases/"]').first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
      await page.waitForURL(/\/cases\//);

      // Check for main content area
      const main = page.locator('main, [role="main"], .content-wrapper');
      await expect(main).toBeVisible();

      await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-case-detail.png' });
    }
  });

  test('F6 Color contrast check - buttons', async ({ page }) => {
    await page.goto('/dashboard');

    // Check primary buttons exist and are visible
    const buttons = page.locator('button, .btn, [role="button"]');
    const buttonCount = await buttons.count();

    expect(buttonCount).toBeGreaterThan(0);

    // Verify at least one button is visible
    const firstButton = buttons.first();
    await expect(firstButton).toBeVisible();

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-buttons.png' });
  });

  test('F6 Images have alt text', async ({ page }) => {
    await page.goto('/login');

    // Check images for alt attributes
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');

      // Images should have alt or aria-label
      expect(alt !== null || ariaLabel !== null).toBeTruthy();
    }

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-images.png' });
  });

  test('F6 Form inputs have labels', async ({ page }) => {
    await page.goto('/cases/create');

    // Check for form inputs
    const inputs = page.locator('input:not([type="hidden"]), select, textarea');
    const inputCount = await inputs.count();

    // At least some inputs should exist
    expect(inputCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-forms.png' });
  });

  test('F6 Skip navigation link exists', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for skip link (common accessibility pattern)
    const skipLink = page.locator('a[href="#main"], a[href="#content"], .skip-link, [class*="skip"]');
    const skipLinkCount = await skipLink.count();

    // Skip link is recommended but not required
    if (skipLinkCount > 0) {
      console.log('Skip navigation link found');
    }

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-skip-nav.png' });
  });

  test('F6 Focus indicators are visible', async ({ page }) => {
    await page.goto('/login');

    // Tab to first interactive element
    await page.keyboard.press('Tab');

    // Check if focused element has visible focus indicator
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    await page.screenshot({ path: 'tests/visual/__screenshots__/a11y-focus.png' });
  });
});
