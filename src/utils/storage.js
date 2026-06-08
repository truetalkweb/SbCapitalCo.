export function loadSetting(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export function saveSetting(key, value) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be disabled in hardened browser contexts.
  }
}

export function removeSettings(keys) {
  if (typeof window === "undefined") return;

  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures; runtime state is still reset by callers.
    }
  });
}
