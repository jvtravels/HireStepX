/**
 * FeatureBentoDesign — canvas-local design mockup.
 * Design + animation inspired by Delphi.ai's "You're in demand" section:
 *   - Two-tone muted headline (line 1 dark, line 2 faded)
 *   - Pill/badge section tag above H2
 *   - Center-aligned card text
 *   - Cards barely lift off background (softer shadow, subtle border)
 *   - CSS load-in stagger animations (fade up from below)
 *   - Warm accent color on numbers, badges, highlights
 */

/* ── Design tokens ── */
const CREAM    = "#FAF7F0";
const WHITE    = "#FFFFFF";
const COAL     = "#0E0C08";
const INK      = "#6E6759";
const FAINT    = "#736B5D";
const FAINTWK  = "#A39C8B";
const INDIGO   = "#312E81";
const INDIGODP = "#1E1B4B";
const INDIGOMS = "rgba(49,46,129,0.045)";
const COPPER   = "#B45309";
const COPPDK   = "#923F07";
const COPP100  = "#F4E5D8";
const COPPBDR  = "rgba(180,83,9,0.22)";
const LINE     = "#EBE5D2";
const SUCCESS  = "#15803D";
const RED      = "#DC2626";
const RED_BG   = "rgba(220,38,38,0.06)";
const RED_BD   = "rgba(220,38,38,0.14)";
const CREAM_M  = "rgba(245,242,237,0.72)";

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS  = '"Satoshi", "Inter", system-ui, sans-serif';
const MONO  = '"JetBrains Mono", "Fira Code", monospace';

/* ── Keyframe animations injected once ── */
const STYLE = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes countUp {
  from { opacity: 0.3; transform: scale(0.88); }
  to   { opacity: 1;   transform: scale(1); }
}
`;

function GlobalStyle() {
  return <style>{STYLE}</style>;
}

function anim(delay = 0, duration = 0.55): React.CSSProperties {
  return {
    animation: `fadeUp ${duration}s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
  };
}

/* ── Tiny helpers ── */
function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block",
      fontFamily: SANS, fontSize: 12.5, fontWeight: 500,
      color: INK,
      border: `1px solid ${LINE}`,
      borderRadius: 999,
      padding: "5px 14px",
      background: WHITE,
      letterSpacing: "0.01em",
    }}>
      {children}
    </span>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      marginBottom: 18,
    }}>
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600,
        letterSpacing: "0.22em", textTransform: "uppercase" as const,
        color: FAINTWK, flexShrink: 0,
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: LINE }} />
    </div>
  );
}

/* ── Card shells ── */
function LargeCard({
  children, dark, style, delay = 0,
}: {
  children: React.ReactNode; dark?: boolean; delay?: number; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: dark ? INDIGODP : "#FDFBF6",
      border: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(235,229,210,0.7)"}`,
      borderRadius: 24,
      padding: "44px 40px 36px",
      boxShadow: dark
        ? "0 12px 40px rgba(14,12,8,0.20)"
        : "0 2px 12px rgba(14,12,8,0.04), 0 1px 3px rgba(14,12,8,0.04)",
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative" as const, overflow: "hidden",
      textAlign: "center" as const,
      ...anim(delay),
      ...style,
    }}>
      {dark && (
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 55% at 75% 25%, rgba(180,83,9,0.14) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />
      )}
      <div style={{ position: "relative", width: "100%" }}>{children}</div>
    </div>
  );
}

function SmallCard({
  children, style, delay = 0,
}: {
  children: React.ReactNode; delay?: number; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "#FDFBF6",
      border: "1px solid rgba(235,229,210,0.7)",
      borderRadius: 22,
      padding: "36px 32px 28px",
      boxShadow: "0 2px 12px rgba(14,12,8,0.04), 0 1px 3px rgba(14,12,8,0.04)",
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center" as const,
      ...anim(delay),
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Shared card typography ── */
function CardLabel({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, fontWeight: 700,
      letterSpacing: "0.2em", textTransform: "uppercase" as const,
      color: light ? "rgba(244,229,216,0.5)" : COPPER,
      display: "block", marginBottom: 16,
    }}>{children}</span>
  );
}

function CardH3({ children, light, size = 26 }: { children: React.ReactNode; light?: boolean; size?: number }) {
  return (
    <h3 style={{
      fontFamily: SERIF, fontSize: size, fontWeight: 400,
      color: light ? CREAM : COAL,
      margin: 0, marginBottom: 12,
      letterSpacing: "-0.018em", lineHeight: 1.2,
      maxWidth: 380,
      marginLeft: "auto", marginRight: "auto",
    }}>{children}</h3>
  );
}

function CardBody({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p style={{
      fontFamily: SANS, fontSize: 13.5,
      color: light ? CREAM_M : INK,
      lineHeight: 1.65, margin: 0, marginBottom: 28,
      maxWidth: 360, marginLeft: "auto", marginRight: "auto",
    }}>{children}</p>
  );
}

function Copper({ children }: { children: React.ReactNode }) {
  return <em style={{ fontStyle: "italic", color: COPPER }}>{children}</em>;
}
function CopperLight({ children }: { children: React.ReactNode }) {
  return <em style={{ fontStyle: "italic", color: COPP100 }}>{children}</em>;
}

/* ── Card visuals ── */
function VoiceVisual() {
  return (
    <div style={{
      background: CREAM, border: `1px solid ${LINE}`, borderRadius: 16,
      overflow: "hidden", width: "100%",
    }}>
      {/* User bubble */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.14em", textTransform: "uppercase" as const,
          color: FAINTWK, marginBottom: 6, textAlign: "left",
        }}>You</div>
        <p style={{
          margin: 0, color: INK, lineHeight: 1.5, fontSize: 13,
          fontFamily: SANS, textAlign: "left",
        }}>
          "I improved team communication by setting up weekly syncs…"
        </p>
      </div>
      {/* AI follow-up */}
      <div style={{
        padding: "14px 18px",
        background: `linear-gradient(135deg, ${INDIGOMS} 0%, transparent 100%)`,
        borderLeft: `3px solid ${INDIGO}`,
        borderBottom: `1px solid ${LINE}`,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.14em", textTransform: "uppercase" as const,
          color: INDIGO, opacity: 0.6, marginBottom: 6, textAlign: "left",
        }}>AI Interviewer</div>
        <p style={{
          margin: 0, color: COAL, fontWeight: 600, lineHeight: 1.5,
          fontSize: 13, fontFamily: SANS, textAlign: "left",
        }}>
          "What metric did you track to know the syncs were working?"
        </p>
      </div>
      {/* Waveform bar */}
      <div style={{
        padding: "10px 18px", display: "flex",
        alignItems: "center", gap: 10, background: "transparent",
      }}>
        <svg width="72" height="16" viewBox="0 0 72 16" fill="none">
          {[2,5,7,3,8,5,11,4,7,4,10,3,6,8,3,5,9,3].map((h, i) => (
            <rect key={i} x={i * 4} y={(12-h)/2} width="3" height={h} rx="1.5"
              fill={INDIGO} opacity={0.25 + (i % 3) * 0.2} />
          ))}
        </svg>
        <span style={{
          marginLeft: "auto", fontFamily: MONO, fontSize: 10.5,
          color: SUCCESS, fontWeight: 700,
          animation: `fadeIn 1.2s ease 0.3s both`,
        }}>
          listening…
        </span>
      </div>
    </div>
  );
}

function SalaryVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <div style={{
        padding: "16px 20px",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 14,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontFamily: SANS, fontSize: 12.5, color: CREAM_M }}>HR's offer</span>
        <span style={{
          fontFamily: MONO, fontSize: 22, fontWeight: 700,
          color: "rgba(244,242,237,0.38)",
          animation: `countUp 0.5s ease 0.2s both`,
        }}>₹12 LPA</span>
      </div>
      <div style={{
        padding: "16px 20px",
        background: "rgba(180,83,9,0.17)",
        border: "1px solid rgba(180,83,9,0.26)",
        borderRadius: 14,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontFamily: SANS, fontSize: 12.5, color: COPP100 }}>Your counter</span>
        <span style={{
          fontFamily: MONO, fontSize: 22, fontWeight: 700, color: COPP100,
          animation: `countUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.5s both`,
        }}>₹14 LPA</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <span style={{
          fontFamily: MONO, fontSize: 12, color: "#4ADE80", fontWeight: 700,
          background: "rgba(74,222,128,0.12)", padding: "4px 10px", borderRadius: 8,
        }}>+₹2L / yr</span>
        <span style={{ fontFamily: SANS, fontSize: 12, color: "rgba(244,242,237,0.4)" }}>
          recovered in 4 minutes
        </span>
      </div>
    </div>
  );
}

function ResumeVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div style={{
        padding: "13px 16px",
        background: COPP100, borderRadius: 12,
        border: `1px solid ${COPPBDR}`,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.14em", textTransform: "uppercase" as const,
          color: COPPDK, display: "block", marginBottom: 7, textAlign: "left",
        }}>From your resume</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
          {["Python", "Razorpay internship", "B.Tech CSE"].map(tag => (
            <span key={tag} style={{
              fontFamily: SANS, fontSize: 11, fontWeight: 500,
              background: "rgba(180,83,9,0.10)", color: COPPDK,
              padding: "3px 9px", borderRadius: 20,
            }}>{tag}</span>
          ))}
        </div>
      </div>
      <div style={{
        padding: "13px 16px",
        background: WHITE, border: `1px solid ${LINE}`,
        borderRadius: 12,
        fontFamily: SANS, fontSize: 12.5, color: COAL,
        lineHeight: 1.45, textAlign: "left",
      }}>
        "Walk me through the specific bug you fixed in the Razorpay payment gateway."
      </div>
    </div>
  );
}

function BiasVisual() {
  return (
    <div style={{
      background: CREAM, border: `1px solid ${LINE}`,
      borderRadius: 12, overflow: "hidden", width: "100%",
    }}>
      <div style={{
        padding: "14px 16px",
        fontFamily: SANS, fontSize: 13, color: INK,
        lineHeight: 1.8, textAlign: "left",
      }}>
        {"I "}
        <mark style={{
          background: "rgba(180,83,9,0.13)", color: COPPER,
          borderRadius: 4, padding: "1px 5px", fontWeight: 700,
        }}>basically</mark>
        {" restructured the team and "}
        <mark style={{
          background: "rgba(180,83,9,0.13)", color: COPPER,
          borderRadius: 4, padding: "1px 5px", fontWeight: 700,
        }}>I think</mark>
        {" it "}
        <mark style={{
          background: "rgba(180,83,9,0.13)", color: COPPER,
          borderRadius: 4, padding: "1px 5px", fontWeight: 700,
        }}>probably</mark>
        {" helped…"}
      </div>
      <div style={{
        padding: "10px 16px",
        background: INDIGOMS,
        borderTop: `1px solid ${LINE}`,
        display: "flex", alignItems: "baseline", gap: 10,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.14em", textTransform: "uppercase" as const,
          color: INDIGO, flexShrink: 0,
        }}>Crisp →</span>
        <span style={{
          fontFamily: SANS, fontSize: 12, color: COAL,
          fontWeight: 600, lineHeight: 1.4,
        }}>
          "I restructured the team. Throughput rose 30% in Q3."
        </span>
      </div>
    </div>
  );
}

function ThoughtBubbleVisual() {
  const bars = [
    { q: "Q1", w: "88%", c: SUCCESS },
    { q: "Q2", w: "80%", c: SUCCESS },
    { q: "Q3", w: "62%", c: COPPER },
    { q: "Q4", w: "20%", c: RED },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {bars.map(({ q, w, c }, i) => (
          <div key={q} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{
              fontFamily: MONO, fontSize: 10, color: FAINTWK,
              width: 20, flexShrink: 0, textAlign: "right",
            }}>{q}</span>
            <div style={{
              flex: 1, height: 7, background: LINE, borderRadius: 4, overflow: "hidden",
            }}>
              <div style={{
                width: w, height: "100%", background: c, borderRadius: 4,
                animation: `fadeUp 0.5s ease ${0.1 + i * 0.08}s both`,
              }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{
        padding: "12px 14px",
        background: RED_BG, border: `1px solid ${RED_BD}`, borderRadius: 12,
        textAlign: "left",
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em",
          textTransform: "uppercase" as const, color: RED, opacity: 0.75,
          display: "block", marginBottom: 6,
        }}>Trigger · Q4</span>
        <p style={{
          fontFamily: SANS, fontSize: 12.5, color: COAL,
          margin: 0, fontStyle: "italic", lineHeight: 1.45,
        }}>
          "It was a learning experience."
        </p>
        <p style={{
          fontFamily: SANS, fontSize: 11, color: FAINT,
          margin: "5px 0 0",
        }}>
          90 words at Q3 → 6 words. The room shifted here.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   DESKTOP — 1440px
══════════════════════════════════════════════════════ */
export function FeatureBentoDesign() {
  return (
    <div style={{ background: CREAM, minHeight: "100vh", padding: "90px 0 100px" }}>
      <GlobalStyle />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 80px" }}>

        {/* Section tag + H2 */}
        <div style={{
          textAlign: "center", marginBottom: 72,
          ...anim(0, 0.5),
        }}>
          <SectionPill>What sets it apart</SectionPill>
          <div style={{ marginTop: 24 }}>
            {/* Two-tone headline — Delphi pattern */}
            <h2 style={{
              fontFamily: SERIF, fontSize: 54, fontWeight: 400,
              color: COAL, margin: 0,
              letterSpacing: "-0.025em", lineHeight: 1.06,
            }}>
              What practice alone
            </h2>
            <h2 style={{
              fontFamily: SERIF, fontSize: 54, fontWeight: 400,
              color: FAINTWK, margin: 0,
              letterSpacing: "-0.025em", lineHeight: 1.06,
            }}>
              <em style={{ fontStyle: "italic", color: COPPER }}>never shows you.</em>
            </h2>
          </div>
          <p style={{
            fontFamily: SANS, fontSize: 16, color: INK,
            lineHeight: 1.65, margin: "18px auto 0",
            maxWidth: 480,
            ...anim(0.15, 0.5),
          }}>
            None of this fits in a question bank.
          </p>
        </div>

        {/* ── Row 1: During the session ── */}
        <RowLabel>During the session</RowLabel>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 16, marginBottom: 16,
        }}>
          <LargeCard delay={0.05}>
            <CardLabel>Real conversation</CardLabel>
            <CardH3 size={30}>
              Vague answer? <Copper>It asks again. Harder.</Copper>
            </CardH3>
            <CardBody>
              Every follow-up is built from what you just said — not a pre-written script.
            </CardBody>
            <VoiceVisual />
          </LargeCard>

          <LargeCard dark delay={0.12}>
            <CardLabel light>Salary negotiation</CardLabel>
            <CardH3 size={30} light>
              You left <CopperLight>₹2L on the table.</CopperLight> Practice changing that.
            </CardH3>
            <CardBody light>
              The only mode that trains you to counter-offer, anchor high, and hold the silence until HR moves.
            </CardBody>
            <SalaryVisual />
          </LargeCard>
        </div>

        {/* ── Row 2: After each session ── */}
        <RowLabel>After each session</RowLabel>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}>
          <SmallCard delay={0.08}>
            <CardLabel>Resume-aware</CardLabel>
            <CardH3 size={21}>
              Your resume is <em style={{ fontStyle: "italic" }}>the question paper.</em>
            </CardH3>
            <CardBody>Upload once. Every session drills your actual projects.</CardBody>
            <ResumeVisual />
          </SmallCard>

          <SmallCard delay={0.14} style={{ background: "#FDFBF5" }}>
            <CardLabel>Your words</CardLabel>
            <CardH3 size={21}>
              You said <em style={{ fontStyle: "italic", color: COPPER }}>"basically"</em>{" "}
              9 times. The room heard uncertainty.
            </CardH3>
            <CardBody>We flag every hedge and show the crisp rewrite beside it.</CardBody>
            <BiasVisual />
          </SmallCard>

          <SmallCard delay={0.20}>
            <CardLabel>AI attention</CardLabel>
            <CardH3 size={21}>
              The exact answer{" "}
              <em style={{ fontStyle: "italic" }}>that lost the room.</em>
            </CardH3>
            <CardBody>
              Where the interviewer switched off — and what you said right before.
            </CardBody>
            <ThoughtBubbleVisual />
          </SmallCard>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MOBILE — 390px
══════════════════════════════════════════════════════ */
export function FeatureBentoDesignMobile() {
  return (
    <div style={{ background: CREAM, minHeight: "100vh", padding: "60px 0 80px" }}>
      <GlobalStyle />
      <div style={{ padding: "0 18px" }}>

        {/* Section tag + H2 */}
        <div style={{ textAlign: "center", marginBottom: 48, ...anim(0, 0.5) }}>
          <SectionPill>What sets it apart</SectionPill>
          <div style={{ marginTop: 20 }}>
            <h2 style={{
              fontFamily: SERIF, fontSize: 36, fontWeight: 400,
              color: COAL, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1,
            }}>
              What practice alone
            </h2>
            <h2 style={{
              fontFamily: SERIF, fontSize: 36, fontWeight: 400,
              color: FAINTWK, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1,
            }}>
              <em style={{ fontStyle: "italic", color: COPPER }}>never shows you.</em>
            </h2>
          </div>
          <p style={{
            fontFamily: SANS, fontSize: 14, color: INK,
            lineHeight: 1.65, margin: "14px auto 0", maxWidth: 300,
          }}>None of this fits in a question bank.</p>
        </div>

        <RowLabel>During the session</RowLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          <LargeCard delay={0.05} style={{ padding: 26 }}>
            <CardLabel>Real conversation</CardLabel>
            <CardH3 size={24}>Vague answer? <Copper>It asks again. Harder.</Copper></CardH3>
            <CardBody>Every follow-up is built from what you just said.</CardBody>
            <VoiceVisual />
          </LargeCard>
          <LargeCard dark delay={0.1} style={{ padding: 26 }}>
            <CardLabel light>Salary negotiation</CardLabel>
            <CardH3 size={24} light>You left <CopperLight>₹2L on the table.</CopperLight> Practice changing that.</CardH3>
            <CardBody light>The only mode that trains you to counter-offer and hold the silence.</CardBody>
            <SalaryVisual />
          </LargeCard>
        </div>

        <RowLabel>After each session</RowLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SmallCard delay={0.05} style={{ padding: 24 }}>
            <CardLabel>Resume-aware</CardLabel>
            <CardH3 size={19}>Your resume is <em style={{ fontStyle: "italic" }}>the question paper.</em></CardH3>
            <CardBody>Upload once. Every session drills your actual projects.</CardBody>
            <ResumeVisual />
          </SmallCard>
          <SmallCard delay={0.1} style={{ padding: 24 }}>
            <CardLabel>Your words</CardLabel>
            <CardH3 size={19}>You said <em style={{ fontStyle: "italic", color: COPPER }}>"basically"</em> 9 times. The room heard uncertainty.</CardH3>
            <CardBody>We flag every hedge and show the crisp rewrite beside it.</CardBody>
            <BiasVisual />
          </SmallCard>
          <SmallCard delay={0.15} style={{ padding: 24 }}>
            <CardLabel>AI attention</CardLabel>
            <CardH3 size={19}>The exact answer <em style={{ fontStyle: "italic" }}>that lost the room.</em></CardH3>
            <CardBody>Where the interviewer switched off — and what you said right before.</CardBody>
            <ThoughtBubbleVisual />
          </SmallCard>
        </div>
      </div>
    </div>
  );
}

export default FeatureBentoDesign;
