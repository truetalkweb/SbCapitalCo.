import { normalizeWatchlists, changeWatchlistMember } from "../utils/watchlistCollections.js";

export function useWatchlistCollections({ preferences, setPreferences, liveStocks = [], addGlobal, removeGlobal }) {
  const lists = normalizeWatchlists(preferences.watchlists, liveStocks);
  const active = lists.find(list=>list.id===preferences.activeWatchlistId) || lists[0];
  const update = transform => setPreferences?.(current => {
    const currentLists = normalizeWatchlists(current.watchlists, liveStocks);
    return { ...current, ...transform(currentLists, current.activeWatchlistId || currentLists[0].id) };
  });
  const add = symbol => {
    addGlobal?.(symbol);
    update((rows,id)=>({watchlists:changeWatchlistMember(rows,id,symbol,true)}));
  };
  const remove = symbol => {
    if (!lists.some(list=>list.id!==active.id && list.symbols.includes(symbol))) removeGlobal?.(symbol);
    update((rows,id)=>({watchlists:changeWatchlistMember(rows,id,symbol,false)}));
  };
  return { lists, active, add, remove,
    rows: active.symbols.map(symbol=>liveStocks.find(row=>row.symbol===symbol) || {symbol,price:null,dataMode:"unavailable"}),
    select: id => update(rows=>({watchlists:rows,activeWatchlistId:id})),
    create: name => { const clean=String(name||"").trim().slice(0,80); if(!clean)return false;
      const id=crypto.randomUUID(); update(rows=>({watchlists:[...rows,{id,name:clean,symbols:[]}],activeWatchlistId:id})); return true; },
    rename: name => { const clean=String(name||"").trim().slice(0,80); if(clean)update((rows,id)=>({watchlists:rows.map(row=>row.id===id?{...row,name:clean}:row)})); },
    removeList: () => { if(lists.length>1)update((rows,id)=>({watchlists:rows.filter(row=>row.id!==id),activeWatchlistId:rows.find(row=>row.id!==id).id})); },
  };
}
