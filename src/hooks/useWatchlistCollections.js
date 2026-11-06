import { normalizeWatchlists, changeWatchlistMember } from "../utils/watchlistCollections.js";

export function useWatchlistCollections({ preferences, setPreferences, liveStocks = [], addGlobal, removeGlobal }) {
  const lists = normalizeWatchlists(preferences.watchlists, liveStocks);
  const active = lists.find(list=>list.id===preferences.activeWatchlistId) || lists[0];
  const update = transform => setPreferences?.(current => {
    const currentLists = normalizeWatchlists(current.watchlists, liveStocks);
    const currentId = currentLists.find(list => list.id === current.activeWatchlistId)?.id || currentLists[0].id;
    return { ...current, activeWatchlistId: currentId, ...transform(currentLists, currentId) };
  });
  const transfer = (symbol, destinationId, sourceId = null) => {
    if (!lists.some(list => list.id === destinationId) || destinationId === sourceId) return;
    if (!liveStocks.some(row => row.symbol === symbol)) addGlobal?.(symbol);
    update(rows => {
      if (!rows.some(list => list.id === destinationId)) return {};
      const added = changeWatchlistMember(rows, destinationId, symbol, true);
      return { watchlists: sourceId ? changeWatchlistMember(added, sourceId, symbol, false) : added };
    });
  };
  const add = symbol => transfer(symbol, active.id);
  const remove = symbol => {
    if (!lists.some(list=>list.id!==active.id && list.symbols.includes(symbol))) removeGlobal?.(symbol);
    update((rows,id)=>({watchlists:changeWatchlistMember(rows,id,symbol,false)}));
  };
  return { lists, active, add, remove, transfer,
    reorder: offset => update((rows, id) => {
      const from = rows.findIndex(row => row.id === id);
      const to = from + offset;
      if (to < 0 || to >= rows.length) return {};
      const watchlists = [...rows];
      watchlists.splice(to, 0, ...watchlists.splice(from, 1));
      return { watchlists };
    }),
    rows: active.symbols.map(symbol=>liveStocks.find(row=>row.symbol===symbol) || {symbol,price:null,dataMode:"unavailable"}),
    select: id => update(rows=>({watchlists:rows,activeWatchlistId:id})),
    create: name => { const clean=String(name||"").trim().slice(0,80); if(!clean)return false;
      const id=crypto.randomUUID(); update(rows=>({watchlists:[...rows,{id,name:clean,symbols:[]}],activeWatchlistId:id})); return true; },
    rename: name => { const clean=String(name||"").trim().slice(0,80); if(clean)update((rows,id)=>({watchlists:rows.map(row=>row.id===id?{...row,name:clean}:row)})); },
    removeList: () => { if(lists.length>1 && active.id !== "main")update((rows,id)=>({watchlists:rows.filter(row=>row.id!==id),activeWatchlistId:rows.find(row=>row.id!==id).id})); },
  };
}
