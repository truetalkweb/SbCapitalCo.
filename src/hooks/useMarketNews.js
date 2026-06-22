import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "../utils/marketUtils";
import {
  cleanConfidenceLabel,
  createNormalizedNewsFallback,
  mergeNewsRows,
  normalizeNewsRow,
} from "../utils/scannerNewsAdapters";

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

function buildNewsMeta(meta, normalizedRows) {
  const fallbackRows = normalizedRows.filter((item) => item.fallback).length;
  const providerWarnings = Array.isArray(meta.providerWarnings) ? meta.providerWarnings : [];
  const userWarnings = Array.isArray(meta.userWarnings) ? meta.userWarnings : [];

  return {
    source: meta.source || "Backend News",
    degraded: Boolean(meta.degraded) || (normalizedRows.length > 0 && fallbackRows === normalizedRows.length),
    cached: Boolean(meta.cached),
    updatedAt: meta.updatedAt || new Date().toISOString(),
    warning: meta.warning || providerWarnings[0] || null,
    providerWarnings,
    userWarnings,
    userMessage: meta.userMessage || userWarnings[0] || null,
    statusLabel: meta.statusLabel || null,
    providerStatus: meta.providerStatus || null,
    backendTime: meta.backendTime || null,
    confidenceLabel: cleanConfidenceLabel(meta),
    fallbackRows,
    rowCount: normalizedRows.length,
  };
}

export function getNewsStatusLabel(newsMeta = {}) {
  if (newsMeta.statusLabel) return newsMeta.statusLabel;
  if (newsMeta.providerStatus?.label) {
    const label = String(newsMeta.providerStatus.label).toUpperCase();
    return label === "LIVE" ? "NEWS LIVE" : `NEWS ${label}`;
  }

  if (newsMeta.degraded) return "NEWS FALLBACK";
  if ((newsMeta.providerWarnings || []).length || newsMeta.warning) return "NEWS PROVIDER LIMITED";
  if (newsMeta.cached) return "NEWS CACHED";
  if (newsMeta.source) return "NEWS LIVE";

  return "NEWS PENDING";
}

export function useMarketNews({ selectedStock, brokerApiUrl, scannerRows = [], limit = 14 }) {
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMeta, setNewsMeta] = useState(DEFAULT_NEWS_META);

  const fetchNews = useCallback(
    async ({ cancelled = () => false } = {}) => {
      setNewsLoading(true);

      try {
        let rows = [];
        let meta = { ...DEFAULT_NEWS_META };
        const providerWarnings = [];
        const tickerNewsUrl = `${brokerApiUrl}/api/news/${encodeURIComponent(selectedStock)}?limit=${limit}`;
        const marketNewsUrl = `${brokerApiUrl}/api/news?limit=${limit}`;
        const fetchNewsPayload = async (url, label) => {
          try {
            const response = await fetchWithTimeout(url, 5000);

            if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);

            return { payload: await response.json(), error: null };
          } catch (error) {
            return { payload: null, error: error.message || `${label} unavailable` };
          }
        };
        const tickerNewsRequest = fetchNewsPayload(tickerNewsUrl, "Ticker news");
        const marketNewsRequest = fetchNewsPayload(marketNewsUrl, "Market news");

        const symbolResult = await tickerNewsRequest;

        if (symbolResult.payload) {
          const symbolPayload = symbolResult.payload;
          rows = Array.isArray(symbolPayload.news) ? symbolPayload.news : [];
          meta = symbolPayload;
        } else if (symbolResult.error) {
          providerWarnings.push(symbolResult.error);
        }

        if (rows.length < 6) {
          const marketResult = await marketNewsRequest;

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

        if (!cancelled()) {
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
        if (!cancelled()) {
          const fallbackRows = createNormalizedNewsFallback(selectedStock, scannerRows);

          setNews(fallbackRows);
          setNewsMeta({
            ...DEFAULT_NEWS_META,
            source: "Fallback",
            degraded: true,
            updatedAt: new Date().toISOString(),
            warning: "Backend news feed unavailable.",
            fallbackRows: fallbackRows.length,
          });
        }
      }

      if (!cancelled()) {
        setNewsLoading(false);
      }
    },
    [brokerApiUrl, limit, scannerRows, selectedStock]
  );

  useEffect(() => {
    let isCancelled = false;
    let initialLoad = null;

    if (selectedStock && brokerApiUrl) {
      initialLoad = window.setTimeout(() => {
        fetchNews({ cancelled: () => isCancelled });
      }, 0);
    }

    return () => {
      isCancelled = true;
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
