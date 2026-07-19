import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearStoredSupabaseSession,
  isSupabaseConfigured,
  supabase,
  terminalWorkspaceTable,
} from "../services/supabaseClient";
import {
  isValidWorkspacePayload,
} from "../services/workspacePayloadPolicy";

const authRedirectOrigin = String(import.meta.env.VITE_AUTH_REDIRECT_URL || "").trim();
const WORKSPACE_SCHEMA_VERSION = 1;
const LEGACY_COLUMN_ERROR_CODES = new Set(["42703", "PGRST204"]);
const INTENDED_DESTINATION_KEY = "sb_auth_intended_destination";

function getCurrentDestination() {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  ["access_token", "error", "error_code", "error_description", "refresh_token", "type"].forEach(
    (key) => url.searchParams.delete(key),
  );
  return `${url.pathname}${url.search}${url.hash && !url.hash.includes("access_token") ? url.hash : ""}` || "/";
}

function rememberIntendedDestination() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(INTENDED_DESTINATION_KEY, getCurrentDestination());
}

function restoreIntendedDestination() {
  if (typeof window === "undefined") return;
  const destination = window.sessionStorage.getItem(INTENDED_DESTINATION_KEY);
  window.sessionStorage.removeItem(INTENDED_DESTINATION_KEY);
  if (!destination?.startsWith("/") || destination.startsWith("//")) return;
  window.history.replaceState({}, "", destination);
}

function getInitialAuthMessage() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get("error_description") || url.searchParams.get("error")
    ? "This authentication link is invalid or expired. Request a new link and try again."
    : "";
}

function getAuthRedirectTo() {
  if (authRedirectOrigin) return authRedirectOrigin.replace(/\/+$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}${window.location.pathname}`;
  return undefined;
}

function getAuthMessage(error, fallback) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login")) return "Email or password is incorrect.";
  if (message.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (message.includes("password")) return "Use a password with at least 8 characters.";
  if (message.includes("rate limit")) return "Too many attempts. Wait briefly and try again.";
  return fallback;
}

function fallbackKey(userId) {
  return `sb_workspace_fallback:${userId}`;
}

function loadLocalFallback(userId) {
  try {
    const payload = JSON.parse(window.localStorage.getItem(fallbackKey(userId)) || "null");
    return isValidWorkspacePayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

function saveLocalFallback(userId, payload) {
  if (!isValidWorkspacePayload(payload)) return false;
  try {
    window.localStorage.setItem(fallbackKey(userId), JSON.stringify(payload));
    return true;
  } catch {
    // Hardened browsers may disable local storage; cloud persistence still works.
    return false;
  }
}

async function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function useCloudWorkspace({ applyWorkspace, pushActivity, resetWorkspace, workspacePayload }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(() => !supabase);
  const [authBusy, setAuthBusy] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState(getInitialAuthMessage);
  const [cloudStatus, setCloudStatus] = useState("Authentication required");
  const cloudWorkspaceReadyRef = useRef(false);
  const activeUserIdRef = useRef(null);
  const remoteRevisionRef = useRef(0);
  const legacyWorkspaceSchemaRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const applyWorkspaceRef = useRef(applyWorkspace);
  const resetWorkspaceRef = useRef(resetWorkspace);

  useEffect(() => {
    applyWorkspaceRef.current = applyWorkspace;
    resetWorkspaceRef.current = resetWorkspace;
  }, [applyWorkspace, resetWorkspace]);

  const loadWorkspaceForUser = useCallback(async (currentUser, { quiet = false } = {}) => {
    if (!supabase || !currentUser?.id) return false;
    resetWorkspaceRef.current?.();
    const localFallback = loadLocalFallback(currentUser.id);
    if (localFallback) applyWorkspaceRef.current(localFallback);
    let { data, error } = await withTimeout(
      supabase
        .from(terminalWorkspaceTable)
        .select("data, updated_at, revision, schema_version, client_updated_at")
        .eq("user_id", currentUser.id)
        .maybeSingle(),
      5000,
      "Workspace restore timed out",
    );

    if (error && LEGACY_COLUMN_ERROR_CODES.has(error.code)) {
      legacyWorkspaceSchemaRef.current = true;
      ({ data, error } = await supabase
        .from(terminalWorkspaceTable)
        .select("data, updated_at")
        .eq("user_id", currentUser.id)
        .maybeSingle());
    } else {
      legacyWorkspaceSchemaRef.current = false;
    }
    if (error) throw error;
    if (data?.data && !isValidWorkspacePayload(data.data)) {
      throw new Error("Workspace data is invalid or exceeds the supported size.");
    }
    if (data?.data) {
      remoteRevisionRef.current = Number(data.revision || 1);
      applyWorkspaceRef.current(data.data);
      saveLocalFallback(currentUser.id, data.data);
      if (!quiet) setCloudStatus("Workspace restored");
      return true;
    }
    remoteRevisionRef.current = 0;
    if (!quiet) setCloudStatus("New workspace");
    return false;
  }, []);

  const handleAuthSubmit = useCallback(async (mode = authMode) => {
    setAuthMessage("");
    const email = authEmail.trim().toLowerCase();
    if (!supabase) {
      setAuthMessage("Authentication is not configured.");
      return;
    }
    if (!email || !authPassword) {
      setAuthMessage("Enter your email and password.");
      return;
    }
    if (authPassword.length < 8) {
      setAuthMessage("Use a password with at least 8 characters.");
      return;
    }

    setAuthBusy(true);
    try {
      rememberIntendedDestination();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { emailRedirectTo: getAuthRedirectTo() },
        });
        if (error) throw error;
        setAuthMessage(data.session
          ? "Account created."
          : "If this address can be registered, confirmation instructions have been sent.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) throw error;
        setAuthMessage("Signed in.");
      }
      setAuthPassword("");
    } catch (error) {
      setAuthMessage(getAuthMessage(error, "Authentication failed. Try again."));
    } finally {
      setAuthBusy(false);
    }
  }, [authEmail, authMode, authPassword]);

  const handlePasswordReset = useCallback(async () => {
    const email = (authEmail || user?.email || "").trim().toLowerCase();
    if (!supabase || !email) {
      setAuthMessage("Enter your email first.");
      return false;
    }
    setAuthBusy(true);
    rememberIntendedDestination();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectTo(),
    });
    setAuthBusy(false);
    setAuthMessage(error
      ? getAuthMessage(error, "Password reset could not be sent.")
      : "Password reset instructions were sent if the account exists.");
    return !error;
  }, [authEmail, user]);

  const handlePasswordUpdate = useCallback(async () => {
    if (!supabase || authPassword.length < 8) {
      setAuthMessage("Use a new password with at least 8 characters.");
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.updateUser({ password: authPassword });
    setAuthBusy(false);
    if (error) {
      setAuthMessage(getAuthMessage(error, "Password could not be updated."));
      return;
    }
    setAuthPassword("");
    setPasswordRecovery(false);
    setAuthMessage("Password updated.");
  }, [authPassword]);

  const persistWorkspaceToCloud = useCallback(async ({ quiet = false } = {}) => {
    if (!supabase || !user?.id) {
      setCloudStatus("Sign in to save");
      return false;
    }
    try {
      if (!isValidWorkspacePayload(workspacePayload)) {
        setCloudStatus("Workspace is too large to save");
        if (!quiet) pushActivity?.({
          type: "cloud",
          status: "blocked",
          title: "Workspace Save Blocked",
          detail: "Workspace data must be a valid object smaller than 2 MB.",
        });
        return false;
      }
      saveLocalFallback(user.id, workspacePayload);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setCloudStatus("Offline; changes saved on this device");
        return false;
      }
      setCloudStatus("Saving...");
      const now = new Date().toISOString();

      if (legacyWorkspaceSchemaRef.current) {
        const { error } = await supabase.from(terminalWorkspaceTable).upsert({
          user_id: user.id,
          data: workspacePayload,
          updated_at: now,
        }, { onConflict: "user_id" });
        if (error) throw error;
      } else if (remoteRevisionRef.current === 0) {
        const { data, error } = await supabase
          .from(terminalWorkspaceTable)
          .insert({
            user_id: user.id,
            data: workspacePayload,
            schema_version: WORKSPACE_SCHEMA_VERSION,
            revision: 1,
            client_updated_at: now,
          })
          .select("revision")
          .single();
        if (error?.code === "23505") {
          await loadWorkspaceForUser(user);
          setCloudStatus("Newer cloud workspace restored");
          return false;
        }
        if (error) throw error;
        remoteRevisionRef.current = Number(data?.revision || 1);
      } else {
        const expectedRevision = remoteRevisionRef.current;
        const { data, error } = await supabase
          .from(terminalWorkspaceTable)
          .update({
            data: workspacePayload,
            schema_version: WORKSPACE_SCHEMA_VERSION,
            client_updated_at: now,
          })
          .eq("user_id", user.id)
          .eq("revision", expectedRevision)
          .select("revision")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          await loadWorkspaceForUser(user);
          setCloudStatus("Newer cloud workspace restored");
          return false;
        }
        remoteRevisionRef.current = Number(data.revision || expectedRevision + 1);
      }
      setCloudStatus("Workspace saved");
      return true;
    } catch {
      setCloudStatus("Cloud save unavailable; local fallback retained");
      if (!quiet) pushActivity?.({
        type: "cloud",
        status: "failed",
        title: "Workspace Save Failed",
        detail: "The local workspace remains available. Retry cloud sync later.",
      });
      return false;
    }
  }, [loadWorkspaceForUser, pushActivity, user, workspacePayload]);

  const saveWorkspaceToCloud = useCallback((options = {}) => {
    const operation = () => persistWorkspaceToCloud(options);
    saveQueueRef.current = saveQueueRef.current.then(operation, operation);
    return saveQueueRef.current;
  }, [persistWorkspaceToCloud]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOffline = () => setCloudStatus("Offline; changes saved on this device");
    const handleOnline = () => {
      if (!user?.id) return;
      setCloudStatus("Back online; syncing...");
      saveWorkspaceToCloud({ quiet: true });
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [saveWorkspaceToCloud, user?.id]);

  const loadWorkspaceFromCloud = useCallback(async () => {
    if (!user) return false;
    try {
      return await loadWorkspaceForUser(user);
    } catch {
      setCloudStatus("Cloud load unavailable; local fallback active");
      return false;
    }
  }, [loadWorkspaceForUser, user]);

  const handleLogout = useCallback(async () => {
    clearStoredSupabaseSession();
    activeUserIdRef.current = null;
    remoteRevisionRef.current = 0;
    legacyWorkspaceSchemaRef.current = false;
    cloudWorkspaceReadyRef.current = false;
    setUser(null);
    setWorkspaceReady(false);
    setAuthMessage("");
    setCloudStatus("Authentication required");
    if (supabase) {
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }).catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let active = true;
    let initialized = false;
    const authUrl = new URL(window.location.href);
    const authUrlError = authUrl.searchParams.get("error_description")
      || authUrl.searchParams.get("error");
    if (authUrlError) {
      ["error", "error_code", "error_description"].forEach((key) => authUrl.searchParams.delete(key));
      window.history.replaceState({}, "", `${authUrl.pathname}${authUrl.search}${authUrl.hash}`);
    }
    const finishSessionRestore = (session) => {
      if (!active) return;
      initialized = true;
      setUser(session?.user || null);
      setWorkspaceReady(false);
      setAuthReady(true);
    };
    const restoreTimeout = window.setTimeout(() => {
      if (!initialized) finishSessionRestore(null);
    }, 5000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        finishSessionRestore(data.session);
      })
      .catch(() => {
        if (!initialized) {
          setAuthMessage("The saved session could not be restored. Sign in again.");
          finishSessionRestore(null);
        }
      });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_IN") restoreIntendedDestination();
      if (event === "SIGNED_OUT" && initialized) {
        setAuthMessage("Your session ended. Sign in to continue.");
      }
      finishSessionRestore(session);
      if (session?.user?.email) setAuthEmail(session.user.email);
    });
    return () => {
      active = false;
      window.clearTimeout(restoreTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      activeUserIdRef.current = null;
      return;
    }
    if (activeUserIdRef.current === user.id) return;
    let cancelled = false;
    cloudWorkspaceReadyRef.current = false;
    activeUserIdRef.current = user.id;
    setCloudStatus("Restoring workspace...");
    const restoreTimeoutId = window.setTimeout(() => {
      if (cancelled || cloudWorkspaceReadyRef.current) return;
      cloudWorkspaceReadyRef.current = true;
      setWorkspaceReady(true);
      setCloudStatus("Cloud restore timed out; local fallback active");
    }, 7000);
    loadWorkspaceForUser(user)
      .catch(() => setCloudStatus("Cloud unavailable; local fallback active"))
      .finally(() => {
        if (cancelled) return;
        window.clearTimeout(restoreTimeoutId);
        cloudWorkspaceReadyRef.current = true;
        setWorkspaceReady(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(restoreTimeoutId);
    };
  }, [loadWorkspaceForUser, user]);

  useEffect(() => {
    if (!user?.id || !cloudWorkspaceReadyRef.current) return undefined;
    const timeoutId = window.setTimeout(() => {
      saveWorkspaceToCloud({ quiet: true });
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [saveWorkspaceToCloud, user, workspacePayload]);

  return {
    authBusy,
    authEmail,
    authMessage,
    authMode,
    authPassword,
    authReady,
    cloudStatus,
    handleAuthSubmit,
    handleLogout,
    handlePasswordReset,
    handlePasswordUpdate,
    isAuthConfigured: isSupabaseConfigured,
    loadWorkspaceFromCloud,
    saveWorkspaceToCloud,
    setAuthEmail,
    setAuthMode,
    setAuthPassword,
    passwordRecovery,
    user,
    workspaceReady,
  };
}
