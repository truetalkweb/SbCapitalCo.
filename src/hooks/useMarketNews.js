import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithTimeout } from "../utils/marketUtils.js";
import { buildNewsMeta, getNewsStatusLabel } from '../utils/newsMetadata.js';
export { getNewsStatusLabel } from '../utils/newsMetadata.js';
import {
  createNormalizedNewsFallback,
  mergeNewsRows,
  normalizeNewsRow,
  shouldFetchMarketNews,
} from "../utils/scannerNewsAdapters.js";

const DEFAULT_NEWS_META = {
  source: "Backend News",
  degraded: false,
  cached: false,
  updatedAt: null,
  warning: null,
  providerWarnings: [],
  userWarnings: [],
  userMessage: null,
  statusLabel: null,
  providerStatus: null,
  backendTime: null,
};

export function useMarketNews({ selectedStock, brokerApiUrl, scannerRows = [], limit = 14 }) {
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMeta, setNewsMeta] = useState(DEFAULT_NEWS_META);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), [selectedStock, brokerApiUrl]);

  const fetchNews = useCallback(
    async ({ cancelled = () => false, signal } = {}) => {
      request.current?.abort();
      const controller = new AbortController(); request.current = controller;
      const abort = () => controller.abort();
      if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
      const obsolete = () => controller.signal.aborted || request.current !== controller || cancelled();
      setNewsLoading(true);

      try {
        let rows = [];
        let meta = { ...DEFAULT_NEWS_META };
        const providerWarnings = [];
        const tickerNewsUrl = `${brokerApiUrl}/api/news/${encodeURIComponent(selectedStock)}?limit=${limit}`;
        const marketNewsUrl = `${brokerApiUrl}/api/news?limit=${limit}`;
        const fetchNewsPayload = async (url, label) => {
          try {
            const response = await fetchWithTimeout(url, 5000, { signal: controller.signal });

            if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);

            return { payload: await response.json(), error: null };
          } catch (error) {
            return { payload: null, error: error.message || `${label} unavailable` };
          }
        };
        const symbolResult = await fetchNewsPayload(tickerNewsUrl, "Ticker news");
        if (obsolete()) return;

        if (symbolResult.payload) {
          const symbolPayload = symbolResult.payload;
          rows = Array.isArray(symbolPayload.news) ? symbolPayload.news : [];
          meta = symbolPayload;
        } else if (symbolResult.error) {
          providerWarnings.push(symbolResult.error);
        }

        if (shouldFetchMarketNews(rows)) {
          const marketResult = await fetchNewsPayload(marketNewsUrl, "Market news");

          if (marketResult.payload) {
            const marketPayload = marketResult.payload;
            const marketRows = Array.isArray(marketPayload.news) ? marketPayload.news : [];

            rows = mergeNewsRows(rows, marketRows);
            meta = rows.length
              ? {
                  ...marketPayload,
                  source: `${meta.source || "Ticker News"} + Market`,
                  providerWarnings: [
                    ...(meta.providerWarnings || []),
                    ...(marketPayload.providerWarnings || []),
                    ...providerWarnings,
                  ],
                  userWarnings: [
                    ...(meta.userWarnings || []),
                    ...(marketPayload.userWarnings || []),
                  ],
                }
              : meta;
          } else if (marketResult.error) {
            providerWarnings.push(marketResult.error);
          }
        }

        const normalizedRows = rows
          .map((item, index) => normalizeNewsRow(item, index, selectedStock))
          .filter(Boolean)
          .sort((a, b) => Number(a.fallback) - Number(b.fallback))
          .slice(0, limit);

        if (!obsolete()) {
          const nextNews = normalizedRows.length
            ? normalizedRows
            : createNormalizedNewsFallback(selectedStock, scannerRows);

          setNews(nextNews);
          setNewsMeta(buildNewsMeta({
            ...meta,
            providerWarnings: [
              ...(meta.providerWarnings || []),
              ...providerWarnings,
            ],
            warning: meta.warning || providerWarnings[0] || null,
          }, nextNews));
        }
      } catch {
        if (!obsolete()) {
          const fallbackRows = createNormalizedNewsFallback(selectedStock, scannerRows);

          setNews(fallbackRows);
          setNewsMeta({
            ...DEFAULT_NEWS_META,
            source: "Fallback",
            degraded: true,
            updatedAt: null,
            warning: "Backend news feed unavailable.",
            fallbackRows: fallbackRows.length,
          });
        }
      } finally {
        signal?.removeEventListener('abort', abort);
        if (!obsolete()) setNewsLoading(false);
        if (request.current === controller) request.current = null;
      }
    },
    [brokerApiUrl, limit, scannerRows, selectedStock]
  );

  useEffect(() => {
    let isCancelled = false;
    let initialLoad = null;
    const controller = new AbortController();

    if (selectedStock && brokerApiUrl) {
      initialLoad = window.setTimeout(() => {
        fetchNews({ cancelled: () => isCancelled, signal: controller.signal });
      }, 0);
    }

    return () => {
      isCancelled = true;
      controller.abort();
      if (initialLoad) window.clearTimeout(initialLoad);
    };
  }, [brokerApiUrl, fetchNews, selectedStock]);

  return {
    news,
    newsLoading,
    newsMeta,
    newsStatusLabel: getNewsStatusLabel(newsMeta),
    refreshNews: fetchNews,
  };
}
