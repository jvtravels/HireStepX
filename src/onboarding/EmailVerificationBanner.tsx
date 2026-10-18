import { font } from "../tokens";
import { tokens } from "../auth/_tokens";
import { Button } from "@/components/ui/button";
import { useResendVerification } from "../auth/ResendVerification";

export function EmailVerificationBanner({ email }: { email?: string } = {}) {
  const { send, sending, cooldown, message } = useResendVerification(email ?? "");

  // Derived from the canonical cream palette so a token shift propagates.
  const COPPER = tokens.copper;
  const COPPER_SOFT = "rgba(180, 83, 9, 0.08)"; // banner-local lighter wash, between copperWash & copperSoft
  const COAL = tokens.coal;
  const LINE = tokens.line;
  const disabled = cooldown > 0 || sending;
  const label = sending ? "Sending…" : cooldown > 0 ? (message?.kind === "ok" ? `Sent ✓ · resend in ${cooldown}s` : `Resend in ${cooldown}s`) : message?.kind === "error" ? "Failed — try again" : "Resend email";
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={send}
          disabled={disabled}
          style={{ fontFamily: font.ui }}
        >
          {label}
        </Button>
      )}
    </div>
  );
}
