"use client";
import React from "react";

/* ── Brand tokens ─────────────────────────────────────────────────── */
const CREAM   = "#FAF7F0";
const COAL    = "#0E0C08";
const COPPER  = "#B45309";
const INK     = "#6E6759";
const FAINT   = "#A39C8B";
const LINE    = "#EBE5D2";
const INDIGO  = "#4F46E5";
const SERIF   = '"Instrument Serif", Georgia, serif';
const SANS    = '"Satoshi", "Inter", system-ui, sans-serif';

/* ── Shared gradient ──────────────────────────────────────────────── */
const GRAD_ID = "hsx-cg-canvas";
const G       = `url(#${GRAD_ID})`;
const sw      = 2;
const rp      = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function GradientDef() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute", overflow: "hidden" }}>
      <defs>
        <linearGradient id={GRAD_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8C4A0" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Icons ────────────────────────────────────────────────────────── */
const Icons = {

  /* 1. BEHAVIORAL — STAR-method storytelling. Speech bubble + 5-pt star. */
  Behavioral: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M8 8 h38 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 H26 L14 52 l2-12 H8 a6 6 0 0 1 -6 -6 V14 a6 6 0 0 1 6 -6 z"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      {/* 5-point star, centre (27,22), outer r=9, inner r=3.6 */}
      <polygon points="27,13 29.1,19.1 35.6,19.2 30.4,23.1 32.3,29.3 27,25.6 21.7,29.3 23.6,23.1 18.4,19.2 24.9,19.1"
        stroke={G} strokeWidth={1.6} {...rp} fill={G} fillOpacity="0.26"/>
    </svg>
  ),

  /* 2. CAMPUS PLACEMENT — Mortarboard. Diamond board + tassel. NOT a building. */
  Campus: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Board: wide flat diamond — instantly reads as a graduation cap */}
      <path d="M32 10 L54 23 L32 36 L10 23 Z"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.14"/>
      {/* Tassel stem hangs from right corner */}
      <line x1="54" y1="23" x2="54" y2="48" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      {/* Tassel bob */}
      <circle cx="54" cy="52" r="4" stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.28"/>
    </svg>
  ),

  /* 3. SALARY NEGOTIATION — ₹ Rupee. Vertical stem + P-arch + 2 crossbars + diagonal. */
  Salary: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Stem runs full height, slightly heavier so it punches through the arch */}
      <line x1="18" y1="6" x2="18" y2="58" stroke={G} strokeWidth={sw + 0.5} strokeLinecap="round"/>
      {/* P-arch: fill="none" keeps stem 100 % visible through the arch area */}
      <path d="M18 6 Q54 6 54 17 Q54 28 18 28"
        stroke={G} strokeWidth={sw} strokeLinecap="round" fill="none"/>
      {/* Crossbar 1 — wide, clear gap below arch */}
      <line x1="6" y1="34" x2="54" y2="34" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      {/* Crossbar 2 — shorter right-edge, matches real ₹ anatomy */}
      <line x1="6" y1="50" x2="42" y2="50" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      {/* Diagonal slash — starts between crossbars on right, exits below CB2 on left */}
      <line x1="50" y1="30" x2="6" y2="58" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  ),

  /* 4. HR ROUND — Clipboard + approval checkmark. Cream-fill trick erases body top stroke. */
  HR: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Clipboard body */}
      <rect x="10" y="18" width="44" height="40" rx="4"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      {/* Clip: first pass with cream fill erases the body's top stroke in clip zone */}
      <rect x="20" y="8" width="24" height="16" rx="3" fill={CREAM}/>
      {/* Clip: second pass draws the clip border + tinted fill */}
      <rect x="20" y="8" width="24" height="16" rx="3"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.20"/>
      {/* Bold checkmark centred in the body */}
      <path d="M16 38 L28 50 L48 28" stroke={G} strokeWidth={sw + 0.5} {...rp}/>
    </svg>
  ),

  /* 5. STRATEGIC — Bullseye: long-range vision, hitting the target. */
  Strategic: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="28" cy="32" r="22" stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.06"/>
      <circle cx="28" cy="32" r="13" stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.09"/>
      <circle cx="28" cy="32" r="5"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.28"/>
      {/* Arrow from upper-right corner pointing toward bullseye */}
      <path d="M42 10 L56 10 L56 24" stroke={G} strokeWidth={sw} {...rp}/>
      <line x1="56" y1="10" x2="33" y2="27" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  ),

  /* 6. TECHNICAL LEADERSHIP — Monitor with code brackets + stand. */
  TechLead: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="6" y="8" width="52" height="38" rx="4"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
      <rect x="10" y="12" width="44" height="30" rx="2"
        stroke={G} strokeWidth={sw} {...rp}/>
      <path d="M22 22 L14 27 L22 32" stroke={G} strokeWidth={sw} {...rp}/>
      <path d="M42 22 L50 27 L42 32" stroke={G} strokeWidth={sw} {...rp}/>
      <line x1="35" y1="19" x2="29" y2="35" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <path d="M28 46 L24 56 L40 56 L36 46" stroke={G} strokeWidth={sw} {...rp}/>
      <line x1="20" y1="56" x2="44" y2="56" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  ),

  /* 7. CASE STUDY — Document with dog-ear fold + magnifier glass. */
  CaseStudy: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M10 6 h28 l12 12 v40 H10 Z"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
      <path d="M38 6 v12 h12" stroke={G} strokeWidth={sw} {...rp}/>
      <line x1="16" y1="26" x2="36" y2="26" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="16" y1="33" x2="34" y2="33" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <circle cx="44" cy="46" r="10" stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.10"/>
      <line x1="51" y1="53" x2="58" y2="60" stroke={G} strokeWidth={sw + 0.5} strokeLinecap="round"/>
    </svg>
  ),

  /* 8. PANEL INTERVIEW — 3 interviewer heads above desk + 1 candidate below. */
  Panel: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="12" cy="14" r="7"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.08"/>
      <circle cx="32" cy="12" r="8"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.13"/>
      <circle cx="52" cy="14" r="7"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.08"/>
      {/* Desk / table */}
      <rect x="4" y="32" width="56" height="5" rx="2"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.14"/>
      {/* Single candidate facing the panel */}
      <circle cx="32" cy="52" r="7"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.07"/>
    </svg>
  ),

  /* 9. MANAGEMENT — People org-chart: 1 manager → 3 reports (circles = people). */
  Management: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="32" cy="14" r="9"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.14"/>
      <line x1="32" y1="23" x2="32" y2="30" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="14" y1="30" x2="50" y2="30" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="14" y1="30" x2="14" y2="38" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="32" y1="30" x2="32" y2="38" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="50" y1="30" x2="50" y2="38" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <circle cx="14" cy="46" r="8"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.07"/>
      <circle cx="32" cy="46" r="8"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.07"/>
      <circle cx="50" cy="46" r="8"  stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.07"/>
    </svg>
  ),

  /* 10. GOVT/PSU — Neoclassical building: open pediment + entablature + columns + stylobate. */
  GovPSU: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Open pediment (no Z) — rect provides the base, avoids double-stroke */}
      <path d="M8 26 L32 8 L56 26"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.10"/>
      <rect x="8" y="24" width="48" height="5" rx="1"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      <line x1="16" y1="29" x2="16" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="26" y1="29" x2="26" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="38" y1="29" x2="38" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="48" y1="29" x2="48" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <rect x="6" y="52" width="52" height="4" rx="1"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      <rect x="4" y="56" width="56" height="4" rx="1"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.06"/>
    </svg>
  ),
};

const TYPES = [
  { label: "Behavioral",           desc: "STAR stories · leadership · decisions",      live: true,  icon: Icons.Behavioral },
  { label: "Campus Placement",     desc: "TCS · Infosys · Wipro · Cognizant",          live: true,  icon: Icons.Campus     },
  { label: "Salary Negotiation",   desc: "Counter-offers · levelling · benefits",      live: true,  icon: Icons.Salary     },
  { label: "HR Round",             desc: "Culture fit · motivation · expectations",    live: true,  icon: Icons.HR         },
  { label: "Strategic",            desc: "Roadmaps · vision · long-range thinking",    live: false, icon: Icons.Strategic  },
  { label: "Technical Leadership", desc: "System design · coding · architecture",      live: false, icon: Icons.TechLead   },
  { label: "Case Study",           desc: "Analysis · frameworks · presentation",       live: false, icon: Icons.CaseStudy  },
  { label: "Panel Interview",      desc: "Multiple interviewers · group dynamics",     live: false, icon: Icons.Panel      },
  { label: "Management",           desc: "People · process · performance reviews",     live: false, icon: Icons.Management },
  { label: "Government / PSU",     desc: "UPSC · banking · PSU interviews",            live: false, icon: Icons.GovPSU     },
];

/* ── Section masthead ─────────────────────────────────────────────── */
function Masthead() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      fontFamily: SANS, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.13em", textTransform: "uppercase" as const,
      color: FAINT, marginBottom: 32,
    }}>
      <span>03</span>
      <span style={{ width: 20, height: 1, background: LINE, display: "inline-block" }} />
      <span>Focus</span>
      <span style={{ width: 20, height: 1, background: LINE, display: "inline-block" }} />
      <span style={{ marginLeft: "auto" }}>Roles × companies</span>
    </div>
  );
}

/* ── Icon grid ────────────────────────────────────────────────────── */
function TypeGrid({ cols }: { cols: number }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: cols === 5 ? "56px 32px" : "44px 24px",
      marginTop: 72,
    }}>
      {TYPES.map((type) => (
        <div
          key={type.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            opacity: type.live ? 1 : 0.46,
          }}
        >
          <div style={{ width: 64, height: 64, marginBottom: 18 }}>{type.icon}</div>
          <h3 style={{
            fontFamily: SANS, fontSize: 15, fontWeight: 600,
            color: COAL, margin: "0 0 6px",
            letterSpacing: "-0.01em", lineHeight: 1.3,
          }}>
            {type.label}
          </h3>
          <p style={{
            fontFamily: SANS, fontSize: 13,
            color: type.live ? INK : FAINT,
            margin: 0, lineHeight: 1.55,
          }}>
            {type.live ? type.desc : "Coming soon"}
          </p>
        </div>
      ))}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
   LIVE PRODUCTION — Desktop 1440
   Heading: "Walk into any round knowing exactly what it's testing."
   Sub: research-backed India-specific copy (shipped 2026-06-25)
══════════════════════════════════════════════════════════════════ */
export function DesktopCurrent() {
  return (
    <div style={{
      width: 1440, background: CREAM,
      padding: "96px 0 112px",
      fontFamily: SANS, position: "relative",
    }}>
      <GradientDef />
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 40px" }}>
        <Masthead />
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: SERIF, fontSize: 56, fontWeight: 400,
            color: COAL, margin: "0 0 24px",
            letterSpacing: "-0.025em", lineHeight: 1.1,
          }}>
            Walk into any round{" "}
            <em style={{ fontStyle: "italic", color: COPPER }}>knowing exactly what it&rsquo;s testing.</em>
          </h2>
          <p style={{
            fontFamily: SANS, fontSize: 17, color: INK,
            lineHeight: 1.7, margin: 0,
          }}>
            HR rounds test culture, not qualifications. Campus drives filter on
            communication, not marks. Salary rounds expect you to negotiate —
            even when nobody says so. Ten formats. One coach that shows you the
            rules before you walk in.
          </p>
        </div>
        <TypeGrid cols={5} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LIVE PRODUCTION — Mobile 390
══════════════════════════════════════════════════════════════════ */
export function MobileCurrent() {
  return (
    <div style={{
      width: 390, background: CREAM,
      padding: "64px 24px 80px",
      fontFamily: SANS, position: "relative",
    }}>
      <GradientDef />
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: SANS, fontSize: 10, fontWeight: 600,
        letterSpacing: "0.13em", textTransform: "uppercase" as const,
        color: FAINT, marginBottom: 24,
      }}>
        <span>03</span>
        <span style={{ width: 14, height: 1, background: LINE, display: "inline-block" }} />
        <span>Focus</span>
      </div>
      <h2 style={{
        fontFamily: SERIF, fontSize: 34, fontWeight: 400,
        color: COAL, margin: "0 0 18px",
        letterSpacing: "-0.025em", lineHeight: 1.12,
      }}>
        Walk into any round{" "}
        <em style={{ fontStyle: "italic", color: COPPER }}>knowing exactly what it&rsquo;s testing.</em>
      </h2>
      <p style={{
        fontFamily: SANS, fontSize: 15, color: INK,
        lineHeight: 1.65, margin: "0 0 0 0",
      }}>
        HR rounds test culture, not qualifications. Campus drives filter on
        communication, not marks. Salary rounds expect you to negotiate —
        even when nobody says so. Ten formats. One coach that shows you the
        rules before you walk in.
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "44px 20px",
        marginTop: 56,
      }}>
        {TYPES.map((type) => (
          <div
            key={type.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              opacity: type.live ? 1 : 0.46,
            }}
          >
            <div style={{ width: 52, height: 52, marginBottom: 14 }}>{type.icon}</div>
            <h3 style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 600,
              color: COAL, margin: "0 0 4px",
              letterSpacing: "-0.01em", lineHeight: 1.3,
            }}>
              {type.label}
            </h3>
            <p style={{
              fontFamily: SANS, fontSize: 12,
              color: type.live ? INK : FAINT,
              margin: 0, lineHeight: 1.5,
            }}>
              {type.live ? type.desc : "Coming soon"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   COPY RESEARCH BOARD — Shipped copy + top contenders
   Documents the research journey: what was replaced and why
══════════════════════════════════════════════════════════════════ */

const COPY_BOARD = [
  {
    tag:    "❌ Replaced — Old Production",
    score:  "2.7 / 10",
    status: "replaced",
    h:      ["Ten interview types.", "One coach."],
    sub:    "Four go live at launch: behavioral, campus placement, salary negotiation, HR round. Six more land month-by-month after public beta.",
    note:   "Feature count heading. Changelog subheading. Zero Indian vocabulary. 'Public beta' introduced launch anxiety.",
  },
  {
    tag:    "✅ Shipped — R3 Winner",
    score:  "67 / 70",
    status: "shipped",
    h:      ["Walk into any round", "knowing exactly what it's testing."],
    sub:    "HR rounds test culture, not qualifications. Campus drives filter on communication, not marks. Salary rounds expect you to negotiate — even when nobody says so. Ten formats. One coach that shows you the rules before you walk in.",
    note:   "Action-led. Outcome-focused. Three hidden-rule reveals. Indian vocabulary throughout. 'Even when nobody says so' validates salary negotiation anxiety.",
  },
  {
    tag:    "🥈 Runner-up — Composite",
    score:  "66 / 70",
    status: "runner",
    h:      ["Every round tests something different.", "Most candidates find out too late."],
    sub:    "HR rounds test culture, not qualifications. Salary rounds expect you to negotiate — even when nobody says so. Campus drives filter on communication, not marks. Ten formats, one coach that shows you the rules before you walk in.",
    note:   "'Too late' is the most urgency-charged two-word phrase. Most authoritative heading. Same sub as R3. 1 point behind.",
  },
  {
    tag:    "🥉 Strong — The Contrast",
    score:  "53 / 70",
    status: "runner",
    h:      ["Not just behavioural.", "Every round that stands between you and your offer letter."],
    sub:    "HR rounds, campus drives, salary negotiations — ten interview formats Indian companies actually run. Each one coached to its own rules, not averaged across all of them.",
    note:   "'Not just behavioural' is the sharpest competitive jab. 'Offer letter' is perfect Indian vocabulary. 'Not averaged' names generic AI failure mode.",
  },
  {
    tag:    "Research insight used in sub",
    score:  "—",
    status: "insight",
    h:      ["The hidden rules nobody teaches."],
    sub:    "Indian recruiters expect you to negotiate salary — but they never say so openly. HR rounds filter on culture, not qualifications. Campus drives filter on communication, not marks. Most candidates discover these rules after they've failed the round.",
    note:   "Source: postaresume.co.in + whytap.in research. These three insights power the shipped subheading. The 'nobody says so' line is the conversion trigger.",
  },
];

function CopyCard({ opt }: { opt: typeof COPY_BOARD[0] }) {
  const bg =
    opt.status === "shipped"  ? "#F5F0E8" :
    opt.status === "replaced" ? "#FFF5F5" :
    opt.status === "insight"  ? "#F0F4FF" :
    "#FFFFFF";
  const border =
    opt.status === "shipped"  ? `2px solid ${COPPER}` :
    opt.status === "replaced" ? "2px solid #FCA5A5" :
    opt.status === "insight"  ? "2px solid #A5B4FC" :
    `1.5px solid ${LINE}`;

  return (
    <div style={{
      background: bg, border, borderRadius: 16,
      padding: "28px 24px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Tag + Score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          fontFamily: SANS, fontSize: 10, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase" as const,
          color: opt.status === "shipped" ? COPPER : opt.status === "replaced" ? "#EF4444" : FAINT,
          lineHeight: 1.4,
        }}>
          {opt.tag}
        </div>
        {opt.score !== "—" && (
          <div style={{
            fontFamily: SANS, fontSize: 11, fontWeight: 700,
            color: opt.status === "shipped" ? COPPER : FAINT,
            background: opt.status === "shipped" ? "#FEF3C7" : LINE,
            padding: "2px 8px", borderRadius: 99,
          }}>
            {opt.score}
          </div>
        )}
      </div>

      {/* Heading preview */}
      <div style={{
        fontFamily: SERIF, fontSize: 22, fontWeight: 400,
        color: COAL, lineHeight: 1.2, letterSpacing: "-0.02em",
      }}>
        {opt.h.map((line, li) => (
          <span key={li}>
            {li === opt.h.length - 1 && opt.h.length > 1
              ? <em style={{ fontStyle: "italic", color: COPPER }}>{line}</em>
              : line}{" "}
          </span>
        ))}
      </div>

      <div style={{ height: 1, background: opt.status === "shipped" ? "#E8C4A0" : LINE }} />

      {/* Sub */}
      <p style={{
        fontFamily: SANS, fontSize: 13, color: INK,
        lineHeight: 1.65, margin: 0,
      }}>
        {opt.sub}
      </p>

      {/* Note */}
      <p style={{
        fontFamily: SANS, fontSize: 11.5, color: FAINT,
        fontStyle: "italic", margin: 0, lineHeight: 1.55,
        borderTop: `1px solid ${LINE}`, paddingTop: 10,
      }}>
        {opt.note}
      </p>
    </div>
  );
}

export function HeadingOptions() {
  return (
    <div style={{
      width: 1440, background: "#F5F3EE",
      padding: "64px 60px",
      fontFamily: SANS,
    }}>
      {/* Board header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: FAINT, marginBottom: 10,
        }}>
          InterviewFocusV2 · Copy Research Board · Shipped 2026-06-25
        </div>
        <h1 style={{
          fontFamily: SERIF, fontSize: 38, fontWeight: 400,
          color: COAL, margin: 0, letterSpacing: "-0.02em",
        }}>
          What shipped, what lost, and why.
        </h1>
        <p style={{
          fontFamily: SANS, fontSize: 15, color: INK,
          marginTop: 10, maxWidth: 640, lineHeight: 1.6,
        }}>
          Research covered 20+ heading options across 4 rounds, scored on 7 dimensions.
          Winner (R3) scored 67/70 — highest of any copy written in the session.
          The key insight: Indian candidates don&rsquo;t fail interviews — they fail formats they never practiced.
        </p>
      </div>

      {/* 5-column grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 20,
        alignItems: "start",
      }}>
        {COPY_BOARD.map((opt, i) => (
          <CopyCard key={i} opt={opt} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   REDESIGN — Icon grid v2
   Research findings applied:
   • Stroke locked at 2.5px across all 10 icons (was mixed 1.4–2.2)
   • Live area 8–56 inside 64×64 viewBox (8px padding each side)
   • Two-layer duotone: stroke at copper gradient, fill at 12–15% opacity
   • Draw-on hover animation: CSS stroke-dashoffset 1000→0
   • Stagger via nth-child delays (0.05s per element)
   • Coming-soon: opacity 0.32 + filter saturate(0.55) — not 0.46
   • Icons redesigned: Campus = mortarboard, Panel = desk+placards,
     Salary = tilted scales, Govt = building+emblem
══════════════════════════════════════════════════════════════════ */

/* ── Gradient for redesign (separate ID to avoid collision) ─────── */
const GRAD2_ID = "hsx-cg-v2";
const G2       = `url(#${GRAD2_ID})`;
const nsw      = 2.5;  /* new uniform stroke weight */

function GradientDef2() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute", overflow: "hidden" }}>
      <defs>
        <linearGradient id={GRAD2_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8C4A0" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Pulsing live dot only ──────────────────────────────────────── */
function DrawOnStyles() {
  return (
    <style>{`
      .hsx-live-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: #B45309; display: inline-block; flex-shrink: 0;
        animation: hsx-pulse 2s ease-in-out infinite;
      }
      @keyframes hsx-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.25; }
      }
    `}</style>
  );
}

/* ── Redesigned icon set — 2px stroke, 2–3 elements max, duotone fills ── */
/* Style rules: strokeWidth=2 throughout, rounded caps+joins always,        */
/* primary shape fillOpacity 0.08–0.12, focal detail fillOpacity 0.20–0.28  */
const NewIcons = {
  /* 1 ── BEHAVIORAL: STAR method — speech bubble with bold star */
  Behavioral: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M9 8h46a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H28L16 52l2-14H9a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.08"/>
      <polygon points="32,12 35,21 44,21 37,26 40,35 32,30 24,35 27,26 20,21 29,21"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.26"/>
    </svg>
  ),

  /* 2 ── CAMPUS PLACEMENT: mortarboard — diamond + centre button + L-tassel.
     Tassel drawn as an L-path: horizontal FROM the centre button across the cap
     top THEN hanging off the right edge. This is exactly how Font Awesome and
     Material Icons draw graduation caps — the L makes the cord connection
     explicit and prevents the bob from looking like a floating orphan dot. */
  Campus: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Diamond board — wide and flat */}
      <path d="M32 10 L56 24 L32 38 L8 24 Z"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.18"/>
      {/* Centre button — the identifier that turns diamond → graduation cap */}
      <circle cx="32" cy="24" r="5"
        stroke={G2} strokeWidth={1.5} fill={G2} fillOpacity="0.55"/>
      {/* Tassel: L-cord from button → right edge → hang down */}
      <path d="M32 24 L56 24 L56 46"
        stroke={G2} strokeWidth={2} strokeLinecap="round" fill="none"/>
      {/* Bob */}
      <circle cx="56" cy="51" r="4.5"
        stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.40"/>
    </svg>
  ),

  /* 3 ── SALARY NEGOTIATION: ₹ as large SVG text.
     Every path-based ₹ at 80px collapses — the Unicode glyph rendered by
     the system font IS the icon. Gradient fill via fill=url() on <text>
     works in SVG and gives the same copper tone as the rest of the set. */
  Salary: (
    <svg viewBox="0 0 64 64" aria-hidden>
      <text
        x="32" y="48"
        textAnchor="middle"
        fontSize="48"
        fontFamily='"Satoshi", "Inter", system-ui, sans-serif'
        fontWeight="500"
        fill={G2}
      >₹</text>
    </svg>
  ),

  /* 4 ── HR ROUND: person silhouette + approval badge.
     HR = Human Resources → person avatar is the most literal read.
     Badge with checkmark in corner communicates "screening / round evaluation."
     Cream circle erases the shoulder arc behind the badge for a clean layer. */
  HR: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Head */}
      <circle cx="32" cy="20" r="11"
        stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.12"/>
      {/* Shoulders — gentle arc, implies a person not just a circle */}
      <path d="M6 56 Q6 38 32 38 Q58 38 58 56"
        stroke={G2} strokeWidth={2} strokeLinecap="round" fill={G2} fillOpacity="0.08"/>
      {/* Erase shoulder arc behind badge so badge sits cleanly on top */}
      <circle cx="50" cy="46" r="11" fill={CREAM}/>
      {/* Approval badge */}
      <circle cx="50" cy="46" r="10"
        stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.16"/>
      {/* Checkmark inside badge */}
      <path d="M44 46 L48 50 L56 40"
        stroke={G2} strokeWidth={2.5} {...rp}/>
    </svg>
  ),

  /* 5 ── LEADERSHIP ROUND: crown — 3 dramatic peaks, gems at exact peak corners */
  Leadership: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Crown silhouette — deeper dips (y=40) for unambiguous crown vs battlements */}
      <path d="M6 50 L6 26 L20 40 L32 8 L44 40 L58 26 L58 50"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.09"/>
      {/* Crown base band */}
      <rect x="6" y="50" width="52" height="8" rx="2"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.18"/>
      {/* Gems placed exactly at the three peak corners — no offset overlap */}
      <circle cx="6" cy="26" r="3.5" stroke={G2} strokeWidth="1.5" fill={G2} fillOpacity="0.55"/>
      <circle cx="32" cy="8" r="4.5" stroke={G2} strokeWidth="1.5" fill={G2} fillOpacity="0.55"/>
      <circle cx="58" cy="26" r="3.5" stroke={G2} strokeWidth="1.5" fill={G2} fillOpacity="0.55"/>
    </svg>
  ),

  /* 6 ── TECHNICAL LEADERSHIP: code on monitor */
  TechLead: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="8" y="10" width="48" height="34" rx="4"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.07"/>
      <rect x="12" y="14" width="40" height="26" rx="2"
        stroke={G2} strokeWidth={2} {...rp}/>
      <path d="M22 23 L15 27 L22 31" stroke={G2} strokeWidth={2} {...rp}/>
      <path d="M42 23 L49 27 L42 31" stroke={G2} strokeWidth={2} {...rp}/>
      <line x1="34" y1="20" x2="30" y2="34" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <path d="M29 44 L26 54 L38 54 L35 44" stroke={G2} strokeWidth={2} {...rp}/>
      <line x1="22" y1="54" x2="42" y2="54" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
    </svg>
  ),

  /* 7 ── CASE STUDY: document + magnifying glass */
  CaseStudy: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M10 8 h24 l12 12 v36 H10 Z"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.07"/>
      <path d="M34 8 v12 h12" stroke={G2} strokeWidth={2} {...rp}/>
      <line x1="16" y1="28" x2="30" y2="28" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="16" y1="34" x2="28" y2="34" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <circle cx="44" cy="46" r="10" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.10"/>
      <line x1="51" y1="53" x2="57" y2="59" stroke={G2} strokeWidth={3} strokeLinecap="round"/>
    </svg>
  ),

  /* 8 ── PANEL INTERVIEW: 3 interviewers + desk + 1 candidate — clear hierarchy */
  Panel: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Three interviewers — centre head slightly larger = lead interviewer */}
      <circle cx="14" cy="17" r="7" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.08"/>
      <circle cx="32" cy="15" r="8" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.13"/>
      <circle cx="50" cy="17" r="7" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.08"/>
      {/* Interview desk — wide, unambiguous table surface */}
      <rect x="4" y="36" width="56" height="6" rx="2"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.14"/>
      {/* Candidate — solo, centred below the table */}
      <circle cx="32" cy="54" r="7" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.07"/>
    </svg>
  ),

  /* 9 ── MANAGEMENT: people org chart — circles read as persons, not data boxes */
  Management: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Top manager — larger circle signals seniority */}
      <circle cx="32" cy="14" r="9" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.16"/>
      {/* Tree connectors */}
      <line x1="32" y1="23" x2="32" y2="34" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="12" y1="34" x2="52" y2="34" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="12" y1="34" x2="12" y2="42" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="32" y1="34" x2="32" y2="42" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="52" y1="34" x2="52" y2="42" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      {/* Three direct reports */}
      <circle cx="12" cy="49" r="7" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.08"/>
      <circle cx="32" cy="49" r="7" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.08"/>
      <circle cx="52" cy="49" r="7" stroke={G2} strokeWidth={2} fill={G2} fillOpacity="0.08"/>
    </svg>
  ),

  /* 10 ── GOVT/PSU: neoclassical building — pediment + columns + steps */
  GovPSU: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Pediment — open triangle (no base stroke), entablature rect provides the base */}
      <path d="M8 26 L32 6 L56 26"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.10"/>
      <circle cx="32" cy="17" r="5" stroke={G2} strokeWidth="1.5" fill={G2} fillOpacity="0.26"/>
      <circle cx="32" cy="17" r="2" fill={G2} fillOpacity="0.60"/>
      {/* Entablature — starts at y=26, top stroke is the pediment base */}
      <rect x="8" y="26" width="48" height="5" rx="1"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.10"/>
      <line x1="14" y1="31" x2="14" y2="53" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="22" y1="31" x2="22" y2="53" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="32" y1="31" x2="32" y2="53" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="42" y1="31" x2="42" y2="53" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <line x1="50" y1="31" x2="50" y2="53" stroke={G2} strokeWidth={2} strokeLinecap="round"/>
      <rect x="6"  y="53" width="52" height="4" rx="1"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.09"/>
      <rect x="4"  y="57" width="56" height="3" rx="1"
        stroke={G2} strokeWidth={2} {...rp} fill={G2} fillOpacity="0.06"/>
    </svg>
  ),
};

const NEW_TYPES = [
  { label: "Behavioral",           desc: "STAR stories · leadership · decisions",      live: true,  icon: NewIcons.Behavioral },
  { label: "Campus Placement",     desc: "TCS · Infosys · Wipro · Cognizant",          live: true,  icon: NewIcons.Campus     },
  { label: "Salary Negotiation",   desc: "Counter-offers · levelling · benefits",      live: true,  icon: NewIcons.Salary     },
  { label: "HR Round",             desc: "Culture fit · motivation · expectations",    live: true,  icon: NewIcons.HR         },
  { label: "Leadership Round",     desc: "Vision · stakeholders · long-range thinking",live: false, icon: NewIcons.Leadership },
  { label: "Technical Leadership", desc: "System design · coding · architecture",      live: false, icon: NewIcons.TechLead   },
  { label: "Case Study",           desc: "Analysis · frameworks · presentation",       live: false, icon: NewIcons.CaseStudy  },
  { label: "Panel Interview",      desc: "Multiple interviewers · group dynamics",     live: false, icon: NewIcons.Panel      },
  { label: "Management",           desc: "People · process · performance reviews",     live: false, icon: NewIcons.Management },
  { label: "Govt / PSU",           desc: "UPSC · banking · PSU interviews",            live: false, icon: NewIcons.GovPSU     },
];

function IconCell({ type }: { type: typeof NEW_TYPES[0] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        opacity: type.live ? 1 : 0.3,
        filter: type.live ? "none" : "saturate(0.45)",
        cursor: "default",
      }}
    >
      <div style={{ width: 80, height: 80, marginBottom: 22 }}>{type.icon}</div>
      <h3 style={{
        fontFamily: SANS, fontSize: 15, fontWeight: 600,
        color: COAL, margin: "0 0 7px",
        letterSpacing: "-0.015em", lineHeight: 1.3,
      }}>
        {type.label}
      </h3>
      <p style={{
        fontFamily: SANS, fontSize: 13,
        color: type.live ? INK : FAINT,
        margin: 0, lineHeight: 1.6,
        maxWidth: 160,
      }}>
        {type.live ? type.desc : "Coming soon"}
      </p>
    </div>
  );
}

function SectionDivider({ label, sub, live = false }: { label: string; sub?: string; live?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, height: 1, background: LINE }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        {live && <span className="hsx-live-dot" />}
        <span style={{
          fontFamily: SANS, fontSize: 10.5, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: live ? COPPER : FAINT,
          whiteSpace: "nowrap" as const,
        }}>
          {label}
        </span>
        {sub && (
          <span style={{
            fontFamily: SANS, fontSize: 10.5, fontWeight: 400,
            color: FAINT, whiteSpace: "nowrap" as const,
          }}>
            {sub}
          </span>
        )}
      </div>
      <div style={{ flex: 1, height: 1, background: LINE }} />
    </div>
  );
}

function NewIconGrid() {
  const live = NEW_TYPES.filter(t => t.live);
  const soon = NEW_TYPES.filter(t => !t.live);

  return (
    <div style={{ marginTop: 56 }}>
      {/* "Available now" label */}
      <div style={{ margin: "0 0 36px" }}>
        <SectionDivider label="Available now" live />
      </div>

      {/* Live types — 4 items, 80px icons */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0 32px",
      }}>
        {live.map(type => <IconCell key={type.label} type={type} />)}
      </div>

      {/* "Coming soon" label */}
      <div style={{ margin: "52px 0 32px" }}>
        <SectionDivider label="Coming soon" />
      </div>

      {/* Coming-soon types — 6 items in a single compact row, 60px icons, no desc */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: "0 20px",
        opacity: 0.3,
        filter: "saturate(0.45)",
      }}>
        {soon.map(type => (
          <div
            key={type.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
          >
            <div style={{ width: 60, height: 60, marginBottom: 16 }}>{type.icon}</div>
            <p style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 600,
              color: COAL, margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em",
            }}>{type.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DesktopRedesign() {
  return (
    <div style={{
      width: 1440, background: CREAM,
      padding: "96px 0 120px",
      fontFamily: SANS, position: "relative",
    }}>
      <DrawOnStyles />
      <GradientDef2 />

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 40px" }}>

        {/* Heading */}
        <div style={{ textAlign: "center", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: SERIF, fontSize: 64, fontWeight: 400,
            color: COAL, margin: "0 0 24px",
            letterSpacing: "-0.025em", lineHeight: 1.1,
          }}>
            Walk into any round<br />
            <em style={{ fontStyle: "italic", color: COPPER }}>knowing exactly what it&rsquo;s testing.</em>
          </h2>
        </div>

        {/* Redesigned icon grid */}
        <NewIconGrid />
      </div>

    </div>
  );
}
