/* HireStepX — Dashboard canvas
   Improved version of the Arjun-Mehta inspiration. Same anatomy
   (sidebar + greeting + hero card + KPI row + focus area + right
   rail), but applies our editorial-warm voice + Caslon-italic-copper
   accent + tighter card hierarchy + Phase-2 journey hint.

   Props-driven: `variant` flips between Returning / Empty / PowerUser
   so a single component renders three storyboards. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { DASHBOARD_STYLES } from "./_styles";
import {
  Wordmark, NavRow, Icons, Eyebrow, Pill, Card, Ring,
  KpiTile, InsightStrip, SessionRowEl, PrimaryCta, OutlineCta,
  DailyGoalRibbon, CountdownPill, ContributionGraph, SkillRadar,
  AchievementBadge, Skeleton, InsightFeed, CommandPalette,
  NotificationPanel, QuickAction,
  type NavItem, type SessionRow, type ContribDay, type RadarPoint,
  type AchievementSpec, type CoachInsight,
  type PaletteSection, type NotificationItem,
} from "./_atoms";

export type DashboardVariant =
  | "returning"
  | "empty"
  | "power-user"
  | "loading"
  | "interview-imminent"
  | "mobile"
  | "command-palette"
  | "notifications";

export interface DashboardProps {
  variant?: DashboardVariant;
  userName?: string;
  greetingHour?: number;
}

export default function Dashboard({
  variant = "returning",
  userName = "Arjun",
  greetingHour = 9,
}: DashboardProps) {
  // Loading state has its own composition — skeletal grid, no real data.
  if (variant === "loading") return <DashboardSkeleton userName={userName} />;
  // Mobile variant — single-column phone composition.
  if (variant === "mobile") return <MobileDashboard userName={userName} greetingHour={greetingHour} />;
  // Overlay variants — render the returning-user dashboard underneath, then layer the overlay on top.
  if (variant === "command-palette" || variant === "notifications") {
    return <OverlayedDashboard variant={variant} userName={userName} greetingHour={greetingHour} />;
  }

  // Defensive: buildVariantData should always return a populated shape for
  // non-overlay variants, but in case of a stale Vite HMR module we merge
  // against the returning-user defaults so a missing field never crashes
  // the render. Cheap insurance against canvas-time hot-reload glitches.
  const data = withDefaults(buildVariantData(variant, userName));
  const greet =
    greetingHour < 12 ? "Good morning" :
    greetingHour < 17 ? "Good afternoon" :
                        "Good evening";

  const today = new Date(2026, 4, 12);
  const dateStr = today.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard",          icon: Icons.home,     active: true },
    { key: "practice",  label: "Practice",           icon: Icons.practice },
    { key: "journeys",  label: "Interview journeys", icon: Icons.layers,   badge: "NEW" },
    { key: "insights",  label: "AI feedback",        icon: Icons.insight },
    { key: "resume",    label: "Resume analysis",    icon: Icons.resume },
    { key: "progress",  label: "Progress",           icon: Icons.progress },
    { key: "bookmarks", label: "Bookmarks",          icon: Icons.bookmark },
  ];

  return (
    <div style={{ background: t.cream, minHeight: 900, fontFamily: f.sans, color: t.coal }}>
      <style>{DASHBOARD_STYLES}</style>

      <div className="hsx-db-grid" style={{
        display: "grid", gridTemplateColumns: "260px 1fr 360px",
        minHeight: 900,
      }}>
        {/* ───── SIDEBAR ───── */}
        <aside className="hsx-db-sidebar" style={{
          background: t.cream, borderRight: `1px solid ${t.line}`,
          padding: "28px 18px", display: "flex", flexDirection: "column", gap: 28,
          position: "sticky", top: 0, height: "100vh",
        }}>
          <div style={{ padding: "0 8px" }}><Wordmark size={22} /></div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {navItems.map(it => <NavRow key={it.key} item={it} />)}
          </nav>

          {variant !== "power-user" && (
            <div style={{
              marginTop: "auto",
              background: `linear-gradient(180deg, ${t.creamSoft} 0%, #FAF7F0 100%)`,
              border: `1px solid ${t.line}`, borderRadius: 14,
              padding: 18,
            }}>
              <Pill tone="copper">PRO</Pill>
              <h3 style={{
                fontFamily: f.serif, fontSize: 22, fontWeight: 400,
                color: t.coal, lineHeight: 1.15, margin: "12px 0 4px",
                letterSpacing: -0.4,
              }}>
                Unlock your <em style={{ color: t.copper, fontStyle: "italic" }}>full potential</em>
              </h3>
              <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
                Unlimited practice, multi-round journeys, and the deep AI coach.
              </p>
              <div style={{ marginTop: 14 }}>
                <PrimaryCta size="sm" fullWidth>Upgrade to Pro</PrimaryCta>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 16, borderTop: `1px solid ${t.line}` }}>
            <NavRow item={{ key: "settings", label: "Settings",       icon: Icons.settings }} />
            <NavRow item={{ key: "help",     label: "Help & support", icon: Icons.help }} />
            <NavRow item={{ key: "logout",   label: "Logout",         icon: Icons.logout }} />
          </div>
        </aside>

        {/* ───── MAIN ───── */}
        <main className="hsx-db-main" style={{ padding: "28px 32px 48px", overflow: "hidden" }}>
          <header className="hsx-db-topbar" style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            gap: 24, marginBottom: 28,
          }}>
            <div className="hsx-db-hero" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{dateStr}</div>
              <h1 className="hsx-db-hero-h1" style={{
                fontFamily: f.serif, fontSize: 56, fontWeight: 400,
                color: t.coal, letterSpacing: "-0.02em", lineHeight: 1.05,
                margin: "6px 0 8px",
              }}>
                {greet}, {userName}.{" "}
                <em style={{ fontStyle: "italic", color: t.copper }}>{data.heroAccent}</em>
              </h1>
              <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.5, maxWidth: 640 }}>
                {data.heroSub}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              {data.countdown && (
                <CountdownPill days={data.countdown.days} role={data.countdown.role} company={data.countdown.company} />
              )}
              {data.streak > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: t.white, border: `1px solid ${t.line}`, borderRadius: 14,
                  padding: "10px 14px", boxShadow: shadows.card,
                }}>
                  <span className="hsx-db-flame" style={{ color: t.copper, fontSize: 22, lineHeight: 1 }}>{Icons.flame}</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, lineHeight: 1 }}>{data.streak}</span>
                    <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, marginTop: 2 }}>day streak</span>
                  </div>
                </div>
              )}
              <button aria-label="Notifications" style={{
                width: 42, height: 42, borderRadius: 12, border: `1px solid ${t.line}`, background: t.white,
                color: t.inkSoft, cursor: "pointer", position: "relative",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                {Icons.bell}
                {data.unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: 8, right: 9,
                    width: 8, height: 8, borderRadius: 999, background: t.copper,
                  }} />
                )}
              </button>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 14px 6px 6px", borderRadius: 999,
                background: t.white, border: `1px solid ${t.line}`,
              }}>
                <span aria-hidden style={{
                  width: 32, height: 32, borderRadius: 999, background: t.indigo100, color: t.indigo,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: f.serif, fontSize: 14, fontWeight: 400,
                }}>{userName.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("")}</span>
                <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal }}>{userName}</span>
              </div>
            </div>
          </header>

          <div className="hsx-db-stage" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Today's goal ribbon — Duolingo-style explicit daily commitment.
                 Suppressed on empty state (no day-1 goal). */}
            {variant !== "empty" && data.dailyGoal && (
              <DailyGoalRibbon
                sessionGoal={data.dailyGoal.sessionGoal}
                sessionsDone={data.dailyGoal.sessionsDone}
                minutesGoal={data.dailyGoal.minutesGoal}
                minutesDone={data.dailyGoal.minutesDone}
                weakSpotsReviewed={data.dailyGoal.weakSpotsReviewed}
                weakSpotsTarget={data.dailyGoal.weakSpotsTarget}
              />
            )}

            {variant === "empty" ? (
              <Card pad={32} background={t.white} interactive={false}
                style={{ background: `linear-gradient(135deg, #FAF7F0 0%, ${t.copper100} 100%)` }}>
                <Eyebrow>Welcome aboard</Eyebrow>
                <h2 style={{
                  fontFamily: f.serif, fontSize: 40, fontWeight: 400, color: t.coal,
                  letterSpacing: "-0.02em", lineHeight: 1.1, margin: "10px 0 8px",
                }}>
                  Let's get you <em style={{ color: t.copper, fontStyle: "italic" }}>ready</em>.
                </h2>
                <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, lineHeight: 1.6, maxWidth: 560, margin: 0 }}>
                  Practice your first interview in 15 minutes. We'll tailor questions to your
                  target role and company, and coach you through the answer in real time.
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                  <PrimaryCta>Start your first practice</PrimaryCta>
                  <OutlineCta>Upload resume first</OutlineCta>
                </div>
              </Card>
            ) : variant === "power-user" ? (
              <Card pad={28} background={t.white} interactive>
                <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
                  <div style={{ flex: 1 }}>
                    <Eyebrow>Active journey · Day 4 of 14</Eyebrow>
                    <h2 style={{
                      fontFamily: f.serif, fontSize: 36, fontWeight: 400, color: t.coal,
                      letterSpacing: "-0.02em", lineHeight: 1.1, margin: "8px 0 6px",
                    }}>
                      Your Google FAANG <em style={{ color: t.copper, fontStyle: "italic" }}>loop</em>
                    </h2>
                    <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: "0 0 18px", lineHeight: 1.5 }}>
                      You've cleared the recruiter screen and phone-screen coding.
                      Up next: <strong style={{ color: t.coal, fontWeight: 600 }}>System design</strong> with Vikram, a staff-level reviewer.
                    </p>
                    <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                      {(["pass","pass","next","locked","locked","locked"] as const).map((s, i) => (
                        <div key={i} style={{
                          flex: 1, height: 6, borderRadius: 999,
                          background:
                            s === "pass"   ? t.success :
                            s === "next"   ? t.indigo :
                                             t.line,
                          opacity: s === "locked" ? 0.6 : 1,
                        }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 22, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{Icons.cal} Tue, 5:00 PM</span>
                      <span style={{ color: t.line }}>·</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{Icons.clock} 45 min</span>
                      <span style={{ color: t.line }}>·</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{Icons.target} Round 3 of 6</span>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <PrimaryCta>Begin round 3</PrimaryCta>
                      <OutlineCta>View journey</OutlineCta>
                    </div>
                  </div>
                  <JourneyArt />
                </div>
              </Card>
            ) : (
              <Card pad={28} background={t.white} interactive
                style={{ background: `linear-gradient(135deg, ${t.copper100} 0%, #FAF7F0 70%)` }}>
                <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
                  <div style={{ flex: 1 }}>
                    <Eyebrow>Your next step</Eyebrow>
                    <h2 style={{
                      fontFamily: f.serif, fontSize: 36, fontWeight: 400, color: t.coal,
                      letterSpacing: "-0.02em", lineHeight: 1.1, margin: "8px 0 18px",
                    }}>
                      Product Manager <em style={{ color: t.copper, fontStyle: "italic" }}>mock</em>
                    </h2>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 22, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{Icons.cal} Today, 5:00 PM</span>
                      <span style={{ color: t.line }}>·</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{Icons.clock} 60 min</span>
                      <span style={{ color: t.line }}>·</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{Icons.meet} Self-paced</span>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <PrimaryCta>Start practice</PrimaryCta>
                      <OutlineCta>View details</OutlineCta>
                    </div>
                  </div>
                  <NextStepArt />
                </div>
              </Card>
            )}

            {variant !== "empty" && (
              <Card>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                    Your improvement snapshot
                  </h3>
                  <a href="#progress" className="hsx-db-link" style={{
                    fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, textDecoration: "none",
                  }}>View full report →</a>
                </div>
                <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 18px" }}>
                  Track what matters. Focus on what improves.
                </p>
                <div className="hsx-db-kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  <KpiTile
                    label="Overall score"
                    value={String(data.kpis.overall)} suffix="/100"
                    sub={`${data.kpis.overallDelta >= 0 ? "↑" : "↓"} ${Math.abs(data.kpis.overallDelta)} pts vs last 7d`}
                    accent="indigo" icon={<>{Icons.target}</>}
                    spark={data.spark.overall}
                    percentile={data.kpis.overallPercentile}
                  />
                  <KpiTile
                    label="Clarity"
                    value={`${data.kpis.clarity >= 0 ? "+" : ""}${data.kpis.clarity}%`}
                    sub={data.kpis.clarity > 8 ? "Great improvement" : data.kpis.clarity > 0 ? "Steady gains" : "Needs attention"}
                    accent="success" icon={<>{Icons.trend}</>}
                    spark={data.spark.clarity}
                    percentile={data.kpis.clarityPercentile}
                  />
                  <KpiTile
                    label="Speaking time"
                    value={`${data.kpis.speaking}%`}
                    sub={data.kpis.speaking >= 55 && data.kpis.speaking <= 70 ? "Good balance" : data.kpis.speaking < 55 ? "Speak more" : "Listen more"}
                    accent="copper" icon={<>{Icons.clock}</>}
                    spark={data.spark.speaking}
                    percentile={data.kpis.speakingPercentile}
                  />
                </div>
                <InsightStrip>
                  <strong style={{ fontWeight: 600 }}>{data.insightHeading}</strong>{" "}
                  {data.insightBody}
                </InsightStrip>
              </Card>
            )}

            {variant !== "empty" && (
              <Card>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ fontFamily: f.serif, fontSize: 20, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                    Behavioral coverage{" "}
                    <em style={{ fontStyle: "italic", color: t.copper, fontSize: 16 }}>{data.coverage}/10</em>
                  </h3>
                  <a href="#practice" className="hsx-db-link" style={{
                    fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, textDecoration: "none",
                  }}>Practice gaps →</a>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
                  <SkillRadar points={data.coverageCells.map(c => ({ label: c.label, score: c.score, touched: c.touched }))} size={300} />
                  <div>
                    <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 14px" }}>
                      Each axis is one of the ten dimensions hiring panels actually score against. Filled area is your last 5-session average; the dotted outer ring is the hire bar at your target tier.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {data.coverageCells.filter(c => !c.touched).slice(0, 4).map(c => (
                        <div key={c.label} style={{
                          padding: "8px 10px", borderRadius: 8,
                          background: t.cream, border: `1px dashed ${t.line}`,
                        }}>
                          <div style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.inkSoft }}>{c.label}</div>
                          <div style={{ fontFamily: f.mono, fontSize: 10, color: t.copper, marginTop: 2, letterSpacing: 0.4 }}>NOT YET — practice this</div>
                        </div>
                      ))}
                      {data.coverageCells.filter(c => !c.touched).length === 0 && (
                        <div style={{
                          gridColumn: "span 2",
                          padding: "10px 12px", borderRadius: 8,
                          background: t.success100, border: `1px solid rgba(21, 128, 61, 0.18)`,
                          fontFamily: f.sans, fontSize: 12.5, color: t.success, fontWeight: 500,
                        }}>
                          ✓ All 10 dimensions covered. Now optimise depth.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {variant !== "empty" && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ color: t.indigo }}>{Icons.target}</span>
                  <h3 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                    Focus area for maximum impact
                  </h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 280px", gap: 24, alignItems: "center" }}>
                  <div style={{ position: "relative", width: 96, height: 96 }}>
                    <Ring value={data.focusPct} size={96} stroke={9} color={t.copper} />
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontFamily: f.serif, fontSize: 24, fontWeight: 400, color: t.coal, lineHeight: 1 }}>{data.focusPct}%</span>
                      <span style={{ fontFamily: f.sans, fontSize: 10, color: t.inkSoft, marginTop: 2, letterSpacing: 0.3 }}>POTENTIAL</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em" }}>{data.focusTitle}</span>
                      <Pill tone="copper">High impact</Pill>
                    </div>
                    <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 14px", lineHeight: 1.55 }}>
                      {data.focusBody}
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {data.focusChips.map(c => (
                        <span key={c} style={{
                          fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.coal,
                          background: t.cream, border: `1px solid ${t.line}`, borderRadius: 999,
                          padding: "6px 12px",
                        }}>{c}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{
                    background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 12, padding: 18,
                  }}>
                    <h4 style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 400, color: t.coal, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                      Ready to <em style={{ color: t.copper, fontStyle: "italic" }}>tighten</em> it?
                    </h4>
                    <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: "0 0 14px", lineHeight: 1.5 }}>
                      A 15-min focused session targeting just this gap.
                    </p>
                    <PrimaryCta size="sm">Start focus practice</PrimaryCta>
                  </div>
                </div>
              </Card>
            )}

            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 18px", background: t.white, border: `1px solid ${t.line}`, borderRadius: 12,
            }}>
              <span style={{ color: t.copper }}>{Icons.sparkle}</span>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, flex: 1 }}>
                <strong style={{ color: t.coal, fontWeight: 600 }}>Daily tip:</strong>{" "}
                {data.dailyTip}
              </span>
              <a href="#tips" className="hsx-db-link" style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, textDecoration: "none" }}>
                More tips →
              </a>
            </div>
          </div>
        </main>

        {/* ───── RIGHT RAIL ───── */}
        <aside className="hsx-db-rail" style={{
          padding: "28px 28px 28px 0", display: "flex", flexDirection: "column", gap: 16,
        }}>
          {variant !== "empty" && data.insights.length > 0 && (
            <Card pad={20} interactive>
              <InsightFeed insights={data.insights} current={data.currentInsight} />
            </Card>
          )}

          {data.recentSessions.length > 0 ? (
            <Card pad={20} interactive>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                  Recent sessions
                </h3>
                <a href="#sessions" className="hsx-db-link" style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.indigo, textDecoration: "none" }}>
                  View all
                </a>
              </div>
              <div>
                {data.recentSessions.map((row, i) => <SessionRowEl key={i} row={row} />)}
              </div>
            </Card>
          ) : (
            <Card pad={20}>
              <h3 style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: "0 0 6px" }}>
                Your sessions{" "}
                <em style={{ fontStyle: "italic", color: t.copper, fontSize: 14 }}>start here</em>
              </h3>
              <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.5, margin: 0 }}>
                Once you complete your first practice, you'll see your scores, weak signals, and improvement arc here.
              </p>
            </Card>
          )}

          {/* Contribution graph — replaces flat streak bar with a 12-week
                practice heatmap (GitHub-pattern). Visual proof of consistency
                that the bare streak number can't convey. */}
          {data.streak >= 3 && (
            <Card pad={20} background={`linear-gradient(135deg, ${t.copper100} 0%, #FAF7F0 100%)`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <h3 style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                  Your <em style={{ fontStyle: "italic", color: t.copper }}>practice</em> rhythm
                </h3>
                <span className="hsx-db-flame" style={{ color: t.copper }}>{Icons.flame}</span>
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: "0 0 14px", lineHeight: 1.45 }}>
                <strong style={{ color: t.coal, fontWeight: 600 }}>{data.streak} days streak</strong> · Top {data.percentile}% this week
              </p>
              <ContributionGraph days={data.contribDays} />
              <div style={{
                marginTop: 14, padding: "10px 12px", background: t.white, border: `1px solid ${t.line}`, borderRadius: 8,
                fontFamily: f.sans, fontSize: 11.5, color: t.inkSoft, lineHeight: 1.5,
              }}>
                <strong style={{ color: t.coal, fontWeight: 600 }}>{data.streakNextMilestone - data.streak} {data.streakNextMilestone - data.streak === 1 ? "day" : "days"}</strong> to your next milestone — keep the rhythm going.
              </div>
            </Card>
          )}

          {/* Achievements — earned + locked tiles. Surfaces gamified
                progression beyond raw streak counts. */}
          {variant !== "empty" && data.achievements.length > 0 && (
            <Card pad={20}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <h3 style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                  Achievements
                </h3>
                <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4 }}>
                  {data.achievements.filter(a => a.earned).length}/{data.achievements.length}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {data.achievements.map(a => <AchievementBadge key={a.key} a={a} />)}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

/* Generate a deterministic 84-day (12-week) contribution feed.
   Variant decides the practice intensity profile. */
function makeContribDays(profile: "sparse" | "steady" | "intense"): ContribDay[] {
  // Deterministic pseudo-random — seed by day index so storyboards are stable.
  const days: ContribDay[] = [];
  const baseProfile = {
    sparse:  [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0],
    steady:  [0, 1, 0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1],
    intense: [2, 3, 1, 4, 2, 3, 4, 2, 4, 3, 2, 4, 3, 4],
  } as const;
  const profileArr = baseProfile[profile];
  for (let i = 0; i < 84; i++) {
    const d = new Date(2026, 4, 12);
    d.setDate(d.getDate() - (83 - i));
    const intensity = profileArr[i % profileArr.length] as 0|1|2|3|4;
    days.push({ date: d.toISOString().slice(0, 10), intensity });
  }
  return days;
}

const ALL_CATEGORIES = [
  "Ownership", "Failure & learning", "Conflict",
  "Pressure", "Communication", "Teamwork",
  "Adaptability", "Decision-making", "Leadership",
  "Self-awareness",
];

/* Defaults fallback — ensures every render has the full shape even if a
   variant branch returns a partially-undefined object (e.g., during a
   Vite HMR transition where _atoms.tsx and Dashboard.tsx are temporarily
   out of sync). Cheap to compute (small literal object) and only the
   missing fields get populated. */
type VData = ReturnType<typeof buildVariantDataInner>;
function withDefaults(d: Partial<VData>): VData {
  const fallbackKpis = { overall: 0, overallDelta: 0, clarity: 0, speaking: 0,
                          overallPercentile: undefined, clarityPercentile: undefined, speakingPercentile: undefined };
  const fallbackSpark = { overall: [0,0,0,0,0,0,0], clarity: [0,0,0,0,0,0,0], speaking: [0,0,0,0,0,0,0] };
  return {
    heroAccent: "ready",
    heroSub: "",
    streak: 0, unreadCount: 0, percentile: 0,
    streakNextMilestone: 7, coverage: 0,
    coverageCells: ALL_CATEGORIES.map(label => ({ label, touched: false, score: 0 })),
    kpis: fallbackKpis, spark: fallbackSpark,
    insightHeading: "", insightBody: "",
    focusPct: 0, focusTitle: "", focusBody: "", focusChips: [] as string[],
    coachHeadline: "", coachBody: "", coachCta: "",
    insights: [] as CoachInsight[], currentInsight: 0,
    recentSessions: [] as SessionRow[],
    dailyTip: "",
    countdown: undefined, dailyGoal: undefined,
    contribDays: [] as ContribDay[],
    achievements: [] as AchievementSpec[],
    ...d,
    // Re-merge nested objects in case the variant only specified part of them.
    kpis: { ...fallbackKpis, ...(d.kpis ?? {}) },
    spark: { ...fallbackSpark, ...(d.spark ?? {}) },
  } as VData;
}

function buildVariantData(variant: DashboardVariant, userName: string) {
  return buildVariantDataInner(variant, userName);
}

function buildVariantDataInner(variant: DashboardVariant, _userName: string) {
  if (variant === "empty") {
    return {
      heroAccent: "ready",
      heroSub: "You haven't started yet — and that's fine. We'll meet you where you are.",
      streak: 0, unreadCount: 1, percentile: 0,
      streakNextMilestone: 7, coverage: 0,
      coverageCells: ALL_CATEGORIES.map(label => ({ label, touched: false, score: 0 })),
      kpis: { overall: 0, overallDelta: 0, clarity: 0, speaking: 0,
              overallPercentile: undefined, clarityPercentile: undefined, speakingPercentile: undefined },
      spark: { overall: [0,0,0,0,0,0,0], clarity: [0,0,0,0,0,0,0], speaking: [0,0,0,0,0,0,0] },
      insightHeading: "", insightBody: "",
      focusPct: 0, focusTitle: "", focusBody: "", focusChips: [] as string[],
      coachHeadline: "", coachBody: "", coachCta: "",
      insights: [] as CoachInsight[],
      currentInsight: 0,
      recentSessions: [] as SessionRow[],
      dailyTip: "Strong answers follow a structure. Lead with the outcome, then walk back through how you got there.",
      countdown: undefined as undefined | { days: number; role: string; company: string },
      dailyGoal: undefined as undefined | { sessionGoal: number; sessionsDone: number; minutesGoal: number; minutesDone: number; weakSpotsReviewed: number; weakSpotsTarget: number },
      contribDays: makeContribDays("sparse"),
      achievements: [] as AchievementSpec[],
    };
  }
  if (variant === "power-user") {
    return {
      heroAccent: "+18 pts",
      heroSub: "Your senior-PM scores cleared the hire bar at every Tier-1 unicorn this week. Push for that final-round nuance.",
      streak: 14, unreadCount: 3, percentile: 6,
      streakNextMilestone: 30, coverage: 10,
      coverageCells: ALL_CATEGORIES.map((label, i) => ({ label, touched: true, score: [88, 84, 79, 86, 91, 82, 76, 89, 73, 81][i] })),
      kpis: { overall: 91, overallDelta: 18, clarity: 22, speaking: 64,
              overallPercentile: 94, clarityPercentile: 89, speakingPercentile: 71 },
      spark: {
        overall:  [72, 75, 78, 80, 83, 85, 87, 88, 89, 90, 91],
        clarity:  [62, 64, 67, 69, 73, 76, 79, 82, 84, 86, 89],
        speaking: [54, 56, 58, 59, 60, 61, 62, 62, 63, 64, 64],
      },
      insightHeading: "You've cleared the hire bar.",
      insightBody: "Now the differentiator is bar-raiser-level depth — second-order trade-offs and willingness to disagree under pressure.",
      focusPct: 32, focusTitle: "Tighten bar-raiser pushback",
      focusBody: "You yield too quickly when the interviewer challenges your design. Stay anchored, ask why they're concerned, then update only if the new info actually changes the trade-off.",
      focusChips: ["Don't fold early", "Ask 'what info would change my mind?'", "Show your math"],
      coachHeadline: "Your first-order answers are crisp. Now invest in second-order.",
      coachBody: "Strong PMs articulate consequences-of-consequences — what your decision means for adjacent teams 6 months out.",
      coachCta: "Run a strategic-loop drill",
      insights: [
        { headline: "Your first-order answers are crisp. Now invest in second-order.",
          body: "Strong PMs articulate consequences-of-consequences — what your decision means for adjacent teams 6 months out.",
          ctaLabel: "Run a strategic-loop drill", priority: "high",
          evidence: "12 sessions sampled · senior-PM rubric" },
        { headline: "Your bar-raiser pushback yields too quickly.",
          body: "In 4 of your last 6 design rounds, you conceded within 2 turns of the interviewer challenging you. Bar raisers read this as low conviction.",
          ctaLabel: "Practice resisting pushback", priority: "high",
          evidence: "May 5–11 · 6 system-design sessions" },
        { headline: "Capacity estimation is your hidden strength.",
          body: "Across 9 system design sessions, your numbers came within 20% of the calibrated answer 7 times. Use this as a confidence anchor.",
          ctaLabel: "See the breakdown", priority: "medium",
          evidence: "9 sessions · system-design rubric" },
        { headline: "Salary-neg score is climbing — push toward closing.",
          body: "You're now consistently getting better than initial offer. The next jump is in walk-away discipline — knowing when to stop.",
          ctaLabel: "Drill walk-away scenarios", priority: "medium",
          evidence: "5 negotiation sessions · last 3 weeks" },
      ] as CoachInsight[],
      currentInsight: 0,
      recentSessions: [
        { title: "Google FAANG · Bar raiser",       date: "May 11, 2026", score: 91 },
        { title: "Google FAANG · System design",    date: "May 10, 2026", score: 88 },
        { title: "Razorpay · Hiring manager",        date: "May 9, 2026",  score: 85 },
        { title: "PhonePe · Senior PM behavioural", date: "May 7, 2026",  score: 84 },
      ] as SessionRow[],
      dailyTip: "At staff+ levels, pushback is the test. Defend your trade-off before you concede it.",
      countdown: undefined as undefined | { days: number; role: string; company: string },
      dailyGoal: { sessionGoal: 2, sessionsDone: 1, minutesGoal: 90, minutesDone: 45, weakSpotsReviewed: 2, weakSpotsTarget: 3 },
      contribDays: makeContribDays("intense"),
      achievements: [
        { key: "first-pass",   label: "First pass",         sub: "BEHAVIORAL",  icon: Icons.target, earned: true },
        { key: "ten-of-ten",   label: "10/10 coverage",     sub: "ALL FOCUSES", icon: Icons.layers, earned: true },
        { key: "five-cos",     label: "5 companies cleared",sub: "HIRE BAR",    icon: Icons.star,   earned: true },
        { key: "two-week",     label: "14-day streak",      sub: "CONSISTENCY", icon: Icons.flame,  earned: true },
        { key: "negotiator",   label: "Salary closer",      sub: "WALK-AWAY",   icon: Icons.trophy, earned: true },
        { key: "loop-cleared", label: "First loop",         sub: "FAANG",       icon: Icons.layers, earned: false },
      ] as AchievementSpec[],
    };
  }
  if (variant === "interview-imminent") {
    return {
      heroAccent: "in 3 days",
      heroSub: "Razorpay senior-PM round on Friday. We've reordered everything around it. Nail the focus area below first.",
      streak: 9, unreadCount: 4, percentile: 12,
      streakNextMilestone: 14, coverage: 8,
      coverageCells: ALL_CATEGORIES.map((label, i) => ({
        label,
        touched: [true, true, true, true, true, true, true, true, false, false][i],
        score: [82, 76, 71, 79, 86, 84, 75, 80, 0, 0][i],
      })),
      kpis: { overall: 82, overallDelta: 8, clarity: 11, speaking: 60,
              overallPercentile: 64, clarityPercentile: 72, speakingPercentile: 58 },
      spark: {
        overall:  [70, 71, 73, 74, 76, 77, 78, 79, 80, 81, 82],
        clarity:  [50, 53, 55, 57, 58, 59, 60, 60, 61, 61, 61],
        speaking: [45, 48, 51, 53, 55, 56, 58, 59, 59, 60, 60],
      },
      insightHeading: "Tighten the gaps Razorpay specifically probes.",
      insightBody: "Their senior-PM loop emphasises Decision-making and Leadership. Your last 3 sessions on those came in 6 pts below your average.",
      focusPct: 78, focusTitle: "Razorpay-specific decision drills",
      focusBody: "Razorpay's hiring-manager round opens with a forced trade-off. Practice the framework: name 2-3 options, name the trade you accept, name what would change your mind.",
      focusChips: ["Forced trade-off", "Razorpay style", "10-min drill"],
      coachHeadline: "Three days. Use them on Decision-making.",
      coachBody: "Two 30-min focused sessions today and tomorrow targeting the exact dimension Razorpay weights heaviest. Skip everything else.",
      coachCta: "Start Razorpay drill",
      insights: [
        { headline: "Three days. Use them on Decision-making.",
          body: "Two 30-min focused sessions today and tomorrow targeting the exact dimension Razorpay weights heaviest. Skip everything else.",
          ctaLabel: "Start Razorpay drill", priority: "high",
          evidence: "Razorpay senior-PM rubric · 5 candidate post-mortems" },
        { headline: "Don't fold on the first counter — they're testing conviction.",
          body: "Razorpay's hiring manager opens with a 'why not the simpler approach' challenge. Practiced response: name what would change your mind, then defend.",
          ctaLabel: "Practice the conviction drill", priority: "high",
          evidence: "Glassdoor · 8 verified Razorpay PM rounds 2025-26" },
        { headline: "Your Salary-Neg score is enough — drop the prep weight.",
          body: "84/100 against the Razorpay band is offer-ready. Don't burn cycles here in the next 72 hours.",
          ctaLabel: "Reallocate practice time", priority: "low",
          evidence: "5 negotiation sessions May 5–11" },
      ] as CoachInsight[],
      currentInsight: 0,
      recentSessions: [
        { title: "Razorpay · Hiring manager (sim)", date: "May 11, 2026", score: 79 },
        { title: "Razorpay · System design (sim)",   date: "May 10, 2026", score: 84 },
        { title: "Behavioural · Decision-making",    date: "May 9, 2026",  score: 76 },
        { title: "Salary negotiation · Mock",        date: "May 8, 2026",  score: 81 },
      ] as SessionRow[],
      dailyTip: "Three days out, depth beats breadth. Pick one dimension and drill it until you can answer in your sleep.",
      countdown: { days: 3, role: "Senior PM", company: "Razorpay" },
      dailyGoal: { sessionGoal: 2, sessionsDone: 0, minutesGoal: 90, minutesDone: 0, weakSpotsReviewed: 0, weakSpotsTarget: 3 },
      contribDays: makeContribDays("steady"),
      achievements: [
        { key: "first-pass", label: "First pass",     sub: "BEHAVIORAL", icon: Icons.target, earned: true },
        { key: "week-streak", label: "7-day streak", sub: "CONSISTENCY",icon: Icons.flame,  earned: true },
        { key: "first-cos",  label: "First company", sub: "HIRE BAR",   icon: Icons.star,   earned: true },
        { key: "ten-of-ten", label: "10/10 coverage", sub: "ALL FOCUSES",icon: Icons.layers, earned: false },
        { key: "two-week",   label: "14-day streak",  sub: "CONSISTENCY",icon: Icons.flame,  earned: false },
        { key: "negotiator", label: "Salary closer",  sub: "WALK-AWAY",  icon: Icons.trophy, earned: false },
      ] as AchievementSpec[],
    };
  }
  // Default: returning user, mid-flow
  return {
    heroAccent: "+12 pts",
    heroSub: "Your clarity climbed +14% this week. Three more sessions to lock in the gain.",
    streak: 7, unreadCount: 2, percentile: 18,
    streakNextMilestone: 14, coverage: 7,
    coverageCells: ALL_CATEGORIES.map((label, i) => ({
      label,
      touched: [true, true, true, true, true, true, true, false, false, false][i],
      score: [86, 78, 72, 81, 88, 84, 76, 0, 0, 0][i],
    })),
    kpis: { overall: 86, overallDelta: 12, clarity: 14, speaking: 62,
            overallPercentile: 72, clarityPercentile: 81, speakingPercentile: 64 },
    spark: {
      overall:  [60, 65, 68, 70, 73, 76, 78, 80, 82, 84, 86],
      clarity:  [40, 44, 48, 51, 53, 55, 56, 58, 59, 60, 62],
      speaking: [48, 50, 52, 54, 55, 57, 58, 59, 60, 61, 62],
    },
    insightHeading: "Your structure is the next jump.",
    insightBody: "You're answering the right things — but in a meandering order. Lead with the outcome, then the actions, then the situation.",
    focusPct: 68, focusTitle: "Improve answer structure",
    focusBody: "Your answers are clear but unstructured. Three of your last five behavioural answers buried the result in the final sentence.",
    focusChips: ["Use STAR framework", "Start with outcome", "Avoid long pauses", "Summarize key points"],
    coachHeadline: "You tend to add extra detail before getting to the point.",
    coachBody: "Try the Result-First pattern: answer the question in one sentence, then layer in the journey. Hiring managers decide in the first 20 seconds.",
    coachCta: "Practice structured answers",
    insights: [
      { headline: "You tend to add extra detail before getting to the point.",
        body: "Try the Result-First pattern: answer the question in one sentence, then layer in the journey. Hiring managers decide in the first 20 seconds.",
        ctaLabel: "Practice structured answers", priority: "high",
        evidence: "5 sessions May 5–11 · Behavioural focus" },
      { headline: "You're underselling your impact.",
        body: "Three of your last five answers had a real outcome but you described it as 'we shipped it'. Lead with the metric.",
        ctaLabel: "Reframe outcome stories", priority: "medium",
        evidence: "5 sessions Behavioural" },
      { headline: "Your speaking pace dropped 12% under pressure.",
        body: "When the AI pushed back, you slowed down — interpretable as composure or as hesitation. Practice rapid-fire follow-ups.",
        ctaLabel: "Pressure-handling drill", priority: "medium",
        evidence: "3 follow-up moments" },
    ] as CoachInsight[],
    currentInsight: 0,
    recentSessions: [
      { title: "Data Analyst · Behavioural",    date: "May 11, 2026", score: 88 },
      { title: "Product Manager · Case study",  date: "May 9, 2026",  score: 82 },
      { title: "System Design · Senior",        date: "May 7, 2026",  score: 90 },
      { title: "Behavioural · Mock loop",       date: "May 5, 2026",  score: 85 },
    ] as SessionRow[],
    dailyTip: "Answer the question in one sentence first. The story is the supporting evidence — not the headline.",
    countdown: undefined as undefined | { days: number; role: string; company: string },
    dailyGoal: { sessionGoal: 1, sessionsDone: 0, minutesGoal: 30, minutesDone: 0, weakSpotsReviewed: 1, weakSpotsTarget: 3 },
    contribDays: makeContribDays("steady"),
    achievements: [
      { key: "first-pass",   label: "First pass",     sub: "BEHAVIORAL", icon: Icons.target, earned: true },
      { key: "week-streak",  label: "7-day streak",   sub: "CONSISTENCY",icon: Icons.flame,  earned: true },
      { key: "first-cos",    label: "First company",  sub: "HIRE BAR",   icon: Icons.star,   earned: true },
      { key: "ten-of-ten",   label: "10/10 coverage", sub: "ALL FOCUSES",icon: Icons.layers, earned: false },
      { key: "two-week",     label: "14-day streak",  sub: "CONSISTENCY",icon: Icons.flame,  earned: false },
      { key: "negotiator",   label: "Salary closer",  sub: "WALK-AWAY",  icon: Icons.trophy, earned: false },
    ] as AchievementSpec[],
  };
}

/* DashboardSkeleton — loading state composition. Matches final layout
   so there's zero-CLS when real data arrives. */
function DashboardSkeleton({ userName }: { userName: string }) {
  return (
    <div style={{ background: t.cream, minHeight: 900, fontFamily: f.sans, color: t.coal }}>
      <style>{DASHBOARD_STYLES}</style>
      <div className="hsx-db-grid" style={{ display: "grid", gridTemplateColumns: "260px 1fr 360px", minHeight: 900 }}>
        {/* Sidebar skeleton */}
        <aside className="hsx-db-sidebar" style={{
          background: t.cream, borderRight: `1px solid ${t.line}`, padding: "28px 18px",
          display: "flex", flexDirection: "column", gap: 18,
        }}>
          <Wordmark size={22} />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} height={20} style={{ marginTop: i === 0 ? 16 : 0 }} />
          ))}
        </aside>
        {/* Main skeleton */}
        <main style={{ padding: "28px 32px 48px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
            <div style={{ flex: 1 }}>
              <Skeleton width={160} height={14} />
              <div style={{ marginTop: 10 }}><Skeleton width={420} height={48} /></div>
              <div style={{ marginTop: 10 }}><Skeleton width={520} height={18} /></div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Skeleton width={120} height={56} radius={14} />
              <Skeleton width={42}  height={42} radius={12} />
              <Skeleton width={140} height={42} radius={999} />
            </div>
          </div>
          <Skeleton height={48} radius={12} />
          <div style={{ marginTop: 20 }}><Skeleton height={220} radius={16} /></div>
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={148} radius={12} />)}
          </div>
          <div style={{ marginTop: 20 }}><Skeleton height={320} radius={16} /></div>
          <div style={{ marginTop: 20 }}><Skeleton height={180} radius={16} /></div>
        </main>
        {/* Right rail skeleton */}
        <aside style={{ padding: "28px 28px 28px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={220} radius={16} />
          <Skeleton height={300} radius={16} />
          <Skeleton height={240} radius={16} />
        </aside>
      </div>
      <span style={{ position: "absolute", left: -9999 }} aria-live="polite">
        Loading dashboard for {userName}
      </span>
    </div>
  );
}

function NextStepArt() {
  return (
    <svg width={220} height={170} viewBox="0 0 220 170" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="36" y="20" width="160" height="118" rx="12" fill={t.white} stroke={t.line} />
      <path d="M52 110 Q80 80 110 95 T180 60" stroke={t.copper} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="180" cy="60" r="5" fill={t.copper} />
      <circle cx="180" cy="34" r="10" fill={t.copperSoft} />
      <path d="m180 28 1.5 4 4 .5-3 3 .8 4-3.3-2-3.3 2 .8-4-3-3 4-.5z" fill={t.copper} />
      <rect x="20" y="60" width="60" height="70" rx="8" fill={t.cream} stroke={t.lineStrong} />
      <rect x="20" y="60" width="60" height="14" rx="8" fill={t.copper} />
      <rect x="20" y="68" width="60" height="6" fill={t.copper} />
      <text x="50" y="106" textAnchor="middle" fontFamily="serif" fontSize="22" fill={t.coal}>20</text>
      <text x="50" y="120" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill={t.inkSoft}>MAY</text>
      <ellipse cx="200" cy="155" rx="14" ry="4" fill={t.line} opacity="0.6" />
      <rect x="190" y="138" width="20" height="14" rx="3" fill={t.creamSoft} stroke={t.lineStrong} />
      <path d="M200 138 Q196 130 200 122 Q204 130 200 138" fill={t.success} opacity="0.7" />
      <path d="M200 138 Q204 132 209 128" stroke={t.success} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function JourneyArt() {
  return (
    <svg width={220} height={170} viewBox="0 0 220 170" aria-hidden style={{ flexShrink: 0 }}>
      {[0,1,2,3,4,5].map((i) => {
        const w = 30, gap = 4;
        const x = 18 + i * (w + gap);
        const h = 14 + i * 14;
        const y = 138 - h;
        const passed = i < 2;
        const next   = i === 2;
        const fill = passed ? t.success100 : next ? t.indigo100 : t.cream;
        const stroke = passed ? t.success : next ? t.indigo : t.lineStrong;
        return <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill={fill} stroke={stroke} />;
      })}
      <g transform="translate(190, 28)">
        <path d="M-12 0 L12 0 L12 16 a12 12 0 0 1-24 0 z" fill={t.copperSoft} stroke={t.copper} strokeWidth="1.5" />
        <rect x="-5" y="20" width="10" height="6" rx="1" fill={t.copperSoft} stroke={t.copper} strokeWidth="1.5" />
        <rect x="-10" y="26" width="20" height="3" rx="1" fill={t.copper} />
        <path d="M12 4 Q22 4 22 14 Q22 22 14 22" fill="none" stroke={t.copper} strokeWidth="1.5" />
        <path d="M-12 4 Q-22 4 -22 14 Q-22 22 -14 22" fill="none" stroke={t.copper} strokeWidth="1.5" />
      </g>
      <path d="M50 100 Q120 60 175 50" stroke={t.copper} strokeWidth="2" strokeDasharray="3 4" fill="none" />
    </svg>
  );
}

/* ─── OverlayedDashboard — renders the returning-user dashboard
       underneath, then layers a CommandPalette or NotificationPanel
       overlay. Demonstrates the overlays in their natural context. */
function OverlayedDashboard({
  variant, userName, greetingHour,
}: { variant: "command-palette" | "notifications"; userName: string; greetingHour: number }) {
  const data = withDefaults(buildVariantData("returning", userName));

  const paletteSections: PaletteSection[] = [
    { label: "Quick actions",
      items: [
        { key: "start-practice", label: "Start practice session", sub: "Pick a focus and go", icon: Icons.practice, shortcut: "P" },
        { key: "resume-last",     label: "Resume last session",   sub: "Behavioural · Mock loop", icon: Icons.clock, shortcut: "R" },
        { key: "upload-resume",   label: "Upload new resume",     icon: Icons.resume, shortcut: "U" },
        { key: "start-journey",   label: "Start an interview journey", sub: "Multi-round simulation · NEW", icon: Icons.layers, shortcut: "J" },
      ],
    },
    { label: "Jump to",
      items: [
        { key: "progress",  label: "Progress & history",  icon: Icons.progress },
        { key: "insights",  label: "AI feedback",         sub: "12 unread insights", icon: Icons.insight },
        { key: "bookmarks", label: "Bookmarks",           icon: Icons.bookmark },
        { key: "settings",  label: "Settings",            icon: Icons.settings },
      ],
    },
    { label: "Recent sessions",
      items: data.recentSessions.slice(0, 3).map((s, i) => ({
        key: `session-${i}`, label: s.title, sub: `${s.date} · scored ${s.score}`, icon: Icons.clock,
      })),
    },
  ];

  const notifications: NotificationItem[] = [
    { id: "1", kind: "evaluation", title: "Your last session is ready", body: "Behavioural mock — scored 88. Top win: clear STAR structure on the ownership prompt.", ago: "2m ago", unread: true },
    { id: "2", kind: "coach",      title: "New high-priority insight", body: "Your bar-raiser pushback yields too quickly — 4 of last 6 sessions.", ago: "12m ago", unread: true },
    { id: "3", kind: "milestone",  title: "7-day streak unlocked!",   body: "You've earned the Consistency badge. ₹0.5 LPA bonus credits added.", ago: "1h ago", unread: false },
    { id: "4", kind: "journey",    title: "Round 2 of your Razorpay journey is ready", body: "The hiring manager round unlocks in 4 hours. Briefing available now.", ago: "3h ago", unread: false },
    { id: "5", kind: "system",     title: "Your salary band was refreshed", body: "Senior PM at Razorpay 2026 bands updated based on May market data.", ago: "yesterday", unread: false },
  ];

  return (
    <div style={{ position: "relative" }}>
      <Dashboard variant="returning" userName={userName} greetingHour={greetingHour} />
      {variant === "command-palette" && (
        <CommandPalette
          query="razor"
          focusKey="start-journey"
          sections={paletteSections}
        />
      )}
      {variant === "notifications" && (
        <NotificationPanel items={notifications} />
      )}
    </div>
  );
}

/* ─── MobileDashboard — phone-portrait composition (390×844). Same
       data, single-column, larger CTAs, swipeable cards. Replaces
       the desktop sidebar with a top app bar + a bottom tab bar. */
function MobileDashboard({ userName, greetingHour }: { userName: string; greetingHour: number }) {
  const data = withDefaults(buildVariantData("returning", userName));
  const greet = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ background: t.cream, minHeight: 844, fontFamily: f.sans, color: t.coal, paddingBottom: 84 }}>
      <style>{DASHBOARD_STYLES}</style>

      {/* Top app bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderBottom: `1px solid ${t.line}`, background: t.cream,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Wordmark size={18} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button aria-label="Notifications" style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.line}`, background: t.white,
            color: t.inkSoft, position: "relative",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            {Icons.bell}
            <span style={{
              position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: 999, background: t.copper,
            }} />
          </button>
          <span aria-hidden style={{
            width: 30, height: 30, borderRadius: 999, background: t.indigo100, color: t.indigo,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: f.serif, fontSize: 13, fontWeight: 400,
          }}>{userName[0]?.toUpperCase()}</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: "20px 18px 0" }}>
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>Tuesday, 12 May</div>
        <h1 style={{
          fontFamily: f.serif, fontSize: 30, fontWeight: 400, color: t.coal,
          letterSpacing: "-0.02em", lineHeight: 1.1, margin: "4px 0 6px",
        }}>
          {greet}, {userName}.{" "}
          <em style={{ fontStyle: "italic", color: t.copper }}>{data.heroAccent}</em>
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
          {data.heroSub}
        </p>
      </div>

      {/* Stage */}
      <div className="hsx-db-stage" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Streak strip — compact */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", background: t.white, border: `1px solid ${t.line}`, borderRadius: 12,
        }}>
          <span className="hsx-db-flame" style={{ color: t.copper }}>{Icons.flame}</span>
          <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.coal, flex: 1 }}>
            {data.streak}-day streak — top {data.percentile}%
          </span>
          <span style={{ fontFamily: f.mono, fontSize: 10, color: t.copper, letterSpacing: 0.4 }}>
            {data.streakNextMilestone - data.streak}d to milestone
          </span>
        </div>

        {/* Next step card — compact */}
        <Card pad={20} style={{ background: `linear-gradient(135deg, ${t.copper100} 0%, #FAF7F0 70%)` }}>
          <Eyebrow>Your next step</Eyebrow>
          <h2 style={{
            fontFamily: f.serif, fontSize: 24, fontWeight: 400, color: t.coal,
            letterSpacing: "-0.01em", lineHeight: 1.15, margin: "6px 0 12px",
          }}>
            Product Manager <em style={{ fontStyle: "italic", color: t.copper }}>mock</em>
          </h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, fontFamily: f.sans, fontSize: 12, color: t.inkSoft, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{Icons.cal} Today, 5:00 PM</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{Icons.clock} 60 min</span>
          </div>
          <PrimaryCta fullWidth>Start practice</PrimaryCta>
        </Card>

        {/* KPI row — stacked */}
        <Card pad={18}>
          <h3 style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: "0 0 12px" }}>
            Improvement snapshot
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <KpiTile label="Overall score" value={String(data.kpis.overall)} suffix="/100"
              sub={`↑ ${data.kpis.overallDelta} pts this week`}
              accent="indigo" icon={<>{Icons.target}</>}
              spark={data.spark.overall} percentile={data.kpis.overallPercentile} />
            <KpiTile label="Clarity" value={`+${data.kpis.clarity}%`}
              sub="Steady gains" accent="success" icon={<>{Icons.trend}</>}
              spark={data.spark.clarity} percentile={data.kpis.clarityPercentile} />
          </div>
        </Card>

        {/* Daily tip */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 16px", background: t.white, border: `1px solid ${t.line}`, borderRadius: 12,
        }}>
          <span style={{ color: t.copper, marginTop: 2 }}>{Icons.sparkle}</span>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, flex: 1, lineHeight: 1.5 }}>
            <strong style={{ color: t.coal, fontWeight: 600 }}>Daily tip:</strong> {data.dailyTip}
          </span>
        </div>
      </div>

      {/* Bottom tab bar — fixed */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
        background: t.white, borderTop: `1px solid ${t.line}`,
        padding: "8px 0 calc(8px + env(safe-area-inset-bottom, 0px))",
        zIndex: 10,
      }}>
        {([
          { key: "home",      label: "Home",     icon: Icons.home, active: true },
          { key: "practice",  label: "Practice", icon: Icons.practice },
          { key: "journeys",  label: "Journeys", icon: Icons.layers },
          { key: "progress",  label: "Progress", icon: Icons.progress },
          { key: "profile",   label: "Profile",  icon: Icons.settings },
        ] as const).map(tab => (
          <button key={tab.key} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 4px", border: "none", background: "transparent", cursor: "pointer",
            color: tab.active ? t.copper : t.inkSoft,
            fontFamily: f.sans, fontSize: 10, fontWeight: 500,
          }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
