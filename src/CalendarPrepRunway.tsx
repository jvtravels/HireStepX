/* ─── Interview Calendar & Prep Runway — redesign (v1) ──────────────────
 *
 * UI-only prototype for the rebuilt calendar feature (see PRD
 * "Interview Calendar & Prep Runway" / PRI-35). Renders with inline
 * mock data — no API, no localStorage. Built on the cream brand tokens
 * so it sits flush with DashboardHome / InterviewPanels.
 *
 * Centerpiece: the persona-aware Prep Runway. Logging an interview
 * proposes a countdown of AI mock sessions that the user accepts; the
 * runway branches by archetype (Interview Sprint / Negotiation Prep /
 * Exam Arc) rather than emitting one generic shape.
 *
 * Exports:
 *   default  CalendarPrepRunway  — the full calendar surface
 *   PrepRunwayRail               — the signature timeline component
 *   SuggestRunwaySheet           — the suggest-then-accept preview
 */
import { useState } from "react";
import { c, font, shadow, sp, radius, ease } from "./tokens";
import { tokens as T } from "./auth/_tokens";

/* Scoped stylesheet — inline styles can't express :focus-visible, media
 * queries, or :hover, so the responsive grid + keyboard focus rings live
 * here. Injected once per exported root (idempotent across storyboards). */
const STYLE = `
.cpr-tap { -webkit-tap-highlight-color: transparent; }
.cpr-tap:focus-visible {
  outline: 2px solid ${c.slate};
  outline-offset: 2px;
  border-radius: ${radius.sm}px;
}
.cpr-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: ${sp.xl}px;
  align-items: start;
}
@media (max-width: 880px) {
  .cpr-grid { grid-template-columns: 1fr; }
  .cpr-header { flex-direction: column; align-items: flex-start; }
  .cpr-actions { align-items: stretch !important; width: 100%; }
  .cpr-nl { width: 100%; min-width: 0 !important; box-sizing: border-box; }
}
`;

/* ─── primitives ─────────────────────────────────────────────────── */

type IconProps = { children: React.ReactNode; size?: number; stroke?: string; sw?: number };
const Icon = ({ children, size = 18, stroke = "currentColor", sw = 1.6 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

const I = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  push: <><path d="M12 3v2M5 10a7 7 0 0 1 14 0v4l2 3H3l2-3z" /><path d="M9.5 20a2.5 2.5 0 0 0 5 0" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  play: <><path d="M6 4l14 8-14 8z" /></>,
  sparkle: <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  google: <><path d="M21 12.2c0-.6-.1-1.2-.2-1.7H12v3.4h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3a9 9 0 0 0 2.8-6.8z" /><path d="M12 21a9 9 0 0 0 6-2.2l-3-2.3a5.4 5.4 0 0 1-8-2.8H4v2.4A9 9 0 0 0 12 21z" /><path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V7.9H4a9 9 0 0 0 0 8.2z" /><path d="M12 6.6c1.2 0 2.3.4 3.2 1.3l2.4-2.4A9 9 0 0 0 4 7.9l3 2.4A5.4 5.4 0 0 1 12 6.6z" /></>,
};

function Card({
  children,
  pad = 24,
  style,
}: {
  children: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: c.carbon,
        border: `1px solid ${c.border}`,
        borderRadius: radius.lg,
        padding: pad,
        boxShadow: shadow.md,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, color = c.gilt }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontFamily: font.mono,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </span>
  );
}

function Pill({
  children,
  bg,
  fg,
  bd,
  icon,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  bd?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: radius.pill,
        background: bg,
        color: fg,
        border: bd ? `1px solid ${bd}` : "none",
        fontFamily: font.mono,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/* ─── scenarios (persona-aware archetypes) ───────────────────────────── */

type NodeState = "done" | "active" | "upcoming" | "anchor";
type RunwayNode = {
  tag: string;
  title: string;
  detail: string;
  state: NodeState;
  score?: number;
};
type Scenario = {
  key: string;
  archetype: string;
  badge: string;
  company: string;
  initial: string;
  role: string;
  round: string;
  anchorLabel: string;
  whenPrimary: string;
  whenSecondary: string;
  awkward?: string;
  countdown: string;
  rail: RunwayNode[];
  railLabel: string;
};

const SCENARIOS: Scenario[] = [
  {
    key: "sprint",
    archetype: "Interview Sprint",
    badge: "FAANG · cross-timezone",
    company: "Amazon",
    initial: "A",
    role: "SDE II",
    round: "System Design round",
    anchorLabel: "Interview",
    whenPrimary: "Fri 20 Jun · 8:30 PM IST",
    whenSecondary: "8:00 AM PDT, interviewer's local time",
    countdown: "in 5 days",
    railLabel: "Mock-session countdown · T-7 → T-0",
    rail: [
      { tag: "T-7", title: "Calibration mock", detail: "Baseline · found 2 weak areas", state: "done", score: 72 },
      { tag: "T-4", title: "Targeted drill", detail: "Distributed systems & trade-offs", state: "done", score: 81 },
      { tag: "T-2", title: "Amazon system-design mock", detail: "Company-flavored · prefilled", state: "active" },
      { tag: "T-1", title: "Confidence run", detail: "Light · logistics checklist", state: "upcoming" },
      { tag: "T-0", title: "Amazon · SDE II", detail: "The real interview", state: "anchor" },
      { tag: "+2h", title: "Reflection", detail: "Capture what they asked", state: "upcoming" },
    ],
  },
  {
    key: "negotiation",
    archetype: "Negotiation Prep",
    badge: "Live offer · non-fresher",
    company: "Razorpay",
    initial: "R",
    role: "Senior PM",
    round: "Compensation discussion",
    anchorLabel: "Offer deadline",
    whenPrimary: "Tue 24 Jun · accept by 6:00 PM IST",
    whenSecondary: "Recruiter call scheduled 11:00 AM IST",
    countdown: "decide in 9 days",
    railLabel: "Negotiation drills → decision date",
    rail: [
      { tag: "D-5", title: "Market-data anchoring", detail: "Build your number · band research", state: "done", score: 78 },
      { tag: "D-3", title: "Counter-offer drill", detail: "Holding strength under probing", state: "active" },
      { tag: "D-1", title: "Live negotiation mock", detail: "Full call · cooperative style", state: "upcoming" },
      { tag: "D-0", title: "Respond to Razorpay", detail: "The decision", state: "anchor" },
    ],
  },
  {
    key: "exam",
    archetype: "Exam Arc",
    badge: "PSU / campus · long horizon",
    company: "SBI",
    initial: "S",
    role: "Probationary Officer",
    round: "Final interview panel",
    anchorLabel: "Interview date",
    whenPrimary: "Mon 28 Jul · 10:00 AM IST",
    whenSecondary: "Mumbai · in-person panel",
    countdown: "in 6 weeks",
    railLabel: "Long-horizon study cadence · weeks out",
    rail: [
      { tag: "W-6", title: "Foundations", detail: "Banking awareness baseline", state: "done", score: 68 },
      { tag: "W-4", title: "Current affairs + GK", detail: "Weekly drills", state: "active" },
      { tag: "W-2", title: "Full mock panel", detail: "Stress + situational", state: "upcoming" },
      { tag: "W-1", title: "Confidence run", detail: "Bio-data deep dive", state: "upcoming" },
      { tag: "D-0", title: "SBI PO panel", detail: "The real interview", state: "anchor" },
    ],
  },
];

/* node visuals by state */
function nodeVisual(state: NodeState) {
  switch (state) {
    case "done":
      return { ring: c.sage, fill: c.sageLight, fg: c.sage };
    case "active":
      return { ring: c.gilt, fill: T.copper100, fg: c.gilt };
    case "anchor":
      return { ring: c.slate, fill: c.slateLight, fg: c.slate };
    default:
      return { ring: c.borderHover, fill: c.graphite, fg: c.stone };
  }
}

/* ─── PrepRunwayRail — the signature component ───────────────────────── */

export function PrepRunwayRail({ scenario = SCENARIOS[0] }: { scenario?: Scenario }) {
  return (
    <div
      style={{
        background: c.carbon,
        border: `1px solid ${c.border}`,
        borderRadius: radius.lg,
        boxShadow: shadow.md,
        padding: sp["2xl"],
        fontFamily: font.ui,
      }}
    >
      <style>{STYLE}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: sp.lg }}>
        <div style={{ display: "flex", alignItems: "center", gap: sp.sm }}>
          <span style={{ color: c.gilt, display: "flex" }}>
            <Icon size={16}>{I.sparkle}</Icon>
          </span>
          <h2 style={{ fontFamily: font.display, fontSize: 17, fontWeight: 400, color: c.ivory, margin: 0 }}>Prep Runway</h2>
          <Pill bg={T.copper100} fg={c.giltDark} bd={T.copperBorder}>
            {scenario.archetype}
          </Pill>
        </div>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: c.stone, letterSpacing: 0.3 }}>
          {scenario.railLabel}
        </span>
      </div>

      {/* timeline */}
      <div style={{ position: "relative", display: "flex", gap: sp.md, overflowX: "auto", paddingBottom: 4 }}>
        {/* connecting line */}
        <div
          style={{
            position: "absolute",
            top: 17,
            left: 28,
            right: 28,
            height: 2,
            background: `linear-gradient(90deg, ${c.sage} 0%, ${c.gilt} 45%, ${c.border} 70%)`,
            borderRadius: 2,
          }}
        />
        {scenario.rail.map((n) => {
          const v = nodeVisual(n.state);
          return (
            <div key={n.tag} style={{ position: "relative", flex: "1 0 158px", minWidth: 158 }}>
              {/* node dot */}
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: v.fill,
                  border: `2px solid ${v.ring}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: v.fg,
                  position: "relative",
                  zIndex: 1,
                  boxShadow: n.state === "active" ? shadow.glow : "none",
                }}
              >
                <Icon size={16}>
                  {n.state === "done" ? I.check : n.state === "anchor" ? I.target : n.state === "active" ? I.play : I.clock}
                </Icon>
              </div>

              <div style={{ marginTop: sp.md }}>
                <div
                  style={{
                    fontFamily: font.mono,
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: 0.6,
                    color: v.fg,
                    marginBottom: 4,
                  }}
                >
                  {n.tag}
                  {typeof n.score === "number" && (
                    <span style={{ color: c.sage, marginLeft: 6 }} title="Mock score out of 100">
                      · scored {n.score}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.ivory, lineHeight: 1.25 }}>{n.title}</div>
                <div style={{ fontSize: 11.5, color: c.chalk, marginTop: 3, lineHeight: 1.35 }}>{n.detail}</div>

                {n.state === "active" && (
                  <button
                    className="cpr-tap"
                    style={{
                      marginTop: sp.sm,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      minHeight: 36,
                      background: c.slate,
                      color: c.carbon,
                      border: "none",
                      borderRadius: radius.sm,
                      padding: "8px 12px",
                      fontFamily: font.ui,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: shadow.sm,
                    }}
                  >
                    <Icon size={13}>{I.play}</Icon> Start practice
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: sp.lg,
          paddingTop: sp.md,
          borderTop: `1px solid ${c.borderSubtle}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: c.stone,
          fontFamily: font.ui,
        }}
      >
        <span style={{ color: c.gilt, display: "flex" }}>
          <Icon size={13}>{I.sparkle}</Icon>
        </span>
        Plan adapts to your scores and skill-decay. Sessions count against your Pro quota.
      </div>
    </div>
  );
}

/* ─── SuggestRunwaySheet — suggest-then-accept preview ────────────────── */

export function SuggestRunwaySheet() {
  const s = SCENARIOS[0];
  const [accepted, setAccepted] = useState<Record<string, boolean>>({ "T-7": true, "T-4": true, "T-2": true, "T-1": true });
  const sessions = s.rail.filter((n) => n.state !== "anchor" && n.tag !== "+2h");
  const count = Object.values(accepted).filter(Boolean).length;

  return (
    <div
      style={{
        width: "min(520px, 100vw - 32px)",
        boxSizing: "border-box",
        background: c.carbon,
        border: `1px solid ${c.border}`,
        borderRadius: radius.xl,
        boxShadow: shadow.lg,
        padding: sp["2xl"],
        fontFamily: font.ui,
      }}
    >
      <style>{STYLE}</style>
      <Eyebrow>Suggested for you</Eyebrow>
      <h2 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: c.ivory, margin: "6px 0 4px" }}>
        Build a Prep Runway for {s.company}?
      </h2>
      <p style={{ fontSize: 13, color: c.chalk, margin: 0, lineHeight: 1.5 }}>
        We mapped {sessions.length} practice sessions backward from your {s.role} interview on{" "}
        <strong style={{ color: c.ivory }}>Fri 20 Jun</strong>. Nothing is added to your calendar until you accept.
      </p>

      <div style={{ marginTop: sp.lg, display: "flex", flexDirection: "column", gap: sp.sm }}>
        {sessions.map((n) => {
          const on = accepted[n.tag];
          return (
            <button
              key={n.tag}
              className="cpr-tap"
              role="checkbox"
              aria-checked={on}
              aria-label={`${n.title}, ${n.tag}`}
              onClick={() => setAccepted((p) => ({ ...p, [n.tag]: !p[n.tag] }))}
              style={{
                display: "flex",
                alignItems: "center",
                gap: sp.md,
                textAlign: "left",
                background: on ? T.copper100Soft : c.graphite,
                border: `1px solid ${on ? T.copperBorder : c.border}`,
                borderRadius: radius.md,
                padding: "11px 14px",
                cursor: "pointer",
                transition: `background-color 0.15s ${ease.out}, border-color 0.15s ${ease.out}`,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: radius.sm,
                  background: on ? c.gilt : "transparent",
                  border: `1.5px solid ${on ? c.gilt : c.borderHover}`,
                  color: c.carbon,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {on && <Icon size={13}>{I.check}</Icon>}
              </span>
              <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 600, color: c.gilt, width: 30 }}>
                {n.tag}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.ivory }}>{n.title}</span>
                <span style={{ display: "block", fontSize: 11.5, color: c.chalk }}>{n.detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: sp.sm, marginTop: sp.lg }}>
        <button
          className="cpr-tap"
          style={{
            flex: 1,
            background: c.slate,
            color: c.carbon,
            border: "none",
            borderRadius: radius.md,
            padding: "13px 18px",
            fontFamily: font.ui,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: shadow.sm,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          Add {count} session{count === 1 ? "" : "s"} <Icon size={15}>{I.arrow}</Icon>
        </button>
        <button
          className="cpr-tap"
          style={{
            background: "transparent",
            color: c.chalk,
            border: `1px solid ${c.border}`,
            borderRadius: radius.md,
            padding: "13px 18px",
            fontFamily: font.ui,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

/* ─── mini month grid ────────────────────────────────────────────────── */

function MiniMonth() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const lead = 5; // Jun 2026 starts mid-week (mock)
  const today = 15;
  const events: Record<number, string> = { 16: "prep", 18: "prep", 20: "interview", 24: "offer" };
  const dow = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: sp.md }}>
        <h2 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 400, color: c.ivory, margin: 0 }}>June 2026</h2>
        <div style={{ display: "flex", gap: 2, color: c.stone }}>
          {[
            { label: "Previous month", d: "M15 6l-6 6 6 6" },
            { label: "Next month", d: "M9 6l6 6-6 6" },
          ].map((b) => (
            <button
              key={b.label}
              className="cpr-tap"
              aria-label={b.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                background: "transparent",
                border: "none",
                color: c.stone,
                cursor: "pointer",
                borderRadius: radius.sm,
              }}
            >
              <Icon size={16}>{<path d={b.d} />}</Icon>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {dow.map((d, i) => (
          <div
            key={i}
            style={{ textAlign: "center", fontFamily: font.mono, fontSize: 10, color: c.stone, padding: "2px 0" }}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {days.map((d) => {
          const ev = events[d];
          const isToday = d === today;
          const dot = ev === "interview" ? c.slate : ev === "offer" ? c.gilt : ev === "prep" ? c.sage : null;
          return (
            <div
              key={d}
              style={{
                aspectRatio: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.sm,
                fontFamily: font.mono,
                fontSize: 11.5,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? c.carbon : ev ? c.ivory : c.chalk,
                background: isToday ? c.gilt : ev ? T.copper100Soft : "transparent",
                position: "relative",
                cursor: "pointer",
              }}
            >
              {d}
              {dot && !isToday && (
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: dot, marginTop: 2 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── reminder + sync side cards ─────────────────────────────────────── */

function ReminderRow({ label, on }: { label: string; on?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
      <span style={{ fontSize: 12.5, color: c.ivory, fontFamily: font.ui }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, color: on ? c.sage : c.stone }}>
        <Icon size={14} stroke={c.stone}>{I.mail}</Icon>
        <Icon size={14} stroke={c.stone}>{I.push}</Icon>
        {on ? (
          <Pill bg={c.sageLight} fg={c.sage}>Set</Pill>
        ) : (
          <Pill bg={c.graphite} fg={c.stone} bd={c.border}>Off</Pill>
        )}
      </span>
    </div>
  );
}

/* ─── full page ──────────────────────────────────────────────────────── */

export default function CalendarPrepRunway() {
  const [active, setActive] = useState(0);
  const s = SCENARIOS[active];

  return (
    <div
      className="cpr-root"
      style={{
        background: c.obsidian,
        minHeight: "100%",
        padding: sp["3xl"],
        fontFamily: font.ui,
        color: c.ivory,
      }}
    >
      <style>{STYLE}</style>
      {/* header */}
      <div className="cpr-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.xl, marginBottom: sp["2xl"] }}>
        <div>
          <Eyebrow>Interview Readiness</Eyebrow>
          <h1 style={{ fontFamily: font.display, fontSize: 30, fontWeight: 400, color: c.ivory, margin: "4px 0 6px" }}>
            Calendar
          </h1>
          <p style={{ fontSize: 13.5, color: c.chalk, margin: 0, maxWidth: 460, lineHeight: 1.5 }}>
            Every interview you log becomes a prep plan, not just a date.
          </p>
        </div>
        <div className="cpr-actions" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: sp.sm }}>
          <button
            className="cpr-tap"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              background: c.slate,
              color: c.carbon,
              border: "none",
              borderRadius: radius.md,
              padding: "12px 20px",
              fontFamily: font.ui,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: shadow.lg,
            }}
          >
            <Icon size={16}>{I.plus}</Icon> Add interview
          </button>
          {/* natural-language entry hint */}
          <div
            className="cpr-nl"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: c.carbon,
              border: `1px solid ${c.border}`,
              borderRadius: radius.md,
              padding: "8px 12px",
              minWidth: 320,
            }}
          >
            <span style={{ color: c.gilt, display: "flex" }}>
              <Icon size={14}>{I.sparkle}</Icon>
            </span>
            <span style={{ fontSize: 12.5, color: c.stone, fontFamily: font.ui }}>
              “Amazon SDE phone screen Tuesday 3pm”
            </span>
          </div>
        </div>
      </div>

      {/* archetype switcher */}
      <div style={{ display: "flex", gap: sp.sm, marginBottom: sp.xl, flexWrap: "wrap" }}>
        {SCENARIOS.map((sc, i) => {
          const on = i === active;
          return (
            <button
              key={sc.key}
              className="cpr-tap"
              aria-pressed={on}
              onClick={() => setActive(i)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                background: on ? c.carbon : "transparent",
                border: `1px solid ${on ? T.copperBorder : c.border}`,
                borderRadius: radius.md,
                padding: "10px 16px",
                cursor: "pointer",
                boxShadow: on ? shadow.sm : "none",
                transition: `background-color 0.15s ${ease.out}, border-color 0.15s ${ease.out}, box-shadow 0.15s ${ease.out}`,
              }}
            >
              <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: on ? c.ivory : c.chalk }}>
                {sc.archetype}
              </span>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: on ? c.gilt : c.stone, letterSpacing: 0.3 }}>
                {sc.badge}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cpr-grid">
        {/* left rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: sp.lg }}>
          <Card pad={20}>
            <MiniMonth />
          </Card>

          <Card pad={20}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: sp.sm }}>
              <Icon size={15} stroke={c.gilt}>{I.bell}</Icon>
              <h2 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 400, color: c.ivory, margin: 0 }}>Reminders</h2>
            </div>
            <ReminderRow label="72 hours before" on />
            <ReminderRow label="24 hours before" on />
            <ReminderRow label="2 hours before" on />
            <ReminderRow label="Reflection · +2h after" on />
          </Card>

          <Card pad={20}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={16} stroke={c.slate}>{I.google}</Icon>
                <h2 style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory, margin: 0 }}>
                  Google Calendar
                </h2>
              </div>
              <Pill bg={c.sageLight} fg={c.sage} icon={<Icon size={11}>{I.check}</Icon>}>
                2-way
              </Pill>
            </div>
            <p style={{ fontSize: 12, color: c.stone, margin: "10px 0 0", lineHeight: 1.45, fontFamily: font.ui }}>
              Synced. We auto-detect interviews from your inbox for you to confirm.
            </p>
          </Card>
        </div>

        {/* main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: sp.xl }}>
          {/* interview hero card */}
          <Card pad={24} style={{ borderColor: T.copperBorder }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.lg }}>
              <div style={{ display: "flex", gap: sp.md }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: radius.md,
                    background: c.graphite,
                    border: `1px solid ${c.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: font.display,
                    fontSize: 24,
                    color: c.gilt,
                    flexShrink: 0,
                  }}
                >
                  {s.initial}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: sp.sm, marginBottom: 3 }}>
                    <h2 style={{ fontFamily: font.display, fontSize: 19, fontWeight: 400, color: c.ivory, margin: 0 }}>
                      {s.company} · {s.role}
                    </h2>
                    <Pill bg={c.slateLight} fg={c.slate}>{s.anchorLabel}</Pill>
                  </div>
                  <div style={{ fontSize: 13, color: c.chalk, fontFamily: font.ui }}>{s.round}</div>
                </div>
              </div>
              <Pill bg={T.copper100} fg={c.giltDark} bd={T.copperBorder} icon={<Icon size={11}>{I.clock}</Icon>}>
                {s.countdown}
              </Pill>
            </div>

            {/* dual timezone */}
            <div
              style={{
                marginTop: sp.lg,
                display: "flex",
                alignItems: "center",
                gap: sp.lg,
                padding: "14px 16px",
                background: c.graphite,
                borderRadius: radius.md,
                border: `1px solid ${c.borderSubtle}`,
              }}
            >
              <Icon size={18} stroke={c.gilt}>{I.globe}</Icon>
              <div>
                <div style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: c.ivory }}>{s.whenPrimary}</div>
                <div style={{ fontSize: 12, color: c.stone, fontFamily: font.ui, marginTop: 2 }}>{s.whenSecondary}</div>
              </div>
            </div>

            {/* Timezone-comfort note. Warning treatment ONLY when there's a
                real awkward-hour conflict; good news reads as calm/positive. */}
            {(s.awkward || s.key === "sprint") && (
              <div
                style={{
                  marginTop: sp.sm,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: s.awkward ? T.warningInk : c.sage,
                  background: s.awkward ? T.warning100 : c.sageLight,
                  border: `1px solid ${s.awkward ? T.warningLine : T.successMist}`,
                  borderRadius: radius.sm,
                  padding: "8px 12px",
                  fontFamily: font.ui,
                }}
              >
                <Icon size={14} stroke={s.awkward ? T.warningInk : c.sage}>
                  {s.awkward ? I.alert : I.check}
                </Icon>
                {s.awkward || "Comfortable evening slot in your timezone. No awkward-hour conflict."}
              </div>
            )}
          </Card>

          {/* the runway */}
          <PrepRunwayRail scenario={s} />
        </div>
      </div>
    </div>
  );
}
