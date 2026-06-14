"use client";
import { useState, FormEvent } from "react";

/* Admin login page — served at admin.hirestepx.com/admin-login (via middleware
 * passthrough). On success, /api/admin-login sets an HttpOnly admin_token cookie
 * and returns the token so the client can also store it in localStorage for
 * subsequent x-admin-token API calls (existing AdminDashboard flow). */

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ensure Set-Cookie is honoured
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; token?: string };
        // Mirror the token into localStorage so the AdminDashboard can pick it
        // up on the next page load via its existing getToken() path.
        if (data.token) {
          try { localStorage.setItem("hirestepx_admin_token", data.token); } catch { /* private browsing */ }
        }
        // Navigate to the admin dashboard (the cookie is now set).
        window.location.href = "/";
      } else if (res.status === 429) {
        setError("Too many attempts. Try again in 15 minutes.");
      } else {
        setError("Wrong password.");
      }
    } catch {
      setError("Connection failed. Check your network.");
    }
    setBusy(false);
  }

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

        <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.8rem", color: "#888", fontWeight: 500 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            /* eslint-disable-next-line jsx-a11y/no-autofocus -- dedicated single-field login page; focusing the only input on mount is expected. */
            autoFocus
            required
            style={{
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "0.6rem 0.8rem",
              color: "#f5f5f5",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
        </label>

        {error && (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#f87171" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
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
          {busy ? "Verifying…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
