/* HireStepX — Design System / Accessibility
   WCAG 2.1 AA minimum, AAA where it matters.
   Focus management · keyboard nav · ARIA · touch targets · reduced motion. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* Compliance row */
function CheckRow({
  passing,
  label,
  detail,
}: {
  passing: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        gap: 16,
        padding: "14px 0",
        borderBottom: `1px solid ${t.line}`,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: passing ? t.success100 : "#FEF3C7",
          color: passing ? t.success : "#A16207",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12,
          marginTop: 1,
        }}
      >
        {passing ? "✓" : "!"}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: t.coal }}>{label}</div>
        <div style={{ fontSize: 13, color: t.indigoGray, marginTop: 4, lineHeight: 1.55 }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemAccessibility() {
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
            Accessibility, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>default</em>.
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
            WCAG 2.1 AA minimum across the board, AAA on every text pairing.
            Keyboard-first. Screen-reader friendly. Honors reduced-motion.
            Touch targets ≥ 44px. Focus rings always visible.
          </p>
        </header>

        {/* 01 — COMPLIANCE STATUS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Compliance posture"
            desc="What we commit to. The bar is AA — most surfaces clear AAA."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "20px 32px",
              boxShadow: shadows.card,
            }}
          >
            <CheckRow
              passing
              label="Color contrast — all text pairings AAA"
              detail="Coal/Cream 15.9:1 · Indigo-gray/Cream 7.4:1 · White/Indigo 12.5:1. Even copper-on-cream meets AA at 5.4:1."
            />
            <CheckRow
              passing
              label="Focus indicators on every interactive element"
              detail="3px indigo halo at 20% alpha. Never `outline: none` without replacement. `:focus-visible` to skip mouse-driven focus."
            />
            <CheckRow
              passing
              label="Keyboard navigable end-to-end"
              detail="Tab order matches visual order. Skip-to-content link on every page. No keyboard traps."
            />
            <CheckRow
              passing
              label="prefers-reduced-motion respected"
              detail="All animations/transitions reduce to 0.01ms when the user opts out. Meaningful animations (success checks) capped at 100ms."
            />
            <CheckRow
              passing
              label="Touch targets ≥ 44px"
              detail="Mobile minimum tap area on every button, checkbox, link. Verified via Playwright + axe."
            />
            <CheckRow
              passing
              label="ARIA where it adds, never where it duplicates"
              detail="Semantic HTML first. ARIA only when no native equivalent exists (live regions, dialog modals, custom widgets)."
            />
            <CheckRow
              passing={false}
              label="Screen-reader testing — VoiceOver + NVDA"
              detail="Quarterly testing committed. Currently audited via axe-core but not yet manually walked through with a screen reader user."
            />
            <CheckRow
              passing={false}
              label="High-contrast mode (Windows)"
              detail="Current designs use brand colors that may not survive forced-colors mode. To be verified pre-launch."
            />
          </div>
        </section>

        {/* 02 — FOCUS STATES (LIVE) */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Focus indicators"
            desc="Visible, consistent, never invisible. The keyboard user's lifeline."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: 36,
              boxShadow: shadows.card,
            }}
          >
            <p style={{ fontSize: 13, color: t.indigoGray, margin: "0 0 24px", lineHeight: 1.6 }}>
              Every interactive element ships with a focus state. Click into
              the field below or tab through to see the indigo 3px halo at 20%
              alpha.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: t.coal,
                  }}
                >
                  Try focusing this input
                </label>
                <input
                  type="text"
                  placeholder="Tab in to see the focus halo"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: `1px solid ${t.lineStrong}`,
                    borderRadius: 10,
                    fontFamily: f.sans,
                    fontSize: 14,
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = t.indigo;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${t.indigoRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = t.lineStrong;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: t.coal,
                  }}
                >
                  Try focusing this button
                </label>
                <button
                  style={{
                    background: t.indigo,
                    color: t.white,
                    border: "none",
                    padding: "12px 22px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: f.sans,
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${t.indigoRing}, 0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)";
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>

            <pre
              style={{
                background: t.coal,
                color: "#d8d2c0",
                borderRadius: 10,
                padding: "20px 24px",
                fontFamily: f.mono,
                fontSize: 12,
                lineHeight: 1.7,
                marginTop: 24,
                overflowX: "auto",
              }}
            >
              <span style={{ color: "#6b6660", fontStyle: "italic" }}>{"/* Always use :focus-visible, not :focus */\n"}</span>
              <span style={{ color: "#c4a8ff" }}>.btn</span>
              {":focus-visible {\n"}
              {"  outline: none;\n"}
              {"  box-shadow: 0 0 0 3px var(--indigo-ring);\n"}
              {"}\n\n"}
              <span style={{ color: "#6b6660", fontStyle: "italic" }}>{"/* Never `outline: none` without replacing it */\n"}</span>
            </pre>
          </div>
        </section>

        {/* 03 — KEYBOARD MAP */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Keyboard map"
            desc="Every primary action reachable from the keyboard. No mouse-only paths."
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
              { keys: ["Tab"], use: "Move focus forward through interactive elements" },
              { keys: ["Shift", "Tab"], use: "Move focus backward" },
              { keys: ["Enter"], use: "Activate focused button or submit a form" },
              { keys: ["Space"], use: "Toggle a checkbox · activate a button" },
              { keys: ["Esc"], use: "Close any open modal, drawer, or popover" },
              { keys: ["↑", "↓"], use: "Navigate options inside a select or radio group" },
              { keys: ["⌘", "K"], use: "Open command palette (when implemented)" },
              { keys: ["?"], use: "Open keyboard shortcut help (where available)" },
              { keys: ["⌘", "Enter"], use: "Submit a form from any focused field" },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "240px 1fr",
                  gap: 24,
                  padding: "16px 28px",
                  borderBottom: `1px solid ${t.line}`,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {row.keys.map((k, j) => (
                    <React.Fragment key={k + j}>
                      {j > 0 && <span style={{ color: t.inkFaint, fontSize: 12 }}>+</span>}
                      <kbd
                        style={{
                          fontFamily: f.mono,
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.coal,
                          background: t.creamSoft,
                          border: `1px solid ${t.line}`,
                          borderRadius: 4,
                          padding: "3px 8px",
                          minWidth: 28,
                          textAlign: "center",
                        }}
                      >
                        {k}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: t.indigoGray, lineHeight: 1.55 }}>{row.use}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 04 — ARIA PATTERNS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="ARIA patterns"
            desc="Semantic HTML first. ARIA only when there's no native equivalent."
          />
          <div style={{ display: "grid", gap: 12 }}>
            {[
              {
                ctx: "Toast notifications",
                code: 'role="status" aria-live="polite"',
                use: "Non-urgent confirmation. Announced when toast appears.",
              },
              {
                ctx: "Error banners",
                code: 'role="alert" aria-live="assertive"',
                use: "Interrupts the screen reader to announce a problem.",
              },
              {
                ctx: "Modal dialogs",
                code: 'role="dialog" aria-modal="true" aria-labelledby="..."',
                use: "Trap focus inside. Restore focus on close. Reference the title.",
              },
              {
                ctx: "Loading state",
                code: 'aria-busy="true" aria-label="Analyzing resume"',
                use: "Tells assistive tech the area is updating.",
              },
              {
                ctx: "Live transcript (interview)",
                code: 'aria-live="polite" role="log"',
                use: "Announces new transcribed text without interrupting.",
              },
              {
                ctx: "Show password toggle",
                code: 'aria-label="Show password" aria-pressed="false"',
                use: "Conveys both the action and its current state.",
              },
              {
                ctx: "Score arc / progress",
                code: 'role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100"',
                use: "Makes visual-only score data legible to screen readers.",
              },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "18px 24px",
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 1fr",
                  gap: 24,
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: t.coal }}>{row.ctx}</div>
                <code
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    color: t.indigo,
                    background: t.creamSoft,
                    padding: "6px 10px",
                    borderRadius: 4,
                    lineHeight: 1.6,
                  }}
                >
                  {row.code}
                </code>
                <div style={{ fontSize: 12, color: t.indigoGray, lineHeight: 1.55 }}>{row.use}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 05 — TOUCH TARGETS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Touch targets"
            desc="44 × 44px minimum tap area. Required by WCAG. Bigger is better on mobile."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: 36,
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              <div>
                <MonoLabel color={t.error}>Too small · 32 × 32</MonoLabel>
                <div style={{ marginTop: 16, position: "relative", height: 80, display: "flex", alignItems: "center", gap: 16 }}>
                  <button
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: t.indigo,
                      color: t.white,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 32,
                      height: 32,
                      border: `2px dashed ${t.error}`,
                      borderRadius: 8,
                      pointerEvents: "none",
                    }}
                  />
                </div>
                <p style={{ fontSize: 12, color: t.error, marginTop: 8, lineHeight: 1.5 }}>
                  Below WCAG minimum. Misses for users with motor impairments
                  or fat fingers on small screens.
                </p>
              </div>
              <div>
                <MonoLabel color={t.success}>Correct · 44 × 44</MonoLabel>
                <div style={{ marginTop: 16, position: "relative", height: 80, display: "flex", alignItems: "center", gap: 16 }}>
                  <button
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: t.indigo,
                      color: t.white,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 44,
                      height: 44,
                      border: `2px dashed ${t.success}`,
                      borderRadius: 10,
                      pointerEvents: "none",
                    }}
                  />
                </div>
                <p style={{ fontSize: 12, color: t.success, marginTop: 8, lineHeight: 1.5 }}>
                  Meets WCAG 2.5.5. Comfortable tap target on iPhone SE (375px
                  viewport) and lower-end Android devices.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 06 — REDUCED MOTION */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Reduced motion"
            desc="If the user opts out of motion, we listen. Respect, not feature-strip."
          />
          <div
            style={{
              background: t.coal,
              color: "#d8d2c0",
              borderRadius: 14,
              padding: "28px 32px",
              fontFamily: f.mono,
              fontSize: 13,
              lineHeight: 1.8,
              overflowX: "auto",
            }}
          >
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* Required on every product surface */\n"}
            </span>
            {"@media (prefers-reduced-motion: reduce) {\n"}
            {"  *, *::before, *::after {\n"}
            {"    animation-duration: 0.01ms !important;\n"}
            {"    animation-iteration-count: 1 !important;\n"}
            {"    transition-duration: 0.01ms !important;\n"}
            {"    scroll-behavior: auto !important;\n"}
            {"  }\n"}
            {"}"}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> meaningful
            animations (success checkmark, error shake) keep their semantic
            cue but cap at 100ms. Decorative animations (hero word stagger,
            envelope float) reduce to instant. Never strip the meaning.
          </p>
        </section>

        {/* 07 — COLOR-BLIND SAFETY */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="Color-blind safety"
            desc="Color is never the sole carrier of meaning. Backed by icon, label, or text."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: 36,
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <MonoLabel color={t.error}>Don't · color-only</MonoLabel>
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <div style={{ background: t.success100, padding: "10px 14px", borderRadius: 6, fontSize: 13, color: t.success }}>
                    Email saved
                  </div>
                  <div style={{ background: t.error100, padding: "10px 14px", borderRadius: 6, fontSize: 13, color: t.error }}>
                    Email failed
                  </div>
                </div>
                <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 12, lineHeight: 1.5 }}>
                  Indistinguishable for users with deuteranopia (red-green
                  blindness, ~5% of men).
                </p>
              </div>
              <div>
                <MonoLabel color={t.success}>Do · color + icon + label</MonoLabel>
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <div
                    style={{
                      background: t.success100,
                      padding: "10px 14px",
                      borderRadius: 6,
                      fontSize: 13,
                      color: t.success,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 500,
                    }}
                  >
                    ✓ Email saved
                  </div>
                  <div
                    style={{
                      background: t.error100,
                      padding: "10px 14px",
                      borderRadius: 6,
                      fontSize: 13,
                      color: t.error,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 500,
                    }}
                  >
                    ! Email failed — try again
                  </div>
                </div>
                <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 12, lineHeight: 1.5 }}>
                  Icon + bold label make state legible regardless of color
                  perception.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 08 — TESTING TOOLS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="08"
            title="Testing"
            desc="Every shipped surface tested. Tools we trust."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { name: "axe-core", use: "Automated WCAG audit. Wired into Playwright E2E for every page." },
              { name: "Lighthouse CI", use: "Mobile a11y score on every PR. Fails the build below 90." },
              { name: "Keyboard-only walkthrough", use: "Quarterly: every primary flow without touching the mouse." },
              { name: "VoiceOver / NVDA", use: "Quarterly screen-reader testing on auth, onboarding, interview, results." },
              { name: "Forced colors mode", use: "Windows high-contrast verification — pre-launch checklist." },
              { name: "Color contrast analyzer", use: "Sim Daltonism, Oracle, or browser devtools for each new component." },
            ].map((row) => (
              <div
                key={row.name}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "20px 24px",
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
                <p style={{ fontSize: 13, color: t.indigoGray, margin: 0, lineHeight: 1.55 }}>
                  {row.use}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="WCAG 2.1 AA · Keyboard-first · Reduced-motion respected." />
      </div>
    </>
  );
}
