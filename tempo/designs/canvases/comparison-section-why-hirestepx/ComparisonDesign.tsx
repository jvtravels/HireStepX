"use client";
import React from "react";

/* ── Brand tokens ─────────────────────────────────────────────────── */
const CREAM    = "#FAF7F0";
const COAL     = "#0E0C08";
const COPPER   = "#B45309";
const INK      = "#6E6759";
const LINE     = "#EBE5D2";
const WHITE    = "#FEFCF8";
const MUTED_TX = "#A39C8B";
const SERIF    = '"Instrument Serif", Georgia, serif';
const SANS     = '"Satoshi", "Inter", system-ui, sans-serif';
const MONO     = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

/* ── CSS keyframes injected once ─────────────────────────────────── */
const KEYFRAMES = `
@keyframes hsx-slideUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes hsx-fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes hsx-revealLine {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes hsx-drawScore {
  from { opacity: 0; letter-spacing: -0.04em; }
  to   { opacity: 1; letter-spacing: normal; }
}
`;

function StyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />;
}

/* Shared easing — expo ease-out, no bounce */
const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

/* ── Desktop (1440 × 960) ─────────────────────────────────────────── */
export function ComparisonDesktop() {
  return (
    <div style={{
      width: 1440, minHeight: 960,
      background: CREAM,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "92px 0 110px",
      fontFamily: SANS,
      position: "relative",
    }}>
      <StyleTag />

      {/* ── Headline ── */}
      <h2 style={{
        fontFamily: SERIF, fontSize: 60, fontWeight: 400,
        color: COAL, margin: "0 0 20px",
        letterSpacing: "-0.02em", lineHeight: 1.08, textAlign: "center",
        animation: `hsx-slideUp 0.55s ${EXPO} 0.05s both`,
      }}>
        Practice that can't score you{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>isn't practice.</em>
      </h2>

      {/* ── Subheading ── */}
      <p style={{
        fontFamily: SANS, fontSize: 17, lineHeight: 1.65,
        color: INK, textAlign: "center",
        maxWidth: 520, margin: "0 0 68px",
        animation: `hsx-slideUp 0.55s ${EXPO} 0.12s both`,
      }}>
        A senior's mock is hard to arrange. An AI session agrees with everything.
        Neither tells you where you lost the HR panel.
      </p>

      {/* ── Three cards ── */}
      <div style={{
        display: "flex", gap: 20,
        alignItems: "stretch",
        width: 1180,
      }}>

        {/* Card 1 — Senior mock */}
        <div style={{
          flex: 1,
          background: WHITE,
          border: `1px solid ${LINE}`,
          borderRadius: 16,
          padding: "28px 28px 32px",
          display: "flex", flexDirection: "column",
          animation: `hsx-slideUp 0.52s ${EXPO} 0.08s both`,
        }}>
          {/* Label */}
          <span style={{
            fontFamily: SANS, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: MUTED_TX, marginBottom: 20, display: "block",
          }}>
            Mock with a senior
          </span>

          {/* What it said */}
          <div style={{ marginBottom: 24, flex: 1 }}>
            <span style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: MUTED_TX, display: "block", marginBottom: 10,
            }}>What it said</span>
            <p style={{
              fontFamily: SERIF, fontSize: 20, lineHeight: 1.45,
              color: INK, margin: 0, fontStyle: "italic",
            }}>
              "That was pretty good. Work on your communication a bit."
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: "0.5px", background: LINE, marginBottom: 24 }} />

          {/* What you needed */}
          <div style={{ animation: `hsx-fadeIn 0.45s ease-out 0.72s both` }}>
            <span style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: COPPER, display: "block", marginBottom: 10, opacity: 0.8,
            }}>What you needed</span>
            <p style={{
              fontFamily: SANS, fontSize: 14, lineHeight: 1.6,
              color: INK, margin: 0,
            }}>
              Q3: You dropped the STAR structure and never recovered the impact statement.
              The interviewer has no idea what the business outcome was.
            </p>
          </div>
        </div>

        {/* Card 2 — AI chatbot */}
        <div style={{
          flex: 1,
          background: WHITE,
          border: `1px solid ${LINE}`,
          borderRadius: 16,
          padding: "28px 28px 32px",
          display: "flex", flexDirection: "column",
          animation: `hsx-slideUp 0.52s ${EXPO} 0.18s both`,
        }}>
          {/* Label */}
          <span style={{
            fontFamily: SANS, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: MUTED_TX, marginBottom: 20, display: "block",
          }}>
            Any AI chatbot
          </span>

          {/* What it said */}
          <div style={{ marginBottom: 24, flex: 1 }}>
            <span style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: MUTED_TX, display: "block", marginBottom: 10,
            }}>What it said</span>
            <p style={{
              fontFamily: SERIF, fontSize: 20, lineHeight: 1.45,
              color: INK, margin: 0, fontStyle: "italic",
            }}>
              "Excellent response! 9/10. You're ready for this interview."
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: "0.5px", background: LINE, marginBottom: 24 }} />

          {/* What you needed */}
          <div style={{ animation: `hsx-fadeIn 0.45s ease-out 0.84s both` }}>
            <span style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: COPPER, display: "block", marginBottom: 10, opacity: 0.8,
            }}>What you needed</span>
            <p style={{
              fontFamily: SANS, fontSize: 14, lineHeight: 1.6,
              color: INK, margin: 0,
            }}>
              You gave the same answer to Q2 and Q4. The AI didn't catch it.
              A real panel would have. That's a red flag for shortlisting.
            </p>
          </div>
        </div>

        {/* Card 3 — HireStepX (coal, report format) */}
        <div style={{
          flex: 1,
          background: COAL,
          borderRadius: 16,
          padding: "28px 28px 32px",
          display: "flex", flexDirection: "column",
          animation: `hsx-slideUp 0.55s ${EXPO} 0.30s both`,
          boxShadow: "0 16px 48px rgba(14,12,8,0.22), 0 4px 16px rgba(14,12,8,0.14)",
        }}>
          {/* Label */}
          <span style={{
            fontFamily: SANS, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: COPPER, marginBottom: 20, display: "block",
          }}>
            HireStepX
          </span>

          {/* Report output — no "what it said / what you needed" split */}
          <div style={{
            background: "rgba(254,252,248,0.05)",
            borderRadius: 10,
            padding: "20px 20px 22px",
            flex: 1,
            display: "flex", flexDirection: "column", gap: 0,
          }}>

            {/* Report header */}
            <div style={{
              marginBottom: 16,
              animation: `hsx-revealLine 0.35s ${EXPO} 0.48s both`,
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 400,
                color: MUTED_TX, letterSpacing: "0.08em", textTransform: "uppercase",
              }}>Q3 — Behaviour question</span>
            </div>

            {/* Score line */}
            <div style={{
              display: "flex", alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: "0.5px solid rgba(254,252,248,0.1)",
              animation: `hsx-drawScore 0.4s ${EXPO} 0.58s both`,
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 12, color: "rgba(254,252,248,0.45)",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>Score</span>
              <span style={{
                fontFamily: SERIF, fontSize: 28, color: COPPER,
                fontStyle: "italic", lineHeight: 1,
              }}>4 <span style={{ fontSize: 16, color: "rgba(254,252,248,0.3)" }}>/ 10</span></span>
            </div>

            {/* STAR breakdown */}
            {[
              { label: "Situation", pass: true,  note: "stated clearly" },
              { label: "Task",      pass: false, note: "context missing" },
              { label: "Action",    pass: false, note: "3 steps, 2 explained" },
              { label: "Result",    pass: false, note: "no number, no baseline" },
            ].map(({ label, pass, note }, i) => (
              <div
                key={label}
                style={{
                  display: "flex", alignItems: "center",
                  gap: 10, marginBottom: 10,
                  animation: `hsx-revealLine 0.32s ${EXPO} ${0.68 + i * 0.08}s both`,
                }}
              >
                <span style={{
                  fontFamily: MONO, fontSize: 11,
                  color: pass ? "#6EBF8B" : "rgba(254,252,248,0.25)",
                  width: 14, flexShrink: 0,
                }}>
                  {pass ? "✓" : "✗"}
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 11,
                  color: "rgba(254,252,248,0.55)", width: 64, flexShrink: 0,
                }}>
                  {label}
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 11,
                  color: pass ? "rgba(254,252,248,0.55)" : "rgba(254,252,248,0.4)",
                }}>
                  {note}
                </span>
              </div>
            ))}

            {/* Fix line */}
            <div style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "0.5px solid rgba(254,252,248,0.1)",
              animation: `hsx-revealLine 0.35s ${EXPO} 1.04s both`,
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 10,
                color: COPPER, display: "block", marginBottom: 6,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>Fix</span>
              <span style={{
                fontFamily: MONO, fontSize: 12, lineHeight: 1.55,
                color: WHITE,
              }}>
                Add "...which cut onboarding time by 40%" after step 3.
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Mobile (390 × 820) ───────────────────────────────────────────── */
export function ComparisonMobile() {
  return (
    <div style={{
      width: 390, minHeight: 820,
      background: CREAM,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "56px 20px 72px",
      fontFamily: SANS,
    }}>
      <StyleTag />

      {/* Headline */}
      <h2 style={{
        fontFamily: SERIF, fontSize: 32, fontWeight: 400,
        color: COAL, margin: "0 0 16px",
        letterSpacing: "-0.02em", lineHeight: 1.15, textAlign: "center",
        animation: `hsx-slideUp 0.5s ${EXPO} 0.05s both`,
      }}>
        Practice that can't score you{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>isn't practice.</em>
      </h2>

      {/* Subhead */}
      <p style={{
        fontFamily: SANS, fontSize: 15, lineHeight: 1.6,
        color: INK, textAlign: "center", margin: "0 0 40px",
        animation: `hsx-slideUp 0.5s ${EXPO} 0.12s both`,
      }}>
        A senior's mock is hard to arrange. An AI session agrees with everything.
        Neither tells you where you lost the HR panel.
      </p>

      {/* Mobile: competitor cards compact, HireStepX card full */}

      {/* Competitor summary — two slim cards */}
      <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 16 }}>
        {[
          { label: "Senior mock", said: '"Pretty good. Work on communication."' },
          { label: "AI chatbot",  said: '"9/10. You\'re ready!"' },
        ].map(({ label, said }, i) => (
          <div key={label} style={{
            flex: 1,
            background: WHITE,
            border: `1px solid ${LINE}`,
            borderRadius: 12,
            padding: "16px 14px 18px",
            animation: `hsx-slideUp 0.45s ${EXPO} ${0.18 + i * 0.1}s both`,
          }}>
            <span style={{
              fontFamily: SANS, fontSize: 9, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: MUTED_TX, display: "block", marginBottom: 10,
            }}>{label}</span>
            <p style={{
              fontFamily: SERIF, fontSize: 13, lineHeight: 1.45,
              color: INK, margin: 0, fontStyle: "italic",
            }}>{said}</p>
          </div>
        ))}
      </div>

      {/* HireStepX card — full width, coal */}
      <div style={{
        width: "100%",
        background: COAL,
        borderRadius: 16,
        padding: "22px 20px 26px",
        boxShadow: "0 12px 40px rgba(14,12,8,0.24), 0 3px 10px rgba(14,12,8,0.14)",
        animation: `hsx-slideUp 0.55s ${EXPO} 0.38s both`,
      }}>
        <span style={{
          fontFamily: SANS, fontSize: 10, fontWeight: 700,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: COPPER, display: "block", marginBottom: 16,
        }}>HireStepX</span>

        <div style={{
          background: "rgba(254,252,248,0.05)",
          borderRadius: 10,
          padding: "16px 16px 18px",
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: MUTED_TX,
            textTransform: "uppercase", letterSpacing: "0.08em",
            display: "block", marginBottom: 12,
            animation: `hsx-revealLine 0.3s ${EXPO} 0.55s both`,
          }}>Q3 — Behaviour question</span>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 14, paddingBottom: 14,
            borderBottom: "0.5px solid rgba(254,252,248,0.1)",
            animation: `hsx-drawScore 0.4s ${EXPO} 0.65s both`,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(254,252,248,0.4)" }}>Score</span>
            <span style={{ fontFamily: SERIF, fontSize: 24, color: COPPER, fontStyle: "italic" }}>
              4 <span style={{ fontSize: 14, color: "rgba(254,252,248,0.3)" }}>/ 10</span>
            </span>
          </div>

          {[
            { label: "Situation", pass: true },
            { label: "Task",      pass: false },
            { label: "Action",    pass: false },
            { label: "Result",    pass: false },
          ].map(({ label, pass }, i) => (
            <div key={label} style={{
              display: "flex", gap: 8, marginBottom: 8,
              animation: `hsx-revealLine 0.28s ${EXPO} ${0.75 + i * 0.07}s both`,
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 10,
                color: pass ? "#6EBF8B" : "rgba(254,252,248,0.22)",
              }}>{pass ? "✓" : "✗"}</span>
              <span style={{
                fontFamily: MONO, fontSize: 10,
                color: "rgba(254,252,248,0.5)",
              }}>{label}</span>
            </div>
          ))}

          <div style={{
            marginTop: 14, paddingTop: 14,
            borderTop: "0.5px solid rgba(254,252,248,0.1)",
            animation: `hsx-revealLine 0.3s ${EXPO} 1.05s both`,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 9, color: COPPER,
              textTransform: "uppercase", letterSpacing: "0.08em",
              display: "block", marginBottom: 5,
            }}>Fix</span>
            <span style={{
              fontFamily: MONO, fontSize: 11, lineHeight: 1.55, color: WHITE,
            }}>
              Add "...which cut onboarding time by 40%" after step 3.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
