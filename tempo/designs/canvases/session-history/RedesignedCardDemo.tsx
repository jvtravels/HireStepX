"use client";
import React from "react";

/* HireStepX palette — mirrors SessionHistoryDesign hirestepx theme.
   Applied as CSS vars on the root div so all tok.* refs resolve. */
const THEME_VARS: React.CSSProperties = {
  "--hsx-cream":        "#FAF7F0",
  "--hsx-cream-soft":   "#F4EFE3",
  "--hsx-white":        "#FFFFFF",
  "--hsx-coal":         "#0E0C08",
  "--hsx-ink":          "#3E3A6E",
  "--hsx-ink-soft":     "#6E6759",
  "--hsx-ink-faint":    "#7A7263",
  "--hsx-accent":       "#312E81",
  "--hsx-warm":         "#B45309",
  "--hsx-warm-soft":    "rgba(180,83,9,0.10)",
  "--hsx-warm-tint":    "#F4E5D8",
  "--hsx-success":      "#15803D",
  "--hsx-success-soft": "rgba(21,128,61,0.08)",
  "--hsx-error":        "#B91C1C",
  "--hsx-line":         "#EBE5D2",
  "--hsx-line-strong":  "#D6CDB5",
  "--hsx-font-serif":   "'Instrument Serif', Georgia, serif",
  "--hsx-font-ui":      "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  "--hsx-font-mono":    "'JetBrains Mono', monospace",
} as React.CSSProperties;

const tok = {
  cream:       "var(--hsx-cream)",
  creamSoft:   "var(--hsx-cream-soft)",
  white:       "var(--hsx-white)",
  coal:        "var(--hsx-coal)",
  inkSoft:     "var(--hsx-ink-soft)",
  inkFaint:    "var(--hsx-ink-faint)",
  accent:      "var(--hsx-accent)",
  copper:      "var(--hsx-warm)",
  copperSoft:  "var(--hsx-warm-soft)",
  copperTint:  "var(--hsx-warm-tint)",
  success:     "var(--hsx-success)",
  successSoft: "var(--hsx-success-soft)",
  error:       "var(--hsx-error)",
  line:        "var(--hsx-line)",
  lineStrong:  "var(--hsx-line-strong)",
};

const fonts = {
  serif: "var(--hsx-font-serif)",
  ui:    "var(--hsx-font-ui)",
  mono:  "var(--hsx-font-mono)",
};

const radii = { card: 14, btn: 10, chip: 6, pill: 999 } as const;

/* Score bands — same thresholds as the main design file. */
type Band = "strong" | "solid" | "mixed" | "below";
const bandOf = (n: number): Band =>
  n >= 85 ? "strong" : n >= 75 ? "solid" : n >= 65 ? "mixed" : "below";

const BAND_LABEL: Record<Band, string> = {
  strong: "Strong", solid: "Solid", mixed: "Mixed", below: "Below target",
};

const bandColor = (n: number) => {
  const b = bandOf(n);
  return b === "strong" || b === "solid" ? tok.success
       : b === "mixed" ? tok.copper
       : tok.error;
};

const bandBg = (n: number) => {
  const b = bandOf(n);
  return b === "strong" || b === "solid" ? "rgba(21,128,61,0.07)"
       : b === "mixed" ? "rgba(180,83,9,0.07)"
       : "rgba(185,28,28,0.07)";
};

/* Type taxonomy — distinct OKLCH hue per session type.
   Same palette as SessionHistoryDesign so chips match. */
type TypeName = "Behavioral" | "System Design" | "Salary Neg." | "Tech Screen" | "Hiring Mgr";
const TYPE_HUE: Record<TypeName, { swatch: string; dot: string }> = {
  "Behavioral":    { swatch: "oklch(0.92 0.045 60)",  dot: "oklch(0.52 0.09 60)"  },
  "System Design": { swatch: "oklch(0.92 0.045 265)", dot: "oklch(0.42 0.09 265)" },
  "Salary Neg.":   { swatch: "oklch(0.92 0.045 35)",  dot: "oklch(0.48 0.09 35)"  },
  "Tech Screen":   { swatch: "oklch(0.92 0.045 175)", dot: "oklch(0.44 0.09 175)" },
  "Hiring Mgr":    { swatch: "oklch(0.92 0.045 340)", dot: "oklch(0.46 0.09 340)" },
};
const typeHue = (t: string) =>
  (TYPE_HUE as Record<string, { swatch: string; dot: string } | undefined>)[t]
  ?? { swatch: tok.creamSoft, dot: tok.inkSoft };

/* Pinned mock sessions — deterministic across renders.
   Strength / gap are written in plain candidate language:
   a headline anyone understands, a one-line "what that means",
   and (for the gap) a concrete "try this instead" example. */
type Strength = { headline: string; meaning: string };
type Gap = { headline: string; meaning: string; example: string };
type Session = {
  id: string; type: string; role: string; company: string;
  date: string; duration: string; score: number; delta: number;
  difficulty?: string; questions: number;
  topStrength: Strength; topGap: Gap;
  feedback: string;
  isBest?: boolean;
};

const SESSIONS: Session[] = [
  {
    id: "s1", type: "Behavioral", role: "Senior PM", company: "Razorpay",
    date: "Today, 3:00 PM", duration: "42m", score: 86, delta: +6,
    difficulty: "Hard", questions: 8,
    topStrength: { headline: "Well-structured answers", meaning: "Clear Situation, Action and Result in each story" },
    topGap: { headline: "Add numbers to your results", meaning: "You said \"improved performance\" with no figure", example: "Try: \"cut response time by 40%\"" },
    feedback: "Your answers show strong structure and authentic delivery. Numbers are still vague in the action-and-result part.",
    isBest: true,
  },
  {
    id: "s2", type: "System Design", role: "Staff Engineer", company: "Flipkart",
    date: "Yesterday", duration: "58m", score: 74, delta: -3,
    difficulty: "Hard", questions: 5,
    topStrength: { headline: "Good trade-off reasoning", meaning: "Weighed options at each layer of the design" },
    topGap: { headline: "Show your capacity math", meaning: "Scale estimates were hand-wavy", example: "Try: \"about 5,000 requests/sec at peak\"" },
    feedback: "Strong on design principles. Capacity estimation was hand-wavy. Work through one concrete example per round.",
  },
  {
    id: "s3", type: "Salary Neg.", role: "Engineering Manager", company: "Swiggy",
    date: "2 days ago", duration: "31m", score: 81, delta: +9,
    difficulty: "Medium", questions: 6,
    topStrength: { headline: "Anchored high, stayed calm", meaning: "Held your number when they pushed back" },
    topGap: { headline: "Know your equity terms", meaning: "Vesting and cliff came up unprepared", example: "Try: \"I'd want a 1-year cliff, 4-year vest\"" },
    feedback: "Best negotiation session so far. You held your anchor well. Equity is the gap to close next.",
  },
  {
    id: "s4", type: "Tech Screen", role: "Staff Engineer", company: "PhonePe",
    date: "Last week", duration: "47m", score: 71, delta: +2,
    difficulty: "Medium", questions: 4,
    topStrength: { headline: "Broke the problem down cleanly", meaning: "Clear steps before writing any code" },
    topGap: { headline: "Cover the edge cases", meaning: "Missed error handling in follow-ups", example: "Try: handle empty input and nulls first" },
    feedback: "Solid core approach. The follow-up on edge cases exposed gaps in error handling. Cover that next time.",
  },
  {
    id: "s5", type: "Hiring Mgr", role: "Engineering Manager", company: "Zomato",
    date: "Last week", duration: "36m", score: 76, delta: -1,
    difficulty: "Medium", questions: 7,
    topStrength: { headline: "Strong leadership story", meaning: "Clear vision and team framing" },
    topGap: { headline: "Pin the metric in growth stories", meaning: "Results stayed vague", example: "Try: \"grew the team from 4 to 11\"" },
    feedback: "Strong on leadership presence. Growth stories need tighter numbers. Name the metric before the answer.",
  },
];

/* ScoreRing — 64px circular progress ring.
   Larger than the current 52px so the score numeral reads
   without squinting. Ring + label + delta collapse into one
   self-contained unit. */
function ScoreRing({ score, delta }: { score: number; delta: number }) {
  const color = bandColor(score);
  const bg    = bandBg(score);
  const label = BAND_LABEL[bandOf(score)];
  const r     = 27;
  const circ  = 2 * Math.PI * r;
  const fill  = (score / 100) * circ;
  const isUp   = delta > 0;
  const isFlat = delta === 0;
  const deltaColor = isUp ? tok.success : isFlat ? tok.inkFaint : tok.error;
  const deltaArrow = isUp ? "↑" : isFlat ? "→" : "↓";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
          <circle cx="32" cy="32" r={r} fill="none" stroke={`${color}22`} strokeWidth="3" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke={color} strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: bg, borderRadius: "50%",
        }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 20, fontWeight: 700, color: tok.coal, lineHeight: 1 }}>{score}</span>
          <span style={{ fontFamily: fonts.ui, fontSize: 8, fontWeight: 700, color, letterSpacing: "0.04em", lineHeight: 1, marginTop: 1 }}>{label}</span>
        </div>
      </div>
      {/* Delta beneath the ring — separated so it reads as "change from last time" not part of the score. */}
      <span style={{
        fontFamily: fonts.mono, fontSize: 11, fontWeight: 600,
        color: deltaColor,
        display: "flex", alignItems: "center", gap: 2,
      }}>
        {isFlat ? "" : (isUp ? "+" : "")}{delta} {deltaArrow}
      </span>
    </div>
  );
}

/* SessionCardV2 — the redesigned card. */
function SessionCardV2({ session }: { session: Session }) {
  const [hovered, setHovered] = React.useState(false);
  const hue = typeHue(session.type);
  const eyebrowParts = [
    session.type,
    session.difficulty,
    `${session.questions} Qs`,
    session.duration,
  ].filter(Boolean) as string[];

  return (
    <div
      role="listitem"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        padding: "0",
        borderRadius: radii.card,
        border: `1px solid ${hovered ? tok.lineStrong : tok.line}`,
        background: tok.white,
        cursor: "pointer",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxShadow: hovered ? "0 2px 12px rgba(14,12,8,0.07)" : "none",
        overflow: "hidden",
      }}
    >
      {/* Eyebrow row — type pill + metadata + timestamp */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px",
        borderBottom: `1px solid ${tok.line}`,
        background: tok.creamSoft,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Type swatch dot */}
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: hue.dot, flexShrink: 0,
          }} />
          {eyebrowParts.map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && <span style={{ color: tok.inkFaint, fontSize: 10 }}>·</span>}
              <span style={{
                fontFamily: fonts.ui, fontSize: 10, fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: i === 0 ? tok.inkSoft : tok.inkFaint,
              }}>{p}</span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {session.isBest && (
            <span style={{
              fontFamily: fonts.mono, fontSize: 9, fontWeight: 700,
              letterSpacing: "0.12em", color: tok.copper,
              background: tok.copperTint,
              padding: "2px 7px", borderRadius: radii.pill,
              textTransform: "uppercase",
            }}>PR</span>
          )}
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: tok.inkFaint }}>{session.date}</span>
        </div>
      </div>

      {/* Body — content column on the left, score rail on the right.
          The score centers against the full stack so neither side
          leaves a vertical void. Priority within the column: gap > strength. */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 22, padding: "18px 20px 18px" }}>

        {/* Left column — identity, strength, gap */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Identity */}
          <div style={{
            fontFamily: fonts.ui, fontSize: 17, fontWeight: 600,
            color: tok.coal, lineHeight: 1.25,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {session.role} <span style={{ color: tok.inkSoft, fontWeight: 400 }}>at</span> {session.company}
          </div>

          {/* Strength — one quiet line. Positive reinforcement, not the main event. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ color: tok.success, fontSize: 12, flexShrink: 0 }}>✓</span>
            <span style={{ fontFamily: fonts.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tok.success, flexShrink: 0 }}>
              Did well
            </span>
            <span style={{
              fontFamily: fonts.ui, fontSize: 13, fontWeight: 600, color: tok.coal, lineHeight: 1.35,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {session.topStrength.headline}
            </span>
          </div>

          {/* Gap — the dominant element. Larger headline, tinted block, concrete example. */}
          <div style={{
            display: "flex", gap: 10,
            background: tok.copperSoft, borderRadius: radii.btn,
            padding: "13px 15px",
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: "rgba(180,83,9,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: tok.copper, marginTop: 1, fontWeight: 700,
            }}>↑</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: fonts.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tok.copper, marginBottom: 3 }}>
                Work on next
              </div>
              <div style={{ fontFamily: fonts.ui, fontSize: 15, fontWeight: 700, color: tok.coal, lineHeight: 1.3 }}>
                {session.topGap.headline}
              </div>
              <div style={{ fontFamily: fonts.ui, fontSize: 12.5, color: tok.inkSoft, lineHeight: 1.45, marginTop: 3 }}>
                {session.topGap.meaning}
              </div>
              <div style={{
                display: "inline-block", marginTop: 8,
                fontFamily: fonts.ui, fontSize: 11.5, fontWeight: 500, color: tok.copper,
                background: tok.white, border: `1px solid ${tok.copper}33`,
                borderRadius: radii.chip, padding: "4px 9px", lineHeight: 1.35,
              }}>
                {session.topGap.example}
              </div>
            </div>
          </div>
        </div>

        {/* Score rail — fixed width, vertically centered against the whole column,
            with a hairline separating it from the content. */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          paddingLeft: 22, borderLeft: `1px solid ${tok.line}`,
        }}>
          <ScoreRing score={session.score} delta={session.delta} />
        </div>
      </div>

      {/* Action bar — persistent, both actions discoverable. */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px 14px", marginTop: 0,
        borderTop: `1px solid ${tok.line}`,
      }}>
        <span style={{
          fontFamily: fonts.ui, fontSize: 13, fontWeight: 700, color: tok.accent,
          display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
        }}>
          View full report <span style={{ fontSize: 12 }}>→</span>
        </span>
        <button style={{
          fontFamily: fonts.ui, fontSize: 12, fontWeight: 600,
          color: tok.inkSoft, background: "transparent",
          border: `1px solid ${hovered ? tok.lineStrong : tok.line}`,
          borderRadius: radii.btn, padding: "5px 12px",
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5,
          transition: "border-color 0.15s ease",
        }}>
          <span style={{ fontSize: 11 }}>↻</span> Re-run
        </button>
      </div>
    </div>
  );
}

/* What changed — annotation banner above the list */
function ChangesAnnotation() {
  const items = [
    { glyph: "1", label: "Eyebrow row", detail: "Type · Difficulty · Questions · Duration — full session identity at a glance" },
    { glyph: "2", label: "Role at Company headline", detail: "Promoted from a small badge to the card's primary identity line" },
    { glyph: "3", label: "Score ring 64px + delta", detail: "Ring grows from 52px, delta sits beneath as a trend signal" },
    { glyph: "4", label: "Plain-language feedback", detail: "Coach jargon replaced with everyday words — strength and gap anyone can act on" },
    { glyph: "5", label: "Gap is the hero", detail: "\"Work on next\" gets a tinted block, larger headline, and a concrete example; strength stays one quiet line. The eye lands on the action" },
    { glyph: "6", label: "No redundancy, single tint", detail: "Dropped the coach quote that repeated the panels; only the gap is colored so a long list stays calm" },
    { glyph: "7", label: "Persistent action bar", detail: "\"View full report\" + \"Re-run\" always visible instead of a hover-only button — discoverable on touch and keyboard" },
  ];
  return (
    <div style={{
      marginBottom: 32, padding: "20px 24px",
      background: tok.creamSoft, border: `1px solid ${tok.line}`,
      borderRadius: radii.card,
    }}>
      <div style={{
        fontFamily: fonts.ui, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: tok.copper, marginBottom: 14,
      }}>What changed vs current card</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
        {items.map(it => (
          <div key={it.glyph} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
              background: tok.coal, color: tok.cream,
              fontFamily: fonts.mono, fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{it.glyph}</span>
            <div>
              <span style={{ fontFamily: fonts.ui, fontSize: 12, fontWeight: 600, color: tok.coal }}>{it.label}</span>
              <span style={{ fontFamily: fonts.ui, fontSize: 11, color: tok.inkSoft }}> — {it.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Date group header — matches the serif italic style from the main canvas. */
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 15, color: tok.accent, fontWeight: 500 }}>{label}</span>
      <span style={{ height: 1, background: tok.line, flex: 1 }} />
      <span style={{ fontFamily: fonts.mono, fontSize: 11, color: tok.inkFaint }}>{count}</span>
    </div>
  );
}

const GROUPS: { label: string; ids: string[] }[] = [
  { label: "Today",     ids: ["s1"] },
  { label: "Yesterday", ids: ["s2"] },
  { label: "This week", ids: ["s3"] },
  { label: "Earlier",   ids: ["s4", "s5"] },
];

export default function RedesignedCardDemo() {
  return (
    <div style={{ ...THEME_VARS, background: tok.cream, color: tok.coal, fontFamily: fonts.ui, minHeight: "100vh" }}>
      <div style={{ padding: "48px 56px", maxWidth: 960, margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: tok.copper, marginBottom: 8 }}>
            Design proposal
          </div>
          <h1 style={{ fontFamily: fonts.serif, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", margin: 0, color: tok.coal, lineHeight: 1.1 }}>
            Redesigned session card
          </h1>
          <p style={{ fontFamily: fonts.ui, fontSize: 14, color: tok.inkSoft, marginTop: 10, lineHeight: 1.6, maxWidth: 560 }}>
            Identity first, performance second, feedback third — the hierarchy that makes learning logs scannable and actionable.
          </p>
        </div>

        <ChangesAnnotation />

        {/* Session list with groups */}
        <div>
          {GROUPS.map(g => {
            const sessions = SESSIONS.filter(s => g.ids.includes(s.id));
            if (!sessions.length) return null;
            return (
              <section key={g.label} style={{ marginBottom: 28 }}>
                <GroupHeader label={g.label} count={sessions.length} />
                <div role="list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sessions.map(s => <SessionCardV2 key={s.id} session={s} />)}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
