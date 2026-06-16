import { useCallback, useEffect, useState } from "react";
import {
  createMarketNewsFallback,
  fetchWithTimeout,
  normalizePanelNewsItem,
} from "../utils/marketUtils";

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

function mergeNewsRows(primaryRows, marketRows) {
  const seen = new Set(primaryRows.map((item) => item.url || item.id || item.headline));

  return [
    ...primaryRows,
    ...marketRows.filter((item) => {
      const key = item.url || item.id || item.headline;

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

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
    fallbackRows,
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

export function useMarketNews({ selectedStock, brokerApiUrl, limit = 14 }) {
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

        try {
          const symbolResponse = await fetchWithTimeout(
            `${brokerApiUrl}/api/news/${encodeURIComponent(selectedStock)}?limit=${limit}`,
            8000
          );

          if (!symbolResponse.ok) throw new Error(`Ticker news HTTP ${symbolResponse.status}`);

          const symbolPayload = await symbolResponse.json();
          rows = Array.isArray(symbolPayload.news) ? symbolPayload.news : [];
          meta = symbolPayload;
        } catch (error) {
          providerWarnings.push(error.message || "Ticker news unavailable");
        }

        if (rows.length < 6) {
          try {
            const marketResponse = await fetchWithTimeout(`${brokerApiUrl}/api/news?limit=${limit}`, 8000);

            if (!marketResponse.ok) throw new Error(`Market news HTTP ${marketResponse.status}`);

            const marketPayload = await marketResponse.json();
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
          } catch (error) {
            providerWarnings.push(error.message || "Market news unavailable");
          }
        }

        const normalizedRows = rows
          .map((item, index) => normalizePanelNewsItem(item, index, selectedStock))
          .filter(Boolean)
          .sort((a, b) => Number(a.fallback) - Number(b.fallback))
          .slice(0, limit);

        if (!cancelled()) {
          const nextNews = normalizedRows.length ? normalizedRows : createMarketNewsFallback(selectedStock);

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
          const fallbackRows = createMarketNewsFallback(selectedStock);

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
    [brokerApiUrl, limit, selectedStock]
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
