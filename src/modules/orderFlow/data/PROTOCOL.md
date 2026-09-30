# Order Flow normalized bridge protocol v1

This is a connector boundary, not a claim of an installed CME/Rithmic/CQG service. No live connector, exchange permission, credential, WebSocket route or automatic contract resolver is configured in the deployment. Selecting **CME bridge** shows unavailable, empty trades/depth, and no invented provider timestamp. The simulator is independent and still usable.

## Contracts and identity

Resolve exact instrument/expiry through the server-side vendor API, then construct `resolveCmeContract({root, contractId, expiry})`. Root aliases ES/NQ/MES/MNQ alone cannot start a live subscription. Validating the string format is not proof of a listed or active contract; vendor resolution is required. Roll subscriptions by constructing a new provider, so books and trades from different expiries cannot mix.

Root metadata: CME/USD, 0.25 index-point tick, two decimal places, multipliers ES=50, NQ=20, MES=5, MNQ=2 USD per index point. See [CME E-mini FAQ](https://www.cmegroup.com/trading/equity-index/eminifaq.html), [CME Nasdaq specifications](https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.contractSpecs.html), and [CME Micro overview](https://www.cmegroup.com/education/courses/micro-e-mini-futures/micro-e-mini-futures-products-overview).

## Authenticated transport

`NormalizedWebSocketTransport` accepts a same-origin WSS bridge URL on HTTPS, without credentials, query parameters or fragment. An authenticated gateway must authorize the existing account and its market-data permissions during upgrade, using a server-issued session established through authenticated HTTPS. Vendor secrets belong only in that server connector. The browser implementation does not implement that missing gateway or authorize itself.

The current Vercel deployment does not expose this WebSocket service. A WebSocket-capable backend/gateway and origin routing are required before injecting a real provider factory. Endpoint configuration alone is insufficient. No credentials or native SDK are bundled.

`open({onOpen,onEvent,onClose,onError})`, `subscribe(request)`, `requestSnapshot(request)` and `close()` form the transport interface. WebSocket frames contain one event or a batch of at most 1,024 events. Frames above 1,000,000 characters are rejected. A socket open is only transport availability; a valid session plus a fresh two-sided book is required for connected readiness. Delayed/historical provenance cannot claim realtime status. Heartbeats must arrive within the configured silence deadline, even during quiet markets.

## Event envelope

Every market event includes:

```ts
{ version: 1, type: string, symbol: 'ES', contractId: string,
  epoch: string, timestampNs: string }
```

Exchange timestamps are decimal-string UNIX nanoseconds. Receive time is assigned locally at ingress in milliseconds. Nanoseconds survive normalization and replay; conversion to milliseconds supports the existing chart components. Decimal-string sequences retain values larger than Number.MAX_SAFE_INTEGER. Validation rejects wrong contracts/roots/epochs, unsafe numbers, off-tick prices, negative/non-integer quantities and future exchange timestamps beyond the configured tolerance. Quantity validation has a 1-billion-unit ceiling; broker-specific limits should be tighter server-side.

- **session:** `tradeSequence` is the last trade-stream sequence before subsequent delivery; `marketDataMode` is realtime/delayed/historical. A new transport connection gets a fresh epoch. Session acknowledgment must precede all trade/depth events. Repeated or obsolete epochs cannot reset a live stream silently.
- **trade:** `sequence`, stable `tradeId`, `price`, integer `size`, `side` buy/sell/unknown. Trade IDs must be unique across reconnects for the contract/session being replayed. The bridge must not guess aggressor side. Corrections and busts are not supported by v1; reject them and restart/rebuild from authoritative corrected history before further analytics.
- **book-snapshot:** `sequence` is a snapshot watermark; `levels` contains `{side:'bid'|'ask',price,size,orders?}`. Two-sided initial snapshots are required. Snapshots atomically replace the canonical book and remove buffered updates at/below their watermark, then drain contiguous later events. A recovery snapshot cannot be older than the highest lost depth sequence.
- **depth-update:** `sequence`, `changes` with the same level shape. Sizes are **absolute replacements**, never arithmetic deltas; zero removes a level. Each event is an atomic vendor batch. Duplicate price/side keys and crossed/locked batches are rejected. Unavailable order counts stay unset.
- **heartbeat:** envelope only. A heartbeat advances liveness, not book or trade sequences. Sequence numbers are contiguous **per contract and stream**. If a native feed uses channel-wide sequences including other instruments/messages, the server adapter must remap them to this contract/stream protocol while independently detecting native channel gaps. Do not pretend filtered native sequences are contiguous.
- **reconnect notices:** local normalized lifecycle events include attempt, reason, receive time and previous epoch. They are emitted from transport loss, not accepted as market ticks. Epoch/generation guards reject callbacks from obsolete connections.

## Recovery and bounded storage

Trade/depth reorder buffers are independent, bounded to 128 pending events and a 2 MiB serialized budget per stream. After 250 ms unresolved gaps or capacity overflow, processing stops. A depth gap quarantines the current DOM and requests an authoritative snapshot. A trade gap disconnects and reconnects with `sinceTimestampNs`; missing history remains explicitly incomplete until a new workspace/provider is constructed. Recovered current depth does not erase missing retained history.

Sequence deadlines are checked after the bounded ingress backlog drains, so a missing update already queued behind a delayed render does not cause a false gap. A genuine gap still fails once the queue drains; sustained overload fails through the count/byte budgets instead of growing indefinitely. A resumed subscription also marks retained history incomplete unless continuity was verified; a new session baseline alone does not prove replay coverage.

Ingress defaults to 4,096 events / 4 MiB serialized budget. Overflow disconnects and marks a gap rather than silently dropping ticks. The pipeline processes at most 1,024 queued events per 100 ms publish cycle. Trades and dedup IDs are bounded to 12,000. Book history is bounded to 600 snapshots and 120,000 total retained levels. Current book capacity is 4,000 levels. These are bounded browser budgets, not measured throughput guarantees; the server connector should apply its own rate/backpressure controls. Subscribe/request failures and silence trigger bounded exponential reconnect delays (500 ms to 30 s, five consecutive attempts). Manual disconnect cancels reconnect timers and pending opens.

Book state commits atomically. Historical heatmap snapshots stop at gap boundaries; realtime DOM cannot use an invalidated book. Replay excludes later snapshots even within the same millisecond. Unknown-side trades still contribute to OHLC, total volume, profile/POC and VWAP. Only known sides contribute to signed delta. Partial classification or retained gaps suppress signals and imbalance/auction interpretations and show partial delta.

Book invalidation includes a nanosecond boundary where available. Replay DOM is empty during that invalid interval and resumes only with a valid recovery snapshot; future boundaries are hidden until the cursor reaches them. Canonical depth timestamps cannot regress within one established epoch: such a batch is rejected atomically and requires recovery, rather than retroactively replacing prior replay state. Trade timestamps may arrive out of order and remain sorted independently. Development transports with simulated provenance still honor the canonical book's invalid state.

## Server connector implementation boundary

The next vendor implementation must perform credential handling, account/exchange entitlement checks, exact contract lookup, vendor/channel sequence recovery, authoritative snapshot/replay requests, correction/bust processing and a heartbeat/session protocol. Native Rithmic/CQG/CME protocols are deliberately not guessed. Packet-level channel decoding, persistence, restart recovery, load certification and exchange calendars are outside this browser foundation.

`DevelopmentFeedHarness` is an explicitly offline, test-only transport. Run `npm run orderflow:feed-harness` for reorder/gap/snapshot recovery with synthetic fixtures. It reports zero network connections and cannot claim a real feed. Unit fault scenarios cover sequencing, stale epochs/snapshots, reconnect cancellation, bounds, unknown sides and security checks.

Run `npm run orderflow:stress` for reproducible accelerated fixtures: normal heavy batches, near the 1,024-event pump limit, a three-hour virtual session, 4,000-level books, 120,000-level history and ingress overflow. It validates sequence/volume/delta/VWAP conservation and replay prefixes, and writes CPU timing and post-GC heap measurements to `artifacts/order-flow-stress/measurement.json`. These are local Node measurements and accelerated virtual time, not a three-hour wall-clock browser soak or native CME load certification. The development-only browser fixture exercises the actual chart and DOM at maximum retained depth and across a replay gap; it is excluded from the production build.
