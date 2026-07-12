"use client";
import { useState, FormEvent } from "react";

/* Admin login page — served at admin.hirestepx.com/admin-login (via middleware
 * passthrough). On success, /api/admin-login sets an HttpOnly admin_token cookie
 * and returns the token so the client can also store it in localStorage for
 * subsequent x-admin-token API calls (existing AdminDashboard flow). */

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body: Record<string, string> = { password };
      if (totpRequired && totp) body.totp = totp.replace(/\s/g, "");

      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; token?: string };
        if (data.token) {
          try { localStorage.setItem("hirestepx_admin_token", data.token); } catch { /* private browsing */ }
        }
        window.location.href = "/";
      } else if (res.status === 429) {
        setError("Too many attempts. Try again in 15 minutes.");
      } else {
        const data = (await res.json().catch(() => ({}))) as { totp_required?: boolean };
        if (data.totp_required) {
          // Password was correct; server now wants a TOTP code.
          setTotpRequired(true);
          setError("");
        } else if (totpRequired) {
          setError("Invalid 2FA code.");
        } else {
          setError("Wrong password.");
        }
      }
    } catch {
      setError("Connection failed. Check your network.");
    }
    setBusy(false);
  }

  const inputStyle: React.CSSProperties = {
    background: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "0.6rem 0.8rem",
    color: "#f5f5f5",
    fontSize: "0.95rem",
    outline: "none",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "#f5f5f5" }}>
          Admin access
        </h1>

        {!totpRequired ? (
          <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#888", fontWeight: 500 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              /* eslint-disable-next-line jsx-a11y/no-autofocus -- dedicated single-field login page */
              autoFocus
              required
              style={inputStyle}
            />
          </label>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#888", fontWeight: 500 }}>
              Authenticator code
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={totp}
              onChange={e => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the OTP field when the second step appears; dedicated single-field login page */
              autoFocus
              autoComplete="one-time-code"
              placeholder="000000"
              required
              style={{ ...inputStyle, letterSpacing: "0.25em", textAlign: "center" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#555" }}>
              Enter the 6-digit code from your authenticator app.
            </span>
          </label>
        )}

        {error && (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#f87171" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || (!totpRequired && !password) || (totpRequired && totp.length !== 6)}
          style={{
            background: busy ? "#2a2a2a" : "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.65rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Verifying…" : totpRequired ? "Verify code" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
