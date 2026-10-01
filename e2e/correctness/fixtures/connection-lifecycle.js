import { MarketDataService, marketDataService } from '../../../src/services/marketDataService.js';
marketDataService.disconnect();
const service = new MarketDataService({ enableSse: new URLSearchParams(location.search).has('sse') });
const status = document.createElement('output'); status.setAttribute('aria-label', 'Connection status');
const quotes = document.createElement('output'); quotes.setAttribute('aria-label', 'Received quotes');
document.getElementById('fixture').append(status, quotes);
const received = [];
service.onStatus(value => { status.textContent = value; });
const receive = value => { received.push(value); quotes.textContent = JSON.stringify(received); };
let unsubscribe = service.subscribe('AAPL', receive);
window.connectionFixture = {
  select(symbol) { unsubscribe(); unsubscribe = service.subscribe(symbol, receive); },
  disconnect() { service.disconnect(); },
  inspect() { return { polling: service.pollInFlight, timer: Boolean(service.pollTimer), stream: Boolean(service.eventSource), watchdog: Boolean(service.streamWatchdog) }; },
};
