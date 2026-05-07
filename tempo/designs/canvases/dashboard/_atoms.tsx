/* HireStepX — Dashboard canvas / atoms
   Reusable primitives composed by Dashboard.tsx. Imports tokens from
   the shared design-system file. Same conventions as
   interview/_atoms.tsx — props-driven, no internal state. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";

export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "baseline",
        fontFamily: f.serif, fontSize: size, fontWeight: 600,
        color: t.coal, letterSpacing: -0.4,
      }}
    >
      <span>HireStep</span>
      <span style={{ fontStyle: "italic", color: t.copper }}>X</span>
    </span>
  );
}

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: string;
}

export function NavRow({ item }: { item: NavItem }) {
  return (
    <a
      href={`#${item.key}`}
      className="hsx-db-nav"
      data-active={item.active ? "true" : "false"}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px", borderRadius: 10,
        fontFamily: f.sans, fontSize: 14, fontWeight: 500,
        color: item.active ? t.copper : t.inkSoft,
        textDecoration: "none",
      }}
    >
      <span style={{ display: "inline-flex", width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge && (
        <span style={{
          fontFamily: f.mono, fontSize: 10, fontWeight: 500,
          color: t.copper, background: t.copperSoft,
          padding: "2px 7px", borderRadius: 999, letterSpacing: 0.3,
        }}>{item.badge}</span>
      )}
    </a>
  );
}

const ico = (path: React.ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);
export const Icons = {
  home: ico(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  practice: ico(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>),
  insight: ico(<><path d="M12 3 14 9l6 .8L15 14l1 6-4-3-4 3 1-6L3 9.8 9 9z" /></>),
  resume: ico(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  progress: ico(<><path d="M3 20V10M9 20V4M15 20V12M21 20V8" /></>),
  bookmark: ico(<><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></>),
  settings: ico(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a7.3 7.3 0 0 0 .1-3l1.9-1.5-2-3.4-2.3.7a7.4 7.4 0 0 0-2.6-1.5L14 4h-4l-.5 2.3a7.4 7.4 0 0 0-2.6 1.5l-2.3-.7-2 3.4L4.5 12a7.3 7.3 0 0 0 .1 3l-1.9 1.5 2 3.4 2.3-.7a7.4 7.4 0 0 0 2.6 1.5L10 23h4l.5-2.3a7.4 7.4 0 0 0 2.6-1.5l2.3.7 2-3.4z" /></>),
  help: ico(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4M12 17h.01" /></>),
  logout: ico(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>),
  bell: ico(<><path d="M6 8a6 6 0 0 1 12 0v5l1.5 3h-15L6 13z" /><path d="M10 19a2 2 0 0 0 4 0" /></>),
  flame: ico(<><path d="M12 2c0 4-3 6-3 9a3 3 0 0 0 6 0c0-1 0-2 1-3 2 2 3 4 3 7a7 7 0 1 1-14 0c0-5 4-7 7-13z" /></>),
  arrow: ico(<><path d="M5 12h14M13 5l7 7-7 7" /></>, 16),
  clock: ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  trend: ico(<><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>),
  sparkle: ico(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" /></>, 16),
  star: ico(<><path d="M12 3 14 9l6 .8L15 14l1 6-4-3-4 3 1-6L3 9.8 9 9z" /></>),
  trophy: ico(<><path d="M8 4h8v6a4 4 0 0 1-8 0V4z" /><path d="M16 4h2v3a3 3 0 0 1-3 3M8 4H6v3a3 3 0 0 0 3 3M10 14h4v3h-4zM8 21h8" /></>),
  meet: ico(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>),
  cal: ico(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>),
  layers: ico(<><path d="m12 2 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>),
  target: ico(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>),
};

export function Eyebrow({ children, tone = "copper" }: { children: React.ReactNode; tone?: "copper" | "indigo" | "ink" }) {
  const color = tone === "copper" ? t.copper : tone === "indigo" ? t.indigo : t.inkFaint;
  return (
    <span style={{
      fontFamily: f.mono, fontSize: 11, fontWeight: 500,
      color, letterSpacing: 0.8, textTransform: "uppercase",
    }}>{children}</span>
  );
}

export function Pill({
  children, tone = "indigo", filled = false,
}: { children: React.ReactNode; tone?: "indigo" | "copper" | "success" | "neutral"; filled?: boolean }) {
  const palette = {
    indigo:  { bg: t.indigo100, fg: t.indigo },
    copper:  { bg: t.copperSoft, fg: t.copper },
    success: { bg: t.success100, fg: t.success },
    neutral: { bg: t.creamSoft, fg: t.inkSoft },
  } as const;
  const p = palette[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      fontFamily: f.sans, fontSize: 11, fontWeight: 600,
      background: filled ? p.fg : p.bg,
      color: filled ? "#fff" : p.fg,
      letterSpacing: 0.2,
    }}>{children}</span>
  );
}

export function ScoreChip({ value }: { value: number }) {
  const cls = value >= 85 ? "hsx-db-score-strong" : value >= 70 ? "hsx-db-score-mid" : "hsx-db-score-soft";
  return (
    <span className={cls} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 44, height: 32, padding: "0 10px", borderRadius: 8,
      fontFamily: f.sans, fontSize: 14, fontWeight: 600,
    }}>{value}</span>
  );
}

export interface CardProps {
  children: React.ReactNode;
  pad?: number;
  radius?: number;
  background?: string;
  border?: string;
  interactive?: boolean;
  style?: React.CSSProperties;
}
export function Card({
  children, pad = 24, radius = 16, background = t.white,
  border = `1px solid ${t.line}`, interactive = false, style,
}: CardProps) {
  return (
    <section
      className="hsx-db-card"
      data-interactive={interactive ? "true" : "false"}
      style={{
        background, border, borderRadius: radius, padding: pad,
        boxShadow: shadows.card,
        ...style,
      }}
    >{children}</section>
  );
}

export function Ring({
  value, size = 64, stroke = 6, color = t.indigo, track = "#EBE5D2",
}: { value: number; size?: number; stroke?: number; color?: string; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        className="hsx-db-ring--bloom"
        style={{ ["--ring-target" as never]: c - dash }}
      />
    </svg>
  );
}

/* KpiTile v2 — sparkline + percentile + period-toggle. The flat-number
   v1 lived here previously; v2 adds the three things that take this
   from "matches industry baseline" to "above industry standard". */
export interface KpiTileV2Props {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  accent: "indigo" | "copper" | "success";
  icon: React.ReactNode;
  /** 7-30 normalised values 0-100 driving the inline sparkline */
  spark: number[];
  /** Peer-cohort percentile (0-100). e.g., 72 → "p72 of senior PMs" */
  percentile?: number;
  /** Period label currently active. Just visual on the canvas. */
  period?: "7d" | "30d" | "90d" | "All";
}
export function KpiTile({
  label, value, suffix, sub, accent, icon,
  spark, percentile, period = "7d",
}: KpiTileV2Props) {
  const tint =
    accent === "indigo"  ? { iconBg: t.indigo100, iconFg: t.indigo, sparkColor: t.indigo } :
    accent === "copper"  ? { iconBg: t.copperSoft, iconFg: t.copper, sparkColor: t.copper } :
                           { iconBg: t.success100, iconFg: t.success, sparkColor: t.success };
  return (
    <div style={{
      background: t.cream, border: `1px solid ${t.line}`, borderRadius: 12,
      padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Top row — icon + label + period toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, background: tint.iconBg, color: tint.iconFg,
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{icon}</span>
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, fontWeight: 500, flex: 1 }}>{label}</div>
        <PeriodToggle active={period} />
      </div>

      {/* Value + sub */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: f.serif, fontSize: 30, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>{value}</span>
          {suffix && <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>{suffix}</span>}
        </div>
        {sub && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 4 }}>{sub}</div>}
      </div>

      {/* Sparkline */}
      <Sparkline data={spark} color={tint.sparkColor} />

      {/* Percentile pill (only if provided) */}
      {percentile !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -2 }}>
          <span style={{
            fontFamily: f.mono, fontSize: 10, fontWeight: 500,
            color: percentile >= 70 ? t.success : percentile >= 40 ? t.copper : t.inkSoft,
            background: percentile >= 70 ? t.success100 : percentile >= 40 ? t.copperSoft : t.creamSoft,
            padding: "2px 8px", borderRadius: 999, letterSpacing: 0.4,
          }}>P{percentile}</span>
          <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint }}>
            vs senior cohort
          </span>
        </div>
      )}
    </div>
  );
}

/* Period toggle — 7d / 30d / 90d / All. Visual only on the canvas. */
function PeriodToggle({ active }: { active: "7d" | "30d" | "90d" | "All" }) {
  const periods: Array<"7d" | "30d" | "90d" | "All"> = ["7d", "30d", "90d", "All"];
  return (
    <div style={{
      display: "inline-flex", padding: 2, borderRadius: 999,
      background: t.creamSoft, border: `1px solid ${t.line}`,
    }}>
      {periods.map(p => (
        <span key={p} style={{
          padding: "3px 8px", borderRadius: 999,
          fontFamily: f.mono, fontSize: 10, fontWeight: 500, letterSpacing: 0.3,
          color: p === active ? t.coal : t.inkFaint,
          background: p === active ? t.white : "transparent",
          boxShadow: p === active ? "0 1px 2px rgba(20,17,10,.08)" : "none",
        }}>{p}</span>
      ))}
    </div>
  );
}

/* Sparkline — minimal inline SVG. 60×24, pad 2. Auto-scales the data
   into the available height. Adds a soft area-fill underneath. */
export function Sparkline({
  data, color, width = 220, height = 32,
}: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = (width - 4) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => {
    const x = 2 + i * step;
    const y = 2 + (height - 4) * (1 - (v - min) / range);
    return `${x},${y}`;
  }).join(" ");
  const area = `M2,${height - 2} L${pts.replace(/ /g, " L")} L${width - 2},${height - 2} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width: "100%" }} aria-hidden>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={2 + (data.length - 1) * step} cy={2 + (height - 4) * (1 - (data[data.length - 1] - min) / range)} r="2.5" fill={color} />
    </svg>
  );
}

export function InsightStrip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 16, padding: "12px 16px",
      background: t.copperSoft, border: `1px solid rgba(180,83,9,0.16)`, borderRadius: 10,
      display: "flex", gap: 10, alignItems: "flex-start",
      fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.5,
    }}>
      <span style={{ color: t.copper, marginTop: 2, flexShrink: 0 }}>{Icons.sparkle}</span>
      <span>{children}</span>
    </div>
  );
}

export interface SessionRow {
  title: string;
  date: string;
  score: number;
  icon?: React.ReactNode;
}
export function SessionRowEl({ row }: { row: SessionRow }) {
  return (
    <div className="hsx-db-session-row" style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 4px", borderTop: `1px solid ${t.line}`,
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10, background: t.creamSoft, color: t.indigo,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{row.icon ?? Icons.clock}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.title}
        </div>
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{row.date}</div>
      </div>
      {/* Quick-actions revealed on hover */}
      <div className="hsx-db-session-actions" style={{ display: "flex", gap: 4 }}>
        <SessionAction title="Replay">{Icons.practice}</SessionAction>
        <SessionAction title="Notes">{Icons.bookmark}</SessionAction>
      </div>
      <ScoreChip value={row.score} />
    </div>
  );
}
function SessionAction({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button aria-label={title} title={title} style={{
      width: 28, height: 28, borderRadius: 6,
      background: "transparent", border: "none", cursor: "pointer",
      color: t.inkSoft, display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}

/* ─── InsightFeed — rotating AI coach insights with prev/next pager.
       Replaces the single static card pattern. Storyboard shows
       insight 3 of 12 with navigation affordances; production wires
       state to a useReducer + the /api/insights queue. */
export interface CoachInsight {
  headline: string;
  body: string;
  ctaLabel: string;
  priority: "high" | "medium" | "low";
  evidence?: string;
}
export function InsightFeed({
  insights, current = 0,
}: { insights: CoachInsight[]; current?: number }) {
  if (insights.length === 0) return null;
  const insight = insights[Math.min(current, insights.length - 1)];
  const priorityTone =
    insight.priority === "high"   ? { pill: "copper" as const, label: "High priority" } :
    insight.priority === "medium" ? { pill: "indigo" as const, label: "Medium priority" } :
                                    { pill: "neutral" as const, label: "Low priority" };
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: t.indigo }}>{Icons.sparkle}</span>
          <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>AI coach insight</span>
        </div>
        <Pill tone={priorityTone.pill}>{priorityTone.label}</Pill>
      </div>
      <h3 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", lineHeight: 1.2, margin: "0 0 8px" }}>
        {insight.headline}
      </h3>
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>
        {insight.body}
      </p>
      {insight.evidence && (
        <div style={{
          fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4,
          padding: "8px 10px", background: t.cream, border: `1px solid ${t.line}`, borderRadius: 6,
          marginBottom: 14,
        }}>
          BASED ON: {insight.evidence}
        </div>
      )}
      <PrimaryCta size="sm" fullWidth>{insight.ctaLabel}</PrimaryCta>

      {/* Pager — prev/next + index pips. Only rendered when there's >1 insight. */}
      {insights.length > 1 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}`,
        }}>
          <button aria-label="Previous insight" disabled={current === 0} style={{
            width: 28, height: 28, borderRadius: 999,
            background: t.cream, border: `1px solid ${t.line}`, cursor: current === 0 ? "default" : "pointer",
            color: current === 0 ? t.inkFaint : t.coal,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>‹</button>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {insights.map((_, i) => (
              <span key={i} style={{
                width: i === current ? 18 : 6, height: 6, borderRadius: 999,
                background: i === current ? t.copper : t.line,
                transition: "all 200ms ease",
              }} />
            ))}
          </div>
          <button aria-label="Next insight" disabled={current === insights.length - 1} style={{
            width: 28, height: 28, borderRadius: 999,
            background: t.cream, border: `1px solid ${t.line}`,
            cursor: current === insights.length - 1 ? "default" : "pointer",
            color: current === insights.length - 1 ? t.inkFaint : t.coal,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>›</button>
        </div>
      )}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4 }}>
          {current + 1} / {insights.length}
        </span>
        <a href="#all-insights" className="hsx-db-link" style={{
          fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.indigo, textDecoration: "none",
        }}>
          View all →
        </a>
      </div>
    </>
  );
}

/* ─── CommandPalette — Linear-style ⌘K overlay. Renders as a centered
       modal over a dimmed backdrop. Production: keyboard-driven; on
       canvas, just static + a chevron pip showing the focused row. */
export interface PaletteSection {
  label: string;
  items: Array<{ key: string; label: string; sub?: string; icon: React.ReactNode; shortcut?: string }>;
}
export function CommandPalette({
  query = "", sections, focusKey,
}: { query?: string; sections: PaletteSection[]; focusKey?: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(20,17,10,0.36)",
      backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start",
      justifyContent: "center", paddingTop: 120, zIndex: 9999,
    }}>
      <div style={{
        width: 620, maxWidth: "calc(100vw - 32px)",
        background: t.white, borderRadius: 16, border: `1px solid ${t.line}`,
        boxShadow: "0 8px 32px rgba(20,17,10,.18), 0 32px 64px rgba(20,17,10,.16)",
        overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${t.line}` }}>
          <span style={{ color: t.inkSoft }}>{Icons.sparkle}</span>
          <input
            placeholder="Search anything — sessions, companies, focuses…"
            defaultValue={query}
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: f.sans, fontSize: 15, color: t.coal,
            }}
          />
          <span style={{
            fontFamily: f.mono, fontSize: 10, color: t.inkFaint,
            padding: "3px 7px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 5,
          }}>ESC</span>
        </div>
        {/* Sections */}
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "8px 0" }}>
          {sections.map(section => (
            <div key={section.label} style={{ padding: "8px 12px" }}>
              <div style={{
                padding: "4px 12px", fontFamily: f.mono, fontSize: 10, fontWeight: 500,
                color: t.inkFaint, letterSpacing: 0.6, textTransform: "uppercase",
              }}>{section.label}</div>
              {section.items.map(item => (
                <div key={item.key} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 8,
                  background: item.key === focusKey ? t.copperSoft : "transparent",
                  cursor: "pointer", transition: "background 120ms ease",
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: item.key === focusKey ? t.copper : t.creamSoft,
                    color: item.key === focusKey ? "#fff" : t.inkSoft,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal }}>{item.label}</div>
                    {item.sub && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{item.sub}</div>}
                  </div>
                  {item.shortcut && (
                    <span style={{
                      fontFamily: f.mono, fontSize: 10, color: t.inkSoft,
                      padding: "3px 7px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 5,
                    }}>{item.shortcut}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", borderTop: `1px solid ${t.line}`, background: t.cream,
          fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.4,
        }}>
          <span>↑↓ Navigate · ↵ Open · ESC Close</span>
          <span>HireStepX command palette</span>
        </div>
      </div>
    </div>
  );
}

/* ─── NotificationPanel — slide-in drawer revealed by clicking the
       bell icon. Shows recent activity grouped by day with read /
       unread state, action affordances per row. */
export interface NotificationItem {
  id: string;
  kind: "evaluation" | "milestone" | "coach" | "journey" | "system";
  title: string;
  body: string;
  ago: string; // "2m ago" / "1h ago" / "yesterday"
  unread: boolean;
}
export function NotificationPanel({ items }: { items: NotificationItem[] }) {
  const unreadCount = items.filter(i => i.unread).length;
  const kindIcon: Record<NotificationItem["kind"], React.ReactNode> = {
    evaluation: Icons.target,
    milestone:  Icons.trophy,
    coach:      Icons.sparkle,
    journey:    Icons.layers,
    system:     Icons.bell,
  };
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 400, maxWidth: "100vw",
      background: t.white, borderLeft: `1px solid ${t.line}`,
      boxShadow: "-16px 0 48px rgba(20,17,10,.10)",
      display: "flex", flexDirection: "column", zIndex: 9998,
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px", borderBottom: `1px solid ${t.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <h3 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
            Notifications
          </h3>
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "4px 0 0" }}>
            {unreadCount} unread · {items.length} total
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button aria-label="Mark all read" title="Mark all read" style={{
            padding: "6px 10px", fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.inkSoft,
            background: "transparent", border: `1px solid ${t.line}`, borderRadius: 6, cursor: "pointer",
          }}>Mark all read</button>
          <button aria-label="Close" title="Close" style={{
            width: 30, height: 30, borderRadius: 6, color: t.inkSoft,
            background: "transparent", border: `1px solid ${t.line}`, cursor: "pointer",
          }}>×</button>
        </div>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.map(n => (
          <div key={n.id} style={{
            display: "flex", gap: 12, padding: "16px 24px",
            borderBottom: `1px solid ${t.line}`,
            background: n.unread ? "rgba(180,83,9,0.04)" : "transparent",
            position: "relative",
          }}>
            {n.unread && (
              <span aria-hidden style={{
                position: "absolute", left: 8, top: 22,
                width: 6, height: 6, borderRadius: 999, background: t.copper,
              }} />
            )}
            <span style={{
              width: 32, height: 32, borderRadius: 8, background: t.creamSoft, color: t.indigo,
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>{kindIcon[n.kind]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
                  {n.title}
                </span>
                <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.3, flexShrink: 0 }}>
                  {n.ago}
                </span>
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: "4px 0 0", lineHeight: 1.5 }}>
                {n.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── QuickAction — single tile in a quick-actions row under the greeting.
       Supports keyboard-shortcut hint pill on the right. */
export function QuickAction({
  icon, label, shortcut, accent = "neutral",
}: { icon: React.ReactNode; label: string; shortcut?: string; accent?: "neutral" | "copper" | "indigo" }) {
  const tint =
    accent === "copper" ? { fg: t.copper, bg: t.copperSoft } :
    accent === "indigo" ? { fg: t.indigo, bg: t.indigo100 } :
                          { fg: t.inkSoft, bg: t.creamSoft };
  return (
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 12,
      background: t.white, border: `1px solid ${t.line}`,
      fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.coal,
      cursor: "pointer", transition: "background 160ms ease, border-color 160ms ease",
    }} className="hsx-db-cta-outline">
      <span style={{
        width: 24, height: 24, borderRadius: 6, background: tint.bg, color: tint.fg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</span>
      <span>{label}</span>
      {shortcut && (
        <span style={{
          fontFamily: f.mono, fontSize: 10, color: t.inkFaint,
          padding: "2px 6px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 5,
          letterSpacing: 0.3,
        }}>{shortcut}</span>
      )}
    </button>
  );
}

export function PrimaryCta({
  children, onClick, icon, fullWidth, size = "md",
}: { children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; fullWidth?: boolean; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "10px 18px" : "14px 22px";
  const fs  = size === "sm" ? 13 : 14;
  return (
    <button
      type="button" onClick={onClick} className="hsx-db-cta"
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: pad, borderRadius: 12, border: "none", cursor: "pointer",
        background: t.indigo, color: "#fff",
        fontFamily: f.sans, fontSize: fs, fontWeight: 600, letterSpacing: 0.1,
        boxShadow: shadows.cta,
        width: fullWidth ? "100%" : undefined,
        justifyContent: fullWidth ? "center" : undefined,
      }}
    >
      <span>{children}</span>
      {icon ?? Icons.arrow}
    </button>
  );
}

export function OutlineCta({
  children, onClick, size = "md",
}: { children: React.ReactNode; onClick?: () => void; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "9px 16px" : "13px 20px";
  return (
    <button
      type="button" onClick={onClick} className="hsx-db-cta-outline"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: pad, borderRadius: 12, cursor: "pointer",
        background: "transparent", color: t.coal,
        border: `1px solid ${t.lineStrong}`,
        fontFamily: f.sans, fontSize: 14, fontWeight: 500,
      }}
    >{children}</button>
  );
}

/* ─── DailyGoalRibbon — Duolingo-style explicit daily commitment.
       Surfaces the day's plan as a single ribbon under the hero, with
       a progress bar driving the eye toward the next concrete step. */
export interface DailyGoalRibbonProps {
  sessionGoal: number;     // target sessions today (e.g., 1 or 2)
  sessionsDone: number;    // completed today
  minutesGoal: number;     // target minutes today
  minutesDone: number;
  weakSpotsReviewed: number;
  weakSpotsTarget: number;
}
export function DailyGoalRibbon(p: DailyGoalRibbonProps) {
  const sessionPct = (p.sessionsDone / p.sessionGoal) * 100;
  const minutesPct = (p.minutesDone / p.minutesGoal) * 100;
  const weakPct = (p.weakSpotsReviewed / p.weakSpotsTarget) * 100;
  const overall = Math.min(100, (sessionPct + minutesPct + weakPct) / 3);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "12px 18px", background: t.white,
      border: `1px solid ${t.line}`, borderRadius: 12,
      boxShadow: shadows.card,
    }}>
      <span style={{ color: t.copper, fontSize: 18 }}>{Icons.target}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontFamily: f.sans, fontSize: 13 }}>
          <span style={{ color: t.coal, fontWeight: 600 }}>Today's goal:</span>
          <Pellet>{p.sessionsDone}/{p.sessionGoal} session{p.sessionGoal === 1 ? "" : "s"}</Pellet>
          <Pellet>{p.minutesDone}/{p.minutesGoal} min</Pellet>
          <Pellet>{p.weakSpotsReviewed}/{p.weakSpotsTarget} weak-spots reviewed</Pellet>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: t.line, overflow: "hidden" }}>
          <div style={{
            width: `${overall}%`, height: "100%", background: t.copper,
            transition: "width 600ms cubic-bezier(.16,1,.3,1)",
          }} />
        </div>
      </div>
      <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: 0.4, flexShrink: 0 }}>
        {Math.round(overall)}%
      </span>
    </div>
  );
}
function Pellet({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
      {children}
    </span>
  );
}

/* ─── CountdownPill — interview-imminent indicator near the streak.
       When user has set an interview date, dashboard shows urgency
       prominently. */
export function CountdownPill({ days, role, company }: { days: number; role: string; company: string }) {
  const tone = days <= 3 ? "copper" : days <= 7 ? "indigo" : "neutral";
  const colors = tone === "copper"
    ? { bg: t.copperSoft, fg: t.copper, border: "rgba(180,83,9,0.20)" }
    : tone === "indigo"
      ? { bg: t.indigo100, fg: t.indigo, border: "rgba(49,46,129,0.20)" }
      : { bg: t.creamSoft, fg: t.inkSoft, border: t.line };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: colors.bg, border: `1px solid ${colors.border}`,
      borderRadius: 14, padding: "10px 14px",
    }}>
      <span style={{ color: colors.fg }}>{Icons.cal}</span>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: colors.fg, lineHeight: 1 }}>
            {days}
          </span>
          <span style={{ fontFamily: f.sans, fontSize: 11, color: colors.fg, fontWeight: 500 }}>
            {days === 1 ? "day" : "days"} to {company}
          </span>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, marginTop: 2 }}>
          {role}
        </span>
      </div>
    </div>
  );
}

/* ─── ContributionGraph — GitHub-style 12-week heatmap.
       Replaces the flat streak bar with a far richer visual proof
       of consistency. Each square = one day, intensity = minutes
       practiced. */
export interface ContribDay {
  date: string;      // "2026-05-11"
  intensity: 0 | 1 | 2 | 3 | 4; // 0 = none, 4 = heavy
}
export function ContributionGraph({ days }: { days: ContribDay[] }) {
  // 12 weeks × 7 days. Group into columns (weeks).
  const weeks: ContribDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const cellSize = 11, gap = 3;
  const w = weeks.length * (cellSize + gap);
  const h = 7 * (cellSize + gap);
  const intensityFill: Record<0|1|2|3|4, string> = {
    0: t.line,
    1: "rgba(180,83,9,0.20)",
    2: "rgba(180,83,9,0.40)",
    3: "rgba(180,83,9,0.65)",
    4: t.copper,
  };
  return (
    <div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Practice contribution graph" style={{ display: "block" }}>
        {weeks.map((week, wi) =>
          week.map((day, di) => (
            <rect
              key={`${wi}-${di}`}
              x={wi * (cellSize + gap)}
              y={di * (cellSize + gap)}
              width={cellSize} height={cellSize} rx={2}
              fill={intensityFill[day.intensity]}
            >
              <title>{day.date}: {day.intensity === 0 ? "no practice" : `intensity ${day.intensity}/4`}</title>
            </rect>
          ))
        )}
      </svg>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 10, fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4,
      }}>
        <span>12 weeks ago</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>Less</span>
          {[0,1,2,3,4].map(i => (
            <span key={i} style={{
              width: 9, height: 9, borderRadius: 2,
              background: intensityFill[i as 0|1|2|3|4],
            }} />
          ))}
          <span>More</span>
        </div>
        <span>Today</span>
      </div>
    </div>
  );
}

/* ─── SkillRadar — spider chart for the 10-category framework.
       Replaces the flat 5-column grid. Click-through hooks left out
       of the canvas; in production each axis links to its category. */
export interface RadarPoint { label: string; score: number; touched: boolean }
export function SkillRadar({ points, size = 320 }: { points: RadarPoint[]; size?: number }) {
  const cx = size / 2, cy = size / 2 + 4, r = size / 2 - 36;
  const n = points.length;
  const angle = (i: number) => -Math.PI / 2 + (i / n) * 2 * Math.PI;
  const polar = (i: number, radius: number) => {
    const a = angle(i);
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };
  // Concentric grid rings (25/50/75/100)
  const rings = [0.25, 0.5, 0.75, 1.0];
  // Data polygon path
  const dataPts = points.map((p, i) => polar(i, r * (p.touched ? p.score / 100 : 0.05)));
  const dataPath = dataPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  return (
    <svg width={size} height={size + 8} viewBox={`0 0 ${size} ${size + 8}`} aria-label="Behavioral skill radar">
      {/* Rings */}
      {rings.map((ring, ri) => (
        <polygon
          key={ri}
          points={Array.from({ length: n }, (_, i) => {
            const p = polar(i, r * ring);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke={t.line}
          strokeWidth={ri === rings.length - 1 ? 1.5 : 1}
          strokeDasharray={ri === rings.length - 1 ? undefined : "2 3"}
        />
      ))}
      {/* Axes */}
      {points.map((_, i) => {
        const o = polar(i, r);
        return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke={t.line} strokeWidth={1} />;
      })}
      {/* Data polygon */}
      <path d={dataPath} fill={t.copperSoft} stroke={t.copper} strokeWidth={1.6} strokeLinejoin="round" />
      {/* Data points */}
      {points.map((p, i) => {
        const dp = dataPts[i];
        return p.touched ? (
          <circle key={i} cx={dp.x} cy={dp.y} r={3} fill={t.copper} stroke={t.white} strokeWidth={1.5} />
        ) : null;
      })}
      {/* Labels */}
      {points.map((p, i) => {
        const lp = polar(i, r + 22);
        const ax = angle(i);
        const anchor = Math.cos(ax) > 0.3 ? "start" : Math.cos(ax) < -0.3 ? "end" : "middle";
        return (
          <text
            key={i} x={lp.x} y={lp.y + 3}
            textAnchor={anchor}
            fontFamily={f.sans} fontSize="10" fontWeight="500"
            fill={p.touched ? t.coal : t.inkFaint}
            style={{ letterSpacing: 0.2 }}
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ─── AchievementBadge — small icon + label tile for milestones.
       Earned vs locked toggle controls saturation. */
export interface AchievementSpec {
  key: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  earned: boolean;
}
export function AchievementBadge({ a }: { a: AchievementSpec }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "12px 8px",
      background: a.earned ? t.creamSoft : t.cream,
      border: `1px solid ${a.earned ? t.copperSoft : t.line}`,
      borderRadius: 12,
      opacity: a.earned ? 1 : 0.45,
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 999,
        background: a.earned ? t.copperSoft : t.line,
        color: a.earned ? t.copper : t.inkFaint,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{a.icon}</span>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: f.sans, fontSize: 11, fontWeight: 600, color: t.coal, lineHeight: 1.2 }}>{a.label}</div>
        {a.sub && <div style={{ fontFamily: f.mono, fontSize: 9, color: t.inkFaint, marginTop: 3, letterSpacing: 0.4 }}>{a.sub}</div>}
      </div>
    </div>
  );
}

/* ─── Skeleton block — shimmer placeholder for loading states.
       Mirrors the auth canvas shimmer pattern. */
export function Skeleton({
  width, height, radius = 8, style,
}: { width?: number | string; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="hsx-db-shimmer"
      style={{
        display: "inline-block",
        width: width ?? "100%", height: height ?? 14,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${t.creamSoft} 0%, ${t.line} 50%, ${t.creamSoft} 100%)`,
        backgroundSize: "200% 100%",
        ...style,
      }}
    />
  );
}
