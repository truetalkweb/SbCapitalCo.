# SB Terminal Functional Interaction Audit

Status: release candidate verified for public-beta deployment.

## Classification

- **Functional**: changes application state or completes its stated action.
- **Review-only**: prepares a local paper/review workflow and never submits a live
  order.
- **Unavailable**: disabled or replaced with explanatory text because no
  legitimate implementation exists yet.
- **Data dependent**: functional when authenticated provider/account data exists
  and otherwise presents a truthful empty state.

## Page Results

| Page | Classification | Verified behavior |
| --- | --- | --- |
| Dashboard | Functional | Navigation, ticker selection, chart layouts, selected-card actions, responsive bounds |
| Scanner | Functional | Tabs, keyboard activation, search, numeric/risk/sector filters, presets, row selection, reset |
| Charts | Functional | 1/2/3/4 layouts, timeframe controls, indicators, ticker selection, screenshot/fullscreen source paths |
| Watchlist | Functional | Add/remove, selection, authenticated persistence, local fallback |
| News | Functional with provider limits | Story selection, real article links, new-tab safety attributes, truthful fallback/empty states |
| Alerts | Functional while terminal is open | Create, update/reactivate, pause/resume, delete, trigger history, persistence |
| Orders | Review-only | Available to Free users; shortcuts prepare review state and do not submit live execution |
| Positions | Data dependent | Available to Free users; truthful connected-account empty state |
| Risk | Data dependent and plan gated | Server-issued access boundary; no fabricated calculations without portfolio data |
| Performance | Data dependent and plan gated | Truthful empty state and tested CSV serialization |
| Replay | Functional local simulation | Playback, speed, jump controls, indicators, notes, bookmark add/delete, restore paths |
| Journal | Functional | Editable draft, validation, save, delete, CSV export serialization, persistence |
| Settings | Functional with explicit unavailable controls | Six sections, preference save/restore, cloud revision handling, explanatory disabled states |

## Exact Fixes

1. Unified the 13-page navigation contract for the sidebar and command palette.
2. Added `aria-current="page"` and a named navigation landmark.
3. Removed false tab affordances when no alternate content implementation exists.
4. Replaced decorative disabled filters with non-interactive context labels.
5. Removed editable search fields that had no filtering handler.
6. Fixed nullable market-number parsing so missing values cannot become fabricated
   zeroes.
7. Added cached quote labeling to the market snapshot strip.
8. Stabilized cloud autosave by serializing watchlist identity separately from
   transient quote ticks.
9. Added an accessible delete lifecycle for Replay bookmarks.
10. Replaced the Journal's static default-save behavior with an editable draft,
    validation, clearing after save, and deletion.
11. Added concise explanations to disabled Settings, Alert, Journal, upgrade, and
    export controls.
12. Extracted CSV generation into a tested utility that safely handles missing
    values, commas, quotes, header order, and row order.

## Persistence Results

- The cloud payload includes watchlists, alerts, settings, chart layout and
  indicators, scanner presets/filters, journal entries, Replay notes/bookmarks,
  and workspace preferences.
- Stable watchlist serialization prevents live quote ticks from starving the
  autosave debounce.
- A preference save survived reload and was restored to its original value.
- A second authenticated browser tab restored the saved workspace and four-symbol
  watchlist without the temporary QA alert.
- The prior production launch audit verified logout/login, browser restart,
  production session restoration, password recovery, and two-user isolation.
- Local fallback is user-scoped, size-bounded, validation-protected, and covered
  by storage failure tests.
- Saving, saved, restoring, offline, conflict-restored, and sync-error states are
  implemented.
- Production RLS is enabled for SELECT/INSERT/UPDATE/DELETE; every policy compares
  `auth.uid()` with `user_id`.

## Plan And Safety Results

- Frontend and backend tests cover Free, Pro, Premium, and Admin capability
  boundaries.
- Unknown/inactive plans fail closed to Free.
- Explicit server denial overrides a plan-derived frontend capability.
- Forged lower-plan capabilities are rejected by backend middleware.
- Orders and Positions remain available to Free users.
- Trading shortcuts remain review-only unless connected private broker tooling
  and the backend live-trading safety gate are both intentionally enabled.
- Stripe and live broker execution were not added.

## Data Reliability Results

- Live, cached, provider-limited, fallback, and unavailable states are labeled.
- Missing market values remain unavailable rather than displaying false zeroes.
- Provider diagnostics and raw errors are sanitized from public responses.
- Backend News health now derives source, row count, cache age, degradation, and
  fallback state from the newest real cache payload. Healthy Yahoo Finance rows
  no longer become falsely degraded merely because an FMP or Finnhub key is
  absent.
- Positions, Risk, and Performance show truthful empty states without connected
  portfolio data.
- Provider-limited scanner/news data remains an honest external limitation.

## Responsive And Accessibility Results

- Authenticated browser QA found no document-level horizontal overflow or
  out-of-viewport controls at 1920x1080, 1600x900, 1366x768, or the narrow
  responsive viewport.
- All 13 navigation destinations resolved uniquely.
- Scanner tabs activate by keyboard.
- Tab groups expose selected state, icon controls have labels/titles, and disabled
  actions explain their requirement where useful.
- News article links remain inside their table cells, ellipsize at constrained
  widths, and use safe new-tab attributes when an article URL exists.
- The 3-chart layout rendered TSLA 1D, TSLA 5m, and SPY 1D.
- The 4-chart layout rendered TSLA 1D, TSLA 5m, SPY 1D, and QQQ 5m.
- The 4-chart layout rendered 28 chart canvases without creating workspace-level
  vertical overflow.
- The original 1-chart layout was restored after QA.

## Automated Verification

Final run:

- `npx eslint src test`: passed
- `npm test`: 29/29 frontend tests passed
- `npm run build`: passed
- `npm audit --audit-level=low`: 0 frontend vulnerabilities
- Main application bundle: 333.98 kB minified, 92.31 kB gzip
- Backend `npm test`: 15/15 passed
- Backend `node --check server.js`: passed
- Backend `npm audit --audit-level=low`: 0 vulnerabilities
- Frontend and backend `git diff --check`: passed

Production browser logs contained only browser-extension message-channel closure
noise. No application stack trace was observed. Provider-limited data responses
remain expected and are represented as degraded states rather than fatal errors.

## Intentionally Unavailable

- Upgrade checkout, pending a dedicated payments phase.
- PDF performance export; CSV remains available and its serialization is tested.
- Currency switching, two-factor configuration, device management, and
  unsupported security administration.
- Supabase leaked-password protection on the current Free project; Supabase
  exposes that control on paid plans.
- Live broker execution.
- Portfolio-derived Risk and Performance calculations without connected,
  authenticated account history.

## Files Changed

- `src/App.jsx`
- `src/components/MarketSnapshotStrip.jsx`
- `src/components/TradingSidebar.jsx`
- `src/components/premium/PremiumWorkspace.jsx`
- `src/hooks/useCloudWorkspace.js`
- `src/config/premiumNavigation.js`
- `src/services/authNavigationPolicy.js`
- `src/services/tradingActionPolicy.js`
- `src/services/workspacePayloadPolicy.js`
- `src/utils/csvExport.js`
- `src/utils/marketNumbers.js`
- Focused tests under `test/`
- Backend News health normalization and its focused tests
- Safe dependency lockfile updates in both repositories
- This audit document

## Recommendation

The release candidate is suitable for a controlled public beta after the
backend and frontend commits are deployed and the final production smoke pass
confirms authentication, health endpoints, charts, and Admin Monitoring.
