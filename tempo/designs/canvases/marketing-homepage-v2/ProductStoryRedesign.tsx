/**
 * ProductStoryRedesign — canvas-local design exploration
 * "Tech-giant" take on the How It Works section:
 * no cards, no 3-column grid, full-width product mocks,
 * outcome-first copy, copper hairline step dividers.
 *
 * ProductStoryFinal — optimised for the 4 priority dimensions:
 *   Indian market fit · Conversion potential · Differentiation · Premium signal
 * Key changes vs V1:
 *   - Pre-headline emotional hook
 *   - Asymmetric step weighting (step 03 is the hero)
 *   - "03:14" exact-moment timestamp in report (the key differentiator)
 *   - Callback probability: 34% → 71% (before/after in one line)
 *   - AI pushback bubble in session mock
 *   - CTA: "Find out where you're losing them →"
 *   - India-specific company anchoring
 */
import React, { CSSProperties } from "react";

/* ─── Brand tokens (mirrors HomepageV2.tsx) ─── */
const cream    = "#FAF7F0";
const coal     = "#1A1814";
const copper   = "#B8733A";
const copperSoft = "#F5EDE4";
const inkSoft  = "#6B6355";
const inkFaint = "#9E9585";
const line     = "#EBE5D2";
const white    = "#FFFFFF";
const error    = "#E05252";
const green    = "#3DB87A";

const serif = '"Instrument Serif", Georgia, serif';
const sans  = '"Satoshi", "Inter", system-ui, sans-serif';
const mono  = '"JetBrains Mono", "Fira Code", monospace';

/* ══════════════════════════════════════════════════════════
   FINAL VERSION — mock components (mobile-aware)
   ══════════════════════════════════════════════════════════ */

/* ─── FINAL Step 01: Resume extract (compact, mobile-aware) ─── */
function ResumeExtract({ mobile }: { mobile: boolean }) {
  return (
    <div style={{
      background: white, border: `1px solid ${line}`, borderRadius: 10,
      padding: mobile ? "18px 18px" : "22px 28px",
    }}>
      {/* File pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", background: copperSoft,
        borderRadius: 8, border: `1px solid ${copper}20`, marginBottom: 18,
      }}>
        <span style={{ fontSize: 15 }}>📄</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: mono, fontSize: 11, color: copper, margin: 0, fontWeight: 600 }}>
            anjali-resume.pdf
          </p>
          <p style={{ fontFamily: sans, fontSize: 11, color: inkFaint, margin: 0 }}>
            Parsed in 3.8s · 2 pages · 4 roles extracted
          </p>
        </div>
        <div style={{
          background: green + "20", color: green, fontFamily: sans, fontSize: 11,
          fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.06em",
        }}>DONE</div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
        gap: mobile ? 0 : "0 48px",
      }}>
        {/* Extracted fields */}
        <div>
          {([
            ["Skills",       "Python, SQL, React, AWS"],
            ["Last role",    "SDE Intern · Razorpay · 6 months"],
            ["Education",    "NIT Trichy · CSE · 2024"],
            ["Target level", "SDE-1 → SDE-2"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: `1px solid ${line}`,
              fontFamily: sans, fontSize: 13,
            }}>
              <span style={{ color: inkFaint, flexShrink: 0 }}>{k}</span>
              <span style={{ color: coal, fontWeight: 500, textAlign: "right", maxWidth: mobile ? 160 : 220 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Match bars — desktop only */}
        {!mobile ? (
          <div>
            <p style={{
              fontFamily: sans, fontSize: 11, color: inkFaint,
              letterSpacing: "0.12em", textTransform: "uppercase",
              fontWeight: 600, margin: "0 0 14px",
            }}>Best matches</p>
            {([
              ["TCS Digital",       96],
              ["Flipkart · SDE-1",  92],
              ["Razorpay · Backend", 87],
            ] as [string, number][]).map(([co, s]) => (
              <div key={co} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: sans, fontSize: 13, color: coal }}>{co}</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: s >= 90 ? green : copper, fontWeight: 600 }}>{s}%</span>
                </div>
                <div style={{ height: 3, background: line, borderRadius: 2 }}>
                  <div style={{ width: `${s}%`, height: "100%", background: s >= 90 ? green : copper, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Mobile: chips instead of bars */
          <div style={{ display: "flex", gap: 8, paddingTop: 14, flexWrap: "wrap" }}>
            {([["TCS", 96], ["Razorpay", 87], ["Flipkart", 92]] as [string, number][]).map(([co, s]) => (
              <div key={co} style={{
                fontFamily: sans, fontSize: 12, color: coal,
                background: copperSoft, border: `1px solid ${copper}30`,
                borderRadius: 20, padding: "4px 12px",
                display: "flex", gap: 6, alignItems: "center",
              }}>
                {co} <span style={{ color: copper, fontWeight: 700, fontFamily: mono }}>{s}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FINAL Step 02: Session mock with AI pushback ─── */
function SessionFinal({ mobile }: { mobile: boolean }) {
  const bars = [4,8,14,20,28,18,10,22,30,16,8,24,12,6,20,28,14,10,18,24,8,16,26,12,20,7,18,24,10,16];
  return (
    <div style={{
      background: coal, border: `1px solid #2A2722`, borderRadius: 12,
      padding: mobile ? "20px 20px" : "28px 32px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: mobile ? 16 : 20 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: error, boxShadow: `0 0 10px ${error}88`, flexShrink: 0,
        }} />
        <span style={{ fontFamily: mono, fontSize: 12, color: "#EBE5D2", fontWeight: 600, letterSpacing: "0.1em" }}>
          REC · 03:14
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: sans, fontSize: 12, color: inkFaint }}>Razorpay · Backend SDE-2</span>
      </div>

      {/* Waveform — desktop only */}
      {!mobile && (
        <div style={{ display: "flex", gap: 3, height: 36, alignItems: "center", marginBottom: 24 }}>
          {bars.map((h, idx) => (
            <div key={idx} style={{
              width: 3, height: h, borderRadius: 2, flexShrink: 0,
              background: idx < 20 ? copper : "#3A3530",
            }} />
          ))}
        </div>
      )}

      {/* Q: initial question */}
      <div style={{ background: "#242018", borderRadius: 10, padding: "16px 20px", marginBottom: 12 }}>
        <p style={{
          fontFamily: sans, fontSize: 11, color: copper,
          letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 8px",
        }}>Interviewer</p>
        <p style={{ fontFamily: serif, fontSize: mobile ? 15 : 17, color: "#FAF7F0", margin: 0, lineHeight: 1.45 }}>
          "Tell me about a time you had to debug a production issue under pressure."
        </p>
      </div>

      {/* A: candidate response */}
      <div style={{
        background: "#1E1B17", borderRadius: 10, padding: "14px 20px", marginBottom: 12,
        border: `1px solid ${copper}30`,
      }}>
        <p style={{
          fontFamily: sans, fontSize: 11, color: "#6B6355",
          letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 6px",
        }}>You</p>
        <p style={{ fontFamily: sans, fontSize: 14, color: "#9E9585", margin: 0, lineHeight: 1.55 }}>
          "During my internship at Razorpay, we had a payment gateway timeout
          affecting 2,000 transactions per hour. I fixed the issue in about 8 minutes."
        </p>
      </div>

      {/* AI pushback — the differentiating element */}
      <div style={{
        background: "#1A0E05", borderRadius: 10, padding: "16px 20px",
        border: `1px solid ${copper}60`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <p style={{
            fontFamily: sans, fontSize: 11, color: copper,
            letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: 0,
          }}>Interviewer · pushing back</p>
          <div style={{
            fontFamily: mono, fontSize: 10, color: copper,
            background: copper + "20", padding: "2px 6px", borderRadius: 3,
          }}>AI noticed a gap</div>
        </div>
        <p style={{ fontFamily: serif, fontSize: mobile ? 14 : 16, color: "#FAF7F0", margin: 0, lineHeight: 1.5 }}>
          "You said '2,000 transactions per hour' — how did you arrive at that number
          during the incident? And what exactly did you change to fix it?"
        </p>
      </div>
    </div>
  );
}

/* ─── FINAL Step 03: Report hero (full detail, asymmetric hero weight) ─── */
function ReportHero({ mobile }: { mobile: boolean }) {
  const dimColor = (s: number) => s >= 80 ? green : s >= 70 ? copper : error;
  const dims: [string, number][] = [["Situation", 82], ["Task", 78], ["Action", 71], ["Result", 65]];

  return (
    <div style={{
      background: white, border: `1px solid ${line}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Report header band */}
      <div style={{
        background: coal, padding: mobile ? "16px 18px" : "18px 28px",
        display: "flex", alignItems: "center",
        flexDirection: mobile ? "column" : "row",
        gap: mobile ? 10 : 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: `2px solid ${copper}`,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontFamily: serif, fontSize: 20, color: "#FAF7F0", lineHeight: 1 }}>7.8</span>
            <span style={{ fontFamily: sans, fontSize: 9, color: inkFaint }}>/10</span>
          </div>
          <div>
            <p style={{ fontFamily: sans, fontSize: 13, color: copper, fontWeight: 700, margin: 0 }}>
              Lean Hire · Razorpay Backend SDE-2
            </p>
            <p style={{ fontFamily: sans, fontSize: 12, color: inkFaint, margin: 0 }}>
              Anjali Mehta · 14 min 22 sec
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {dims.map(([d, s]) => (
            <div key={d} style={{
              fontFamily: mono, fontSize: 11, fontWeight: 700,
              color: dimColor(s),
              background: dimColor(s) + "20",
              padding: "4px 8px", borderRadius: 4,
            }}>{d[0]}:{s}</div>
          ))}
        </div>
      </div>

      <div style={{ padding: mobile ? "18px 18px" : "24px 28px" }}>

        {/* ── THE DIFFERENTIATOR: exact moment callout ── */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          background: "#FFF5F5", border: "1px solid #FECACA",
          borderRadius: 8, padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{
            fontFamily: mono, fontSize: 12, color: error, fontWeight: 700,
            background: error + "15", padding: "4px 8px", borderRadius: 4,
            flexShrink: 0, marginTop: 1, letterSpacing: "0.04em",
          }}>03:14</div>
          <div>
            <p style={{ fontFamily: sans, fontSize: 13, color: "#991B1B", fontWeight: 600, margin: "0 0 4px" }}>
              This is where the interviewer checked out.
            </p>
            <p style={{ fontFamily: sans, fontSize: 13, color: coal, margin: 0, lineHeight: 1.5 }}>
              You said "fixed the issue" without a number. Razorpay weights quantified
              impact at ~40% of the Result score. Your Result dropped from 78 to 65.
            </p>
          </div>
        </div>

        {/* ── Callback probability bar ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          background: copperSoft, border: `1px solid ${copper}30`,
          borderRadius: 8, padding: "11px 16px", marginBottom: 20,
        }}>
          <span style={{ fontFamily: sans, fontSize: 13, color: inkSoft }}>Callback probability</span>
          <span style={{ fontFamily: mono, fontSize: 14, color: error, fontWeight: 700 }}>34%</span>
          <span style={{ fontFamily: sans, fontSize: 13, color: inkFaint }}>→</span>
          <span style={{ fontFamily: mono, fontSize: 14, color: green, fontWeight: 700 }}>71%</span>
          <span style={{ fontFamily: sans, fontSize: 12, color: inkFaint }}>after one coached retry</span>
        </div>

        {/* ── Coached model answer ── */}
        <p style={{
          fontFamily: sans, fontSize: 11, color: inkFaint,
          letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
          margin: "0 0 10px",
        }}>Coached model answer</p>
        <div style={{
          background: copperSoft, border: `1px solid ${copper}30`,
          borderRadius: 8, padding: "14px 16px",
        }}>
          <p style={{ fontFamily: sans, fontSize: 13, color: coal, margin: 0, lineHeight: 1.65 }}>
            "The timeout was costing ~₹4L/hour in failed transactions. I isolated a
            missing DB index in 8 minutes, deployed the hotfix, and recovery hit 99.8%
            within 12 minutes. I then wrote a runbook — the next on-call resolved a
            similar issue in under 3 minutes."
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── FINAL section component ─── */
export function ProductStoryFinal({ mobile = false }: { mobile?: boolean }) {
  const px    = mobile ? 20  : 40;
  const mxW   = mobile ? 390 : 1120;
  const h2sz  = mobile ? 30  : 50;
  const bodySz = mobile ? 15 : 16;

  /* Steps — asymmetric: 01/02 compact, 03 hero */
  const steps = [
    {
      n: "01",
      headline: "Upload your resume.\nWe do the rest.",
      detail: "AI parses your roles, projects, and skills in 4 seconds. Then maps you to 200+ Indian companies — TCS to Razorpay — and shows exactly where you fit.",
      mock: <ResumeExtract mobile={mobile} />,
      hero: false,
    },
    {
      n: "02",
      headline: "Speak. Get pushed back.",
      detail: "Real voice in. Real voice out. 312ms response. The AI reads your resume first — so when you claim something, it tests that claim.",
      mock: <SessionFinal mobile={mobile} />,
      hero: false,
    },
    {
      n: "03",
      headline: "See the exact moment\nyou lost them.",
      detail: "A timestamp. A score. The coached answer that would have landed. No vague feedback, ever.",
      mock: <ReportHero mobile={mobile} />,
      hero: true,
    },
  ];

  return (
    <div style={{ background: cream, fontFamily: sans }}>
      <div style={{ maxWidth: mxW, margin: "0 auto", padding: `${mobile ? 72 : 112}px ${px}px` }}>

        {/* ── Section label ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <span style={{
            fontFamily: mono, fontSize: 11, color: copper,
            fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", flexShrink: 0,
          }}>04 — How it works</span>
          <div style={{ flex: 1, height: 1, background: line }} />
        </div>

        {/* ── Pre-headline (emotional hook) ── */}
        <p style={{
          fontFamily: sans, fontSize: mobile ? 14 : 15,
          color: inkFaint, margin: "0 0 12px",
          letterSpacing: "-0.01em",
        }}>
          Most candidates walk out not knowing why their answer didn't land.
        </p>

        {/* ── Main headline ── */}
        <div style={{ marginBottom: mobile ? 56 : 80, maxWidth: mobile ? "100%" : 700 }}>
          <h2 style={{
            fontFamily: serif, fontSize: h2sz, fontWeight: 400,
            color: coal, margin: "0 0 20px", lineHeight: 1.08,
            letterSpacing: "-0.02em",
          }}>
            You already know what you said.{" "}
            <em style={{ color: copper }}>We'll tell you why it didn't land.</em>
          </h2>
          <p style={{ fontFamily: sans, fontSize: bodySz, color: inkSoft, margin: 0, lineHeight: 1.6 }}>
            Resume upload to coached session debrief — under 10 minutes.
          </p>
        </div>

        {/* ── Steps ── */}
        {steps.map((step, i) => (
          <div key={step.n} style={{ marginBottom: mobile ? 56 : step.hero ? 0 : 72 }}>
            {/* Step header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : step.hero ? "60px 1fr" : "60px 1fr",
              gap: mobile ? "4px 0" : "0 24px",
              marginBottom: mobile ? 18 : step.hero ? 28 : 24,
              alignItems: "start",
            }}>
              <span style={{
                fontFamily: mono, fontSize: 12, color: copper,
                fontWeight: 600, letterSpacing: "0.06em",
                paddingTop: mobile ? 0 : 5,
              }}>{step.n}</span>
              <div>
                <h3 style={{
                  fontFamily: serif,
                  fontSize: mobile ? (step.hero ? 26 : 22) : (step.hero ? 34 : 28),
                  fontWeight: 400, color: coal,
                  margin: "0 0 10px", lineHeight: 1.1,
                  letterSpacing: "-0.02em", whiteSpace: "pre-line",
                }}>
                  {step.headline}
                </h3>
                <p style={{
                  fontFamily: sans, fontSize: mobile ? 14 : bodySz,
                  color: inkSoft, margin: 0, lineHeight: 1.6,
                  maxWidth: mobile ? "100%" : step.hero ? 640 : 560,
                }}>
                  {step.detail}
                </p>
              </div>
            </div>

            {/* Product mock */}
            {step.mock}

            {/* Divider between steps (not after last) */}
            {i < steps.length - 1 && (
              <div style={{
                height: 1,
                background: `linear-gradient(90deg, ${copper}55 0%, ${line} 100%)`,
                margin: `${mobile ? 56 : 72}px 0 0`,
              }} />
            )}
          </div>
        ))}

        {/* ── Bottom hairline ── */}
        <div style={{ height: 1, background: line, margin: `${mobile ? 48 : 64}px 0 0` }} />

        {/* ── CTA ── */}
        <div style={{
          marginTop: 40,
          display: "flex",
          flexDirection: mobile ? "column" : "row",
          alignItems: mobile ? "flex-start" : "center",
          gap: mobile ? 10 : 20,
        }}>
          <a href="/signup" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: copper, color: white,
            fontFamily: sans, fontSize: 15, fontWeight: 600,
            padding: "13px 26px", borderRadius: 8,
            textDecoration: "none", letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}>
            Find out where you're losing them →
          </a>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: sans, fontSize: 13, color: inkFaint }}>
              Free · 3 sessions · No card needed
            </span>
            <span style={{ fontFamily: sans, fontSize: 12, color: inkFaint + "99" }}>
              Razorpay · TCS Digital · Flipkart · BYJU'S · 200+ Indian companies
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ORIGINAL V1 — preserved below for comparison
   ══════════════════════════════════════════════════════════ */

/* ─── Step 01: Resume parser mock ─── */
function ResumeMock() {
  const rows: [string, string][] = [
    ["Candidate",   "Anjali Mehta"],
    ["Education",   "NIT Trichy · 2024"],
    ["Experience",  "SDE Intern · 6 months"],
    ["Skills",      "Python, SQL, React, AWS"],
  ];
  const matches: [string, number][] = [
    ["TCS Digital",            96],
    ["Flipkart · SDE-1",       92],
    ["Razorpay · Backend",     87],
    ["Zomato · SDE-2",         74],
  ];
  return (
    <div style={{
      background: white, border: `1px solid ${line}`, borderRadius: 12,
      padding: "28px 32px",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 48px",
    }}>
      {/* Left: extracted data */}
      <div>
        {/* File pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
          padding: "10px 14px", background: copperSoft, borderRadius: 8,
          border: `1px solid ${copper}25`,
        }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: mono, fontSize: 11, color: copper, margin: 0, fontWeight: 600 }}>
              anjali-resume.pdf
            </p>
            <p style={{ fontFamily: sans, fontSize: 11, color: inkFaint, margin: 0 }}>
              Parsed in 3.8 s · 2 pages
            </p>
          </div>
          <span style={{ color: green, fontSize: 14, fontWeight: 700 }}>✓</span>
        </div>

        {/* Extracted rows */}
        {rows.map(([label, value]) => (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: `1px solid ${line}`,
            fontFamily: sans, fontSize: 13,
          }}>
            <span style={{ color: inkFaint }}>{label}</span>
            <span style={{ color: coal, fontWeight: 500, textAlign: "right", maxWidth: 200 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Right: company match bars */}
      <div>
        <p style={{
          fontFamily: sans, fontSize: 11, color: inkFaint,
          letterSpacing: "0.12em", textTransform: "uppercase",
          fontWeight: 600, margin: "0 0 16px",
        }}>Company match</p>
        {matches.map(([co, score]) => (
          <div key={co} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontFamily: sans, fontSize: 13, color: coal }}>{co}</span>
              <span style={{ fontFamily: mono, fontSize: 12, color: copper, fontWeight: 600 }}>{score}%</span>
            </div>
            <div style={{ height: 3, background: line, borderRadius: 2 }}>
              <div style={{
                width: `${score}%`, height: "100%", borderRadius: 2,
                background: score >= 90 ? green : copper,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 02: Live interview session mock ─── */
function SessionMock() {
  const bars = [4,8,14,20,28,18,10,22,30,16,8,24,12,6,20,28,14,10,18,24,8,16,26,12,20,7,18,24,10,16];
  return (
    <div style={{
      background: coal, border: `1px solid #2A2722`, borderRadius: 12,
      padding: "28px 32px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: error, boxShadow: `0 0 10px ${error}88`, flexShrink: 0,
        }} />
        <span style={{ fontFamily: mono, fontSize: 12, color: "#EBE5D2", fontWeight: 600, letterSpacing: "0.1em" }}>
          REC · 03:14
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: sans, fontSize: 12, color: inkFaint }}>Razorpay · Backend SDE-2</span>
        <span style={{
          fontFamily: sans, fontSize: 11, color: copper, fontWeight: 600,
          border: `1px solid ${copper}50`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.06em",
        }}>LIVE</span>
      </div>

      {/* Waveform */}
      <div style={{ display: "flex", gap: 3, height: 36, alignItems: "center", marginBottom: 24 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 3, height: h, borderRadius: 2, flexShrink: 0,
            background: i < 20 ? copper : "#3A3530",
          }} />
        ))}
      </div>

      {/* Question bubble */}
      <div style={{
        background: "#242018", borderRadius: 10, padding: "16px 20px", marginBottom: 14,
      }}>
        <p style={{
          fontFamily: sans, fontSize: 11, color: copper,
          letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
          margin: "0 0 10px",
        }}>Interviewer</p>
        <p style={{ fontFamily: serif, fontSize: 17, color: "#FAF7F0", margin: 0, lineHeight: 1.45 }}>
          "Tell me about a time you had to debug a production issue under pressure."
        </p>
      </div>

      {/* Response bubble */}
      <div style={{
        background: "#1E1B17", borderRadius: 10, padding: "14px 20px",
        border: `1px solid ${copper}30`,
      }}>
        <p style={{
          fontFamily: sans, fontSize: 11, color: "#6B6355",
          letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
          margin: "0 0 8px",
        }}>You · speaking</p>
        <p style={{ fontFamily: sans, fontSize: 14, color: "#9E9585", margin: 0, lineHeight: 1.55 }}>
          "During my internship at Razorpay, we had a payment gateway timeout affecting 2,000 transactions per hour..."
          <span style={{
            display: "inline-block", width: 2, height: 14,
            background: copper, marginLeft: 3, verticalAlign: "middle",
            animation: "blink 1s step-end infinite",
          }} />
        </p>
      </div>
    </div>
  );
}

/* ─── Step 03: Score report mock ─── */
function ReportMock() {
  const dims: [string, number][] = [
    ["Situation", 82],
    ["Task",      78],
    ["Action",    71],
    ["Result",    65],
  ];
  const dimColor = (s: number) => s >= 80 ? green : s >= 70 ? copper : error;

  return (
    <div style={{
      background: white, border: `1px solid ${line}`, borderRadius: 12,
      padding: "28px 32px",
      display: "grid", gridTemplateColumns: "220px 1fr", gap: "0 48px",
    }}>
      {/* Left: score ring + STAR bars */}
      <div>
        {/* Score ring */}
        <div style={{
          width: 120, height: 120, borderRadius: "50%",
          border: `3px solid ${copper}`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <span style={{ fontFamily: serif, fontSize: 40, color: coal, lineHeight: 1 }}>7.8</span>
          <span style={{ fontFamily: sans, fontSize: 11, color: inkFaint }}>/10</span>
        </div>
        <p style={{
          textAlign: "center", fontFamily: sans, fontSize: 12,
          color: copper, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", margin: "0 0 4px",
        }}>Lean Hire</p>
        <p style={{
          textAlign: "center", fontFamily: sans, fontSize: 12,
          color: inkFaint, margin: "0 0 20px",
        }}>Razorpay · Backend SDE-2</p>

        {/* STAR bars */}
        <div>
          {dims.map(([dim, score]) => (
            <div key={dim} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: sans, fontSize: 12, color: inkSoft }}>{dim}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: coal, fontWeight: 600 }}>{score}</span>
              </div>
              <div style={{ height: 2, background: line, borderRadius: 1 }}>
                <div style={{ width: `${score}%`, height: "100%", background: dimColor(score), borderRadius: 1 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: feedback + model answer */}
      <div>
        <p style={{
          fontFamily: sans, fontSize: 11, color: inkFaint,
          letterSpacing: "0.12em", textTransform: "uppercase",
          fontWeight: 600, margin: "0 0 12px",
        }}>Where you lost them</p>

        <div style={{
          background: "#FFF5F5", border: "1px solid #FECACA",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
        }}>
          <p style={{ fontFamily: sans, fontSize: 13, color: "#991B1B", margin: "0 0 6px", fontWeight: 600 }}>
            ⚠ Result was vague
          </p>
          <p style={{ fontFamily: sans, fontSize: 13, color: coal, margin: 0, lineHeight: 1.5 }}>
            You said "fixed the issue" without quantifying impact. The interviewer needed: latency improved X%,
            revenue saved ₹Y, timeline compressed by Z days.
          </p>
        </div>

        <p style={{
          fontFamily: sans, fontSize: 11, color: inkFaint,
          letterSpacing: "0.12em", textTransform: "uppercase",
          fontWeight: 600, margin: "0 0 12px",
        }}>Coached model answer</p>

        <div style={{
          background: copperSoft, border: `1px solid ${copper}30`,
          borderRadius: 8, padding: "14px 16px",
        }}>
          <p style={{ fontFamily: sans, fontSize: 13, color: coal, margin: 0, lineHeight: 1.65 }}>
            "The timeout was costing ~₹4L/hour in failed transactions. I isolated a missing DB index in 8 minutes,
            deployed a hotfix, and recovery hit 99.8% within 12 minutes. I then wrote a runbook — next on-call
            resolved a similar issue in under 3 minutes."
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Steps data ─── */
interface Step {
  n: string;
  headline: string;
  detail: string;
  Mock: React.FC;
}

const STEPS: Step[] = [
  {
    n: "01",
    headline: "We decode your target\ncompany's playbook.",
    detail:
      "4 seconds. TCS to Razorpay. 200+ Indian roles. We know the format, the interviewer's style, and the questions they actually ask.",
    Mock: ResumeMock,
  },
  {
    n: "02",
    headline: "Speak. Get pushed back.\nJust like the real thing.",
    detail:
      "Real voice in. Real voice out. 312 ms response. The AI uses your resume context — it knows what you claimed, and it'll test every line.",
    Mock: SessionMock,
  },
  {
    n: "03",
    headline: "See exactly where\nyou lost them.",
    detail:
      "STAR score per dimension. The coached model answer. The specific moment the interviewer checked out. No vague feedback, ever.",
    Mock: ReportMock,
  },
];

/* ─── Main section component ─── */
export function ProductStoryRedesign({ mobile = false }: { mobile?: boolean }) {
  const px    = mobile ? 20  : 40;
  const mxW   = mobile ? 390 : 1120;
  const h2sz  = mobile ? 32  : 52;
  const h3sz  = mobile ? 24  : 36;
  const bodySz = mobile ? 15 : 16;

  return (
    <div style={{ background: cream, fontFamily: sans }}>
      <div style={{ maxWidth: mxW, margin: "0 auto", padding: `${mobile ? 72 : 120}px ${px}px` }}>

        {/* ── Section masthead ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, marginBottom: 56,
        }}>
          <span style={{
            fontFamily: mono, fontSize: 11, color: copper,
            fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", flexShrink: 0,
          }}>
            04 — How it works
          </span>
          <div style={{ flex: 1, height: 1, background: line }} />
          <span style={{
            fontFamily: mono, fontSize: 11, color: inkFaint,
            fontWeight: 500, letterSpacing: "0.08em", flexShrink: 0,
          }}>
            Three steps
          </span>
        </div>

        {/* ── Section heading ── */}
        <div style={{ marginBottom: mobile ? 56 : 80, maxWidth: mobile ? "100%" : 720 }}>
          <h2 style={{
            fontFamily: serif, fontSize: h2sz, fontWeight: 400,
            color: coal, margin: "0 0 16px", lineHeight: 1.08,
            letterSpacing: "-0.02em",
          }}>
            You already know what you said.{" "}
            <em style={{ color: copper }}>We'll tell you why it didn't land.</em>
          </h2>
          <p style={{ fontFamily: sans, fontSize: bodySz, color: inkSoft, margin: 0, lineHeight: 1.6 }}>
            From resume upload to a coached session report — under 10 minutes.
          </p>
        </div>

        {/* ── Steps ── */}
        {STEPS.map((step, i) => (
          <div key={step.n}>
            {/* Divider — copper hairline */}
            <div style={{
              height: 1,
              background: `linear-gradient(90deg, ${copper} 0%, ${copper}55 60%, ${line} 100%)`,
              margin: `${i === 0 ? 0 : mobile ? 48 : 64}px 0 ${mobile ? 36 : 48}px`,
            }} />

            {/* Step number + headline block */}
            <div style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : "72px 1fr",
              gap: mobile ? "6px 0" : "0 28px",
              marginBottom: mobile ? 20 : 32,
              alignItems: "start",
            }}>
              <span style={{
                fontFamily: mono, fontSize: 13, color: copper,
                fontWeight: 600, letterSpacing: "0.06em",
                paddingTop: mobile ? 0 : 6,
              }}>
                {step.n}
              </span>
              <div>
                <h3 style={{
                  fontFamily: serif, fontSize: h3sz, fontWeight: 400,
                  color: coal, margin: "0 0 12px", lineHeight: 1.1,
                  letterSpacing: "-0.02em", whiteSpace: "pre-line",
                }}>
                  {step.headline}
                </h3>
                <p style={{
                  fontFamily: sans, fontSize: bodySz, color: inkSoft,
                  margin: 0, lineHeight: 1.6,
                  maxWidth: mobile ? "100%" : 580,
                }}>
                  {step.detail}
                </p>
              </div>
            </div>

            {/* Full-width product mock */}
            <step.Mock />
          </div>
        ))}

        {/* ── Bottom hairline ── */}
        <div style={{ height: 1, background: line, margin: `${mobile ? 48 : 64}px 0 0` }} />

        {/* ── CTA ── */}
        <div style={{
          marginTop: 48,
          display: "flex", flexDirection: mobile ? "column" : "row",
          alignItems: mobile ? "flex-start" : "center",
          gap: mobile ? 12 : 24,
        }}>
          <a
            href="/signup"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: copper, color: white,
              fontFamily: sans, fontSize: 15, fontWeight: 600,
              padding: "13px 26px", borderRadius: 8,
              textDecoration: "none", letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            Start your first session free →
          </a>
          <span style={{ fontFamily: sans, fontSize: 13, color: inkFaint }}>
            No credit card · 3 free sessions
          </span>
        </div>

      </div>
    </div>
  );
}
