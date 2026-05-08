import { expect, test, type Page } from '@playwright/test';

const protectedScreens = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'investigation-cases', path: '/investigation?tab=cases' },
  { name: 'investigation-alerts', path: '/investigation?tab=alerts' },
  { name: 'investigation-observables', path: '/investigation?tab=observables' },
  { name: 'dashboards-list', path: '/dashboards' },
  { name: 'tasks-list', path: '/tasks' },
  { name: 'search', path: '/search?q=demo' },
  { name: 'live', path: '/live' },
  { name: 'notifications', path: '/notifications' },
  { name: 'knowledge-pages', path: '/pages' },
  { name: 'misp', path: '/misp' },
  { name: 'personal-settings', path: '/personal-settings' },
  { name: 'admin', path: '/admin' },
  { name: 'admin-users', path: '/admin/users' },
  { name: 'admin-organisations', path: '/admin/organisations' },
  { name: 'admin-profiles', path: '/admin/profiles' },
  { name: 'admin-case-templates', path: '/admin/case-templates' },
  { name: 'admin-custom-fields', path: '/admin/custom-fields' },
  { name: 'admin-observable-types', path: '/admin/observable-types' },
  { name: 'admin-taxonomy', path: '/admin/taxonomy' },
  { name: 'admin-attack', path: '/admin/attack' },
  { name: 'admin-analyzer-templates', path: '/admin/analyzer-templates' },
  { name: 'admin-platform-status', path: '/admin/platform-status' },
  { name: 'admin-ui-settings', path: '/admin/ui-settings' },
  { name: 'cases-create', path: '/cases/create' },
  { name: 'change-password', path: '/change-password' },
  { name: 'reset-password', path: '/reset-password' },
  { name: 'about', path: '/about' },
];

test.describe('TheHive 4 visual parity baseline', () => {
  test('login screen baseline', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByRole('heading', { name: /sign in/i }).waitFor();
    await stabilize(page);
    await expect(page).toHaveScreenshot('login.png', { fullPage: true });
  });

  for (const screen of protectedScreens) {
    test(`${screen.name} baseline`, async ({ page }) => {
      await page.goto(screen.path);
      await waitForAppShell(page);
      await stabilize(page);
      await expect(page).toHaveScreenshot(`${screen.name}.png`, { fullPage: true });
    });
  }
});

async function waitForAppShell(page: Page) {
  await page.locator('.content-wrapper, .login-box, main').first().waitFor({ timeout: 20_000 });
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
