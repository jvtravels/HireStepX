"use client";
import React from "react";

/* ── Brand tokens ─────────────────────────────────────────────────── */
const CREAM    = "#FAF7F0";
const COAL     = "#0E0C08";
const COPPER   = "#B45309";
const INK      = "#6E6759";
const LINE     = "#EBE5D2";
const WHITE    = "#FFFFFF";
const MUTED_TX = "#A39C8B";
const SERIF    = '"Instrument Serif", Georgia, serif';
const SANS     = '"Satoshi", "Inter", system-ui, sans-serif';

/* Highlighted column shades */
const COL_HL_A = "#B45309"; /* odd rows  */
const COL_HL_B = "#A34A08"; /* even rows — slightly darker for rhythm */

/* ── Data ─────────────────────────────────────────────────────────── */
type RowVal = true | false; /* true = ✓, false = – */

const ROWS: { label: string; senior: RowVal; ai: RowVal; hsx: RowVal }[] = [
  { label: "Scores every answer",           senior: false, ai: false, hsx: true  },
  { label: "Voice in, voice out",           senior: true,  ai: false, hsx: true  },
  { label: "Target company's round format", senior: false, ai: false, hsx: true  },
  { label: "Full STAR report after",        senior: false, ai: false, hsx: true  },
  { label: "Tracks if you're improving",   senior: false, ai: false, hsx: true  },
];

/* ── Icons ────────────────────────────────────────────────────────── */
function IconCheck({ onDark }: { onDark?: boolean }) {
  const ring  = onDark ? "rgba(255,255,255,0.22)" : "transparent";
  const stroke = onDark ? WHITE : MUTED_TX;
  const circ  = onDark ? "none" : LINE;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" fill={ring} stroke={circ} strokeWidth={onDark ? 0 : 1.5} />
      <path d="M8 14.5l4 4 8-8.5" stroke={stroke} strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDash({ onDark }: { onDark?: boolean }) {
  const circ  = onDark ? "rgba(255,255,255,0.15)" : LINE;
  const line  = onDark ? "rgba(255,255,255,0.35)" : LINE;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke={circ} strokeWidth="1.5" />
      <path d="M9 14h10" stroke={line} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Desktop comparison (1440 × 900) ─────────────────────────────── */
export function ComparisonDesktop() {
  const LABEL_W = 380;
  const COL_W   = 140;
  const HSX_W   = 170;
  const ROW_H   = 66;
  const HDR_H   = 76;

  return (
    <div style={{
      width: 1440, minHeight: 900,
      background: CREAM,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "80px 0 100px",
      fontFamily: SANS,
    }}>

      {/* ── Eyebrow ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 22,
        fontFamily: SANS, fontSize: 11, fontWeight: 600,
        letterSpacing: "0.13em", textTransform: "uppercase", color: MUTED_TX,
      }}>
        <span>08</span>
        <span style={{ width: 20, height: 1, background: LINE }} />
        <span>Why HireStepX</span>
        <span style={{ width: 20, height: 1, background: LINE }} />
        <span>vs the alternatives</span>
      </div>

      {/* ── Headline ── */}
      <h2 style={{
        fontFamily: SERIF, fontSize: 58, fontWeight: 400,
        color: COAL, margin: "0 0 18px",
        letterSpacing: "-0.02em", lineHeight: 1.1, textAlign: "center",
      }}>
        Practice that can't score you{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>isn't practice.</em>
      </h2>

      {/* ── Subheading ── */}
      <p style={{
        fontFamily: SANS, fontSize: 17, lineHeight: 1.65,
        color: INK, textAlign: "center",
        maxWidth: 540, margin: "0 0 56px",
      }}>
        A senior's mock is hard to arrange. An AI session agrees with everything.
        Neither tells you where you lost the HR panel.
      </p>

      {/* ── Table card ── */}
      <div style={{
        background: WHITE,
        borderRadius: 20,
        border: `1px solid ${LINE}`,
        boxShadow: "0 2px 24px rgba(14,12,8,0.06)",
        overflow: "hidden",
        width: LABEL_W + COL_W + COL_W + HSX_W,
      }}>

        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${LABEL_W}px ${COL_W}px ${COL_W}px ${HSX_W}px`,
          height: HDR_H,
          borderBottom: `1px solid ${LINE}`,
        }}>
          {/* Empty label */}
          <div />

          {/* Senior */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: SANS, fontSize: 12, fontWeight: 500,
            color: MUTED_TX, textAlign: "center", lineHeight: 1.4,
            padding: "0 8px",
          }}>
            Mock with<br />a senior
          </div>

          {/* AI */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: SANS, fontSize: 12, fontWeight: 500,
            color: MUTED_TX, textAlign: "center", lineHeight: 1.4,
            padding: "0 8px",
          }}>
            Any AI<br />chatbot
          </div>

          {/* HireStepX header */}
          <div style={{
            background: COL_HL_A,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: WHITE, fontFamily: SANS,
            }}>H</div>
            <span style={{
              fontFamily: SANS, fontSize: 12, fontWeight: 700,
              color: WHITE, letterSpacing: "0.04em",
            }}>HireStepX</span>
          </div>
        </div>

        {/* Data rows */}
        {ROWS.map(({ label, senior, ai, hsx }, i) => {
          const isLast = i === ROWS.length - 1;
          const rowBg  = i % 2 === 0 ? WHITE : "#FDFBF7";
          const hsxBg  = i % 2 === 0 ? COL_HL_A : COL_HL_B;

          return (
            <div
              key={label}
              style={{
                display: "grid",
                gridTemplateColumns: `${LABEL_W}px ${COL_W}px ${COL_W}px ${HSX_W}px`,
                height: ROW_H,
                background: rowBg,
                borderBottom: isLast ? "none" : `1px solid ${LINE}`,
              }}
            >
              {/* Label */}
              <div style={{
                padding: "0 32px",
                display: "flex", alignItems: "center",
                fontFamily: SANS, fontSize: 15, color: COAL, fontWeight: 400,
              }}>
                {label}
              </div>

              {/* Senior */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {senior ? <IconCheck /> : <IconDash />}
              </div>

              {/* AI */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ai ? <IconCheck /> : <IconDash />}
              </div>

              {/* HireStepX */}
              <div style={{
                background: hsxBg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {hsx ? <IconCheck onDark /> : <IconDash onDark />}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CTA ── */}
      <div style={{ marginTop: 44 }}>
        <a
          href="/signup"
          style={{
            fontFamily: SANS, fontSize: 15, fontWeight: 600,
            color: WHITE, background: COAL,
            padding: "14px 30px", borderRadius: 999,
            textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 8,
            letterSpacing: "-0.01em",
          }}
        >
          Start free, no card needed
          <span aria-hidden style={{ fontSize: 16 }}>→</span>
        </a>
      </div>
    </div>
  );
}

/* ── Mobile comparison (390 × 720) ───────────────────────────────── */
export function ComparisonMobile() {
  const features = [
    "Scores every answer",
    "Target company's round format",
    "Full STAR report after",
    "Tracks if you're improving",
  ];

  return (
    <div style={{
      width: 390, minHeight: 720,
      background: CREAM,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "56px 24px 72px",
      fontFamily: SANS,
    }}>

      {/* Eyebrow */}
      <div style={{
        fontFamily: SANS, fontSize: 11, fontWeight: 600,
        letterSpacing: "0.13em", textTransform: "uppercase",
        color: MUTED_TX, marginBottom: 18,
      }}>
        08 · Why HireStepX
      </div>

      {/* Headline */}
      <h2 style={{
        fontFamily: SERIF, fontSize: 32, fontWeight: 400,
        color: COAL, margin: "0 0 14px",
        letterSpacing: "-0.02em", lineHeight: 1.15, textAlign: "center",
      }}>
        Practice that can't score you{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>isn't practice.</em>
      </h2>

      {/* Subhead */}
      <p style={{
        fontFamily: SANS, fontSize: 15, lineHeight: 1.6,
        color: INK, textAlign: "center", margin: "0 0 36px",
      }}>
        A senior's mock is hard to arrange. An AI session agrees with everything.
        Neither tells you where you lost the HR panel.
      </p>

      {/* Mobile: only HireStepX wins as feature chips */}
      <div style={{
        width: "100%",
        background: WHITE,
        borderRadius: 16,
        border: `1px solid ${LINE}`,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: COL_HL_A,
          padding: "18px 24px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: WHITE,
          }}>H</div>
          <span style={{
            fontFamily: SANS, fontSize: 14, fontWeight: 700, color: WHITE,
          }}>Only HireStepX does all of this</span>
        </div>

        {/* Feature list */}
        {features.map((f, i) => (
          <div
            key={f}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px 24px",
              borderTop: `1px solid ${LINE}`,
            }}
          >
            <IconCheck />
            <span style={{
              fontFamily: SANS, fontSize: 14, color: COAL, fontWeight: 400,
            }}>{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a
        href="/signup"
        style={{
          marginTop: 32,
          fontFamily: SANS, fontSize: 15, fontWeight: 600,
          color: WHITE, background: COAL,
          padding: "14px 28px", borderRadius: 999,
          textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 8,
          width: "100%", justifyContent: "center",
        }}
      >
        Start free, no card needed →
      </a>
    </div>
  );
}
