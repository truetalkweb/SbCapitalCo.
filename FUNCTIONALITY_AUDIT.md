# SbCapitalCo Terminal Functionality Audit

Status legend: **Working**, **Partial**, **Review-only**, **Unavailable**, **Degraded**.

## Product Safety

- Live public broker execution: **Unavailable by design**. Order shortcuts prepare a review; they do not submit live orders.
- Paper/local orders: **Working** with confirmation and local/cloud workspace persistence.
- Market data: **Working with degraded modes**. The UI distinguishes Questrade, provider-limited, cached, fallback, and unavailable states.
- Financial calculations: **Partial**. Position, risk, and performance panels use authenticated/local records only; unavailable fields remain unavailable rather than being invented.

## Page Matrix

| Page | Working | Partial / unavailable |
| --- | --- | --- |
| Dashboard | Navigation, symbol selection, chart layouts, watchlist selection, scanner selection, news links, review actions, dock | Some account/risk metrics require authenticated records |
| Scanner | Tabs, relative-volume threshold, saved scanner preset, row selection, chart/watchlist actions | Advanced filter builder is unavailable; provider limits can produce cached/fallback rows |
| Charts | Symbol/timeframe selection, 1-4 chart layouts, sync, indicators, chart rendering | Advanced drawing set depends on the chart implementation |
| Watchlist | Add, remove, select, search, persistence, chart/alert actions | Fundamentals depend on provider coverage |
| News | Ticker selection, headline selection, real article links, market fallback | AI summaries depend on Gemini/provider availability |
| Alerts | Create, edit, pause/resume, delete, local/cloud persistence, selected-symbol trigger evaluation | Email/push delivery is unavailable; browser notifications require permission |
| Orders | Local/paper review workflow, audit trail, backend audit restore | Public live execution is intentionally unavailable |
| Positions | Authenticated/local positions, P&L display, selection, close review | Close action is review-only; missing broker values stay unavailable |
| Risk | Record-backed exposure and P&L context | VaR/beta/concentration require supplied account data; no fabricated estimates |
| Performance | Journal/account-based KPIs, CSV export | PDF export unavailable; empty state shown without real history |
| Replay | Play/pause, speed, step, time jumps, reset, simulated trades, persisted bookmarks, journal handoff | 1D only; drawing tools, screenshot export, and replay settings unavailable |
| Journal | Draft, save entry, delete, replay handoff, CSV export, local/cloud persistence | Advanced filters and PDF reporting unavailable |
| Settings | Theme, landing page, time zone, timeframe, volume, scanner refresh/threshold, password reset, cloud save/load/reset | Compact mode and layout presets unavailable; notification/billing/device controls unavailable |

## Shared Shell

- Authentication and password recovery: **Working** through Supabase when configured.
- Entitlements: **Working** through backend/Supabase entitlement records with free fallback.
- Owner/admin access: **Working only when assigned server-side**; no client-side email bypass.
- Global search and navigation: **Working**.
- Theme: **Working** for dark/light surfaces and chart theme.
- Cloud workspace: **Working** for signed-in users, with local browser fallback.
- Data health/retry: **Working**, with user-clean status labels.

## Backend Coverage

- Health/config: `/api/platform/health`, `/api/health/deep`, `/api/config/status`.
- Entitlements: `/api/entitlements/me`, admin entitlement management.
- Market intelligence: movers/scanner, news, ticker detail, Gemini catalyst summary.
- User data: watchlist, order audit.
- Questrade: status/readiness, symbols, quotes, candles, accounts, balances, positions, orders.
- Trading: preview and paper routes are available; live routes remain protected and feature-gated.

## Known Honest Limits

1. Free FMP/Finnhub tiers can rate-limit scanner and news coverage.
2. Questrade sessions and entitlements depend on valid server-side credentials.
3. Browser alerts are local-session evaluations, not a server-side always-on alert service.
4. Replay uses loaded historical candles and does not yet resample between timeframes.
5. Billing, public live execution, email notifications, advanced replay tools, PDF reports, and layout presets are not production features yet.

