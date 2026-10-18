/* HireStepX — Resend verification email
   Shared by the signup "check your email" screen and the login screens a
   candidate lands on after an expired / invalid / unconfirmed link. The
   server answers identically whether or not the account exists, so the
   success copy is deliberately non-committal. */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f } from "./_tokens";
import { sanitizeEmail, validateEmail } from "./_validation";

export const RESEND_COOLDOWN_SECONDS = 45;
export const RESEND_SUCCESS_MESSAGE =
  "If an account exists and is not yet verified, we have sent a new link.";

type ResendMessage = { kind: "ok" | "error"; text: string };

export function useResendVerification(email: string) {
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<ResendMessage | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const send = useCallback(async () => {
    if (cooldown > 0 || sending) return;
    const clean = sanitizeEmail(email);
    if (!validateEmail(clean).valid) {
      setMessage({ kind: "error", text: "Enter your email address first." });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      if (res.status === 429) {
        setMessage({ kind: "error", text: "Too many requests. Try again in a few minutes." });
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else if (!res.ok) {
        setMessage({ kind: "error", text: "Couldn't send the email. Try again in a moment." });
      } else {
        setMessage({ kind: "ok", text: RESEND_SUCCESS_MESSAGE });
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      setMessage({ kind: "error", text: "Couldn't reach our servers. Check your connection." });
    } finally {
      setSending(false);
    }
  }, [cooldown, sending, email]);

  return { send, sending, cooldown, message };
}

const WRAP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  marginBottom: 16,
};
const BUTTON_STYLE: React.CSSProperties = { fontFamily: f.sans, fontSize: 14, fontWeight: 500 };
const MESSAGE_BASE_STYLE: React.CSSProperties = { fontFamily: f.sans, fontSize: 13, lineHeight: 1.4, margin: 0 };
const MESSAGE_STYLE: Record<ResendMessage["kind"], React.CSSProperties> = {
  ok: { ...MESSAGE_BASE_STYLE, color: t.success },
  error: { ...MESSAGE_BASE_STYLE, color: t.error },
};

/** Always-mounted polite live region, so a message that appears later is announced. */
export function ResendStatus({ message, id }: { message: ResendMessage | null; id?: string }) {
  return (
    <p id={id} role="status" aria-live="polite" style={message ? MESSAGE_STYLE[message.kind] : MESSAGE_BASE_STYLE}>
      {message?.text}
    </p>
  );
}

export function resendButtonLabel(sending: boolean, cooldown: number): string {
  if (sending) return "Sending...";
  if (cooldown > 0) return `Resend in ${cooldown}s`;
  return "Resend verification email";
}

export default function ResendVerification({ email }: { email: string }) {
  const { send, sending, cooldown, message } = useResendVerification(email);
  return (
    <div style={WRAP_STYLE}>
      <Button
        type="button"
        variant="outline"
        onClick={send}
        disabled={cooldown > 0 || sending}
        aria-busy={sending || undefined}
        style={BUTTON_STYLE}
      >
        {resendButtonLabel(sending, cooldown)}
      </Button>
      <ResendStatus message={message} />
    </div>
  );
}
