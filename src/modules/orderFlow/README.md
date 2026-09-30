# SB Terminal Order Flow module

The registered `order-flow` workspace uses the existing authenticated terminal shell, theme variables, navigation and lazy loading. It replaces the inactive Options Flow placeholder. The demo is available to all signed-in plans. Existing dashboard quotes and paper execution are separate and untouched.

## Data and components

- `types.d.ts`: normalized trade, depth, footprint, signal, metrics, provider and future execution-adapter contracts. Units are feed-defined; the demo uses integer units. Unknown aggressor sides must remain unknown, rather than guessed buys/sells.
- `MockMarketDataProvider`: deterministic seeded simulation, stable external-store snapshots, 4 Hz batched publication, 12,000 retained trades and 600 book snapshots. It generates trades and best bid/ask depth on instrument price increments. The fixed starting prices and timestamps are illustrative, not market quotes. Order counts are simulated.
- `analytics.js`: pure aggregation, diagonal imbalance comparisons, adjacent stacked imbalances, volume conservation, signed delta, VWAP, price-level POC and a contiguous 70% value area. Current-bar delta is separate from cumulative delta over the retained window. Unknown-side trades are excluded from signed-volume calculations. Open interest is unavailable, not invented.
- `FootprintChart`: DPR-aware Canvas rendering and historical heatmap with five display modes, price/time scales, crosshair/level tooltips, wheel zoom, drag pan and fit. Candle gold outlines indicate POC; dashed session POC and VWAP lines and value-area shading use retained-window calculations. Marks identify unfinished auctions, stacked imbalances and absorption/exhaustion candidates when their rules fire.
- `OrderFlowPanels`: resizable DOM/tape, size filters, bounded heuristic signal list, collapsible metrics and cumulative delta. Block-size filtering is a configurable size threshold, not an exchange-confirmed block trade.
- `OrderFlowSettings`: keyboard-accessible modal drawer with bounded thresholds, depth, heatmap, fonts, colors, UTC session filters, formatting, grid and opt-in sounds. Settings persist under the versioned `sb_order_flow_settings_v1` browser key.

## Live adapter integration

`OrderFlowPage` accepts a `createProvider(options)` factory. Implement the `MarketDataProvider` interface and normalize adapter-specific events before publishing snapshots. Trades must arrive in time/sequence order; handle exchange sequence gaps, reconnection and duplicates in the adapter. Aggressor side requires an explicit venue field or a separately documented classification method. Market-by-price feeds must leave unavailable order counts unset. Handle resyncs atomically so one snapshot cannot mix books from different instruments.

Rithmic/CQG/CME/IB/crypto entries are disabled placeholders, not connected feeds. Before exposing a live adapter, replace the demo instrument metadata with exact venue/contract metadata and wire capability/provenance status to the toolbar, panel labels and unavailable fields. Futures expiry/roll management and exchange permissions belong to that integration. The normalized analytics/rendering can remain in place.

No execution adapter is installed. The module has no execution controls or broker order calls. The future execution contract is deliberately independent of the market-data provider; a connected execution API and order review/authorization would be required to enable it.

## Replay and limitations

Replay freezes simulation, clips trades and books at the cursor, and recalculates all metrics without future snapshots. Scrubbing, stepping and 1×–8× playback use the retained dataset. Playback advances against recorded event timestamps and elapsed browser time, rather than a fixed number of trades per frame. Reset restores defaults and a new deterministic seed; changing instrument isolates the provider and disposes the prior timer. Custom UTC sessions support overnight windows.

Signals are heuristic candidates, not certified exchange events or trade recommendations. Absorption, exhaustion, failed auctions and sweeps require richer context for professional confirmation. The demo is not a full MBO reconstruction, market-wide tape, futures execution system or exchange session calendar. The rolling window is labelled explicitly; cumulative delta is not an unbounded full-day total.

Canvas paints are scheduled with requestAnimationFrame; updates stay local to this lazy-loaded module. A local 12,000-trade benchmark measured aggregation plus signals at 3.30 ms median / 8.32 ms p95 over 30 runs. These measurements exclude browser rendering and do not establish 60 FPS on all devices.

Tests: `node --test test/orderFlow.test.js` and `npx playwright test --config playwright.correctness.config.js -g 'order flow'`. Live authenticated checks: `scripts/verify-order-flow-production.mjs` (uses an ephemeral QA account and blocks execution requests).
