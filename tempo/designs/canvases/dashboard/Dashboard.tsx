/* HireStepX — Dashboard canvas / v4 Editorial redesign
 *
 * Design thesis: this is not a SaaS analytics dashboard. It's the
 * front page of a magazine where the user is the protagonist. One
 * hero, one spotlight, one ribbon. Magazine layout, not control-
 * panel layout.
 *
 * Visual rules:
 *   1. No persistent sidebar. Slim top nav, ⌘K for everything else.
 *   2. Single column, max-width 720 (reading column). Whitespace
 *      does the dividing, not borders.
 *   3. Hero serif does the heavy lifting — 64-88pt headlines that
 *      say something specific and present-tense.
 *   4. Numbers earn type-weight. Small mono for timestamps, big
 *      serif italic for the protagonist number, nothing in between.
 *   5. One copper accent moment per scroll. Not every card flagged.
 *   6. No card-on-card. Use horizontal rules and quiet shadows.
 *   7. Coach voice. "I noticed you tend to..." not "Your clarity
 *      climbed +14%." Data is observation, not metric.
 *
 * Variants:
 *   - returning       : "The cover"      (default)
 *   - empty           : "The invitation"
 *   - interview-imminent: "The countdown"
 *   - power-user      : "The chapter"
 *   - loading         : skeleton, same shape
 *   - mobile          : single-column phone layout (already minimal)
 */
import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { DASHBOARD_STYLES } from "./_styles";
import {
  Wordmark, Icons, Pill, Skeleton, Sparkline, ContributionGraph,
  type ContribDay,
} from "./_atoms";

export type DashboardVariant =
  | "returning"
  | "empty"
  | "power-user"
  | "loading"
  | "interview-imminent"
  | "mobile";

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
  if (variant === "loading") return <Skeletonized userName={userName} />;
  if (variant === "mobile")  return <MobileEditorial userName={userName} />;

  const story = buildStory(variant, userName, greetingHour);

  return (
    <div style={{ background: t.cream, minHeight: 1024, fontFamily: f.sans, color: t.coal }}>
      <style>{DASHBOARD_STYLES}</style>

      <TopBar userName={userName} unreadCount={story.unreadCount} />

      {/* Reading column — magazine layout, max-width 760px */}
      <article style={{
        maxWidth: 760, margin: "0 auto", padding: "72px 32px 120px",
        position: "relative",
      }}>
        {/* Eyebrow — date + (optional) countdown badge */}
        <div className="hsx-db-stage" style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          <header>
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              fontFamily: f.mono, fontSize: 11, fontWeight: 500,
              color: t.inkSoft, letterSpacing: 1.2, textTransform: "uppercase",
              marginBottom: 24,
            }}>
              <span>{story.dateLabel}</span>
              {story.countdownBadge && (
                <>
                  <span style={{ color: t.line }}>—</span>
                  <span style={{ color: t.copper }}>{story.countdownBadge}</span>
                </>
              )}
            </div>

            {/* HERO — the cover line */}
            <h1 className="hsx-db-hero" style={{
              fontFamily: f.serif, fontSize: 76, fontWeight: 400,
              color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.04,
              margin: 0, textWrap: "balance" as React.CSSProperties["textWrap"],
            }}>
              {story.heroBefore}
              {story.heroAccent && (
                <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 400 }}>
                  {story.heroAccent}
                </em>
              )}
              {story.heroAfter}
            </h1>

            {/* Body — one ground line */}
            <p style={{
              fontFamily: f.sans, fontSize: 18, color: t.inkSoft,
              margin: "28px 0 0", lineHeight: 1.55, maxWidth: 600,
              textWrap: "pretty" as React.CSSProperties["textWrap"],
            }}>
              {story.heroBody}
            </p>
          </header>

          {/* Inline metric ribbon — text-not-tiles. The numbers live as
               a sentence under the hero, not in three separate cards.
               This is the core design move that separates the
               editorial v4 from the dashboard v3. */}
          {story.ribbon && (
            <div style={{
              display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
              paddingTop: 28, borderTop: `1px solid ${t.line}`,
            }}>
              {story.ribbon.map((m, i) => (
                <React.Fragment key={m.label}>
                  {i > 0 && <span aria-hidden style={{ color: t.line }}>·</span>}
                  <span style={{
                    display: "inline-flex", alignItems: "baseline", gap: 8,
                    fontFamily: f.sans, fontSize: 14, color: t.inkSoft,
                  }}>
                    <span style={{
                      fontFamily: f.serif, fontStyle: "italic",
                      fontSize: 22, color: t.coal, letterSpacing: "-0.01em",
                    }}>{m.value}</span>
                    <span>{m.label}</span>
                    {m.delta && (
                      <span style={{
                        fontFamily: f.mono, fontSize: 10, fontWeight: 500,
                        color: m.deltaTone === "up" ? t.success : m.deltaTone === "down" ? t.copper : t.inkFaint,
                        letterSpacing: 0.4, marginLeft: 2,
                      }}>{m.delta}</span>
                    )}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Primary action — single, generous button.
               No "View details" sibling. Scarcity = clarity. */}
          {story.action && (
            <PrimaryAction
              eyebrow={story.action.eyebrow}
              label={story.action.label}
              meta={story.action.meta}
              kind={story.action.kind ?? "default"}
            />
          )}

          {/* Editorial spotlight — the AI insight as a pullquote.
               No bordered card; the visual weight comes from the
               serif italic, generous indent, and a hairline divider. */}
          {story.spotlight && (
            <Spotlight
              eyebrow="The coach noticed"
              quote={story.spotlight.quote}
              attribution={story.spotlight.attribution}
              ctaLabel={story.spotlight.ctaLabel}
            />
          )}

          {/* Below-the-fold — one of three patterns depending on variant:
               recent activity (returning), what-you-will-do (empty),
               session plan (imminent), or chapter list (power-user). */}
          {story.below}

          {/* Closing line — daily tip, low-emphasis, last thing on the page */}
          {story.dailyTip && (
            <div style={{
              borderTop: `1px solid ${t.line}`, paddingTop: 28,
              fontFamily: f.sans, fontSize: 13, color: t.inkSoft,
              lineHeight: 1.6, fontStyle: "italic",
            }}>
              {story.dailyTip}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

/* ─── Top bar — slim, restrained. No sidebar. ─────────────────────── */
function TopBar({ userName, unreadCount }: { userName: string; unreadCount: number }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "20px 32px", borderBottom: `1px solid ${t.line}`,
      background: t.cream, position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Wordmark size={20} />
        <nav style={{ display: "flex", gap: 4, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}>
          {[
            { label: "Today", active: true },
            { label: "Practice" },
            { label: "Journeys", badge: "NEW" },
            { label: "Progress" },
          ].map(item => (
            <button key={item.label} style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: item.active ? t.copperSoft : "transparent",
              color: item.active ? t.copper : t.inkSoft,
              fontFamily: f.sans, fontSize: 13, fontWeight: 500, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {item.label}
              {item.badge && (
                <span style={{
                  fontFamily: f.mono, fontSize: 9, color: t.copper,
                  background: t.copperSoft, padding: "1px 5px", borderRadius: 999,
                  letterSpacing: 0.3,
                }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* ⌘K affordance — replaces the persistent sidebar */}
        <button aria-label="Search and shortcuts" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderRadius: 8,
          background: t.white, border: `1px solid ${t.line}`,
          fontFamily: f.sans, fontSize: 12, color: t.inkSoft,
          cursor: "pointer", minWidth: 220,
        }}>
          {Icons.sparkle}
          <span style={{ flex: 1, textAlign: "left" }}>Ask anything…</span>
          <span style={{
            fontFamily: f.mono, fontSize: 10, color: t.inkFaint,
            padding: "2px 6px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 4,
          }}>⌘K</span>
        </button>
        <button aria-label="Notifications" style={{
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.line}`,
          background: t.white, color: t.inkSoft, cursor: "pointer", position: "relative",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {Icons.bell}
          {unreadCount > 0 && (
            <span style={{
              position: "absolute", top: 8, right: 9,
              width: 6, height: 6, borderRadius: 999, background: t.copper,
            }} />
          )}
        </button>
        <button aria-label={`Account: ${userName}`} style={{
          width: 32, height: 32, borderRadius: 999, border: `1px solid ${t.line}`,
          background: t.indigo100, color: t.indigo, cursor: "pointer",
          fontFamily: f.serif, fontSize: 13, fontWeight: 400,
        }}>
          {userName.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("")}
        </button>
      </div>
    </header>
  );
}

/* ─── PrimaryAction — single, generous, intent-laden CTA.
       Eyebrow caption + label + meta line. No siblings. */
function PrimaryAction({
  eyebrow, label, meta, kind,
}: { eyebrow: string; label: string; meta?: string; kind: "default" | "imminent" | "journey" }) {
  const accent = kind === "imminent" ? t.copper : t.indigo;
  const accentBg = kind === "imminent" ? t.copperSoft : t.indigo100;
  return (
    <div style={{
      padding: "32px 36px", borderRadius: 20,
      background: t.white, border: `1px solid ${t.line}`,
      boxShadow: shadows.card, display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{
        fontFamily: f.mono, fontSize: 11, fontWeight: 500,
        color: accent, letterSpacing: 1.0, textTransform: "uppercase",
      }}>{eyebrow}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, marginTop: 6 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontFamily: f.serif, fontSize: 32, fontWeight: 400, color: t.coal,
            letterSpacing: "-0.015em", lineHeight: 1.15, margin: 0,
          }}>
            {label}
          </h2>
          {meta && (
            <p style={{
              fontFamily: f.sans, fontSize: 14, color: t.inkSoft,
              margin: "10px 0 0", lineHeight: 1.5,
            }}>{meta}</p>
          )}
        </div>
        <button className="hsx-db-cta" style={{
          flexShrink: 0, padding: "16px 24px", borderRadius: 12,
          background: t.indigo, color: "#fff", border: "none", cursor: "pointer",
          fontFamily: f.sans, fontSize: 15, fontWeight: 600, letterSpacing: 0.1,
          display: "inline-flex", alignItems: "center", gap: 10,
          boxShadow: shadows.cta,
        }}>
          <span>Begin</span>
          <span aria-hidden style={{ display: "inline-flex", color: "#fff" }}>{Icons.arrow}</span>
        </button>
      </div>
      {/* Tiny hint of accent — only on the imminent variant */}
      {kind === "imminent" && (
        <div style={{
          marginTop: 14, padding: "10px 14px", background: accentBg,
          borderRadius: 8, fontFamily: f.sans, fontSize: 12, color: accent,
          fontWeight: 500, lineHeight: 1.5,
        }}>
          We've cleared today's other practice — this is what matters most.
        </div>
      )}
    </div>
  );
}

/* ─── Spotlight — pullquote treatment for AI coach insights.
       Editorial weight without a card. Hairline above + indent + serif italic. */
function Spotlight({
  eyebrow, quote, attribution, ctaLabel,
}: { eyebrow: string; quote: string; attribution: string; ctaLabel: string }) {
  return (
    <div>
      <div style={{
        fontFamily: f.mono, fontSize: 11, fontWeight: 500, color: t.copper,
        letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 18,
      }}>{eyebrow}</div>
      <blockquote style={{
        margin: 0, paddingLeft: 28,
        borderLeft: `2px solid ${t.copper}`,
        fontFamily: f.serif, fontSize: 28, fontStyle: "italic", fontWeight: 400,
        color: t.coal, lineHeight: 1.35, letterSpacing: "-0.005em",
        textWrap: "balance" as React.CSSProperties["textWrap"],
      }}>
        “{quote}”
      </blockquote>
      <div style={{
        paddingLeft: 28, marginTop: 18,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap",
      }}>
        <span style={{
          fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: 0.4,
        }}>— {attribution}</span>
        <button className="hsx-db-link" style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.indigo,
          padding: 0, display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {ctaLabel} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Story builder — one declarative object per variant ──────────── */

interface StoryRibbon {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "flat";
}
interface Story {
  dateLabel: string;
  countdownBadge?: string;
  unreadCount: number;
  heroBefore: string;
  heroAccent?: string;
  heroAfter?: string;
  heroBody: string;
  ribbon?: StoryRibbon[];
  action?: { eyebrow: string; label: string; meta?: string; kind?: "default" | "imminent" | "journey" };
  spotlight?: { quote: string; attribution: string; ctaLabel: string };
  below?: React.ReactNode;
  dailyTip?: string;
}

function buildStory(variant: DashboardVariant, userName: string, _hour: number): Story {
  const today = new Date(2026, 4, 12);
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const firstName = userName.split(/\s+/)[0];

  if (variant === "empty") {
    return {
      dateLabel,
      unreadCount: 1,
      heroBefore: `Welcome, ${firstName}. `,
      heroAccent: "Let's begin.",
      heroBody: "Your first session is fifteen minutes. We'll calibrate everything from there — your role, your target, the shape of your stories.",
      action: {
        eyebrow: "Step one",
        label: "Tell us about the role you're targeting.",
        meta: "Two questions, no resume yet, no pressure. You can change everything later.",
        kind: "default",
      },
      below: <FirstStepsList />,
      dailyTip: "There's no right way to start. We've watched a thousand candidates begin — the only thing that matters is that you do.",
    };
  }

  if (variant === "interview-imminent") {
    return {
      dateLabel,
      countdownBadge: "3 days to Razorpay",
      unreadCount: 4,
      heroBefore: "Three days. ",
      heroAccent: "Use them well.",
      heroBody: "Razorpay's senior-PM round emphasises Decision-making. Your last three sessions on that dimension came in six points below your average. Now you know.",
      ribbon: [
        { label: "overall", value: "82", delta: "↑8 / 7d", deltaTone: "up" },
        { label: "decision-making", value: "76", delta: "↓6 vs avg", deltaTone: "down" },
        { label: "clarity", value: "+11%", delta: "trending", deltaTone: "up" },
      ],
      action: {
        eyebrow: "What you should do today",
        label: "A focused 30-min drill on Razorpay-style decisions.",
        meta: "Two trade-off prompts. Real Razorpay questions from May 2026 candidate post-mortems.",
        kind: "imminent",
      },
      spotlight: {
        quote: "When the interviewer pushes back, defend the trade-off before you concede it. Bar raisers read quick yielding as low conviction — and that's the gap I'm watching close in your last six rounds.",
        attribution: "AI coach · May 5–11 · 6 sessions sampled",
        ctaLabel: "See evidence",
      },
      below: <ImminentSchedule />,
      dailyTip: "Three days out, depth beats breadth. Pick one dimension and drill it until you can answer in your sleep.",
    };
  }

  if (variant === "power-user") {
    return {
      dateLabel,
      countdownBadge: "Day 4 of your Google FAANG loop",
      unreadCount: 3,
      heroBefore: "Vikram is waiting at the ",
      heroAccent: "system design",
      heroAfter: " round.",
      heroBody: "You cleared the recruiter screen and the phone-screen coding. The bar raiser noted — twice — that your trade-off articulation is sharper than most senior PMs they see. Now go drive the design.",
      ribbon: [
        { label: "TC across rounds", value: "89", delta: "↑18 / 30d", deltaTone: "up" },
        { label: "behavioural coverage", value: "10/10" },
        { label: "rounds cleared", value: "2/6" },
      ],
      action: {
        eyebrow: "Round 3 of 6",
        label: "System design with Vikram, a staff-level reviewer.",
        meta: "45 minutes. He'll open with a clarification question — drive the conversation.",
        kind: "journey",
      },
      spotlight: {
        quote: "Your first-order answers are crisp now. The next ceiling — the bar-raiser ceiling — is second-order: what your design means for adjacent teams two quarters out. That's the differentiator at staff+.",
        attribution: "AI coach · 12 sessions · senior-PM rubric",
        ctaLabel: "Run a strategic-loop drill",
      },
      below: <ChapterList />,
      dailyTip: "At staff+ levels, pushback is the test. Defend your trade-off before you concede it.",
    };
  }

  // Default — returning user, "the cover"
  return {
    dateLabel,
    unreadCount: 2,
    heroBefore: "You're three sessions from the ",
    heroAccent: "hire bar.",
    heroBody: `Clarity is climbing — fourteen percent in seven days. Structure is plateauing. ${firstName}, you know what to do.`,
    ribbon: [
      { label: "overall", value: "86", delta: "↑12 / 7d", deltaTone: "up" },
      { label: "clarity", value: "+14%", delta: "p81", deltaTone: "up" },
      { label: "structure", value: "68", delta: "↓2 / 7d", deltaTone: "down" },
    ],
    action: {
      eyebrow: "What you should do today",
      label: "A 15-minute focused session on answer structure.",
      meta: "Three behavioural prompts, STAR scaffolding on, no time pressure.",
      kind: "default",
    },
    spotlight: {
      quote: "I noticed something in your last five rounds — you tend to answer well, but you bury the result in the final sentence. Hiring managers decide in the first twenty seconds. Lead with the outcome.",
      attribution: "AI coach · 5 sessions · May 5–11",
      ctaLabel: "Practice result-first",
    },
    below: <RhythmStrip />,
    dailyTip: "Answer the question in one sentence first. The story is the supporting evidence — not the headline.",
  };
}

/* ─── Below-the-fold variants ─────────────────────────────────────── */

/* Empty: a serif numbered list of the first steps. No cards. */
function FirstStepsList() {
  const steps = [
    { label: "Pick a role and target", time: "30 sec" },
    { label: "Upload your resume", time: "1 min" },
    { label: "Run your first session", time: "15 min" },
    { label: "Read your report and choose a focus", time: "5 min" },
  ];
  return (
    <section>
      <div style={{
        fontFamily: f.mono, fontSize: 11, fontWeight: 500, color: t.inkSoft,
        letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 18,
      }}>What today looks like</div>
      <ol style={{
        listStyle: "none", padding: 0, margin: 0, counterReset: "step",
      }}>
        {steps.map((step, i) => (
          <li key={step.label} style={{
            display: "flex", alignItems: "baseline", gap: 24,
            padding: "20px 0", borderTop: i === 0 ? `1px solid ${t.line}` : "none",
            borderBottom: `1px solid ${t.line}`,
          }}>
            <span style={{
              fontFamily: f.serif, fontStyle: "italic", fontSize: 28,
              color: t.copper, fontWeight: 400, letterSpacing: "-0.01em",
              minWidth: 32, textAlign: "right",
            }}>{i + 1}</span>
            <span style={{
              flex: 1, fontFamily: f.serif, fontSize: 22, fontWeight: 400,
              color: t.coal, letterSpacing: "-0.005em", lineHeight: 1.3,
            }}>{step.label}</span>
            <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkFaint, letterSpacing: 0.4 }}>{step.time}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* Default returning: your rhythm — a compact contribution graph + 3
   recent sessions as a flat list. No card chrome around it. */
function RhythmStrip() {
  const rows = [
    { title: "Behavioural · Mock loop",       date: "May 11", score: 88 },
    { title: "Product Manager · Case study",  date: "May 9",  score: 82 },
    { title: "System design · Senior PM",     date: "May 7",  score: 90 },
  ];
  const days: ContribDay[] = makeContribDays("steady");

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      {/* Rhythm */}
      <div>
        <div style={{
          fontFamily: f.mono, fontSize: 11, fontWeight: 500, color: t.inkSoft,
          letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 18,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>Your rhythm</span>
          <span style={{ color: t.line }}>·</span>
          <span style={{ color: t.copper }}>7-day streak</span>
        </div>
        <ContributionGraph days={days} />
      </div>

      {/* Recent — minimal flat list, no boxes */}
      <div>
        <div style={{
          fontFamily: f.mono, fontSize: 11, fontWeight: 500, color: t.inkSoft,
          letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 4,
        }}>Recent sessions</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "baseline", gap: 16,
              padding: "16px 0", borderBottom: `1px solid ${t.line}`,
            }}>
              <span style={{
                fontFamily: f.serif, fontStyle: "italic", fontSize: 20,
                color: t.coal, fontWeight: 400, minWidth: 36, letterSpacing: "-0.01em",
              }}>{r.score}</span>
              <span style={{
                flex: 1, fontFamily: f.sans, fontSize: 15, color: t.coal, fontWeight: 500,
              }}>{r.title}</span>
              <span style={{
                fontFamily: f.mono, fontSize: 11, color: t.inkFaint, letterSpacing: 0.4,
              }}>{r.date}</span>
            </li>
          ))}
        </ul>
        <a href="#all" className="hsx-db-link" style={{
          display: "inline-block", marginTop: 16,
          fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.indigo, textDecoration: "none",
        }}>All sessions →</a>
      </div>
    </section>
  );
}

/* Imminent: 3-day plan as a calendar grid. Each day shows what you'll do. */
function ImminentSchedule() {
  const days = [
    { label: "Today",      sessions: ["30m · Razorpay decision drill", "20m · Self-review"] },
    { label: "Tomorrow",   sessions: ["45m · Mock hiring-manager round", "15m · Salary-neg refresher"] },
    { label: "Thursday",   sessions: ["60m · Full-loop simulation", "Sleep early"] },
  ];
  return (
    <section>
      <div style={{
        fontFamily: f.mono, fontSize: 11, fontWeight: 500, color: t.copper,
        letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 18,
      }}>The next three days</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {days.map((day, i) => (
          <div key={day.label} style={{
            padding: "20px 18px",
            background: i === 0 ? t.copperSoft : t.white,
            border: `1px solid ${i === 0 ? "rgba(180,83,9,0.20)" : t.line}`,
            borderRadius: 12,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{
              fontFamily: f.serif, fontSize: 18, fontWeight: 400,
              color: i === 0 ? t.copper : t.coal, letterSpacing: "-0.005em",
            }}>{day.label}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {day.sessions.map(s => (
                <li key={s} style={{
                  fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.4,
                  paddingLeft: 14, position: "relative",
                }}>
                  <span style={{
                    position: "absolute", left: 0, top: 8,
                    width: 4, height: 4, borderRadius: 999, background: i === 0 ? t.copper : t.line,
                  }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Power-user: round-by-round chapter list. Vertical, like a TOC. */
function ChapterList() {
  const rounds = [
    { num: "I",   title: "Recruiter screen",   persona: "Priya, recruiter",      status: "passed",   score: 84, date: "May 8" },
    { num: "II",  title: "Phone-screen coding", persona: "Arjun, engineer",       status: "passed",   score: 86, date: "May 10" },
    { num: "III", title: "System design",       persona: "Vikram, staff engineer", status: "next",    score: null, date: "Today" },
    { num: "IV",  title: "Hiring manager",      persona: "Anita, EM",             status: "locked",   score: null, date: "Thu" },
    { num: "V",   title: "Bar raiser",          persona: "Daniel, principal",     status: "locked",   score: null, date: "Fri" },
    { num: "VI",  title: "Offer & negotiation", persona: "Priya, recruiter",      status: "locked",   score: null, date: "—" },
  ];
  return (
    <section>
      <div style={{
        fontFamily: f.mono, fontSize: 11, fontWeight: 500, color: t.inkSoft,
        letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 4,
      }}>The loop, in chapters</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rounds.map(r => (
          <li key={r.num} style={{
            display: "flex", alignItems: "baseline", gap: 20,
            padding: "20px 0", borderBottom: `1px solid ${t.line}`,
            opacity: r.status === "locked" ? 0.55 : 1,
          }}>
            <span style={{
              fontFamily: f.serif, fontStyle: "italic", fontSize: 22, fontWeight: 400,
              color: r.status === "next" ? t.copper : t.inkSoft, minWidth: 36, letterSpacing: "-0.01em",
            }}>{r.num}.</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.005em" }}>
                {r.title}
                {r.status === "next" && (
                  <span style={{
                    marginLeft: 12, fontFamily: f.mono, fontSize: 10, color: t.copper,
                    background: t.copperSoft, padding: "3px 8px", borderRadius: 999,
                    letterSpacing: 0.5, verticalAlign: "middle",
                  }}>UP NEXT</span>
                )}
              </div>
              <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 4 }}>
                {r.persona}
              </div>
            </div>
            <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkFaint, letterSpacing: 0.4, minWidth: 60, textAlign: "right" }}>
              {r.date}
            </span>
            <span style={{
              fontFamily: f.serif, fontStyle: r.score ? "italic" : "normal",
              fontSize: r.score ? 22 : 14,
              color: r.status === "passed" ? t.success : r.status === "next" ? t.copper : t.inkFaint,
              minWidth: 44, textAlign: "right", letterSpacing: "-0.01em",
            }}>
              {r.score ?? (r.status === "next" ? "—" : "·")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Skeleton — same shape as the editorial v4 ───────────────────── */
function Skeletonized({ userName: _userName }: { userName: string }) {
  return (
    <div style={{ background: t.cream, minHeight: 1024, fontFamily: f.sans }}>
      <style>{DASHBOARD_STYLES}</style>
      <header style={{ padding: "20px 32px", borderBottom: `1px solid ${t.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Wordmark size={20} />
          <Skeleton width={220} height={32} radius={8} />
        </div>
      </header>
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "72px 32px 120px", display: "flex", flexDirection: "column", gap: 56 }}>
        <div>
          <Skeleton width={200} height={14} />
          <div style={{ marginTop: 18 }}><Skeleton height={72} /></div>
          <div style={{ marginTop: 12 }}><Skeleton width={520} height={56} /></div>
          <div style={{ marginTop: 28 }}><Skeleton width={580} height={20} /></div>
        </div>
        <Skeleton height={120} radius={20} />
        <div>
          <Skeleton width={140} height={14} />
          <div style={{ marginTop: 18 }}><Skeleton height={88} /></div>
        </div>
        <Skeleton height={240} radius={12} />
      </article>
    </div>
  );
}

/* ─── Mobile editorial — same idea, single column, tighter rhythm ──── */
function MobileEditorial({ userName }: { userName: string }) {
  const story = buildStory("returning", userName, 9);
  return (
    <div style={{ background: t.cream, minHeight: 844, fontFamily: f.sans, color: t.coal }}>
      <style>{DASHBOARD_STYLES}</style>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: `1px solid ${t.line}`,
      }}>
        <Wordmark size={18} />
        <div style={{ display: "flex", gap: 8 }}>
          <button aria-label="Search" style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${t.line}`,
            background: t.white, color: t.inkSoft,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>{Icons.sparkle}</button>
          <button aria-label="Notifications" style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${t.line}`,
            background: t.white, color: t.inkSoft, position: "relative",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            {Icons.bell}
            <span style={{
              position: "absolute", top: 6, right: 7, width: 6, height: 6, borderRadius: 999, background: t.copper,
            }} />
          </button>
        </div>
      </header>

      <article style={{ padding: "36px 22px 80px", display: "flex", flexDirection: "column", gap: 36 }}>
        <header>
          <div style={{
            fontFamily: f.mono, fontSize: 10, fontWeight: 500, color: t.inkSoft,
            letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
          }}>{story.dateLabel}</div>
          <h1 style={{
            fontFamily: f.serif, fontSize: 38, fontWeight: 400, color: t.coal,
            letterSpacing: "-0.02em", lineHeight: 1.08, margin: 0,
            textWrap: "balance" as React.CSSProperties["textWrap"],
          }}>
            {story.heroBefore}
            {story.heroAccent && <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 400 }}>{story.heroAccent}</em>}
            {story.heroAfter}
          </h1>
          <p style={{
            fontFamily: f.sans, fontSize: 15, color: t.inkSoft,
            margin: "20px 0 0", lineHeight: 1.55,
          }}>{story.heroBody}</p>
        </header>

        {story.ribbon && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 10,
            paddingTop: 20, borderTop: `1px solid ${t.line}`,
          }}>
            {story.ribbon.map(m => (
              <div key={m.label} style={{
                display: "flex", alignItems: "baseline", justifyContent: "space-between",
                fontFamily: f.sans, fontSize: 14, color: t.inkSoft,
              }}>
                <span>{m.label}</span>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: f.serif, fontStyle: "italic", fontSize: 22, color: t.coal }}>{m.value}</span>
                  {m.delta && (
                    <span style={{
                      fontFamily: f.mono, fontSize: 10,
                      color: m.deltaTone === "up" ? t.success : m.deltaTone === "down" ? t.copper : t.inkFaint,
                    }}>{m.delta}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {story.action && (
          <div style={{
            padding: "24px 22px", borderRadius: 16,
            background: t.white, border: `1px solid ${t.line}`, boxShadow: shadows.card,
          }}>
            <div style={{
              fontFamily: f.mono, fontSize: 10, fontWeight: 500, color: t.indigo,
              letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 8,
            }}>{story.action.eyebrow}</div>
            <h2 style={{
              fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal,
              margin: "0 0 12px", letterSpacing: "-0.01em", lineHeight: 1.2,
            }}>{story.action.label}</h2>
            <button style={{
              width: "100%", padding: "14px 18px", borderRadius: 10,
              background: t.indigo, color: "#fff", border: "none",
              fontFamily: f.sans, fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>Begin {Icons.arrow}</button>
          </div>
        )}

        {story.spotlight && (
          <blockquote style={{
            margin: 0, paddingLeft: 18, borderLeft: `2px solid ${t.copper}`,
            fontFamily: f.serif, fontSize: 19, fontStyle: "italic", color: t.coal,
            lineHeight: 1.4,
          }}>
            “{story.spotlight.quote.slice(0, 140)}…”
          </blockquote>
        )}
      </article>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */
function makeContribDays(profile: "sparse" | "steady" | "intense"): ContribDay[] {
  const baseProfile = {
    sparse:  [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0],
    steady:  [0, 1, 0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1],
    intense: [2, 3, 1, 4, 2, 3, 4, 2, 4, 3, 2, 4, 3, 4],
  } as const;
  const profileArr = baseProfile[profile];
  const days: ContribDay[] = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(2026, 4, 12);
    d.setDate(d.getDate() - (83 - i));
    days.push({ date: d.toISOString().slice(0, 10), intensity: profileArr[i % profileArr.length] as 0|1|2|3|4 });
  }
  return days;
}
