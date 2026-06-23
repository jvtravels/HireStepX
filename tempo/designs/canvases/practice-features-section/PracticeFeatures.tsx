/**
 * PracticeFeatures — "What practice alone never shows you." section
 *
 * Layout: heading + subtext, then 5 cards:
 *   Row 1: [card A] [card B]   — 50/50
 *   Row 2: [card C]            — full width
 *   Row 3: [card D] [card E]   — 50/50
 *
 * Placeholder empty space inside each card will hold media / screenshots later.
 */

import React from "react";

/* ── Design tokens ── */
const CREAM  = "#FAF7F0";
const COAL   = "#1A1510";
const COPPER = "#B45309";
const MUTED  = "#6B7280";
const WHITE  = "#FFFFFF";
const BORDER = "#E8E3D8";

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
}

const CARDS: CardData[] = [
  {
    heading: (
      <>
        Vague answer?{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>It asks again.</em>{" "}
        Harder.
      </>
    ),
    body: "Every follow-up is built from what you just said, not a pre-written script.",
    span: "half",
  },
  {
    heading: (
      <>
        You left{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>₹2L on the table.</em>{" "}
        Practice changing that.
      </>
    ),
    body: "The only mode that trains you to counter-offer, anchor high, and hold the silence until HR moves.",
    span: "half",
  },
  {
    heading: (
      <>
        Your resume is the{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>question paper.</em>
      </>
    ),
    body: "Upload once. Every session drills your actual projects.",
    span: "full",
  },
  {
    heading: (
      <>
        You said{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>&ldquo;basically&rdquo;</em>{" "}
        9 times. The room heard uncertainty.
      </>
    ),
    body: "We flag every hedge and show the crisp rewrite beside it.",
    span: "half",
  },
  {
    heading: (
      <>
        The exact answer{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>that lost the room.</em>
      </>
    ),
    body: "Where the interviewer switched off and what you said right before.",
    span: "half",
  },
];

/* ── Single card ── */
function FeatureCard({ heading, body, span }: CardData) {
  return (
    <div
      style={{
        gridColumn: span === "full" ? "1 / -1" : undefined,
        background: WHITE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "40px 48px 0",
        display: "flex",
        flexDirection: "column",
        minHeight: 320,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontSize: 20,
          fontWeight: 400,
          lineHeight: 1.35,
          letterSpacing: "-0.01em",
          color: COAL,
          textAlign: span === "full" ? "center" : "left",
        }}
      >
        {heading}
      </h3>
      <p
        style={{
          margin: "12px 0 0",
          fontFamily: SANS,
          fontSize: 13.5,
          fontWeight: 400,
          lineHeight: 1.6,
          color: MUTED,
          textAlign: span === "full" ? "center" : "left",
          maxWidth: span === "full" ? 440 : "100%",
          alignSelf: span === "full" ? "center" : undefined,
        }}
      >
        {body}
      </p>
      {/* empty space — reserved for future screenshot / media */}
      <div style={{ flex: 1 }} />
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
        padding: "80px 64px",
        boxSizing: "border-box",
      }}
    >
      <style>{FONT_IMPORTS}</style>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <h2
          style={{
            margin: "0 auto",
            fontFamily: SERIF,
            fontSize: 60,
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: COAL,
          }}
        >
          What practice alone{" "}
          <em style={{ fontStyle: "italic", color: COPPER }}>never shows you.</em>
        </h2>
        <p
          style={{
            margin: "20px auto 0",
            maxWidth: 560,
            fontFamily: SANS,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.65,
            color: MUTED,
          }}
        >
          HireStepX gives you personalized interview reports that show how you
          performed, where you lost impact, and what to practice next.
        </p>
      </div>

      {/* Card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        {CARDS.map((card, i) => (
          <FeatureCard key={i} {...card} />
        ))}
      </div>
    </div>
  );
}

export default PracticeFeatures;
