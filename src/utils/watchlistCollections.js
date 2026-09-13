const cleanSymbol = value => String(value || "").trim().toUpperCase();
export function normalizeWatchlists(value, legacyRows = []) {
  const raw = Array.isArray(value) && value.length ? value : [{id:"main",name:"Main Watchlist",symbols:legacyRows.map(row=>row.symbol)}];
  const ids = new Set();
  const rows = raw.filter(row => row && typeof row.id === "string" && !ids.has(row.id) && ids.add(row.id)).map(row => ({
    id: row.id, name: String(row.name || "Watchlist").trim().slice(0,80),
    symbols: [...new Set((Array.isArray(row.symbols) ? row.symbols : []).map(cleanSymbol).filter(symbol=>/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(symbol)))],
  }));
  return rows.length ? rows : [{id:"main",name:"Main Watchlist",symbols:[]}];
}

export function changeWatchlistMember(lists, id, symbol, add) {
  const key = cleanSymbol(symbol);
  if (!/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(key)) return lists;
  return lists.map(list => list.id !== id ? list : { ...list, symbols: add ? [...new Set([...list.symbols,key])] : list.symbols.filter(item=>item!==key) });
}
