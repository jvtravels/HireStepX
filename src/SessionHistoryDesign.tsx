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

/* Tokens reference CSS custom properties set at the root of every
   rendered branch. This indirection is the entire theming system:
   `theme="editorial"` paints the original cream-on-coal canvas surface,
   `theme="hirestepx"` paints the production dark-luxury brand
   (obsidian / graphite / ivory / gilt + Instrument Serif).
   The hundreds of `tok.X` / `fonts.X` reads downstream never change. */
const tok = {
  cream: "var(--hsx-cream)",
  creamSoft: "var(--hsx-cream-soft)",
  white: "var(--hsx-white)",
  coal: "var(--hsx-coal)",
  ink: "var(--hsx-ink)",
  inkSoft: "var(--hsx-ink-soft)",
  inkFaint: "var(--hsx-ink-faint)",
  indigo: "var(--hsx-accent)",
  indigoDeep: "var(--hsx-accent-deep)",
  indigo100: "var(--hsx-accent-tint)",
  copper: "var(--hsx-warm)",
  copperSoft: "var(--hsx-warm-soft)",
  copper100: "var(--hsx-warm-tint)",
  success: "var(--hsx-success)",
  successSoft: "var(--hsx-success-soft)",
  error: "var(--hsx-error)",
  errorSoft: "var(--hsx-error-soft)",
  line: "var(--hsx-line)",
  lineStrong: "var(--hsx-line-strong)",
};

const fonts = {
  serif: "var(--hsx-font-serif)",
  ui: "var(--hsx-font-ui)",
  mono: "var(--hsx-font-mono)",
};

/* Theme palettes — concrete values resolved per `theme` prop. The
   editorial palette is the canvas-only design register (cream + Caslon
   + indigo). The HireStepX palette mirrors src/tokens.ts: obsidian
   surface, ivory text, gilt brand accent, Instrument Serif + Inter. */
export type SessionHistoryTheme = "editorial" | "hirestepx";

const THEMES: Record<SessionHistoryTheme, React.CSSProperties> = {
  editorial: {
    "--hsx-cream": "#FAF7F0",
    "--hsx-cream-soft": "#F4EFE3",
    "--hsx-white": "#FFFFFF",
    "--hsx-coal": "#0E0C08",
    "--hsx-ink": "#3E3A6E",
    "--hsx-ink-soft": "#6E6759",
    "--hsx-ink-faint": "#8A8270",
    "--hsx-accent": "#312E81",
    "--hsx-accent-deep": "#1E1B4B",
    "--hsx-accent-tint": "#E5E2F2",
    "--hsx-warm": "#B45309",
    "--hsx-warm-soft": "rgba(180,83,9,0.10)",
    "--hsx-warm-tint": "#F4E5D8",
    "--hsx-success": "#15803D",
    "--hsx-success-soft": "#DCFCE7",
    "--hsx-error": "#B91C1C",
    "--hsx-error-soft": "#FEE2E2",
    "--hsx-line": "#EBE5D2",
    "--hsx-line-strong": "#D6CDB5",
    "--hsx-font-serif": "'Caslon', 'Source Serif Pro', Georgia, serif",
    "--hsx-font-ui": "'Satoshi', -apple-system, system-ui, sans-serif",
    "--hsx-font-mono": "'JetBrains Mono', 'SF Mono', monospace",
  } as React.CSSProperties,
  hirestepx: {
    /* Production HireStepX brand — mirrors src/auth/_tokens.ts, the
       cream-mode editorial register that DashboardLayout and every
       other authenticated surface uses. Cream surface, coal ink,
       copper editorial accent, indigo interactive accent, Instrument
       Serif + Inter type pairing. inkFaint hardened to #7A7263 for
       WCAG AA on cream (the value that landed in the 2026-06 audit). */
    "--hsx-cream": "#FAF7F0",
    "--hsx-cream-soft": "#F4EFE3",
    "--hsx-white": "#FFFFFF",
    "--hsx-coal": "#0E0C08",
    "--hsx-ink": "#3E3A6E",
    "--hsx-ink-soft": "#6E6759",
    "--hsx-ink-faint": "#7A7263",
    "--hsx-accent": "#312E81",
    "--hsx-accent-deep": "#1E1B4B",
    "--hsx-accent-tint": "#E5E2F2",
    "--hsx-warm": "#B45309",
    "--hsx-warm-soft": "rgba(180,83,9,0.10)",
    "--hsx-warm-tint": "#F4E5D8",
    "--hsx-success": "#15803D",
    "--hsx-success-soft": "#DCFCE7",
    "--hsx-error": "#B91C1C",
    "--hsx-error-soft": "#FEE2E2",
    "--hsx-line": "#EBE5D2",
    "--hsx-line-strong": "#D6CDB5",
    "--hsx-font-serif": "'Instrument Serif', Georgia, serif",
    "--hsx-font-ui": "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    "--hsx-font-mono": "'JetBrains Mono', monospace",
  } as React.CSSProperties,
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
/* Hue map covers BOTH the prototype's canvas types and the real
   DashboardSession.type vocabulary from dashboardTypes.ts. Without
   the second set every real session row fell through to the gray
   default — visible color coding only worked for "Behavioral". */
type TypeName =
  | "Behavioral" | "System Design" | "Salary Neg." | "Tech Screen" | "Hiring Mgr"
  | "Strategic" | "Technical Leadership" | "Case Study"
  | "Campus Placement" | "HR Round" | "Management" | "Government & PSU";
const TYPE_HUE: Record<TypeName, { swatch: string; ink: string }> = {
  "Behavioral":           { swatch: "oklch(0.92 0.045 60)",  ink: "oklch(0.38 0.09 60)"  }, // warm amber
  "System Design":        { swatch: "oklch(0.92 0.045 265)", ink: "oklch(0.38 0.09 265)" }, // cool indigo
  "Salary Neg.":          { swatch: "oklch(0.92 0.045 35)",  ink: "oklch(0.38 0.09 35)"  }, // copper
  "Tech Screen":          { swatch: "oklch(0.92 0.045 175)", ink: "oklch(0.38 0.09 175)" }, // teal
  "Hiring Mgr":           { swatch: "oklch(0.92 0.045 340)", ink: "oklch(0.38 0.09 340)" }, // rose
  "Strategic":            { swatch: "oklch(0.92 0.045 285)", ink: "oklch(0.38 0.09 285)" }, // violet
  "Technical Leadership": { swatch: "oklch(0.92 0.045 200)", ink: "oklch(0.38 0.09 200)" }, // steel
  "Case Study":           { swatch: "oklch(0.92 0.045 130)", ink: "oklch(0.38 0.09 130)" }, // sage
  "Campus Placement":     { swatch: "oklch(0.92 0.045 90)",  ink: "oklch(0.38 0.09 90)"  }, // citron
  "HR Round":             { swatch: "oklch(0.92 0.045 15)",  ink: "oklch(0.38 0.09 15)"  }, // brick
  "Management":           { swatch: "oklch(0.92 0.045 245)", ink: "oklch(0.38 0.09 245)" }, // slate
  "Government & PSU":     { swatch: "oklch(0.92 0.045 155)", ink: "oklch(0.38 0.09 155)" }, // moss
};

/* Duration parser used both by the sort key and the practice-hours
   KPI. Accepts "42m", "1h 12m", "01:12:00", "1:12", "75 min", or any
   string starting with a number. Returns minutes; 0 if unparseable. */
function parseDurationMin(d: string | undefined | null): number {
  if (!d) return 0;
  const s = String(d).trim();
  // "HH:MM:SS" or "MM:SS"
  if (/^\d+:\d+(:\d+)?$/.test(s)) {
    const parts = s.split(":").map(n => parseInt(n, 10));
    if (parts.length === 3) return parts[0] * 60 + parts[1] + (parts[2] >= 30 ? 1 : 0);
    return parts[0] + (parts[1] >= 30 ? 1 : 0); // "MM:SS" — round up if seconds ≥ 30
  }
  // "1h 12m" / "1h" / "12m"
  const h = /(\d+)\s*h/i.exec(s);
  const m = /(\d+)\s*m/i.exec(s);
  if (h || m) return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
  // Leading number — assume minutes ("75 min", "42")
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
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
  /* Difficulty band passed through from DashboardSession. Surfaced inline
     in the row's metadata line so the score numeral has interpretive
     context: 82 on Hard is not 82 on Easy. Optional because the canvas
     mock predates the field and older persisted rows may lack it. */
  difficulty?: string;
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

/* Date-based grouping. NOW is passed in (pinned per render) so the
   buckets shift with the real clock instead of a build-time constant.
   The previous hardcoded NOW=2026-06-06 silently mis-bucketed every
   session as the build aged; a row from yesterday landed in "Today"
   because (pinned − actual) drifted negative. */
const DAY_MS = 24 * 60 * 60 * 1000;

const groupSessions = (items: Session[], now: number) => {
  const groups: Array<{ label: string; items: Session[] }> = [
    { label: "Today",     items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier",   items: [] },
  ];
  items.forEach(s => {
    const ageDays = (now - new Date(s.date).getTime()) / DAY_MS;
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
    /* Mobile timeline: tighten the rail to 56px (date stack drops the
       weekday, keeps "DD MMM"), shift the spine to x=13 to match the
       collapsed dot column, and kill the hover Re-run since touch
       can't reveal it. The eyebrow + headline + score wrap naturally
       inside the band. */
    .hsx-row { grid-template-columns: 56px 1fr !important; gap: 14px !important; padding: 18px 8px 18px 0 !important; }
    .hsx-row::before { left: 13px !important; }
    .hsx-row:first-of-type::before { top: 26px !important; }
    .hsx-row:last-of-type::before { bottom: calc(100% - 26px) !important; }
    .hsx-row-rerun { display: none !important; }
    .hsx-row-mobile-hide { display: none !important; }
    .hsx-report-split { grid-template-columns: 1fr !important; }
    .hsx-report-pair { grid-template-columns: 1fr !important; }
  }

  /* Touch-pointer hit target normalisation. Triggers on coarse
     pointer (phones, tablets) at any width, plus the responsive
     breakpoint as a belt-and-braces. */
  @media (pointer: coarse), (max-width: 768px) {
    .hsx-touch { min-width: 44px !important; min-height: 44px !important; }
  }

  /* Embedded mode (route under DashboardLayout) — the outer <main>
     already provides 44px 52px page padding and a 260px left rail
     offset. The view's own padding is redundant and stacks into a
     200px+ gutter that doesn't match DashboardHome / Analytics /
     Calendar. Strip the inner padding and let content center at the
     dashboard's canonical maxWidth so /sessions sits in the same
     rhythm as the rest of the authenticated app. */
  .hsx-root[data-embedded="true"] .hsx-pad,
  .hsx-root[data-embedded="true"] .hsx-pad-detail,
  .hsx-root[data-embedded="true"] .hsx-pad-report {
    padding: 0 !important;
    max-width: 1280px !important;
    margin: 0 auto !important;
  }
  .hsx-root[data-embedded="true"] .hsx-pad-empty {
    /* Empty state keeps its vertical breathing room (the surface
       is mostly air) but loses the horizontal pad so it can center
       under DashboardLayout's gutter. */
    padding: 56px 0 !important;
    margin: 0 auto !important;
  }

  /* Primary CTA hover/active — mirrors DashboardHome's behaviour:
     deeper indigo + slight lift on hover, no lift on press. Touch
     devices skip the hover state so the deeper colour doesn't get
     stuck after tap. */
  .hsx-cta-primary {
    transition: background 140ms cubic-bezier(0.22,1,0.36,1),
                box-shadow 140ms cubic-bezier(0.22,1,0.36,1),
                transform 140ms cubic-bezier(0.22,1,0.36,1);
  }
  @media (hover: hover) {
    .hsx-cta-primary:hover {
      background: var(--hsx-accent-deep) !important;
      box-shadow: 0 6px 20px rgba(49,46,129,0.24) !important;
      transform: translateY(-1px);
    }
  }
  .hsx-cta-primary:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(49,46,129,0.18) !important;
  }

  /* Theme posture: this surface is committed to cream-on-coal in
     every theme. Single-theme by design — the brand IS the warmth
     of the paper. System dark-mode is intentionally ignored;
     darkening the cream would destroy the editorial register. */

  /* ── Editorial timeline chronicle ──
     The /sessions row is a band attached to a vertical timeline spine,
     not a card. The first column is a 88px rail carrying a status dot
     and a date stack; a 1px spine runs through the rail's dot column,
     connecting every row in a group into a single continuous chronicle.
     The second column is the band: mono eyebrow (type · difficulty ·
     Qs · duration), serif headline (role at company), tabular score
     and delta on the right, optional signal line, and a hover-revealed
     Re-run absolutely positioned bottom-right (reserves zero layout
     space). Selection paints a 2px indigo bar on the left edge of the
     band; spine and dot stay calm so the whole timeline doesn't shout.
     Anchors: Substack archive view, Read.cv timelines, NYT TOC. Not
     a Strava activity card, not a Linear list row. */
  .hsx-row {
    position: relative;
    cursor: pointer;
    transition: background 120ms cubic-bezier(0.22,1,0.36,1);
  }
  /* Vertical spine: 1px line at x=19 (rail starts at row-left=0; the
     dot sits at x=15..23, so 19 is the dot's center). Spans the row's
     full height; first/last child in the group clip to the dot so the
     spine doesn't dangle into the section header or below the group. */
  .hsx-row::before {
    content: "";
    position: absolute;
    left: 19px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--hsx-line);
    pointer-events: none;
  }
  .hsx-row:first-of-type::before { top: 32px; }
  .hsx-row:last-of-type::before { bottom: calc(100% - 32px); }
  @media (hover: hover) {
    .hsx-row:hover { background: var(--hsx-cream-soft); }
    .hsx-row:hover .hsx-row-rerun {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .hsx-row[data-selected="true"] {
    box-shadow: inset 2px 0 0 var(--hsx-accent);
  }
  /* Dot sits above the spine. PR rows wear an indigo dot with a soft
     halo; BEST rows stay coal; drafts swap the fill for a copper ring
     so unfinished work reads as "open" at a glance. */
  .hsx-row-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--hsx-coal);
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }
  .hsx-row[data-draft="true"] .hsx-row-dot {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--hsx-warm);
  }
  .hsx-row[data-pr="true"] .hsx-row-dot {
    background: var(--hsx-accent);
    box-shadow: 0 0 0 3px var(--hsx-accent-tint);
  }
  /* Re-run lives in the band's bottom-right, absolutely positioned so
     it reserves no vertical space when hidden. Slides in from +4px on
     hover/focus; tabIndex=-1 on the button keeps j/k navigation on
     row-granularity (use the r shortcut to fire it on the selected
     row instead). */
  .hsx-row-rerun {
    position: absolute;
    right: 16px;
    bottom: 20px;
    opacity: 0;
    transform: translateX(4px);
    transition: opacity 140ms cubic-bezier(0.22,1,0.36,1),
                transform 140ms cubic-bezier(0.22,1,0.36,1);
  }
  .hsx-row-rerun:focus-visible {
    opacity: 1;
    transform: translateX(0);
  }
`;

/* ScoreRing was removed when the row was rebuilt as an editorial index
   entry. A ring implies "progress to 100", but a single mock score
   isn't progress — it's a reading. The row now lets the score numeral
   itself be the focal point in a right-aligned rail, with a mono
   delta beneath it for trend context. */

/* ─── Shell ─── */
function Shell({ active, onHelp, embedded, theme = "editorial", children }: { active: "Sessions" | "Detail" | "Report"; onHelp?: () => void; embedded?: boolean; theme?: SessionHistoryTheme; children: React.ReactNode }) {
  const themeVars = THEMES[theme];
  /* Embedded mode: the route already lives inside DashboardLayout,
     which provides the real app sidebar AND the main landmark. We
     strip the design's rail, skip-link, and <main> so we don't ship
     duplicate landmarks; the outer layout owns those. The wrapper is
     a plain <div> that just carries the theme vars and the page body. */
  if (embedded) {
    return (
      <div className="hsx-root" data-embedded="true" style={{ ...themeVars, background: tok.cream, color: tok.coal, fontFamily: fonts.ui, minHeight: "auto", position: "relative" }}>
        <style>{FOCUS_STYLE}</style>
        {children}
      </div>
    );
  }
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
    <div className="hsx-root" style={{ ...themeVars, display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: tok.cream, color: tok.coal, fontFamily: fonts.ui, position: "relative" }}>
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

function ListView({ sessions, onOpen, onDelete, onToggleDraft, allowDelete = true, allowDrafts = true, onStartSession, onRerun }: {
  sessions: Session[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleDraft: (id: string) => void;
  /* When false, the destructive Delete affordance is suppressed (no
     /api/sessions/delete endpoint exists yet, so a "deleted" row
     would reappear on reload). The kebab menu was removed entirely
     when the row was rebuilt — the prop is kept so the keyboard
     Backspace handler can still gate on capability and a future
     detail-view Delete can be wired without changing this signature. */
  allowDelete?: boolean;
  /* When false, the `d` keyboard shortcut, drafts toggle, and the
     drafts row are all suppressed. DashboardSession has no `draft`
     column today, so toggling it would only flip local React state
     that vanishes on refresh — worse than not offering it. */
  allowDrafts?: boolean;
  /* Optional handoff to interview setup; when undefined the New
     session button hides rather than dangle as a dead affordance. */
  onStartSession?: () => void;
  /* Optional handoff for the row's hover-revealed "Re-run" affordance.
     Called with the source session so the consumer can carry type /
     role / company / difficulty into the new interview's setup. When
     undefined the Re-run button is suppressed (canvas mode). */
  onRerun?: (session: Session) => void;
}) {
  /* now is captured once per ListView mount so the date-bucket math
     stays deterministic within a render pass. We intentionally don't
     re-tick: a row shifting from "Today" → "Yesterday" mid-session
     while the user is reading would be jarring. */
  const now = React.useMemo(() => Date.now(), []);
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
  /* Start at -1 so the j/k keyboard cursor is invisible on first
     render. The previous default (0) painted a coal border around the
     first row before the user had pressed anything, which read as a
     stuck "selected" state. The cursor appears the moment the user
     hits j/k or hovers a row. */
  const [selectedIdx, setSelectedIdx] = React.useState<number>(-1);
  const searchRef = React.useRef<HTMLInputElement>(null);

  /* ── Milestone badges (PR / BEST) ──
     Industry-standard scored-practice surfaces (Strava activities,
     Peloton class history, LeetCode submissions) put a single
     achievement badge next to the result. We compute two:
       PR   — globally highest score across all completed sessions.
       BEST — highest score in its type, when not also the PR.
     Precedence: PR > BEST. Each session gets at most one badge so
     the row stays calm. Ties on score resolve to the most recent
     session, so improvement-with-a-recent-tie still earns the
     badge (and matches user mental model of "your latest best"). */
  const badgeById = React.useMemo(() => {
    const map = new Map<string, "PR" | "BEST">();
    const completed = sessions.filter(s => !s.draft);
    if (completed.length === 0) return map;
    const tieBreak = (a: Session, b: Session) =>
      b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime();
    const pr = completed.slice().sort(tieBreak)[0];
    if (pr) map.set(pr.id, "PR");
    const bestByType = new Map<string, Session>();
    for (const s of completed) {
      const cur = bestByType.get(s.type);
      if (!cur || tieBreak(s, cur) < 0) bestByType.set(s.type, s);
    }
    bestByType.forEach(s => { if (!map.has(s.id)) map.set(s.id, "BEST"); });
    return map;
  }, [sessions]);

  /* ── Spaced-repetition "Due for review" cue ──
     HireStepX's signature feature is skill-decay tracking. We surface
     it on the row when a session's topGap matches the topGap of the
     immediately-prior session of the same type — the user got the
     same coach note twice in a row, so the gap is *recurring*, not
     incidental. The most-recent occurrence is the one to act on;
     older recurrences stay quiet so the list doesn't flood with
     copper hints. */
  const dueIds = React.useMemo(() => {
    const due = new Set<string>();
    const byType: Record<string, Session[]> = {};
    sessions.filter(s => !s.draft && s.topGap).forEach(s => {
      (byType[s.type] ??= []).push(s);
    });
    Object.values(byType).forEach(arr => {
      arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (arr.length >= 2 && arr[0].topGap && arr[0].topGap === arr[1].topGap) {
        due.add(arr[0].id);
      }
    });
    return due;
  }, [sessions]);

  /* ── First-of-type delta suppression ──
     A "+0 vs prev" delta on the very first session of a type reads as
     "you stayed flat" when there's nothing to compare against. Compute
     the chronologically-earliest session per type and suppress its
     delta in the row's right rail. Upstream `change` may still be 0
     for legitimate ties on subsequent sessions, so we can't rely on
     it alone. */
  const firstOfTypeIds = React.useMemo(() => {
    const firsts = new Set<string>();
    const byType: Record<string, Session[]> = {};
    sessions.filter(s => !s.draft).forEach(s => {
      (byType[s.type] ??= []).push(s);
    });
    Object.values(byType).forEach(arr => {
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (arr[0]) firsts.add(arr[0].id);
    });
    return firsts;
  }, [sessions]);

  /* Date-stack formatter for the row's left rail. "DD MMM" over
     "WEEKDAY" — industry-standard for chronicled lists (NYT TOC,
     Stripe Dashboard transactions). Locale-stable: en-US short month,
     short weekday, uppercase so the eyebrow reads as catalog metadata
     rather than copy. Returns empty strings on unparseable dates so
     the row still renders without throwing. */
  const formatDateStack = React.useCallback((iso: string): { top: string; bot: string } => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { top: "", bot: "" };
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const wkd = d.toLocaleString("en-US", { weekday: "long" }).toUpperCase();
    return { top: `${day} ${mon}`, bot: wkd };
  }, []);

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
      if (sort === "duration") return parseDurationMin(b.duration) - parseDurationMin(a.duration);
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
      /* `d` toggles draft only when the capability is enabled.
         DashboardSession has no `draft` column, so a flip would be
         purely local React state — visible until the next refresh,
         then gone. Worse than not offering the shortcut. */
      else if (e.key === "d" && allowDrafts) {
        const s = filtered[selectedIdx];
        if (s) { e.preventDefault(); onToggleDraft(s.id); }
      }
      /* Backspace/Delete gated on allowDelete for the same reason:
         no delete API → a "deleted" row would reappear on reload. */
      else if ((e.key === "Backspace" || e.key === "Delete") && allowDelete) {
        const s = filtered[selectedIdx];
        if (s) { e.preventDefault(); onDelete(s.id); }
      }
      /* `r` re-runs the selected session. Pairs with the hover-revealed
         Re-run button on the row so the affordance is accessible to
         keyboard users without giving the button its own tab stop
         (which would interrupt j/k row navigation). */
      else if (e.key === "r" && onRerun) {
        const s = filtered[selectedIdx];
        if (s && !s.draft) { e.preventDefault(); onRerun(s); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedIdx, onOpen, onDelete, onToggleDraft, onRerun, allowDelete, allowDrafts]);

  const groups = groupSessions(filtered, now);
  const total = sessions.length;
  const avg = total > 0 ? Math.round(sessions.reduce((s, x) => s + x.score, 0) / total) : 0;
  const best = total > 0 ? Math.max(...sessions.map(s => s.score)) : 0;
  /* Real practice hours from actual durations. The previous
     `(total * 42 / 60)` was a literal-42-minutes-per-session
     fabrication that drifted further from truth the more varied a
     user's history got. Uses parseDurationMin so the math works for
     any duration format the DashboardSession persists. */
  const totalMinutes = sessions.reduce((sum, s) => sum + parseDurationMin(s.duration), 0);
  const hours = (totalMinutes / 60).toFixed(1);
  /* "Latest" must be the most recent by date, not the array head.
     DashboardContext sorts recent-first today, but pinning to date
     here means we can't be regressed by an upstream reorder. */
  const latest = total > 0
    ? sessions.reduce(
        (top, s) => new Date(s.date).getTime() > new Date(top.date).getTime() ? s : top,
        sessions[0],
      )
    : null;
  /* Best (score) and its context — surfaced in the N≥3 KPI hint. */
  const bestSession = total > 0
    ? sessions.reduce((top, s) => s.score > top.score ? s : top, sessions[0])
    : null;
  const draftCount = allowDrafts ? sessions.filter(s => s.draft).length : 0;
  const showingFiltered = type !== "All" || query.trim() !== "";
  return (
    <div className="hsx-pad" style={{ padding: "40px 56px", maxWidth: 1200 }}>
      {/* Hero atoms aligned to DashboardHome: mono eyebrow (11px / 500 /
         letterSpacing 0.8 / inkSoft), serif h1 with the clamp scale and
         weight 400 the rest of the dashboard uses, copper-italic accent
         inside the headline, and 15px body copy capped at 560 to match
         "Welcome back" rhythm. Anything different from that here reads
         as a foreign surface even when the palette matches. */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 28, gap: 24, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ display: "inline-block", fontFamily: fonts.mono, fontSize: 11, fontWeight: 500, color: tok.inkSoft, letterSpacing: 0.8, textTransform: "uppercase" }}>Sessions</span>
          <h1 style={{
            fontFamily: fonts.serif, fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 400,
            lineHeight: 1.1, letterSpacing: "-0.02em", color: tok.coal,
            margin: "8px 0 6px",
          }}>
            Your <em style={{ fontStyle: "italic", fontWeight: 400, color: tok.copper }}>practice log</em>.
          </h1>
          <p style={{ fontFamily: fonts.ui, fontSize: 15, color: tok.inkSoft, margin: 0, maxWidth: 560, lineHeight: 1.55 }}>
            Every mock interview, scored and stored. Open any row to revisit.
          </p>
        </div>
        {/* Primary CTA mirrors DashboardHome's PrimaryCta atom
           exactly — indigo fill (not coal — coal was the dark-luxury
           idiom), white text, radius 12, weight 600, letterSpacing
           0.1, minHeight 44, subtle shadow, arrow-right icon on the
           right edge (not a leading "+"). This is the brand's CTA
           shape, used everywhere from the dashboard hero down. */}
        {onStartSession && (
          <button
            type="button"
            onClick={onStartSession}
            className="hsx-cta-primary"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 22px", borderRadius: 12, border: "none", cursor: "pointer",
              background: tok.indigo, color: tok.white,
              fontFamily: fonts.ui, fontSize: 14, fontWeight: 600, letterSpacing: 0.1,
              boxShadow: "0 4px 16px rgba(49,46,129,0.18)", minHeight: 44,
            }}
          >
            <span>New session</span>
            <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </header>

      {/* KPI strip — persona-aware. With fewer than 3 sessions the
         aggregates ("Best score: 86 · Behavioral · Razorpay") are
         technically true but conversationally empty; we swap them
         for coaching copy that scales with what we actually know.
         Once N ≥ 3 the full aggregates earn their place. */}
      <div className="hsx-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {(total < 3 ? [
          { label: "Sessions so far", value: String(total), hint: total === 0 ? "Start one to begin tracking." : "Three sessions unlocks trend metrics." },
          /* Latest score reads from `latest` (date-sorted) and falls
             back to type-only when company is missing — "Behavioral ·"
             with a dangling glyph reads as data corruption. */
          { label: "Latest score",    value: latest ? String(latest.score) : "—", hint: latest ? (latest.company ? `${latest.type} · ${latest.company}` : latest.type) : "No sessions yet" },
          { label: "Next step",       value: "Practice", hint: "Pick a round to start the streak." },
          { label: "Practice hours",  value: hours,         hint: "Goal: 8h / month" },
        ] : [
          { label: "Total sessions",  value: String(total),  hint: `${draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? "" : "s"}` : "All complete"}` },
          { label: "Average score",   value: String(avg),    hint: "Across all sessions" },
          /* Best-score hint comes from the real `bestSession`, not
             a hardcoded "Behavioral · Razorpay" string left over
             from the prototype. */
          { label: "Best score",      value: String(best),   hint: bestSession ? (bestSession.company ? `${bestSession.type} · ${bestSession.company}` : bestSession.type) : "" },
          { label: "Practice hours",  value: hours,          hint: "Goal: 8h / month" },
        ]).map(k => (
          /* KPI cell aligned to DashboardHome's stat treatment:
             mono Eyebrow (11/500/0.8) → serif numeral (editorial,
             not heavy mono) → 13px hint. Lighter borders, softer
             rhythm — matches the recent-sessions panel idiom rather
             than the dark-luxury "metric tile" pattern. */
          <div key={k.label} style={{
            padding: "16px 18px", background: tok.white,
            border: `1px solid ${tok.line}`, borderRadius: radii.card,
          }}>
            <div style={{ fontFamily: fonts.mono, fontSize: 11, color: tok.inkSoft, fontWeight: 500, letterSpacing: 0.8, textTransform: "uppercase" }}>{k.label}</div>
            <div style={{ fontFamily: fonts.serif, fontSize: 30, fontWeight: 400, marginTop: 6, color: tok.coal, lineHeight: 1.05, letterSpacing: "-0.01em" }}>{k.value}</div>
            <div style={{ fontFamily: fonts.ui, fontSize: 13, color: tok.inkSoft, marginTop: 6, lineHeight: 1.4 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Saved-view preset chips removed per product call: they
         duplicated affordances already covered by the type pills +
         sort cycle below, and visually competed with the KPI strip
         above. The same lenses are reachable in one or two clicks
         from the existing filter row. */}

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
              /* ── Timeline band composition ──
                 Two columns: rail (88px) · band (1fr). The rail carries
                 a status dot + date stack; the spine pseudo on .hsx-row
                 connects every dot in the group into a continuous line.
                 The band carries a mono catalog eyebrow, a serif headline
                 (role-at-company — the actual practice subject), a
                 right-aligned score reading, and an optional signal
                 line. Re-run is absolutely positioned bottom-right and
                 reserves zero vertical space. */
              const idxInFiltered = filtered.findIndex(x => x.id === s.id);
              const isSelected = idxInFiltered === selectedIdx;
              const ds = formatDateStack(s.date);
              const badge = badgeById.get(s.id) ?? null;
              const isDue = dueIds.has(s.id);
              const isFirstOfType = firstOfTypeIds.has(s.id);
              /* Catalog eyebrow. Type leads (it's the category), then
                 the parameters that contextualize the score. All in mono
                 caps so the eyebrow reads as metadata, not headline. */
              const eyebrowParts = [
                s.type,
                s.difficulty,
                s.questions ? `${s.questions} Qs` : null,
                s.duration,
              ].filter(Boolean) as string[];
              /* Signal copy. Score≥80 surfaces the strength; <80 the gap;
                 due rows lead with a copper "Due for review ·" prefix.
                 No .toLowerCase() — topStrength comes from coach output
                 in title case ("Active Listening", "STAR Structure")
                 and forcing lower mangles proper nouns. Cap at 72 chars
                 so the band stays one line. */
              const cap = (str: string, n = 72) => str.length <= n ? str : `${str.slice(0, n - 1).trimEnd()}…`;
              const signalText = !s.draft
                ? (s.score >= 80
                    ? (s.topStrength ? cap(`Strong on ${s.topStrength}`) : "")
                    : (s.topGap ? cap(`Work on ${s.topGap}`) : ""))
                : "";
              /* Delta direction → semantic accent. Up wins indigo
                 (interactive accent = forward momentum); down wins copper
                 (editorial accent = caution); flat is inkSoft. */
              const deltaSign: "up" | "down" | "flat" =
                s.delta > 0 ? "up" : s.delta < 0 ? "down" : "flat";
              const deltaAria =
                deltaSign === "up" ? `up ${s.delta} from previous`
                : deltaSign === "down" ? `down ${Math.abs(s.delta)} from previous`
                : "no change from previous";
              return (
              <div
                key={s.id}
                className="hsx-row"
                role="listitem"
                tabIndex={0}
                aria-current={isSelected ? "true" : undefined}
                data-selected={isSelected ? "true" : "false"}
                data-draft={s.draft ? "true" : "false"}
                data-pr={badge === "PR" ? "true" : "false"}
                onClick={() => onOpen(s.id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(s.id); } }}
                onMouseEnter={() => setSelectedIdx(idxInFiltered)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "88px 1fr",
                  gap: 28, alignItems: "start",
                  padding: "24px 16px 24px 0",
                  background: "transparent",
                  opacity: s.draft ? 0.78 : 1,
                }}>
                {/* ── Rail: dot + date stack ──
                   Dot sits at the top so it aligns with the band's eyebrow
                   baseline (paddingTop on rail matches the eyebrow's
                   vertical position). Date stack reads top-down: serif
                   day-month, mono weekday, mono "N days ago". Draft swaps
                   the date for an italic copper "Draft" eyebrow. */}
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "flex-start", gap: 10,
                  paddingTop: 6, paddingLeft: 11,
                  /* paddingLeft positions the dot column so its center
                     lands on the spine at x=19 (11 + 4 + halfDot). */
                }}>
                  <span aria-hidden="true" className="hsx-row-dot" />
                  {s.draft ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: -7 }}>
                      <span style={{
                        fontFamily: fonts.serif, fontStyle: "italic",
                        fontSize: 16, color: tok.copper, fontWeight: 400,
                        letterSpacing: "0.005em", lineHeight: 1.1,
                      }}>Draft</span>
                      <span style={{
                        fontFamily: fonts.mono, fontSize: 10, fontWeight: 500,
                        color: tok.inkSoft, letterSpacing: "0.14em",
                      }}>IN PROGRESS</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: -7 }}>
                      <span style={{
                        fontFamily: fonts.serif, fontSize: 18, fontWeight: 400,
                        color: tok.coal, letterSpacing: "-0.005em", lineHeight: 1.05,
                      }}>{ds.top}</span>
                      <span className="hsx-row-mobile-hide" style={{
                        fontFamily: fonts.mono, fontSize: 10, fontWeight: 500,
                        color: tok.inkSoft, letterSpacing: "0.14em",
                      }}>{ds.bot.slice(0, 3)}</span>
                      <span className="hsx-row-mobile-hide" style={{
                        fontFamily: fonts.mono, fontSize: 10, fontWeight: 400,
                        color: tok.inkFaint, letterSpacing: "0.04em",
                        marginTop: 1,
                      }}>{s.dateLabel}</span>
                    </div>
                  )}
                </div>

                {/* ── Band: eyebrow, headline+score row, signal ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, paddingRight: 8 }}>
                  {/* Eyebrow row: catalog metadata left, badge right. */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minWidth: 0 }}>
                    <span style={{
                      fontFamily: fonts.mono, fontSize: 10, fontWeight: 600,
                      color: tok.inkSoft, letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{eyebrowParts.join("  ·  ")}</span>
                    {badge && !s.draft ? (
                      <span style={{
                        padding: "2px 8px",
                        fontFamily: fonts.mono, fontSize: 10, fontWeight: 600,
                        color: badge === "PR" ? tok.indigo : tok.coal,
                        letterSpacing: "0.14em",
                        border: `1px solid ${badge === "PR" ? tok.indigo : tok.lineStrong}`,
                        borderRadius: 2,
                        flexShrink: 0,
                      }}>{badge}</span>
                    ) : null}
                  </div>

                  {/* Headline row: role-at-company (the practice subject)
                     paired with the score reading on the right. The two
                     align on the headline baseline so the score sits as
                     a margin note, not a hero numeral. */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 24, alignItems: "baseline", minWidth: 0,
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontFamily: fonts.serif, fontSize: 26, fontWeight: 400,
                      color: tok.coal, lineHeight: 1.15,
                      letterSpacing: "-0.01em",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.role}
                      {s.company ? (
                        <>
                          <em style={{ fontStyle: "italic", color: tok.copper, fontWeight: 400 }}> at </em>
                          <span style={{ color: tok.coal }}>{s.company}</span>
                        </>
                      ) : null}
                    </h3>
                    {/* Score reading. Same serif family as the headline
                       so it lives in the editorial column, not the
                       dashboard-metric column. Tabular nums so 87 and
                       100 align vertically across rows. Em dash on draft
                       — reading isn't in yet. */}
                    <div style={{
                      display: "flex", flexDirection: "column",
                      alignItems: "flex-end", gap: 2,
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontFamily: fonts.serif, fontSize: 28,
                        color: s.draft ? tok.inkFaint : tok.coal,
                        lineHeight: 1, fontWeight: 400,
                        fontVariantNumeric: "tabular-nums",
                      }}>{s.draft ? "—" : s.score}</span>
                      {!s.draft && !isFirstOfType ? (
                        <span
                          aria-label={deltaAria}
                          style={{
                            fontFamily: fonts.mono, fontSize: 11, fontWeight: 600,
                            color: deltaSign === "up" ? tok.indigo
                                 : deltaSign === "down" ? tok.copper
                                 : tok.inkSoft,
                            letterSpacing: "0.04em",
                            fontVariantNumeric: "tabular-nums",
                          }}>
                          {deltaSign === "up" ? `▲ ${s.delta}`
                           : deltaSign === "down" ? `▼ ${Math.abs(s.delta)}`
                           : "= 0"}
                        </span>
                      ) : !s.draft && isFirstOfType ? (
                        <span style={{
                          fontFamily: fonts.mono, fontSize: 10, fontWeight: 500,
                          color: tok.inkFaint, letterSpacing: "0.10em",
                        }}>FIRST</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Signal line OR draft note. One line only; truncated
                     if it can't fit. Spaced from the headline so the
                     hover-revealed Re-run doesn't collide visually. */}
                  {signalText ? (
                    <p style={{
                      margin: 0,
                      fontSize: 13, color: tok.coal, lineHeight: 1.4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      paddingRight: 140, /* reserve room for the absolute Re-run on hover */
                    }}>
                      {isDue ? (
                        <em style={{
                          fontStyle: "italic", color: tok.copper,
                          fontFamily: fonts.serif, fontSize: 14, marginRight: 6,
                        }}>Due for review ·</em>
                      ) : null}
                      <span>{signalText}</span>
                    </p>
                  ) : s.draft ? (
                    <p style={{ margin: 0, fontSize: 13, color: tok.inkSoft, fontStyle: "italic" }}>
                      Saved mid-round, ready to continue.
                    </p>
                  ) : null}
                </div>

                {/* Re-run lives at row scope so its absolute positioning
                   anchors to the row's box, not the band column. Hover
                   on the row reveals it (CSS); `r` on a selected row
                   triggers it (keyboard handler). tabIndex=-1 keeps it
                   out of the Tab order so j/k row navigation isn't
                   interrupted by an interior focus stop. */}
                {onRerun && !s.draft ? (
                  <button
                    className="hsx-row-rerun"
                    type="button"
                    tabIndex={-1}
                    onClick={e => { e.stopPropagation(); onRerun(s); }}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
                    aria-label={`Practice ${s.type} again`}
                    style={{
                      padding: "6px 10px",
                      border: `1px solid ${tok.line}`,
                      borderRadius: radii.btn,
                      background: tok.cream,
                      color: tok.indigo, fontFamily: fonts.ui,
                      fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
                      cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                    <span>Practice again</span>
                    <svg aria-hidden width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : null}
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
          const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(s.date).getTime()) / DAY_MS));
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

/* ─── Empty state ───
   Aligned to DashboardHome's hero rhythm: mono Eyebrow → serif clamp
   h1 weight 400 with copper italic accent → 15px body. Primary CTA
   is the indigo brand button (radius 12, weight 600, arrow-right,
   minHeight 44). Secondary lives as a quiet text affordance below. */
function EmptyView({ onStart }: { onStart: () => void }) {
  return (
    <div className="hsx-pad-empty" style={{ padding: "120px 56px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 88, height: 88, borderRadius: radii.pill, background: tok.copperSoft, color: tok.copper, display: "grid", placeItems: "center", fontSize: 36, margin: "0 auto 28px" }}>◷</div>
      <span style={{ display: "inline-block", fontFamily: fonts.mono, fontSize: 11, fontWeight: 500, color: tok.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>No sessions yet</span>
      <h1 style={{
        fontFamily: fonts.serif, fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 400,
        lineHeight: 1.1, letterSpacing: "-0.02em", color: tok.coal, margin: "8px 0 6px",
      }}>
        Your <em style={{ fontStyle: "italic", fontWeight: 400, color: tok.copper }}>practice log</em> starts here.
      </h1>
      <p style={{ fontFamily: fonts.ui, fontSize: 15, color: tok.inkSoft, marginTop: 14, lineHeight: 1.6, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
        Every round you take with HireStepX gets recorded, scored, and turned into a shareable report.
        Start with a 15-minute behavioral; we'll tune the questions to your resume.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", marginTop: 28 }}>
        <button
          type="button"
          onClick={onStart}
          className="hsx-cta-primary"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "14px 22px", borderRadius: 12, border: "none", cursor: "pointer",
            background: tok.indigo, color: tok.white,
            fontFamily: fonts.ui, fontSize: 14, fontWeight: 600, letterSpacing: 0.1,
            boxShadow: "0 4px 16px rgba(49,46,129,0.18)", minHeight: 44,
          }}
        >
          <span>Start your first session</span>
          <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
        <span style={{ fontSize: 12, color: tok.inkFaint, fontFamily: fonts.ui }}>
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
function HelpPanel({ onClose, allowDelete = true, allowDrafts = true }: { onClose: () => void; allowDelete?: boolean; allowDrafts?: boolean }) {
  useEsc(onClose);
  /* Action rows filtered by capability so the panel never advertises
     a shortcut that won't fire. In route mode both flags are false,
     so the Actions group collapses to just the row-menu hint. */
  const actionRows: Array<[string, string]> = [
    ...(allowDrafts ? [["d", "mark as draft (or unmark)"]] as Array<[string, string]> : []),
    ...(allowDelete ? [["⌫  delete", "remove session (6s undo)"]] as Array<[string, string]> : []),
    ["⋯", "open row menu"],
  ];
  const keyGroups: Array<{ title: string; rows: Array<[string, string]> }> = [
    { title: "Navigate", rows: [
      ["/",            "focus search"],
      ["j  k",         "move selection up / down"],
      ["enter",        "open selected session"],
      ["esc",          "back / close"],
      ["shift + /",    "open this panel"],
    ]},
    { title: "Actions on a row", rows: actionRows },
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
  /* When true, the design's internal left rail is suppressed and only
     the page body renders. Use this when mounting under an outer app
     chrome (e.g. /sessions inside DashboardLayout) that already
     provides a sidebar — otherwise the user sees two stacked rails. */
  embedded?: boolean;
  /* Theme palette. "editorial" (default) renders the canvas cream-on-
     coal register; "hirestepx" renders the production dark-luxury
     brand (obsidian / ivory / gilt + Instrument Serif). The route
     wrapper sets "hirestepx" so /sessions matches the rest of the app
     chrome; canvas storyboards keep "editorial". */
  theme?: SessionHistoryTheme;
  /* Wire the "New session" / Empty-state CTAs to whatever route hands
     off to interview setup. The canvas leaves this undefined so the
     buttons no-op (storyboards never navigate); the route wrapper
     plumbs `router.push("/interview")`. When undefined, the New
     session button hides rather than dangling as a dead affordance. */
  onStartSession?: () => void;
  /* Wire the row's hover-revealed "Practice this again" affordance. The
     route wrapper hands this off to /interview with the original
     session's type / role / company / difficulty so the user lands in a
     pre-populated setup. When undefined the affordance is suppressed
     (canvas mode). Industry-standard re-do pattern (Duolingo "Practice
     again", LeetCode "Solve again", Peloton "Take again"). */
  onRerun?: (session: SessionHistoryItem) => void;
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

export default function SessionHistoryDesign({ variant = "list", initialSessions, allowDelete = true, allowReport = true, embedded = false, theme = "editorial", onStartSession, onRerun }: SessionHistoryDesignProps) {
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
  const helpPanel = helpOpen ? <HelpPanel onClose={() => setHelpOpen(false)} allowDelete={allowDelete} allowDrafts={allowDelete} /> : null;

  /* View-change animation wrapper. Keyed on `route.name` so a route
     change forces a remount and replays the keyframe. Wraps just the
     view body, not the Shell, so the sidebar and chrome stay still
     while the content area transitions. */
  if (route.name === "detail") {
    /* In embedded (route) mode we DON'T fall back to the canvas
       prototype's INITIAL_SESSIONS[0] — a stale deep-link would
       otherwise show a hardcoded "Senior PM @ Razorpay" row as if
       it were the user's. Bounce back to the list instead. The
       canvas keeps the fallback so storyboards still render. */
    const s = sessions.find(x => x.id === route.id)
      ?? (embedded ? sessions[0] ?? null : sessions[0] ?? INITIAL_SESSIONS[0]);
    if (!s) {
      return (
        <Shell active="Sessions" onHelp={() => setHelpOpen(true)} embedded={embedded} theme={theme}>
          <div key="empty" className="hsx-anim-view">
            <EmptyView onStart={onStartSession ?? (() => { /* canvas mode: no-op */ })} />
          </div>
          {helpPanel}
        </Shell>
      );
    }
    return (
      <Shell active="Detail" onHelp={() => setHelpOpen(true)} embedded={embedded} theme={theme}>
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
    /* Same fallback policy as detail — no canvas-mock leak in
       route mode. */
    const s = sessions.find(x => x.id === route.id)
      ?? (embedded ? sessions[0] ?? null : sessions[0] ?? INITIAL_SESSIONS[0]);
    if (!s) {
      /* Same empty bounce as detail. Can't call setRoute during
         render — would set-state-during-render. The user can
         navigate back via the rail / browser back. */
      return (
        <Shell active="Sessions" onHelp={() => setHelpOpen(true)} embedded={embedded} theme={theme}>
          <div key="empty" className="hsx-anim-view">
            <EmptyView onStart={onStartSession ?? (() => { /* canvas mode: no-op */ })} />
          </div>
          {helpPanel}
        </Shell>
      );
    }
    return (
      <Shell active="Report" onHelp={() => setHelpOpen(true)} embedded={embedded} theme={theme}>
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
      <Shell active="Sessions" onHelp={() => setHelpOpen(true)} embedded={embedded} theme={theme}>
        <div key="empty" className="hsx-anim-view">
          <EmptyView onStart={() => { /* hand off to interview-setup */ }} />
        </div>
        {helpPanel}
      </Shell>
    );
  }
  return (
    <Shell active="Sessions" onHelp={() => setHelpOpen(true)} embedded={embedded} theme={theme}>
      <div key="list" className="hsx-anim-view">
        <ListView
          sessions={sessions}
          onOpen={id => setRoute({ name: "detail", id })}
          onDelete={handleDelete}
          onToggleDraft={handleToggleDraft}
          allowDelete={allowDelete}
          /* allowDrafts mirrors the other capability gates: we can't
             persist draft state yet, so the route boundary turns it
             off; the canvas keeps it on for design exploration. */
          allowDrafts={allowDelete}
          onStartSession={onStartSession}
          onRerun={onRerun}
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
