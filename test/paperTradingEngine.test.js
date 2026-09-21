import test from 'node:test';
import assert from 'node:assert/strict';
import { submitPaperOrder, processPaperOrders, cancelPaperOrder, paperBalances, paperQuote } from '../src/services/paperTradingEngine.js';
import { normalizeQuoteEvent, mergeQuoteSnapshot } from '../src/utils/marketDataContract.js';
const now = Date.parse('2026-09-21T15:00:00Z');
const empty = () => ({ orders: [], positions: {}, realizedPnL: 0 });
const quote = (price = 100, extra = {}, time = now) => ({ symbol: 'AAPL', price, lastTradeTime: new Date(time).toISOString(), source: 'Test provider', ...extra });
const draft = extra => ({ id: 'order-1', symbol: 'AAPL', side: 'BUY', type: 'MARKET', quantity: 10, tif: 'DAY', ...extra });
const submit = (state = empty(), extra = {}, rows = [quote()], time = now, limits) => submitPaperOrder(state, draft(extra), rows, time, limits);

test('switching order type ignores prices left in inactive form fields', () => {
 const market = submit(empty(), { limitPrice: 1000000, stopPrice: 2000000 });
 assert.equal(market.order.status, 'FILLED'); assert.equal(market.order.referencePrice, 100);
 const stop = submit(empty(), { type: 'STOP', limitPrice: 1, stopPrice: 105, stopLoss: 95 });
 assert.equal(stop.order.status, 'WORKING'); assert.equal(stop.order.referencePrice, 105);
});
test('incomplete positions cannot corrupt paper cash or execution', () => {
 for (const position of [{ quantity: 10 }, { quantity: 10, average: 'bad' }]) {
  const state = { ...empty(), positions: { AAPL: position } };
  assert.ok(submit(state).error); assert.ok(submit(state, { side: 'SELL' }).error);
  assert.deepEqual(state.positions.AAPL, position);
 }
});

test('explicit short opens without owned shares and restricts proceeds and collateral', () => {
 const short=submit(empty(),{side:'SELL_SHORT'},[quote(100,{bidPrice:99.9,askPrice:100.1})]);
 assert.equal(short.order.status,'FILLED'); assert.equal(short.order.action,'SELL_SHORT');
 assert.equal(short.state.positions.AAPL.quantity,-10); assert.equal(short.state.positions.AAPL.average,99.9);
 const balances=paperBalances(short.state,[quote()],now);
 assert.equal(balances.cash,100999); assert.equal(balances.shortCollateral,1998);
 assert.equal(balances.buyingPower,99001); assert.equal(balances.equity,99999);
 assert.ok(submit(short.state,{id:'buy',side:'BUY'}).error);
 assert.ok(submit(short.state,{id:'sell',side:'SELL'}).error);
});

test('cover realizes profit on falling prices and loss on rising prices without reversing long', () => {
 const short=submit(empty(),{side:'SELL_SHORT'}).state;
 const cover=submit(short,{id:'cover',side:'BUY_TO_COVER',quantity:4},[quote(90,{askPrice:90.1})]);
 assert.equal(cover.state.positions.AAPL.quantity,-6); assert.equal(cover.state.realizedPnL,39.6);
 const closed=submit(cover.state,{id:'close',side:'BUY_TO_COVER',quantity:6},[quote(110)]);
 assert.deepEqual(closed.state.positions,{}); assert.equal(closed.state.realizedPnL,-20.4);
 assert.equal(paperBalances(closed.state,[],now).buyingPower,99979.6);
 assert.ok(submit(closed.state,{id:'overcover',side:'BUY_TO_COVER',quantity:1}).error);
});

test('short entries obey limit and stop directions, cover stop-limit latches upward', () => {
 const short=submit(empty(),{side:'SELL_SHORT',type:'LIMIT',limitPrice:105}); assert.equal(short.order.status,'WORKING');
 const filled=processPaperOrders(short.state,[quote(106)],now+1000); assert.equal(filled.positions.AAPL.average,106);
 const stop=submit(empty(),{side:'SELL_SHORT',type:'STOP',stopPrice:95}); assert.equal(stop.order.status,'WORKING');
 assert.equal(processPaperOrders(stop.state,[quote(94)],now+1000).positions.AAPL.quantity,-10);
 const cover=submit(filled,{id:'cover',side:'BUY_TO_COVER',type:'STOP_LIMIT',stopPrice:110,limitPrice:111});
 const triggered=processPaperOrders(cover.state,[quote(112)],now+1000); assert.equal(triggered.orders[0].status,'TRIGGERED');
 const closed=processPaperOrders(JSON.parse(JSON.stringify(triggered)),[quote(109)],now+2000); assert.equal(closed.orders[0].price,109); assert.deepEqual(closed.positions,{});
});

test('short protective exits cover in the correct direction and cancel their sibling', () => {
 for (const [price,exit,pnl] of [[110,'stop',-100],[90,'target',100]]) {
  const short=submit(empty(),{side:'SELL_SHORT',stopLoss:105,takeProfit:95}); assert.equal(short.state.orders.length,3);
  assert.equal(short.state.orders.find(o=>o.id.endsWith('-stop')).action,'BUY_TO_COVER');
  const result=processPaperOrders(short.state,[quote(price)],now+1000);
  assert.deepEqual(result.positions,{}); assert.equal(result.realizedPnL,pnl);
  assert.equal(result.orders.find(o=>o.id===`order-1-${exit}`).status,'FILLED');
  assert.equal(result.orders.filter(o=>o.status==='CANCELLED').length,1);
 }
 assert.ok(submit(empty(),{side:'SELL_SHORT',stopLoss:95}).error);
 assert.ok(submit(empty(),{side:'SELL_SHORT',takeProfit:105}).error);
});

test('cover reservations and partial covers cannot over-cover a short or strand its protection', () => {
 const short=submit(empty(),{side:'SELL_SHORT',stopLoss:105,takeProfit:95}).state;
 const partial=submit(short,{id:'partial',side:'BUY_TO_COVER',quantity:4});
 assert.equal(partial.state.orders.find(o=>o.parentId)?.quantity,6);
 const working=submit(partial.state,{id:'cover-limit',side:'BUY_TO_COVER',quantity:5,type:'LIMIT',limitPrice:80});
 assert.ok(submit(working.state,{id:'duplicate-cover',side:'BUY_TO_COVER',quantity:2}).error);
 const cancelled=cancelPaperOrder(working.state,'cover-limit',now);
 const closed=submit(cancelled.state,{id:'close',side:'BUY_TO_COVER',quantity:6});
 assert.deepEqual(closed.state.positions,{}); assert.equal(closed.state.orders.filter(o=>o.parentId&&o.status==='WORKING').length,0);
});

test('short exposure respects buying power, risk caps and opposite working entry restrictions', () => {
 assert.ok(submit(empty(),{side:'SELL_SHORT',quantity:1001}).error);
 assert.ok(submit(empty(),{side:'SELL_SHORT',quantity:20},[quote()],now,{maxOrderValue:1000}).error);
 assert.ok(submit(empty(),{side:'SELL_SHORT',stopLoss:110},[quote()],now,{riskPerTrade:50}).error);
 const long=submit(empty(),{type:'LIMIT',limitPrice:90}).state;
 assert.ok(submit(long,{id:'short',side:'SELL_SHORT'}).error);
 const short=submit(empty(),{side:'SELL_SHORT',type:'LIMIT',limitPrice:110}).state;
 assert.ok(submit(short,{id:'long',side:'BUY'}).error);
});

test('paper market fills without a broker, uses ask/bid, and closes exact shares with realized P&L', () => {
 const buy = submit(empty(), {}, [quote(100, { bidPrice:99.9, askPrice:100.1 })]);
 assert.equal(buy.order.price,100.1); assert.equal(buy.order.status,'FILLED');
 assert.deepEqual(buy.state.positions.AAPL,{quantity:10,average:100.1,source:'Paper simulation',currency:'USD'});
 const sell=submit(buy.state,{id:'sell',side:'SELL',quantity:4},[quote(102,{bidPrice:101.9,askPrice:102.1})]);
 assert.equal(sell.state.positions.AAPL.quantity,6);assert.equal(sell.state.realizedPnL,7.2);
 assert.equal(paperBalances(sell.state,[quote()],now).cash,99406.6);
});
test('limit stays working until executable quote crosses, fills at improved market price',()=>{
 const initial=submit(empty(),{type:'LIMIT',limitPrice:95});assert.equal(initial.order.status,'WORKING');assert.deepEqual(initial.state.positions,{});
 const next=processPaperOrders(initial.state,[quote(94)],now+1000);assert.equal(next.orders[0].price,94);assert.equal(next.positions.AAPL.quantity,10);
 assert.equal(processPaperOrders(next,[quote(93)],now+2000),next);
});
test('sell limits wait for their minimum and stop markets can gap past stop',()=>{
 const state=submit().state;
 const sell=submit(state,{id:'sell',side:'SELL',type:'LIMIT',limitPrice:105});assert.equal(sell.order.status,'WORKING');
 const filled=processPaperOrders(sell.state,[quote(106)],now+1000);assert.equal(filled.orders.find(o=>o.id==='sell').price,106);
 const stop=submit(state,{id:'stop',side:'SELL',type:'STOP',stopPrice:98});assert.equal(stop.order.status,'WORKING');
 const gapped=processPaperOrders(stop.state,[quote(95,{bidPrice:94.8,askPrice:95.2})],now+1000);assert.equal(gapped.orders.find(o=>o.id==='stop').price,94.8);assert.equal(gapped.realizedPnL,-52);
});
test('stop-limit persists its trigger and respects limit after price recovers',()=>{
 const stop=submit(submit().state,{id:'stop',side:'SELL',type:'STOP_LIMIT',stopPrice:98,limitPrice:97});
 const triggered=processPaperOrders(stop.state,[quote(95)],now+1000);assert.equal(triggered.orders.find(o=>o.id==='stop').status,'TRIGGERED');assert.equal(triggered.positions.AAPL.quantity,10);
 const filled=processPaperOrders(JSON.parse(JSON.stringify(triggered)),[quote(99)],now+2000);assert.equal(filled.orders.find(o=>o.id==='stop').status,'FILLED');
});
test('buy stops trigger above and stop limits cap the purchase price',()=>{
 const stop=submit(empty(),{type:'STOP',stopPrice:105});assert.equal(stop.order.status,'WORKING');assert.equal(processPaperOrders(stop.state,[quote(108)],now+1000).orders[0].price,108);
 const stopLimit=submit(empty(),{type:'STOP_LIMIT',stopPrice:105,limitPrice:106});const triggered=processPaperOrders(stopLimit.state,[quote(108)],now+1000);assert.equal(triggered.orders[0].status,'TRIGGERED');assert.deepEqual(triggered.positions,{});
});
test('bracket exits arm only on entry fill and one cancels the other',()=>{
 const pending=submit(empty(),{type:'LIMIT',limitPrice:95,stopLoss:90,takeProfit:105});assert.equal(pending.state.orders.length,1);
 const filled=processPaperOrders(pending.state,[quote(94)],now+1000);assert.equal(filled.orders.length,3);assert.equal(filled.orders.filter(o=>o.parentId).length,2);
 const exit=processPaperOrders(filled,[quote(106)],now+2000);assert.deepEqual(exit.positions,{});assert.equal(exit.orders.find(o=>o.id==='order-1-target').status,'FILLED');assert.equal(exit.orders.find(o=>o.id==='order-1-stop').status,'CANCELLED');assert.equal(exit.realizedPnL,120);
});
test('manual sell resizes protective orders and never reverses a closed position',()=>{
 const buy=submit(empty(),{stopLoss:95,takeProfit:110});const sell=submit(buy.state,{id:'sell',side:'SELL',quantity:6});
 assert.equal(sell.state.orders.find(o=>o.id==='order-1-stop').quantity,4);
 const exit=processPaperOrders(sell.state,[quote(94)],now+1000);assert.deepEqual(exit.positions,{});assert.equal(exit.orders.find(o=>o.id==='order-1-stop').filled,4);
});
test('duplicate submission and repeated quote processing cannot double fill',()=>{
 const first=submit();const duplicate=submit(first.state);assert.equal(duplicate.state,first.state);assert.equal(duplicate.duplicate,true);
 assert.equal(processPaperOrders(first.state,[quote()],now+1000),first.state);
});
test('working order can be cancelled and releases reserved buying power',()=>{
 const result=submit(empty(),{type:'LIMIT',limitPrice:90});assert.equal(paperBalances(result.state,[],now).buyingPower,99100);
 const cancelled=cancelPaperOrder(result.state,result.order.id,now+1000);assert.equal(cancelled.state.orders[0].status,'CANCELLED');assert.equal(paperBalances(cancelled.state,[],now).buyingPower,100000);
 assert.deepEqual(processPaperOrders(cancelled.state,[quote(89)],now+2000).positions,{});assert.ok(cancelPaperOrder(cancelled.state,result.order.id).error);
});
test('invalid fields and overselling return errors without mutating the account',()=>{
 for(const change of [{quantity:0},{quantity:1.5},{quantity:Infinity},{quantity:-1},{type:'NOPE'},{type:'LIMIT'},{type:'STOP'},{type:'STOP_LIMIT',stopPrice:95},{stopLoss:-1},{stopLoss:101},{takeProfit:99},{tif:'INVALID'},{side:'SELL'}]) {
  const state=empty();const result=submit(state,change);assert.ok(result.error,JSON.stringify(change));assert.equal(result.state,state);
 }
 const held=submit().state;assert.ok(submit(held,{id:'sell',side:'SELL',quantity:11}).error);
});
test('limits reserve cash and sell orders cannot reserve the same shares twice',()=>{
 const held=submit().state;const sell=submit(held,{id:'sell',side:'SELL',type:'LIMIT',limitPrice:120,quantity:8});assert.ok(submit(sell.state,{id:'sell2',side:'SELL',quantity:3}).error);
 const first=submit(empty(),{quantity:1000,type:'LIMIT',limitPrice:90});assert.ok(submit(first.state,{id:'other',quantity:200,type:'LIMIT',limitPrice:90}).error);
});
test('missing stale future crossed and synthetic quotes do not cause fills',()=>{
 for(const raw of [undefined,quote(100,{isHalted:true}),quote(100,{isSynthetic:true}),quote(100,{quality:'cached',cached:true}),quote(100,{},now-120000),quote(100,{},now+60000),quote(100,{bidPrice:102,askPrice:101})]) {
  assert.equal(paperQuote(raw,now),null);const result=submit(empty(),{},raw?[raw]:[]);assert.equal(result.order.status,'WORKING');assert.deepEqual(result.state.positions,{});
 }
 const waiting=submit(empty(),{},[]);assert.equal(processPaperOrders(waiting.state,[quote()],now+1000).orders[0].status,'FILLED');
});
test('delayed paper fills retain provider quality and never claim live',()=>{
 const result=submit(empty(),{},[quote(100,{delayed:true},now-15*60000)]);assert.equal(result.order.status,'FILLED');assert.equal(result.order.quoteQuality,'delayed');
});

test('a provider halt survives the complete quote adapter chain and prevents paper fills', () => {
 const raw=quote(100,{isHalted:true});
 const event=normalizeQuoteEvent(raw,{},now);
 const snapshot=mergeQuoteSnapshot(null,event,now);
 assert.equal(paperQuote(snapshot,now),null);
 assert.equal(submit(empty(),{},[snapshot]).order.status,'WORKING');
});
test('outside-session orders queue, DAY expires, GTC survives, holidays are closed',()=>{
 const closed=Date.parse('2026-09-20T15:00:00Z');const waiting=submit(empty(),{},[quote(100,{},closed)],closed);assert.equal(waiting.order.status,'WORKING');assert.match(waiting.order.reason,/session/);
 assert.equal(waiting.order.expiresAt,'2026-09-21T20:00:00.000Z');
 const opened=processPaperOrders(waiting.state,[quote()],now);assert.equal(opened.orders[0].status,'FILLED');
 const limit=submit(empty(),{type:'LIMIT',limitPrice:90});const expired=processPaperOrders(limit.state,[quote(80)],Date.parse('2026-09-21T20:00:00Z'));assert.equal(expired.orders[0].status,'EXPIRED');
 const gtc=submit(empty(),{type:'LIMIT',limitPrice:90,tif:'GTC'});assert.equal(processPaperOrders(gtc.state,[],now+86400000).orders[0].status,'WORKING');
 const holiday=Date.parse('2026-12-25T15:00:00Z');assert.equal(submit(empty(),{},[quote(100,{},holiday)],holiday).order.status,'WORKING');
});
test('risk limits block new exposure but do not prevent closing holdings',()=>{
 assert.match(submit(empty(),{quantity:20},[quote()],now,{maxOrderValue:1000}).error,/maximum/);
 assert.match(submit(empty(),{quantity:10,stopLoss:90},[quote()],now,{riskPerTrade:50}).error,/risk/);
 const state=submit().state;state.orders.push({filledAt:new Date(now).toISOString(),realizedPnL:-600});
 assert.match(submit(state,{id:'buy2'},[quote()],now,{dailyLossLimit:500}).error,/loss limit/);
 assert.equal(submit(state,{id:'sell',side:'SELL'},[quote()],now,{dailyLossLimit:500}).order.status,'FILLED');
});
