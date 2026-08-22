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

## Verification

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

Run the complete release gate with:

```powershell
npm run release:gate
```

The Playwright gate renders every public workspace, checks chart canvases,
selection state, entitlement boundaries, responsive dashboard dimensions, and
public/protected backend behavior. Responsive dashboard screenshots are written
to `release-gate-artifacts/`.

## Deployment

Do not deploy directly from an unverified working tree. Run
`npm run release:gate`, review the generated desktop screenshots, then deploy
the frontend through the existing Vercel production workflow.
