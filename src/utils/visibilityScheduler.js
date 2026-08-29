function pageIsVisible(documentRef) {
  return !documentRef || documentRef.visibilityState !== "hidden";
}

export function createVisibilityAwarePoller(
  callback,
  intervalMs,
  {
    documentRef = typeof document === "undefined" ? null : document,
    immediate = true,
    repeat = true,
    resumeImmediately = true,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}
) {
  let stopped = false;
  let running = false;
  let hasRun = false;
  let timer = null;

  const clearScheduled = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const schedule = (delay = intervalMs) => {
    clearScheduled();
    if (stopped || (!repeat && hasRun) || !pageIsVisible(documentRef)) return;
    timer = setTimer(run, Math.max(0, Number(delay) || 0));
  };

  const run = async () => {
    timer = null;
    if (stopped || running || !pageIsVisible(documentRef)) return;
    running = true;
    hasRun = true;
    try {
      await callback();
    } finally {
      running = false;
      if (repeat) schedule(intervalMs);
    }
  };

  const handleVisibilityChange = () => {
    if (!pageIsVisible(documentRef)) {
      clearScheduled();
      return;
    }
    if (repeat || !running) schedule(resumeImmediately ? 0 : intervalMs);
  };

  documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);
  schedule(immediate ? 0 : intervalMs);

  return () => {
    stopped = true;
    clearScheduled();
    documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
  };
}

export function isPageVisible(documentRef = typeof document === "undefined" ? null : document) {
  return pageIsVisible(documentRef);
}
