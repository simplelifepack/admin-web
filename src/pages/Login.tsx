import { useEffect, useRef, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

import { T, mono, sans } from "@/constants/theme";
import { adminApi, setToken } from "@/lib/api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type Stage = "google" | "enroll" | "login" | "done";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function Login({ onSignedIn, expiredNotice }: { onSignedIn: () => void; expiredNotice?: boolean }) {
  const [stage, setStage] = useState<Stage>("google");
  const [adminLabel, setAdminLabel] = useState<{ name: string; email: string } | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devRole, setDevRole] = useState("owner");
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError("VITE_GOOGLE_CLIENT_ID is not set in admin-web/.env.");
      return;
    }
    const tryInit = () => {
      if (!window.google || !buttonRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => void handleGoogleCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "filled_black", size: "large", shape: "pill" });
      return true;
    };
    if (!tryInit()) {
      // Give up after ~15s instead of polling forever — an indefinitely-running
      // interval is both bad practice and (observed in testing) can keep the
      // page from ever reaching "idle" for tooling that waits on that state.
      let attempts = 0;
      const MAX_ATTEMPTS = 100;
      const id = window.setInterval(() => {
        attempts += 1;
        if (tryInit()) {
          window.clearInterval(id);
        } else if (attempts >= MAX_ATTEMPTS) {
          window.clearInterval(id);
          setError("Couldn't load Google Sign-In (accounts.google.com didn't respond). Check your connection, or use Test as Admin below.");
        }
      }, 150);
      return () => window.clearInterval(id);
    }
  }, []);

  async function handleGoogleCredential(credential: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi.googleLogin(credential);
      setAdminLabel(result.admin);
      setPendingToken(result.pendingToken);
      setStage(result.status === "passkey_enrollment_required" ? "enroll" : "login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEnroll() {
    if (!pendingToken) return;
    setBusy(true);
    setError(null);
    try {
      const options = await adminApi.enrollOptions(pendingToken);
      const response = await startRegistration({ optionsJSON: options });
      const result = await adminApi.enrollVerify(pendingToken, response, navigator.platform || "this device");
      setToken(result.token);
      setStage("done");
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey registration failed or was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDevLogin() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi.devLogin(devRole);
      setToken(result.token);
      setStage("done");
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test-as-admin sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasskeyLogin() {
    if (!pendingToken) return;
    setBusy(true);
    setError(null);
    try {
      const options = await adminApi.loginOptions(pendingToken);
      const response = await startAuthentication({ optionsJSON: options });
      const result = await adminApi.loginVerify(pendingToken, response);
      setToken(result.token);
      setStage("done");
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey verification failed or was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: T.navy, fontFamily: sans, color: T.text }}>
      <div style={{ width: 380, maxWidth: "calc(100vw - 32px)", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: T.gold, color: T.inkOnGold, fontWeight: 800 }}>R</span>
          <div>
            <b style={{ fontSize: 15 }}>ReadiNes</b>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, color: T.muted }}>CONSOLE</div>
          </div>
        </div>

        {expiredNotice && (
          <p style={{ color: T.gold, fontSize: 12.5, marginBottom: 16, background: "rgba(217,184,106,.1)", border: "1px solid rgba(217,184,106,.3)", borderRadius: 8, padding: "8px 10px" }}>
            Your session expired (access tokens last 15 minutes). Sign in again.
          </p>
        )}

        {stage === "google" && (
          <>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 18 }}>Sign in with the Google account registered for admin access.</p>
            <div ref={buttonRef} />

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: T.border }} />
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1, color: T.faint }}>DEV ONLY</span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>
            <div style={{ border: `1px dashed ${T.coral}55`, borderRadius: 10, padding: 12 }}>
              <p style={{ color: T.muted, fontSize: 11.5, margin: "0 0 10px" }}>
                Skips Google + passkey. 403s outside local dev — see <code style={{ color: T.gold }}>devLogin()</code>.
                Logged to the audit trail as <code style={{ color: T.gold }}>auth.dev_login</code>.
              </p>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["support", "catalogue", "ops_security", "owner"] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setDevRole(role)}
                    style={{
                      flex: 1, padding: "6px 0", fontSize: 10.5, fontFamily: mono, borderRadius: 7, cursor: "pointer",
                      border: `1px solid ${devRole === role ? T.gold + "88" : T.border}`,
                      background: devRole === role ? T.raised : "transparent",
                      color: devRole === role ? T.white : T.muted,
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <button
                onClick={handleDevLogin}
                disabled={busy}
                style={{ width: "100%", background: "transparent", color: T.coral, border: `1px solid ${T.coral}55`, borderRadius: 9, padding: "9px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                {busy ? "Signing in…" : `Test as Admin (${devRole})`}
              </button>
            </div>
          </>
        )}

        {stage === "enroll" && adminLabel && (
          <>
            <p style={{ fontSize: 13, marginBottom: 6 }}>Welcome, <b>{adminLabel.name}</b>.</p>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 18 }}>
              No passkey is registered yet. A passkey is required for every admin sign-in and for
              step-up verification before a privileged write (decision D2).
            </p>
            <button onClick={handleEnroll} disabled={busy} style={btnGold}>
              {busy ? "Waiting for your passkey…" : "Register a passkey"}
            </button>
          </>
        )}

        {stage === "login" && adminLabel && (
          <>
            <p style={{ fontSize: 13, marginBottom: 6 }}>Welcome back, <b>{adminLabel.name}</b>.</p>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 18 }}>Verify with your passkey to finish signing in.</p>
            <button onClick={handlePasskeyLogin} disabled={busy} style={btnGold}>
              {busy ? "Waiting for your passkey…" : "Verify with passkey"}
            </button>
          </>
        )}

        {error && (
          <p style={{ color: T.coral, fontSize: 12.5, marginTop: 14, background: "rgba(232,115,106,.1)", border: "1px solid rgba(232,115,106,.3)", borderRadius: 8, padding: "8px 10px" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

const btnGold: React.CSSProperties = {
  width: "100%", background: T.gold, color: T.inkOnGold, border: "none", borderRadius: 10,
  padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
};
