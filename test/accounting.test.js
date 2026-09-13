import test from "node:test";
import assert from "node:assert/strict";
import { buildPositionRows, summarizePositions } from "../src/utils/portfolioAccounting.js";
import { journalStatistics, normalizeJournalRecord } from "../src/utils/journalAccounting.js";

test("missing marks remain unknown and do not invent a total loss", () => {
  const rows = buildPositionRows({ AAPL: { quantity: 10, average: 100 } }, []);
  assert.equal(rows[0].last, null);
  assert.equal(rows[0].unrealizedPnl, null);
  assert.equal(summarizePositions(rows).unrealizedPnl, null);
});
test("long and short positions reconcile signed value and gross exposure", () => {
  const rows = buildPositionRows({ A: { quantity: 10, average: 100 }, B: { quantity: -10, average: 100 } }, [{symbol:"A",price:110},{symbol:"B",price:90}]);
  assert.deepEqual(rows.map(row => row.unrealizedPnl), [100,100]);
  assert.equal(summarizePositions(rows).grossExposure, 2000);
  assert.equal(summarizePositions(rows).netExposure, 200);
  assert.equal(summarizePositions(rows).unrealizedPnl, 200);
  assert.equal(rows[1].dayPnl, null);
});
test("mixed currencies cannot silently sum and synthetic marks are rejected", () => {
  const rows = buildPositionRows({A:{quantity:1,currency:"CAD"},B:{quantity:1,currency:"USD"}},[{symbol:"A",price:100},{symbol:"B",price:100}]);
  assert.equal(summarizePositions(rows).grossExposure,null);
  assert.equal(buildPositionRows({A:{quantity:1}},[{symbol:"A",price:100,isSynthetic:true}])[0].last,null);
});
test("all 60 journal trades count while notes and open trades do not", () => {
  const rows = Array.from({length:60},(_,id)=>({id,pnl:100,createdAt:new Date(2026,0,id+1).toISOString()}));
  rows.push({review:"A note"},{recordType:"trade",status:"open",pnl:99});
  const stats = journalStatistics(rows);
  assert.equal(stats.total,60); assert.equal(stats.net,6000); assert.equal(stats.excluded,2);
  assert.equal(normalizeJournalRecord({review:"A note"}).pnl,null);
});
test("drawdown uses chronological cumulative returns, regardless of display order", () => {
  const rows = [100,-200,150].map((pnl,id)=>({id,pnl,createdAt:`2026-01-0${id+1}T12:00:00Z`}));
  const stats = journalStatistics(rows.reverse());
  assert.deepEqual(stats.curve,[0,100,-100,50]); assert.equal(stats.maxDrawdown,200);
  assert.equal(journalStatistics([{pnl:100}]).maxDrawdown,null);
});
test("completed manual trades calculate signed P&L after explicit fees", () => {
  assert.equal(normalizeJournalRecord({recordType:"trade",status:"closed",side:"Short",quantity:10,entryPrice:100,exitPrice:90,fees:2}).pnl,98);
  assert.equal(normalizeJournalRecord({recordType:"trade",status:"closed",quantity:10,entryPrice:100,exitPrice:90}).pnl,null);
  assert.equal(journalStatistics([{pnl:0}]).breakeven,1);
  assert.equal(journalStatistics([{pnl:100,currency:"CAD"}]).net,null);
});
