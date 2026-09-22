// Test-only mirror of backend/lib/paperService.cjs; refresh with scripts/sync-paper-core.mjs.
const enginePromise = import('../../src/services/paperTradingEngine.js');
const commandsPromise = import('../../src/services/paperOrderCommands.js');
const failure = (message, status = 503) => Object.assign(new Error(message), { status });

function validateLegacyLedger(raw) {
  if (!raw || !Array.isArray(raw.orders) || !raw.positions || typeof raw.positions !== 'object'
    || Array.isArray(raw.positions) || !Number.isFinite(raw.realizedPnL)) throw failure('Saved paper account requires repair before migration.', 409);
  const ids = new Set();
  for (const order of raw.orders) {
    if (!order || !order.id || ids.has(order.id)) throw failure('Saved paper order IDs require repair before migration.', 409);
    ids.add(order.id);
    if (order.engine === 'paper-v1' && (!/^[A-Z][A-Z0-9.-]{0,13}$/.test(order.symbol)
      || !Number.isSafeInteger(order.quantity) || order.quantity <= 0)) throw failure('Saved paper order requires repair before migration.', 409);
    if (order.engine === 'paper-v1' && ['WORKING', 'PENDING', 'TRIGGERED'].includes(order.status)) {
      const action = order.action || order.side;
      if (!['BUY', 'SELL', 'SELL_SHORT', 'BUY_TO_COVER'].includes(action)
        || order.side !== (['BUY', 'BUY_TO_COVER'].includes(action) ? 'BUY' : 'SELL')
        || !['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'].includes(order.type)
        || (['LIMIT', 'STOP_LIMIT'].includes(order.type) && !(Number.isFinite(order.limitPrice) && order.limitPrice > 0))
        || (['STOP', 'STOP_LIMIT'].includes(order.type) && !(Number.isFinite(order.stopPrice) && order.stopPrice > 0))
        || (order.expiresAt && !Number.isFinite(Date.parse(order.expiresAt)))) throw failure('Saved working paper order requires repair before migration.', 409);
    }
  }
  for (const [symbol, row] of Object.entries(raw.positions)) if (!/^[A-Z][A-Z0-9.-]{0,13}$/.test(symbol)
    || !Number.isSafeInteger(row.quantity) || !Number.isFinite(row.average) || row.average < 0) throw failure('Saved paper position requires repair before migration.', 409);
  return { orders: raw.orders, positions: raw.positions, realizedPnL: raw.realizedPnL, commands: {}, authority: 'server-v1' };
}

function createSupabasePaperRepository(db) {
  const check = result => { if (result.error) throw failure('Paper account storage is temporarily unavailable.'); return result.data; };
  return {
    async get(userId) { return check(await db.from('paper_accounts').select('*').eq('user_id', userId).maybeSingle()); },
    async legacy(userId) {
      const row = check(await db.from('terminal_workspaces').select('data').eq('user_id', userId).maybeSingle());
      const data = row?.data;
      if (!data) return { orders: [], positions: {}, realizedPnL: 0 };
      return data.paperLedger || { orders: data.orders || [], positions: data.positions || {}, realizedPnL: data.realizedPnL ?? 0 };
    },
    async insert(userId, ledger, active) {
      const result = await db.from('paper_accounts').insert({ user_id: userId, ledger, active_orders: active }).select('*').single();
      if (result.error?.code === '23505') return this.get(userId);
      return check(result);
    },
    async compareAndSwap(row, ledger, active) {
      return check(await db.from('paper_accounts').update({ ledger, revision: row.revision + 1, active_orders: active,
        updated_at: new Date().toISOString() }).eq('user_id', row.user_id).eq('revision', row.revision).select('*').maybeSingle());
    },
    async active(after = '') {
      return check(await db.from('paper_accounts').select('user_id').eq('active_orders', true).gt('user_id', after || '00000000-0000-0000-0000-000000000000').order('user_id').limit(100));
    },
  };
}

function createPaperService({ repository, getQuotes, clock = Date.now, logger = () => {} }) {
  let running = false, timer = null;
  const status = { lastScanAt: null, lastSuccessAt: null, error: null };
  async function account(userId) {
    const existing = await repository.get(userId);
    if (existing) return existing;
    const engine = await enginePromise;
    const ledger = validateLegacyLedger(await repository.legacy(userId));
    return repository.insert(userId, ledger, ledger.orders.some(engine.isWorkingPaperOrder));
  }
  async function quotesFor(state, symbol) {
    const { isWorkingPaperOrder } = await enginePromise;
    const symbols = [...new Set([symbol, ...Object.keys(state.positions), ...state.orders.filter(isWorkingPaperOrder).map(row => row.symbol)].filter(Boolean))];
    const quotes = [];
    for (let i = 0; i < symbols.length; i += 20) {
      try { quotes.push(...await getQuotes(symbols.slice(i, i + 20))); }
      catch { status.error = 'Provider quotes unavailable; affected orders wait for fresh data.'; }
    }
    return quotes;
  }
  async function transact(userId, command, limits = {}) {
    const engine = await enginePromise, { applyPaperCommand } = await commandsPromise;
    // Fetch once per attempt set; freshness is rechecked against current time
    // inside the engine. No synthetic catch-up fills after an outage.
    let row = await account(userId);
    const quotes = await quotesFor(row.ledger, command?.draft?.symbol || command?.symbol);
    for (let attempt = 0; attempt < 8; attempt++) {
      const now = clock(), original = row.ledger;
      if (command && Object.hasOwn(original.commands || {}, command.id)) {
        const receipt = original.commands[command.id];
        if (receipt.fingerprint !== JSON.stringify(command)) throw failure('Command ID was already used for a different request.', 409);
        return { ...snapshot(row), duplicate: true, order: original.orders.find(order => order.id === receipt.orderId) };
      }
      // Orders can fill before a cancellation reaches the server, just as an
      // acknowledged working order may execute while another device edits it.
      let state = engine.processPaperOrders(original, quotes, now);
      let result;
      if (command) {
        result = applyPaperCommand(state, command, quotes, now, limits);
        if (!result.error) state = { ...result.state, commands: { ...state.commands,
          [command.id]: { fingerprint: JSON.stringify(command), orderId: result.order?.id, at: new Date(now).toISOString() } } };
      }
      if (JSON.stringify(state) === JSON.stringify(original)) return { ...snapshot(row), error: result?.error, order: result?.order };
      const saved = await repository.compareAndSwap(row, state, state.orders.some(engine.isWorkingPaperOrder));
      if (saved) return { ...snapshot(saved), error: result?.error, order: result?.order };
      row = await repository.get(userId);
      if (!row) throw failure('Paper account no longer exists.', 409);
    }
    throw failure('Account changed on another device. Please retry.', 409);
  }
  function snapshot(row) {
    // Command fingerprints are internal receipts, not workspace backup data.
    const { commands: _commands, ...state } = row.ledger;
    return { state, revision: row.revision, updatedAt: row.updated_at, execution: 'server', worker: { ...status } };
  }
  async function tick() {
    if (running) return;
    running = true; status.lastScanAt = new Date(clock()).toISOString(); status.error = null;
    try {
      let cursor = '';
      while (true) {
        const rows = await repository.active(cursor);
        for (const row of rows) {
          try { await transact(row.user_id); }
          catch (error) { status.error = 'Some paper accounts could not be processed.'; logger(error); }
        }
        if (rows.length < 100) break;
        cursor = rows.at(-1).user_id;
      }
      if (!status.error) status.lastSuccessAt = new Date(clock()).toISOString();
    } catch (error) { status.error = 'Paper worker storage unavailable.'; logger(error); }
    finally { running = false; }
  }
  return { transact, tick, status, snapshot: async userId => snapshot(await account(userId)),
    start() { if (!timer) { void tick(); timer = setInterval(() => void tick(), 5000); timer.unref(); } },
    stop() { clearInterval(timer); timer = null; } };
}

function installPaperRoutes(app, { db, authenticate, getQuotes, logger }) {
  const service = db ? createPaperService({ repository: createSupabasePaperRepository(db), getQuotes, logger }) : null;
  app.get('/api/paper/account', authenticate, async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { if (!service) throw failure('Paper execution is unavailable.'); res.json(await service.snapshot(req.auth.user.id)); } catch (error) { next(error); }
  });
  app.post('/api/paper/commands', authenticate, async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!service) throw failure('Paper execution is unavailable.');
      const { command, limits = {} } = req.body || {};
      if (!command || typeof command.id !== 'string' || !/^[\w-]{1,100}$/.test(command.id)) throw failure('A valid command ID is required.', 400);
      if (!limits || typeof limits !== 'object' || ['maxOrderValue', 'riskPerTrade', 'dailyLossLimit'].some(key =>
        limits[key] != null && (!Number.isFinite(Number(limits[key])) || Number(limits[key]) < 0))) throw failure('Paper risk limits must be non-negative numbers.', 400);
      if (command.kind === 'submit' && (!command.draft || typeof command.draft !== 'object')) throw failure('An order draft is required.', 400);
      const result = await service.transact(req.auth.user.id, command, limits);
      res.status(result.error ? 422 : 200).json(result);
    } catch (error) { next(error); }
  });
  return service;
}
module.exports = { createPaperService, createSupabasePaperRepository, installPaperRoutes, validateLegacyLedger };
