import { ImageResponse } from "next/og";

/* Dynamic Open Graph image for the homepage.
 * Replaces the static /public/og-preview.png with an editorial OG card
 * generated on demand at the edge — matches the marketing-v2 cream/coal
 * tokens and keeps the wordmark + value-prop tight.
 *
 * Per-route OG: drop an identical `opengraph-image.tsx` into a sub-folder
 * under app/(marketing)/... and customise the headline. Next.js auto-wires
 * it as that route's OG image. */

export const runtime = "edge";
export const alt = "HireStepX — practice the interview, not the panic.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COAL = "#0E0C08";
const CREAM = "#FAF7F0";
const COPPER = "#B45309";
const INK_SOFT = "#6E6759";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: CREAM,
          backgroundImage:
            "radial-gradient(ellipse 65% 55% at 85% 15%, rgba(180, 83, 9, 0.10) 0%, transparent 65%)",
        }}
      >
        {/* Wordmark + eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: COAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: CREAM,
              fontFamily: "serif",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            H
          </div>
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: COAL,
              letterSpacing: "-0.01em",
            }}
          >
            HireStepX
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontFamily: "serif",
              fontSize: 92,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              color: COAL,
              maxWidth: 920,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            Practice the interview.&nbsp;
            <span style={{ fontStyle: "italic", color: COPPER }}>
              Not the panic.
            </span>
          </div>
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: 28,
              lineHeight: 1.4,
              color: INK_SOFT,
              maxWidth: 880,
            }}
          >
            AI mock interviews for India. Voice in, scored answers out. Free to start.
          </div>
        </div>

        {/* Footer band */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: `1px solid #EBE5D2`,
            fontFamily: "sans-serif",
            fontSize: 20,
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex", gap: 20 }}>
            <span>hirestepx.com</span>
            <span style={{ color: "#A39C8B" }}>·</span>
            <span>STAR scoring</span>
            <span style={{ color: "#A39C8B" }}>·</span>
            <span>50+ companies</span>
          </div>
          <div
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              background: COAL,
              color: CREAM,
              fontWeight: 600,
              fontSize: 18,
              display: "flex",
            }}
          >
            Start free
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
