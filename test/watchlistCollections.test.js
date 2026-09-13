import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWatchlists, changeWatchlistMember } from "../src/utils/watchlistCollections.js";
test("legacy membership migrates and named lists remain independent",()=>{
  const migrated=normalizeWatchlists(null,[{symbol:"AAPL"}]);
  const lists=[...migrated,{id:"two",name:"Swing",symbols:["AAPL"]}];
  const result=changeWatchlistMember(lists,"main","AAPL",false);
  assert.deepEqual(result[0].symbols,[]); assert.deepEqual(result[1].symbols,["AAPL"]);
  assert.deepEqual(lists[0].symbols,["AAPL"]);
  assert.deepEqual(normalizeWatchlists(JSON.parse(JSON.stringify(result))),result);
});
test("empty named lists stay empty instead of repopulating with legacy symbols",()=>{
  assert.deepEqual(normalizeWatchlists([{id:"main",name:"Main",symbols:[]}],[{symbol:"AAPL"}])[0].symbols,[]);
});
