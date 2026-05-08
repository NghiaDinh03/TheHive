import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
  const adminLogin = process.env.PLAYWRIGHT_ADMIN_LOGIN ?? 'nghia.dinh@ncsgroup.vn';
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? '12345@';

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseURL}/login?visual=1`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Login').fill(adminLogin);
  await page.getByLabel('Password').fill(adminPassword);
  
  // Click sign in and wait for navigation
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 30_000 });

  await context.storageState({ path: './tests/visual/.auth/admin.json' });
  await browser.close();
}

export default globalSetup;
