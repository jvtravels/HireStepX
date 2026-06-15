/* Post-report referral CTA — Plan 1 "moment of delight" placement.
 *
 * Surfaces only after a genuinely good result (score >= threshold) and only
 * when the viewer has a referral code. Self-contained: pulls the code from
 * AuthContext and shares the *attributed* signup link so the loop credits both
 * sides (see referral.ts). Renders nothing when it shouldn't show, so the
 * parent can drop it in unconditionally. */

import { useState, type CSSProperties } from "react";
import { t, f } from "../tokens";
import { useAuth, referralSignupUrl } from "../../AuthContext";
import { captureClientEvent } from "../../posthogClient";

/** Show the invite only when the candidate just did well — a weak result is
 *  the wrong moment to ask for a share. Matches the onboarding 70 threshold. */
const MIN_SCORE = 70;

export function ReferralInviteSection({ score }: { score: number }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (score < MIN_SCORE || !user?.referralCode) return null;
  const link = referralSignupUrl(user.referralCode);

  const onWhatsApp = () => {
    const text = `I just scored ${score}/100 on a HireStepX AI mock interview. Sign up with my link and we each get a free practice session: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    captureClientEvent("referral_invite_sent", { surface: "session_report", channel: "whatsapp", score });
  };

  const onCopy = () => {
    try { navigator.clipboard.writeText(link); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    captureClientEvent("referral_invite_sent", { surface: "session_report", channel: "copy", score });
  };

  const btnBase: CSSProperties = {
    fontFamily: f.sans, fontSize: 13, fontWeight: 600,
    padding: "10px 18px", borderRadius: 10, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 8,
  };

  return (
    <section
      aria-label="Invite a friend"
      style={{
        background: t.copperWash,
        border: `1px solid ${t.copperBorder}`,
        borderRadius: 16,
        padding: "22px clamp(18px, 3vw, 28px)",
      }}
    >
      <span style={{ fontFamily: f.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.copper }}>
        Bring a friend
      </span>
      <div style={{ fontFamily: f.serif, fontSize: 22, color: t.coal, marginTop: 6 }}>
        You both get a free session
      </div>
      <div style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, marginTop: 6, lineHeight: 1.55, maxWidth: 560 }}>
        Send your link to someone prepping for interviews. When they sign up, you
        each get a free practice session — credited instantly, no purchase needed.
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" onClick={onWhatsApp} style={{ ...btnBase, background: t.copper, color: t.white, border: "none" }}>
          Share on WhatsApp
        </button>
        <button type="button" onClick={onCopy} style={{ ...btnBase, background: "transparent", color: t.copper, border: `1px solid ${t.copperBorder}` }}>
          {copied ? "Link copied!" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
