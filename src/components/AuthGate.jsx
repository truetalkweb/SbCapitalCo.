import { LockKeyhole } from "lucide-react";
import { terminalSansFont } from "../config/terminalConfig";

export default function AuthGate({
  busy,
  configured,
  email,
  message,
  mode,
  onEmailChange,
  onModeChange,
  onPasswordChange,
  onPasswordUpdate,
  onResetPassword,
  onSubmit,
  password,
  recovery = false,
  ready,
}) {
  return (
    <main className="auth-gate">
      <section className="auth-gate__panel" aria-labelledby="auth-title">
        <div className="auth-gate__brand"><span>SB</span> Terminal</div>
        <LockKeyhole size={22} aria-hidden="true" />
        <h1 id="auth-title">{recovery ? "Set a new password" : ready ? "Secure workspace" : "Restoring session"}</h1>
        <p>{recovery ? "Choose a new password for your account." : ready ? "Sign in to access your private market-intelligence workspace." : "Checking your existing session..."}</p>
        {recovery && (
          <form onSubmit={(event) => { event.preventDefault(); onPasswordUpdate(); }}>
            <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(e) => onPasswordChange(e.target.value)} minLength={8} required /></label>
            <button className="auth-gate__primary" type="submit" disabled={busy}>{busy ? "Updating..." : "Update password"}</button>
          </form>
        )}
        {ready && configured && !recovery && (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(mode); }}>
            <div className="auth-gate__modes" role="tablist" aria-label="Authentication mode">
              {["login", "signup"].map((item) => (
                <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => onModeChange(item)}>
                  {item === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => onEmailChange(e.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => onPasswordChange(e.target.value)} minLength={8} required /></label>
            <button className="auth-gate__primary" type="submit" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
            <button className="auth-gate__link" type="button" disabled={busy} onClick={onResetPassword}>Reset password</button>
          </form>
        )}
        {ready && !configured && <div className="auth-gate__error">Authentication configuration is missing. Add the Supabase frontend environment values.</div>}
        {message && <div className="auth-gate__message" role="status">{message}</div>}
      </section>
      <style>{`
        .auth-gate{min-height:100vh;display:grid;place-items:center;padding:24px;background:#060b12;color:#e6edf6;font-family:${terminalSansFont};}
        .auth-gate__panel{width:min(420px,100%);display:grid;gap:14px;padding:28px;border:1px solid #1e2b3b;border-radius:8px;background:#0b121c;box-shadow:0 22px 70px rgba(0,0,0,.38)}
        .auth-gate__brand{font-size:20px;font-weight:700}.auth-gate__brand span{color:#20c7a2}.auth-gate h1{margin:0;font-size:22px}.auth-gate p{margin:0;color:#8fa1b6;line-height:1.5}
        .auth-gate form{display:grid;gap:12px}.auth-gate label{display:grid;gap:6px;color:#a9b7c8;font-size:12px}.auth-gate input{height:40px;padding:0 12px;border:1px solid #263649;border-radius:6px;background:#070d15;color:#eef4fb;font:inherit;outline:none}.auth-gate input:focus{border-color:#278cf4;box-shadow:0 0 0 3px rgba(39,140,244,.16)}
        .auth-gate__modes{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;border:1px solid #1e2b3b;border-radius:6px}.auth-gate__modes button,.auth-gate__link{border:0;background:transparent;color:#8fa1b6;height:34px;cursor:pointer}.auth-gate__modes button[aria-selected=true]{background:#142b49;color:#fff;border-radius:4px}
        .auth-gate__primary{height:40px;border:0;border-radius:6px;background:#1779dc;color:#fff;font-weight:700;cursor:pointer}.auth-gate button:disabled{opacity:.55;cursor:not-allowed}.auth-gate__message,.auth-gate__error{padding:10px;border-radius:6px;background:#101b29;color:#b8c6d6;font-size:12px;line-height:1.45}.auth-gate__error{border:1px solid #6a4720;color:#f5bd67}
      `}</style>
    </main>
  );
}
