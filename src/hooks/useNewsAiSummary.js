import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedRequest";

export function useNewsAiSummary({ story, brokerApiUrl, enabled }) {
  const [state, setState] = useState({ key: null, status: "idle", result: null, error: "" });
  const request = useRef(null);
  const key = JSON.stringify([story?.id, story?.headline, story?.url, story?.summary, story?.timestamp]);
  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, [key]);

  const generate = useCallback(async () => {
    if (!enabled || !story?.headline) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    setState({ key, status: "loading", result: null, error: "" });
    try {
      const response = await authenticatedFetch(`${brokerApiUrl}/api/ai/summarize-news`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsItem: {
          headline: story.headline, summary: story.summary || "", source: story.source,
          relatedTicker: story.symbol || story.relatedTicker, timestamp: story.timestamp, url: story.url,
        } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(response.status === 403
        ? "AI summaries require an eligible plan."
        : "AI summary is temporarily unavailable. Try again.");
      if (!payload.summary?.summary) throw new Error("No usable AI summary was returned. Try again.");
      if (request.current === controller) setState({ key, status: "success", result: payload.summary, error: "" });
    } catch (error) {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) {
        setState({ key, status: "error", result: null, error: timedOut
          ? "AI summary timed out. Try again." : error.message });
      }
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) request.current = null;
    }
  }, [brokerApiUrl, enabled, key, story]);
  return { ...(state.key === key ? state : { status: "idle", result: null, error: "" }), generate };
}
