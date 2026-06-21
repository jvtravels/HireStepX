/* Post-report referral CTA — Plan 1 "moment of delight" placement.
 *
 * Surfaces only after a genuinely good result (score >= threshold) and only
 * when the viewer has a referral code. Self-contained: pulls the code from
 * AuthContext and shares the *attributed* signup link so the loop credits both
 * sides (see referral.ts). Renders nothing when it shouldn't show, so the
 * parent can drop it in unconditionally.
 *
 * 2026-06-21: Added LinkedIn share button next to WhatsApp. Uses the public
 * share URL (shareUrl prop) when available so the LinkedIn post links to the
 * candidate's actual report rather than the referral signup page. Falls back
 * to the referral link when shareUrl is absent. */

import { useState, type CSSProperties } from "react";
import { t, f, brand } from "../tokens";
import { useAuth, referralSignupUrl } from "../../AuthContext";
import { captureClientEvent } from "../../posthogClient";

/** Show the invite only when the candidate just did well — a weak result is
 *  the wrong moment to ask for a share. Matches the onboarding 70 threshold. */
const MIN_SCORE = 70;

export function ReferralInviteSection({
  score,
  shareUrl,
}: {
  score: number;
  /** Optional public share URL for the report. When provided, the LinkedIn
   *  button shares this URL; otherwise it falls back to the referral link. */
  shareUrl?: string;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (score < MIN_SCORE || !user?.referralCode) return null;
  const link = referralSignupUrl(user.referralCode);

  /* The URL surfaced on LinkedIn — prefer the report share URL if the
     caller wired it; otherwise use the referral signup link. */
  const linkedInTarget = shareUrl || link;

  const onWhatsApp = () => {
    const text = `I just scored ${score}/100 on a HireStepX AI mock interview. Sign up with my link and we each get a free practice session: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    captureClientEvent("referral_invite_sent", { surface: "session_report", channel: "whatsapp", score });
  };

  const onLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(linkedInTarget)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    captureClientEvent("referral_invite_sent", { surface: "session_report", channel: "linkedin", score });
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
        {/* LinkedIn share — opens the sharing dialog pre-populated with
            the report URL (or referral link as fallback). Opens in a new
            tab per LinkedIn's recommended share-offsite pattern. */}
        <button
          type="button"
          onClick={onLinkedIn}
          aria-label="Share on LinkedIn"
          style={{ ...btnBase, background: brand.linkedIn, color: t.white, border: "none" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={t.white}
            aria-hidden="true"
          >
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          Share on LinkedIn
        </button>
        <button type="button" onClick={onCopy} style={{ ...btnBase, background: "transparent", color: t.copper, border: `1px solid ${t.copperBorder}` }}>
          {copied ? "Link copied!" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
