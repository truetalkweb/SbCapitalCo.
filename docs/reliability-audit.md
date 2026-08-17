# SbCapitalCo Terminal Reliability Audit

Audit date: 2026-08-05

## Functional Classification

| Area | Current behavior | Classification |
| --- | --- | --- |
| Dashboard | Live/cached market context, working mover views, review shortcuts | Real data with declared fallback |
| Scanner | Backend-first categories, filters, ranking, selected-symbol context | Real provider data with resilient fallback |
| Charts | Questrade-backed quotes/candles when available; historical simulation is labeled | Real or explicitly simulated |
| Watchlist | Authenticated backend storage plus searchable local views | Real and persistent |
| News | Backend provider feed, clickable source articles, category/search views | Real provider data with declared fallback |
| Alerts | Browser-persisted alerts evaluated while the terminal is open | Functional local feature |
| Orders | Authenticated broker rows when available; public controls prepare reviews only | Real data / review-only actions |
| Positions | Authenticated broker positions when available; no sample holdings presented as real | Real data or honest empty state |
| Risk | Derived from connected positions; unavailable without account data | Real derived data |
| Performance | Derived from recorded trades/account data | Real derived data |
| Replay | Historical simulation; orders and results are simulated | Simulated and labeled |
| Journal | User-created, browser/cloud-persisted trade records | Functional and persistent |
| Settings | Workspace preferences, cloud save/load, password reset, account deletion | Functional where enabled |

## Security Boundaries

- Supabase publishable/anon credentials are the only Supabase credentials allowed in the frontend.
- The service-role key is backend-only.
- Entitlements are issued by the backend from `app_metadata` and the owner-scoped `user_entitlements` row.
- Unknown or inactive plans fail closed to Free.
- Broker diagnostics and account routes require authentication, Admin capability, and the configured private owner email.
- Public order controls remain review-only. Live execution requires separate backend feature flags and private-owner checks.
- Supabase workspace and entitlement tables use row-level security with `auth.uid() = user_id` ownership checks.

## Degraded Data Rules

- Provider-limited, cached, delayed, and simulated data must remain visibly distinguishable.
- Raw upstream errors stay in server logs rather than the main trading UI.
- Scanner fallback must return useful context rows rather than an empty core screen.
- Missing numeric values remain unavailable; they are not converted to zero.
- Questrade premarket movement is derived from the latest completed daily close when quote change fields are absent.

## Verification Baseline

- Frontend lint: passed
- Frontend tests: 49 passed
- Frontend production build: passed
- Backend syntax check: passed
- Backend tests: 31 passed
- Frontend production dependency audit: 0 vulnerabilities
- Backend production dependency audit: 0 vulnerabilities
- Local API smoke test: health, scanner, movers, ticker news passed
- Anonymous access test: entitlement, watchlist, broker account, and admin routes returned `401`
- Authenticated production browser QA: all 13 premium workspaces rendered without a visible error state
- Local changed-surface QA: Dashboard categories, Watchlist, News, and Orders interactions passed
- Automated Playwright release gate: 20 browser/API checks passed across all 13 workspaces and three desktop viewports

## Remaining External Checkpoints

- The scanner and workspace improvements require a later deployment and post-deploy production verification.
- Exact fresh screenshots at every target viewport were not recaptured in this pass; current desktop QA and existing 1366/1600/1920 artifacts were reviewed.
- Provider depth and freshness remain constrained by the current free/limited market-data plans.
- Economic calendar, checkout, device management, PDF export, and public live broker execution are intentionally not connected.
