/* HireStepX — Design System / Index
   The cover page. The front door. The TL;DR.
   If you only read one storyboard, read this one. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, shadows, radius, type } from "./_tokens";
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
        borderRadius: radius.lg,
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
          borderRadius: radius.md,
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
            fontSize: type.micro.size,
            color: t.inkSoft,
            letterSpacing: "0.1em",
            fontWeight: 500,
          }}
        >
          {num}
        </span>
        <h3
          style={{
            fontFamily: f.sans,
            fontSize: type.h3.size,
            fontWeight: type.h3.weight,
            margin: 0,
            color: t.coal,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </h3>
      </div>
      <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
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
        fontFamily: f.sans,
        fontSize: 24,
        fontWeight: 600,
        color: t.coal,
        letterSpacing: "-0.01em",
      }}
    >
      Aa
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
            background: t.gray[400],
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
          background: t.gray[600],
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
          background: t.copper,
          color: t.white,
          padding: "8px 14px",
          borderRadius: radius.md,
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
          borderRadius: radius.md,
        }}
      />
    </div>
  ),
  patterns: (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.sm,
        width: 140,
        padding: 8,
      }}
    >
      <div style={{ height: 4, width: "60%", background: t.coal, borderRadius: 2, marginBottom: 4 }} />
      <div style={{ height: 3, width: "40%", background: t.gray[400], borderRadius: 2, marginBottom: 6 }} />
      <div style={{ height: 14, background: t.copper, borderRadius: 4 }} />
    </div>
  ),
  voice: (
    <div
      style={{
        fontFamily: f.sans,
        fontSize: 14,
        color: t.coal,
        textAlign: "center",
      }}
    >
      "Clarity <span style={{ fontWeight: 600 }}>wins</span> interviews."
    </div>
  ),
  a11y: (
    <div
      style={{
        background: t.white,
        border: `2px solid ${t.copper}`,
        boxShadow: `0 0 0 3px ${t.copperLine}`,
        borderRadius: radius.sm,
        width: 100,
        height: 28,
      }}
    />
  ),
  brand: (
    <div
      style={{
        fontFamily: f.sans,
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
      <span style={{ fontWeight: 600 }}>a skill</span>.
    </div>
  ),
  email: (
    <div
      style={{
        width: 100,
        height: 60,
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.sm,
        padding: 6,
      }}
    >
      <div style={{ height: 3, width: "70%", background: t.coal, marginBottom: 3, borderRadius: 1 }} />
      <div style={{ height: 2, width: "100%", background: t.gray[300], marginBottom: 2, borderRadius: 1 }} />
      <div style={{ height: 2, width: "85%", background: t.gray[300], marginBottom: 6, borderRadius: 1 }} />
      <div style={{ height: 8, width: 50, background: t.copper, borderRadius: 2 }} />
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
        { initials: "AM", bg: t.gray[200], fg: t.inkMuted },
        { initials: "PS", bg: t.indigo100, fg: t.indigo },
        { initials: "RI", bg: t.gray[200], fg: t.inkMuted },
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
    <div style={{ display: "flex", gap: 2, alignItems: "center", color: t.indigo }}>
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
        stroke={t.indigo}
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
          fill={i === 5 ? t.indigo : t.white}
          stroke={t.indigo}
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
          borderRadius: radius.md,
          padding: 6,
          boxShadow: shadows.card,
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
        <div style={{ height: 8, width: 32, background: t.copper, borderRadius: 2 }} />
      </div>
    </div>
  ),
};

/* ─── Main ─── */
export default function DesignSystemIndex() {
  const storyboards = [
    { num: "01", name: "Color", line: "Neutral surface · copper for the one primary action · indigo for data-viz.", visual: visuals.color },
    { num: "02", name: "Typography", line: "Compact functional scale · AF Sobremesa · JetBrains mono for code.", visual: visuals.type },
    { num: "03", name: "Foundations", line: "4px grid · 3 radii · 3 shadows · Lucide icons.", visual: visuals.foundations },
    { num: "04", name: "Motion", line: "5 named easings · 6 durations · meaning over decoration.", visual: visuals.motion },
    { num: "05", name: "Components", line: "Buttons · inputs · cards · tags · toasts · empty.", visual: visuals.components },
    { num: "06", name: "Patterns", line: "Auth · score reveal · dashboard · empty/loading/error.", visual: visuals.patterns },
    { num: "07", name: "Voice & Tone", line: "Confident, specific, no fluff. CTA verb library.", visual: visuals.voice },
    { num: "08", name: "Accessibility", line: "WCAG AA minimum, AAA on text. Keyboard-first.", visual: visuals.a11y },
    { num: "09", name: "Brand Story", line: "Mission · pillars · positioning · founder origin.", visual: visuals.brand },
    { num: "10", name: "Email Design", line: "5 templates · subject voice · compact layout.", visual: visuals.email },
    { num: "11", name: "Photography", line: "Real, not stock. Warm, not corporate. Indian, not generic.", visual: visuals.photo },
    { num: "12", name: "Personas", line: "Arjun · Priya · Rahul. Read before every decision.", visual: visuals.personas },
    { num: "13", name: "Sound Identity", line: "Neerja voice · panel personas · UI sounds rare and quiet.", visual: visuals.sound },
    { num: "14", name: "Data Visualization", line: "Indigo for charts and secondary data series.", visual: visuals.dataviz },
    { num: "15", name: "Components · Advanced", line: "Modals · tables · navigation · dropdowns · search.", visual: visuals.componentsAdv },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 48px 96px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {/* HEADER — compact, functional. No display headline, no accent word. */}
        <header style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 32, marginBottom: 48 }}>
          <MonoLabel>Design System · v1.0 · Index</MonoLabel>
          <h1
            style={{
              fontFamily: f.sans,
              fontSize: type.h1.size,
              fontWeight: type.h1.weight,
              letterSpacing: type.h1.letterSpacing,
              lineHeight: type.h1.lineHeight,
              color: t.coal,
              margin: "10px 0 0",
            }}
          >
            The HireStepX system.
          </h1>
          <p
            style={{
              color: t.inkMuted,
              fontSize: type.bodyLg.size,
              lineHeight: type.bodyLg.lineHeight,
              margin: "12px 0 0",
              maxWidth: 620,
            }}
          >
            Fifteen storyboards, one system: a restrained neutral scale does
            almost all the work, copper is the one accent reserved for the
            primary action, and type stays compact and functional — clean,
            modern SaaS in the vein of Linear, Notion, and Stripe, not a
            magazine layout.
          </p>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 32,
              fontFamily: f.mono,
              fontSize: type.micro.size,
              color: t.inkSoft,
              letterSpacing: "0.04em",
            }}
          >
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>15</b> storyboards
            </span>
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>11</b> neutral steps
            </span>
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>1</b> accent color
            </span>
            <span>
              <b style={{ color: t.coal, fontWeight: 500 }}>v1.0</b> · 2026
            </span>
          </div>
        </header>

        {/* THE DISCIPLINE — quick reference */}
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              background: t.coal,
              color: t.cream,
              borderRadius: radius.lg,
              padding: "32px 40px",
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 32,
              alignItems: "center",
            }}
          >
            <MonoLabel color={t.cream}>The discipline</MonoLabel>
            <div
              style={{
                fontFamily: f.sans,
                fontSize: type.h2.size,
                fontWeight: type.h2.weight,
                lineHeight: 1.4,
                letterSpacing: type.h2.letterSpacing,
                color: t.cream,
              }}
            >
              Restrained neutral, plus{" "}
              <span style={{ color: t.copper, fontWeight: 600 }}>one accent</span>.
              <br />
              <span style={{ color: "rgba(250,247,240,.65)", fontSize: type.body.size, fontWeight: 400 }}>
                One clear primary action per screen, always in copper. Everything else stays quiet.
              </span>
            </div>
          </div>
        </section>

        {/* STORYBOARD GRID */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="01" title="All fifteen" desc="Click any tile to navigate." />
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
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="02"
            title="The cheat sheet"
            desc="Tape this to the wall. Eight rules that govern everything."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: "32px 40px",
              boxShadow: shadows.card,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 32,
            }}
          >
            <div>
              <MonoLabel>Brand</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {[
                  "White surface. Never off-white or tinted.",
                  "One primary action per screen, always in copper.",
                  "Indigo appears only in charts and data visualization.",
                  "Coal for primary text. Ink-muted for secondary.",
                ].map((line, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: type.body.size,
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
                        fontSize: type.micro.size,
                        color: t.inkSoft,
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
              <MonoLabel>System</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {[
                  "4px grid for spacing. Multiples only.",
                  "Compact type scale — H1 tops out at 28px. No display headlines.",
                  "Thin 1px borders define cards, not heavy shadows.",
                  "WCAG AA minimum, AAA on every text pairing.",
                ].map((line, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: type.body.size,
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
                        fontSize: type.micro.size,
                        color: t.inkSoft,
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
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="03" title="Brand at a glance" desc="The four colors that carry the whole system." />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              { label: "Surface", val: "#FFFFFF", color: t.cream },
              { label: "Coal", val: "#18181B", color: t.coal },
              { label: "Indigo", val: "#312E81", color: t.indigo },
              { label: "Copper", val: "#BB4D00", color: t.copper },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: radius.lg,
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
                    borderRadius: radius.sm,
                    border: `1px solid ${t.line}`,
                  }}
                />
                <div>
                  <MonoLabel>{c.label}</MonoLabel>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: type.caption.size,
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
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="04" title="How this system evolves" desc="Who owns it, and how it changes." />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: "28px 32px",
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
                  v: "Every system has exceptions. Document them. 'An extra-large copper numeral in a hero stat' — write it down with the reason. Don't do it silently.",
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
                    fontSize: type.body.size,
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: type.micro.size,
                      color: t.inkSoft,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      paddingTop: 2,
                    }}
                  >
                    {row.k}
                  </span>
                  <span style={{ color: t.inkMuted }}>{row.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* HOW TO USE */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="05" title="Reading order" desc="How to get through this system." />
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
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>If you have 30 minutes</MonoLabel>
              <ol
                style={{
                  margin: "16px 0 0",
                  paddingLeft: 24,
                  display: "grid",
                  gap: 10,
                  color: t.inkMuted,
                  fontSize: type.body.size,
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
                  <b style={{ color: t.coal }}>Typography</b> — the type scale
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
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>If you have 2 hours</MonoLabel>
              <p
                style={{
                  fontSize: type.body.size,
                  color: t.inkMuted,
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
            borderRadius: radius.lg,
            padding: "40px 48px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: f.sans,
              fontSize: type.h2.size,
              fontWeight: type.h2.weight,
              lineHeight: 1.4,
              margin: 0,
              letterSpacing: type.h2.letterSpacing,
            }}
          >
            Make every choice trace back to <b style={{ fontWeight: 700 }}>this</b>.
          </p>
        </div>

        {/* FOOTER */}
        <Footer section="Section" tagline="The front door. Read first." />
      </div>
    </>
  );
}
