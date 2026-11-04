# SB Terminal Frontend

React + Vite frontend for the SbCapitalCo market-intelligence terminal.

## Local development

```powershell
npm install
npm run dev
```

The development server defaults to `http://127.0.0.1:5173`. Configure
`VITE_BROKER_API_URL` to point at the Railway backend when testing real
provider data.

## Premium workspace architecture

- `src/components/premium/PremiumWorkspace.jsx` is the authenticated
  workspace orchestrator. It normalizes shared data, enforces entitlements,
  composes shared actions, and routes to focused pages.
- `src/components/premium/pages/` contains the Charts, Scanner, Watchlist,
  News, Alerts, Orders, Positions, Risk, Performance, Journal, Replay, and
  Settings pages.
- `DashboardMarketIntelligence.jsx` owns the Dashboard page.
- `PremiumWorkspacePrimitives.jsx` contains the shared card, table, tab,
  action, metric, status, and detail-rail primitives.
- `premiumWorkspaceData.js` contains deterministic data adapters and
  financial display helpers.
- `src/hooks/usePremiumWorkspaceState.js` owns page-local UI state.
- `src/hooks/usePremiumWorkspaceViews.js` keeps filtered rows and selected
  detail records aligned.
- `src/hooks/usePremiumScannerRows.js` owns scanner universe and filter
  derivation.
- `src/hooks/usePremiumWorkspaceActions.js` centralizes chart navigation and
  review-only order/alert shortcuts.

All public trading shortcuts remain review-only. Live execution must not be
introduced through a workspace component.

## Trade planning

Help & shortcuts → Quick Start offers direct links through Watchlist, Charts,
paper Orders and Journal. Links follow current capability checks; unavailable
steps lead to account settings and explain access instead of submitting any
commands. Plan descriptions distinguish Free paper simulation, Pro journal/AI/
replay, Premium risk/performance and Admin owner-only diagnostics.

Scanner and Charts share a per-symbol trade plan (direction, setup, stop,
target and notes). Review Order carries it into the paper ticket without
submitting. Ticket edits, quantity, order type and duration follow the symbol
between workspaces and reloads in the same browser session. Drafts are scoped
to the signed-in user and bounded to 100 symbols; they are not cloud backups
or cross-device drafts. Blocked session storage falls back to memory.

Checklist acknowledgements are never restored from a draft. Paper execution
retains a first-entry plan snapshot through partial exits and adds; Journal
and Journal CSV show that original plan. Later protection edits do not rewrite
the historical entry plan. Legacy executions without a snapshot stay unknown.

## Verification

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:workflows
```

Run the complete release gate with:

```powershell
npm run release:gate
```

The release gate also runs the isolated onboarding and trade-workflow tests
through `npm run test:workflows`. They cover capability-aware Quick Start,
per-symbol trade plans, session reloads, explicit paper execution, journal
entry plans, and CSV export on mobile and desktop. The fixtures block
unexpected external requests and use isolated paper accounts.

The Playwright gate renders every public workspace, checks chart canvases,
selection state, entitlement boundaries, responsive dashboard dimensions, and
public/protected backend behavior. Responsive dashboard screenshots are written
to `release-gate-artifacts/`.

The ten-minute isolated soak runs separately with its own server and timeout:

```powershell
npm run test:soak
```

It uses the base URL from `playwright.soak.config.js` (port 4176 by default).
The default `test:e2e` command excludes the correctness and soak directories.
`release:gate` adds the selected workflow cases from correctness using their
dedicated configuration. The remaining correctness cases and the soak are
separate; release validation does not claim a long-duration stability result.

## Deployment

Do not deploy directly from an unverified working tree. Run
`npm run release:gate`, review the generated desktop screenshots, then deploy
the frontend through the existing Vercel production workflow.
