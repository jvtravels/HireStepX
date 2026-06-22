/* HireStepX — Readiness Index analytics / shared UI atoms + charts.
   Pure-view primitives. No fixtures, no state. Imported by sections.tsx
   and ReadinessIndex.tsx. Ported from the design canvas; retokened to the
   canonical brand source (src/auth/_tokens). */

import React from "react";
import { tokens as t, fonts as f, shadows } from "../auth/_tokens";
import type { Band, HireBand, Tone, Meter, Skill } from "./types";

/* Alpha-border siblings of the status/brand colors, for borders on tinted
   strips. The canonical token map carries the solid colors; these low-alpha
   line variants live here until they earn a place in the shared scale. */
export const ERROR_LINE = "rgba(185, 28, 28, 0.22)";
export const COPPER_LINE = "rgba(180, 83, 9, 0.20)";
export const SUCCESS_LINE = "rgba(21, 128, 61, 0.20)";

export const SHEET = `
  .rix-btn { transition: background 160ms ease, border-color 160ms ease, transform 160ms cubic-bezier(.16,1,.3,1), color 160ms ease; }
  .rix-cta:hover  { background: ${t.indigoDeep}; transform: translateY(-1px); }
  .rix-cta:active { transform: translateY(0); }
  .rix-ghost:hover { background: rgba(180,83,9,0.06); border-color: ${COPPER_LINE}; }
  .rix-seg:hover  { background: ${t.creamSoft}; }
  .rix-pillar { transition: box-shadow 200ms cubic-bezier(.16,1,.3,1), transform 200ms cubic-bezier(.16,1,.3,1); }
  .rix-pillar:hover { transform: translateY(-2px); box-shadow: 0 1px 0 rgba(20,17,10,.04), 0 18px 40px -22px rgba(20,17,10,.22); }
  .rix-nav-link { transition: color 140ms ease, border-color 140ms ease; }
  .rix-nav-link:hover { color: ${t.coal}; border-color: ${t.lineStrong}; }
  .rix-focus:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 10px; }
  .rix-evi { transition: background 140ms ease; }
  .rix-evi:hover { background: ${t.creamSoft}; }
  @media (max-width: 640px) { .rix-tap { min-height: 44px; } }
  @media (prefers-reduced-motion: reduce) { .rix-btn, .rix-pillar { transition-duration: 0.01ms !important; } }
`;

export const TONE_FG: Record<Tone, string> = { good: t.success, watch: t.warning, miss: t.error, neutral: t.inkSoft };
export const TONE_BG: Record<Tone, string> = { good: t.success100, watch: t.warning100, miss: t.error100, neutral: t.creamSoft };

export const HIRE_META: Record<HireBand, { label: string; color: string }> = {
  strongHire:   { label: "Strong hire", color: t.success },
  hire:         { label: "Hire",        color: t.success },
  leanHire:     { label: "Lean hire",   color: t.warning },
  noHire:       { label: "No hire",     color: t.error },
  strongNoHire: { label: "Strong no",   color: t.error },
};

export const BAND_META: Record<Band, { label: string; fg: string; bg: string; ring: string }> = {
  ready:    { label: "Interview-ready", fg: t.success, bg: t.success100, ring: t.success },
  almost:   { label: "Almost there",   fg: t.copper,  bg: t.copperSoft,  ring: t.copper },
  building: { label: "Building",        fg: t.copper,  bg: t.copperSoft,  ring: t.copper },
  early:    { label: "Early days",      fg: t.inkSoft, bg: t.creamSoft,   ring: t.inkFaint },
};

export function scoreColor(s: number): string {
  if (s >= 75) return t.success;
  if (s >= 60) return t.copper;
  return t.error;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function DeltaTag({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }} aria-label={`no change${suffix}`}>±0</span>;
  const color = value > 0 ? t.success : t.error;
  const arrow = value > 0 ? "▲" : "▼";
  const dir = value > 0 ? "up" : "down";
  return (
    <span style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 600, color }} aria-label={`${dir} ${Math.abs(value)}${suffix}`}>
      <span aria-hidden="true">{arrow} </span>{Math.abs(value)}
    </span>
  );
}

export function Eyebrow({ children, tone = "copper", as: As = "span" }: { children: React.ReactNode; tone?: "copper" | "indigo" | "ink"; as?: "span" | "h2" | "h3" }) {
  const color = tone === "copper" ? t.copper : tone === "indigo" ? t.indigo : t.inkSoft;
  return (
    <As style={{ display: "block", margin: 0, fontFamily: f.mono, fontSize: 11, fontWeight: 500, color, letterSpacing: 0.8, textTransform: "uppercase" }}>
      {children}
    </As>
  );
}

export function Title({ children, as: As = "h3", size = 20 }: { children: React.ReactNode; as?: "h1" | "h2" | "h3"; size?: number }) {
  return (
    <As style={{ margin: 0, fontFamily: f.serif, fontSize: size, fontWeight: 500, color: t.coal, letterSpacing: -0.3, lineHeight: 1.1 }}>
      {children}
    </As>
  );
}

export function Card({ children, pad = 22, style, className, as: As = "div", id }: { children: React.ReactNode; pad?: number; style?: React.CSSProperties; className?: string; as?: "div" | "section" | "article"; id?: string }) {
  return (
    <As id={id} className={className} style={{ background: t.white, borderRadius: 16, padding: pad, boxShadow: shadows.card, ...style }}>
      {children}
    </As>
  );
}

export function ZoneHead({ n, eyebrow, title, aside, id }: { n: string; eyebrow: string; title: string; aside?: string; id?: string }) {
  return (
    <div id={id} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 6, scrollMarginTop: 88 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <span aria-hidden="true" style={{ fontFamily: f.mono, fontSize: 12, color: t.inkFaint }}>{n}</span>
        <div>
          <Eyebrow as="h2" tone="indigo">{eyebrow}</Eyebrow>
          <Title as="h3" size={22}>{title}</Title>
        </div>
      </div>
      {aside && <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, maxWidth: 360, textAlign: "right" }}>{aside}</span>}
    </div>
  );
}

/* Comfort-band meter — the legibility primitive. Renders a track with a
   green "comfortable" zone and a marker for the value, so a raw number
   (latency, pace, sigma) reads as good/watch/miss without prior context. */
export function BandTick({ meter, color }: { meter: Meter; color: string }) {
  const span = meter.max - meter.min || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - meter.min) / span) * 100))}%`;
  const zoneL = pct(meter.lo), zoneR = pct(meter.hi);
  const zoneW = `${parseFloat(zoneR) - parseFloat(zoneL)}%`;
  return (
    <div role="img" aria-label={`comfortable range ${meter.lo} to ${meter.hi}; you are at ${meter.value}`}
      style={{ position: "relative", height: 6, background: t.creamSoft, borderRadius: 999, marginTop: 8 }}>
      <span aria-hidden="true" style={{ position: "absolute", left: zoneL, width: zoneW, top: 0, bottom: 0, background: t.success100, borderRadius: 999 }} />
      <span aria-hidden="true" style={{ position: "absolute", left: `calc(${pct(meter.value)} - 1px)`, top: -2, width: 2, height: 10, background: color, borderRadius: 2 }} />
    </div>
  );
}

export function MetricStat({ label, value, unit, tone = "ink", hint, meter }: { label: string; value: string; unit?: string; tone?: "good" | "warn" | "bad" | "ink"; hint?: string; meter?: Meter }) {
  const color = tone === "good" ? t.success : tone === "warn" ? t.copper : tone === "bad" ? t.error : t.coal;
  const markerColor = tone === "good" ? t.success : tone === "warn" ? t.copper : tone === "bad" ? t.error : t.indigo;
  return (
    <div style={{ background: t.creamSoft, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
        <span style={{ fontFamily: f.serif, fontSize: 28, color, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}>{unit}</span>}
      </div>
      {meter && <BandTick meter={meter} color={markerColor} />}
      {hint && <div style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, marginTop: meter ? 6 : 5 }}>{hint}</div>}
    </div>
  );
}

export function StackBar({ segments, label }: { segments: { label: string; n: number; color: string }[]; label: string }) {
  const total = segments.reduce((a, s) => a + s.n, 0) || 1;
  return (
    <div>
      <div role="img" aria-label={`${label}: ${segments.map((s) => `${s.n} ${s.label}`).join(", ")}`}
        style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: t.creamSoft }}>
        {segments.map((s) => s.n > 0 && <div key={s.label} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />)}
      </div>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", listStyle: "none", margin: "10px 0 0", padding: 0 }}>
        {segments.map((s) => (
          <li key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
            <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
            {s.label} <strong style={{ color: t.coal, fontFamily: f.mono, fontSize: 11.5 }}>{s.n}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RiGauge({ ri, threshold, band, cohort, size = 220 }: { ri: number; threshold: number; band: Band; cohort?: number; size?: number }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const sweep = 270, start = 135;
  const circ = 2 * Math.PI * r;
  const dash = circ * (sweep / 360);
  const filled = dash * (ri / 100);
  const bandColor = BAND_META[band].ring;
  const notch = (val: number, col: string, len: number) => {
    const ang = start + (val / 100) * sweep;
    const rad = (ang * Math.PI) / 180;
    const inner = r - stroke / 2 - 3, outer = r + stroke / 2 + len;
    return <line x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)} x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)} stroke={col} strokeWidth={2.5} strokeLinecap="round" />;
  };
  return (
    <div role="img" aria-label={`Readiness Index ${ri} out of 100. ${BAND_META[band].label}. Company bar ${threshold}${cohort ? `. Cohort bar ${cohort}` : ""}.`}
      style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" focusable="false" style={{ transform: `rotate(${start}deg)`, transformOrigin: "center" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.creamSoft} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={bandColor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} />
      </svg>
      <svg width={size} height={size} aria-hidden="true" focusable="false" style={{ position: "absolute", inset: 0 }}>
        {notch(threshold, t.coal, 3)}
        {typeof cohort === "number" && notch(cohort, t.indigo, 6)}
      </svg>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: f.serif, fontSize: 64, lineHeight: 1, color: t.coal, fontWeight: 500 }}>{ri}</span>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: 0.5, marginTop: 2 }}>/ 100 · RI</span>
        <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, marginTop: 8 }}>bar · <strong style={{ color: t.coal }}>{threshold}</strong></span>
      </div>
    </div>
  );
}

export function Trajectory({ points, projTarget, threshold, width = 200, height = 56 }: { points: number[]; projTarget: number; threshold: number; width?: number; height?: number }) {
  if (!points.length) return <svg width={width} height={height} role="img" aria-label="Readiness trajectory unavailable" style={{ display: "block" }} />;
  const all = [...points, projTarget, threshold];
  const min = Math.min(...all) - 4, max = Math.max(...all) + 4;
  const nx = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const ny = (v: number) => height - ((v - min) / (max - min)) * height;
  const histPts = points.map((v, i) => `${nx(i, points.length)},${ny(v)}`).join(" ");
  const last = points.length - 1;
  const projLine = `${nx(last, points.length)},${ny(points[last])} ${width},${ny(projTarget)}`;
  const thY = ny(threshold);
  return (
    <svg width={width} height={height} focusable="false" role="img"
      aria-label={`Readiness trajectory from ${points[0]} to ${points[last]}, projected toward ${projTarget}. Company bar ${threshold}.`}
      style={{ display: "block", overflow: "visible" }}>
      <line x1={0} y1={thY} x2={width} y2={thY} stroke={t.success} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
      <polyline points={histPts} fill="none" stroke={t.copper} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={projLine} fill="none" stroke={t.indigo} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
      <circle cx={nx(last, points.length)} cy={ny(points[last])} r={3} fill={t.copper} />
      <circle cx={width} cy={ny(projTarget)} r={3} fill={t.indigo} />
    </svg>
  );
}

export function Spark({ points, color = t.indigo, width = 96, height = 28 }: { points: number[]; color?: string; width?: number; height?: number }) {
  if (!points.length) return <svg width={width} height={height} role="img" aria-label="trend unavailable" style={{ display: "block" }} />;
  const min = Math.min(...points) - 2, max = Math.max(...points) + 2;
  const nx = (i: number) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * width);
  const ny = (v: number) => height - ((v - min) / (max - min)) * height;
  const d = points.map((v, i) => `${nx(i)},${ny(v)}`).join(" ");
  return (
    <svg width={width} height={height} role="img" aria-label={`trend from ${points[0]} to ${points[points.length - 1]}`} style={{ display: "block" }}>
      <polyline points={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={nx(points.length - 1)} cy={ny(points[points.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}

export function SkillBar({ s }: { s: Skill }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, width: 122, flexShrink: 0 }}>{s.name}</span>
      <div role="img" aria-label={`${s.name}: ${s.score} out of 100, ${s.percentile}${ordinalSuffix(s.percentile)} percentile`} style={{ flex: 1, height: 8, background: t.creamSoft, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${s.score}%`, height: "100%", background: scoreColor(s.score), borderRadius: 999 }} />
      </div>
      <span style={{ fontFamily: f.mono, fontSize: 12, color: t.coal, width: 26, textAlign: "right" }}>{s.score}</span>
      <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, width: 44, textAlign: "right" }} title="percentile vs target cohort">p{s.percentile}</span>
      <span style={{ width: 30, textAlign: "right" }}><DeltaTag value={s.delta} /></span>
    </div>
  );
}

export function StarChips({ star }: { star: { S: boolean; T: boolean; A: boolean; R: boolean; L: boolean } }) {
  const items: [string, boolean][] = [["S", star.S], ["T", star.T], ["A", star.A], ["R", star.R], ["L", star.L]];
  return (
    <ul style={{ display: "flex", gap: 6, listStyle: "none", margin: 0, padding: 0 }}>
      {items.map(([k, ok]) => (
        <li key={k} aria-label={`${k} ${ok ? "covered" : "missing"}`}
          style={{
            position: "relative", width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: f.mono, fontSize: 12, fontWeight: 600,
            background: ok ? t.success100 : t.error100, color: ok ? t.success : t.error,
            border: `1px solid ${ok ? SUCCESS_LINE : ERROR_LINE}`, textDecoration: ok ? "none" : "line-through",
          }}>
          {k}
          <span aria-hidden="true" style={{ position: "absolute", right: -3, bottom: -3, fontSize: 11, lineHeight: 1 }}>{ok ? "✓" : "✗"}</span>
        </li>
      ))}
    </ul>
  );
}

/* Evidence disclosure — a quote pulled from a real answer. The drill
   target for red flags, blind spots, and weak verdicts. */
export function EvidenceQuote({ quote }: { quote: string }) {
  return (
    <blockquote style={{ margin: "8px 0 0", padding: "8px 12px", borderRadius: 8, background: t.creamSoft, fontFamily: f.serif, fontSize: 14, fontStyle: "italic", color: t.coal, lineHeight: 1.5 }}>
      {quote}
    </blockquote>
  );
}
