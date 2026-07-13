import React from "react";

/**
 * HeroGapDesign — canvas-local hero section mockup.
 *
 * Concept: v2-B "The Gap"
 * Headline: "You studied for the interview. You're not ready for the interviewer."
 * Visual: Split Perception card — "What you said" vs. "What they heard"
 *
 * Principles applied:
 * - Pill orients cold visitor: "AI mock interviews · Built for India"
 * - Headline creates productive anxiety (studied ≠ ready for the interviewer)
 * - Visual directly proves headline: both sides of the gap shown simultaneously
 * - 8.4 confidence vs 2.9 engagement — two numbers, no explanation needed
 * - Single CTA, pricing anchor below, social proof at conversion point
 */

/* ── Design tokens ── */
const CREAM      = "#FAF7F0";
const CARD_BG    = "#FDFBF6";
const WHITE      = "#FFFFFF";
const COAL       = "#0E0C08";
const COAL_LITE  = "#1A1714";
const INK        = "#6E6759";
const FAINTWK    = "#A39C8B";
const COPPER     = "#B45309";
const LINE       = "#EBE5D2";
const AMBER_TX   = "#92400E";
const CONF_CLR   = "#15803D";
const ENGAG_CLR  = "#DC2626";

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS  = '"Satoshi", "Inter", system-ui, sans-serif';
const MONO  = '"JetBrains Mono", "Fira Code", monospace';

/* ── Keyframe animations injected once via <style> ── */
const KEYFRAMES = `
@keyframes heroFadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes heroFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes heroGrowBar {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes heroHlPop {
  0%   { background-color: transparent; }
  55%  { background-color: rgba(251,191,36,0.28); }
  100% { background-color: rgba(251,191,36,0.18); }
}
`;

function GlobalStyle() {
  return <style>{KEYFRAMES}</style>;
}

function fadeUp(delay = 0, duration = 0.55): React.CSSProperties {
  return { animation: `heroFadeUp ${duration}s cubic-bezier(0.22,1,0.36,1) ${delay}s both` };
}
function fadeIn(delay = 0, duration = 0.4): React.CSSProperties {
  return { animation: `heroFadeIn ${duration}s ease-out ${delay}s both` };
}

/* ── Category pill ── */
function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      fontFamily: SANS, fontSize: 12, fontWeight: 500,
      color: INK, letterSpacing: "0.01em",
      border: `1px solid ${LINE}`, borderRadius: 999,
      padding: "5px 14px", background: WHITE,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: COPPER, flexShrink: 0, display: "inline-block",
      }} />
      {children}
    </span>
  );
}

/* ── Amber-highlighted word (animates in) ── */
function WeWord({ children, delay }: { children: string; delay: number }) {
  return (
    <span style={{
      fontWeight: 600, color: AMBER_TX,
      padding: "1px 3px", borderRadius: 3,
      animation: `heroHlPop 0.45s ease-out ${delay}s both`,
    }}>
      {children}
    </span>
  );
}

/* ── Desktop Split Perception card ── */
function SplitPerceptionCard() {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${LINE}`,
      borderRadius: 20, overflow: "hidden",
      boxShadow: "0 4px 28px rgba(14,12,8,0.07), 0 1px 4px rgba(14,12,8,0.04)",
      ...fadeIn(0.18),
    }}>

      {/* Session header — dark bar, gives cold visitor full context */}
      <div style={{
        background: COAL_LITE, padding: "11px 22px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.2em", textTransform: "uppercase" as const,
          color: "rgba(244,229,216,0.4)", flexShrink: 0,
        }}>Q4</span>
        <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
        <span style={{
          fontFamily: SANS, fontSize: 12.5, color: "rgba(244,229,216,0.82)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
        }}>
          Tell me about a time you led without authority
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: COPPER, flexShrink: 0,
        }}>PM · Flipkart</span>
      </div>

      {/* Two-panel comparison — the visual argument */}
      <div style={{ display: "flex", borderBottom: `1px solid ${LINE}` }}>

        {/* Left — WHAT YOU SAID (clean, no judgment) */}
        <div style={{ flex: 1, padding: "22px", borderRight: `1px solid ${LINE}` }}>
          <div style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase" as const,
            color: FAINTWK, marginBottom: 14,
          }}>What you said</div>
          <p style={{ margin: 0, fontFamily: SANS, fontSize: 13, color: INK, lineHeight: 1.72 }}>
            {`"So our team was assigned a cross-functional project. We had to coordinate
with three other departments. We built a shared tracking dashboard, and we
aligned everyone by the end of Q3."`}
          </p>
        </div>

        {/* Right — WHAT THEY HEARD (highlighted pattern emerges) */}
        <div style={{ flex: 1, padding: "22px" }}>
          <div style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase" as const,
            color: COPPER, marginBottom: 14,
          }}>What they heard</div>
          <p style={{ margin: "0 0 14px", fontFamily: SANS, fontSize: 13, color: INK, lineHeight: 1.72 }}>
            {"\"So "}
            <WeWord delay={0.62}>our</WeWord>
            {" team was assigned a cross-functional project. "}
            <WeWord delay={0.70}>We</WeWord>
            {" had to coordinate with three other departments. "}
            <WeWord delay={0.78}>We</WeWord>
            {" built a shared tracking dashboard, and "}
            <WeWord delay={0.86}>we</WeWord>
            {" aligned everyone by the end of Q3.\""}
          </p>
          <div style={{
            padding: "7px 11px",
            background: "rgba(180,83,9,0.07)",
            border: "1px solid rgba(180,83,9,0.18)",
            borderRadius: 7,
            fontFamily: SANS, fontSize: 11.5, color: COPPER,
            ...fadeIn(1.1),
          }}>
            Your contribution — not mentioned
          </div>
        </div>
      </div>

      {/* Metric bars — the gap quantified */}
      <div style={{ padding: "18px 22px 22px" }}>

        {/* Confidence — fills fast (smooth 8.4 energy) */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: 12, color: INK }}>Your confidence</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: CONF_CLR, letterSpacing: "0.02em" }}>8.4 / 10</span>
          </div>
          <div style={{ height: 5, background: LINE, borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "84%", background: CONF_CLR,
              borderRadius: 3, transformOrigin: "left" as const,
              animation: "heroGrowBar 0.55s cubic-bezier(0.22,1,0.36,1) 0.92s both",
            }} />
          </div>
        </div>

        {/* Engagement — fills sluggishly (the 2.9 crawl makes the gap visceral) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: 12, color: INK }}>Interviewer engagement</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: ENGAG_CLR, letterSpacing: "0.02em" }}>2.9 / 10</span>
          </div>
          <div style={{ height: 5, background: LINE, borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "29%", background: ENGAG_CLR,
              borderRadius: 3, transformOrigin: "left" as const,
              animation: "heroGrowBar 1.1s cubic-bezier(0.22,1,0.36,1) 1.05s both",
            }} />
          </div>
        </div>

        {/* Final diagnosis — sharpest line, arrives after the gap has landed */}
        <p style={{
          margin: 0, fontFamily: SERIF, fontSize: 16.5,
          fontStyle: "italic", color: COAL, letterSpacing: "-0.01em",
          ...fadeIn(1.62),
        }}>
          "You were invisible in your own answer."
        </p>
      </div>
    </div>
  );
}

/* ── Desktop Nav ── */
function DesktopNav() {
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 64px", height: 64,
      borderBottom: `1px solid ${LINE}`,
      background: CREAM,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: COAL,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: CREAM, fontFamily: SERIF, fontSize: 13 }}>H</span>
        </div>
        <span style={{ fontFamily: SANS, fontSize: 15.5, fontWeight: 600, color: COAL, letterSpacing: "-0.01em" }}>
          HireStepX
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {["Features", "Pricing", "For Students"].map(item => (
          <span key={item} style={{ fontFamily: SANS, fontSize: 14, color: INK, cursor: "pointer" }}>
            {item}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontFamily: SANS, fontSize: 14, color: INK, cursor: "pointer" }}>Login</span>
        <button style={{
          fontFamily: SANS, fontSize: 13.5, fontWeight: 500,
          background: "transparent", color: COAL,
          border: `1px solid ${LINE}`, borderRadius: 8,
          padding: "7px 18px", cursor: "pointer",
        }}>
          Get started
        </button>
      </div>
    </nav>
  );
}

/* ════════════════════════════════════════════
   Desktop hero — 1440 × 900
   ════════════════════════════════════════════ */
export function HeroGapDesign() {
  return (
    <div style={{ width: 1440, minHeight: 900, background: CREAM }}>
      <GlobalStyle />
      <DesktopNav />

      <div style={{
        display: "flex", alignItems: "center",
        padding: "68px 64px 76px",
        gap: 56, minHeight: 836,
        boxSizing: "border-box" as const,
      }}>

        {/* Left column — orientation + claim + CTA */}
        <div style={{ flex: "0 0 42%", maxWidth: 540 }}>

          <div style={{ marginBottom: 26, ...fadeUp(0) }}>
            <SectionPill>AI mock interviews · Built for India</SectionPill>
          </div>

          <h1 style={{
            fontFamily: SERIF, fontSize: 54, fontWeight: 400,
            margin: "0 0 26px", lineHeight: 1.08,
            letterSpacing: "-0.026em",
            ...fadeUp(0.08),
          }}>
            <span style={{ color: COAL, display: "block" }}>You studied for<br />the interview.</span>
            <span style={{ color: INK, display: "block", marginTop: 4 }}>You&apos;re not ready<br />for the interviewer.</span>
          </h1>

          <p style={{
            fontFamily: SANS, fontSize: 17, color: INK,
            lineHeight: 1.62, margin: "0 0 38px", maxWidth: 420,
            ...fadeUp(0.16),
          }}>
            See what the interviewer experienced — before it costs you the next offer.
          </p>

          <div style={{ marginBottom: 14, ...fadeUp(0.22) }}>
            <button style={{
              fontFamily: SANS, fontSize: 15.5, fontWeight: 500,
              background: COAL, color: CREAM,
              border: "none", borderRadius: 10,
              padding: "14px 30px", cursor: "pointer",
              letterSpacing: "-0.01em",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              Start your free session <span>&#8594;</span>
            </button>
          </div>

          <p style={{
            fontFamily: SANS, fontSize: 12.5, color: FAINTWK,
            margin: "0 0 36px",
            ...fadeUp(0.28),
          }}>
            No signup required · &#8377;49/week after
          </p>

          <div style={{ ...fadeUp(0.34) }}>
            <p style={{ margin: 0, fontFamily: SANS, fontSize: 12, color: FAINTWK, lineHeight: 1.55 }}>
              4,200+ PM and SDE candidates<br />
              Offers at Flipkart, Razorpay, Google India
            </p>
          </div>
        </div>

        {/* Right column — Split Perception visual */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SplitPerceptionCard />
        </div>
      </div>
    </div>
  );
}

/* ── Mobile Split card with toggle tabs ── */
function MobileSplitCard() {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${LINE}`,
      borderRadius: 16, overflow: "hidden",
      boxShadow: "0 2px 16px rgba(14,12,8,0.06)",
    }}>

      {/* Session header */}
      <div style={{
        background: COAL_LITE, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase" as const,
          color: "rgba(244,229,216,0.4)", flexShrink: 0,
        }}>Q4</span>
        <span style={{ width: 1, height: 11, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
        <span style={{
          fontFamily: SANS, fontSize: 11.5, color: "rgba(244,229,216,0.82)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
        }}>Led without authority</span>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 600,
          color: COPPER, textTransform: "uppercase" as const,
          letterSpacing: "0.1em", flexShrink: 0,
        }}>PM · Flipkart</span>
      </div>

      {/* Tab toggle — THEY HEARD active (the revealing panel) */}
      <div style={{ display: "flex", borderBottom: `1px solid ${LINE}` }}>
        <div style={{
          flex: 1, padding: "10px 0", textAlign: "center" as const,
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.16em", textTransform: "uppercase" as const,
          color: FAINTWK, borderRight: `1px solid ${LINE}`,
          background: CREAM,
        }}>You said</div>
        <div style={{
          flex: 1, padding: "10px 0", textAlign: "center" as const,
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.16em", textTransform: "uppercase" as const,
          color: COPPER, background: CARD_BG,
          boxShadow: `inset 0 -2px 0 ${COPPER}`,
        }}>They heard</div>
      </div>

      {/* Active panel: THEY HEARD */}
      <div style={{ padding: "16px" }}>
        <p style={{ margin: "0 0 12px", fontFamily: SANS, fontSize: 13, color: INK, lineHeight: 1.65 }}>
          {"\"So "}
          <WeWord delay={0}>our</WeWord>
          {" team was assigned a cross-functional project. "}
          <WeWord delay={0.08}>We</WeWord>
          {" had to coordinate with three other departments. "}
          <WeWord delay={0.16}>We</WeWord>
          {" built a shared tracking dashboard, and "}
          <WeWord delay={0.24}>we</WeWord>
          {" aligned everyone by end of Q3.\""}
        </p>
        <div style={{
          padding: "7px 10px",
          background: "rgba(180,83,9,0.07)",
          border: "1px solid rgba(180,83,9,0.18)",
          borderRadius: 7,
          fontFamily: SANS, fontSize: 11, color: COPPER,
        }}>
          Your contribution — not mentioned
        </div>
      </div>

      {/* Metrics */}
      <div style={{ padding: "14px 16px 18px", borderTop: `1px solid ${LINE}` }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: SANS, fontSize: 11.5, color: INK }}>Your confidence</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: CONF_CLR }}>8.4/10</span>
          </div>
          <div style={{ height: 4, background: LINE, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "84%", background: CONF_CLR,
              borderRadius: 2, transformOrigin: "left" as const,
              animation: "heroGrowBar 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s both",
            }} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: SANS, fontSize: 11.5, color: INK }}>Interviewer engagement</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ENGAG_CLR }}>2.9/10</span>
          </div>
          <div style={{ height: 4, background: LINE, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "29%", background: ENGAG_CLR,
              borderRadius: 2, transformOrigin: "left" as const,
              animation: "heroGrowBar 1.0s cubic-bezier(0.22,1,0.36,1) 0.2s both",
            }} />
          </div>
        </div>
        <p style={{
          margin: 0, fontFamily: SERIF, fontSize: 14,
          fontStyle: "italic", color: COAL, letterSpacing: "-0.01em",
        }}>
          "You were invisible in your own answer."
        </p>
      </div>
    </div>
  );
}

/* ── Mobile Nav ── */
function MobileNav() {
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", height: 56,
      borderBottom: `1px solid ${LINE}`, background: CREAM,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: COAL,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: CREAM, fontFamily: SERIF, fontSize: 12 }}>H</span>
        </div>
        <span style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: COAL }}>HireStepX</span>
      </div>
      <button style={{
        fontFamily: SANS, fontSize: 13, fontWeight: 500,
        background: COAL, color: CREAM, border: "none",
        borderRadius: 8, padding: "7px 16px", cursor: "pointer",
      }}>Get started</button>
    </nav>
  );
}

/* ════════════════════════════════════════════
   Mobile hero — 390 × 920
   ════════════════════════════════════════════ */
export function HeroGapDesignMobile() {
  return (
    <div style={{ width: 390, background: CREAM }}>
      <GlobalStyle />
      <MobileNav />

      <div style={{ padding: "32px 20px 40px" }}>
        <div style={{ marginBottom: 18 }}>
          <SectionPill>AI mock interviews · Built for India</SectionPill>
        </div>

        <h1 style={{
          fontFamily: SERIF, fontSize: 33, fontWeight: 400,
          color: COAL, margin: "0 0 14px",
          lineHeight: 1.12, letterSpacing: "-0.022em",
        }}>
          You studied for the interview.{" "}
          <span style={{ color: INK }}>You&apos;re not ready for the interviewer.</span>
        </h1>

        <p style={{
          fontFamily: SANS, fontSize: 15, color: INK,
          lineHeight: 1.6, margin: "0 0 24px",
        }}>
          See what the interviewer experienced — before it costs you the next offer.
        </p>

        <MobileSplitCard />

        <div style={{ marginTop: 22 }}>
          <button style={{
            width: "100%", fontFamily: SANS, fontSize: 15.5, fontWeight: 500,
            background: COAL, color: CREAM, border: "none",
            borderRadius: 10, padding: "15px 24px", cursor: "pointer",
          }}>
            Start your free session &#8594;
          </button>
          <p style={{
            fontFamily: SANS, fontSize: 12, color: FAINTWK,
            textAlign: "center" as const, margin: "10px 0 0",
          }}>
            No signup required · &#8377;49/week after
          </p>
        </div>

        <p style={{
          fontFamily: SANS, fontSize: 11.5, color: FAINTWK,
          textAlign: "center" as const, margin: "20px 0 0", lineHeight: 1.55,
        }}>
          4,200+ candidates · Offers at Flipkart, Razorpay, Google India
        </p>
      </div>
    </div>
  );
}
