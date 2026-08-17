# SbCapitalCo Release Gate

The release gate is a zero-cost local and CI check for the terminal's critical browser and API behavior. It uses Playwright with a deterministic premium-workspace fixture and starts both the Vite frontend and Express backend automatically.

## First-Time Setup

```powershell
cd D:\Projects\trading-platform\frontend
npm install
npx playwright install chromium
```

No paid service, test account, API key, or stored password is required.

## Commands

Run only browser/API checks:

```powershell
npm run test:e2e
```

Run the complete release gate:

```powershell
npm run release:gate
```

Open Playwright's interactive test runner while developing:

```powershell
npm run test:e2e:ui
```

## Coverage

- Fresh browser session reaches the real Supabase authentication gate.
- All 13 premium workspaces render without browser console or page errors.
- Dashboard scanner categories, News views, Watchlist search, and Orders lifecycle views remain aligned with their detail panels.
- A real `lightweight-charts` canvas renders at a usable, nonblank size.
- Public order shortcuts prepare a review and require the full order ticket before submission.
- Free, Premium, and Admin workspace access uses the production entitlement policy. Orders and Positions remain available on Free.
- Dashboard layout stays inside the viewport at 1366x768, 1600x900, and 1920x1080.
- Backend health returns online and protected entitlement, watchlist, broker, and admin routes return `401` anonymously.

## Artifacts

- Responsive screenshots: `release-gate-artifacts/`
- Failure screenshots, videos, and traces: `test-results/`
- HTML report: `playwright-report/`

These directories are ignored by Git.

## Environment Overrides

The gate defaults to frontend port `4173` and backend port `4012`. Override them when needed:

```powershell
$env:RELEASE_FRONTEND_PORT="4174"
$env:RELEASE_BACKEND_PORT="4013"
npm run test:e2e
```

To test an already running backend:

```powershell
$env:RELEASE_BACKEND_URL="https://your-backend.example.com"
npm run test:e2e
```

The local backend uses `DISABLE_QUESTRADE_AUTH=true` during the gate so browser tests cannot consume or rotate a broker token.

## CI

Use these commands in any free CI runner:

```bash
npm ci
npx playwright install --with-deps chromium
npm run release:gate
```

Upload `playwright-report`, `test-results`, and `release-gate-artifacts` only when useful for review.

## Honest Boundary

The gate does not store live Supabase credentials or submit broker orders. It checks the real unauthenticated auth screen, the production entitlement policy, deterministic workspace interactions, review-only trading safety, and protected API behavior. A signed-in production smoke test remains a separate manual post-deployment checkpoint.
