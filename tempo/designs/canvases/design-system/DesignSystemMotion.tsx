/* HireStepX — Design System / Motion
   Easings · Durations · Recipes · Choreography
   Five named easings. Six duration tiers. Live demos.
   The discipline: motion conveys meaning. Never decoration. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* Easing curve — draws an SVG path that visualizes the cubic-bezier */
function EasingCurve({ p1x, p1y, p2x, p2y }: { p1x: number; p1y: number; p2x: number; p2y: number }) {
  const W = 200,
    H = 120,
    PAD = 8;
  const x0 = PAD;
  const y0 = H - PAD;
  const x1 = W - PAD;
  const y1 = PAD;
  const cp1x = x0 + p1x * (x1 - x0);
  const cp1y = y0 + p1y * (y1 - y0);
  const cp2x = x0 + p2x * (x1 - x0);
  const cp2y = y0 + p2y * (y1 - y0);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* baseline grid */}
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={t.line} strokeWidth="1" />
      <line x1={x0} y1={y0} x2={x0} y2={y1} stroke={t.line} strokeWidth="1" />
      <line x1={x1} y1={y1} x2={x1} y2={y0} stroke={t.line} strokeWidth="0.5" strokeDasharray="2 4" />
      <line x1={x0} y1={y1} x2={x1} y2={y1} stroke={t.line} strokeWidth="0.5" strokeDasharray="2 4" />
      {/* curve */}
      <path
        d={`M ${x0} ${y0} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`}
        stroke={t.copper}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* control point handles (subtle) */}
      <circle cx={cp1x} cy={cp1y} r="2.5" fill={t.indigo} />
      <circle cx={cp2x} cy={cp2y} r="2.5" fill={t.indigo} />
      <line x1={x0} y1={y0} x2={cp1x} y2={cp1y} stroke={t.indigo} strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={x1} y1={y1} x2={cp2x} y2={cp2y} stroke={t.indigo} strokeWidth="0.5" strokeDasharray="2 2" />
    </svg>
  );
}

/* Live ball demo — animates a circle along the easing curve infinitely */
function BallDemo({
  easing,
  duration,
  delay = 0,
  animKey,
}: {
  easing: string;
  duration: string;
  delay?: number;
  animKey: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        height: 32,
        background: t.creamSoft,
        borderRadius: 999,
        overflow: "hidden",
        marginTop: 12,
      }}
    >
      <style>{`
        @keyframes motion-${animKey} {
          0%   { left: 4px; }
          50%  { left: calc(100% - 28px); }
          100% { left: 4px; }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          top: 4,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: t.indigo,
          animation: `motion-${animKey} ${duration} ${easing} ${delay}ms infinite`,
        }}
      />
    </div>
  );
}

function EasingCard({
  name,
  curve,
  cssCurve,
  use,
  p1x,
  p1y,
  p2x,
  p2y,
  animKey,
}: {
  name: string;
  curve: string;
  cssCurve: string;
  use: string;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  animKey: string;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: 28,
        boxShadow: shadows.card,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <MonoLabel color={t.copper}>{name}</MonoLabel>
      </div>
      <h3
        style={{
          fontFamily: f.serif,
          fontSize: 22,
          fontWeight: 400,
          margin: "8px 0 4px",
          letterSpacing: "-0.01em",
        }}
      >
        {curve}
      </h3>
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          color: t.indigo,
          marginBottom: 16,
          background: t.creamSoft,
          padding: "4px 10px",
          borderRadius: 4,
          display: "inline-block",
        }}
      >
        {cssCurve}
      </div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
        <EasingCurve p1x={p1x} p1y={p1y} p2x={p2x} p2y={p2y} />
      </div>
      <BallDemo easing={cssCurve} duration="2400ms" animKey={animKey} />
      <p
        style={{
          fontSize: 12,
          color: t.indigoGray,
          marginTop: 14,
          marginBottom: 0,
          lineHeight: 1.55,
        }}
      >
        {use}
      </p>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemMotion() {
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
        <header
          style={{
            borderBottom: `1px solid ${t.line}`,
            paddingBottom: 40,
            marginBottom: 64,
          }}
        >
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
            Motion, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>meaning</em>.
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
            Five named easings. Six duration tiers. Every animation conveys
            meaning — never decoration. Respects{" "}
            <code
              style={{
                fontFamily: f.mono,
                background: t.creamSoft,
                padding: "1px 6px",
                borderRadius: 3,
                fontSize: 13,
              }}
            >
              prefers-reduced-motion
            </code>{" "}
            by default.
          </p>
        </header>

        {/* 01 — EASINGS (LIVE) */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Easing curves"
            desc="The shape of every transition. Curves visualized + live ball demo."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <EasingCard
              name="Premium decelerate"
              curve="ease-out-expo"
              cssCurve="cubic-bezier(0.16, 1, 0.3, 1)"
              use="Default for everything that arrives — page reveals, modal entrances, fade-ins. Feels confident, settled."
              p1x={0.16}
              p1y={1}
              p2x={0.3}
              p2y={1}
              animKey="ease-out-expo"
            />
            <EasingCard
              name="Spring overshoot"
              curve="ease-spring"
              cssCurve="cubic-bezier(0.34, 1.56, 0.64, 1)"
              use="Subtle bounce on success states — checkmarks turning green, confirmation moments. Earns its joy."
              p1x={0.34}
              p1y={1.56}
              p2x={0.64}
              p2y={1}
              animKey="ease-spring"
            />
            <EasingCard
              name="Snappy decelerate"
              curve="ease-out-quart"
              cssCurve="cubic-bezier(0.25, 1, 0.5, 1)"
              use="Hover state changes, focus rings, button presses. Quick and decisive."
              p1x={0.25}
              p1y={1}
              p2x={0.5}
              p2y={1}
              animKey="ease-out-quart"
            />
            <EasingCard
              name="Symmetric"
              curve="ease-in-out-cubic"
              cssCurve="cubic-bezier(0.65, 0, 0.35, 1)"
              use="Loops, breathing animations, idle states. Equal acceleration in and out."
              p1x={0.65}
              p1y={0}
              p2x={0.35}
              p2y={1}
              animKey="ease-in-out-cubic"
            />
            <EasingCard
              name="Error shake"
              curve="ease-error"
              cssCurve="cubic-bezier(0.36, 0.07, 0.19, 0.97)"
              use="Form rejection — input shake, button reject. Sharp at start, settles fast."
              p1x={0.36}
              p1y={0.07}
              p2x={0.19}
              p2y={0.97}
              animKey="ease-error"
            />
            <EasingCard
              name="Linear"
              curve="linear"
              cssCurve="linear"
              use="Progress bars, count-up timers, anything time-based and mechanical. Avoid for UI motion."
              p1x={0.5}
              p1y={0.5}
              p2x={0.5}
              p2y={0.5}
              animKey="linear"
            />
          </div>
        </section>

        {/* 02 — DURATIONS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Duration tiers"
            desc="Six tiers. Pick the right one. Anything over 600ms feels sluggish."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              boxShadow: shadows.card,
              overflow: "hidden",
            }}
          >
            {[
              {
                name: "instant",
                ms: 80,
                use: "Hover-state property change (color, opacity)",
                examples: "Color swap on hover · text underline appearance",
              },
              {
                name: "fast",
                ms: 160,
                use: "Focus rings, color transitions, small UI shifts",
                examples: "Input focus halo · checkbox check · icon morph",
              },
              {
                name: "standard",
                ms: 240,
                use: "Default for most state transitions",
                examples: "Button press · error appearance · tooltip in/out",
              },
              {
                name: "smooth",
                ms: 320,
                use: "Form-field state changes, banners, light slides",
                examples: "Input border + halo + bg shift · alert slide-in",
              },
              {
                name: "page",
                ms: 400,
                use: "Page transitions, drawer slides, modal entrances",
                examples: "Login → dashboard · drawer open · modal lift",
              },
              {
                name: "reveal",
                ms: 600,
                use: "Hero entrances, success celebrations, score arcs",
                examples: "Hero word stagger · score arc draw · checkmark draw",
              },
            ].map((row) => (
              <div
                key={row.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 80px 1fr",
                  alignItems: "center",
                  gap: 24,
                  padding: "18px 28px",
                  borderBottom: `1px solid ${t.line}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: t.coal,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {row.name}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: f.serif,
                    fontSize: 24,
                    color: t.copper,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {row.ms}
                  <span style={{ fontSize: 14, color: t.inkFaint, marginLeft: 2 }}>ms</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: t.coal, fontWeight: 500 }}>{row.use}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: t.indigoGray,
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {row.examples}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> never go
            above 600ms. Auth screens are high-frequency — every extra
            millisecond of motion compounds into perceived sluggishness.
          </p>
        </section>

        {/* 03 — RECIPES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Recipes"
            desc="Common motion patterns, pre-mixed. Drop in and go."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            {[
              {
                name: "Fade-in up",
                use: "Default reveal — cards, hero text, sections",
                code: "opacity 0 → 1 · translateY(8px → 0) · 480ms ease-out-expo",
              },
              {
                name: "Stagger reveal",
                use: "Hero text word-by-word, list items appearing",
                code: "Each child: 50ms delay · 480ms ease-out-expo",
              },
              {
                name: "Button press",
                use: "Primary CTA click feedback",
                code: "scale 1 → 0.98 → 1 · 80ms in · 160ms out",
              },
              {
                name: "Error shake",
                use: "Submit failure on a button or form",
                code: "translateX [0, -6, 6, -3, 0]px · 320ms ease-error",
              },
              {
                name: "Success check",
                use: "Form submission success, password matched",
                code: "scale 0.8 → 1 · 240ms ease-spring · color gray → sage",
              },
              {
                name: "Page transition",
                use: "Auth → dashboard, signup → onboarding",
                code: "old: fade + scale 1.02 · new: fade + scale 0.98 → 1 · 320ms",
              },
            ].map((row) => (
              <div
                key={row.name}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: 24,
                }}
              >
                <h4
                  style={{
                    fontFamily: f.serif,
                    fontSize: 18,
                    fontWeight: 500,
                    margin: "0 0 6px",
                    color: t.coal,
                  }}
                >
                  {row.name}
                </h4>
                <p
                  style={{
                    color: t.indigoGray,
                    fontSize: 13,
                    margin: "0 0 14px",
                    lineHeight: 1.55,
                  }}
                >
                  {row.use}
                </p>
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    color: t.coal,
                    background: t.creamSoft,
                    padding: "10px 14px",
                    borderRadius: 6,
                    lineHeight: 1.6,
                  }}
                >
                  {row.code}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 04 — RULES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Rules of motion"
            desc="What to animate. What to leave alone. The discipline."
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
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 18,
              }}
            >
              {[
                {
                  k: "Convey meaning",
                  v: "Every animation should answer 'why?' Loading = patience. Stagger = hierarchy. Shake = rejection. Never animate for show.",
                },
                {
                  k: "Honor reduced-motion",
                  v: "Wrap everything in `@media (prefers-reduced-motion: reduce)` to disable. Required by accessibility regulations and respectful UX.",
                },
                {
                  k: "Animate transform + opacity",
                  v: "GPU-accelerated. 60fps. Animating width, height, top, left causes layout thrashing. Use translate/scale/opacity.",
                },
                {
                  k: "Never animate color on body text",
                  v: "Distracting and reduces readability. State changes on text are instant.",
                },
                {
                  k: "Don't bounce buttons",
                  v: "Premium ≠ playful. A 0.98 scale and 80ms snap is enough. Bouncing scales (1.05) read as childish.",
                },
                {
                  k: "Page transitions stay under 400ms",
                  v: "Higher = sluggish. Auth users come back daily — speed matters more than drama.",
                },
              ].map((row) => (
                <li
                  key={row.k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr",
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

        {/* 05 — TOKENS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="CSS variables"
            desc="Drop into your stylesheet. Use across all components."
          />
          <pre
            style={{
              background: t.coal,
              color: "#d8d2c0",
              borderRadius: 14,
              padding: "28px 32px",
              fontFamily: f.mono,
              fontSize: 13,
              lineHeight: 1.8,
              overflowX: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* HireStepX — Motion tokens */\n"}
            </span>
            {":root {\n"}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"  /* Easings */\n"}
            </span>
            <span style={{ color: "#c4a8ff" }}>{"  --ease-out-expo"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>cubic-bezier(0.16, 1, 0.3, 1)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --ease-out-quart"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>cubic-bezier(0.25, 1, 0.5, 1)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --ease-spring"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>cubic-bezier(0.34, 1.56, 0.64, 1)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --ease-in-out-cubic"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>cubic-bezier(0.65, 0, 0.35, 1)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --ease-error"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>cubic-bezier(0.36, 0.07, 0.19, 0.97)</span>
            ;{"\n\n"}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"  /* Durations */\n"}
            </span>
            <span style={{ color: "#c4a8ff" }}>{"  --t-instant"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>80ms</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --t-fast"}</span>:{"    "}
            <span style={{ color: "#f4d4a8" }}>160ms</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --t-standard"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>240ms</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --t-smooth"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>320ms</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --t-page"}</span>:{"    "}
            <span style={{ color: "#f4d4a8" }}>400ms</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --t-reveal"}</span>:{"  "}
            <span style={{ color: "#f4d4a8" }}>600ms</span>;{"\n}\n\n"}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* Reduced motion */\n"}
            </span>
            {"@media (prefers-reduced-motion: reduce) {\n"}
            {"  * {\n"}
            {"    animation-duration: 0.01ms !important;\n"}
            {"    transition-duration: 0.01ms !important;\n"}
            {"  }\n"}
            {"}"}
          </pre>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="Motion conveys meaning. Never decoration." />
      </div>
    </>
  );
}
