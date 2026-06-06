"use client";
/* ─── DashboardHome (canvas port)
   Ported from tempo/designs/canvases/dashboard/Dashboard.tsx (returning
   variant) per explicit user instruction. Cream/copper editorial
   palette deliberately differs from the rest of the app's
   obsidian/gilt theme — user accepted this risk.

   What's REAL: user name from useAuth, navigation via useRouter.
   What's MOCK (clearly labeled "Sample data" in the UI): peer cohort,
   speech metrics, contribution graph, AI coach insights, achievements,
   recent sessions, KPI tiles, daily goal ribbon, next move CTA copy.

   Tracking debt: hook the mock sections up as PRI-33 (peer cohort),
   PRI-34 (speech aggregation), and three new tickets for contribution
   graph, AI insights queue, and goal model. */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";

/* ─────────────────────────── tokens ─────────────────────────── */
const t = {
  cream:      "#FAF7F0",
  white:      "#FFFFFF",
  creamSoft:  "#F4EFE3",
  coal:       "#0E0C08",
  inkSoft:    "#6E6759",
  inkFaint:   "#A39C8B",
  indigo:     "#312E81",
  indigo100:  "#E5E2F2",
  copper:     "#B45309",
  copperSoft: "rgba(180, 83, 9, 0.12)",
  success:    "#15803D",
  success100: "#DCFCE7",
  line:       "#EBE5D2",
  lineStrong: "#D6CDB5",
  copperLine: "rgba(180, 83, 9, 0.20)",
  successLine:"rgba(21, 128, 61, 0.20)",
} as const;

const f = {
  serif: "'Instrument Serif', Georgia, serif",
  sans:  "'Satoshi', -apple-system, system-ui, sans-serif",
  mono:  "'JetBrains Mono', monospace",
} as const;

const shadows = {
  card: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
  cta:  "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
} as const;

/* ─────────────────────────── icons ─────────────────────────── */
const ico = (path: React.ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);
const Icons = {
  flame:    ico(<path d="M12 2c0 4-3 6-3 9a3 3 0 0 0 6 0c0-1 0-2 1-3 2 2 3 4 3 7a7 7 0 1 1-14 0c0-5 4-7 7-13z" />),
  arrow:    ico(<><path d="M5 12h14M13 5l7 7-7 7" /></>, 16),
  clock:    ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  trend:    ico(<><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>),
  sparkle:  ico(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" /></>, 16),
  target:   ico(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>),
  trophy:   ico(<><path d="M8 4h8v6a4 4 0 0 1-8 0V4z" /><path d="M16 4h2v3a3 3 0 0 1-3 3M8 4H6v3a3 3 0 0 0 3 3M10 14h4v3h-4zM8 21h8" /></>),
  practice: ico(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>),
  meet:     ico(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>),
  cal:      ico(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>),
};

/* ─────────────────────────── atoms ─────────────────────────── */
function Eyebrow({ children, tone = "copper" }: { children: React.ReactNode; tone?: "copper" | "indigo" | "ink" }) {
  const color = tone === "copper" ? t.copper : tone === "indigo" ? t.indigo : t.inkFaint;
  return (
    <span style={{
      fontFamily: f.mono, fontSize: 11, fontWeight: 500,
      color, letterSpacing: 0.8, textTransform: "uppercase",
    }}>{children}</span>
  );
}

function Pill({ children, tone = "indigo", filled = false }: {
  children: React.ReactNode; tone?: "indigo" | "copper" | "success" | "neutral"; filled?: boolean;
}) {
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
      color: filled ? t.white : p.fg, letterSpacing: 0.2,
    }}>{children}</span>
  );
}

function SampleDataPill() {
  return (
    <span title="This section currently shows sample data; real data wiring is in progress." style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      fontFamily: f.mono, fontSize: 9, fontWeight: 500, letterSpacing: 0.6,
      color: t.inkFaint, background: t.creamSoft, border: `1px dashed ${t.lineStrong}`,
      textTransform: "uppercase",
    }}>Sample data</span>
  );
}

function ScoreChip({ value }: { value: number }) {
  const bg = value >= 85 ? t.success100 : value >= 70 ? t.copperSoft : t.creamSoft;
  const fg = value >= 85 ? t.success    : value >= 70 ? t.copper     : t.inkSoft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 44, height: 32, padding: "0 10px", borderRadius: 8,
      background: bg, color: fg,
      fontFamily: f.sans, fontSize: 14, fontWeight: 600,
    }}>{value}</span>
  );
}

function Card({ children, pad = 24, radius = 16, background = t.white, border = `1px solid ${t.line}`, style }: {
  children: React.ReactNode; pad?: number; radius?: number; background?: string; border?: string; style?: React.CSSProperties;
}) {
  return (
    <section style={{ background, border, borderRadius: radius, padding: pad, boxShadow: shadows.card, ...style }}>
      {children}
    </section>
  );
}

function Ring({ value, size = 64, stroke = 6, color = t.indigo, track = "#EBE5D2" }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

function Sparkline({ data, color, width = 220, height = 32 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
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
  const gid = `sg-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width: "100%" }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={2 + (data.length - 1) * step}
              cy={2 + (height - 4) * (1 - (data[data.length - 1] - min) / range)}
              r="2.5" fill={color} />
    </svg>
  );
}

function KpiTile({ label, value, suffix, sub, accent, icon, spark, percentile, emphasis = false }: {
  label: string; value: string; suffix?: string; sub?: string;
  accent: "indigo" | "copper" | "success"; icon: React.ReactNode;
  spark: number[]; percentile?: number; emphasis?: boolean;
}) {
  const tint =
    accent === "indigo" ? { iconBg: t.indigo100, iconFg: t.indigo, sparkColor: t.indigo } :
    accent === "copper" ? { iconBg: t.copperSoft, iconFg: t.copper, sparkColor: t.copper } :
                          { iconBg: t.success100, iconFg: t.success, sparkColor: t.success };
  const valueSize = emphasis ? 44 : 28;
  return (
    <div style={{
      background: emphasis ? t.white : t.cream,
      border: `1px solid ${emphasis ? t.lineStrong : t.line}`,
      borderRadius: 12,
      padding: emphasis ? "20px 22px 18px" : "14px 16px 12px",
      display: "flex", flexDirection: "column", gap: emphasis ? 12 : 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: emphasis ? 36 : 28, height: emphasis ? 36 : 28,
          borderRadius: emphasis ? 10 : 8, background: tint.iconBg, color: tint.iconFg,
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{icon}</span>
        <div style={{ fontFamily: f.sans, fontSize: emphasis ? 13 : 12, color: t.inkSoft, fontWeight: 500, flex: 1 }}>{label}</div>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: f.serif, fontSize: valueSize, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>{value}</span>
          {suffix && <span style={{ fontFamily: f.sans, fontSize: emphasis ? 14 : 12, color: t.inkFaint }}>{suffix}</span>}
        </div>
        {sub && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 4 }}>{sub}</div>}
      </div>
      <Sparkline data={spark} color={tint.sparkColor} height={emphasis ? 40 : 24} />
      {percentile !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -2 }}>
          <span style={{
            fontFamily: f.mono, fontSize: 10, fontWeight: 500,
            color: percentile >= 70 ? t.success : percentile >= 40 ? t.copper : t.inkSoft,
            background: percentile >= 70 ? t.success100 : percentile >= 40 ? t.copperSoft : t.creamSoft,
            padding: "2px 8px", borderRadius: 999, letterSpacing: 0.4,
          }}>P{percentile}</span>
          {emphasis && <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint }}>vs senior cohort</span>}
        </div>
      )}
    </div>
  );
}

function PrimaryCta({ children, onClick, icon, fullWidth, size = "md" }: {
  children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; fullWidth?: boolean; size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "10px 18px" : "14px 22px";
  const fs  = size === "sm" ? 13 : 14;
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: pad, borderRadius: 12, border: "none", cursor: "pointer",
      background: t.indigo, color: t.white,
      fontFamily: f.sans, fontSize: fs, fontWeight: 600, letterSpacing: 0.1,
      boxShadow: shadows.cta,
      width: fullWidth ? "100%" : undefined,
      justifyContent: fullWidth ? "center" : undefined,
    }}>
      <span>{children}</span>
      {icon ?? Icons.arrow}
    </button>
  );
}

function OutlineCta({ children, onClick, size = "md" }: {
  children: React.ReactNode; onClick?: () => void; size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "9px 16px" : "13px 20px";
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: pad, borderRadius: 12, cursor: "pointer",
      background: "transparent", color: t.coal,
      border: `1px solid ${t.lineStrong}`,
      fontFamily: f.sans, fontSize: 14, fontWeight: 500,
    }}>{children}</button>
  );
}

/* ─────────────────────────── data (mock) ─────────────────────────── */
type Session = { title: string; date: string; score: number; icon?: React.ReactNode };
const MOCK_SESSIONS: Session[] = [
  { title: "Salary negotiation — Razorpay PM", date: "Yesterday · 38 min", score: 88, icon: Icons.meet },
  { title: "System design — Stripe Staff PM",  date: "2 days ago · 52 min", score: 82, icon: Icons.practice },
  { title: "Behavioral — Atlassian Senior PM", date: "4 days ago · 41 min", score: 76, icon: Icons.target },
  { title: "Resume deep-dive coaching",        date: "Last week · 28 min", score: 91, icon: Icons.sparkle },
];

const MOCK_INSIGHT = {
  headline: "Your STAR breakdowns lose specificity by minute 3.",
  body: "Across your last 8 behavioral runs, the Situation+Task averaged 41s — strong. Action narrowed to a single tradeoff. But the Result drifted to generic outcome language in 6 of 8. Try ending every story with a quantified delta.",
  evidence: "8 behavioral sessions · 23/05 — 04/06",
};

const MOCK_KPI = {
  practiceMinutes:  { value: "12.4", suffix: "h", sub: "this week", spark: [42, 38, 55, 48, 62, 58, 74], pct: 78 },
  averageScore:     { value: "84",  suffix: "/100", sub: "last 10 sessions", spark: [70, 72, 78, 75, 80, 82, 84], pct: 72 },
  sessionsComplete: { value: "27",  sub: "since signup",  spark: [3, 4, 5, 5, 6, 7, 8], pct: 84 },
};

const MOCK_GOAL = { sessionsDone: 1, sessionsGoal: 2, minutesDone: 28, minutesGoal: 45, weakDone: 2, weakGoal: 3 };

const MOCK_ACHIEVEMENTS = [
  { key: "first-session",  label: "First session",   sub: "Day 1",    earned: true },
  { key: "streak-7",       label: "7-day streak",    sub: "Week 1",   earned: true },
  { key: "score-85",       label: "Score 85+",       sub: "Top 25%",  earned: true },
  { key: "ten-sessions",   label: "10 sessions",     sub: "Volume",   earned: true },
  { key: "streak-14",      label: "14-day streak",   sub: "Week 2",   earned: false },
  { key: "score-90",       label: "Score 90+",       sub: "Top 10%",  earned: false },
  { key: "negotiation-3",  label: "Negotiation x 3", sub: "Specialist", earned: false },
  { key: "streak-30",      label: "30-day streak",   sub: "Month 1",  earned: false },
];

/* ─────────────────────────── view ─────────────────────────── */
export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  useDocTitle("Dashboard");

  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name.split(" ")[0];
    const emailLocal = user?.email?.split("@")[0];
    return emailLocal || "there";
  }, [user]);

  const goToInterview = () => router.push("/interview/setup");
  const goToSessions  = () => router.push("/sessions");
  const goToAnalytics = () => router.push("/analytics");
  const goToResume    = () => router.push("/resume");

  return (
    <div style={{
      minHeight: "100%",
      background: t.cream,
      fontFamily: f.sans, color: t.coal,
      padding: "32px 32px 64px",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 360px",
        gap: 32, maxWidth: 1280, margin: "0 auto",
      }}
      className="hsx-dash-grid"
      >
        {/* ─── Main stage ─── */}
        <main style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* Hero — greeting + streak */}
          <section>
            <Eyebrow>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Eyebrow>
            <h1 style={{
              fontFamily: f.serif, fontSize: 44, fontWeight: 400, lineHeight: 1.1,
              letterSpacing: "-0.02em", color: t.coal, margin: "8px 0 6px",
            }}>
              Welcome back, {displayName}.
            </h1>
            <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, maxWidth: 560 }}>
              Three weak-spots from your last session are queued. A focused 25-minute block clears two.
            </p>

            {/* Daily goal ribbon */}
            <div style={{ marginTop: 18 }}>
              <DailyGoalRibbon />
            </div>
          </section>

          {/* KPI grid */}
          <section>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <Eyebrow tone="ink">Progress at a glance</Eyebrow>
              <SampleDataPill />
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr",
              gap: 14,
            }} className="hsx-dash-kpi-grid">
              <KpiTile
                emphasis label="Practice time" value={MOCK_KPI.practiceMinutes.value} suffix={MOCK_KPI.practiceMinutes.suffix}
                sub={MOCK_KPI.practiceMinutes.sub} accent="copper" icon={Icons.clock}
                spark={MOCK_KPI.practiceMinutes.spark} percentile={MOCK_KPI.practiceMinutes.pct}
              />
              <KpiTile
                label="Average score" value={MOCK_KPI.averageScore.value} suffix={MOCK_KPI.averageScore.suffix}
                sub={MOCK_KPI.averageScore.sub} accent="indigo" icon={Icons.trend}
                spark={MOCK_KPI.averageScore.spark} percentile={MOCK_KPI.averageScore.pct}
              />
              <KpiTile
                label="Sessions completed" value={MOCK_KPI.sessionsComplete.value}
                sub={MOCK_KPI.sessionsComplete.sub} accent="success" icon={Icons.target}
                spark={MOCK_KPI.sessionsComplete.spark} percentile={MOCK_KPI.sessionsComplete.pct}
              />
            </div>
          </section>

          {/* Next move */}
          <Card pad={28}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <Eyebrow>Your next move</Eyebrow>
                <h2 style={{
                  fontFamily: f.serif, fontSize: 28, fontWeight: 400, lineHeight: 1.2,
                  letterSpacing: "-0.01em", color: t.coal, margin: "8px 0 10px",
                }}>
                  Behavioral round — STAR sharpening
                </h2>
                <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0, maxWidth: 520, lineHeight: 1.55 }}>
                  Pattern from your last 8 runs: Result section drifts to generic outcome language. Today's 25-minute drill targets the 3 weakest stories with a quantified-delta framework.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <PrimaryCta onClick={goToInterview}>Start 25-min drill</PrimaryCta>
                  <OutlineCta onClick={goToInterview}>Pick a different focus</OutlineCta>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Ring value={68} size={92} stroke={8} color={t.copper} />
                <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.5 }}>WEEKLY READY-NESS</div>
              </div>
            </div>
          </Card>

          {/* Recent sessions */}
          <Card pad={0}>
            <div style={{ padding: "20px 24px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                  Recent sessions
                </h3>
                <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "4px 0 0" }}>
                  Your last four runs, newest first.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <SampleDataPill />
                <button onClick={goToSessions} style={{
                  fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.indigo,
                  background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px",
                }}>View all →</button>
              </div>
            </div>
            <div style={{ padding: "4px 24px 16px" }}>
              {MOCK_SESSIONS.map((row, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 4px", borderTop: i === 0 ? "none" : `1px solid ${t.line}`,
                }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10, background: t.creamSoft, color: t.indigo,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{row.icon ?? Icons.clock}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{row.title}</div>
                    <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{row.date}</div>
                  </div>
                  <ScoreChip value={row.score} />
                </div>
              ))}
            </div>
          </Card>

          {/* Achievements */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                  Milestones
                </h3>
                <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "4px 0 0" }}>
                  {MOCK_ACHIEVEMENTS.filter(a => a.earned).length} of {MOCK_ACHIEVEMENTS.length} earned.
                </p>
              </div>
              <SampleDataPill />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}
                 className="hsx-dash-achievement-grid">
              {MOCK_ACHIEVEMENTS.map(a => (
                <div key={a.key} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  padding: "14px 8px",
                  background: a.earned ? t.creamSoft : t.cream,
                  border: `1px solid ${a.earned ? t.copperSoft : t.line}`,
                  borderRadius: 12, opacity: a.earned ? 1 : 0.45,
                }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 999,
                    background: a.earned ? t.copperSoft : t.line,
                    color: a.earned ? t.copper : t.inkFaint,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{Icons.trophy}</span>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: f.sans, fontSize: 11, fontWeight: 600, color: t.coal, lineHeight: 1.2 }}>{a.label}</div>
                    {a.sub && <div style={{ fontFamily: f.mono, fontSize: 9, color: t.inkFaint, marginTop: 3, letterSpacing: 0.4 }}>{a.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </main>

        {/* ─── Rail ─── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}
               className="hsx-dash-rail">
          {/* Streak */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Eyebrow>Streak</Eyebrow>
              <SampleDataPill />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
              <span style={{ color: t.copper, display: "inline-flex" }}>{Icons.flame}</span>
              <span style={{ fontFamily: f.serif, fontSize: 40, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>9</span>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>days</span>
            </div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 6 }}>
              Best: 14 days · 5 to a new personal best.
            </div>
          </Card>

          {/* Peer cohort */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Eyebrow tone="indigo">Ahead of</Eyebrow>
              <SampleDataPill />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
              <span style={{ fontFamily: f.serif, fontSize: 40, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>72</span>
              <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkFaint, letterSpacing: 0.5 }}>P72</span>
            </div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 6 }}>
              Top 28% of senior PM candidates. Two strong sessions clears top 20%.
            </div>
          </Card>

          {/* AI coach insight */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: t.indigo }}>{Icons.sparkle}</span>
                <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>AI coach insight</span>
              </div>
              <SampleDataPill />
            </div>
            <h3 style={{ fontFamily: f.serif, fontSize: 20, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", lineHeight: 1.2, margin: "0 0 8px" }}>
              {MOCK_INSIGHT.headline}
            </h3>
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>
              {MOCK_INSIGHT.body}
            </p>
            <div style={{
              fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4,
              padding: "8px 10px", background: t.cream, border: `1px solid ${t.line}`, borderRadius: 6,
              marginBottom: 14,
            }}>
              BASED ON: {MOCK_INSIGHT.evidence}
            </div>
            <PrimaryCta size="sm" fullWidth onClick={goToInterview}>Start sharpening drill</PrimaryCta>
          </Card>

          {/* Resume freshness */}
          <Card>
            <Eyebrow tone="ink">Resume</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <Pill tone="success">Fresh</Pill>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>Updated 4 days ago</span>
            </div>
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: "12px 0 14px", lineHeight: 1.5 }}>
              Two new bullets on impact metrics. Refresh-aware reviewer is queued for tonight.
            </p>
            <OutlineCta size="sm" onClick={goToResume}>Open resume</OutlineCta>
          </Card>

          {/* Quick links */}
          <Card>
            <Eyebrow tone="ink">Jump back in</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <RailLink onClick={goToAnalytics}>Analytics — score trend</RailLink>
              <RailLink onClick={goToSessions}>All session reports</RailLink>
              <RailLink onClick={goToResume}>Resume — upload new version</RailLink>
            </div>
          </Card>
        </aside>
      </div>

      {/* Responsive: rail collapses below stage at < 1080px */}
      <style>{`
        @media (max-width: 1080px) {
          .hsx-dash-grid { grid-template-columns: 1fr !important; }
          .hsx-dash-rail { order: 2; }
        }
        @media (max-width: 720px) {
          .hsx-dash-kpi-grid { grid-template-columns: 1fr !important; }
          .hsx-dash-achievement-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── small pieces ─────────────────────────── */

function DailyGoalRibbon() {
  const p = MOCK_GOAL;
  const sessionPct = (p.sessionsDone / p.sessionsGoal) * 100;
  const minutesPct = (p.minutesDone / p.minutesGoal) * 100;
  const weakPct    = (p.weakDone / p.weakGoal) * 100;
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
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontFamily: f.sans, fontSize: 13, flexWrap: "wrap" }}>
          <span style={{ color: t.coal, fontWeight: 600 }}>Today's goal:</span>
          <span style={{ color: t.inkSoft }}>{p.sessionsDone}/{p.sessionsGoal} sessions</span>
          <span style={{ color: t.inkSoft }}>{p.minutesDone}/{p.minutesGoal} min</span>
          <span style={{ color: t.inkSoft }}>{p.weakDone}/{p.weakGoal} weak-spots</span>
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
      <SampleDataPill />
    </div>
  );
}

function RailLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 12px", borderRadius: 10,
      background: t.cream, border: `1px solid ${t.line}`, cursor: "pointer",
      fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.coal, textAlign: "left",
    }}>
      <span>{children}</span>
      <span style={{ color: t.inkFaint }}>{Icons.arrow}</span>
    </button>
  );
}
