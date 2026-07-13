/* Post-session testimonial nudge — surfaces after session 3+ with score >= 75.
 * Low-friction: three quick share channels, no form, no modal.
 * Fires `testimonial_nudge_shown` once on mount; `testimonial_nudge_clicked`
 * per channel. Renders nothing when conditions aren't met. */

import { useEffect, type CSSProperties } from "react";
import { t, f } from "../tokens";
import { captureClientEvent } from "../../posthogClient";

const CHANNELS = [
  {
    key: "linkedin",
    label: "Share on LinkedIn",
    icon: "in",
    bg: "#0a66c2",
    buildUrl: (score: number, role: string) => {
      const text = encodeURIComponent(
        `Just scored ${score}/100 on a ${role} mock interview on @HireStepX — the AI actually caught the gaps I didn't notice myself. Really useful if you're prepping for Indian tech interviews. hirestepx.com`
      );
      return `https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fhirestepx.com%2F&summary=${text}`;
    },
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: "WA",
    bg: "#25d366",
    buildUrl: (score: number, role: string) => {
      const text = encodeURIComponent(
        `Got ${score}/100 on a ${role} mock interview on HireStepX — the AI voice feedback actually helps. Worth trying: https://hirestepx.com`
      );
      return `https://wa.me/?text=${text}`;
    },
  },
  {
    key: "twitter",
    label: "Post on X",
    icon: "𝕏",
    bg: "#000",
    buildUrl: (score: number, role: string) => {
      const text = encodeURIComponent(
        `Scored ${score}/100 on a ${role} AI mock interview on @HireStepX. The STAR breakdown is genuinely useful for interview prep. hirestepx.com`
      );
      return `https://twitter.com/intent/tweet?text=${text}`;
    },
  },
] as const;

const iconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: "50%",
  fontSize: 10,
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0,
  letterSpacing: 0,
};

export function TestimonialNudge({
  score,
  priorSessionCount,
  role,
}: {
  score: number;
  priorSessionCount?: number;
  role?: string;
}) {
  const shouldShow = score >= 75 && (priorSessionCount ?? 0) >= 2;

  useEffect(() => {
    if (shouldShow) {
      captureClientEvent("testimonial_nudge_shown", { score, priorSessionCount });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!shouldShow) return null;

  const displayRole = role ?? "mock interview";

  return (
    <div
      role="complementary"
      aria-label="Share your progress"
      style={{
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "22px 24px",
        background: t.cream,
        marginTop: 4,
      }}
    >
      <p
        style={{
          fontFamily: f.sans,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: t.copper,
          margin: "0 0 8px",
        }}
      >
        You're in the top range
      </p>
      <p
        style={{
          fontFamily: f.sans,
          fontSize: 15,
          fontWeight: 600,
          color: t.coal,
          margin: "0 0 4px",
          lineHeight: 1.4,
        }}
      >
        {score}/100 after {priorSessionCount! + 1} sessions — tell someone
      </p>
      <p
        style={{
          fontFamily: f.sans,
          fontSize: 13,
          color: t.inkSoft,
          margin: "0 0 18px",
          lineHeight: 1.55,
        }}
      >
        Sharing takes 10 seconds and helps other candidates find their way here too.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {CHANNELS.map((ch) => (
          <a
            key={ch.key}
            href={ch.buildUrl(score, displayRole)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              captureClientEvent("testimonial_nudge_clicked", {
                channel: ch.key,
                score,
                priorSessionCount,
              })
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 600,
              color: t.coal,
              textDecoration: "none",
              border: `1px solid ${t.line}`,
              borderRadius: 8,
              padding: "8px 14px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <span style={{ ...iconStyle, background: ch.bg }}>{ch.icon}</span>
            {ch.label}
          </a>
        ))}
      </div>
    </div>
  );
}
