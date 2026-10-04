import { isEligibleAlertQuote, normalizeMarketQuote } from './marketDataContract.js';

export function shouldTriggerPriceAlert(alert, quote, enabled = true, now = Date.now()) {
  if (!enabled || !alert?.active || quote?.isHalted || !isEligibleAlertQuote(quote, alert.symbol, now)) return false;
  const trigger = Number(alert.trigger);
  if (!Number.isFinite(trigger) || trigger <= 0 || !['above', 'below'].includes(alert.direction)) return false;
  const { price } = normalizeMarketQuote(quote, { symbol: alert.symbol, now });
  return alert.direction === 'below' ? price <= trigger : price >= trigger;
}
export { isEligibleAlertQuote, normalizeMarketQuote };
export function normalizePriceAlert(raw) {
  const symbol = String(raw?.symbol || '').trim().toUpperCase(), trigger = Number(raw?.trigger);
  if (!/^[\w-]{1,100}$/.test(raw?.id || '') || !/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(symbol)
    || !Number.isFinite(trigger) || trigger <= 0 || !['above', 'below'].includes(raw.direction)
    || typeof raw.active !== 'boolean') throw new Error('Invalid price alert rule.');
  return { id: raw.id, symbol, trigger, direction: raw.direction, active: raw.active };
}
