// The deadline covers headers AND body consumption. Caller cancellation also
// releases obsolete requests when a chart changes symbol or unmounts.
export async function fetchJsonWithTimeout(url, { timeoutMs = 8000, signal } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException('Historical data request timed out. Retry when the provider recovers.', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
