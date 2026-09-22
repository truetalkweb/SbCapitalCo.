function memoryRepository(legacy = () => ({ orders: [], positions: {}, realizedPnL: 0 })) {
  const rows = new Map();
  return {
    rows,
    async get(id) { return structuredClone(rows.get(id) || null); },
    async legacy(id) { return structuredClone(legacy(id)); },
    async insert(id, ledger, active) {
      if (!rows.has(id)) rows.set(id, { user_id: id, ledger: structuredClone(ledger), revision: 0, active_orders: active });
      return this.get(id);
    },
    async compareAndSwap(row, ledger, active) {
      if (rows.get(row.user_id)?.revision !== row.revision) return null;
      rows.set(row.user_id, { ...row, ledger: structuredClone(ledger), revision: row.revision + 1, active_orders: active });
      return this.get(row.user_id);
    },
    async active(after = '') { return [...rows.values()].filter(row => row.active_orders && row.user_id > after).sort((a, b) => a.user_id.localeCompare(b.user_id)).slice(0, 100).map(row => ({ user_id: row.user_id })); },
  };
}
module.exports = { memoryRepository };
