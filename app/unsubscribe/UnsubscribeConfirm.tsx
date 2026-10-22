"use client";

import { useState } from "react";
import { tokens as t, fonts } from "../../src/auth/_tokens";

type Phase = "ask" | "saving" | "done" | "resubscribed" | "error";

export default function UnsubscribeConfirm({ token, label }: { token: string | null; label: string | null }) {
  const [phase, setPhase] = useState<Phase>("ask");

  async function send(action: "unsubscribe" | "resubscribe") {
    if (!token) return;
    setPhase("saving");
    try {
      const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "List-Unsubscribe": "One-Click", action }).toString(),
        referrerPolicy: "no-referrer",
      });
      setPhase(res.ok ? (action === "unsubscribe" ? "done" : "resubscribed") : "error");
    } catch {
      setPhase("error");
    }
  }

  const button = {
    fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: t.white, background: t.indigo,
    border: "none", borderRadius: 10, padding: "12px 24px", minHeight: 44, cursor: "pointer",
  } as const;
  const quiet = {
    fontFamily: fonts.sans, fontSize: 14, color: t.indigo, background: "none", border: "none",
    textDecoration: "underline", cursor: "pointer", padding: 0, minHeight: 44,
  } as const;

  let heading = "This link isn't valid";
  let body = "It may have been copied incompletely. You can manage every email preference from Settings after signing in.";
  let action: React.ReactNode = <a href="/settings" style={{ ...quiet, display: "inline-flex", alignItems: "center" }}>Open Settings</a>;

  if (token && label) {
    if (phase === "done") {
      heading = `You're unsubscribed from ${label} emails`;
      body = "This takes effect right away. Account, payment and security emails will still reach you.";
      action = <button type="button" style={quiet} onClick={() => send("resubscribe")}>Changed your mind? Re-subscribe</button>;
    } else if (phase === "resubscribed") {
      heading = `You're subscribed to ${label} emails again`;
      body = "Welcome back. You can switch this off any time from Settings or from any email we send.";
      action = <button type="button" style={quiet} onClick={() => send("unsubscribe")}>Unsubscribe again</button>;
    } else {
      heading = `Unsubscribe from ${label} emails?`;
      body = "Confirm below and we'll stop sending these. Account, payment and security emails are not affected.";
      action = (
        <>
          <button type="button" style={{ ...button, opacity: phase === "saving" ? 0.6 : 1 }} disabled={phase === "saving"} onClick={() => send("unsubscribe")}>
            {phase === "saving" ? "Saving…" : "Confirm unsubscribe"}
          </button>
          {phase === "error" ? (
            <p role="alert" style={{ margin: "12px 0 0", fontFamily: fonts.sans, fontSize: 13, color: t.errorInk }}>
              We couldn't save that. Please try again in a few minutes.
            </p>
          ) : null}
        </>
      );
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: t.pageBg }}>
      <div style={{ maxWidth: 480, width: "100%", background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, padding: "32px 28px" }}>
        <h1 style={{ margin: "0 0 12px", fontFamily: fonts.serif, fontSize: 28, fontWeight: 400, lineHeight: 1.2, color: t.coal }}>{heading}</h1>
        <p role="status" style={{ margin: "0 0 24px", fontFamily: fonts.sans, fontSize: 15, lineHeight: 1.6, color: t.indigoGray }}>{body}</p>
        {action}
      </div>
    </main>
  );
}
