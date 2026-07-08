import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearStoredSupabaseSession,
  isSupabaseConfigured,
  supabase,
  terminalWorkspaceTable,
} from "../services/supabaseClient";

function getAuthMessage(error, fallback) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login")) return "Email or password is incorrect.";
  if (message.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (message.includes("already registered")) return "An account already exists for this email.";
  if (message.includes("password")) return "Use a password with at least 8 characters.";
  if (message.includes("rate limit")) return "Too many attempts. Wait briefly and try again.";
  return fallback;
}

function fallbackKey(userId) {
  return `sb_workspace_fallback:${userId}`;
}

function loadLocalFallback(userId) {
  try {
    return JSON.parse(window.localStorage.getItem(fallbackKey(userId)) || "null");
  } catch {
    return null;
  }
}

function saveLocalFallback(userId, payload) {
  try {
    window.localStorage.setItem(fallbackKey(userId), JSON.stringify(payload));
  } catch {
    // Hardened browsers may disable local storage; cloud persistence still works.
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
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authBusy, setAuthBusy] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [cloudStatus, setCloudStatus] = useState("Authentication required");
  const cloudWorkspaceReadyRef = useRef(false);
  const activeUserIdRef = useRef(null);

  const loadWorkspaceForUser = useCallback(async (currentUser, { quiet = false } = {}) => {
    if (!supabase || !currentUser?.id) return false;
    resetWorkspace?.();
    const localFallback = loadLocalFallback(currentUser.id);
    if (localFallback) applyWorkspace(localFallback);
    const { data, error } = await withTimeout(
      supabase
        .from(terminalWorkspaceTable)
        .select("data, updated_at")
        .eq("user_id", currentUser.id)
        .maybeSingle(),
      5000,
      "Workspace restore timed out",
    );

    if (error) throw error;
    if (data?.data) {
      applyWorkspace(data.data);
      saveLocalFallback(currentUser.id, data.data);
      if (!quiet) setCloudStatus("Workspace restored");
      return true;
    }
    if (!quiet) setCloudStatus("New workspace");
    return false;
  }, [applyWorkspace, resetWorkspace]);

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
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setAuthMessage(data.session ? "Account created." : "Check your email to confirm the account.");
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
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

  const saveWorkspaceToCloud = useCallback(async ({ quiet = false } = {}) => {
    if (!supabase || !user?.id) {
      setCloudStatus("Sign in to save");
      return false;
    }
    try {
      saveLocalFallback(user.id, workspacePayload);
      const { error } = await supabase.from(terminalWorkspaceTable).upsert({
        user_id: user.id,
        data: workspacePayload,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      if (!quiet) setCloudStatus("Workspace saved");
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
  }, [pushActivity, user, workspacePayload]);

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
