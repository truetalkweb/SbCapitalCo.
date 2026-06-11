import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;

    async function fetchNews() {
      setNewsLoading(true);

      try {
        const symbolResponse = await fetchWithTimeout(
          `${brokerApiUrl}/api/news/${encodeURIComponent(selectedStock)}?limit=${limit}`,
          8000
        );

        if (!symbolResponse.ok) throw new Error("Symbol news unavailable");

        const symbolPayload = await symbolResponse.json();
        let rows = Array.isArray(symbolPayload.news) ? symbolPayload.news : [];
        let meta = symbolPayload;

        if (rows.length < 6) {
          const marketResponse = await fetchWithTimeout(`${brokerApiUrl}/api/news?limit=${limit}`, 8000);

          if (marketResponse.ok) {
            const marketPayload = await marketResponse.json();
            const marketRows = Array.isArray(marketPayload.news) ? marketPayload.news : [];

            rows = mergeNewsRows(rows, marketRows);
            meta = rows.length
              ? {
                  ...marketPayload,
                  source: `${symbolPayload.source || "Ticker News"} + Market`,
                  providerWarnings: [
                    ...(symbolPayload.providerWarnings || []),
                    ...(marketPayload.providerWarnings || []),
                  ],
                }
              : meta;
          }
        }

        const normalizedRows = rows
          .map((item, index) => normalizePanelNewsItem(item, index, selectedStock))
          .filter(Boolean)
          .sort((a, b) => Number(a.fallback) - Number(b.fallback))
          .slice(0, limit);

        if (!cancelled) {
          const nextNews = normalizedRows.length ? normalizedRows : createMarketNewsFallback(selectedStock);

          setNews(nextNews);
          setNewsMeta(buildNewsMeta(meta, nextNews));
        }
      } catch {
        if (!cancelled) {
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

      if (!cancelled) {
        setNewsLoading(false);
      }
    }

    if (selectedStock && brokerApiUrl) {
      fetchNews();
    }

    return () => {
      cancelled = true;
    };
  }, [brokerApiUrl, limit, selectedStock]);

  return {
    news,
    newsLoading,
    newsMeta,
    newsStatusLabel: getNewsStatusLabel(newsMeta),
  };
}
