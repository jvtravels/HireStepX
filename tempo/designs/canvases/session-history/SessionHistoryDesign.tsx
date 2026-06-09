/* HireStepX — Session History design prototype (UI-only).
   Fresh design for the Sessions tab. Three modes:
   - "list"   : the tab landing — all sessions, filters, KPI strip
   - "detail" : drilled into one session — Q-by-Q transcript + scores
   - "report" : shareable result card — verdict, radar, model answer
   - "empty"  : first-time state
   Uses brand tokens from CanvasProviders (cream/coal/indigo/copper).
   All data is mock — no API calls, no providers. */
"use client";
import React from "react";

type Variant = "list" | "detail" | "report" | "empty";

const tok = {
  cream: "#FAF7F0",
  creamSoft: "#F4EFE3",
  white: "#FFFFFF",
  coal: "#0E0C08",
  ink: "#3E3A6E",
  inkSoft: "#6E6759",
  inkFaint: "#8A8270",
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  copper: "#B45309",
  copperSoft: "rgba(180,83,9,0.10)",
  copper100: "#F4E5D8",
  success: "#15803D",
  successSoft: "#DCFCE7",
  error: "#B91C1C",
  errorSoft: "#FEE2E2",
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
};

const fonts = {
  serif: "'Caslon', 'Source Serif Pro', Georgia, serif",
  ui: "'Satoshi', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

/* View-heading scale. Four views previously wore four different h1
   sizes (38 / 34 / 36 / 40) with no semantic reason. Now there are
   two ranks:
     hero (40)     — only the Report view, the framed-artifact register
     canonical(32) — every other view's h1
   Detail used to be 34; demoted to 32 so its real hero (the 72pt
   score numeral) is unambiguously the focal point. */
const heading = {
  hero: { fontFamily: fonts.serif, fontSize: 40, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 } as React.CSSProperties,
  canonical: { fontFamily: fonts.serif, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 } as React.CSSProperties,
};

/* Radii are tokenised so cards/buttons/chips/pills don't drift apart.
   Cards 14, buttons 10, chips 6, pills 999. One sweep replaced the
   handful of ad-hoc literals. */
const radii = {
  card: 14,     // list rows and surfaces inside the list view
  cardLg: 16,   // report-view tiles, framed-artifact register
  hero: 20,     // the verdict hero card on the report view
  glyph: 8,     // small icon-sized chips (sidebar logo, key caps)
  btn: 10,
  chip: 6,
  pill: 999,
} as const;

/* Single source of truth for score bands. Used by ScoreRing, list-row
   signal, hero label, and per-question tags so the same number can't
   render green-ring next to a "Solid" label. Bands:
     Strong   ≥ 85
     Solid    75-84
     Mixed    65-74
     Below     < 65
   Ring/Q-tag color collapses to a 3-tier categorical scale (success /
   copper / error) because two adjacent bands share a verdict
   direction. */
type Band = "strong" | "solid" | "mixed" | "below";
const bandOf = (score: number): Band =>
  score >= 85 ? "strong" : score >= 75 ? "solid" : score >= 65 ? "mixed" : "below";
const BAND_LABEL: Record<Band, string> = {
  strong: "Strong", solid: "Solid", mixed: "Mixed", below: "Below target",
};

/* Type taxonomy palette. Five OKLCH neutrals tinted toward distinct
   hue families so a quick scan separates Behavioral from System Design
   without reading the label. L≈92 keeps every chip readable against
   coal text; C≈0.045 keeps the strip from yelling. The same chip is
   used in two places only: active filter pill fill, and the 6px
   leading swatch in each row's type line. Anything more would slide
   into Full-palette territory and break the Restrained register.
   `swatch` is the tint fill; `ink` is the matching dark for the active
   filter chip label. */
type TypeName = "Behavioral" | "System Design" | "Salary Neg." | "Tech Screen" | "Hiring Mgr";
const TYPE_HUE: Record<TypeName, { swatch: string; ink: string }> = {
  "Behavioral":    { swatch: "oklch(0.92 0.045 60)",  ink: "oklch(0.38 0.09 60)"  }, // warm amber
  "System Design": { swatch: "oklch(0.92 0.045 265)", ink: "oklch(0.38 0.09 265)" }, // cool indigo
  "Salary Neg.":   { swatch: "oklch(0.92 0.045 35)",  ink: "oklch(0.38 0.09 35)"  }, // copper
  "Tech Screen":   { swatch: "oklch(0.92 0.045 175)", ink: "oklch(0.38 0.09 175)" }, // teal
  "Hiring Mgr":    { swatch: "oklch(0.92 0.045 340)", ink: "oklch(0.38 0.09 340)" }, // rose
};
const typeHue = (t: string) =>
  (TYPE_HUE as Record<string, { swatch: string; ink: string } | undefined>)[t]
    ?? { swatch: tok.creamSoft, ink: tok.inkSoft };
const bandColor = (score: number) => {
  const b = bandOf(score);
  return b === "strong" || b === "solid" ? tok.success
       : b === "mixed" ? tok.copper
       : tok.error;
};

/* ─── Mock data ─── */
type Session = {
  id: string;
  type: string;
  role: string;
  company: string;
  date: string;       // ISO
  dateLabel: string;
  duration: string;
  score: number;
  delta: number;
  topStrength: string;
  topGap: string;
  questions: number;
  draft?: boolean;    // marked when the user bailed mid-round
  /* Optional detail-view payloads. Populated when the component is
     driven by real data; absent in canvas / storyboard mode (the
     prototype's hardcoded sample arrays kick in instead). */
  questionScores?: { question: string; score: number; notes: string }[];
  transcript?: { speaker: string; text: string; scoreNote?: string }[];
  feedback?: string;
};

const INITIAL_SESSIONS: Session[] = [
  { id: "s1", type: "Behavioral",  role: "Senior PM",     company: "Razorpay",   date: "2026-06-06T09:30:00Z", dateLabel: "Today, 3:00 PM",  duration: "42m", score: 86, delta: +6, topStrength: "Crisp STAR framing",     topGap: "Quantify impact",    questions: 8 },
  { id: "s2", type: "System Design", role: "Staff Eng",   company: "Flipkart",   date: "2026-06-05T11:00:00Z", dateLabel: "Yesterday",        duration: "58m", score: 74, delta: -3, topStrength: "Tradeoff thinking",      topGap: "Capacity math",      questions: 5 },
  { id: "s3", type: "Salary Neg.", role: "Engineering Mgr", company: "Swiggy",   date: "2026-06-04T18:15:00Z", dateLabel: "2 days ago",       duration: "31m", score: 81, delta: +9, topStrength: "Anchored high, calm",    topGap: "Equity literacy",    questions: 6 },
  { id: "s4", type: "Behavioral",  role: "Senior PM",     company: "Razorpay",   date: "2026-06-02T10:00:00Z", dateLabel: "4 days ago",       duration: "39m", score: 80, delta: +4, topStrength: "Conflict story arc",     topGap: "Closing brevity",    questions: 8 },
  { id: "s5", type: "Tech Screen", role: "Staff Eng",     company: "PhonePe",    date: "2026-05-30T15:00:00Z", dateLabel: "Last week",        duration: "47m", score: 71, delta: +2, topStrength: "Clean problem decomp",   topGap: "Edge-case coverage", questions: 4 },
  { id: "s6", type: "Hiring Mgr",  role: "Engineering Mgr", company: "Zomato",   date: "2026-05-28T12:00:00Z", dateLabel: "Last week",        duration: "36m", score: 76, delta: -1, topStrength: "Vision narrative",       topGap: "Metric specificity", questions: 7 },
  { id: "s7", type: "Behavioral",  role: "Senior PM",     company: "Cred",       date: "2026-05-24T14:00:00Z", dateLabel: "2 weeks ago",      duration: "41m", score: 68, delta: -4, topStrength: "Authentic tone",         topGap: "STAR S+T compression", questions: 8 },
];

/* Date-based grouping. The previous version bucketed by array index
   ("first row is Today, second is Yesterday") which is a fake that
   would mis-group on day one with real data. NOW is pinned so the
   prototype stays deterministic across renders. */
/* NOW is pinned so the prototype groups deterministically across
   renders. The real session list will pass real timestamps and the
   bucket math is identical. When running this canvas against a
   real clock, update or compute this constant. */
const NOW = new Date("2026-06-06T18:00:00Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

const groupSessions = (items: Session[]) => {
  const groups: Array<{ label: string; items: Session[] }> = [
    { label: "Today",     items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier",   items: [] },
  ];
  items.forEach(s => {
    const ageDays = (NOW - new Date(s.date).getTime()) / DAY_MS;
    if (ageDays < 1) groups[0].items.push(s);
    else if (ageDays < 2) groups[1].items.push(s);
    else if (ageDays < 7) groups[2].items.push(s);
    else groups[3].items.push(s);
  });
  return groups.filter(g => g.items.length);
};

/* HelpDot — an inline `?` after a label that, on hover, reveals a
   small popover explaining the score bands. Used on the hero band
   label so a user can answer "what's the difference between Solid
   and Mixed?" without leaving the page. CSS-only hover; no JS state
   for the popover. */
function HelpDot({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        role="button"
        aria-label="What do the bands mean?"
        style={{
          display: "inline-grid", placeItems: "center",
          width: 14, height: 14, borderRadius: radii.pill,
          background: tok.creamSoft, color: tok.inkSoft,
          fontSize: 10, fontWeight: 700, cursor: "help",
          border: `1px solid ${tok.line}`,
        }}
      >?</span>
      {open && (
        <span style={{
          position: "absolute", top: "120%", left: 0, zIndex: 10,
          width: 240, padding: "10px 12px",
          background: tok.coal, color: tok.cream,
          borderRadius: radii.btn, fontSize: 12, lineHeight: 1.5,
          boxShadow: "0 8px 24px rgba(14,12,8,0.18)",
        }}>{children}</span>
      )}
    </span>
  );
}

/* useEsc — bind Escape to a callback while a view is mounted.
   Used by Detail and Report so the user can back out without
   reaching for the mouse. */
function useEsc(handler: () => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handler(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

/* useMounted — flips false → true on first paint so children can
   trigger a one-shot transform-based entrance. Animations only
   touch transform/opacity (never layout properties) and ease out
   with a quart curve. Skipped entirely when the user prefers
   reduced motion. */
function useMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setM(true); return; }
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

/* Sparkline — small SVG trend across N scores. Used on the Detail
   hero to give the score numerical context ("you went 68 → 76 →
   80 → 86 on Behavioral"). Pure SVG, no chart lib. */
function Sparkline({ values, width = 88, height = 24, baseline = 75 }: { values: number[]; width?: number; height?: number; baseline?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values, 50);
  const max = Math.max(...values, 100);
  const range = Math.max(1, max - min);
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = values[values.length - 1];
  const lastX = (values.length - 1) * stepX;
  const lastY = height - ((last - min) / range) * height;
  /* Honest anchor: a faint dashed line at the Solid threshold (75).
     Without it, a 3-point trend of 68 → 72 → 76 looks like dramatic
     improvement when in fact it only just crossed into Solid. The
     baseline tells the truth about where the bands sit. Clipped if
     the band line falls outside the visible value range. */
  const showBaseline = baseline >= min && baseline <= max;
  const baselineY = height - ((baseline - min) / range) * height;
  /* Polarity color. Net change from first to last point decides the
     stroke: a 4-point gain colors success, a 4-point loss colors
     error, drift inside ±3 stays coal so we don't paint noise. The
     numeric trend (68 → 76 → 80 → 86) is already in the title attr
     above, so color is reinforcement, not the only signal. */
  const net = values[values.length - 1] - values[0];
  const stroke = net >= 4 ? tok.success : net <= -4 ? tok.error : tok.coal;
  /* Path length for the stroke-draw animation. Sum of euclidean
     segment distances; cheap, exact for a polyline. Set as a CSS
     custom property so the keyframe can use it as the dashoffset
     starting point. */
  let pathLen = 0;
  for (let i = 1; i < values.length; i++) {
    const x1 = (i - 1) * stepX;
    const y1 = height - ((values[i - 1] - min) / range) * height;
    const x2 = i * stepX;
    const y2 = height - ((values[i] - min) / range) * height;
    pathLen += Math.hypot(x2 - x1, y2 - y1);
  }
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block" }}>
      {showBaseline && (
        <line x1={0} y1={baselineY} x2={width} y2={baselineY} stroke={tok.lineStrong} strokeWidth={1} strokeDasharray="2 3" />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="hsx-anim-spark"
        style={{ ["--hsx-spark-len" as string]: pathLen.toFixed(1) }}
      />
      {/* End-dot fades in after the line finishes drawing. 600ms
         draw + 40ms gap = land the dot just as the eye gets there. */}
      <circle
        cx={lastX} cy={lastY} r={2.5} fill={stroke}
        style={{ animation: "hsx-fade 200ms cubic-bezier(0.22,1,0.36,1) 640ms both" }}
      />
    </svg>
  );
}

/* Visible focus ring for keyboard users. Most product buttons rely
   on browser default outline which is inconsistent; this gives
   every interactive element a calm coal outline on :focus-visible
   without affecting mouse focus. Mounted once via a <style> tag at
   the canvas root. */
const FOCUS_STYLE = `
  button:focus-visible, [role="button"]:focus-visible, [role="listitem"]:focus-visible, input:focus-visible {
    outline: 2px solid ${tok.coal};
    outline-offset: 2px;
    border-radius: 4px;
  }
  .hsx-skip {
    position: absolute; left: 8px; top: -40px;
    padding: 8px 14px; background: ${tok.coal}; color: ${tok.cream};
    font-size: 13px; font-weight: 600; border-radius: ${radii.btn}px;
    z-index: 100; transition: top 120ms cubic-bezier(0.22,1,0.36,1);
  }
  .hsx-skip:focus { top: 8px; }

  /* Every mono numeric in this surface needs tabular figures so the
     digits in a column (deltas, durations, scores, countdowns) sit at
     the same x-position regardless of which numeral is rendered.
     The substring matches both "JetBrains Mono" and "monospace" so
     it catches whichever browser-serialized form of the font-family
     declaration the inline style emits. */
  .hsx-root [style*="Mono"],
  .hsx-root [style*="monospace"] {
    font-variant-numeric: tabular-nums;
  }

  /* ── Motion ──
     Four moments, each conveying state, none decorative.
     Easing curves: out-quart (smooth), out-quint (snappier), out-expo
     (decisive). No bounce, no elastic. All animations are reverse-
     suppressed by the reduced-motion guard below. */

  /* View transition: list ↔ detail. 4px translate plus opacity so
     the surface reads as "entered" rather than swapped. */
  @keyframes hsx-view-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: none; }
  }
  .hsx-anim-view {
    animation: hsx-view-in 180ms cubic-bezier(0.22,1,0.36,1) both;
  }

  /* UndoToast: slides up from below the safe area; out-expo for a
     confident landing because the toast is consequential. */
  @keyframes hsx-toast-in {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  .hsx-anim-toast {
    animation: hsx-toast-in 220ms cubic-bezier(0.16,1,0.3,1) both;
  }

  /* HelpPanel: backdrop fades in; inner card fades + lifts. Modal
     overlays without entry motion read as harsh. Two separate
     animations so the backdrop reads as "context dimmed" while the
     card reads as "arrived." */
  @keyframes hsx-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes hsx-panel-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: none; }
  }
  .hsx-anim-panel {
    animation: hsx-panel-in 200ms cubic-bezier(0.25,1,0.5,1) both;
  }

  /* Sparkline: stroke-dashoffset draw on first paint. The one hero
     moment in this surface. The trend literally draws itself before
     you read it. Played once per mount, not on every render. */
  @keyframes hsx-spark-draw {
    from { stroke-dashoffset: var(--hsx-spark-len, 200); }
    to   { stroke-dashoffset: 0; }
  }
  .hsx-anim-spark {
    stroke-dasharray: var(--hsx-spark-len, 200);
    animation: hsx-spark-draw 600ms cubic-bezier(0.22,1,0.36,1) both;
  }

  /* Honor the OS motion preference. Snaps every animation above
     instantly. UndoToast's 6s countdown is a number prop, not a CSS
     animation, so the global rule below doesn't reach it. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }

  /* ── Responsive ──
     Single breakpoint at 768px. Above: side rail + 56px gutter.
     Below: rail collapses to a horizontal scrolling tab strip, the
     content gutter halves, KPI grid drops to 2×2, and any element
     tagged .hsx-touch gets a 44×44 minimum hit area (also triggered
     by coarse pointer regardless of width). The rail's brand block
     and the keyboard-hint footer are hidden — the nav tabs stay,
     since they're the only load-bearing element. */
  @media (max-width: 768px) {
    .hsx-root { grid-template-columns: 1fr !important; }
    .hsx-rail {
      border-right: none !important;
      border-bottom: 1px solid ${tok.line} !important;
      padding: 12px 16px !important;
      flex-direction: row !important;
      align-items: center;
    }
    .hsx-rail-nav { flex-direction: row !important; overflow-x: auto; gap: 4px !important; }
    .hsx-rail-brand, .hsx-rail-help { display: none !important; }
    .hsx-pad { padding: 24px 16px !important; }
    .hsx-pad-detail { padding: 20px 16px !important; }
    .hsx-pad-report { padding: 24px 16px !important; }
    .hsx-pad-empty { padding: 64px 24px !important; }
    .hsx-kpi { grid-template-columns: repeat(2, 1fr) !important; }
    .hsx-row { grid-template-columns: 56px 1fr auto 44px !important; gap: 12px !important; padding: 14px 14px !important; }
    .hsx-row-meta-delta { display: none !important; }
    .hsx-report-split { grid-template-columns: 1fr !important; }
    .hsx-report-pair { grid-template-columns: 1fr !important; }
  }

  /* Touch-pointer hit target normalisation. Triggers on coarse
     pointer (phones, tablets) at any width, plus the responsive
     breakpoint as a belt-and-braces. */
  @media (pointer: coarse), (max-width: 768px) {
    .hsx-touch { min-width: 44px !important; min-height: 44px !important; }
  }

  /* Theme posture: this surface is committed to cream-on-coal in
     every theme. Single-theme by design — the brand IS the warmth
     of the paper. System dark-mode is intentionally ignored;
     darkening the cream would destroy the editorial register. */
`;

/* ─── Score ring ─── */
function ScoreRing({ score, size = 56, stroke = 4 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = bandColor(score);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tok.line} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <span style={{ fontFamily: fonts.mono, fontSize: size * 0.32, fontWeight: 700, color: tok.coal, lineHeight: 1 }}>{score}</span>
      </div>
    </div>
  );
}

/* ─── Shell ─── */
function Shell({ active, onHelp, children }: { active: "Sessions" | "Detail" | "Report"; onHelp?: () => void; children: React.ReactNode }) {
  /* The sidebar tab to highlight. Detail and Report are sub-views of
     Sessions, so they all light the Sessions tab — but the prior
     implementation collapsed every branch to "Sessions" via a
     tautology (`a === "Sessions" ? "Sessions" : "Sessions"`),
     leaving no way to highlight any other tab. Now expressed as a
     map so other tabs can actually be picked up if/when Detail or
     Report ever route to a different parent. */
  const PARENT_OF: Record<typeof active, string> = {
    Sessions: "Sessions", Detail: "Sessions", Report: "Sessions",
  };
  const activeTab = PARENT_OF[active];
  const tabs = ["Dashboard", "Sessions", "Analytics", "Resume", "Calendar", "Settings"];
  return (
    <div className="hsx-root" style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: tok.cream, color: tok.coal, fontFamily: fonts.ui, position: "relative" }}>
      <style>{FOCUS_STYLE}</style>
      {/* Skip-link: invisible until focused via Tab. Keyboard users land
         on the first tab stop in the sidebar; one keystroke jumps them
         past primary nav to the page body. Slides down on focus with
         the same quart-out curve as the rest of the surface. */}
      <a href="#main" className="hsx-skip">Skip to content</a>
      <aside
        className="hsx-rail"
        aria-label="Primary"
        style={{ borderRight: `1px solid ${tok.line}`, padding: "28px 20px", background: tok.creamSoft, display: "flex", flexDirection: "column" }}>
        <div className="hsx-rail-brand" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <div style={{ width: 28, height: 28, borderRadius: radii.glyph, background: tok.indigo, display: "grid", placeItems: "center", color: tok.cream, fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 700 }}>H</div>
          <span style={{ fontFamily: fonts.serif, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>HireStepX</span>
        </div>
        <nav className="hsx-rail-nav" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {tabs.map(t => {
            const isActive = t === activeTab;
            return (
              /* Active treatment: small leading coal dot + weight
                 shift. No background card. This restores a single
                 active-nav idiom shared with Detail tabs (both are
                 weight + coal marker, no fill chip). Card-style fill
                 is reserved for filter pills, which are a different
                 semantic (filter, not navigate). */
              <button key={t} aria-current={isActive ? "page" : undefined} style={{
                textAlign: "left", padding: "10px 12px", border: "none",
                background: "transparent",
                color: isActive ? tok.coal : tok.inkSoft,
                fontSize: 14, fontWeight: isActive ? 700 : 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: radii.pill,
                  background: isActive ? tok.coal : "transparent",
                  display: "inline-block",
                }} />
                {t}
              </button>
            );
          })}
        </nav>
        {/* Streak and habit copy were moved off the Sessions tab chrome.
           This surface is the practice log; habit nudges live on the
           dashboard. Keeping the two voices apart prevents the editorial
           tone from being undercut by gamified copy. */}

        {/* Help affordance pinned to the bottom of the sidebar.
           Closes the H10 gap the critique flagged. Keyboard hint
           inline so the new shortcuts are discoverable without
           opening anything. */}
        <div className="hsx-rail-help" style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${tok.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Critique fix: the `?` glyph here used to duplicate HelpDot's
             `?` (inline band definition). Replaced with a mono `⌘`
             prefix that reads as "menu/shortcut" rather than "help me
             with this thing." The HelpDot keeps `?` for asking about
             the band itself. */}
          <button onClick={onHelp} aria-label="Open keyboard shortcuts" style={{
            textAlign: "left", padding: "8px 12px", border: "none", background: "transparent",
            color: tok.inkSoft, fontSize: 13, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontFamily: fonts.mono, color: tok.inkFaint, fontSize: 12 }}>⌘</span>
            Shortcuts and bands
          </button>
          <div style={{ padding: "0 12px", fontSize: 11, color: tok.inkFaint, fontFamily: fonts.mono, lineHeight: 1.6 }}>
            <div>/ &nbsp;search · j k &nbsp;move</div>
            <div>↵ &nbsp;open · esc &nbsp;back</div>
            <div>d &nbsp;draft · ⌫ &nbsp;delete</div>
          </div>
        </div>
      </aside>
      <main id="main">{children}</main>
    </div>
  );
}

/* ─── List view ─── */
/* Canonical filter pill set used by the canvas storyboards (mock
   data only covers these five types). When the component runs against
   real data the visible filter set is derived from the session list
   instead — see `filterTypes` below. */
const FILTER_TYPES_DEFAULT = ["All", "Behavioral", "System Design", "Tech Screen", "Hiring Mgr", "Salary Neg."] as const;
type SortKey = "recent" | "score" | "score-asc" | "duration";

function ListView({ sessions, onOpen, onDelete, onToggleDraft, allowDelete = true }: {
  sessions: Session[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleDraft: (id: string) => void;
  /* When false, the row-actions menu hides the destructive Delete
     item. Used by the route wrapper because there's no delete API
     yet — showing the affordance would let a user "delete" a
     session that reappears on next reload. */
  allowDelete?: boolean;
}) {
  /* Filter pill set: derive unique types from the actual session
     list when more than one type is present, otherwise fall back to
     the canonical set. "All" always leads. Preserves the canonical
     order for any type that matches, then appends novel types
     alphabetically so the row stays predictable. */
  const filterTypes = React.useMemo(() => {
    const present = new Set(sessions.map(s => s.type));
    if (present.size === 0) return [...FILTER_TYPES_DEFAULT];
    const canonical = FILTER_TYPES_DEFAULT.filter(t => t === "All" || present.has(t));
    const extras = Array.from(present)
      .filter(t => !canonical.includes(t as typeof FILTER_TYPES_DEFAULT[number]))
      .sort();
    return [...canonical, ...extras];
  }, [sessions]);
  /* Real filter + search + sort state. Pills toggle, search narrows,
     sort reorders. A filtered-empty state replaces the list when no
     session matches. */
  const [type, setType] = React.useState<string>("All");
  const [query, setQuery] = React.useState<string>("");
  const [sort, setSort] = React.useState<SortKey>("recent");
  const [showDrafts, setShowDrafts] = React.useState<boolean>(true);
  const [selectedIdx, setSelectedIdx] = React.useState<number>(0);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const filtered = sessions
    .filter(s => showDrafts || !s.draft)
    .filter(s => type === "All" || s.type === type)
    .filter(s => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return s.role.toLowerCase().includes(q) || s.company.toLowerCase().includes(q) || s.type.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "score-asc") return a.score - b.score;
      if (sort === "duration") return parseInt(b.duration) - parseInt(a.duration);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  /* Keyboard layer: `/` focuses search, `j`/`k` move selection,
     `Enter` opens the selected row. Skipped when the user is
     already typing in an input. Power-user affordance the audit
     called for. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === "j") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === "k") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") {
        const s = filtered[selectedIdx];
        if (s) { e.preventDefault(); onOpen(s.id); }
      }
      /* `d` toggles draft; Backspace/Delete removes (with undo). Both
         are destructive-ish but the undo toast catches mistakes. */
      else if (e.key === "d") {
        const s = filtered[selectedIdx];
        if (s) { e.preventDefault(); onToggleDraft(s.id); }
      }
      else if (e.key === "Backspace" || e.key === "Delete") {
        const s = filtered[selectedIdx];
        if (s) { e.preventDefault(); onDelete(s.id); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedIdx, onOpen, onDelete, onToggleDraft]);

  const groups = groupSessions(filtered);
  const total = sessions.length;
  const avg = total > 0 ? Math.round(sessions.reduce((s, x) => s + x.score, 0) / total) : 0;
  const best = total > 0 ? Math.max(...sessions.map(s => s.score)) : 0;
  const hours = (total * 42 / 60).toFixed(1);
  const draftCount = sessions.filter(s => s.draft).length;
  const showingFiltered = type !== "All" || query.trim() !== "";
  return (
    <div className="hsx-pad" style={{ padding: "40px 56px", maxWidth: 1200 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 12, color: tok.copper, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Sessions</div>
          <h1 style={heading.canonical}>
            Your <em style={{ color: tok.copper, fontStyle: "italic" }}>practice log</em>.
          </h1>
          <p style={{ color: tok.inkSoft, marginTop: 8, fontSize: 14 }}>Every mock interview, scored and stored. Open any row to revisit.</p>
        </div>
        <button style={{ padding: "12px 20px", borderRadius: radii.btn, background: tok.coal, color: tok.cream, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span>＋</span> New session
        </button>
      </header>

      {/* KPI strip — persona-aware. With fewer than 3 sessions the
         aggregates ("Best score: 86 · Behavioral · Razorpay") are
         technically true but conversationally empty; we swap them
         for coaching copy that scales with what we actually know.
         Once N ≥ 3 the full aggregates earn their place. */}
      <div className="hsx-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {(total < 3 ? [
          { label: "Sessions so far", value: String(total), hint: total === 0 ? "Start one to begin tracking." : "Three sessions unlocks trend metrics." },
          { label: "Latest score",    value: total > 0 ? String(sessions[0].score) : "–", hint: total > 0 ? `${sessions[0].type} · ${sessions[0].company}` : "No sessions yet" },
          { label: "Next step",       value: "Behavioral", hint: "Suggested round to balance practice." },
          { label: "Practice hours",  value: hours,         hint: "Goal: 8h / month" },
        ] : [
          { label: "Total sessions",  value: String(total),  hint: "+3 this week" },
          { label: "Average score",   value: String(avg),    hint: "↑ 4 vs last month" },
          { label: "Best score",      value: String(best),   hint: "Behavioral · Razorpay" },
          { label: "Practice hours",  value: hours,          hint: "Goal: 8h / month" },
        ]).map(k => (
          <div key={k.label} style={{ padding: 16, background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.card }}>
            <div style={{ fontSize: 11, color: tok.inkSoft, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{k.label}</div>
            <div style={{ fontFamily: fonts.mono, fontSize: 30, fontWeight: 700, marginTop: 6, color: tok.coal, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: tok.inkSoft, marginTop: 6 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Saved views — one-tap presets ahead of the type pills.
         Each preset re-applies a (type, query, sort) triple. Rohan's
         persona issue ("I rebuild the same filter every day") is
         what this is for. The presets sit *above* the type filter
         because they're a different mental model — task ("show me
         what to practise") vs. taxonomy ("show me behavioral"). */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Critique P0 fix: "Weak spots" now actually surfaces low
           scores first (score ascending) instead of duplicating
           "Highest scoring". The label finally matches behavior. */}
        {[
          { label: "Weak spots", apply: () => { setType("All");   setSort("score-asc"); setQuery(""); } },
          { label: "Highest scoring", apply: () => { setType("All");   setSort("score");  setQuery(""); } },
          { label: "Behavioral only", apply: () => { setType("Behavioral"); setSort("recent"); setQuery(""); } },
          { label: "Razorpay round", apply: () => { setType("All");   setSort("recent"); setQuery("razorpay"); } },
        ].map(v => (
          /* Saved-view treatment: filled creamSoft pill with a copper
             ⌁ marker. The earlier dashed border collided semantically
             with the "no matches" dashed empty box — dashed reads as
             "tentative / placeholder", which is wrong for a curated
             preset. Solid background + colored marker says "this is a
             named lens" cleanly. */
          <button key={v.label} onClick={v.apply} style={{
            padding: "6px 12px", borderRadius: radii.pill,
            background: tok.creamSoft, border: `1px solid ${tok.line}`,
            color: tok.coal, fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: fonts.ui, display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ color: tok.copper, fontWeight: 700 }}>⌁</span>
            {v.label}
          </button>
        ))}
      </div>

      {/* Drafts toggle — only surfaces when drafts exist. Lives above
         the filter row as a secondary lens so it never crowds the
         primary type taxonomy. */}
      {draftCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontSize: 12, color: tok.inkSoft }}>
          <button
            onClick={() => setShowDrafts(d => !d)}
            aria-pressed={showDrafts}
            style={{
              padding: "4px 10px", borderRadius: radii.chip,
              background: showDrafts ? tok.copperSoft : "transparent",
              border: `1px solid ${showDrafts ? tok.copper : tok.line}`,
              color: showDrafts ? tok.copper : tok.inkSoft,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
            }}>
            {showDrafts ? "Showing" : "Hiding"} {draftCount} draft{draftCount === 1 ? "" : "s"}
          </button>
          <span style={{ color: tok.inkFaint, fontSize: 11 }}>Rounds left open. Press <span style={{ fontFamily: fonts.mono, color: tok.inkSoft }}>d</span> on a row to toggle.</span>
        </div>
      )}

      {/* Filters — flexWrap so the search/sort group drops below the
         type pills under ~960px instead of jamming. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {filterTypes.map(p => {
            const active = p === type;
            /* Active typed filter wears the type's hue; "All" stays
               coal because it spans every hue. Tying the pill to the
               same swatch used in row leading-chips lets the eye scan
               from filter to matching rows along one color. */
            const hue = p !== "All" ? typeHue(p) : null;
            const activeBg = hue ? hue.swatch : tok.coal;
            const activeFg = hue ? hue.ink : tok.cream;
            const activeBorder = hue ? hue.ink : tok.coal;
            return (
              <button key={p} className="hsx-touch" onClick={() => setType(p)} aria-pressed={active} style={{
                /* Padding bumped 7→8 vertically so pill height matches
                   the search input and sort button (32px) — the row
                   used to misalign by 2px. */
                padding: "8px 14px", borderRadius: radii.pill,
                border: `1px solid ${active ? activeBorder : tok.line}`,
                background: active ? activeBg : tok.white,
                color: active ? activeFg : tok.coal,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{p}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: radii.btn, background: tok.white, border: `1px solid ${tok.line}`, width: 220 }}>
            <span style={{ color: tok.inkFaint }}>⌕</span>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search role, company…  ( / )"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, width: "100%", color: tok.coal, fontFamily: fonts.ui }}
            />
          </div>
          {/* Sort cycles Recent → Score → Duration → Recent. The
             current key is shown in coal; the next key is hinted in
             smaller faint text so the cycle isn't a black box. */}
          <button
            className="hsx-touch"
            onClick={() => setSort(s => s === "recent" ? "score" : s === "score" ? "duration" : "recent")}
            title={`Next: ${sort === "recent" ? "Score" : sort === "score" ? "Duration" : "Recent"}`}
            aria-label={`Currently sorting by ${sort === "recent" ? "recent" : sort === "score" ? "score" : "duration"}. Activate to sort by ${sort === "recent" ? "score" : sort === "score" ? "duration" : "recent"}.`}
            style={{ padding: "8px 12px", borderRadius: radii.btn, background: tok.white, border: `1px solid ${tok.line}`, fontSize: 12, fontWeight: 600, cursor: "pointer", color: tok.coal, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span>Sort: {sort === "recent" ? "Recent" : sort === "score" ? "Score" : "Duration"}</span>
            <span style={{ color: tok.inkFaint, fontSize: 11, fontWeight: 500 }}>
              → {sort === "recent" ? "Score" : sort === "score" ? "Duration" : "Recent"}
            </span>
          </button>
          {/* Polite live region: announces the new sort key after each
             cycle so screen-reader users hear "Sorted by score" without
             re-reading the button label. Visually hidden via the
             clip-path trick to avoid layout impact. */}
          <span
            aria-live="polite"
            style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
            Sorted by {sort === "recent" ? "most recent" : sort === "score" ? "score" : "duration"}.
          </span>
        </div>
      </div>

      {/* Filtered-empty fallback. When pills + search narrow to zero,
         say so plainly and offer a one-tap reset — rather than just
         showing nothing under the filter bar. */}
      {showingFiltered && filtered.length === 0 && (
        <div style={{ padding: "48px 24px", textAlign: "center", background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.card }}>
          <div style={{ fontSize: 11, color: tok.copper, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>No matches</div>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 18, color: tok.coal, marginBottom: 6 }}>Nothing here.</div>
          <div style={{ fontSize: 13, color: tok.inkSoft, marginBottom: 14 }}>Drop a filter or clear the search to see more.</div>
          <button
            onClick={() => { setType("All"); setQuery(""); }}
            style={{ padding: "8px 16px", borderRadius: radii.btn, background: tok.coal, color: tok.cream, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Grouped sessions */}
      {groups.map(g => (
        <section key={g.label} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 16, color: tok.indigo, fontWeight: 500 }}>{g.label}</span>
            <span style={{ height: 1, background: tok.line, flex: 1 }} />
            <span style={{ fontSize: 11, color: tok.inkFaint, fontFamily: fonts.mono }}>{g.items.length}</span>
          </div>
          <div role="list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map(s => {
              const idxInFiltered = filtered.findIndex(x => x.id === s.id);
              const isSelected = idxInFiltered === selectedIdx;
              return (
              <div
                key={s.id}
                className="hsx-row"
                role="listitem"
                tabIndex={0}
                onClick={() => onOpen(s.id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(s.id); } }}
                onMouseEnter={() => setSelectedIdx(idxInFiltered)}
                style={{
                  /* Chevron dropped; the row IS the affordance. Selected
                     state lifts the border to coal so j/k navigation has
                     a visible cursor. Draft rows render at 65% opacity
                     with a dashed left edge inside (not a side-stripe —
                     the dashed treatment is a row-wide border) so the
                     state is unmissable without going decorative. */
                  display: "grid",
                  gridTemplateColumns: "64px 1fr auto auto 32px",
                  gap: 16, alignItems: "center",
                  padding: "18px 20px",
                  background: s.draft ? tok.creamSoft : tok.white,
                  border: s.draft
                    ? `1px dashed ${isSelected ? tok.coal : tok.lineStrong}`
                    : `1px solid ${isSelected ? tok.coal : tok.line}`,
                  borderRadius: radii.card, cursor: "pointer",
                  opacity: s.draft ? 0.72 : 1,
                  position: "relative",
                  transition: "border-color 120ms cubic-bezier(0.22,1,0.36,1)",
                }}>
                <ScoreRing score={s.score} />
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    {/* Leading swatch — the only color in this row
                       besides the score ring. Square (6px) rather
                       than a chip behind the label so we don't
                       compete with the brand role pill next to it. */}
                    <span aria-hidden="true" style={{
                      width: 6, height: 6, borderRadius: 1,
                      background: typeHue(s.type).swatch,
                      border: `1px solid ${typeHue(s.type).ink}`,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: tok.coal }}>{s.type}</span>
                    <span style={{ padding: "3px 9px", background: tok.copperSoft, color: tok.copper, borderRadius: radii.chip, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.role}</span>
                    <span style={{ fontSize: 12, color: tok.inkSoft }}>· {s.company}</span>
                    {s.draft && (
                      <span style={{ marginLeft: 4, padding: "2px 8px", borderRadius: radii.chip, background: tok.white, border: `1px solid ${tok.lineStrong}`, color: tok.inkSoft, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Draft</span>
                    )}
                  </div>
                  {/* One signal per row, score-conditional. Strong
                     sessions surface what worked; weaker sessions
                     surface the gap. A list of mixed scores stops
                     reading as a wall of red. */}
                  <div style={{ fontSize: 12, color: tok.inkSoft }}>
                    {s.score >= 80 ? (
                      <span>
                        <span style={{ color: tok.coal, fontWeight: 600 }}>{s.topStrength}</span>
                        <span style={{ color: tok.inkFaint }}> · landed</span>
                      </span>
                    ) : (
                      <span>
                        <span style={{ color: tok.inkSoft }}>Sharpen </span>
                        <span style={{ color: tok.coal, fontWeight: 600 }}>{s.topGap}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: tok.coal, fontWeight: 500 }}>{s.dateLabel}</div>
                  <div style={{ fontSize: 11, color: tok.inkFaint, fontFamily: fonts.mono, marginTop: 2 }}>{s.duration} · {s.questions} Qs</div>
                </div>
                {/* Delta is now neutral mono — only the ring carries
                   verdict color. A 76 with -1 no longer paints a copper
                   ring beside a red chip, which used to read as
                   contradictory. */}
                <div style={{
                  fontFamily: fonts.mono, fontSize: 13, fontWeight: 600,
                  color: tok.inkSoft, minWidth: 38, textAlign: "right",
                }}>{s.delta >= 0 ? "+" : ""}{s.delta}</div>
                {/* Row actions — kebab opens a small popover with
                   Mark/Unmark draft and Delete. Stops propagation so
                   clicking the kebab doesn't open the row. Closes on
                   blur via the outer click handler in the default
                   export. The menu items use plain language about the
                   consequence ("Delete · undoable for 6s") so the
                   destructive action is preventably visible. */}
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
                  {/* Hit area widened to 32×32 on desktop, 44×44 on touch
                     via .hsx-touch. The visual glyph stays the same; the
                     button just absorbs more pointer area around it. */}
                  <button
                    className="hsx-touch"
                    onClick={() => setOpenMenu(m => m === s.id ? null : s.id)}
                    aria-label="Row actions"
                    aria-haspopup="menu"
                    aria-expanded={openMenu === s.id}
                    style={{
                      width: 32, height: 32, borderRadius: radii.btn,
                      background: openMenu === s.id ? tok.creamSoft : "transparent",
                      border: "none", color: tok.inkSoft, cursor: "pointer",
                      fontSize: 16, lineHeight: 1, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>⋯</button>
                  {openMenu === s.id && (
                    <div
                      role="menu"
                      onKeyDown={e => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setOpenMenu(null);
                          /* Focus restoration: return focus to the
                             trigger button so keyboard users don't end
                             up dropped at document root. */
                          const trigger = (e.currentTarget.parentElement?.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement | null);
                          trigger?.focus();
                        }
                      }}
                      style={{
                      position: "absolute", top: "110%", right: 0, zIndex: 20,
                      width: 220, padding: 6, background: tok.white,
                      border: `1px solid ${tok.lineStrong}`, borderRadius: radii.btn,
                      boxShadow: "0 12px 32px rgba(14,12,8,0.14)",
                      display: "flex", flexDirection: "column", gap: 2,
                    }}>
                      <button
                        role="menuitem"
                        onClick={() => { onToggleDraft(s.id); setOpenMenu(null); }}
                        style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", color: tok.coal, fontSize: 13, fontWeight: 500, cursor: "pointer", borderRadius: radii.chip, fontFamily: fonts.ui }}>
                        {s.draft ? "Mark as finished" : "Mark as draft"}
                        <div style={{ fontSize: 11, color: tok.inkFaint, marginTop: 2 }}>
                          {s.draft ? "Restore to the scored list." : "Hide from average; you didn't finish."}
                        </div>
                      </button>
                      {allowDelete && (
                        <button
                          role="menuitem"
                          onClick={() => { onDelete(s.id); setOpenMenu(null); }}
                          style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", color: tok.error, fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: radii.chip, fontFamily: fonts.ui }}>
                          Delete
                          <div style={{ fontSize: 11, color: tok.inkFaint, marginTop: 2, fontWeight: 400 }}>Undoable for 6 seconds.</div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── Detail view ─── */
const DETAIL_TABS = ["Question-by-question", "Transcript", "Coach notes", "Skill impact"] as const;
type DetailTab = typeof DETAIL_TABS[number];

function DetailView({
  session, sessions, onBack, onShare,
}: {
  session: Session;
  sessions: Session[];
  onBack: () => void;
  /* Optional. When absent the Share button hides — used by the route
     wrapper because the Report view has no real data source yet. */
  onShare?: () => void;
}) {
  const s = session;
  const [tab, setTab] = React.useState<DetailTab>("Question-by-question");
  useEsc(onBack);
  const mounted = useMounted();
  /* Trend of the user's same-type score history (oldest → newest).
     Gives the hero number context: a 76 means very different things
     after 60 → 70 → 76 versus 88 → 82 → 76. */
  const trend = sessions
    .filter(x => x.type === s.type && !x.draft)
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(x => x.score);
  const breakdown = [
    { label: "Content",      score: 88 },
    { label: "Structure",    score: 92 },
    { label: "Delivery",     score: 78 },
    { label: "Confidence",   score: 85 },
  ];
  /* Per-question rows derive label + color from the same `bandOf`
     used by ring and hero label. When real data is present
     (questionScores on the session), it drives the rows. Otherwise
     fall back to the canvas sample set so storyboards still render. */
  const questions = (s.questionScores && s.questionScores.length > 0)
    ? s.questionScores.map((q, i) => ({
        idx: i + 1,
        text: q.question,
        score: q.score,
        note: q.notes,
      }))
    : [
        { idx: 1, text: "Tell me about a time you led through ambiguity.",                    score: 90, note: "STAR arc with crisp situation framing, measurable outcome." },
        { idx: 2, text: "How do you decide what to deprioritize when a launch slips?",        score: 84, note: "Tradeoff thinking landed; could quantify cost saved." },
        { idx: 3, text: "Describe conflict with an engineering leader.",                       score: 76, note: "Good emotional honesty; lacked a concrete resolution mechanism." },
        { idx: 4, text: "Why this company, why now?",                                           score: 88, note: "Personalised; referenced their UPI rails specifically." },
        { idx: 5, text: "Walk me through a metric you misread.",                                score: 72, note: "Story was clear; missed the systemic-fix follow-through." },
        { idx: 6, text: "What feedback have you ignored, and why?",                             score: 68, note: "Defensive register. Reframe as growth, not justification." },
        { idx: 7, text: "Tell me about your biggest professional mistake.",                     score: 81, note: "Specific and owned. Add what changed in your operating model since." },
        { idx: 8, text: "How would you onboard in your first 90 days?",                          score: 92, note: "Sequenced beautifully: learn, align, ship a quick win." },
      ];
  return (
    <div className="hsx-pad-detail" style={{ padding: "32px 56px", maxWidth: 1200 }}>
      {/* Critique fix: Share moved up here next to the breadcrumb so
         it stops competing in the score-baseline CTA cluster. Share
         is metadata (this report is shareable), not a primary action. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: tok.inkSoft }}>
          <button
            onClick={onBack}
            style={{ background: "transparent", border: "none", padding: 0, color: tok.inkSoft, fontSize: 12, cursor: "pointer", fontFamily: fonts.ui }}>
            ← Sessions
          </button>
          <span style={{ color: tok.inkFaint }}>/</span>
          <span style={{ color: tok.coal, fontWeight: 600 }}>{s.type} · {s.company}</span>
        </div>
        {onShare && (
          <button onClick={onShare} style={{ padding: "6px 12px", borderRadius: radii.btn, background: "transparent", color: tok.inkSoft, border: `1px solid ${tok.line}`, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true">↗</span> Share report
          </button>
        )}
      </div>

      {/* Hero — restrained. The inverted dark-indigo "score card" was
         the canonical AI-dashboard hero-metric trope (big mono numeral,
         italic-serif verdict, copper accent). It's been removed.

         The score now lives directly on the cream surface with a band
         label that reads honestly across the score range, the delta
         beside it as neutral mono, and the four breakdown bars below
         as one inline rhythm. Cream holds the whole surface; no second
         color strategy fights it. */}
      <div style={{ marginBottom: 28 }}>
        {/* Metadata row committed to a single voice: inline ·-separated
           text, no chip backgrounds. The hero typography below carries
           the identity weight; this row only labels it. The earlier
           half-state (two loud chips + one quiet inline) was the
           audit's H8 drag. */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", color: tok.inkSoft, fontSize: 12 }}>
          <span style={{ color: tok.copper, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.role}</span>
          <span style={{ color: tok.inkFaint }}>·</span>
          <span style={{ color: tok.indigo, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.company}</span>
          <span style={{ color: tok.inkFaint }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: radii.pill, background: tok.indigo, display: "inline-block" }} />
            AI panel, Indian Senior PM
          </span>
        </div>
        <h1 style={{ ...heading.canonical, marginBottom: 8 }}>
          Behavioral, round one.
        </h1>
        <div style={{ display: "flex", gap: 14, color: tok.inkSoft, fontSize: 13, marginBottom: 24 }}>
          <span>{s.dateLabel}</span>
          <span>·</span>
          <span>{s.duration}</span>
          <span>·</span>
          <span>{s.questions} questions</span>
        </div>

        {/* Score module — distilled. Critique flagged the prior
           baseline as overloaded (9 elements). The baseline now holds
           four things: numeral, band, delta, CTAs. Sparkline + decay
           moved to a quiet secondary line below the divider. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, paddingBottom: 14 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 72, fontWeight: 700, lineHeight: 1, color: tok.coal }}>{s.score}</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 16, color: tok.inkFaint }}>/ 100</span>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 12 }}>
            {/* Band-only label. The "top X% for Behavioral" was a
               fabricated percentile we never compute; removing it is
               more honest than guessing it. */}
            <span style={{ fontFamily: fonts.serif, fontSize: 18, color: tok.coal, fontWeight: 500, display: "inline-flex", alignItems: "center" }}>
              {BAND_LABEL[bandOf(s.score)]}
              <HelpDot>
                <div style={{ fontFamily: fonts.mono, marginBottom: 4 }}>Strong  ≥ 85</div>
                <div style={{ fontFamily: fonts.mono, marginBottom: 4 }}>Solid   75-84</div>
                <div style={{ fontFamily: fonts.mono, marginBottom: 4 }}>Mixed   65-74</div>
                <div style={{ fontFamily: fonts.mono }}>Below    &lt; 65</div>
              </HelpDot>
            </span>
            <span style={{ fontSize: 13, color: tok.inkSoft, marginTop: 2, fontFamily: fonts.mono }}>
              {s.delta >= 0 ? "+" : ""}{s.delta} vs last session
            </span>
          </div>
          {/* CTAs follow the score band. Share now lives by the
             breadcrumb; this row is two buttons only. */}
          {(() => {
            const band = bandOf(s.score);
            const primary =
              band === "strong" ? "Schedule next round" :
              band === "solid"  ? "Practice gaps" :
                                  "Drill weakest";
            const secondary = band === "below" ? "Retry this round" : "Open transcript";
            return (
              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <button style={{ padding: "10px 18px", borderRadius: radii.btn, background: tok.coal, color: tok.cream, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{primary}</button>
                <button
                  onClick={() => { if (secondary === "Open transcript") setTab("Transcript"); }}
                  style={{ padding: "10px 18px", borderRadius: radii.btn, background: tok.white, color: tok.coal, border: `1px solid ${tok.lineStrong}`, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{secondary}</button>
              </div>
            );
          })()}
        </div>

        {/* Secondary line: sparkline + decay readout share one quiet
           row under the score baseline. Same divider sits below this
           line so the entire score module reads as one block, but the
           hero altitude no longer fights with five things. */}
        {(() => {
          const window = bandOf(s.score) === "strong" ? 14
                       : bandOf(s.score) === "solid"  ? 10
                       : bandOf(s.score) === "mixed"  ? 6
                       : 4;
          const elapsedDays = Math.max(0, Math.floor((NOW - new Date(s.date).getTime()) / DAY_MS));
          const remaining = window - elapsedDays;
          const stale = remaining <= 0;
          const warmth = stale ? "stale" : remaining >= window * 0.5 ? "warm" : "cooling";
          const dotColor = warmth === "warm" ? tok.success
                         : warmth === "cooling" ? tok.copper
                         : tok.error;
          const labelText = stale
            ? `Stale, last ${elapsedDays}d ago`
            : `Decays in ${remaining}d`;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 24, paddingBottom: 16, borderBottom: `1px solid ${tok.line}` }}>
              {trend.length > 1 && (
                <div title={`${s.type} trend: ${trend.join(" → ")}`} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Sparkline values={trend} />
                  <span style={{ fontSize: 11, color: tok.inkFaint, fontFamily: fonts.mono, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {s.type} trend
                  </span>
                </div>
              )}
              <span style={{ fontSize: 12, color: tok.inkSoft, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: radii.pill, background: dotColor, display: "inline-block" }} />
                <span style={{ fontFamily: fonts.mono }}>{labelText}</span>
                <span style={{ color: tok.inkFaint }}>· {stale ? "revisit now" : "revisit to hold"}</span>
              </span>
            </div>
          );
        })()}

        {/* Breakdown — inline row of axes, one bar each, mono
           numerals. Lives directly under the score so the relationship
           reads as "this is what the 86 is made of," not a separate
           panel. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, paddingTop: 16 }}>
          {breakdown.map(b => (
            <div key={b.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: tok.inkSoft, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{b.label}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 600, color: tok.coal }}>{b.score}</span>
              </div>
              {/* Bar height bumped from 3px to 6px so the relationship
                 between axes is legible at a glance, without becoming
                 a chart-style block. Bars enter with a transform-only
                 scaleX, so we never animate a layout property; ease
                 is quart-out, respects prefers-reduced-motion via
                 useMounted. */}
              <div style={{ height: 6, background: tok.line, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${b.score}%`, height: "100%", background: tok.coal,
                  transformOrigin: "left center",
                  transform: mounted ? "scaleX(1)" : "scaleX(0)",
                  transition: "transform 500ms cubic-bezier(0.22,1,0.36,1)",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs — driven by state so the underline tracks the click,
         not a hard-coded `i === 0`. */}
      <div style={{ display: "flex", gap: 24, borderBottom: `1px solid ${tok.line}`, marginBottom: 22 }}>
        {DETAIL_TABS.map(t => {
          const isActive = t === tab;
          return (
            <button key={t} onClick={() => setTab(t)} aria-current={isActive ? "page" : undefined} style={{
              padding: "10px 0", border: "none", background: "transparent",
              borderBottom: isActive ? `2px solid ${tok.coal}` : "2px solid transparent",
              color: isActive ? tok.coal : tok.inkSoft,
              fontWeight: isActive ? 700 : 500, fontSize: 13, cursor: "pointer",
            }}>{t}</button>
          );
        })}
      </div>

      {/* Tab body. Q-by-Q is the canonical view; other tabs render
         a quiet placeholder so the tabs feel honest rather than
         dead. */}
      {tab === "Question-by-question" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questions.map(q => {
            const color = bandColor(q.score);
            const label = BAND_LABEL[bandOf(q.score)];
            return (
              <div key={q.idx} style={{
                display: "grid", gridTemplateColumns: "44px 1fr 100px",
                gap: 16, padding: 16, background: tok.white,
                border: `1px solid ${tok.line}`, borderRadius: radii.card, alignItems: "start",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: radii.pill, background: tok.creamSoft, color: tok.coal, display: "grid", placeItems: "center", fontFamily: fonts.mono, fontWeight: 700, fontSize: 14, border: `1px solid ${tok.line}` }}>
                  {String(q.idx).padStart(2, "0")}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: tok.coal, marginBottom: 6 }}>{q.text}</div>
                  <div style={{ fontSize: 13, color: tok.inkSoft, lineHeight: 1.5 }}>{q.note}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: 4 }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 22, fontWeight: 700, color }}>{q.score}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === "Transcript" && s.transcript && s.transcript.length > 0 ? (
        /* Real transcript: speaker + utterance in a stacked column,
           coach annotations in muted copper below each line that has
           one. Mono speaker tag, serif body for the text itself so it
           reads like a transcript, not a chat log. */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {s.transcript.map((line, i) => (
            <div key={i} style={{ padding: "14px 18px", background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.card }}>
              <div style={{ fontFamily: fonts.mono, fontSize: 11, color: tok.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                {line.speaker}
              </div>
              <div style={{ fontSize: 14, color: tok.coal, lineHeight: 1.55 }}>{line.text}</div>
              {line.scoreNote && (
                <div style={{ fontSize: 12, color: tok.copper, marginTop: 8, fontStyle: "italic" }}>
                  {line.scoreNote}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : tab === "Coach notes" && s.feedback ? (
        /* Real coach feedback: a single block of prose pulled from the
           session record. Wider line-height + 65ch cap so it reads
           like a written note, not a UI string. */
        <div style={{ padding: "24px 28px", background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.card, maxWidth: "65ch" }}>
          <div style={{ fontSize: 11, color: tok.copper, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Coach notes</div>
          <div style={{ fontSize: 14, color: tok.coal, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{s.feedback}</div>
        </div>
      ) : (
        /* Critique fix: solid border instead of dashed. Dashed is now
           reserved for draft rows; tab placeholders read as "coming"
           via copy in the brand voice, not via border style. */
        <div style={{ padding: "48px 24px", textAlign: "center", background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.card }}>
          <div style={{ fontSize: 11, color: tok.copper, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Coming next</div>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 18, color: tok.coal, marginBottom: 6 }}>{tab}</div>
          <div style={{ fontSize: 13, color: tok.inkSoft }}>
            {tab === "Transcript"   && "The full back-and-forth lands in the next round."}
            {tab === "Coach notes"  && "Hand-written coaching arrives in the next round."}
            {tab === "Skill impact" && "Where this session moved your skill graph, soon."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Report (shareable) ─── */
function ReportView({ onBack }: { onBack: () => void }) {
  useEsc(onBack);
  const radar = [
    { axis: "Content",     v: 0.88 },
    { axis: "Structure",   v: 0.92 },
    { axis: "Delivery",    v: 0.78 },
    { axis: "Confidence",  v: 0.85 },
    { axis: "Empathy",     v: 0.80 },
    { axis: "Closing",     v: 0.72 },
  ];
  const cx = 120, cy = 120, R = 90;
  const pts = radar.map((r, i) => {
    const angle = (Math.PI * 2 * i) / radar.length - Math.PI / 2;
    const rr = R * r.v;
    return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr];
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + " Z";
  const gridPts = (scale: number) => radar.map((_, i) => {
    const angle = (Math.PI * 2 * i) / radar.length - Math.PI / 2;
    return [cx + Math.cos(angle) * R * scale, cy + Math.sin(angle) * R * scale];
  });

  return (
    <div className="hsx-pad-report" style={{ padding: "40px 56px", maxWidth: 1100 }}>
      <button
        onClick={onBack}
        style={{ background: "transparent", border: "none", padding: 0, color: tok.inkSoft, fontSize: 12, cursor: "pointer", fontFamily: fonts.ui, marginBottom: 16 }}>
        ← Back to session
      </button>
      {/* Cover */}
      <div style={{ background: tok.indigoDeep, color: tok.cream, borderRadius: radii.hero, padding: "40px 44px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 240, height: 240, borderRadius: radii.pill, background: "rgba(244,229,216,0.06)" }} />
        <div style={{ fontSize: 11, color: tok.copper100, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>HireStepX · Session Report</div>
        <h1 style={heading.hero}>
          Arjun is <em style={{ color: tok.copper100, fontStyle: "italic" }}>interview-ready</em><br />for Razorpay PM, round one.
        </h1>
        <div style={{ display: "flex", gap: 24, marginTop: 24, alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: fonts.mono, fontSize: 72, fontWeight: 700, lineHeight: 1 }}>86</div>
            <div style={{ color: tok.copper100, fontSize: 12, marginTop: 4 }}>Overall / 100</div>
          </div>
          <div style={{ display: "flex", gap: 16, paddingBottom: 6 }}>
            {[
              { l: "Confidence band", v: "82 – 90" },
              { l: "Percentile",       v: "Top 18%" },
              { l: "Decay risk",       v: "Low (7d)" },
            ].map(k => (
              <div key={k.l}>
                <div style={{ color: tok.copper100, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>{k.l}</div>
                <div style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 600, marginTop: 4 }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-col verdict */}
      <div className="hsx-report-pair" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 24, background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.cardLg }}>
          <div style={{ fontSize: 11, color: tok.success, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>What worked</div>
          {[
            "STAR arcs land with crisp situation framing across 7/8 answers.",
            "Sequenced the 90-day plan as learn, align, ship. The interviewer paused to take notes.",
            "Personalised the 'why this company' to Razorpay's UPI rails.",
          ].map(t => (
            <div key={t} style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <span style={{ color: tok.success, fontWeight: 700, lineHeight: 1.5 }}>✓</span>
              <span style={{ fontSize: 14, color: tok.coal, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: 24, background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.cardLg }}>
          <div style={{ fontSize: 11, color: tok.error, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>What to sharpen</div>
          {[
            "Quantify impact: at least one number per outcome.",
            "Resolution mechanism on conflict stories, not just emotional honesty.",
            "Reframe ignored-feedback as a growth arc, not a justification.",
          ].map(t => (
            <div key={t} style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <span style={{ color: tok.error, fontWeight: 700, lineHeight: 1.5 }}>!</span>
              <span style={{ fontSize: 14, color: tok.coal, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Radar + model answer */}
      <div className="hsx-report-split" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 20, background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.cardLg }}>
          <div style={{ fontSize: 11, color: tok.inkSoft, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Skill profile</div>
          <svg viewBox="0 0 240 240" width="100%">
            {[0.33, 0.66, 1].map((s, i) => (
              <polygon key={i} points={gridPts(s).map(p => p.join(",")).join(" ")} fill="none" stroke={tok.line} strokeWidth={1} />
            ))}
            {radar.map((_, i) => {
              const angle = (Math.PI * 2 * i) / radar.length - Math.PI / 2;
              return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * R} y2={cy + Math.sin(angle) * R} stroke={tok.line} strokeWidth={1} />;
            })}
            <path d={path} fill={tok.copperSoft} stroke={tok.copper} strokeWidth={2} />
            {radar.map((r, i) => {
              const angle = (Math.PI * 2 * i) / radar.length - Math.PI / 2;
              const lx = cx + Math.cos(angle) * (R + 18);
              const ly = cy + Math.sin(angle) * (R + 18);
              return <text key={r.axis} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={tok.inkSoft} fontFamily={fonts.ui} fontWeight={600}>{r.axis}</text>;
            })}
          </svg>
        </div>
        <div style={{ padding: 24, background: tok.white, border: `1px solid ${tok.line}`, borderRadius: radii.cardLg }}>
          <div style={{ fontSize: 11, color: tok.copper, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Coached model answer · Q3 conflict</div>
          <div style={{ fontFamily: fonts.serif, fontSize: 18, fontStyle: "italic", color: tok.indigo, marginBottom: 14, lineHeight: 1.4 }}>
            “Frame the disagreement as a goal, not a person.”
          </div>
          <p style={{ fontSize: 14, color: tok.coal, lineHeight: 1.65, marginBottom: 10 }}>
            <strong>S/T:</strong> Eng wanted to ship the v1 with feature flags; I felt we'd accumulate cleanup debt that would block v2.
          </p>
          <p style={{ fontSize: 14, color: tok.coal, lineHeight: 1.65, marginBottom: 10 }}>
            <strong>A:</strong> I proposed we time-box the flag-cleanup before v2 kicks off, written up as a tracked work item with an owner and a date, not a vibe.
          </p>
          <p style={{ fontSize: 14, color: tok.coal, lineHeight: 1.65 }}>
            <strong>R:</strong> Cleanup landed two weeks early, v2 shipped on time, and we kept the relationship. The pattern (disagree on a mechanism, not the person) is how I run staff disputes now.
          </p>
        </div>
      </div>

      {/* Next CTA */}
      <div style={{ padding: 22, background: tok.coal, color: tok.cream, borderRadius: radii.cardLg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: fonts.serif, fontSize: 20, fontStyle: "italic", lineHeight: 1.2, color: tok.copper100 }}>Next move</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>System Design, Razorpay round 2. Suggested for Friday.</div>
        </div>
        <button style={{ padding: "12px 22px", borderRadius: 10, background: tok.copper, color: tok.cream, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Schedule next session →</button>
      </div>
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyView({ onStart }: { onStart: () => void }) {
  return (
    <div className="hsx-pad-empty" style={{ padding: "120px 56px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 88, height: 88, borderRadius: radii.pill, background: tok.copperSoft, color: tok.copper, display: "grid", placeItems: "center", fontSize: 36, margin: "0 auto 28px" }}>◷</div>
      <div style={{ fontSize: 12, color: tok.copper, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>No sessions yet</div>
      <h1 style={heading.canonical}>
        Your <em style={{ color: tok.copper, fontStyle: "italic" }}>practice log</em> starts here.
      </h1>
      <p style={{ fontSize: 15, color: tok.inkSoft, marginTop: 14, lineHeight: 1.6 }}>
        Every round you take with HireStepX gets recorded, scored, and turned into a shareable report.
        Start with a 15-minute behavioral; we'll tune the questions to your resume.
      </p>
      {/* Critique fix: previously the "Browse interview types" button
         also fired onStart, a dead affordance. Collapsed to a single
         primary CTA; secondary lives as a quiet text link below so it
         doesn't compete and isn't pretending to be wired. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", marginTop: 28 }}>
        <button onClick={onStart} style={{ padding: "12px 22px", borderRadius: radii.btn, background: tok.coal, color: tok.cream, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Start your first session</button>
        <span style={{ fontSize: 12, color: tok.inkFaint }}>
          Or <button onClick={onStart} style={{ background: "transparent", border: "none", padding: 0, color: tok.inkSoft, fontSize: 12, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: fonts.ui }}>browse interview types</button>.
        </span>
      </div>
    </div>
  );
}

/* ─── Help panel ─── A focused overlay listing every shortcut and
   action available in the Sessions tab. Toggled from the sidebar
   Help button or the `?` key. Escape closes. Keeps the H10 surface
   in one consistent place instead of scattered tooltips. */
function HelpPanel({ onClose }: { onClose: () => void }) {
  useEsc(onClose);
  const keyGroups: Array<{ title: string; rows: Array<[string, string]> }> = [
    { title: "Navigate", rows: [
      ["/",            "focus search"],
      ["j  k",         "move selection up / down"],
      ["enter",        "open selected session"],
      ["esc",          "back / close"],
      ["shift + /",    "open this panel"],
    ]},
    { title: "Actions on a row", rows: [
      ["d",            "mark as draft (or unmark)"],
      ["⌫  delete",    "remove session (6s undo)"],
      ["⋯",            "open row menu"],
    ]},
  ];
  /* Critique fix: the "About scores" group used to reuse the
     keyboard-shortcut row idiom (mono left, prose right), which
     conflated "press this key" with "this is a band name." Now it
     renders as a band table with range chips on the right edge so
     the visual hierarchy says "reference," not "shortcut." */
  const bands: Array<{ name: Band; range: string; verdict: string }> = [
    { name: "strong", range: "≥ 85",  verdict: "interview-ready" },
    { name: "solid",  range: "75-84", verdict: "confident, room to sharpen" },
    { name: "mixed",  range: "65-74", verdict: "practise the weak axis" },
    { name: "below",  range: "< 65",  verdict: "retry the round" },
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help and keyboard shortcuts"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(14,12,8,0.32)",
        display: "grid", placeItems: "center",
        animation: "hsx-fade 160ms cubic-bezier(0.22,1,0.36,1) both",
      }}>
      <div onClick={e => e.stopPropagation()} className="hsx-anim-panel" style={{
        width: 480, maxWidth: "calc(100vw - 48px)",
        background: tok.cream, border: `1px solid ${tok.lineStrong}`,
        borderRadius: radii.card, padding: 24,
        boxShadow: "0 24px 60px rgba(14,12,8,0.24)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: tok.copper, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Sessions</div>
            <h2 style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0 }}>
              Keys, actions, and bands.
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close help" style={{
            background: "transparent", border: "none", color: tok.inkSoft,
            fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1,
          }}>✕</button>
        </div>
        {keyGroups.map(g => (
          <section key={g.title} style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: tok.inkSoft, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{g.title}</div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, columnGap: 16 }}>
              {g.rows.map(([k, v]) => (
                <React.Fragment key={k}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 12, color: tok.coal, fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 13, color: tok.inkSoft }}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </section>
        ))}
        <section style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: tok.inkSoft, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>About scores</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bands.map(b => (
              <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
                <span style={{ fontFamily: fonts.serif, fontSize: 14, color: tok.coal, fontWeight: 600, minWidth: 64 }}>
                  {BAND_LABEL[b.name]}
                </span>
                <span style={{ fontFamily: fonts.mono, fontSize: 11, padding: "2px 8px", background: tok.creamSoft, border: `1px solid ${tok.line}`, borderRadius: radii.chip, color: tok.inkSoft }}>
                  {b.range}
                </span>
                <span style={{ fontSize: 13, color: tok.inkSoft }}>{b.verdict}</span>
              </div>
            ))}
          </div>
        </section>
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${tok.line}`, fontSize: 12, color: tok.inkFaint }}>
          Press <span style={{ fontFamily: fonts.mono, color: tok.inkSoft }}>esc</span> to close, or <span style={{ fontFamily: fonts.mono, color: tok.inkSoft }}>?</span> anytime to reopen.
        </div>
      </div>
    </div>
  );
}

/* ─── Undo toast ─── Recovery surface for destructive actions. The
   toast persists for 6s, then auto-dismisses; clicking "Undo"
   restores the session at its original index. The countdown is shown
   in mono so the user can see the affordance is finite without
   feeling rushed. */
function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  const [left, setLeft] = React.useState(6);
  React.useEffect(() => {
    const t = setInterval(() => setLeft(n => n - 1), 1000);
    const dismiss = setTimeout(onDismiss, 6000);
    return () => { clearInterval(t); clearTimeout(dismiss); };
  }, [onDismiss]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="hsx-anim-toast"
      style={{
        position: "fixed", left: "50%", bottom: 32,
        /* Initial transform set by hsx-toast-in keyframe; final value
           after animation completes is translate(-50%, 0). Inline
           transform omitted so the keyframe owns it cleanly. */
        zIndex: 60, display: "flex", alignItems: "center", gap: 16,
        padding: "12px 16px 12px 18px",
        background: tok.coal, color: tok.cream,
        borderRadius: radii.btn,
        boxShadow: "0 16px 36px rgba(14,12,8,0.28)",
        fontSize: 13,
      }}>
      <span>{message}</span>
      <button
        onClick={onUndo}
        style={{
          background: "transparent", border: `1px solid ${tok.copper}`,
          color: tok.copper100, padding: "4px 12px", borderRadius: radii.chip,
          fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: fonts.ui,
        }}>Undo</button>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, color: tok.inkFaint, minWidth: 16, textAlign: "right" }}>
        {Math.max(0, left)}s
      </span>
    </div>
  );
}

/* ─── Public surface ─── */
export type SessionHistoryItem = Session;
export interface SessionHistoryDesignProps {
  variant?: Variant;
  /* Optional real session list. When omitted the component renders the
     embedded mock data (canvas / storyboard mode). When passed, those
     sessions drive every view; the mock array is bypassed. */
  initialSessions?: Session[];
  /* Gate affordances whose backends don't exist yet. In canvas mode
     both default true so storyboards stay full-featured. The
     production route passes false for both. */
  allowDelete?: boolean;
  allowReport?: boolean;
}

/* Internal route state. The `variant` prop sets the entry point each
   storyboard renders, but once mounted the user can move between
   List → Detail → Report and back via the wired affordances:
     - List row click          → Detail
     - Detail breadcrumb click → List
     - Detail "Share" click    → Report (in-shell)
     - Report breadcrumb click → Detail
   No router needed — this is a UI-only prototype, but the click
   surfaces are real so the flow can be exercised in the canvas. */
type Route =
  | { name: "list" }
  | { name: "detail"; id: string }
  | { name: "report"; id: string }
  | { name: "empty" };

export default function SessionHistoryDesign({ variant = "list", initialSessions, allowDelete = true, allowReport = true }: SessionHistoryDesignProps) {
  /* Seed: real sessions when wired (initialSessions present and
     non-empty), otherwise the embedded mock array. Empty real-data
     drops the user into the empty variant automatically. */
  const seed: Session[] = (initialSessions && initialSessions.length > 0) ? initialSessions : INITIAL_SESSIONS;
  const resolvedVariant: Variant =
    initialSessions && initialSessions.length === 0 ? "empty" : variant;
  const initial: Route =
    resolvedVariant === "detail" ? { name: "detail", id: seed[0].id } :
    resolvedVariant === "report" ? { name: "report", id: seed[0].id } :
    resolvedVariant === "empty"  ? { name: "empty" } :
                                   { name: "list" };
  const [route, setRoute] = React.useState<Route>(initial);
  /* Live sessions list — mutated by delete and draft-toggle. The
     initial array seeds it once; subsequent edits stay local. */
  const [sessions, setSessions] = React.useState<Session[]>(seed);
  /* Recovery stash: when we delete, we hold the row + its original
     index so Undo can splice it back into place, not append. */
  const [pendingUndo, setPendingUndo] = React.useState<{ session: Session; index: number; message: string } | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);

  /* `?` toggles help from anywhere, unless the user is typing. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (typing) return;
      if (e.key === "?") { e.preventDefault(); setHelpOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleDelete = (id: string) => {
    const index = sessions.findIndex(x => x.id === id);
    if (index === -1) return;
    const session = sessions[index];
    setSessions(prev => prev.filter(x => x.id !== id));
    setPendingUndo({ session, index, message: `Deleted ${session.type} · ${session.company}` });
  };
  const handleUndo = () => {
    if (!pendingUndo) return;
    setSessions(prev => {
      const next = prev.slice();
      next.splice(pendingUndo.index, 0, pendingUndo.session);
      return next;
    });
    setPendingUndo(null);
  };
  const handleToggleDraft = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, draft: !s.draft } : s));
  };

  const undoToast = pendingUndo ? (
    <UndoToast
      message={pendingUndo.message}
      onUndo={handleUndo}
      onDismiss={() => setPendingUndo(null)}
    />
  ) : null;
  const helpPanel = helpOpen ? <HelpPanel onClose={() => setHelpOpen(false)} /> : null;

  /* View-change animation wrapper. Keyed on `route.name` so a route
     change forces a remount and replays the keyframe. Wraps just the
     view body, not the Shell, so the sidebar and chrome stay still
     while the content area transitions. */
  if (route.name === "detail") {
    const s = sessions.find(x => x.id === route.id) ?? sessions[0] ?? INITIAL_SESSIONS[0];
    return (
      <Shell active="Detail" onHelp={() => setHelpOpen(true)}>
        <div key="detail" className="hsx-anim-view">
          <DetailView
            session={s}
            sessions={sessions}
            onBack={() => setRoute({ name: "list" })}
            onShare={allowReport ? () => setRoute({ name: "report", id: s.id }) : undefined}
          />
        </div>
        {undoToast}
        {helpPanel}
      </Shell>
    );
  }
  if (route.name === "report") {
    const s = sessions.find(x => x.id === route.id) ?? sessions[0] ?? INITIAL_SESSIONS[0];
    return (
      <Shell active="Report" onHelp={() => setHelpOpen(true)}>
        <div key="report" className="hsx-anim-view">
          <ReportView
            onBack={() => setRoute({ name: "detail", id: s.id })}
          />
        </div>
        {undoToast}
        {helpPanel}
      </Shell>
    );
  }
  if (route.name === "empty") {
    return (
      <Shell active="Sessions" onHelp={() => setHelpOpen(true)}>
        <div key="empty" className="hsx-anim-view">
          <EmptyView onStart={() => { /* hand off to interview-setup */ }} />
        </div>
        {helpPanel}
      </Shell>
    );
  }
  return (
    <Shell active="Sessions" onHelp={() => setHelpOpen(true)}>
      <div key="list" className="hsx-anim-view">
        <ListView
          sessions={sessions}
          onOpen={id => setRoute({ name: "detail", id })}
          onDelete={handleDelete}
          onToggleDraft={handleToggleDraft}
          allowDelete={allowDelete}
        />
      </div>
      {undoToast}
      {helpPanel}
    </Shell>
  );
}

/* ─── Report shell wrapper ─── for the canvas storyboards that render
   the deep `interview-result-focus` demos. They bring their own
   inner chrome; this wrap places them inside the Sessions Shell with
   a breadcrumb back to the parent session, so the user never loses
   the "I'm in Sessions" frame. */
export function ReportShellWrap({
  sessionLabel, children,
}: { sessionLabel: string; children: React.ReactNode }) {
  /* Visual seam: cream-toned header band carrying the breadcrumb +
     a "Shareable report" eyebrow + a horizontal rule, then the
     embedded interview-result-focus demo below. The rule is the
     intentional handoff — Sessions chrome above, deep result chrome
     below — so the discontinuity reads as "you've crossed into the
     report" rather than two products glued together. */
  return (
    <Shell active="Report">
      <div style={{ padding: "28px 56px 0", background: tok.cream }}>
        {/* Breadcrumb spans no longer carry cursor:pointer — the
           wrapping storyboard is a frozen demo without a router, and a
           pointer on a dead span is dishonest. Plain text label until
           the storyboard is wired to navigation. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: tok.inkSoft, marginBottom: 14 }}>
          <span>Sessions</span>
          <span style={{ color: tok.inkFaint }}>/</span>
          <span>{sessionLabel}</span>
          <span style={{ color: tok.inkFaint }}>/</span>
          <span style={{ color: tok.coal, fontWeight: 600 }}>Report</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: tok.copper, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>Shareable report</div>
          <div style={{ fontSize: 11, color: tok.inkFaint, fontFamily: fonts.mono }}>{sessionLabel}</div>
        </div>
        <div style={{ height: 1, background: tok.line, marginBottom: 0 }} />
      </div>
      {children}
    </Shell>
  );
}
