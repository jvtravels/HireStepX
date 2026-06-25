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
const sw      = 1.6;
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
  Behavioral: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M8 8h38a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H26L14 50l2-10H8a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
        stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
      <polygon points="27,14 29.1,19.5 35,19.5 30.5,23 32.1,28.5 27,25.2 21.9,28.5 23.5,23 19,19.5 24.9,19.5"
        stroke={G} strokeWidth="1.4" {...rp} fill={G} fillOpacity="0.22"/>
    </svg>
  ),
  Campus: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M8 26L32 8l24 18H8z" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.1"/>
      <rect x="8" y="24" width="48" height="4" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      <line x1="16" y1="28" x2="16" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="26" y1="28" x2="26" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="38" y1="28" x2="38" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="48" y1="28" x2="48" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <rect x="6" y="52" width="52" height="4" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      <rect x="4" y="56" width="56" height="4" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
    </svg>
  ),
  Salary: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <line x1="32" y1="8" x2="32" y2="56" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="8" y1="20" x2="56" y2="20" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="14" y1="20" x2="10" y2="36" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="14" y1="20" x2="18" y2="36" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <path d="M8 36a8 4 0 0 0 16 0" stroke={G} strokeWidth={sw} strokeLinecap="round" fill={G} fillOpacity="0.12"/>
      <line x1="50" y1="20" x2="46" y2="36" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="50" y1="20" x2="54" y2="36" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <path d="M44 36a8 4 0 0 0 16 0" stroke={G} strokeWidth={sw} strokeLinecap="round" fill={G} fillOpacity="0.12"/>
      <rect x="28" y="50" width="8" height="6" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.1"/>
      <line x1="22" y1="56" x2="42" y2="56" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  ),
  HR: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="18" cy="16" r="8" stroke={G} strokeWidth={sw}/>
      <path d="M2 48c0-12 32-12 32 0" stroke={G} strokeWidth={sw} strokeLinecap="round" fill={G} fillOpacity="0.07"/>
      <circle cx="46" cy="16" r="8" stroke={G} strokeWidth={sw}/>
      <path d="M30 48c0-12 32-12 32 0" stroke={G} strokeWidth={sw} strokeLinecap="round" fill={G} fillOpacity="0.07"/>
      <path d="M26 34l6 4 6-4" stroke={G} strokeWidth={sw} {...rp}/>
    </svg>
  ),
  Strategic: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="28" cy="32" r="22" stroke={G} strokeWidth={sw}/>
      <circle cx="28" cy="32" r="14" stroke={G} strokeWidth={sw}/>
      <circle cx="28" cy="32" r="5" stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.22"/>
      <line x1="52" y1="10" x2="33" y2="27" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <path d="M40 10h12v12" stroke={G} strokeWidth={sw} {...rp}/>
    </svg>
  ),
  TechLead: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="6" y="8" width="52" height="38" rx="4" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
      <rect x="10" y="12" width="44" height="30" rx="2" stroke={G} strokeWidth={sw} {...rp}/>
      <path d="M22 22l-8 5 8 5" stroke={G} strokeWidth={sw} {...rp}/>
      <path d="M42 22l8 5-8 5" stroke={G} strokeWidth={sw} {...rp}/>
      <line x1="35" y1="19" x2="29" y2="37" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <path d="M28 46l-4 10h16l-4-10" stroke={G} strokeWidth={sw} {...rp}/>
      <line x1="20" y1="56" x2="44" y2="56" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  ),
  CaseStudy: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M10 6h28l12 12v40H10z" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
      <path d="M38 6v12h12" stroke={G} strokeWidth={sw} {...rp}/>
      <line x1="16" y1="26" x2="36" y2="26" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="16" y1="33" x2="34" y2="33" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="16" y1="40" x2="28" y2="40" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <circle cx="44" cy="46" r="10" stroke={G} strokeWidth={sw} fill={G} fillOpacity="0.1"/>
      <line x1="51" y1="53" x2="58" y2="60" stroke={G} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  Panel: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="12" cy="16" r="7" stroke={G} strokeWidth={sw}/>
      <path d="M0 44c0-10 24-10 24 0" stroke={G} strokeWidth={sw} strokeLinecap="round" fill={G} fillOpacity="0.07"/>
      <circle cx="32" cy="13" r="9" stroke={G} strokeWidth={sw}/>
      <path d="M16 44c0-12 32-12 32 0" stroke={G} strokeWidth={sw} strokeLinecap="round" fill={G} fillOpacity="0.1"/>
      <circle cx="52" cy="16" r="7" stroke={G} strokeWidth={sw}/>
      <path d="M40 44c0-10 24-10 24 0" stroke={G} strokeWidth={sw} strokeLinecap="round" fill={G} fillOpacity="0.07"/>
      <line x1="2" y1="44" x2="62" y2="44" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  ),
  Management: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="22" y="6" width="20" height="12" rx="3" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.14"/>
      <circle cx="32" cy="12" r="2.5" fill={G} fillOpacity="0.55"/>
      <line x1="32" y1="18" x2="32" y2="28" stroke={G} strokeWidth={sw}/>
      <line x1="12" y1="28" x2="52" y2="28" stroke={G} strokeWidth={sw}/>
      <line x1="12" y1="28" x2="12" y2="38" stroke={G} strokeWidth={sw}/>
      <line x1="32" y1="28" x2="32" y2="38" stroke={G} strokeWidth={sw}/>
      <line x1="52" y1="28" x2="52" y2="38" stroke={G} strokeWidth={sw}/>
      <rect x="2" y="38" width="20" height="12" rx="3" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
      <rect x="22" y="38" width="20" height="12" rx="3" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
      <rect x="42" y="38" width="20" height="12" rx="3" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.07"/>
    </svg>
  ),
  GovPSU: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M8 26L32 8l24 18H8z" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.1"/>
      <rect x="8" y="24" width="48" height="5" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      <line x1="16" y1="29" x2="16" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="26" y1="29" x2="26" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="38" y1="29" x2="38" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <line x1="48" y1="29" x2="48" y2="52" stroke={G} strokeWidth={sw} strokeLinecap="round"/>
      <rect x="6" y="52" width="52" height="4" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
      <rect x="4" y="56" width="56" height="4" stroke={G} strokeWidth={sw} {...rp} fill={G} fillOpacity="0.08"/>
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

/* ── CSS draw-on animation — loops continuously ────────────────── */
function DrawOnStyles() {
  return (
    <style>{`
      /* 4.5s cycle: fade-in draw → long hold → fade out → reset */
      .hsx-v2-icon svg .d {
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
        animation: hsx-v2-draw 4.5s cubic-bezier(0.4,0,0.2,1) infinite;
      }
      .hsx-v2-icon svg .d:nth-child(1)  { animation-delay: 0.00s; }
      .hsx-v2-icon svg .d:nth-child(2)  { animation-delay: 0.08s; }
      .hsx-v2-icon svg .d:nth-child(3)  { animation-delay: 0.16s; }
      .hsx-v2-icon svg .d:nth-child(4)  { animation-delay: 0.24s; }
      .hsx-v2-icon svg .d:nth-child(5)  { animation-delay: 0.32s; }
      .hsx-v2-icon svg .d:nth-child(6)  { animation-delay: 0.40s; }
      .hsx-v2-icon svg .d:nth-child(7)  { animation-delay: 0.48s; }
      .hsx-v2-icon svg .d:nth-child(8)  { animation-delay: 0.56s; }

      @keyframes hsx-v2-draw {
        0%   { stroke-dashoffset: 1000; opacity: 0; }
        6%   { opacity: 1; }
        38%  { stroke-dashoffset: 0; opacity: 1; }
        82%  { stroke-dashoffset: 0; opacity: 1; }
        97%  { stroke-dashoffset: 0; opacity: 0; }
        100% { stroke-dashoffset: 1000; opacity: 0; }
      }

      /* pulsing live dot */
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

/* ── Redesigned icon set ────────────────────────────────────────── */
const NewIcons = {
  Behavioral: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* speech bubble body — tall enough for star + room to breathe */}
      <path className="d" d="M9 8h46a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H28L16 50l2-12H9a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round" fill={G2} fillOpacity="0.09"/>
      {/* star — bigger, centred in the bubble */}
      <polygon className="d"
        points="32,13 34.8,21 43,21 36.6,25.8 39,34 32,29 25,34 27.4,25.8 21,21 29.2,21"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round" fill={G2} fillOpacity="0.22"/>
    </svg>
  ),

  Campus: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* mortarboard diamond top */}
      <path className="d" d="M32 10L54 21L32 32L10 21z"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round" fill={G2} fillOpacity="0.12"/>
      {/* cap body */}
      <path className="d" d="M18 25v9c0 7 28 7 28 0v-9"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round"/>
      {/* tassel string from right corner */}
      <line className="d" x1="54" y1="21" x2="54" y2="40"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* tassel bundle */}
      <line className="d" x1="49" y1="40" x2="59" y2="40"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* tassel strands */}
      <line className="d" x1="50" y1="40" x2="49" y2="49"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="54" y1="40" x2="53" y2="50"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="58" y1="40" x2="57" y2="49"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
    </svg>
  ),

  Salary: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* center post */}
      <line className="d" x1="32" y1="10" x2="32" y2="54"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* beam — tilted left-down, right-up to show negotiation tension */}
      <line className="d" x1="10" y1="23" x2="54" y2="19"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* left pan strings */}
      <line className="d" x1="14" y1="23" x2="11" y2="37"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="14" y1="23" x2="17" y2="37"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* left pan (lower — heavier) */}
      <path className="d" d="M9 37a6 3 0 0 0 12 0"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" fill={G2} fillOpacity="0.15"/>
      {/* right pan strings */}
      <line className="d" x1="50" y1="19" x2="47" y2="31"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="50" y1="19" x2="53" y2="31"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* right pan (higher — lighter) */}
      <path className="d" d="M45 31a6 3 0 0 0 12 0"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" fill={G2} fillOpacity="0.15"/>
      {/* base pedestal */}
      <rect className="d" x="28" y="48" width="8" height="6" rx="2"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round" fill={G2} fillOpacity="0.1"/>
      {/* base line */}
      <line className="d" x1="22" y1="54" x2="42" y2="54"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
    </svg>
  ),

  HR: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* left person — head */}
      <circle className="d" cx="17" cy="16" r="7"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.09"/>
      {/* left person — body arc */}
      <path className="d" d="M4 47c0-11 26-11 26 0"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" fill={G2} fillOpacity="0.07"/>
      {/* right person — head */}
      <circle className="d" cx="47" cy="16" r="7"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.09"/>
      {/* right person — body arc */}
      <path className="d" d="M34 47c0-11 26-11 26 0"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" fill={G2} fillOpacity="0.07"/>
      {/* handshake — two clasped hands */}
      <path className="d" d="M24 33l4 3h8l4-3"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  Leadership: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* outer ring */}
      <circle className="d" cx="30" cy="32" r="20"
        stroke={G2} strokeWidth={nsw}/>
      {/* middle ring */}
      <circle className="d" cx="30" cy="32" r="12"
        stroke={G2} strokeWidth={nsw}/>
      {/* bullseye */}
      <circle className="d" cx="30" cy="32" r="5"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.24"/>
      {/* arrow shaft from top-right */}
      <line className="d" x1="52" y1="10" x2="35" y2="27"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* arrow head */}
      <path className="d" d="M40 10h12v12"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  TechLead: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* monitor frame */}
      <rect className="d" x="8" y="10" width="48" height="34" rx="4"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.07"/>
      {/* screen bezel */}
      <rect className="d" x="12" y="14" width="40" height="26" rx="2"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round"/>
      {/* < bracket */}
      <path className="d" d="M22 23l-7 4 7 4"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round"/>
      {/* > bracket */}
      <path className="d" d="M42 23l7 4-7 4"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round"/>
      {/* / slash */}
      <line className="d" x1="34" y1="20" x2="30" y2="36"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* stand neck */}
      <path className="d" d="M29 44l-4 9h14l-4-9"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round"/>
      {/* stand base */}
      <line className="d" x1="22" y1="53" x2="42" y2="53"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
    </svg>
  ),

  CaseStudy: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* document body */}
      <path className="d" d="M10 8h24l12 12v36H10z"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round" fill={G2} fillOpacity="0.07"/>
      {/* folded corner */}
      <path className="d" d="M34 8v12h12"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round"/>
      {/* text lines */}
      <line className="d" x1="16" y1="28" x2="34" y2="28"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="16" y1="35" x2="30" y2="35"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="16" y1="42" x2="24" y2="42"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* magnifying glass circle */}
      <circle className="d" cx="43" cy="45" r="9"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.1"/>
      {/* magnifying glass handle */}
      <line className="d" x1="49" y1="52" x2="55" y2="58"
        stroke={G2} strokeWidth={nsw + 0.5} strokeLinecap="round"/>
    </svg>
  ),

  Panel: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* 3 interviewer heads — left, center (lead), right */}
      <circle className="d" cx="13" cy="14" r="6"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.07"/>
      <circle className="d" cx="32" cy="11" r="8"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.13"/>
      <circle className="d" cx="51" cy="14" r="6"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.07"/>
      {/* interviewer desk — solid bar */}
      <rect className="d" x="8" y="36" width="48" height="7" rx="3"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.13"/>
      {/* 3 name placards (static fill, no animation) */}
      <rect x="11" y="38.5" width="11" height="2.5" rx="1" fill={G2} fillOpacity="0.32"/>
      <rect x="27" y="38.5" width="11" height="2.5" rx="1" fill={G2} fillOpacity="0.32"/>
      <rect x="43" y="38.5" width="11" height="2.5" rx="1" fill={G2} fillOpacity="0.32"/>
      {/* candidate (you) — circle below desk */}
      <circle className="d" cx="32" cy="56" r="5"
        stroke={G2} strokeWidth={nsw} fill={G2} fillOpacity="0.06"/>
    </svg>
  ),

  Management: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* top node */}
      <rect className="d" x="22" y="8" width="20" height="12" rx="3"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.15"/>
      {/* stem */}
      <line className="d" x1="32" y1="20" x2="32" y2="30"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* horizontal bar */}
      <line className="d" x1="12" y1="30" x2="52" y2="30"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* 3 drops */}
      <line className="d" x1="12" y1="30" x2="12" y2="38"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="32" y1="30" x2="32" y2="38"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="52" y1="30" x2="52" y2="38"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* 3 bottom nodes */}
      <rect className="d" x="2"  y="38" width="20" height="12" rx="3"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.07"/>
      <rect className="d" x="22" y="38" width="20" height="12" rx="3"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.07"/>
      <rect className="d" x="42" y="38" width="20" height="12" rx="3"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.07"/>
    </svg>
  ),

  GovPSU: (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* pediment — taller triangle, clearly a roof */}
      <path className="d" d="M8 26L32 6l24 20H8z"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round" strokeLinejoin="round" fill={G2} fillOpacity="0.1"/>
      {/* official emblem circle in pediment */}
      <circle className="d" cx="32" cy="18" r="5"
        stroke={G2} strokeWidth="1.8" fill={G2} fillOpacity="0.22"/>
      <circle cx="32" cy="18" r="2" fill={G2} fillOpacity="0.6"/>
      {/* entablature bar */}
      <rect className="d" x="8" y="26" width="48" height="5" rx="1"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.1"/>
      {/* 5 columns — taller, more imposing */}
      <line className="d" x1="14" y1="31" x2="14" y2="53"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="22" y1="31" x2="22" y2="53"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="32" y1="31" x2="32" y2="53"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="42" y1="31" x2="42" y2="53"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      <line className="d" x1="50" y1="31" x2="50" y2="53"
        stroke={G2} strokeWidth={nsw} strokeLinecap="round"/>
      {/* base steps */}
      <rect className="d" x="6"  y="53" width="52" height="4" rx="1"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.09"/>
      <rect className="d" x="4"  y="57" width="56" height="4" rx="1"
        stroke={G2} strokeWidth={nsw} strokeLinejoin="round" fill={G2} fillOpacity="0.09"/>
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
      className={type.live ? "hsx-v2-icon" : undefined}
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
        <SectionDivider label="Coming soon" sub={`· ${soon.length} more formats`} />
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

        {/* Section eyebrow */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 44,
        }}>
          <span style={{
            fontFamily: SANS, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.13em", textTransform: "uppercase" as const,
            color: FAINT,
          }}>03</span>
          <div style={{ width: 20, height: 1, background: LINE }} />
          <span style={{
            fontFamily: SANS, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.13em", textTransform: "uppercase" as const,
            color: FAINT,
          }}>Interview formats</span>
          <div style={{ flex: 1, height: 1, background: LINE }} />
          <span style={{
            fontFamily: SANS, fontSize: 11, fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            color: FAINT,
          }}>10 types · 4 live now</span>
        </div>

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
          <p style={{
            fontFamily: SANS, fontSize: 16, color: "#4a4540",
            lineHeight: 1.75, margin: "0 auto",
            maxWidth: 620,
          }}>
            Every format has hidden rules. HR tests culture, not qualifications.
            Campus filters on communication, not marks. Salary expects you to negotiate,
            even when nobody says so. Ten formats. One coach.
          </p>
        </div>

        {/* Redesigned icon grid */}
        <NewIconGrid />
      </div>

    </div>
  );
}
