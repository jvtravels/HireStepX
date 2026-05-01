/* HireStepX — Design System / Index
   The cover page. The front door. The TL;DR.
   If you only read one storyboard, read this one. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* ─── Storyboard tile — used in the index grid ─── */
function StoryboardTile({
  num,
  name,
  oneLiner,
  visual,
}: {
  num: string;
  name: string;
  oneLiner: string;
  visual: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "20px 24px",
        boxShadow: shadows.card,
        transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          height: 80,
          background: t.creamSoft,
          borderRadius: 8,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {visual}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 10,
            color: t.copper,
            letterSpacing: "0.1em",
            fontWeight: 500,
          }}
        >
          {num}
        </span>
        <h3
          style={{
            fontFamily: f.serif,
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
            color: t.coal,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </h3>
      </div>
      <p style={{ fontSize: 12, color: t.indigoGray, margin: 0, lineHeight: 1.5 }}>
        {oneLiner}
      </p>
    </div>
  );
}

/* Simple visual elements for each tile */
const visuals = {
  color: (
    <div style={{ display: "flex", gap: 6 }}>
      {[t.cream, t.coal, t.indigo, t.copper].map((c, i) => (
        <div
          key={i}
          style={{
            width: 36,
            height: 36,
            background: c,
            borderRadius: 6,
            border: `1px solid ${t.line}`,
          }}
        />
      ))}
    </div>
  ),
  type: (
    <div
      style={{
        fontFamily: f.serif,
        fontSize: 36,
        fontWeight: 400,
        color: t.coal,
        letterSpacing: "-0.02em",
      }}
    >
      <em style={{ fontStyle: "italic", color: t.copper }}>Aa</em>
    </div>
  ),
  foundations: (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
      {[8, 16, 24, 32, 48].map((px) => (
        <div
          key={px}
          style={{
            width: px / 3,
            height: 32,
            background: t.copper,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  ),
  motion: (
    <div style={{ position: "relative", width: 140, height: 8, background: t.creamSoft, borderRadius: 999 }}>
      <style>{`
        @keyframes idx-motion {
          0%, 100% { left: 4px; }
          50% { left: calc(100% - 18px); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          top: -3,
          width: 14,
          height: 14,
          background: t.copper,
          borderRadius: "50%",
          animation: "idx-motion 2400ms cubic-bezier(0.16, 1, 0.3, 1) infinite",
        }}
      />
    </div>
  ),
  components: (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div
        style={{
          background: t.indigo,
          color: t.white,
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        Continue →
      </div>
      <div
        style={{
          width: 60,
          height: 32,
          background: t.white,
          border: `1px solid ${t.lineStrong}`,
          borderRadius: 8,
        }}
      />
    </div>
  ),
  patterns: (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 6,
        width: 140,
        padding: 8,
      }}
    >
      <div style={{ height: 4, width: "60%", background: t.coal, borderRadius: 2, marginBottom: 4 }} />
      <div style={{ height: 3, width: "40%", background: t.indigoGray, borderRadius: 2, marginBottom: 6 }} />
      <div style={{ height: 14, background: t.indigo, borderRadius: 4 }} />
    </div>
  ),
  voice: (
    <div
      style={{
        fontFamily: f.serif,
        fontSize: 14,
        color: t.coal,
        fontStyle: "italic",
        textAlign: "center",
      }}
    >
      "Clarity{" "}
      <em style={{ fontStyle: "italic", color: t.copper }}>wins</em>{" "}
      interviews."
    </div>
  ),
  a11y: (
    <div
      style={{
        background: t.white,
        border: `2px solid ${t.indigo}`,
        boxShadow: `0 0 0 3px ${"rgba(49, 46, 129, 0.20)"}`,
        borderRadius: 6,
        width: 100,
        height: 28,
      }}
    />
  ),
  brand: (
    <div
      style={{
        fontFamily: f.serif,
        fontSize: 14,
        color: t.coal,
        textAlign: "center",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        lineHeight: 1.3,
      }}
    >
      Make interview prep
      <br />
      <em style={{ fontStyle: "italic", color: t.copper }}>a skill</em>.
    </div>
  ),
  email: (
    <div
      style={{
        width: 100,
        height: 60,
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 6,
        padding: 6,
      }}
    >
      <div style={{ height: 3, width: "70%", background: t.coal, marginBottom: 3, borderRadius: 1 }} />
      <div style={{ height: 2, width: "100%", background: t.indigoGray, marginBottom: 2, borderRadius: 1 }} />
      <div style={{ height: 2, width: "85%", background: t.indigoGray, marginBottom: 6, borderRadius: 1 }} />
      <div style={{ height: 8, width: 50, background: t.indigo, borderRadius: 2 }} />
    </div>
  ),
  photo: (
    <div
      style={{
        width: 60,
        height: 60,
        background: "linear-gradient(135deg, #E8C9A8 0%, #C49872 50%, #8E5F3D 100%)",
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 30,
          height: 36,
          background: "rgba(0,0,0,0.18)",
          borderRadius: "50% 50% 0 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: "50%",
          transform: "translateX(-50%)",
          width: 18,
          height: 18,
          background: "rgba(0,0,0,0.22)",
          borderRadius: "50%",
        }}
      />
    </div>
  ),
  personas: (
    <div style={{ display: "flex", gap: -4 }}>
      {[
        { initials: "AM", bg: t.copper100, fg: t.copper },
        { initials: "PS", bg: t.indigo100, fg: t.indigo },
        { initials: "RI", bg: t.copper100, fg: t.copper },
      ].map((p, i) => (
        <div
          key={i}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: p.bg,
            color: p.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            border: `2px solid ${t.creamSoft}`,
            marginLeft: i > 0 ? -10 : 0,
          }}
        >
          {p.initials}
        </div>
      ))}
    </div>
  ),
  sound: (
    <div style={{ display: "flex", gap: 2, alignItems: "center", color: t.copper }}>
      {[12, 24, 32, 28, 40, 36, 24, 16, 28, 20].map((h, i) => (
        <div key={i}>
          <style>{`
            @keyframes idx-wave-${i} {
              0%, 100% { height: ${h * 0.6}px; }
              50% { height: ${h}px; }
            }
          `}</style>
          <div
            style={{
              width: 3,
              background: "currentColor",
              borderRadius: 2,
              animation: `idx-wave-${i} 1100ms ease-in-out infinite`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        </div>
      ))}
    </div>
  ),
  dataviz: (
    <svg width="120" height="56" viewBox="0 0 120 56">
      <path
        d="M 10 46 L 30 38 L 50 32 L 70 24 L 90 18 L 110 10"
        fill="none"
        stroke={t.copper}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        { cx: 10, cy: 46 },
        { cx: 30, cy: 38 },
        { cx: 50, cy: 32 },
        { cx: 70, cy: 24 },
        { cx: 90, cy: 18 },
        { cx: 110, cy: 10 },
      ].map((p, i) => (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={i === 5 ? 4 : 2.5}
          fill={i === 5 ? t.copper : t.white}
          stroke={t.copper}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  ),
  componentsAdv: (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 90,
          height: 50,
          background: t.white,
          border: `1px solid ${t.line}`,
          borderRadius: 8,
          padding: 6,
          boxShadow: "0 2px 4px rgba(20,17,10,.06)",
        }}
      >
        <div
          style={{
            height: 5,
            width: "60%",
            background: t.coal,
            marginBottom: 4,
            borderRadius: 1,
          }}
        />
        <div style={{ height: 3, background: t.creamSoft, marginBottom: 4 }} />
        <div style={{ height: 8, width: 32, background: t.indigo, borderRadius: 2 }} />
      </div>
    </div>
  ),
};

/* ─── Main ─── */
export default function DesignSystemIndex() {
  const storyboards = [
    { num: "01", name: "Color", line: "Cream surface · indigo interactive · copper editorial. Never mix.", visual: visuals.color },
    { num: "02", name: "Typography", line: "Instrument Serif display · Satoshi UI · JetBrains mono · italic copper accent.", visual: visuals.type },
    { num: "03", name: "Foundations", line: "4px grid · 6 radii · 3 shadows · Lucide icons.", visual: visuals.foundations },
    { num: "04", name: "Motion", line: "5 named easings · 6 durations · meaning over decoration.", visual: visuals.motion },
    { num: "05", name: "Components", line: "Buttons · inputs · cards · tags · toasts · empty.", visual: visuals.components },
    { num: "06", name: "Patterns", line: "Auth · score reveal · dashboard · empty/loading/error.", visual: visuals.patterns },
    { num: "07", name: "Voice & Tone", line: "Confident, specific, no fluff. CTA verb library.", visual: visuals.voice },
    { num: "08", name: "Accessibility", line: "WCAG AA minimum, AAA on text. Keyboard-first.", visual: visuals.a11y },
    { num: "09", name: "Brand Story", line: "Mission · pillars · positioning · founder origin.", visual: visuals.brand },
    { num: "10", name: "Email Design", line: "5 templates · subject voice · editorial layout.", visual: visuals.email },
    { num: "11", name: "Photography", line: "Real, not stock. Warm, not corporate. Indian, not generic.", visual: visuals.photo },
    { num: "12", name: "Personas", line: "Arjun · Priya · Rahul. Read before every decision.", visual: visuals.personas },
    { num: "13", name: "Sound Identity", line: "Neerja voice · panel personas · UI sounds rare and quiet.", visual: visuals.sound },
    { num: "14", name: "Data Visualization", line: "One copper number per chart. Editorial restraint.", visual: visuals.dataviz },
    { num: "15", name: "Components · Advanced", line: "Modals · tables · navigation · dropdowns · search.", visual: visuals.componentsAdv },
  ];

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
        {/* MASTHEAD — extra tall, more dramatic for cover */}
        <header style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 64, marginBottom: 80 }}>
          <MonoLabel>Design System · v1.0 · Index</MonoLabel>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 84,
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              margin: "20px 0 0",
            }}
          >
            The HireStepX{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>system</em>.
          </h1>
          <p
            style={{
              color: t.indigoGray,
              fontSize: 18,
              margin: "28px 0 0",
              maxWidth: 640,
              lineHeight: 1.55,
              fontFamily: f.serif,
            }}
          >
            Fifteen storyboards. One brand. Cream surface, indigo for
            everything you click, copper for one highlighted fact per moment —
            and nothing else.
          </p>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              gap: 32,
              fontFamily: f.mono,
              fontSize: 11,
              color: t.inkSoft,
              letterSpacing: "0.04em",
            }}
          >
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>15</b> storyboards
            </span>
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>4</b> brand colors
            </span>
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>3</b> type families
            </span>
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>v1.0</b> · 2026
            </span>
          </div>
        </header>

        {/* THE DISCIPLINE — quick reference */}
        <section style={{ marginBottom: 80 }}>
          <div
            style={{
              background: t.coal,
              color: t.cream,
              borderRadius: 14,
              padding: "48px 56px",
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            <MonoLabel color={t.copper}>The discipline</MonoLabel>
            <div
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                lineHeight: 1.4,
                letterSpacing: "-0.01em",
                color: t.cream,
              }}
            >
              <b style={{ color: t.cream, fontWeight: 500 }}>Indigo</b> is
              interactive.{" "}
              <em style={{ fontStyle: "italic", color: t.copper }}>Copper</em>{" "}
              is editorial.
              <br />
              <span style={{ color: "rgba(250,247,240,.65)" }}>Never mix.</span>
            </div>
          </div>
        </section>

        {/* STORYBOARD GRID */}
        <section style={{ marginBottom: 80 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              borderBottom: `1px solid ${t.line}`,
              paddingBottom: 16,
              marginBottom: 28,
            }}
          >
            <MonoLabel color={t.copper}>The system</MonoLabel>
            <h2
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              All fifteen
            </h2>
            <p
              style={{
                margin: "0 0 0 auto",
                color: t.inkSoft,
                fontSize: 13,
              }}
            >
              Click any tile to navigate.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {storyboards.map((s) => (
              <StoryboardTile
                key={s.num}
                num={s.num}
                name={s.name}
                oneLiner={s.line}
                visual={s.visual}
              />
            ))}
          </div>
        </section>

        {/* QUICK REFERENCE CARD */}
        <section style={{ marginBottom: 80 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              borderBottom: `1px solid ${t.line}`,
              paddingBottom: 16,
              marginBottom: 28,
            }}
          >
            <MonoLabel color={t.copper}>Quick reference</MonoLabel>
            <h2
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              The cheat sheet
            </h2>
            <p
              style={{
                margin: "0 0 0 auto",
                color: t.inkSoft,
                fontSize: 13,
                maxWidth: 380,
                textAlign: "right",
              }}
            >
              Tape this to the wall. Eight rules that govern everything.
            </p>
          </div>
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "40px 48px",
              boxShadow: shadows.card,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 40,
            }}
          >
            <div>
              <MonoLabel color={t.copper}>Brand</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {[
                  "Cream is the canvas. Never pure white.",
                  "One italic copper accent word per moment. Never twice.",
                  "Indigo on every clickable thing. Always.",
                  "Coal for primary text. Indigo-gray for secondary.",
                ].map((line, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 14,
                      color: t.coal,
                      lineHeight: 1.6,
                      paddingLeft: 24,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        fontFamily: f.mono,
                        fontSize: 11,
                        color: t.copper,
                        fontWeight: 500,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <MonoLabel color={t.copper}>System</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {[
                  "4px grid for spacing. Multiples only.",
                  "Maximum 600ms on any animation. Anything more = sluggish.",
                  "One primary CTA per screen. Tie-break in design.",
                  "WCAG AA minimum, AAA on every text pairing.",
                ].map((line, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 14,
                      color: t.coal,
                      lineHeight: 1.6,
                      paddingLeft: 24,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        fontFamily: f.mono,
                        fontSize: 11,
                        color: t.copper,
                        fontWeight: 500,
                      }}
                    >
                      {String(i + 5).padStart(2, "0")}
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* THE NUMBERS — token snapshot */}
        <section style={{ marginBottom: 80 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              borderBottom: `1px solid ${t.line}`,
              paddingBottom: 16,
              marginBottom: 28,
            }}
          >
            <MonoLabel color={t.copper}>The numbers</MonoLabel>
            <h2
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Brand at a glance
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              { label: "Cream", val: "#FAF7F0", color: t.cream },
              { label: "Coal", val: "#0E0C08", color: t.coal },
              { label: "Indigo", val: "#312E81", color: t.indigo },
              { label: "Copper", val: "#B45309", color: t.copper },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: shadows.card,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: c.color,
                    borderRadius: 8,
                    border: `1px solid ${t.line}`,
                  }}
                />
                <div>
                  <MonoLabel>{c.label}</MonoLabel>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 12,
                      color: t.coal,
                      marginTop: 2,
                    }}
                  >
                    {c.val}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* GOVERNANCE */}
        <section style={{ marginBottom: 80 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              borderBottom: `1px solid ${t.line}`,
              paddingBottom: 16,
              marginBottom: 28,
            }}
          >
            <MonoLabel color={t.copper}>Governance</MonoLabel>
            <h2
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              How this system evolves
            </h2>
          </div>
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
                  k: "Owner",
                  v: "Founder · Design lead. Single approver for system changes.",
                },
                {
                  k: "Versioning",
                  v: "Major (1.0 → 2.0) on token changes. Minor (1.0 → 1.1) on new components. Patch (1.0.0 → 1.0.1) on copy fixes.",
                },
                {
                  k: "Adding a component",
                  v: "Search existing first. If 80% of what you need exists in Components or Components-Advanced, extend it. New components require: name, use case, all states, accessibility audit.",
                },
                {
                  k: "Editing a token",
                  v: "Token changes require an audit of every storyboard. Open a PR with before/after screenshots. Two reviewers minimum.",
                },
                {
                  k: "Breaking the rules",
                  v: "Every system has exceptions. Document them. 'Copper on a CTA on the landing page hero' — write it down with the reason. Don't do it silently.",
                },
                {
                  k: "Quarterly review",
                  v: "Once per quarter, walk through all 15 storyboards. Cull what's stale. Add what's emerged. Update version.",
                },
              ].map((row) => (
                <li
                  key={row.k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "180px 1fr",
                    gap: 24,
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
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

        {/* HOW TO USE */}
        <section style={{ marginBottom: 80 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              borderBottom: `1px solid ${t.line}`,
              paddingBottom: 16,
              marginBottom: 28,
            }}
          >
            <MonoLabel color={t.copper}>How to use</MonoLabel>
            <h2
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Reading order
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>If you have 30 minutes</MonoLabel>
              <ol
                style={{
                  margin: "16px 0 0",
                  paddingLeft: 24,
                  display: "grid",
                  gap: 10,
                  color: t.indigoGray,
                  fontSize: 14,
                  lineHeight: 1.7,
                }}
              >
                <li>
                  <b style={{ color: t.coal }}>Brand Story</b> — the why
                </li>
                <li>
                  <b style={{ color: t.coal }}>Color</b> — the discipline rule
                </li>
                <li>
                  <b style={{ color: t.coal }}>Typography</b> — the signature
                </li>
                <li>
                  <b style={{ color: t.coal }}>Voice & Tone</b> — how we sound
                </li>
                <li>
                  <b style={{ color: t.coal }}>Personas</b> — who we serve
                </li>
              </ol>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>If you have 2 hours</MonoLabel>
              <p
                style={{
                  fontSize: 14,
                  color: t.indigoGray,
                  margin: "16px 0 0",
                  lineHeight: 1.7,
                }}
              >
                Read every storyboard, in order. The system is designed
                like a book — the early sections (Brand Story, Color, Type)
                set the foundation. Later sections (Patterns, Components,
                Email) compose the foundation into surfaces. The last
                section (Components Advanced) is the deep specifics. Don't
                skip ahead.
              </p>
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <div
          style={{
            background: t.coal,
            color: t.cream,
            borderRadius: 14,
            padding: "56px 64px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.35,
              margin: 0,
              letterSpacing: "-0.015em",
            }}
          >
            Make every choice trace back to{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>this</em>.
          </p>
        </div>

        {/* FOOTER */}
        <Footer section="Section" tagline="The front door. Read first." />
      </div>
    </>
  );
}
