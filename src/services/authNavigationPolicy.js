const AUTH_QUERY_KEYS = [
  "access_token",
  "error",
  "error_code",
  "error_description",
  "refresh_token",
  "type",
];

export function getSafeAuthReturnPath(href, fallback = "/") {
  try {
    const url = new URL(href, "https://terminal.invalid");
    AUTH_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
    const hash = url.hash && !url.hash.includes("access_token") ? url.hash : "";
    return `${url.pathname}${url.search}${hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function isSafeInternalReturnPath(destination) {
  return typeof destination === "string"
    && destination.startsWith("/")
    && !destination.startsWith("//");
}
