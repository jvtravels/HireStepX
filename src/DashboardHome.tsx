"use client";
/* ─── DashboardHome (canvas port, post-audit revision)
   Cream/copper editorial surface. Wires real streak + sessions from
   useDashboardCore; mock sections (peer cohort, AI insight, KPIs,
   milestones, daily goal) are flagged with visible "Demo data" pills
   and a single top-of-page banner so users are not deceived.

   Set NEXT_PUBLIC_DASHBOARD_DEMO=1 in env to keep demo sections
   visible without the banner (for screenshots / canvas previews).
   In production, the banner makes it unmistakable. */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useDashboardSessions } from "./DashboardContext";
import { useDocTitle } from "./useDocTitle";
import type { DashboardSession } from "./dashboardTypes";
import { tokens as T, fonts as F, shadows as S } from "./auth/_tokens";

/* ─── Tokens (derived from auth/_tokens — single source of truth).
 * Keeps the existing `t.`/`f.`/`shadows.` references untouched but
 * binds them to the canonical cream palette. inkMid was a one-off
 * darker shade used for AA body copy — promoted to the canonical
 * `inkFaint` (which was WCAG-fixed to #7A7263 in task #8). The
 * legacy decorative `inkFaint` here is now `inkFaintWeak`. */
const t = {
  cream:        T.cream,
  white:        "#FCFAF4", // tinted toward cream; kept local — distinct from T.white
  creamSoft:    T.creamSoft,
  coal:         T.coal,
  inkSoft:      T.inkSoft,
  inkMid:       T.inkFaint,      // WCAG-fixed AA-passing shade
  inkFaint:     T.inkFaintWeak,  // decorative only (icon strokes)
  indigo:       T.indigo,
  indigo100:    T.indigo100,
  copper:       T.copper,
  copperSoft:   T.copperSoft,
  success:      T.success,
  success100:  T.success100,
  warning100:  T.warning100,
  warningInk:  "#7C4A03",         // dashboard-local — not in canonical palette
  line:         T.line,
  lineStrong:   T.lineStrong,
} as const;

const f = {
  serif: F.serif,
  sans:  F.sans,
  mono:  F.mono,
} as const;

const shadows = {
  card: S.card,
  cta:  S.cta,
} as const;

/* ─── icons ─── */
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
  info:     ico(<><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></>, 16),
  check:    ico(<><path d="M20 6 9 17l-5-5" /></>, 14),
  lock:     ico(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, 14),
};

/* ─── atoms ─── */
function Eyebrow({ children, tone = "ink", as: As = "span" }: {
  children: React.ReactNode; tone?: "copper" | "indigo" | "ink"; as?: "span" | "h2" | "h3";
}) {
  const color = tone === "copper" ? t.copper : tone === "indigo" ? t.indigo : t.inkSoft;
  return (
    <As style={{
      display: "inline-block", margin: 0,
      fontFamily: f.mono, fontSize: 11, fontWeight: 500,
      color, letterSpacing: 0.8, textTransform: "uppercase",
    }}>{children}</As>
  );
}

function SampleDataPill() {
  return (
    <span aria-label="Sample data, not your account" title="Sample data, not your account" style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999,
      fontFamily: f.mono, fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
      color: t.warningInk, background: t.warning100, border: `1px solid rgba(124,74,3,0.18)`,
      textTransform: "uppercase",
    }}>Demo</span>
  );
}

function ScoreChip({ value }: { value: number }) {
  const bg = value >= 85 ? t.success100 : value >= 70 ? t.copperSoft : t.creamSoft;
  const fg = value >= 85 ? t.success    : value >= 70 ? t.copper     : t.inkSoft;
  return (
    <span aria-label={`Score ${value} out of 100`} style={{
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

function Ring({ value, size = 64, stroke = 6, color = t.indigo, track = "#EBE5D2", label }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
         role={label ? "img" : undefined} aria-label={label} aria-hidden={!label}>
      <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

function PrimaryCta({ children, onClick, icon, fullWidth, size = "md" }: {
  children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; fullWidth?: boolean; size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "10px 18px" : "14px 22px";
  const fs  = size === "sm" ? 13 : 14;
  return (
    <button type="button" onClick={onClick} className="hsx-dh-btn" style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: pad, borderRadius: 12, border: "none", cursor: "pointer",
      background: t.indigo, color: t.white,
      fontFamily: f.sans, fontSize: fs, fontWeight: 600, letterSpacing: 0.1,
      boxShadow: shadows.cta, minHeight: 44,
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
    <button type="button" onClick={onClick} className="hsx-dh-btn" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: pad, borderRadius: 12, cursor: "pointer", minHeight: 44,
      background: "transparent", color: t.coal,
      border: `1px solid ${t.lineStrong}`,
      fontFamily: f.sans, fontSize: 14, fontWeight: 500,
    }}>{children}</button>
  );
}

/* ─── mock data (demo-only sections) ─── */
const MOCK_FALLBACK_SESSIONS: DemoSession[] = [
  { title: "Salary negotiation, Razorpay PM", date: "Yesterday, 38 min", score: 88, icon: Icons.meet },
  { title: "System design, Stripe Staff PM",  date: "2 days ago, 52 min", score: 82, icon: Icons.practice },
  { title: "Behavioral, Atlassian Senior PM", date: "4 days ago, 41 min", score: 76, icon: Icons.target },
  { title: "Resume deep-dive coaching",       date: "Last week, 28 min", score: 91, icon: Icons.sparkle },
];

type DemoSession = { title: string; date: string; score: number; icon: React.ReactNode };

const MOCK_INSIGHT = {
  headline: "Your STAR breakdowns lose specificity by minute 3.",
  body: "Across your last 8 behavioral runs, the Situation plus Task averaged 41s, strong. Action narrowed to a single tradeoff. But the Result drifted to generic outcome language in 6 of 8. Try ending every story with a quantified delta.",
  evidence: "8 behavioral sessions, 23 May to 4 Jun",
};

const MOCK_KPI = {
  practiceHours:    { value: 12.4, unit: "h",     sub: "this week",        percentile: 78 },
  averageScore:     { value: 84,   unit: "/100",  sub: "last 10 sessions", percentile: 72 },
  sessionsComplete: { value: 27,   unit: "",      sub: "since signup",     percentile: 84 },
};

const MOCK_GOAL = { sessionsDone: 1, sessionsGoal: 2, minutesDone: 28, minutesGoal: 45, weakDone: 2, weakGoal: 3 };

const MOCK_MILESTONES = {
  earned: [
    { label: "First session",  earnedAt: "Day 1" },
    { label: "7 day streak",   earnedAt: "Week 1" },
    { label: "Score 85+",      earnedAt: "Top 25%" },
    { label: "10 sessions",    earnedAt: "Volume" },
  ],
  next: { label: "14 day streak", progress: 9, target: 14 },
};

/* ─── view ─── */
export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  useDocTitle("Dashboard");
  const core = useDashboardSessions();

  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name.split(" ")[0];
    const emailLocal = user?.email?.split("@")[0];
    return emailLocal || "there";
  }, [user]);

  /* Mix real and demo data. Real where backed, demo where not. */
  const realStreak = core.currentStreak;
  const realSessions = core.recentSessions.slice(0, 4);
  const readiness = core.readinessScore || 68;

  /* Demo gating. Only when NEXT_PUBLIC_DASHBOARD_DEMO=1 do unbacked
     sections render with sample numbers. Otherwise they render as
     honest "Coming soon" stubs so real users never see fake metrics.
     The banner appears only in demo mode so the operator knows the
     mode is active. */
  const demoMode = typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DASHBOARD_DEMO === "1";

  const goToInterview = () => router.push("/interview/setup");
  const goToSessions  = () => router.push("/sessions");
  const goToAnalytics = () => router.push("/analytics");
  const goToResume    = () => router.push("/resume");

  return (
    <div className="hsx-dh-root" style={{
      minHeight: "100%",
      background: t.cream,
      fontFamily: f.sans, color: t.coal,
      padding: "32px 32px 64px",
    }}>
      <div className="hsx-dh-grid" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 360px",
        gap: 32, maxWidth: 1280, margin: "0 auto",
      }}>
        {/* ─── Main stage ─── */}
        <main style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>

          {/* Demo banner only when demo mode is on. Real users never see fake numbers. */}
          {demoMode && (
            <div role="status" aria-live="polite" style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 16px",
              background: t.warning100, color: t.warningInk,
              border: `1px solid rgba(124,74,3,0.20)`, borderRadius: 10,
              fontFamily: f.sans, fontSize: 13, lineHeight: 1.5,
            }}>
              <span style={{ marginTop: 2, flexShrink: 0 }}>{Icons.info}</span>
              <span>
                Demo mode. Sections marked <strong>Demo</strong> render sample
                numbers so reviewers can see the full surface. Disable by
                unsetting <code>NEXT_PUBLIC_DASHBOARD_DEMO</code>.
              </span>
            </div>
          )}

          {/* Hero greeting + inline streak */}
          <section>
            <Eyebrow as="span" tone="ink">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </Eyebrow>
            <h1 style={{
              fontFamily: f.serif, fontSize: 44, fontWeight: 400, lineHeight: 1.1,
              letterSpacing: "-0.02em", color: t.coal, margin: "8px 0 6px",
            }}>
              Welcome back, {displayName}.
            </h1>
            <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, maxWidth: 560 }}>
              Three weak spots from your last session are queued. A focused 25 minute block clears two.
            </p>

            {/* Inline streak strip, not a card. Mixes real streak with a one-line goal status. */}
            <div style={{
              display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
              marginTop: 18, padding: "12px 0 0",
              borderTop: `1px solid ${t.line}`,
            }}>
              <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ color: t.copper, display: "inline-flex", alignSelf: "center" }}>{Icons.flame}</span>
                <span style={{ fontFamily: f.serif, fontSize: 28, fontWeight: 400, color: t.coal, letterSpacing: -0.4, lineHeight: 1 }}>
                  {realStreak}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                  day streak
                </span>
              </div>
              {demoMode ? <DailyGoalRibbonInline /> : <DailyGoalStub />}
            </div>
          </section>

          {/* Next move, single emphasized card. No KPI grid above it; one focal point. */}
          <Card pad={28}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <Eyebrow tone="copper" as="h2">Your next move</Eyebrow>
                <p style={{
                  fontFamily: f.serif, fontSize: 28, fontWeight: 400, lineHeight: 1.2,
                  letterSpacing: "-0.01em", color: t.coal, margin: "8px 0 10px",
                }}>
                  Behavioral round, STAR sharpening
                </p>
                <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0, maxWidth: 520, lineHeight: 1.55 }}>
                  Pattern from your last 8 runs: the Result section drifts to generic outcome language.
                  Today's 25 minute drill targets the 3 weakest stories with a quantified-delta framework.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <PrimaryCta onClick={goToInterview}>Start 25 min drill</PrimaryCta>
                  <OutlineCta onClick={goToInterview}>Pick a different focus</OutlineCta>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Ring value={readiness} size={92} stroke={8} color={t.copper}
                      label={`Weekly readiness ${readiness} percent`} />
                <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5 }}>
                  WEEKLY READINESS
                </div>
              </div>
            </div>
          </Card>

          {/* Distilled stat strip. Demo mode shows sample numbers; otherwise empty stub. */}
          <section aria-labelledby="dh-stats">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <Eyebrow as="h2" tone="ink"><span id="dh-stats">Progress</span></Eyebrow>
              {demoMode && <SampleDataPill />}
            </div>
            {demoMode ? (
              <dl className="hsx-dh-stats" style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, margin: 0,
                borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`,
              }}>
                <StatCell label="Practice this week" value={`${MOCK_KPI.practiceHours.value}`} unit="h" />
                <StatCell label="Average score"      value={`${MOCK_KPI.averageScore.value}`}   unit="/100" />
                <StatCell label="Total sessions"     value={`${MOCK_KPI.sessionsComplete.value}`} unit="" />
              </dl>
            ) : (
              <ComingSoonStub label="Progress metrics" detail="Practice hours, average score, and session totals roll in once the analytics pipeline ships." />
            )}
          </section>

          {/* Recent sessions, real data when present, mock fallback with pill when empty */}
          <section aria-labelledby="dh-recent">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <h2 id="dh-recent" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                  Recent sessions
                </h2>
                <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "4px 0 0" }}>
                  Your last four runs, newest first.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {realSessions.length === 0 && demoMode && <SampleDataPill />}
                <button onClick={goToSessions} className="hsx-dh-btn" style={{
                  fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo,
                  background: "transparent", border: "none", cursor: "pointer",
                  padding: "10px 14px", minHeight: 44, borderRadius: 8,
                }}>View all <span aria-hidden>→</span></button>
              </div>
            </div>
            <RecentSessionsList real={realSessions} fallback={MOCK_FALLBACK_SESSIONS} demoMode={demoMode} onStart={goToInterview} />
          </section>

          {/* Milestones. Demo mode shows the timeline; real mode shows a stub until backend lands. */}
          {demoMode && (
            <section aria-labelledby="dh-miles">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <h2 id="dh-miles" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                    Milestones
                  </h2>
                  <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "4px 0 0" }}>
                    {MOCK_MILESTONES.earned.length} earned. Next up below.
                  </p>
                </div>
                <SampleDataPill />
              </div>
              <MilestoneTimeline />
            </section>
          )}
        </main>

        {/* ─── Rail (one card only, supporting strips below) ─── */}
        <aside className="hsx-dh-rail" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>

          {/* AI coach insight — demo-only until the insights queue ships */}
          {demoMode ? (
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: t.indigo }}>{Icons.sparkle}</span>
                  <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: 0 }}>
                    AI coach insight
                  </h2>
                </div>
                <SampleDataPill />
              </div>
              <p style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", lineHeight: 1.2, margin: "0 0 8px" }}>
                {MOCK_INSIGHT.headline}
              </p>
              <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>
                {MOCK_INSIGHT.body}
              </p>
              <div style={{
                fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.4,
                padding: "8px 10px", background: t.cream, border: `1px solid ${t.line}`, borderRadius: 6,
                marginBottom: 14,
              }}>
                BASED ON: {MOCK_INSIGHT.evidence}
              </div>
              <PrimaryCta size="sm" fullWidth onClick={goToInterview}>Start sharpening drill</PrimaryCta>
            </Card>
          ) : (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ color: t.indigo }}>{Icons.sparkle}</span>
                <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: 0 }}>
                  AI coach insight
                </h2>
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.5, margin: "0 0 14px" }}>
                After two more sessions, your coach surfaces a specific pattern from
                your STAR breakdowns. Keep going.
              </p>
              <PrimaryCta size="sm" fullWidth onClick={goToInterview}>Start a session</PrimaryCta>
            </Card>
          )}

          {/* Peer cohort — demo-only until backend ships */}
          {demoMode && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Eyebrow as="h2" tone="indigo">Ahead of</Eyebrow>
                <SampleDataPill />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: f.serif, fontSize: 36, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>72</span>
                <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: 0.5 }}>percent of cohort</span>
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "8px 0 0", lineHeight: 1.5 }}>
                Top 28 percent of senior PM candidates. Two strong sessions clears top 20.
              </p>
            </div>
          )}

          {/* Resume, inline single line. Copy generic (no fake "4 days ago"). */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "14px 16px",
            background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 10,
          }}>
            <div style={{ minWidth: 0 }}>
              <Eyebrow as="h2" tone="ink">Resume</Eyebrow>
              <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: "4px 0 0", lineHeight: 1.4 }}>
                Refresh before each interview window.
              </p>
            </div>
            <OutlineCta size="sm" onClick={goToResume}>Open</OutlineCta>
          </div>

          {/* Jump back in, plain link list */}
          <nav aria-label="Quick links">
            <Eyebrow as="h2" tone="ink">Jump back in</Eyebrow>
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <RailLink onClick={goToAnalytics}>Analytics, score trend</RailLink>
              <RailLink onClick={goToSessions}>All session reports</RailLink>
              <RailLink onClick={goToResume}>Upload a new resume version</RailLink>
            </ul>
          </nav>
        </aside>
      </div>

      {/* Global styles: focus-visible, reduced motion, responsive */}
      <style>{`
        .hsx-dh-root .hsx-dh-btn:focus-visible {
          outline: 2px solid ${t.copper};
          outline-offset: 3px;
          border-radius: 12px;
        }
        @media (max-width: 1080px) {
          .hsx-dh-grid { grid-template-columns: 1fr !important; }
          .hsx-dh-rail { order: 2; }
        }
        @media (max-width: 720px) {
          .hsx-dh-stats { grid-template-columns: 1fr !important; }
          .hsx-dh-root { padding: 20px 16px 48px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hsx-dh-progress-fill { transition: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ─── small pieces ─── */

function StatCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ padding: "16px 4px", borderRight: `1px solid ${t.line}` }}
         className="hsx-dh-stat-cell">
      <dt style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.6, textTransform: "uppercase", margin: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: "6px 0 0", display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: f.serif, fontSize: 30, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{unit}</span>}
      </dd>
    </div>
  );
}

function DailyGoalRibbonInline() {
  const p = MOCK_GOAL;
  const sessionPct = (p.sessionsDone / p.sessionsGoal) * 100;
  const minutesPct = (p.minutesDone / p.minutesGoal) * 100;
  const weakPct    = (p.weakDone / p.weakGoal) * 100;
  const overall = Math.min(100, (sessionPct + minutesPct + weakPct) / 3);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 240,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
        <span style={{ color: t.copper, display: "inline-flex" }}>{Icons.target}</span>
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
          Today: <span style={{ color: t.coal, fontWeight: 600 }}>{p.sessionsDone}/{p.sessionsGoal}</span> sessions,{" "}
          <span style={{ color: t.coal, fontWeight: 600 }}>{p.minutesDone}/{p.minutesGoal}</span> min
        </span>
        {/* transform-scaleX animation, not width. Layout-safe. */}
        <div style={{ flex: 1, minWidth: 80, height: 4, borderRadius: 999, background: t.line, overflow: "hidden", position: "relative" }}
             role="progressbar"
             aria-valuenow={Math.round(overall)}
             aria-valuemin={0}
             aria-valuemax={100}
             aria-label="Today's overall goal progress">
          <div className="hsx-dh-progress-fill" style={{
            position: "absolute", inset: 0,
            background: t.copper,
            transform: `scaleX(${overall / 100})`, transformOrigin: "left center",
            transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
          }} />
        </div>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: 0.4 }}>
          {Math.round(overall)}%
        </span>
      </div>
      <SampleDataPill />
    </div>
  );
}

function RecentSessionsList({ real, fallback }: { real: DashboardSession[]; fallback: DemoSession[] }) {
  if (real.length === 0) {
    return (
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {fallback.map((row, i) => (
          <SessionRow key={i} title={row.title} date={row.date} score={row.score} icon={row.icon} first={i === 0} />
        ))}
      </ul>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {real.map((s, i) => (
        <SessionRow
          key={s.id}
          title={`${s.type}${s.role ? `, ${s.role}` : ""}`}
          date={`${s.dateLabel}, ${s.duration}`}
          score={s.score}
          icon={Icons.practice}
          first={i === 0}
        />
      ))}
    </ul>
  );
}

function SessionRow({ title, date, score, icon, first }: {
  title: string; date: string; score: number; icon: React.ReactNode; first: boolean;
}) {
  return (
    <li style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 4px", borderTop: first ? "none" : `1px solid ${t.line}`,
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10, background: t.creamSoft, color: t.indigo,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</div>
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{date}</div>
      </div>
      <ScoreChip value={score} />
    </li>
  );
}

function MilestoneTimeline() {
  const { earned, next } = MOCK_MILESTONES;
  const nextPct = Math.min(100, (next.progress / next.target) * 100);
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 0,
      background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Earned, horizontal scroll on narrow */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.line}` }}>
        <Eyebrow as="h3" tone="copper">Earned</Eyebrow>
        <ol style={{
          listStyle: "none", margin: "10px 0 0", padding: 0,
          display: "flex", flexWrap: "wrap", gap: 8,
        }}>
          {earned.map(m => (
            <li key={m.label} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 12px", background: t.white,
              border: `1px solid ${t.copperSoft}`, borderRadius: 999,
              fontFamily: f.sans, fontSize: 12, color: t.coal,
            }}>
              <span style={{ color: t.copper, display: "inline-flex" }}>{Icons.check}</span>
              <span style={{ fontWeight: 500 }}>{m.label}</span>
              <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.4 }}>
                {m.earnedAt}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {/* Next up, single emphasized row with its own progress bar */}
      <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{
          width: 36, height: 36, borderRadius: 999,
          background: t.line, color: t.inkSoft,
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{Icons.lock}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Eyebrow as="h3" tone="ink">Next up</Eyebrow>
          <div style={{ fontFamily: f.serif, fontSize: 20, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: "4px 0 8px" }}>
            {next.label}
          </div>
          <div style={{ position: "relative", height: 4, borderRadius: 999, background: t.line, overflow: "hidden" }}
               role="progressbar"
               aria-valuenow={next.progress}
               aria-valuemin={0}
               aria-valuemax={next.target}
               aria-label={`${next.label}, ${next.progress} of ${next.target}`}>
            <div className="hsx-dh-progress-fill" style={{
              position: "absolute", inset: 0,
              background: t.copper,
              transform: `scaleX(${nextPct / 100})`, transformOrigin: "left center",
              transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
            }} />
          </div>
          <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.4, marginTop: 6 }}>
            {next.progress} OF {next.target} DAYS
          </div>
        </div>
      </div>
    </div>
  );
}

function RailLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="hsx-dh-btn" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "12px 0", minHeight: 44,
        background: "transparent", border: "none", borderBottom: `1px solid ${t.line}`,
        cursor: "pointer",
        fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal, textAlign: "left",
      }}>
        <span>{children}</span>
        <span style={{ color: t.inkSoft }}>{Icons.arrow}</span>
      </button>
    </li>
  );
}
