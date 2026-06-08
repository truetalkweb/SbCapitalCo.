import { useCallback, useEffect, useRef, useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export function useCloudWorkspace({
  applyWorkspace,
  pushActivity,
  workspacePayload,
}) {
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [cloudStatus, setCloudStatus] = useState("Local workspace");
  const cloudWorkspaceReadyRef = useRef(false);

  const handleAuthSubmit = useCallback(async (mode = authMode) => {
    setAuthMessage("");

    try {
      if (!authEmail || !authPassword) {
        setAuthMessage("Enter email and password.");
        return;
      }

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthMessage("Account created.");
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthMessage("Signed in.");
      }

      setAuthPassword("");
    } catch (error) {
      setAuthMessage(error.message || "Authentication failed.");
    }
  }, [authEmail, authMode, authPassword]);

  const saveWorkspaceToCloud = useCallback(async () => {
    if (!user) {
      setCloudStatus("Sign in to save cloud workspace");
      pushActivity({
        type: "cloud",
        status: "blocked",
        title: "Cloud Save Blocked",
        detail: "User must be signed in before saving the workspace to cloud storage.",
      });
      return;
    }

    try {
      await setDoc(doc(db, "workspaces", user.uid), {
        ...workspacePayload,
        updatedAt: serverTimestamp(),
        owner: user.uid,
      });

      setCloudStatus(`Cloud saved ${new Date().toLocaleTimeString()}`);
      pushActivity({
        type: "cloud",
        status: "saved",
        title: "Cloud Workspace Saved",
        detail: "Workspace state saved to Firebase.",
      });
    } catch {
      setCloudStatus("Cloud save failed");
      pushActivity({
        type: "cloud",
        status: "failed",
        title: "Cloud Save Failed",
        detail: "Firebase workspace save did not complete.",
      });
    }
  }, [pushActivity, user, workspacePayload]);

  const loadWorkspaceFromCloud = useCallback(async () => {
    if (!user) {
      setCloudStatus("Sign in to load cloud workspace");
      pushActivity({
        type: "cloud",
        status: "blocked",
        title: "Cloud Load Blocked",
        detail: "User must be signed in before loading a cloud workspace.",
      });
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "workspaces", user.uid));

      if (!snapshot.exists()) {
        setCloudStatus("No cloud workspace found");
        pushActivity({
          type: "cloud",
          status: "warning",
          title: "Cloud Workspace Missing",
          detail: "No saved Firebase workspace exists for the signed-in user.",
        });
        return;
      }

      applyWorkspace(snapshot.data());
      setCloudStatus(`Cloud loaded ${new Date().toLocaleTimeString()}`);
      pushActivity({
        type: "cloud",
        status: "loaded",
        title: "Cloud Workspace Loaded",
        detail: "Workspace state loaded from Firebase.",
      });
    } catch {
      setCloudStatus("Cloud load failed");
      pushActivity({
        type: "cloud",
        status: "failed",
        title: "Cloud Load Failed",
        detail: "Firebase workspace load did not complete.",
      });
    }
  }, [applyWorkspace, pushActivity, user]);

  const handleLogout = useCallback(async () => {
    await signOut(auth);
    setCloudStatus("Local workspace");
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      cloudWorkspaceReadyRef.current = false;
      setUser(currentUser);

      if (!currentUser) {
        setCloudStatus("Local workspace");
        return;
      }

      setCloudStatus(`Signed in: ${currentUser.email}`);

      try {
        const snapshot = await getDoc(doc(db, "workspaces", currentUser.uid));

        if (snapshot.exists()) {
          applyWorkspace(snapshot.data());
          setCloudStatus(`Cloud loaded ${new Date().toLocaleTimeString()}`);
        } else {
          setCloudStatus("Signed in - local workspace active");
        }
        cloudWorkspaceReadyRef.current = true;
      } catch {
        cloudWorkspaceReadyRef.current = true;
        setCloudStatus("Signed in - cloud load skipped");
      }
    });

    return () => unsubscribe();
  }, [applyWorkspace]);

  useEffect(() => {
    if (!user || !cloudWorkspaceReadyRef.current) return undefined;

    const timeoutId = window.setTimeout(async () => {
      try {
        await setDoc(doc(db, "workspaces", user.uid), {
          ...workspacePayload,
          updatedAt: serverTimestamp(),
          owner: user.uid,
        });

        setCloudStatus(`Cloud autosaved ${new Date().toLocaleTimeString()}`);
      } catch {
        setCloudStatus("Cloud autosave failed");
      }
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [user, workspacePayload]);

  return {
    authEmail,
    authMessage,
    authMode,
    authPassword,
    cloudStatus,
    handleAuthSubmit,
    handleLogout,
    loadWorkspaceFromCloud,
    saveWorkspaceToCloud,
    setAuthEmail,
    setAuthMode,
    setAuthPassword,
    user,
  };
}
