import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabasePublishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const terminalWorkspaceTable =
  import.meta.env.VITE_SUPABASE_WORKSPACE_TABLE || "terminal_workspaces";

export function clearStoredSupabaseSession() {
  if (typeof window === "undefined" || !supabaseUrl) return;
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
  } catch {
    // The caller still clears authenticated UI state in memory.
  }
}
