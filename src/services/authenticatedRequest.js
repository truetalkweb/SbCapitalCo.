import { supabase } from "./supabaseClient";

export async function getAuthHeaders(headers = {}) {
  if (!supabase) return headers;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

export async function authenticatedFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: await getAuthHeaders(options.headers || {}),
  });
}

export async function getAuthenticatedAxiosConfig(config = {}) {
  return {
    ...config,
    headers: await getAuthHeaders(config.headers || {}),
  };
}
