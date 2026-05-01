/* HireStepX — Design System / Patterns
   Full UI flows applied. Auth, score reveal, onboarding, empty,
   loading, error recovery — composed from color, type, components. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* Mockup frame — visually represents an app screen */
function ScreenFrame({
  title,
  height = 480,
  children,
}: {
  title: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <MonoLabel color={t.copper}>{title}</MonoLabel>
      <div
        style={{
          marginTop: 12,
          background: t.cream,
          border: `1px solid ${t.line}`,
          borderRadius: 14,
          height,
          overflow: "hidden",
          boxShadow: shadows.card,
          position: "relative",
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            background: t.creamSoft,
            borderBottom: `1px solid ${t.line}`,
            padding: "10px 16px",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFB8B8" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFE0A8" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#B8E5C0" }} />
        </div>
        <div style={{ height: "calc(100% - 33px)", overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemPatterns() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 56px 120px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {/* MASTHEAD */}
        <header style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 40, marginBottom: 64 }}>
          <MonoLabel>Design System · v1.0</MonoLabel>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "12px 0 0",
            }}
          >
            Patterns, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>composition</em>.
          </h1>
          <p
            style={{
              color: t.indigoGray,
              fontSize: 15,
              margin: "16px 0 0",
              maxWidth: 540,
              lineHeight: 1.6,
            }}
          >
            The system applied. Auth flows, score reveals, onboarding,
            dashboards, empty states — all composed from color, typography,
            foundations, motion, and components. Nothing new.
          </p>
        </header>

        {/* 01 — AUTH PATTERN */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Auth screen"
            desc="The canonical pattern. Hero with italic accent. Single primary CTA. Trust footer."
          />
          <ScreenFrame title="Login" height={620}>
            <div
              style={{
                background: t.cream,
                height: "100%",
                padding: "60px 40px 40px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 24,
                  left: 32,
                  fontFamily: f.serif,
                  fontWeight: 500,
                  fontSize: 18,
                  color: t.coal,
                }}
              >
                HireStepX
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 28,
                  right: 32,
                  fontSize: 13,
                  color: t.inkSoft,
                }}
              >
                Don't have an account?{" "}
                <a style={{ color: t.indigo, fontWeight: 500, textDecoration: "none", borderBottom: `1px solid ${t.indigo}` }}>
                  Sign up
                </a>
              </div>
              <div style={{ maxWidth: 440, margin: "20px auto 0" }}>
                <h2
                  style={{
                    fontFamily: f.serif,
                    fontSize: 44,
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.05,
                    textAlign: "center",
                    margin: "0 0 16px",
                  }}
                >
                  Clarity{" "}
                  <em style={{ fontStyle: "italic", fontWeight: 500, color: t.copper }}>
                    wins
                  </em>{" "}
                  interviews.
                </h2>
                <p
                  style={{
                    color: t.indigoGray,
                    fontSize: 13,
                    textAlign: "center",
                    margin: "0 0 28px",
                    lineHeight: 1.6,
                  }}
                >
                  Practice interviews. Improve how you think under pressure.
                </p>

                <button
                  style={{
                    width: "100%",
                    background: t.white,
                    border: `1px solid ${t.lineStrong}`,
                    padding: "12px 20px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    color: t.coal,
                    fontFamily: f.sans,
                    marginBottom: 18,
                  }}
                >
                  ✦ Continue with Google
                </button>
                <div
                  style={{
                    textAlign: "center",
                    color: t.inkFaint,
                    fontSize: 11,
                    margin: "8px 0 16px",
                  }}
                >
                  or
                </div>

                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="name@email.com"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: `1px solid ${t.lineStrong}`,
                    borderRadius: 10,
                    fontFamily: f.sans,
                    fontSize: 14,
                    marginBottom: 14,
                  }}
                />
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: `1px solid ${t.lineStrong}`,
                    borderRadius: 10,
                    fontFamily: f.sans,
                    fontSize: 14,
                    marginBottom: 18,
                  }}
                />
                <button
                  style={{
                    width: "100%",
                    background: t.indigo,
                    color: t.white,
                    border: "none",
                    padding: "13px 22px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: f.sans,
                    boxShadow: "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
                  }}
                >
                  Continue to practise →
                </button>
              </div>
            </div>
          </ScreenFrame>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Anatomy:</b> wordmark
            top-left · context CTA top-right · centered hero with one italic
            accent word · social-first auth · email/password fallback · single
            indigo primary CTA at the bottom of the form.
          </p>
        </section>

        {/* 02 — SCORE REVEAL PATTERN */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Score reveal"
            desc="The aha moment. One copper number. Calibrating context. Single forward action."
          />
          <ScreenFrame title="Result · interview complete" height={520}>
            <div
              style={{
                background: t.cream,
                height: "100%",
                padding: "40px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  background: t.success100,
                  color: t.success,
                  fontSize: 11,
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontWeight: 500,
                  marginBottom: 24,
                }}
              >
                ✓ Analysis complete
              </span>
              <MonoLabel>Clarity Score</MonoLabel>
              <div
                style={{
                  position: "relative",
                  marginTop: 16,
                  width: 240,
                  height: 140,
                }}
              >
                <svg width="240" height="140" viewBox="0 0 240 140">
                  <path
                    d="M 24 120 A 96 96 0 0 1 216 120"
                    fill="none"
                    stroke={t.creamSoft}
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 24 120 A 96 96 0 0 1 216 120"
                    fill="none"
                    stroke={t.copper}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="187 1000"
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    top: 36,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: f.serif,
                      fontSize: 64,
                      fontWeight: 500,
                      lineHeight: 1,
                      color: t.copper,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    62
                    <small
                      style={{
                        fontSize: 18,
                        color: t.inkFaint,
                        marginLeft: 4,
                      }}
                    >
                      /100
                    </small>
                  </div>
                </div>
              </div>
              <p
                style={{
                  fontFamily: f.serif,
                  fontSize: 22,
                  fontWeight: 400,
                  color: t.coal,
                  margin: "20px 0 4px",
                  letterSpacing: "-0.01em",
                  textAlign: "center",
                }}
              >
                Strong foundation.
              </p>
              <p
                style={{
                  color: t.indigoGray,
                  fontSize: 13,
                  margin: "0 0 28px",
                  textAlign: "center",
                  maxWidth: 360,
                  lineHeight: 1.6,
                }}
              >
                Push toward great with focused practice on structure and
                quantified outcomes.
              </p>
              <button
                style={{
                  background: t.indigo,
                  color: t.white,
                  border: "none",
                  padding: "13px 28px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: f.sans,
                  boxShadow: "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
                }}
              >
                Practice your weakest area →
              </button>
            </div>
          </ScreenFrame>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Anatomy:</b> success
            tag (green) confirms what just happened · mono-caps eyebrow · arc
            draws from 0 → 62 with copper · serif headline reframes the score
            positively · ONE primary action with a specific, rooted next step.
          </p>
        </section>

        {/* 03 — DASHBOARD PATTERN */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Dashboard hero"
            desc="The home base. Greeting, primary metric, single next-action card."
          />
          <ScreenFrame title="Dashboard" height={420}>
            <div style={{ background: t.cream, height: "100%", padding: 32 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 32,
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: f.serif,
                      fontSize: 28,
                      fontWeight: 400,
                      letterSpacing: "-0.01em",
                      margin: 0,
                      color: t.coal,
                    }}
                  >
                    Good morning,{" "}
                    <em style={{ fontStyle: "italic", color: t.copper }}>Jay</em>.
                  </p>
                  <p
                    style={{
                      color: t.indigoGray,
                      fontSize: 14,
                      margin: "6px 0 0",
                    }}
                  >
                    You're 5 sessions away from interview-ready.
                  </p>
                </div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: t.copper100,
                    color: t.copper,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  JV
                </div>
              </div>

              {/* KPI row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                {[
                  { label: "Sessions", val: "12", sub: "+3 this week" },
                  { label: "Avg score", val: "68", sub: "+6 from last" },
                  { label: "Streak", val: "5", sub: "days" },
                  { label: "Readiness", val: "62%", sub: "Top 30%" },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      background: t.white,
                      border: `1px solid ${t.line}`,
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <MonoLabel>{kpi.label}</MonoLabel>
                    <div
                      style={{
                        fontFamily: f.serif,
                        fontSize: 28,
                        fontWeight: 500,
                        color: t.copper,
                        marginTop: 4,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {kpi.val}
                    </div>
                    <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>
                      {kpi.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA card */}
              <div
                style={{
                  background: t.indigo,
                  color: t.white,
                  borderRadius: 14,
                  padding: 24,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <MonoLabel color="rgba(255,255,255,.6)">Your next move</MonoLabel>
                  <h3
                    style={{
                      fontFamily: f.serif,
                      fontSize: 22,
                      fontWeight: 400,
                      margin: "8px 0 4px",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Practice salary negotiation
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,.7)",
                      margin: 0,
                    }}
                  >
                    Your weakest area. 15 min. AI hiring manager.
                  </p>
                </div>
                <button
                  style={{
                    background: t.white,
                    color: t.indigo,
                    border: "none",
                    padding: "11px 20px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: f.sans,
                  }}
                >
                  Start →
                </button>
              </div>
            </div>
          </ScreenFrame>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Anatomy:</b> warm
            greeting with italic name · KPI row with copper numerals · indigo
            "next move" card that prescribes ONE specific action. Not a menu —
            a recommendation.
          </p>
        </section>

        {/* 04 — EMPTY → LOADED → ERROR */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Empty · Loading · Error"
            desc="The three states every data view must handle. Calm, instructive, recoverable."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {/* EMPTY */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "48px 28px",
                textAlign: "center",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Empty</MonoLabel>
              <div
                style={{
                  width: 56,
                  height: 56,
                  background: t.copper100,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "20px auto 16px",
                  color: t.copper,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p
                style={{
                  fontFamily: f.serif,
                  fontSize: 20,
                  fontWeight: 400,
                  margin: "0 0 8px",
                  letterSpacing: "-0.01em",
                }}
              >
                No interviews yet.
              </p>
              <p style={{ fontSize: 13, color: t.indigoGray, margin: "0 0 16px", lineHeight: 1.55 }}>
                Run your first one in 90 seconds.
              </p>
              <button
                style={{
                  background: t.indigo,
                  color: t.white,
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: f.sans,
                }}
              >
                Start →
              </button>
            </div>

            {/* LOADING */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "32px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Loading</MonoLabel>
              <div style={{ marginTop: 20 }}>
                {[80, 60, 100, 70].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      height: 14,
                      width: `${w}%`,
                      background: t.creamSoft,
                      borderRadius: 6,
                      marginBottom: 10,
                      animation: `pulse 1.4s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
                <style>{`
                  @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                  }
                `}</style>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: t.inkSoft,
                  marginTop: 20,
                  marginBottom: 0,
                  textAlign: "center",
                }}
              >
                Analyzing your resume… ~12s
              </p>
            </div>

            {/* ERROR */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "48px 28px",
                textAlign: "center",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Error · recoverable</MonoLabel>
              <div
                style={{
                  width: 56,
                  height: 56,
                  background: t.error100,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "20px auto 16px",
                  color: t.error,
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                !
              </div>
              <p
                style={{
                  fontFamily: f.serif,
                  fontSize: 20,
                  fontWeight: 400,
                  margin: "0 0 8px",
                  letterSpacing: "-0.01em",
                }}
              >
                Connection dropped.
              </p>
              <p style={{ fontSize: 13, color: t.indigoGray, margin: "0 0 16px", lineHeight: 1.55 }}>
                Your answers are saved. Reconnect to continue.
              </p>
              <button
                style={{
                  background: t.indigo,
                  color: t.white,
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: f.sans,
                }}
              >
                Retry connection
              </button>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> every empty
            state has a CTA. Every loading state has a time estimate. Every
            error state explains what was preserved and what to do next.
          </p>
        </section>

        {/* 05 — THE 5 PATTERN PRINCIPLES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Pattern principles"
            desc="Five rules that govern composition. Apply to every screen you ship."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 18 }}>
              {[
                {
                  k: "One primary action",
                  v: "Every screen has exactly one indigo CTA. Two means a tie — users freeze. Tie-break in design, not at runtime.",
                },
                {
                  k: "One copper moment",
                  v: "The italic accent word OR the score numeral. Never both. Pick the one that defines this screen.",
                },
                {
                  k: "Trust at the foot",
                  v: "Privacy, support, security note — at the bottom of every authenticated and high-stakes screen. Quiet, but present.",
                },
                {
                  k: "Read top-down",
                  v: "Important > supporting > drill-down. Page hierarchy is a Z, not a grid. The eye path is editorial, not catalog.",
                },
                {
                  k: "Empty states sell",
                  v: "Treat every empty state as an upsell for the action that fills it. Calm, specific, single CTA, no apology.",
                },
              ].map((row) => (
                <li key={row.k} style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, fontSize: 14, lineHeight: 1.6 }}>
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: t.copper,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      paddingTop: 2,
                    }}
                  >
                    {row.k}
                  </span>
                  <span style={{ color: t.indigoGray }}>{row.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="One primary action. One copper moment. Trust at the foot." />
      </div>
    </>
  );
}
