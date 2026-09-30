// Root specifications are separate from provider-resolved contract identities.
export const CME_ROOTS = Object.freeze(Object.fromEntries([
  ['ES', 50], ['NQ', 20], ['MES', 5], ['MNQ', 2],
].map(([root, multiplier]) => [root, Object.freeze({ root, exchange: 'CME', currency: 'USD', tickSize: 0.25,
  pricePrecision: 2, contractMultiplier: multiplier, quantityUnit: 'contracts', timezone: 'America/Chicago', contractId: null, expiry: null })])));
export function resolveCmeContract({ root, contractId, expiry }) {
  if (!CME_ROOTS[root]) throw new Error('Unsupported CME root.');
  if (typeof contractId !== 'string' || !/^[A-Za-z0-9._:/-]{1,100}$/.test(contractId) || contractId === root) throw new Error('Exact provider contract identity required; root aliases are not live contracts.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry || '') || !Number.isFinite(Date.parse(expiry)) || new Date(expiry).toISOString().slice(0, 10) !== expiry) throw new Error('Valid contract expiry required.');
  return Object.freeze({ ...CME_ROOTS[root], contractId, expiry });
}
export function tickIndex(price, metadata) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error('Invalid price.');
  const index = Math.round(price / metadata.tickSize);
  if (!Number.isSafeInteger(index) || Math.abs(price - index * metadata.tickSize) > metadata.tickSize * 1e-7) throw new Error('Off-tick price rejected.');
  return index;
}
