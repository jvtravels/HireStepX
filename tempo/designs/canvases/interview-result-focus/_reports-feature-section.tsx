/* HireStepX — "Personalized reports after every interview" marketing section
 *
 * 1728 × 1000px landing-page section.
 * Three stacked/fanned report screenshot cards (PNG placeholders — swap
 * <ReportScreenshot> with <img src="report-1.png" ... /> once PNGs are
 * exported). Serif headline + amber italic accent + body copy below.
 *
 * Font: Playfair Display (Google Fonts) for the headline serif.
 * Background: #FAF7F0 (brand cream). */

import React from "react";

/* ─── Approximate report screenshot (PNG placeholder) ───────── */

function ReportScreenshot() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#FEFDF8", overflow: "hidden" }}>
      {/* Readiness bar */}
      <div style={{
        background: "#FAF7F0",
        padding: "7px 14px",
        borderBottom: "1px solid #EAE3D0",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: "#6E6759" }}>READINESS</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#B45309" }}>51%</span>
        <span style={{ fontSize: 7, color: "#6E6759" }}>For Generic Senior Product Designer at Acme. ~13 weeks of focused prep to close the gap.</span>
      </div>

      {/* Chips */}
      <div style={{
        background: "#FEFDF8",
        padding: "5px 14px",
        borderBottom: "1px solid #EAE3D0",
        display: "flex",
        gap: 5,
        flexWrap: "wrap",
      }}>
        {[
          { icon: "●", text: "Acme  Company", color: "#15803D" },
          { icon: "<>", text: "Senior Product Designer  Role", color: "#6E6759" },
          { icon: "↑", text: "Generic  Level", color: "#6E6759" },
          { icon: "↓", text: "Standard  Difficulty", color: "#6E6759" },
        ].map((c, i) => (
          <span key={i} style={{ fontSize: 7, color: "#6E6759", display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ color: c.color }}>{c.icon}</span> {c.text}
          </span>
        ))}
      </div>

      {/* Score + verdict grid */}
      <div style={{ display: "flex", gap: 0, padding: "10px 14px" }}>
        {/* Left: gauge */}
        <div style={{ width: 130, flexShrink: 0 }}>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.5, color: "#6E6759", marginBottom: 5 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 84, height: 50, margin: "0 auto 6px" }}>
            <svg viewBox="0 0 84 52" width="84" height="52">
              <path d="M8,48 A36,36 0 0,1 76,48" fill="none" stroke="#E8E0D0" strokeWidth="7" strokeLinecap="round" />
              <path d="M8,48 A36,36 0 0,1 50,13" fill="none" stroke="#B91C1C" strokeWidth="7" strokeLinecap="round" />
            </svg>
            <div style={{
              position: "absolute", bottom: 2, left: 0, right: 0,
              textAlign: "center", fontSize: 20, fontWeight: 800, color: "#0E0C08",
              lineHeight: 1,
            }}>51</div>
            <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 7, color: "#9E9589" }}>/ 100</div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 6.5, background: "#FEE2E2", color: "#B91C1C", padding: "2px 5px", borderRadius: 3, fontWeight: 600 }}>No Hire</span>
            <span style={{ fontSize: 6.5, background: "#FEF3C7", color: "#92400E", padding: "2px 5px", borderRadius: 3 }}>⊙ Medium Confidence</span>
          </div>
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="28" height="12" viewBox="0 0 28 12">
              <polyline points="0,8 6,5 12,9 18,3 24,6" fill="none" stroke="#B91C1C" strokeWidth="1.2" />
            </svg>
            <span style={{ fontSize: 8, color: "#B91C1C", fontWeight: 700 }}>↓ 20</span>
          </div>
        </div>

        {/* Right: verdict */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 0.5, color: "#B45309", marginBottom: 3 }}>✦ AI INTERVIEW VERDICT</div>
          <div style={{ fontSize: 8.5, fontWeight: 600, color: "#0E0C08", marginBottom: 5, lineHeight: 1.35 }}>
            You negotiated with a clear target, but didn't leverage market data.
          </div>
          <div style={{
            fontSize: 6.5, background: "#F3EFE5", padding: "3px 6px", borderRadius: 3,
            color: "#6E6759", marginBottom: 7, display: "flex", gap: 4, alignItems: "center",
          }}>
            <span style={{ color: "#15803D" }}>+</span>
            <span>Calibrated to Generic — Strong Hire ≥ 85 — Hire ≥ 70 — Lean Hire ≥ 55</span>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div>
              <div style={{ fontSize: 6.5, fontWeight: 700, color: "#15803D", marginBottom: 3 }}>TOP STRENGTHS</div>
              <div style={{ fontSize: 7, color: "#0E0C08", display: "flex", gap: 3 }}>
                <span style={{ color: "#15803D" }}>✓</span> Clearly stated target salary
              </div>
            </div>
            <div>
              <div style={{ fontSize: 6.5, fontWeight: 700, color: "#B91C1C", marginBottom: 3 }}>TOP IMPROVEMENTS</div>
              <div style={{ fontSize: 7, color: "#0E0C08", marginBottom: 2 }}>⊘ Quantify the result with a percentage or dollar amount</div>
              <div style={{ fontSize: 7, color: "#0E0C08" }}>⊘ Consider multiple levers for negotiation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Negotiation section */}
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 14px 8px", background: "#FEFDF8" }}>
        <span style={{
          fontSize: 7, background: "#FED7AA", color: "#B45309",
          padding: "2px 8px", borderRadius: 20, fontWeight: 600,
        }}>SALARY NEGOTIATION · FULL REPORT</span>

        <div style={{
          fontSize: 12, fontWeight: 700, color: "#0E0C08", marginTop: 5,
          fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.25,
        }}>The full breakdown of your negotiation</div>
        <div style={{ fontSize: 7, color: "#6E6759", marginTop: 2 }}>
          Each panel below turns one negotiation skill into something you can act on, not a score.
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: "#B45309", letterSpacing: 0.5 }}>THE 30-SECOND READ</div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#0E0C08", marginTop: 3,
            lineHeight: 1.35, fontFamily: "Georgia, 'Times New Roman', serif",
          }}>
            You explored 0 offer points but didn't close. Part 2 has the email draft you can send to keep the conversation alive.
          </div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 7, color: "#6E6759" }}>
              How far you got<br />
              <span style={{ fontSize: 6.5 }}>you didn't push past the first offer. Part 2 has the email draft</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#B91C1C", textAlign: "right" }}>0 of 5 stages</div>
          </div>
        </div>
      </div>

      {/* Part 1 band */}
      <div style={{
        margin: "8px 14px 0",
        background: "#312E81",
        borderRadius: 6,
        padding: "6px 10px",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}>
        <span style={{
          fontSize: 7, background: "rgba(255,255,255,0.15)", color: "#fff",
          padding: "2px 6px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap",
        }}>PART 1 OF 4</span>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>What happened in this call</div>
          <div style={{ fontSize: 6.5, color: "rgba(255,255,255,0.65)" }}>Every moment that mattered: what you said, what you missed, what it cost.</div>
        </div>
      </div>

      {/* Phase ladder preview */}
      <div style={{ padding: "8px 14px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: "#0E0C08" }}>01  How far you got in the negotiation</div>
            <div style={{ fontSize: 6.5, color: "#6E6759", marginTop: 1 }}>A strong negotiation moves through 5 stages, from naming a counter all the way to closing.</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#B91C1C" }}>0</span>
            <span style={{ fontSize: 7, color: "#6E6759" }}> / 5<br />STAGES</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 2, marginBottom: 7 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ flex: 1, height: 3, background: i === 1 ? "#B91C1C" : "#E8E0D0", borderRadius: 2 }} />
          ))}
        </div>

        {[
          { num: 1, label: "You named a counter number", tag: "TRY THIS NEXT", tagColor: "#B45309", tagBg: "#FEF3C7" },
          { num: 2, label: "You justified your number", tag: "NOT REACHED", tagColor: "#9E9589", tagBg: "transparent" },
          { num: 3, label: "You handled their pushback", tag: "NOT REACHED", tagColor: "#9E9589", tagBg: "transparent" },
        ].map(row => (
          <div key={row.num} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "4px 0", borderTop: "1px solid #F0EDE3",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                background: row.num === 1 ? "#B45309" : "transparent",
                border: row.num === 1 ? "none" : "1px solid #D6CDB5",
                color: row.num === 1 ? "#fff" : "#9E9589",
                fontSize: 6.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>{row.num}</span>
              <span style={{ fontSize: 7, fontWeight: row.num === 1 ? 600 : 400, color: row.num === 1 ? "#0E0C08" : "#9E9589" }}>
                {row.label}
              </span>
            </div>
            <span style={{
              fontSize: 6.5, fontWeight: 600, color: row.tagColor,
              background: row.tagBg, padding: row.tagBg !== "transparent" ? "2px 6px" : 0, borderRadius: 3,
            }}>{row.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section component ──────────────────────────────────────── */

export function ReportsFeatureSection() {
  return (
    <div style={{
      width: 1728,
      height: 1000,
      background: "#FAF7F0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 52,
      overflow: "hidden",
      fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Instrument Serif — HireStepX brand display font (same as --font-display in layout.tsx) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
      `}</style>

      {/* ── Fan of 3 report screenshot cards ── */}
      <div style={{
        position: "relative",
        width: 1060,
        height: 420,
        flexShrink: 0,
        marginBottom: 52,
      }}>
        {/* Left card — rotated -7deg, behind center */}
        <div style={{
          position: "absolute",
          left: 80,
          top: 32,
          width: 360,
          height: 448,
          transform: "rotate(-7deg)",
          transformOrigin: "bottom center",
          zIndex: 1,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 20px 56px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)",
        }}>
          <ReportScreenshot />
        </div>

        {/* Center card — upright, largest, front */}
        <div style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          top: 0,
          width: 400,
          height: 500,
          zIndex: 3,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.10)",
        }}>
          <ReportScreenshot />
        </div>

        {/* Right card — rotated +7deg, behind center */}
        <div style={{
          position: "absolute",
          right: 80,
          top: 32,
          width: 360,
          height: 448,
          transform: "rotate(7deg)",
          transformOrigin: "bottom center",
          zIndex: 1,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 20px 56px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)",
        }}>
          <ReportScreenshot />
        </div>
      </div>

      {/* ── Headline + body copy ── */}
      <div style={{ textAlign: "center", userSelect: "none" }}>
        <h2 style={{
          fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
          fontSize: 76,
          fontWeight: 700,
          lineHeight: 1.05,
          color: "#0E0C08",
          margin: "0 0 8px",
          letterSpacing: -1.5,
        }}>
          Personalized reports after
        </h2>
        <h2 style={{
          fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
          fontSize: 76,
          fontWeight: 400,
          fontStyle: "italic",
          lineHeight: 1.05,
          color: "#B45309",
          margin: "0 0 28px",
          letterSpacing: -1,
        }}>
          every interview
        </h2>
        <p style={{
          fontSize: 18,
          lineHeight: 1.65,
          color: "#4A4540",
          margin: 0,
          fontWeight: 400,
        }}>
          HireStepX gives you personalized interview reports that show how you<br />
          performed, where you lost impact, and what to practice next.
        </p>
      </div>
    </div>
  );
}
