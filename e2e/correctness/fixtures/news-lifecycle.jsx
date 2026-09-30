import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useMarketNews } from '../../../src/hooks/useMarketNews.js';
import { useScannerData } from '../../../src/hooks/useScannerData.js';
const scannerRows = [];
export function Fixture() {
  const [symbol, setSymbol] = useState('AAPL');
  const data = useMarketNews({ selectedStock: symbol, brokerApiUrl: 'http://127.0.0.1:4999', scannerRows });
  return <main><button onClick={() => data.refreshNews()}>Refresh news</button><button onClick={() => setSymbol('TSLA')}>Select TSLA</button>
    <output aria-label="News state">{JSON.stringify({ symbol, loading: data.newsLoading, news: data.news, meta: data.newsMeta, status: data.newsStatusLabel })}</output></main>;
}
export function ScannerFixture() {
  const data = useScannerData({ brokerApiUrl: 'http://127.0.0.1:4999', autoRefresh: false });
  return <main><button onClick={() => data.refreshScanner()}>Refresh scanner</button>
    <output aria-label="Scanner state">{JSON.stringify({ rows: data.fmpGainers, meta: data.scannerMeta, loading: data.scannerLoading })}</output></main>;
}
createRoot(document.getElementById('fixture')).render(new URLSearchParams(location.search).has('scanner') ? <ScannerFixture /> : <Fixture />);
