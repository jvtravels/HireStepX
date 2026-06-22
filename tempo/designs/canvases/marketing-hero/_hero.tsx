/* HireStepX — Marketing Hero  1728 × 1080px
 *
 * Deepnote-inspired structure:
 *   • 3 cards fanning full-width — side cards pushed near edges, partial bleed
 *   • Top-pivot rotation ±8deg — more dramatic than ±6deg
 *   • 280px bottom gradient dissolve
 *   • Italic serif annotation labels + ↓ arrows above each card
 *   • 92px two-line serif headline (coal + italic copper)
 *   • Subheadline + two CTA buttons (filled indigo + outline)
 */

import React, { useState } from "react";

/* ─── Brand tokens ────────────────────────────────────────────── */
const t = {
  cream:       "#FAF7F0",
  creamLight:  "#F4EFE3",
  creamCard:   "#FEFDFB",
  coal:        "#0E0C08",
  inkMid:      "#4A4540",
  inkFaint:    "#736B5D",
  indigo:      "#312E81",
  indigoDeep:  "#1E1B4B",
  indigoPale:  "#ECEAF8",
  copper:      "#B45309",
  copperPale:  "#FEF3C7",
  line:        "#EBE5D2",
  success:     "#15803D",
  successPale: "#DCFCE7",
};

const f = {
  serif: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  sans:  "'Satoshi', system-ui, -apple-system, sans-serif",
  mono:  "'JetBrains Mono', 'Fira Code', monospace",
};

/* ─── CSS ─────────────────────────────────────────────────────── */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes floatC {
  0%, 100% { transform: translateX(-50%) translateY(0px); }
  50%       { transform: translateX(-50%) translateY(-12px); }
}
@keyframes floatL {
  0%, 100% { transform: rotate(-8deg) translateY(0px); }
  50%       { transform: rotate(-8deg) translateY(-9px); }
}
@keyframes floatR {
  0%, 100% { transform: rotate(8deg) translateY(0px); }
  50%       { transform: rotate(8deg) translateY(-9px); }
}
@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}
@keyframes cursor {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.a3 { animation: fadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.10s both; }
.a4 { animation: fadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.28s both; }
.a5 { animation: fadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.44s both; }
.a6 { animation: fadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.58s both; }
.a7 { animation: fadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.72s both; }

.fl { animation: floatL 5.4s ease-in-out 0.2s infinite; transition: transform 0.48s cubic-bezier(0.16,1,0.3,1), z-index 0s, box-shadow 0.48s ease, opacity 0.35s ease; }
.fc { animation: floatC 6.0s ease-in-out 0.6s infinite; transition: transform 0.48s cubic-bezier(0.16,1,0.3,1), z-index 0s, box-shadow 0.48s ease, opacity 0.35s ease; }
.fr { animation: floatR 5.7s ease-in-out 1.0s infinite; transition: transform 0.48s cubic-bezier(0.16,1,0.3,1), z-index 0s, box-shadow 0.48s ease, opacity 0.35s ease; }
.fl.hov { animation: none; }
.fc.hov { animation: none; }
.fr.hov { animation: none; }
.card-wrap { transition: transform 0.48s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease; }

.live  { animation: livePulse 1.8s ease-in-out infinite; }
.caret { animation: cursor 1s step-end infinite; display: inline-block;
         width: 1.5px; height: 13px; background: #312E81;
         margin-left: 2px; vertical-align: middle; }
`;

/* ─── Card: Interview session (left, -8deg) ─────────────────── */
/* ─── Shared mini-chip row ────────────────────────────────────── */
function ChipRow({ chips }: { chips: { icon: string; text: string; color?: string }[] }) {
  return (
    <div style={{
      background: "#FEFDF8", padding: "5px 14px",
      borderBottom: "1px solid #EAE3D0",
      display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
    }}>
      {chips.map((c, i) => (
        <span key={i} style={{ fontSize: 7, color: "#6E6759", display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ color: c.color ?? "#6E6759" }}>{c.icon}</span> {c.text}
        </span>
      ))}
    </div>
  );
}

/* ─── Card: Behavioral — left ──── */
function InterviewCard({ lifted }: { lifted?: boolean }) {
  const skills = [
    { label: "STAR coherence",   score: 88, c: "#15803D" },
    { label: "Outcome clarity",  score: 88, c: "#15803D" },
    { label: "Ownership voice",  score: 71, c: "#B45309" },
    { label: "Conflict balance", score: 42, c: "#B91C1C" },
  ];
  return (
    <div style={{ width: 460, background: "#FEFDF8", borderRadius: 16, border: "1px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 32px 96px rgba(14,12,8,0.28), 0 8px 24px rgba(14,12,8,0.12)" : "0 8px 48px rgba(14,12,8,0.12), 0 2px 8px rgba(14,12,8,0.06)", overflow: "hidden", fontFamily: f.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: "#FAF7F0", padding: "9px 16px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6, color: "#6E6759" }}>READINESS</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#15803D" }}>68%</span>
        <span style={{ fontSize: 8, color: "#6E6759" }}>Razorpay Senior PD · ~3 sessions to close gap</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "14px 16px 12px" }}>
        <div style={{ width: 124, flexShrink: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: "#6E6759", marginBottom: 6 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 84, height: 52, margin: "0 auto 8px" }}>
            <svg viewBox="0 0 80 50" width="84" height="52">
              <path d="M7,46 A33,33 0 0,1 73,46" fill="none" stroke="#E8E0D0" strokeWidth="7" strokeLinecap="round" />
              <path d="M7,46 A33,33 0 0,1 61,17" fill="none" stroke="#15803D" strokeWidth="7" strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 800, color: "#0E0C08", lineHeight: 1 }}>82</div>
            <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: "#9E9589" }}>/ 100</div>
          </div>
          <span style={{ fontSize: 7.5, background: "#DCFCE7", color: "#15803D", padding: "2px 7px", borderRadius: 3, fontWeight: 600 }}>Hire ✓</span>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="28" height="12" viewBox="0 0 28 12"><polyline points="0,10 5,7 10,9 16,4 22,6 28,2" fill="none" stroke="#15803D" strokeWidth="1.2" /></svg>
            <span style={{ fontSize: 9, color: "#15803D", fontWeight: 700 }}>↑ 6</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: "#B45309", marginBottom: 5 }}>✦ AI INTERVIEW VERDICT</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#0E0C08", lineHeight: 1.5, marginBottom: 9 }}>Specific, owned, outcome-anchored. Tighten the Q2 "we" usage — then you're ready for the bar-raiser.</div>
          <div style={{ fontSize: 7.5, background: "#F3EFE5", padding: "4px 8px", borderRadius: 3, color: "#6E6759" }}>
            Calibrated to Senior · Strong ≥ 85 · Hire ≥ 70 · Lean ≥ 55
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 16px 8px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8, background: "#E5E2F2", color: "#312E81", padding: "3px 9px", borderRadius: 20, fontWeight: 600 }}>BEHAVIORAL INTERVIEW · FULL REPORT</span>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0E0C08", marginTop: 7, fontFamily: f.serif, lineHeight: 1.25 }}>The full breakdown of your behavioral answers</div>
        <div style={{ fontSize: 8, color: "#6E6759", marginTop: 3 }}>Each panel turns one STAR skill into something you can rehearse.</div>
      </div>
      <div style={{ margin: "10px 16px 0", background: "#312E81", borderRadius: 6, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 8, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 7px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 1 OF 3</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>Skill breakdown</div>
          <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)" }}>Where each axis landed and what it means for your prep.</div>
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        {skills.map(s => (
          <div key={s.label} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 8.5, color: "#4A4540" }}>{s.label}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: s.c, fontFamily: f.mono }}>{s.score}</span>
            </div>
            <div style={{ height: 4, background: "#EBE5D2", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.score}%`, background: s.c, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Card: Salary neg — center ── */
function ReportCard({ lifted }: { lifted?: boolean }) {
  const phases = [
    { n: 1, label: "Named a counter number",     },
    { n: 2, label: "Justified with market data", },
    { n: 3, label: "Closed at ₹48L target",      },
  ];
  return (
    <div style={{ width: 520, background: "#FEFDF8", borderRadius: 18, border: "1.5px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 56px 160px rgba(14,12,8,0.34), 0 16px 48px rgba(14,12,8,0.16)" : "0 48px 140px rgba(14,12,8,0.26), 0 12px 40px rgba(14,12,8,0.12)", overflow: "hidden", fontFamily: f.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: "#FAF7F0", padding: "10px 18px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: "#6E6759" }}>READINESS</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#15803D" }}>84%</span>
        <span style={{ fontSize: 8.5, color: "#6E6759" }}>PhonePe Senior EM · Top quartile, ready to negotiate.</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "16px 18px 14px" }}>
        <div style={{ width: 144, flexShrink: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, color: "#6E6759", marginBottom: 7 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 92, height: 56, margin: "0 auto 9px" }}>
            <svg viewBox="0 0 90 56" width="92" height="56">
              <path d="M8,52 A37,37 0 0,1 82,52" fill="none" stroke="#E8E0D0" strokeWidth="8" strokeLinecap="round" />
              <path d="M8,52 A37,37 0 0,1 69,18" fill="none" stroke="#15803D" strokeWidth="8" strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 25, fontWeight: 800, color: "#0E0C08", lineHeight: 1 }}>84</div>
            <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "#9E9589" }}>/ 100</div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, background: "#DCFCE7", color: "#15803D", padding: "3px 7px", borderRadius: 3, fontWeight: 600 }}>Strong Hire ✓</span>
          </div>
          <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="30" height="13" viewBox="0 0 30 13"><polyline points="0,11 5,8 10,10 16,4 22,6 30,2" fill="none" stroke="#15803D" strokeWidth="1.3" /></svg>
            <span style={{ fontSize: 9.5, color: "#15803D", fontWeight: 700 }}>↑ 19</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, color: "#B45309", marginBottom: 6 }}>✦ AI NEGOTIATION VERDICT</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#0E0C08", lineHeight: 1.5, marginBottom: 10 }}>Countered with data, held silence twice, closed at ₹48L — 71% gap closure on the first-offer anchor.</div>
          <div style={{ fontSize: 8, background: "#F3EFE5", padding: "4px 8px", borderRadius: 3, color: "#6E6759" }}>
            Calibrated to Senior EM · Strong ≥ 85 · Hire ≥ 70 · Lean ≥ 55
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 18px 8px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8.5, background: "#FED7AA", color: "#B45309", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>SALARY NEGOTIATION · FULL REPORT</span>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0E0C08", marginTop: 7, fontFamily: f.serif, lineHeight: 1.25 }}>The full breakdown of your negotiation</div>
        <div style={{ fontSize: 8.5, color: "#6E6759", marginTop: 3 }}>Each panel turns one negotiation skill into something you can act on.</div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: "#B45309", letterSpacing: 0.4 }}>THE 30-SECOND READ</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0E0C08", marginTop: 4, lineHeight: 1.35, fontFamily: f.serif }}>
            Landed ₹48L — ₹10L above opening. 71% gap closure in 3 rounds.
          </div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 8.5, color: "#6E6759" }}>How far you got in the negotiation</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#15803D" }}>3 of 3 stages</span>
          </div>
        </div>
      </div>
      <div style={{ margin: "10px 18px 0", background: "#312E81", borderRadius: 7, padding: "9px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 8.5, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "3px 8px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 1 OF 4</span>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#fff" }}>What happened in this call</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.65)" }}>Every moment that mattered: what you said, what you missed, what it cost.</div>
        </div>
      </div>
      <div style={{ padding: "10px 18px 14px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#0E0C08", marginBottom: 6 }}>01  How far you got in the negotiation</div>
        <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
          {phases.map(p => (
            <div key={p.n} style={{ flex: 1, height: 4, background: "#15803D", borderRadius: 2 }} />
          ))}
        </div>
        {phases.map(p => (
          <div key={p.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: "1px solid #F0EDE3" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 17, height: 17, borderRadius: "50%", background: "#15803D", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.n}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: "#0E0C08" }}>{p.label}</span>
            </div>
            <span style={{ fontSize: 8, fontWeight: 600, color: "#15803D", background: "#DCFCE7", padding: "2px 7px", borderRadius: 3 }}>DONE ✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Card: Campus placement — right ── */
function ProgressCard({ lifted }: { lifted?: boolean }) {
  const skills = [
    { label: "Communication",     score: 75, c: "#15803D" },
    { label: "Fundamentals",      score: 70, c: "#15803D" },
    { label: "Project ownership", score: 45, c: "#B91C1C" },
    { label: "Project depth",     score: 40, c: "#B91C1C" },
  ];
  return (
    <div style={{ width: 460, background: "#FEFDF8", borderRadius: 16, border: "1px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 32px 96px rgba(14,12,8,0.28), 0 8px 24px rgba(14,12,8,0.12)" : "0 8px 48px rgba(14,12,8,0.12), 0 2px 8px rgba(14,12,8,0.06)", overflow: "hidden", fontFamily: f.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: "#FAF7F0", padding: "9px 16px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6, color: "#6E6759" }}>READINESS</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#B45309" }}>42%</span>
        <span style={{ fontSize: 8, color: "#6E6759" }}>Infosys SWE Fresher · ~5 sessions to close gap</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "14px 16px 12px" }}>
        <div style={{ width: 124, flexShrink: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: "#6E6759", marginBottom: 6 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 84, height: 52, margin: "0 auto 8px" }}>
            <svg viewBox="0 0 80 50" width="84" height="52">
              <path d="M7,46 A33,33 0 0,1 73,46" fill="none" stroke="#E8E0D0" strokeWidth="7" strokeLinecap="round" />
              <path d="M7,46 A33,33 0 0,1 42,14" fill="none" stroke="#B45309" strokeWidth="7" strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 800, color: "#0E0C08", lineHeight: 1 }}>58</div>
            <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: "#9E9589" }}>/ 100</div>
          </div>
          <span style={{ fontSize: 7.5, background: "#FEF3C7", color: "#92400E", padding: "2px 7px", borderRadius: 3, fontWeight: 600 }}>Lean Hire</span>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="28" height="12" viewBox="0 0 28 12"><polyline points="0,4 5,7 10,5 16,10 22,8 28,12" fill="none" stroke="#B91C1C" strokeWidth="1.2" /></svg>
            <span style={{ fontSize: 9, color: "#B91C1C", fontWeight: 700 }}>↓ 8</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: "#B45309", marginBottom: 5 }}>✦ AI CAMPUS VERDICT</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#0E0C08", lineHeight: 1.5, marginBottom: 8 }}>Enthusiasm came through. Project section drifted to "we" — distinguish your individual contribution.</div>
          <div style={{ fontSize: 8, background: "#FEE2E2", padding: "4px 8px", borderRadius: 3, color: "#7F1D1D", fontWeight: 600 }}>
            ⚠ RED FLAG: "we built the backend" — vague project role
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 16px 8px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8, background: "#FEF3C7", color: "#92400E", padding: "3px 9px", borderRadius: 20, fontWeight: 600 }}>CAMPUS PLACEMENT · FULL REPORT</span>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0E0C08", marginTop: 7, fontFamily: f.serif, lineHeight: 1.25 }}>The full breakdown of your campus interview</div>
        <div style={{ fontSize: 8, color: "#6E6759", marginTop: 3 }}>Each panel turns one campus skill into something you can rehearse.</div>
      </div>
      <div style={{ margin: "10px 16px 0", background: "#312E81", borderRadius: 6, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 8, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 7px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 1 OF 3</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>Skill breakdown</div>
          <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)" }}>Where each axis landed and what to practice next.</div>
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        {skills.map(s => (
          <div key={s.label} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 8.5, color: "#4A4540" }}>{s.label}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: s.c, fontFamily: f.mono }}>{s.score}</span>
            </div>
            <div style={{ height: 4, background: "#EBE5D2", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.score}%`, background: s.c, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────── */
export function HireStepXHero() {
  const [hov, setHov] = useState<"left" | "center" | "right" | null>(null);

  /* Compute per-card wrapper style based on which card is hovered */
  /* Always-present transition — ensures both enter AND leave are smooth */
  const TR = "transform 0.50s cubic-bezier(0.16,1,0.3,1), opacity 0.38s ease, filter 0.50s ease";

  const lActive  = hov === "left";
  const cActive  = hov === "center";
  const rActive  = hov === "right";
  const anyHov   = hov !== null;

  const leftStyle: React.CSSProperties = {
    position: "absolute", left: 220, bottom: 60,
    transformOrigin: "bottom center",
    transform: lActive  ? "rotate(0deg) translateY(-30px) scale(1.08)"
             : anyHov   ? "rotate(-10deg) translateY(6px) scale(0.86)"
             :             "rotate(-8deg)",
    zIndex:   lActive ? 12 : anyHov ? 2 : 3,
    opacity:  anyHov && !lActive ? 0.65 : 1,
    filter:   anyHov && !lActive ? "brightness(0.92) saturate(0.2)" : "none",
    transition: TR,
  };

  const centerStyle: React.CSSProperties = {
    position: "absolute", left: "50%", bottom: 60,
    transform: cActive  ? "translateX(-50%) translateY(-30px) scale(1.08)"
             : anyHov   ? "translateX(-50%) translateY(6px) scale(0.86)"
             :             "translateX(-50%)",
    zIndex:   cActive ? 12 : anyHov ? 4 : 5,
    opacity:  anyHov && !cActive ? 0.65 : 1,
    filter:   anyHov && !cActive ? "brightness(0.92) saturate(0.2)" : "none",
    transition: TR,
  };

  const rightStyle: React.CSSProperties = {
    position: "absolute", right: 220, bottom: 60,
    transformOrigin: "bottom center",
    transform: rActive  ? "rotate(0deg) translateY(-30px) scale(1.08)"
             : anyHov   ? "rotate(10deg) translateY(6px) scale(0.86)"
             :             "rotate(8deg)",
    zIndex:   rActive ? 12 : anyHov ? 2 : 3,
    opacity:  anyHov && !rActive ? 0.65 : 1,
    filter:   anyHov && !rActive ? "brightness(0.92) saturate(0.2)" : "none",
    transition: TR,
  };

  return (
    <div style={{
      width: 1728, height: 1080,
      background: t.cream,
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: f.sans,
    }}>
      <style>{STYLES}</style>

      {/* ── Fan card showcase ── */}
      <div className="a3" style={{
        position: "relative",
        width: 1728,
        height: 580,
        flexShrink: 0,
        clipPath: "inset(-160px -60px 0 -60px)",
      }}>
        {/* Left card — annotation lives inside so it moves with the card */}
        <div
          style={leftStyle}
          onMouseEnter={() => setHov("left")}
          onMouseLeave={() => setHov(null)}
        >
          <div style={{
            position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)",
            textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none",
            fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif", fontWeight: 400, fontSize: 12, color: "#9E9589", lineHeight: 1.4,
            opacity: hov !== null ? 0 : 1,
            transition: "opacity 0.30s ease",
          }}>
            Behavioral · 82/100<br />Razorpay Senior PD
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: "#9E9589" }}>↓</div>
          </div>
          <InterviewCard lifted={lActive} />
        </div>

        {/* Center card — annotation lives inside so it moves with the card */}
        <div
          style={centerStyle}
          onMouseEnter={() => setHov("center")}
          onMouseLeave={() => setHov(null)}
        >
          <div style={{
            position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)",
            textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none",
            fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif", fontWeight: 400, fontSize: 12, color: "#9E9589", lineHeight: 1.4,
            opacity: hov !== null ? 0 : 1,
            transition: "opacity 0.30s ease",
          }}>
            Salary Neg · ₹48L landed<br />PhonePe Senior EM
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: "#9E9589" }}>↓</div>
          </div>
          <ReportCard lifted={cActive} />
        </div>

        {/* Right card — annotation lives inside so it moves with the card */}
        <div
          style={rightStyle}
          onMouseEnter={() => setHov("right")}
          onMouseLeave={() => setHov(null)}
        >
          <div style={{
            position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)",
            textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none",
            fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif", fontWeight: 400, fontSize: 12, color: "#9E9589", lineHeight: 1.4,
            opacity: hov !== null ? 0 : 1,
            transition: "opacity 0.30s ease",
          }}>
            Campus · 58/100<br />Infosys SWE Fresher
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: "#9E9589" }}>↓</div>
          </div>
          <ProgressCard lifted={rActive} />
        </div>

        {/* Bottom fade */}
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: 360,
          background: `linear-gradient(to bottom, transparent 0%, ${t.cream} 70%)`,
          zIndex: 15,
          pointerEvents: "none",
        }} />
      </div>

      {/* ── Headline ── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 0, flexShrink: 0, marginTop: -80,
      }}>
        <h1 className="a4" style={{
          fontFamily: f.serif, fontSize: 92, fontWeight: 400,
          lineHeight: 1.05, color: t.coal,
          margin: "0 0 4px", textAlign: "center", letterSpacing: -2.5,
        }}>
          Personalized reports after
        </h1>
        <h1 className="a5" style={{
          fontFamily: f.serif, fontSize: 92, fontWeight: 400,
          fontStyle: "italic", lineHeight: 1.05, color: t.copper,
          margin: "0 0 24px", textAlign: "center", letterSpacing: -1.5,
        }}>
          every interview
        </h1>
        <p className="a6" style={{
          fontSize: 15, lineHeight: 1.7,
          color: t.inkMid, textAlign: "center",
          margin: 0, maxWidth: 720, fontWeight: 400,
        }}>
          HireStepX gives you a full breakdown after every interview — what landed,
          what to sharpen, and your exact next practice session.
        </p>
      </div>

    </div>
  );
}
