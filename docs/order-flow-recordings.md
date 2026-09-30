# Local Order Flow recordings

Use the Upload icon in the existing Order Flow toolbar. Settings provides a downloadable **simulated format example**. Files are validated in a browser worker, never uploaded, and held only in this mounted workspace. Reloading or leaving the workspace discards them. This is historical analysis, not a live feed or order execution source. A declared historical source is always labeled unverified.

Version 1 accepts JSON with `format: "sb-order-flow-recording"`, `version: 1`, `provenance: "historical"` or `"simulated"`, a nonempty `source` label (160 characters maximum), `instrument`, and `events`. See [the complete example](../public/order-flow-recording-example.json) and [protocol types](../src/modules/orderFlow/types.d.ts).

The instrument must specify an exact contract ID and valid ISO expiry for ES, NQ, MES or MNQ. Tick size is 0.25 and price precision is 2. Contract multipliers are ES 50, NQ 20, MES 5 and MNQ 2. Root aliases alone are not contract IDs. Metadata is checked against canonical definitions; this validation does not authenticate a vendor or prove that a contract ID exists on an exchange.

Each event includes version 1, root `symbol`, matching `contractId`, one nonempty `epoch`, and a decimal-string Unix `timestampNs`. Numeric nanosecond timestamps are rejected to avoid precision loss. Events must be ordered by exchange timestamp, including ties, and cannot be in the future. Start with a `session` event with `marketDataMode: "historical"` and decimal-string `tradeSequence` baseline. Reconnects require separate files.

- Trades: `type: "trade"`, decimal-string `sequence`, unique `tradeId`, on-tick `price`, positive integer `size`, and `side: "buy"`, `"sell"` or `"unknown"`. Trade sequences must increment from the session baseline. Unknown aggressor volume contributes to total volume but never invents buy/sell delta; affected signals are suppressed.
- Depth: begin with `book-snapshot`, decimal-string `sequence`, and `levels` entries containing `side: "bid"` or `"ask"`, on-tick `price`, positive integer `size`, and optional integer `orders`. Subsequent `depth-update` events contain `changes` with the same fields; zero size deletes a level. Depth sequences must increment independently from trades. Crossed books, duplicates and missing baselines are rejected.
- Heartbeats: `type: "heartbeat"` with the shared envelope. They do not fabricate trades or depth.

Limits: 8 MiB, 20,000 events, 12,000 trades, 600 expanded depth states and 120,000 expanded depth levels. Files exceeding a limit are rejected in full, never silently truncated. Split larger recordings into continuous segments with correct sequence baselines and an initial depth snapshot. At least one trade is required; trade-only recordings are supported and show no DOM or fabricated open interest.

Replay selects trades and depth at or before the cursor using nanosecond timestamps. Settings, filtering, footprint modes, tape, heatmap, delta and heuristic signals use the existing analytics pipeline. Reset rewinds the file; Settings → Clear local recording releases it. Invalid imports preserve the current dataset. Vendor CSV/binary exports require conversion to this normalized schema; no vendor-specific converter or paid data subscription is included.
