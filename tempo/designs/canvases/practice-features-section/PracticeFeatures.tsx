/**
 * PracticeFeatures — "What practice alone never shows you." section
 *
 * Audit fixes applied (all 8 dimensions):
 *  - Sub-copy rewritten — no brand name, pure tension
 *  - Card order changed: "basically" → "lost the room" → ₹2L (full, dark hero)
 *    → "vague answer" → "question paper"
 *  - ₹2L promoted to full-width dark card — highest stakes earns the slot
 *  - Resume card reframed to fit the "never shows you" premise
 *  - All card bodies tightened / rewritten
 *  - Card h3: 20px → 26px
 *  - Bottom padding added to cards
 *  - Gap: 16 → 24px
 *  - Hover shadow on all cards
 *  - CTA + reassurance line at section bottom
 */

import React, { useState } from "react";

/* ── Design tokens ── */
const CREAM   = "#FAF7F0";
const COAL    = "#1A1510";
const COPPER  = "#B45309";
const MUTED   = "#6B7280";
const WHITE   = "#FFFFFF";
const BORDER  = "#E8E3D8";
const TINTED  = "#FDF8F2"; /* slightly warmer white for featured half-cards */

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS  = '"Satoshi", "Inter", system-ui, sans-serif';

const FONT_IMPORTS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');
`;

/* ── Card data ── */
interface CardData {
  heading: React.ReactNode;
  body: string;
  span: "half" | "full";
  dark?: boolean;   /* coal background — used for the ₹2L hero card */
  tinted?: boolean; /* warm-white — used for the top two featured cards */
}

/*
 * Card order by emotional arc:
 *  1. "basically" — most relatable, instant self-recognition
 *  2. Lost the room — dread, makes you want to know more
 *  3. ₹2L left on table — highest financial stakes, earns full-width dark slot
 *  4. Vague answer → harder — pressure & consequence
 *  5. Resume is question paper — personalization reassurance, ends on warmth
 */
const CARDS: CardData[] = [
  {
    heading: (
      <>
        You said{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>&ldquo;basically&rdquo;</em>{" "}
        9 times. The room heard uncertainty.
      </>
    ),
    body: "We catch every filler word and show the sharper version right beside it — so next time, you hear yourself before they do.",
    span: "half",
    tinted: true,
  },
  {
    heading: (
      <>
        The exact answer{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>that lost the room.</em>
      </>
    ),
    body: "Where the interviewer switched off and what you said right before. Not a guess — a timestamp.",
    span: "half",
    tinted: true,
  },
  {
    heading: (
      <>
        You left{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>₹2L on the table.</em>{" "}
        Practice changing that.
      </>
    ),
    body: "Counter-offer. Anchor high. Hold the silence until HR moves. Most candidates never rehearse this — and it costs them every time.",
    span: "full",
    dark: true,
  },
  {
    heading: (
      <>
        Vague answer?{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>It asks again.</em>{" "}
        Harder.
      </>
    ),
    body: "Every follow-up comes from what you just said. No script. No mercy.",
    span: "half",
  },
  {
    heading: (
      <>
        Your resume is the{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>question paper.</em>
      </>
    ),
    body: "Every gap, project, and career move becomes a question. We pull directly from your experience so nothing catches you off guard.",
    span: "half",
  },
];

/* ── Single card ── */
function FeatureCard({ heading, body, span, dark, tinted }: CardData) {
  const [hovered, setHovered] = useState(false);

  const bg   = dark ? COAL : tinted ? TINTED : WHITE;
  const clr  = dark ? "#F5F0E8" : COAL;
  const muted = dark ? "rgba(245,240,232,0.55)" : MUTED;
  const bdr  = dark ? "transparent" : BORDER;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: span === "full" ? "1 / -1" : undefined,
        background: bg,
        border: `1px solid ${bdr}`,
        borderRadius: 20,
        padding: span === "full" ? "56px 64px" : "40px 40px 36px",
        display: "flex",
        flexDirection: span === "full" ? "row" : "column",
        alignItems: span === "full" ? "center" : undefined,
        justifyContent: span === "full" ? "space-between" : undefined,
        gap: span === "full" ? 48 : 16,
        minHeight: span === "full" ? "auto" : 280,
        boxShadow: hovered
          ? "0 12px 40px -12px rgba(26,21,16,0.14)"
          : "0 1px 3px rgba(26,21,16,0.05)",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
        transform: hovered && !dark ? "translateY(-2px)" : "none",
        cursor: "default",
      }}
    >
      {/* Text block */}
      <div style={{ flex: span === "full" ? "0 0 52%" : undefined }}>
        <h3
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: span === "full" ? 36 : 26,
            fontWeight: 400,
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
            color: clr,
          }}
        >
          {heading}
        </h3>
        <p
          style={{
            margin: "14px 0 0",
            fontFamily: SANS,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.65,
            color: muted,
            maxWidth: span === "full" ? 440 : "100%",
          }}
        >
          {body}
        </p>
      </div>

      {/* Media placeholder — right side on full-width, bottom on half */}
      <div
        style={{
          flex: span === "full" ? "0 0 40%" : undefined,
          height: span === "full" ? 180 : 120,
          borderRadius: 12,
          background: dark
            ? "rgba(255,255,255,0.06)"
            : "rgba(26,21,16,0.04)",
          border: `1.5px dashed ${dark ? "rgba(255,255,255,0.12)" : BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: span === "full" ? 0 : "auto",
        }}
      >
        <span style={{ fontFamily: SANS, fontSize: 11, color: dark ? "rgba(255,255,255,0.2)" : "rgba(26,21,16,0.18)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          media
        </span>
      </div>
    </div>
  );
}

/* ── Section ── */
export function PracticeFeatures() {
  return (
    <div
      style={{
        background: CREAM,
        width: "100%",
        padding: "96px 64px 80px",
        boxSizing: "border-box",
      }}
    >
      <style>{FONT_IMPORTS}</style>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 72 }}>
        <h2
          style={{
            margin: "0 auto",
            fontFamily: SERIF,
            fontSize: 68,
            fontWeight: 400,
            lineHeight: 1.08,
            letterSpacing: "-0.025em",
            color: COAL,
          }}
        >
          What practice alone{" "}
          <em style={{ fontStyle: "italic", color: COPPER }}>never shows you.</em>
        </h2>
        <p
          style={{
            margin: "22px auto 0",
            maxWidth: 520,
            fontFamily: SANS,
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.65,
            color: MUTED,
          }}
        >
          You can grind answers for weeks and still not know you said
          &ldquo;basically&rdquo; nine times, lost the room at question three,
          or left ₹2L untouched. These are the things only a real session reveals.
        </p>
      </div>

      {/* Card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        {CARDS.map((card, i) => (
          <FeatureCard key={i} {...card} />
        ))}
      </div>

      {/* CTA — release the tension the cards built */}
      <div style={{ textAlign: "center", marginTop: 64 }}>
        <a
          href="/signup"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: SANS,
            fontSize: 15,
            fontWeight: 600,
            color: WHITE,
            background: COAL,
            padding: "15px 32px",
            borderRadius: 999,
            textDecoration: "none",
            letterSpacing: "-0.01em",
            boxShadow: "0 1px 3px rgba(26,21,16,0.12), 0 6px 20px -6px rgba(26,21,16,0.22)",
          }}
        >
          See your blind spots in session one <span style={{ fontSize: 17 }}>→</span>
        </a>
        <p style={{ marginTop: 12, fontFamily: SANS, fontSize: 13, color: MUTED }}>
          Free to start · no card required
        </p>
      </div>
    </div>
  );
}

export default PracticeFeatures;
