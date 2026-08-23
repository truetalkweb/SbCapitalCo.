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
import {
  getCloudSyncPresentation,
  getWorkspaceConflictKey,
  getWorkspaceFallbackKey,
  getWorkspaceFingerprint,
  loadWorkspaceFallback,
  reconcileWorkspacePayloads,
  saveWorkspaceConflict,
  saveWorkspaceFallback,
} from "../services/workspacePersistencePolicy";
import {
  getSafeAuthReturnPath,
  isSafeInternalReturnPath,
} from "../services/authNavigationPolicy";
import { authenticatedFetch } from "../services/authenticatedRequest";
import { BROKER_API_URL } from "../config/terminalConfig";

const authRedirectOrigin = String(import.meta.env.VITE_AUTH_REDIRECT_URL || "").trim();
const WORKSPACE_SCHEMA_VERSION = 1;
const LEGACY_COLUMN_ERROR_CODES = new Set(["42703", "PGRST204"]);
const INTENDED_DESTINATION_KEY = "sb_auth_intended_destination";

function getCurrentDestination() {
  if (typeof window === "undefined") return "/";
  return getSafeAuthReturnPath(window.location.href);
}

function rememberIntendedDestination() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(INTENDED_DESTINATION_KEY, getCurrentDestination());
}

function restoreIntendedDestination() {
  if (typeof window === "undefined") return;
  const destination = window.sessionStorage.getItem(INTENDED_DESTINATION_KEY);
  window.sessionStorage.removeItem(INTENDED_DESTINATION_KEY);
  if (!isSafeInternalReturnPath(destination)) return;
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
  const [accountDeleteStatus, setAccountDeleteStatus] = useState("idle");
  const [cloudStatus, setCloudStatus] = useState("Authentication required");
  const [cloudSyncCode, setCloudSyncCode] = useState("auth_required");
  const cloudWorkspaceReadyRef = useRef(false);
  const activeUserIdRef = useRef(null);
  const remoteRevisionRef = useRef(0);
  const baseWorkspaceRef = useRef({});
  const lastPersistedFingerprintRef = useRef(null);
  const legacyWorkspaceSchemaRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const applyWorkspaceRef = useRef(applyWorkspace);
  const resetWorkspaceRef = useRef(resetWorkspace);

  useEffect(() => {
    applyWorkspaceRef.current = applyWorkspace;
    resetWorkspaceRef.current = resetWorkspace;
  }, [applyWorkspace, resetWorkspace]);

  const updateCloudStatus = useCallback((code, message) => {
    setCloudSyncCode(code);
    setCloudStatus(message || getCloudSyncPresentation(code).label);
  }, []);

  const loadWorkspaceForUser = useCallback(async (currentUser, { quiet = false } = {}) => {
    if (!supabase || !currentUser?.id) return false;
    resetWorkspaceRef.current?.();
    const localFallback = loadWorkspaceFallback(window.localStorage, currentUser.id);
    if (localFallback?.payload) applyWorkspaceRef.current(localFallback.payload);
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
      baseWorkspaceRef.current = data.data;
      lastPersistedFingerprintRef.current = getWorkspaceFingerprint(data.data);
      applyWorkspaceRef.current(data.data);
      saveWorkspaceFallback(window.localStorage, currentUser.id, data.data, {
        revision: remoteRevisionRef.current,
      });
      if (!quiet) updateCloudStatus("synced", "Workspace restored");
      return true;
    }
    remoteRevisionRef.current = 0;
    baseWorkspaceRef.current = {};
    lastPersistedFingerprintRef.current = null;
    if (!quiet) updateCloudStatus("new", localFallback ? "Local workspace ready to sync" : "New workspace");
    return false;
  }, [updateCloudStatus]);

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

  const persistWorkspaceToCloud = useCallback(async ({ quiet = false, payload, queuedBase } = {}) => {
    if (!supabase || !user?.id) {
      updateCloudStatus("auth_required", "Sign in to save");
      return false;
    }
    let payloadToSave = payload || workspacePayload;
    try {
      if (
        queuedBase
        && getWorkspaceFingerprint(queuedBase) !== getWorkspaceFingerprint(baseWorkspaceRef.current)
      ) {
        const queuedReconciliation = reconcileWorkspacePayloads({
          base: queuedBase,
          local: payloadToSave,
          remote: baseWorkspaceRef.current,
        });
        if (queuedReconciliation.conflictKeys.length) {
          saveWorkspaceConflict(
            window.localStorage,
            user.id,
            payloadToSave,
            queuedReconciliation.conflictKeys,
          );
        }
        payloadToSave = queuedReconciliation.merged;
      }
      if (!isValidWorkspacePayload(payloadToSave)) {
        updateCloudStatus("error", "Workspace is too large to save");
        if (!quiet) pushActivity?.({
          type: "cloud",
          status: "blocked",
          title: "Workspace Save Blocked",
          detail: "Workspace data must be a valid object smaller than 2 MB.",
        });
        return false;
      }
      const fingerprint = getWorkspaceFingerprint(payloadToSave);
      saveWorkspaceFallback(window.localStorage, user.id, payloadToSave, {
        revision: remoteRevisionRef.current,
      });
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        updateCloudStatus("offline", "Offline; changes saved on this device");
        return false;
      }
      if (
        remoteRevisionRef.current > 0
        && fingerprint
        && fingerprint === lastPersistedFingerprintRef.current
      ) {
        updateCloudStatus("synced", "Workspace up to date");
        return true;
      }

      updateCloudStatus("saving", "Saving...");
      const now = new Date().toISOString();

      if (legacyWorkspaceSchemaRef.current) {
        const { error } = await supabase.from(terminalWorkspaceTable).upsert({
          user_id: user.id,
          data: payloadToSave,
          updated_at: now,
        }, { onConflict: "user_id" });
        if (error) throw error;
      } else if (remoteRevisionRef.current === 0) {
        const { data, error } = await supabase
          .from(terminalWorkspaceTable)
          .insert({
            user_id: user.id,
            data: payloadToSave,
            schema_version: WORKSPACE_SCHEMA_VERSION,
            revision: 1,
            client_updated_at: now,
          })
          .select("revision")
          .single();
        if (error?.code === "23505") {
          const { data: latest, error: latestError } = await supabase
            .from(terminalWorkspaceTable)
            .select("data, revision")
            .eq("user_id", user.id)
            .single();
          if (latestError) throw latestError;
          const { merged, conflictKeys } = reconcileWorkspacePayloads({
            base: baseWorkspaceRef.current,
            local: payloadToSave,
            remote: latest.data,
          });
          if (conflictKeys.length) {
            saveWorkspaceConflict(window.localStorage, user.id, payloadToSave, conflictKeys);
          }
          baseWorkspaceRef.current = latest.data;
          remoteRevisionRef.current = Number(latest.revision || 1);
          lastPersistedFingerprintRef.current = getWorkspaceFingerprint(latest.data);
          applyWorkspaceRef.current(merged);
          updateCloudStatus(
            conflictKeys.length ? "conflict" : "synced",
            conflictKeys.length
              ? "Cloud conflict reconciled; local backup retained"
              : "Newer cloud workspace restored",
          );
          return !conflictKeys.length;
        }
        if (error) throw error;
        remoteRevisionRef.current = Number(data?.revision || 1);
      } else {
        const expectedRevision = remoteRevisionRef.current;
        const { data, error } = await supabase
          .from(terminalWorkspaceTable)
          .update({
            data: payloadToSave,
            schema_version: WORKSPACE_SCHEMA_VERSION,
            client_updated_at: now,
          })
          .eq("user_id", user.id)
          .eq("revision", expectedRevision)
          .select("revision")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          const { data: latest, error: latestError } = await supabase
            .from(terminalWorkspaceTable)
            .select("data, revision")
            .eq("user_id", user.id)
            .single();
          if (latestError) throw latestError;
          if (!isValidWorkspacePayload(latest?.data)) {
            throw new Error("Latest cloud workspace is invalid.");
          }

          const { merged, conflictKeys } = reconcileWorkspacePayloads({
            base: baseWorkspaceRef.current,
            local: payloadToSave,
            remote: latest.data,
          });
          if (conflictKeys.length) {
            saveWorkspaceConflict(window.localStorage, user.id, payloadToSave, conflictKeys);
          }

          const latestRevision = Number(latest.revision || expectedRevision + 1);
          const mergedFingerprint = getWorkspaceFingerprint(merged);
          const remoteFingerprint = getWorkspaceFingerprint(latest.data);
          if (mergedFingerprint !== remoteFingerprint) {
            const { data: mergedRow, error: mergeError } = await supabase
              .from(terminalWorkspaceTable)
              .update({
                data: merged,
                schema_version: WORKSPACE_SCHEMA_VERSION,
                client_updated_at: new Date().toISOString(),
              })
              .eq("user_id", user.id)
              .eq("revision", latestRevision)
              .select("revision")
              .maybeSingle();
            if (mergeError) throw mergeError;
            if (!mergedRow) {
              updateCloudStatus("conflict", "Workspace changed again; local backup retained");
              return false;
            }
            remoteRevisionRef.current = Number(mergedRow.revision || latestRevision + 1);
          } else {
            remoteRevisionRef.current = latestRevision;
          }

          baseWorkspaceRef.current = merged;
          lastPersistedFingerprintRef.current = mergedFingerprint;
          saveWorkspaceFallback(window.localStorage, user.id, merged, {
            revision: remoteRevisionRef.current,
          });
          applyWorkspaceRef.current(merged);
          updateCloudStatus(
            conflictKeys.length ? "conflict" : "synced",
            conflictKeys.length
              ? "Cloud conflict reconciled; local backup retained"
              : "Cloud changes merged",
          );
          return true;
        }
        remoteRevisionRef.current = Number(data.revision || expectedRevision + 1);
      }
      baseWorkspaceRef.current = payloadToSave;
      lastPersistedFingerprintRef.current = fingerprint;
      saveWorkspaceFallback(window.localStorage, user.id, payloadToSave, {
        revision: remoteRevisionRef.current,
      });
      updateCloudStatus("synced", "Workspace saved");
      return true;
    } catch {
      updateCloudStatus("error", "Cloud save unavailable; local fallback retained");
      if (!quiet) pushActivity?.({
        type: "cloud",
        status: "failed",
        title: "Workspace Save Failed",
        detail: "The local workspace remains available. Retry cloud sync later.",
      });
      return false;
    }
  }, [pushActivity, updateCloudStatus, user, workspacePayload]);

  const saveWorkspaceToCloud = useCallback((options = {}) => {
    const payload = workspacePayload;
    const queuedBase = baseWorkspaceRef.current;
    const operation = () => persistWorkspaceToCloud({ ...options, payload, queuedBase });
    saveQueueRef.current = saveQueueRef.current.then(operation, operation);
    return saveQueueRef.current;
  }, [persistWorkspaceToCloud, workspacePayload]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOffline = () => updateCloudStatus("offline", "Offline; changes saved on this device");
    const handleOnline = () => {
      if (!user?.id) return;
      updateCloudStatus("saving", "Back online; syncing...");
      saveWorkspaceToCloud({ quiet: true });
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [saveWorkspaceToCloud, updateCloudStatus, user?.id]);

  const loadWorkspaceFromCloud = useCallback(async () => {
    if (!user) return false;
    try {
      return await loadWorkspaceForUser(user);
    } catch {
      updateCloudStatus("error", "Cloud load unavailable; local fallback active");
      return false;
    }
  }, [loadWorkspaceForUser, updateCloudStatus, user]);

  const handleLogout = useCallback(async () => {
    clearStoredSupabaseSession();
    activeUserIdRef.current = null;
    remoteRevisionRef.current = 0;
    baseWorkspaceRef.current = {};
    lastPersistedFingerprintRef.current = null;
    legacyWorkspaceSchemaRef.current = false;
    cloudWorkspaceReadyRef.current = false;
    setUser(null);
    setWorkspaceReady(false);
    setAuthMessage("");
    updateCloudStatus("auth_required", "Authentication required");
    if (supabase) {
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }).catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    }
  }, [updateCloudStatus]);

  const handleDeleteAccount = useCallback(async (confirmation) => {
    if (!supabase || !user?.id || confirmation !== "DELETE") {
      setAccountDeleteStatus("confirmation-required");
      return false;
    }

    setAccountDeleteStatus("deleting");
    try {
      const response = await authenticatedFetch(`${BROKER_API_URL}/api/account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.deleted !== true) {
        throw new Error(payload.error || "Account deletion failed.");
      }

      try {
        window.localStorage.removeItem(getWorkspaceFallbackKey(user.id));
        window.localStorage.removeItem(getWorkspaceConflictKey(user.id));
      } catch {
        // Account deletion succeeded remotely; local storage cleanup is best effort.
      }
      resetWorkspaceRef.current?.();
      clearStoredSupabaseSession();
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      activeUserIdRef.current = null;
      remoteRevisionRef.current = 0;
      baseWorkspaceRef.current = {};
      lastPersistedFingerprintRef.current = null;
      cloudWorkspaceReadyRef.current = false;
      setUser(null);
      setWorkspaceReady(false);
      updateCloudStatus("auth_required", "Account deleted");
      setAuthMessage("Your account and cloud workspace were permanently deleted.");
      setAccountDeleteStatus("deleted");
      return true;
    } catch {
      setAccountDeleteStatus("failed");
      return false;
    }
  }, [updateCloudStatus, user]);

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
      remoteRevisionRef.current = 0;
      baseWorkspaceRef.current = {};
      lastPersistedFingerprintRef.current = null;
      return;
    }
    if (activeUserIdRef.current === user.id) return;
    let cancelled = false;
    cloudWorkspaceReadyRef.current = false;
    activeUserIdRef.current = user.id;
    updateCloudStatus("restoring", "Restoring workspace...");
    const restoreTimeoutId = window.setTimeout(() => {
      if (cancelled || cloudWorkspaceReadyRef.current) return;
      cloudWorkspaceReadyRef.current = true;
      setWorkspaceReady(true);
      updateCloudStatus("error", "Cloud restore timed out; local fallback active");
    }, 7000);
    loadWorkspaceForUser(user)
      .catch(() => updateCloudStatus("error", "Cloud unavailable; local fallback active"))
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
  }, [loadWorkspaceForUser, updateCloudStatus, user]);

  useEffect(() => {
    if (!user?.id || !cloudWorkspaceReadyRef.current) return undefined;
    const timeoutId = window.setTimeout(() => {
      saveWorkspaceToCloud({ quiet: true });
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [saveWorkspaceToCloud, user, workspacePayload]);

  return {
    accountDeleteStatus,
    authBusy,
    authEmail,
    authMessage,
    authMode,
    authPassword,
    authReady,
    cloudStatus,
    cloudSyncCode,
    cloudSyncPresentation: getCloudSyncPresentation(cloudSyncCode),
    handleAuthSubmit,
    handleDeleteAccount,
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
