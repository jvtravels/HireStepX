import { useState, useEffect } from "react";
import { font } from "../tokens";
import { tokens } from "../auth/_tokens";

export function EmailVerificationBanner({ email }: { email?: string } = {}) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: email.toLowerCase().trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
      setCooldown(45);
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      console.error("[onboarding] Resend verification failed:", err instanceof Error ? err.message : err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  // Derived from the canonical cream palette so a token shift propagates.
  const COPPER = tokens.copper;
  const COPPER_SOFT = "rgba(180, 83, 9, 0.08)"; // banner-local lighter wash, between copperWash & copperSoft
  const COAL = tokens.coal;
  const INK_FAINT = tokens.inkFaintWeak;
  const LINE = tokens.line;
  const disabled = cooldown > 0 || status === "sending";
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "10px 24px",
        background: COPPER_SOFT,
        borderBottom: `1px solid ${LINE}`,
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        flexWrap: "wrap",
        fontFamily: font.ui,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: COAL }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        Check your inbox for a verification link — your progress is saved.
      </span>
      {email && (
        <button
          type="button"
          onClick={handleResend}
          disabled={disabled}
          style={{
            fontFamily: font.ui,
            fontSize: 12,
            fontWeight: 500,
            color: disabled ? INK_FAINT : COPPER,
            background: "transparent",
            border: `1px solid ${disabled ? LINE : "rgba(180, 83, 9, 0.35)"}`,
            borderRadius: 6,
            padding: "4px 10px",
            cursor: disabled ? "default" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {status === "sending" ? "Sending…" : status === "sent" ? "Sent ✓" : status === "error" ? "Failed — try again" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
        </button>
      )}
    </div>
  );
}
