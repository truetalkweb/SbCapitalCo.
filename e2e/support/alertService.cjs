// Test-only mirror of backend/lib/alertService.cjs.
const { randomUUID } = require('node:crypto');
const rulesPromise = import('../../src/utils/priceAlerts.js');
const diagnosticsPromise = import('../../src/utils/alertDiagnostics.js');
const failure = (message, status = 503) => Object.assign(new Error(message), { status });

function createSupabaseAlertRepository(db) {
  const check = result => { if (result.error) throw failure('Background alert storage unavailable.'); return result.data; };
  return {
    async get(id) { return check(await db.from('alert_accounts').select('*').eq('user_id', id).maybeSingle()); },
    async insert(id, ledger) {
      const result = await db.from('alert_accounts').insert({ user_id: id, ledger }).select('*').single();
      return result.error?.code === '23505' ? this.get(id) : check(result);
    },
    async save(row, ledger) {
      return check(await db.from('alert_accounts').update({ ledger, revision: row.revision + 1,
        monitoring: ledger.enabled && !ledger.paused && ledger.alerts.some(alert => alert.active), updated_at: new Date().toISOString() })
        .eq('user_id', row.user_id).eq('revision', row.revision).select('*').maybeSingle());
    },
    async active(after = '') {
      return check(await db.from('alert_accounts').select('*').eq('monitoring', true)
        .gt('user_id', after || '00000000-0000-0000-0000-000000000000').order('user_id').limit(100));
    },
  };
}

function createAlertService({ repository, getQuotes, clock = Date.now, logger = () => {} }) {
  let timer, running = false, cursor = '';
  const status = { lastScanAt: null, lastSuccessAt: null, error: null, intervalMs: 30000 };
  async function account(id) { return await repository.get(id) || await repository.insert(id, { enabled: false, alerts: [], receipts: {} }); }
  const snapshot = row => ({ alerts: row.ledger.alerts, enabled: row.ledger.enabled, paused: Boolean(row.ledger.paused), revision: row.revision,
    worker: { ...status }, monitoring: 'Server polling; fresh live quotes only; activity is retained for your next visit.' });
  async function transact(id, command) {
    const { normalizePriceAlert } = await rulesPromise;
    if (!command || !/^[\w-]{1,100}$/.test(command.id || '')) throw failure('A valid alert command ID is required.', 400);
    let row = await account(id);
    for (let attempt = 0; attempt < 8; attempt++) {
      const ledger = structuredClone(row.ledger), fingerprint = JSON.stringify(command), now = new Date(clock()).toISOString();
      if (ledger.receipts[command.id]) {
        if (ledger.receipts[command.id] !== fingerprint) throw failure('Alert command ID conflict.', 409);
        return snapshot(row);
      }
      if (command.kind === 'monitoring') {
        if (typeof command.enabled !== 'boolean') throw failure('Choose whether background monitoring is enabled.', 400);
        if (command.enabled && !ledger.enabled) {
          if (!Array.isArray(command.alerts) || command.alerts.length > 50) throw failure('Background monitoring supports up to 50 alerts per account.', 400);
          const seen = new Set();
          ledger.alerts = command.alerts.map(raw => {
            let rule; try { rule = normalizePriceAlert(raw); } catch (error) { throw failure(error.message, 400); }
            if (seen.has(rule.id)) throw failure('Duplicate alert ID.', 400); seen.add(rule.id);
            const old = ledger.alerts.find(alert => alert.id === rule.id);
            return { ...rule, createdAt: old?.createdAt || now, triggeredAt: null, diagnostics: null, history: old?.history || [] };
          });
        }
        ledger.enabled = command.enabled;
        if (command.paused !== undefined) {
          if (typeof command.paused !== 'boolean') throw failure('Invalid monitoring pause option.', 400);
          ledger.paused = command.paused;
        }
      } else if (command.kind === 'pause') {
        if (typeof command.paused !== 'boolean') throw failure('Invalid monitoring pause option.', 400);
        ledger.paused = command.paused;
      } else if (command.kind === 'remove') ledger.alerts = ledger.alerts.filter(alert => alert.id !== command.alertId);
      else if (command.kind === 'upsert') {
        let rule; try { rule = normalizePriceAlert(command.alert); } catch (error) { throw failure(error.message, 400); }
        const old = ledger.alerts.find(alert => alert.id === rule.id);
        if (!old && ledger.alerts.length >= 50) throw failure('Background monitoring supports up to 50 alerts per account.', 400);
        const next = { ...old, ...rule, createdAt: old?.createdAt || now, updatedAt: now, triggeredAt: rule.active ? null : old?.triggeredAt || null, diagnostics: null, history: old?.history || [] };
        ledger.alerts = [next, ...ledger.alerts.filter(alert => alert.id !== rule.id)];
      } else throw failure('Unsupported alert command.', 400);
      ledger.receipts[command.id] = fingerprint;
      // Alert edits are idempotent; bound the nonfinancial request journal.
      ledger.receipts = Object.fromEntries(Object.entries(ledger.receipts).slice(-200));
      const saved = await repository.save(row, ledger);
      if (saved) return snapshot(saved);
      row = await repository.get(id); if (!row) throw failure('Alert account no longer exists.', 409);
    }
    throw failure('Alerts changed on another device. Refresh and retry.', 409);
  }
  async function tick() {
    if (running) return; running = true; status.lastScanAt = new Date(clock()).toISOString(); status.error = null;
    try {
      const { shouldTriggerPriceAlert, isEligibleAlertQuote, normalizeMarketQuote } = await rulesPromise;
      const { evaluateAlertQuote } = await diagnosticsPromise;
      let rows = await repository.active(cursor);
      if (!rows.length && cursor) { cursor = ''; rows = await repository.active(); }
      // Bound each scan to 100 accounts / 200 unique symbols, rotating fairly.
      const symbols = new Set(), selected = [];
      for (const row of rows) {
        const next = row.ledger.alerts.filter(alert => alert.active).map(alert => alert.symbol);
        if (new Set([...symbols, ...next]).size > 200) break;
        next.forEach(symbol => symbols.add(symbol)); selected.push(row); cursor = row.user_id;
      }
      const list = [...symbols], quotes = new Map(), failedSymbols = new Set();
      for (let i = 0; i < list.length; i += 20) {
        try { for (const quote of await getQuotes(list.slice(i, i + 20))) quotes.set(quote.symbol, quote); }
        catch { list.slice(i, i + 20).forEach(symbol => failedSymbols.add(symbol)); status.error = 'Provider unavailable; alerts wait for fresh live data.'; }
      }
      for (const initial of selected) {
        let row = initial;
        for (let attempt = 0; attempt < 8; attempt++) {
          if (!row?.ledger.enabled || row.ledger.paused) break;
          const now = clock(), ledger = structuredClone(row.ledger); let changed = false;
          ledger.alerts = ledger.alerts.map(alert => {
            if (!alert.active) return alert;
            const quote = quotes.get(alert.symbol);
            const diagnostics = evaluateAlertQuote(quote, alert.symbol, now, alert.diagnostics, failedSymbols.has(alert.symbol));
            if (JSON.stringify(diagnostics) !== JSON.stringify(alert.diagnostics)) changed = true;
            if (!shouldTriggerPriceAlert(alert, quote, true, now)) {
              if (alert.active && (quote?.isHalted || !isEligibleAlertQuote(quote, alert.symbol, now))) status.error ||= 'Some symbols lack fresh live quotes; those alerts wait.';
              return { ...alert, diagnostics };
            }
            changed = true;
            const normalized = normalizeMarketQuote(quote, { symbol: alert.symbol, now });
            const price = normalized.price, time = new Date(now).toISOString();
            return { ...alert, diagnostics: { ...diagnostics, state: 'triggered', reason: 'Target reached on a fresh live quote.' }, active: false, triggeredAt: time, lastTriggerPrice: price,
              history: [{ id: randomUUID(), type: 'triggered', price, trigger: alert.trigger, direction: alert.direction,
                occurredAt: time, source: normalized.source, marketTimestamp: normalized.asOf, monitoring: 'server' }, ...alert.history].slice(0, 100) };
          });
          if (!changed) break;
          if (await repository.save(row, ledger)) break;
          row = await repository.get(row.user_id);
          if (attempt === 7) status.error = 'Some alerts changed repeatedly; those rules will be checked on the next scan.';
        }
      }
      if (!status.error) status.lastSuccessAt = new Date(clock()).toISOString();
    } catch (error) { status.error = 'Background alert scan unavailable.'; logger(error); }
    finally { running = false; }
  }
  return { status, transact, tick, snapshot: async id => snapshot(await account(id)),
    start() { if (!timer) { void tick(); timer = setInterval(() => void tick(), status.intervalMs); timer.unref(); } },
    stop() { clearInterval(timer); timer = null; } };
}
function installAlertRoutes(app, { db, authenticate, getQuotes, logger }) {
  const service = db ? createAlertService({ repository: createSupabaseAlertRepository(db), getQuotes, logger }) : null;
  app.get('/api/alerts/account', authenticate, async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { if (!service) throw failure('Background alerts unavailable.'); res.json(await service.snapshot(req.auth.user.id)); } catch (error) { next(error); }
  });
  app.post('/api/alerts/commands', authenticate, async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { if (!service) throw failure('Background alerts unavailable.'); res.json(await service.transact(req.auth.user.id, req.body?.command)); } catch (error) { next(error); }
  });
  return service;
}
module.exports = { createAlertService, createSupabaseAlertRepository, installAlertRoutes };
