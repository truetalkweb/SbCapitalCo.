import { normalizeMarketQuote, isEligibleAlertQuote } from './marketDataContract.js';
export function evaluateAlertQuote(quote, symbol, now = Date.now(), previous = {}, providerFailed = false) {
  const normalized = normalizeMarketQuote(quote, { symbol, now });
  const eligible = !quote?.isHalted && isEligibleAlertQuote(quote, symbol, now);
  const reason = eligible ? 'Fresh live quote checked; waiting for the target.' : providerFailed ? 'Provider request failed; waiting for fresh live data.' : !quote ? 'Provider returned no quote for this symbol.' : quote.isHalted ? 'Trading halted; alert waits.' : `Quote ${normalized.quality}; fresh live provider data is required.`;
  return { checkedAt: new Date(now).toISOString(), state: eligible ? 'watching' : 'waiting', reason,
    source: normalized.source, quality: normalized.quality,
    quoteTimestamp: normalized.asOf === null ? null : new Date(normalized.asOf * 1000).toISOString(),
    lastValidQuoteAt: eligible ? new Date(normalized.asOf * 1000).toISOString() : previous?.lastValidQuoteAt || null,
    lastValidPrice: eligible ? normalized.price : previous?.lastValidPrice ?? null };
}
