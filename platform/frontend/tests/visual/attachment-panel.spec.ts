import { expect, test, type Page } from '@playwright/test';

const adminLogin = process.env.PLAYWRIGHT_ADMIN_LOGIN ?? 'nghia.dinh@ncsgroup.vn';
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? '12345@';
const caseId = process.env.PLAYWRIGHT_CASE_ID;
const observableId = process.env.PLAYWRIGHT_OBSERVABLE_ID;

test.describe.configure({ mode: 'serial' });

test.describe('Attachment panel UI parity', () => {
  test.skip(!caseId, 'Set PLAYWRIGHT_CASE_ID to run case detail attachment panel test against seeded data');

  test('case detail shows attachment panel controls', async ({ page }) => {
    await login(page);
    await page.goto(`/cases/${caseId}`);
    await stabilize(page);
    await expect(page.getByRole('heading', { name: /case attachments/i })).toBeVisible();
    await expect(page.getByText(/MinIO\/S3 evidence storage/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /upload \+ mark clean/i })).toBeVisible();
    await expect(page.getByRole('table').filter({ hasText: /Scan/i })).toBeVisible();
  });

  test.skip(!observableId, 'Set PLAYWRIGHT_OBSERVABLE_ID to run observable attachment panel test against seeded data');

  test('observable detail shows attachment panel controls', async ({ page }) => {
    await login(page);
    await page.goto(`/observables/${observableId}`);
    await stabilize(page);
    await expect(page.getByRole('heading', { name: /observable attachments/i })).toBeVisible();
    await expect(page.getByText(/MinIO\/S3 evidence storage/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /upload \+ mark clean/i })).toBeVisible();
  });
});

test.describe('Attachment runtime interaction smoke', () => {
  test.skip(process.env.PLAYWRIGHT_ATTACHMENT_RUNTIME !== '1' || !caseId, 'Set PLAYWRIGHT_ATTACHMENT_RUNTIME=1 and PLAYWRIGHT_CASE_ID to run real MinIO upload/download smoke');

  test('uploads bytes, marks clean, and exposes download policy through UI', async ({ page }) => {
    await login(page);
    await page.goto(`/cases/${caseId}`);
    await stabilize(page);
    const fileName = `playwright-evidence-${Date.now()}.txt`;
    await page.setInputFiles('input[type="file"]', { name: fileName, mimeType: 'text/plain', buffer: Buffer.from('TheHive attachment smoke evidence') });
    await page.getByRole('button', { name: /upload \+ mark clean/i }).click();
    await expect(page.getByText(/Attachment uploaded and marked clean/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('row', { name: new RegExp(fileName) })).toContainText('clean');
  });
});

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login?visual=1');
  await page.getByLabel('Login').fill(adminLogin);
  await page.getByLabel('Password').fill(adminPassword);
  await Promise.all([
    page.waitForURL(/\/(dashboard|change-password)/, { timeout: 20_000 }),
    page.locator('form').getByRole('button', { name: /sign in/i }).click(),
  ]);
  if (page.url().includes('/change-password')) {
    throw new Error('Attachment UI test user must not require first-login password rotation');
  }
}

async function stabilize(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}
