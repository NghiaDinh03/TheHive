# TheHive 4 visual regression baseline

This folder stores Playwright visual parity tests for the Next.js migration UI.

## Commands

```bash
npm run visual:install
npm run visual:update
npm run visual:test
```

## Baseline policy

- Baselines are generated from deterministic local data seeded by the platform fixture migrator.
- Covered screens: login, dashboard, investigation tabs, admin, and task demo workspace.
- Default threshold is intentionally loose during migration hardening: `maxDiffPixelRatio: 0.03`, `threshold: 0.2`.
- Tighten thresholds once TheHive 4 screenshots are captured and approved.
- Never update screenshots silently. Treat each baseline update like a UI contract change and review it in PR.

## Environment

The protected pages use the local development admin by default:

```text
PLAYWRIGHT_ADMIN_LOGIN=nghia.dinh@ncsgroup.vn
PLAYWRIGHT_ADMIN_PASSWORD=12345@
```

Override these in CI or staging. Do not use production credentials for screenshot tests.
