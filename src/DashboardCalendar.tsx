"use client";
/* Interview Calendar & Prep Runway (PRI-35)
 *
 * The live /calendar surface. Visual language is the cream-brand redesign
 * (Prep Runway rail, interview hero, suggest-then-build sheet) wired to the
 * real DB-authoritative data layer: listEvents / saveEvent / deleteEvent /
 * generatePrepRunway / connectGoogleCalendar, with localStorage as a cache
 * only and Pro gating enforced both here and at the API.
 *
 * Centerpiece: every logged interview becomes a prep plan. Logging a real
 * interview auto-schedules an adaptive countdown of mock sessions (server
 * derived); the rail renders those sessions grouped under their interview.
 */
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { c, font, shadow, sp, radius, ease } from "./tokens";
import { tokens as T, shadows as eShadow } from "./auth/_tokens";
import { useAuth } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";
import { listEvents, saveEvent, deleteEvent, generatePrepRunway, connectGoogleCalendar, currentTimezone, type CalendarEventRow, type CalendarEventInput } from "./calendarAPI";
import {
  type InterviewEvent, loadEvents, saveEvents, generateEventId,
  daysUntilEvent, formatEventDate, formatEventTime,
  generateICS, generateGoogleCalendarURL, interviewTypeOptions,
  focusForType, COMMON_TIMEZONES, zonedWallTimeToUtc, formatTimeInZone,
  hourInZone, isAwkwardHour, describeReminders, parseNaturalEvent, timezoneLabel,
} from "./dashboardHelpers";
import { ROLE_SUGGESTIONS } from "./onboardingData";
import { COMPANY_SUGGESTIONS } from "../data/company-suggestions";
import { useDashboardUI, useDashboardSubscription, useDashboardSessions } from "./DashboardContext";
import { DataLoadingSkeleton, ProGate } from "./dashboardComponents";

/* Scoped stylesheet — inline styles can't express :focus-visible, media
 * queries, or :hover, so the responsive grid + keyboard focus rings live here. */
const STYLE = `
.cpr-tap { -webkit-tap-highlight-color: transparent; }
.cpr-tap:focus-visible { outline: 2px solid ${c.slate}; outline-offset: 2px; border-radius: ${radius.sm}px; }
/* minmax(0, 1fr) not bare 1fr: a 1fr track is implicitly minmax(auto, 1fr),
   so the month-grid child's wide min-content expands the track past the
   container and overflows the viewport at mobile widths. */
.cpr-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: ${sp.xl}px; align-items: start; }
@media (max-width: 880px) {
  .cpr-grid { grid-template-columns: minmax(0, 1fr); }
  .cpr-header { flex-direction: column; align-items: flex-start; }
  .cpr-actions { align-items: stretch !important; width: 100%; }
}
@keyframes cpr-scrim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cpr-modal-in { from { transform: translateY(10px) scale(0.985); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
.cpr-scrim { animation: cpr-scrim-in 0.16s cubic-bezier(0.16,1,0.3,1); }
.cpr-modal { animation: cpr-modal-in 0.2s cubic-bezier(0.16,1,0.3,1); }
@media (max-width: 560px) {
  .cpr-form-row { grid-template-columns: 1fr !important; }
}
@media (prefers-reduced-motion: reduce) {
  .cpr-scrim, .cpr-modal { animation: none; }
}
`;

/* ─── primitives ─────────────────────────────────────────────────── */

type IconProps = { children: React.ReactNode; size?: number; stroke?: string; sw?: number };
const Icon = ({ children, size = 18, stroke = "currentColor", sw = 1.6 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  x: <><path d="M18 6 6 18M6 6l12 12" /></>,
  cal: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  google: <><path d="M21 12.2c0-.6-.1-1.2-.2-1.7H12v3.4h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3a9 9 0 0 0 2.8-6.8z" /><path d="M12 21a9 9 0 0 0 6-2.2l-3-2.3a5.4 5.4 0 0 1-8-2.8H4v2.4A9 9 0 0 0 12 21z" /><path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V7.9H4a9 9 0 0 0 0 8.2z" /><path d="M12 6.6c1.2 0 2.3.4 3.2 1.3l2.4-2.4A9 9 0 0 0 4 7.9l3 2.4A5.4 5.4 0 0 1 12 6.6z" /></>,
};

function Card({ children, pad = 24, style }: { children: React.ReactNode; pad?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ background: c.carbon, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: pad, boxShadow: shadow.md, ...style }}>
      {children}
    </div>
  );
}

function Eyebrow({ children, color = c.gilt }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: 1.1, textTransform: "uppercase", color }}>
      {children}
    </span>
  );
}

function Pill({ children, bg, fg, bd, icon }: { children: React.ReactNode; bg: string; fg: string; bd?: string; icon?: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: radius.pill, background: bg, color: fg, border: bd ? `1px solid ${bd}` : "none", fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {icon}
      {children}
    </span>
  );
}

function Field({ label, htmlFor, required, children }: { label: string; htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: c.stone, display: "block", marginBottom: 7 }}>
        {label}{required && <span style={{ color: c.gilt }}> *</span>}
      </label>
      {children}
    </div>
  );
}

/* ─── DB row <-> UI event mapping ─── */
function rowToEvent(r: CalendarEventRow): InterviewEvent {
  return {
    id: r.id,
    title: r.title,
    company: r.company || "",
    role: r.role || undefined,
    type: r.type || "interview",
    date: r.date || (r.start_utc ? r.start_utc.slice(0, 10) : ""),
    time: r.time || "",
    duration: r.duration_minutes || 60,
    location: r.location || "",
    notes: r.notes || "",
    status: (["upcoming", "completed", "cancelled"].includes(r.status) ? r.status : "upcoming") as InterviewEvent["status"],
    reminders: Array.isArray(r.reminders) ? r.reminders.length > 0 : true,
    google_event_id: r.google_event_id || undefined,
    kind: r.kind === "prep-session" ? "prep-session" : "real",
    parentInterviewId: r.parent_interview_id || undefined,
    start_utc: r.start_utc || undefined,
    end_utc: r.end_utc || undefined,
    timezone: r.timezone || undefined,
  };
}

function eventToInput(ev: InterviewEvent, opts: { withId: boolean }): CalendarEventInput {
  // Resolve the wall-clock entry in the event's own zone to an absolute instant,
  // so an interview entered in US Pacific lands at the right UTC moment instead
  // of the candidate's browser zone. Falls back to the candidate zone if unset.
  const tz = ev.timezone || currentTimezone();
  const start_utc = zonedWallTimeToUtc(ev.date, ev.time, tz) ?? undefined;
  return {
    ...(opts.withId ? { id: ev.id } : {}),
    title: ev.title,
    company: ev.company,
    role: ev.role || "",
    type: ev.type,
    date: ev.date,
    time: ev.time,
    timezone: tz,
    duration: ev.duration,
    location: ev.location,
    notes: ev.notes,
    status: ev.status,
    reminders: ev.reminders,
    start_utc,
    kind: "real",
    source: "manual",
  };
}

/* ─── runway derivation ─── prep-session children → timeline nodes ─── */
type RunwayState = "done" | "active" | "upcoming" | "anchor";
interface RunwayNode { id: string; tag: string; title: string; detail: string; state: RunwayState; }

function tsOf(ev: InterviewEvent): number {
  const d = new Date(`${ev.date}T${ev.time || "00:00"}`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/* Split a server-authored runway title like "Amazon mock · T-2" into its label
 * and the countdown marker, so the timeline tag never duplicates the title and
 * the marker stays the server's (e.g. "T+2h"), not a re-derived one. */
function splitRunwayTitle(raw: string): { title: string; suffix: string | null } {
  const m = raw.match(/^(.*?)\s*·\s*(T[-+]?\S[^·]*)$/i);
  return m ? { title: m[1].trim(), suffix: m[2].trim() } : { title: raw.trim(), suffix: null };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function buildRunway(interview: InterviewEvent, all: InterviewEvent[]): RunwayNode[] {
  const children = all
    .filter((e) => e.kind === "prep-session" && e.parentInterviewId === interview.id && e.status !== "cancelled")
    .sort((a, b) => tsOf(a) - tsOf(b));
  const now = Date.now();
  const anchorTs = tsOf(interview);
  const firstUpcoming = children.findIndex((e) => tsOf(e) >= now);

  const nodes: RunwayNode[] = children.map((e, i) => {
    const dayDiff = Math.round((tsOf(e) - anchorTs) / 86_400_000);
    const { title, suffix } = splitRunwayTitle(e.title);
    const tag = suffix || (dayDiff === 0 ? "T-0" : `T${dayDiff}`);
    const state: RunwayState = tsOf(e) < now ? "done" : i === firstUpcoming ? "active" : "upcoming";
    return { id: e.id, tag, title, detail: capitalize(e.type) || "Mock session", state };
  });
  nodes.push({ id: interview.id, tag: "T-0", title: `${interview.company || interview.title}`, detail: "The real interview", state: "anchor" });
  return nodes;
}

function nodeVisual(state: RunwayState) {
  switch (state) {
    case "done": return { ring: c.sage, fill: c.sageLight, fg: c.sage };
    case "active": return { ring: c.gilt, fill: T.copper100, fg: c.gilt };
    case "anchor": return { ring: c.slate, fill: c.slateLight, fg: c.slate };
    default: return { ring: c.borderHover, fill: c.graphite, fg: c.stone };
  }
}

function countdownLabel(ev: InterviewEvent): string {
  const d = daysUntilEvent(ev.date, ev.time);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 14) return `in ${d} days`;
  return `in ${Math.round(d / 7)} weeks`;
}

/* ─── PrepRunwayRail — real prep sessions for one interview ─── */
function PrepRunwayRail({ interview, all, onStart, onBuild, building }: {
  interview: InterviewEvent;
  all: InterviewEvent[];
  onStart: () => void;
  onBuild: () => void;
  building: boolean;
}) {
  const nodes = buildRunway(interview, all);
  const hasPrep = nodes.length > 1;

  return (
    <div style={{ background: c.carbon, border: `1px solid ${c.border}`, borderRadius: radius.lg, boxShadow: shadow.md, padding: sp["2xl"], fontFamily: font.ui }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: sp.lg, gap: sp.md, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: sp.sm }}>
          <span style={{ color: c.gilt, display: "flex" }}><Icon size={16}>{I.sparkle}</Icon></span>
          <h2 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 400, color: c.ivory, margin: 0 }}>Prep Runway</h2>
          {hasPrep && <Pill bg={T.copper100} fg={c.giltDark} bd={T.copperBorder}>{nodes.length - 1} sessions</Pill>}
        </div>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: c.stone, letterSpacing: 0.3 }}>
          Mock-session countdown
        </span>
      </div>

      {hasPrep ? (
        <div style={{ position: "relative", display: "flex", gap: sp.md, overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ position: "absolute", top: 17, left: 28, right: 28, height: 2, background: `linear-gradient(90deg, ${c.sage} 0%, ${c.gilt} 45%, ${c.border} 70%)`, borderRadius: 2 }} />
          {nodes.map((n) => {
            const v = nodeVisual(n.state);
            return (
              <div key={n.id} style={{ position: "relative", flex: "1 0 158px", minWidth: 158 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: v.fill, border: `2px solid ${v.ring}`, display: "flex", alignItems: "center", justifyContent: "center", color: v.fg, position: "relative", zIndex: 1, boxShadow: n.state === "active" ? shadow.glow : "none" }}>
                  <Icon size={16}>{n.state === "done" ? I.check : n.state === "anchor" ? I.target : n.state === "active" ? I.play : I.clock}</Icon>
                </div>
                <div style={{ marginTop: sp.md }}>
                  <div style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6, color: v.fg, marginBottom: 4 }}>{n.tag}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.ivory, lineHeight: 1.25 }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: c.chalk, marginTop: 3, lineHeight: 1.35 }}>{n.detail}</div>
                  {n.state === "active" && (
                    <button className="cpr-tap" onClick={onStart} style={{ marginTop: sp.sm, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, minHeight: 36, background: c.slate, color: c.carbon, border: "none", borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, cursor: "pointer", boxShadow: shadow.sm }}>
                      <Icon size={13}>{I.play}</Icon> Start practice
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: sp.md, padding: "8px 0" }}>
          <p style={{ fontSize: 13, color: c.chalk, margin: 0, lineHeight: 1.5, maxWidth: 440 }}>
            No prep sessions yet. Build a countdown of AI mock interviews mapped backward from this date, so you walk in ready.
          </p>
          <button className="cpr-tap" onClick={onBuild} disabled={building} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: c.slate, color: c.carbon, border: "none", borderRadius: radius.md, padding: "11px 18px", fontFamily: font.ui, fontSize: 13, fontWeight: 600, cursor: building ? "default" : "pointer", opacity: building ? 0.7 : 1, boxShadow: shadow.sm }}>
            <Icon size={15}>{I.sparkle}</Icon> {building ? "Building…" : "Build Prep Runway"}
          </button>
        </div>
      )}

      <div style={{ marginTop: sp.lg, paddingTop: sp.md, borderTop: `1px solid ${c.borderSubtle}`, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.stone, fontFamily: font.ui }}>
        <span style={{ color: c.gilt, display: "flex" }}><Icon size={13}>{I.sparkle}</Icon></span>
        Plan adapts to your scores and skill-decay. Sessions count against your Pro quota.
      </div>
    </div>
  );
}

/* ─── Mini month grid (real events, real navigation) ─── */
function MiniMonth({ events, focusedId, onDateClick }: { events: InterviewEvent[]; focusedId: string | null; onDateClick: (date: string) => void }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, InterviewEvent[]>();
    events.forEach((ev) => {
      const existing = map.get(ev.date) || [];
      existing.push(ev);
      map.set(ev.date, existing);
    });
    return map;
  }, [events]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dow = ["S", "M", "T", "W", "T", "F", "S"];

  const focused = focusedId ? events.find((e) => e.id === focusedId) : undefined;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: sp.md }}>
        <h2 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 400, color: c.ivory, margin: 0 }}>{monthLabel}</h2>
        <div style={{ display: "flex", gap: 2 }}>
          {[
            { label: "Previous month", d: "M15 6l-6 6 6 6", go: () => setViewDate(new Date(year, month - 1, 1)) },
            { label: "Next month", d: "M9 6l6 6-6 6", go: () => setViewDate(new Date(year, month + 1, 1)) },
          ].map((b) => (
            <button key={b.label} className="cpr-tap" aria-label={b.label} onClick={b.go} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "transparent", border: "none", color: c.stone, cursor: "pointer", borderRadius: radius.sm }}>
              <Icon size={16}>{<path d={b.d} />}</Icon>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 }}>
        {dow.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontFamily: font.mono, fontSize: 10, color: c.stone, padding: "2px 0" }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`lead-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayEvents = eventsByDate.get(dateStr) || [];
          const hasEvent = dayEvents.length > 0;
          const isToday = dateStr === todayStr;
          const isFocused = focused?.date === dateStr;
          const real = dayEvents.some((e) => e.kind !== "prep-session");
          const dot = real ? c.slate : c.sage;
          return (
            <button key={dateStr} className="cpr-tap" disabled={!hasEvent} onClick={() => hasEvent && onDateClick(dateStr)}
              title={hasEvent ? dayEvents.map((e) => e.title).join(", ") : undefined}
              style={{
                aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                borderRadius: radius.sm, fontFamily: font.mono, fontSize: 11.5, fontWeight: isToday ? 700 : 400,
                color: isToday ? c.carbon : hasEvent ? c.ivory : c.chalk,
                background: isToday ? c.gilt : isFocused ? T.copper100 : hasEvent ? T.copper100Soft : "transparent",
                border: "none", cursor: hasEvent ? "pointer" : "default", position: "relative",
              }}>
              {d}
              {hasEvent && !isToday && <span style={{ width: 4, height: 4, borderRadius: "50%", background: dot, marginTop: 2 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReminderRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
      <span style={{ fontSize: 12.5, color: c.ivory, fontFamily: font.ui }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={14} stroke={c.stone}>{I.mail}</Icon>
        {on ? <Pill bg={c.sageLight} fg={c.sage}>Set</Pill> : <Pill bg={c.graphite} fg={c.stone} bd={c.border}>Off</Pill>}
      </span>
    </div>
  );
}

export default function CalendarPage() {
  useDocTitle("Calendar");
  const router = useRouter();
  // Launch a mock pre-configured for the interview being prepped: deep-link the
  // setup screen with the company + round focus + role so the candidate isn't
  // retyping what they already logged. focusForType maps the calendar round
  // label onto the mock-session focus vocabulary SessionSetup understands.
  const startMock = (ev: InterviewEvent | null) => {
    const params = new URLSearchParams();
    if (ev?.company) params.set("company", ev.company);
    if (ev?.role) params.set("role", ev.role);
    const focus = focusForType(ev?.type);
    if (focus) params.set("type", focus);
    const qs = params.toString();
    router.push(qs ? `/session/new?${qs}` : "/session/new");
  };
  const { eventsLoading } = useDashboardSessions();
  const { setShowUpgradeModal, showToast } = useDashboardUI();
  const { isFree } = useDashboardSubscription();
  const { user } = useAuth();
  const [events, setEvents] = useState<InterviewEvent[]>(loadEvents);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [exportTooltip, setExportTooltip] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [buildingRunway, setBuildingRunway] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formType, setFormType] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("10:00");
  const [formTimezone, setFormTimezone] = useState(() => currentTimezone());
  const [formDuration, setFormDuration] = useState(60);
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formReminders, setFormReminders] = useState(true);
  const [formQuickAdd, setFormQuickAdd] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    listEvents().then((res) => {
      if (cancelled || !res.ok) return;
      const mapped = res.events.map(rowToEvent);
      setEvents((prev) => {
        const dbIds = new Set(mapped.map((e) => e.id));
        // Keep a local-only row only if it's an unsynced pending edit. A row
        // that's absent from the DB and not pending was deleted server-side, so
        // dropping it here is what prevents deleted interviews from resurrecting.
        const localOnly = prev.filter((e) => !dbIds.has(e.id) && e._pendingSync);
        const merged = [...mapped, ...localOnly];
        saveEvents(merged);
        return merged;
      });
    }).catch(() => { /* keep localStorage cache on failure */ });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Surface the outcome of the Google OAuth round-trip.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = new URLSearchParams(window.location.search).get("google");
    if (!flag) return;
    const messages: Record<string, string> = {
      connected: "Google Calendar connected. Your interviews now sync both ways.",
      denied: "Google Calendar connection cancelled.",
      retry: "Google did not return access. Please try connecting again.",
      error: "Could not connect Google Calendar. Please try again.",
      unavailable: "Google Calendar sync is not available yet.",
    };
    showToast(messages[flag] || messages.error);
    if (flag === "connected") {
      setGoogleConnected(true);
      listEvents().then((res) => {
        if (!res.ok) return;
        const next = res.events.map(rowToEvent);
        setEvents(next);
        saveEvents(next);
      }).catch(() => {});
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("google");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the add/edit sheet on Escape, and lock body scroll while it's open
  // so the page behind the scrim stays put.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowForm(false); setEditingId(null); } };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showForm]);

  const updateEvents = (next: InterviewEvent[]) => {
    setEvents(next);
    saveEvents(next);
  };

  const handleConnectGoogle = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    try {
      const res = await connectGoogleCalendar();
      if (res.unavailable) {
        setGoogleUnavailable(true);
        showToast("Google Calendar sync is not available yet.");
        return;
      }
      if (res.upgradeRequired) {
        setShowUpgradeModal(true);
        return;
      }
      if (res.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      showToast(res.error || "Could not start Google Calendar connection.");
    } finally {
      setGoogleBusy(false);
    }
  };

  if (eventsLoading) return <DataLoadingSkeleton />;
  // Calendar is available on any PAID plan (Starter/Sprint Pack + Pro); only
  // the free tier hits the gate. Prep reminders and countdowns are basic
  // "don't miss your interview" utility a paying user reasonably expects.
  if (isFree) return <ProGate feature="Interview Calendar" onUpgrade={() => setShowUpgradeModal(true)} />;

  const resetForm = () => {
    setFormTitle("");
    setFormCompany(user?.targetCompany || "");
    setFormRole(user?.targetRole || "");
    setFormType("");
    setFormDate("");
    setFormTime("10:00");
    setFormTimezone(currentTimezone());
    setFormDuration(60);
    setFormLocation("");
    setFormNotes("");
    setFormReminders(true);
    setFormQuickAdd("");
    setFormError("");
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setFormCompany(user?.targetCompany || "");
    setFormRole(user?.targetRole || "");
    setShowForm(true);
  };

  const openEditForm = (ev: InterviewEvent) => {
    setFormTitle(ev.title);
    setFormCompany(ev.company);
    setFormRole(ev.role || "");
    setFormType(ev.type === "interview" ? "" : ev.type);
    setFormDate(ev.date);
    setFormTime(ev.time);
    setFormTimezone(ev.timezone || currentTimezone());
    setFormDuration(ev.duration);
    setFormLocation(ev.location);
    setFormNotes(ev.notes);
    setFormReminders(ev.reminders);
    setFormQuickAdd("");
    setFormError("");
    setEditingId(ev.id);
    setShowForm(true);
  };

  // Apply a natural-language phrase ("Amazon SDE phone screen tuesday 3pm") to
  // the form fields the parser is confident about, leaving the rest for review.
  const applyQuickAdd = () => {
    const parsed = parseNaturalEvent(formQuickAdd, new Date());
    if (parsed.company) setFormCompany(parsed.company);
    if (parsed.type) setFormType(parsed.type);
    if (parsed.date) setFormDate(parsed.date);
    if (parsed.time) setFormTime(parsed.time);
  };

  const schedulePrepRunway = async (parentId: string, base: InterviewEvent[]) => {
    const res = await generatePrepRunway(parentId);
    if (!res.ok || res.events.length === 0) return;
    const prep = res.events.map(rowToEvent);
    const known = new Set(base.map((e) => e.id));
    const merged = [...base, ...prep.filter((p) => !known.has(p.id))];
    updateEvents(merged);
    if (!res.alreadyGenerated) showToast(`Prep Runway scheduled. ${prep.length} sessions added.`);
  };

  const handleBuildRunway = async (parentId: string) => {
    if (buildingRunway) return;
    setBuildingRunway(true);
    try {
      await schedulePrepRunway(parentId, events);
    } finally {
      setBuildingRunway(false);
    }
  };

  // Title is optional in the UI: a company + round is enough to identify an
  // interview, so derive a sensible one when the field is left blank rather than
  // forcing the candidate to restate what they already picked.
  const derivedTitle = (): string => {
    const t = formTitle.trim();
    if (t) return t;
    const round = formType && formType !== "Other" ? formType : "Interview";
    if (formCompany.trim()) return `${formCompany.trim()} ${round}`;
    if (formRole.trim()) return `${formRole.trim()} ${round}`;
    return round;
  };

  const handleSave = async () => {
    if (!formDate || !formTime) {
      setFormError(!formDate ? "Date is required." : "Time is required.");
      return;
    }
    if (!editingId) {
      // Compare against the absolute instant in the event's own zone, so a US
      // morning slot entered from India isn't wrongly rejected as "in the past".
      const startUtc = zonedWallTimeToUtc(formDate, formTime, formTimezone);
      if (startUtc && Date.parse(startUtc) < Date.now()) {
        setFormError("Interview date and time cannot be in the past.");
        return;
      }
    }
    setFormError("");
    const draft: InterviewEvent = {
      id: editingId || generateEventId(),
      title: derivedTitle(),
      company: formCompany,
      role: formRole.trim() || undefined,
      type: formType || "interview",
      date: formDate,
      time: formTime,
      timezone: formTimezone,
      duration: formDuration,
      location: formLocation,
      notes: formNotes,
      status: "upcoming",
      reminders: formReminders,
      kind: "real",
    };

    setSaving(true);
    let res = await saveEvent(eventToInput(draft, { withId: !!editingId }));
    if (!res.ok && editingId && res.status === 404) {
      res = await saveEvent(eventToInput(draft, { withId: false }));
    }
    setSaving(false);

    if (res.ok && res.event) {
      const saved = rowToEvent(res.event);
      const base = editingId ? events.map((e) => (e.id === editingId ? saved : e)) : [...events, saved];
      updateEvents(base);
      setFocusedId(saved.id);
      if (!editingId && saved.status === "upcoming") {
        void schedulePrepRunway(saved.id, base);
      }
    } else if (res.error && res.status === 403) {
      setFormError(res.error);
      setShowUpgradeModal(true);
      return;
    } else {
      // Cloud write failed (non-403): keep the edit locally and flag it pending
      // so the next DB refresh preserves it rather than treating it as deleted.
      const pending: InterviewEvent = { ...draft, _pendingSync: true };
      updateEvents(editingId ? events.map((e) => (e.id === editingId ? pending : e)) : [...events, pending]);
      showToast(res.error || "Saved locally. Cloud sync failed.");
    }
    setShowForm(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    // Optimistic remove, but roll back if the server rejects it (anything but a
    // 404, which means it's already gone). Without the rollback the row would
    // vanish from the UI yet reappear on the next refresh, which reads as a bug.
    const prevEvents = events;
    const prevFocused = focusedId;
    // Drop the interview AND its prep-session children. The server cascade-deletes
    // the runway it generated; mirroring that here keeps the month-grid markers
    // from lingering until the next reload.
    updateEvents(events.filter((e) => e.id !== id && e.parentInterviewId !== id));
    if (focusedId === id) setFocusedId(null);
    const res = await deleteEvent(id);
    if (!res.ok && res.status !== 404) {
      updateEvents(prevEvents);
      if (prevFocused === id) setFocusedId(id);
      showToast(res.error || "Could not delete interview. Please try again.");
    }
  };

  const handleCancel = async (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const prevEvents = events;
    const cancelled = { ...ev, status: "cancelled" as const };
    updateEvents(events.map((e) => (e.id === id ? cancelled : e)));
    const res = await saveEvent(eventToInput(cancelled, { withId: true }));
    if (!res.ok && res.status !== 404) {
      updateEvents(prevEvents);
      showToast(res.error || "Could not cancel interview. Please try again.");
    }
  };

  const handleExportICS = (ev: InterviewEvent) => {
    const ics = generateICS(ev);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ev.company.replace(/\s/g, "_")}_${ev.type.replace(/\s/g, "_")}_${ev.date}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setExportTooltip(ev.id);
    setTimeout(() => setExportTooltip(null), 2000);
  };

  // Real interviews only (prep sessions live inside the runway, not the lists).
  const reals = events.filter((e) => e.kind !== "prep-session");
  const upcoming = reals
    .filter((e) => e.status === "upcoming" && daysUntilEvent(e.date, e.time) >= 0)
    .sort((a, b) => tsOf(a) - tsOf(b));
  const past = reals
    .filter((e) => e.status === "completed" || (e.status === "upcoming" && daysUntilEvent(e.date, e.time) < 0))
    .sort((a, b) => tsOf(b) - tsOf(a));
  const cancelled = reals.filter((e) => e.status === "cancelled");

  const focused = (focusedId ? upcoming.find((e) => e.id === focusedId) : undefined) || upcoming[0] || null;

  const inputStyle = {
    width: "100%", padding: "11px 14px", fontFamily: font.ui, fontSize: 13.5,
    color: c.ivory, background: c.obsidian, border: `1px solid ${c.borderHover}`,
    borderRadius: radius.md, outline: "none", boxSizing: "border-box" as const,
    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
  };

  // App-standard form focus: copper border + soft copper ring (mirrors the
  // settingsSections focusIn/focusOut treatment used across the product).
  const fieldFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = T.copper;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${T.copper100}`;
  };
  const fieldBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = c.borderHover;
    e.currentTarget.style.boxShadow = "none";
  };

  // Awkward-hour heuristic for the focused interview (Indian candidates often
  // interview at US/EU hours). Evaluated against the candidate's own zone using
  // the authoritative UTC instant, so a US-evening slot reads correctly here.
  const heroTz = currentTimezone();
  const heroStartUtc = focused ? (focused.start_utc || zonedWallTimeToUtc(focused.date, focused.time, focused.timezone || heroTz)) : null;
  const awkward = heroStartUtc ? isAwkwardHour(hourInZone(heroStartUtc, heroTz)) : false;
  // Show the candidate-local equivalent when the interview was authored in a
  // different zone (cross-zone interview).
  const heroForeignZone = !!focused && !!focused.timezone && focused.timezone !== heroTz;
  const heroLocalLabel = heroStartUtc && heroForeignZone ? formatTimeInZone(heroStartUtc, heroTz) : "";

  // Hero labels: keep what we display aligned to what the user actually entered.
  // A blank or "Other" round shouldn't leak into the UI as "· Other",
  // "Practice Other", or a generic round chip.
  const heroName = focused ? focused.company || focused.title : "";
  const heroRound = focused && focused.type && focused.type !== "Other" ? focused.type : null;
  const heroSub = focused && focused.title && focused.title !== heroName ? focused.title : null;
  const practiceLabel = heroRound ? `Practice ${heroRound}` : "Start mock interview";

  // Live preview for the add/edit sheet. The entered time is in formTimezone;
  // show the candidate-local equivalent when those differ (cross-zone interview),
  // warn on awkward home-zone hours, and state which reminders will actually fire.
  const candidateTz = currentTimezone();
  const previewStartUtc = zonedWallTimeToUtc(formDate, formTime, formTimezone);
  const showDualTime = !!previewStartUtc && formTimezone !== candidateTz;
  const candidateLocalLabel = previewStartUtc ? formatTimeInZone(previewStartUtc, candidateTz) : "";
  const formAwkward = previewStartUtc ? isAwkwardHour(hourInZone(previewStartUtc, candidateTz)) : false;
  const reminderCopy = describeReminders(previewStartUtc, Date.now());
  const canSave = !!formDate && !!formTime && !saving;

  return (
    <div style={{ fontFamily: font.ui, color: c.ivory, maxWidth: 1280, margin: "0 auto" }}>
      <style>{STYLE}</style>

      {/* header */}
      <div className="cpr-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.xl, marginBottom: sp["2xl"] }}>
        <div>
          <Eyebrow>Interview Readiness</Eyebrow>
          <h1 style={{ fontFamily: font.display, fontSize: 30, fontWeight: 400, color: c.ivory, margin: "4px 0 6px" }}>Calendar</h1>
          <p style={{ fontSize: 13.5, color: c.chalk, margin: 0, maxWidth: 460, lineHeight: 1.5 }}>
            Every interview you log becomes a prep plan, not just a date.
          </p>
        </div>
        <div className="cpr-actions" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: sp.sm }}>
          <button className="cpr-tap" onClick={openNewForm} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: c.slate, color: c.carbon, border: "none", borderRadius: radius.md, padding: "12px 20px", fontFamily: font.ui, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: shadow.lg }}>
            <Icon size={16}>{I.plus}</Icon> Add interview
          </button>
        </div>
      </div>

      {/* interview switcher */}
      {upcoming.length > 0 && (
        <div style={{ display: "flex", gap: sp.sm, marginBottom: sp.xl, flexWrap: "wrap" }}>
          {upcoming.map((ev) => {
            const on = focused?.id === ev.id;
            return (
              <button key={ev.id} className="cpr-tap" aria-pressed={on} onClick={() => setFocusedId(ev.id)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, background: on ? c.carbon : "transparent", border: `1px solid ${on ? T.copperBorder : c.border}`, borderRadius: radius.md, padding: "10px 16px", cursor: "pointer", boxShadow: on ? shadow.sm : "none", transition: `background-color 0.15s ${ease.out}, border-color 0.15s ${ease.out}` }}>
                <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: on ? c.ivory : c.chalk }}>{ev.company || ev.title}</span>
                <span style={{ fontFamily: font.mono, fontSize: 10, color: on ? c.gilt : c.stone, letterSpacing: 0.3 }}>{formatEventDate(ev.date)} · {ev.type}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal — centered dialog over a dimmed, blurred scrim, matching
          the app's one dialog vocabulary (EndModal / UpgradeModal). Closes on
          scrim click or Escape.
          Portaled to <body>: the dashboard page wrapper (.dash-page-enter) keeps
          a forwards-filled transform after its enter animation, which would
          otherwise make this fixed overlay a containing block and trap it inside
          the content column instead of covering the viewport. */}
      {showForm && typeof document !== "undefined" && createPortal(
        /* Backdrop click-to-dismiss is a convenience; keyboard users dismiss with Escape. */
        /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
        <div className="cpr-scrim" onClick={() => { setShowForm(false); resetForm(); }}
          style={{ position: "fixed", inset: 0, zIndex: 120, background: T.coalOverlay, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: sp.xl }}>
          {/* Panel stops backdrop-close propagation only; the dialog itself is labelled and focus-managed. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <div className="cpr-modal" role="dialog" aria-modal="true" aria-labelledby="cal-modal-title" onClick={(e) => e.stopPropagation()}
            style={{ width: "min(520px, 100%)", maxHeight: "92vh", background: c.carbon, border: `1px solid ${c.border}`, borderRadius: 20, boxShadow: eShadow.modal, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "24px 28px 18px", borderBottom: `1px solid ${c.borderSubtle}` }}>
              <div>
                <Eyebrow>{editingId ? "Edit" : "New"}</Eyebrow>
                <h3 id="cal-modal-title" style={{ fontFamily: font.display, fontSize: 23, fontWeight: 400, color: c.ivory, margin: "5px 0 0" }}>{editingId ? "Edit interview" : "Add an interview"}</h3>
              </div>
              <button className="cpr-tap" onClick={() => { setShowForm(false); resetForm(); }} aria-label="Close" style={{ background: "none", border: "none", color: c.stone, cursor: "pointer", padding: 6, marginTop: 2, display: "flex", borderRadius: radius.sm }}>
                <Icon size={20}>{I.x}</Icon>
              </button>
            </div>

            {/* scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
              {/* natural-language quick add — type a phrase, we fill the form */}
              {!editingId && (
                <div>
                  <label htmlFor="cal-quick" style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: c.stone, display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                    <span style={{ color: c.gilt, display: "flex" }}><Icon size={12}>{I.sparkle}</Icon></span> Quick add
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input id="cal-quick" value={formQuickAdd} onChange={(e) => setFormQuickAdd(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuickAdd(); } }}
                      placeholder="Amazon SDE phone screen tuesday 3pm" style={inputStyle} onFocus={fieldFocus} onBlur={fieldBlur} />
                    <button className="cpr-tap" onClick={applyQuickAdd} disabled={!formQuickAdd.trim()}
                      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, background: formQuickAdd.trim() ? c.graphite : "transparent", color: formQuickAdd.trim() ? c.ivory : c.stone, border: `1px solid ${c.border}`, borderRadius: radius.md, padding: "0 16px", fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, cursor: formQuickAdd.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                      Fill
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: c.stone, margin: "6px 0 0", fontFamily: font.ui }}>We fill what we can. Review the fields below before saving.</p>
                </div>
              )}

              <Field label="Company" htmlFor="cal-company">
                <input id="cal-company" list="cal-company-list" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="e.g. Google" style={inputStyle}
                  onFocus={fieldFocus} onBlur={fieldBlur} />
                <datalist id="cal-company-list">
                  {COMPANY_SUGGESTIONS.slice(0, 200).map((co) => <option key={co} value={co} />)}
                </datalist>
              </Field>

              <Field label="Role / position" htmlFor="cal-role">
                <input id="cal-role" list="cal-role-list" value={formRole} onChange={(e) => setFormRole(e.target.value)} placeholder="e.g. Software Engineer" style={inputStyle}
                  onFocus={fieldFocus} onBlur={fieldBlur} />
                <datalist id="cal-role-list">
                  {ROLE_SUGGESTIONS.slice(0, 200).map((r) => <option key={r} value={r} />)}
                </datalist>
              </Field>

              <Field label="Interview round">
                <div role="group" aria-label="Interview round" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {interviewTypeOptions.map((t) => {
                    const on = formType === t;
                    return (
                      <button key={t} className="cpr-tap" aria-pressed={on} onClick={() => setFormType(on ? "" : t)} style={{
                        fontFamily: font.ui, fontSize: 12, fontWeight: 500, padding: "6px 13px", borderRadius: radius.pill, cursor: "pointer",
                        background: on ? T.copper100Soft : "transparent",
                        border: `1px solid ${on ? c.gilt : c.border}`,
                        color: on ? c.gilt : c.stone, transition: `all 0.2s ${ease.out}`,
                      }}>{t}</button>
                    );
                  })}
                </div>
              </Field>

              <div className="cpr-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Date" htmlFor="cal-date" required>
                  <input id="cal-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ ...inputStyle, colorScheme: "light" }} onFocus={fieldFocus} onBlur={fieldBlur} />
                </Field>
                <Field label="Time" htmlFor="cal-time" required>
                  <input id="cal-time" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} style={{ ...inputStyle, colorScheme: "light" }} onFocus={fieldFocus} onBlur={fieldBlur} />
                </Field>
              </div>

              <div className="cpr-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Timezone" htmlFor="cal-tz">
                  <select id="cal-tz" value={formTimezone} onChange={(e) => setFormTimezone(e.target.value)} style={{ ...inputStyle, colorScheme: "light" }} onFocus={fieldFocus} onBlur={fieldBlur}>
                    {/* the entered time is read in this zone; default is the candidate's own */}
                    {!COMMON_TIMEZONES.some((z) => z.id === formTimezone) && <option value={formTimezone}>{formTimezone}</option>}
                    {COMMON_TIMEZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
                  </select>
                </Field>
                <Field label="Duration" htmlFor="cal-duration">
                  <select id="cal-duration" value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value))} style={{ ...inputStyle, colorScheme: "light" }} onFocus={fieldFocus} onBlur={fieldBlur}>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </Field>
              </div>

              {/* cross-zone clarity: the entered time is in the chosen zone; show
                  the candidate-local equivalent, and warn on awkward home hours */}
              {showDualTime && candidateLocalLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: c.chalk, background: c.graphite, border: `1px solid ${c.borderSubtle}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui }}>
                  <Icon size={14} stroke={c.gilt}>{I.globe}</Icon>
                  That is <strong style={{ color: c.ivory, fontWeight: 600 }}>{candidateLocalLabel}</strong> your time in {timezoneLabel(candidateTz)}.
                </div>
              )}
              {formAwkward && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.warningInk, background: T.warning100, border: `1px solid ${T.warningLine}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui }}>
                  <Icon size={14} stroke={T.warningInk}>{I.alert}</Icon>
                  Early or late slot in your timezone. Plan rest so you are sharp.
                </div>
              )}

              <Field label="Title (optional)" htmlFor="cal-title">
                <input id="cal-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder={formCompany.trim() ? `${formCompany.trim()} ${formType && formType !== "Other" ? formType : "Interview"}` : "Auto-named from company and round"} style={inputStyle}
                  onFocus={fieldFocus} onBlur={fieldBlur} />
              </Field>

              <Field label="Location / link" htmlFor="cal-location">
                <input id="cal-location" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Zoom link, Google Meet, or address" style={inputStyle}
                  onFocus={fieldFocus} onBlur={fieldBlur} />
              </Field>

              <Field label="Notes" htmlFor="cal-notes">
                <textarea id="cal-notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Interviewer name, prep topics, things to remember..." rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={fieldFocus} onBlur={fieldBlur} />
              </Field>

              {/* reminders — app-standard indigo toggle */}
              <div role="switch" aria-checked={formReminders} tabIndex={0} className="cpr-tap" onClick={() => setFormReminders(!formReminders)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFormReminders(!formReminders); } }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: radius.md, border: `1px solid ${c.border}`, background: c.obsidian, cursor: "pointer" }}>
                <span style={{ width: 44, height: 24, borderRadius: 12, padding: 3, flexShrink: 0, background: formReminders ? c.slate : c.borderHover, transition: "background 0.2s" }}>
                  <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: c.carbon, transform: formReminders ? "translateX(20px)" : "translateX(0)", transition: "transform 0.2s", boxShadow: shadow.sm }} />
                </span>
                <span>
                  <span style={{ display: "block", fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory }}>Reminders</span>
                  <span style={{ display: "block", fontFamily: font.ui, fontSize: 11.5, color: c.stone, marginTop: 1 }}>{formReminders ? reminderCopy : "Off. No email reminders for this interview."}</span>
                </span>
              </div>

              {/* prep-runway disclosure — set expectation that saving a real
                  interview auto-schedules the mock countdown */}
              {!editingId && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11.5, color: c.stone, fontFamily: font.ui, lineHeight: 1.45 }}>
                  <span style={{ color: c.gilt, display: "flex", marginTop: 1 }}><Icon size={13}>{I.sparkle}</Icon></span>
                  Saving schedules a Prep Runway: an adaptive countdown of mock sessions mapped back from this date. Sessions count against your Pro quota.
                </div>
              )}
            </div>

            {/* footer */}
            <div style={{ borderTop: `1px solid ${c.borderSubtle}`, padding: "16px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
              {formError && <span style={{ fontFamily: font.ui, fontSize: 12, color: c.ember }}>{formError}</span>}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="cpr-tap" onClick={() => { setShowForm(false); resetForm(); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = c.graphite)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  style={{ fontFamily: font.ui, fontSize: 13.5, fontWeight: 500, color: c.chalk, background: "transparent", border: `1px solid ${c.border}`, borderRadius: radius.md, padding: "12px 20px", cursor: "pointer", transition: "background 0.15s ease" }}>Cancel</button>
                <button className="cpr-tap" onClick={handleSave} disabled={!canSave}
                  onMouseEnter={(e) => { if (canSave) e.currentTarget.style.filter = "brightness(1.08)"; }} onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, background: canSave ? c.slate : c.border, color: canSave ? c.carbon : c.stone, border: "none", borderRadius: radius.md, padding: "12px 24px", cursor: canSave ? "pointer" : "not-allowed", boxShadow: canSave ? shadow.sm : "none", transition: "filter 0.15s ease" }}>
                  {saving ? "Saving…" : editingId ? "Save changes" : (<><Icon size={15}>{I.plus}</Icon> Add interview</>)}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <div className="cpr-grid">
        {/* left rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: sp.lg }}>
          <Card pad={20}>
            <MiniMonth events={events} focusedId={focused?.id || null} onDateClick={(date) => {
              const hit = upcoming.find((e) => e.date === date) || reals.find((e) => e.date === date);
              if (hit) setFocusedId(hit.id);
            }} />
          </Card>

          <Card pad={20}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: sp.sm }}>
              <Icon size={15} stroke={c.gilt}>{I.bell}</Icon>
              <h2 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 400, color: c.ivory, margin: 0 }}>Reminders</h2>
            </div>
            {focused ? (
              <>
                <ReminderRow label="3 days before" on={focused.reminders && (!heroStartUtc || Date.parse(heroStartUtc) - Date.now() > 4320 * 60000)} />
                <ReminderRow label="1 day before" on={focused.reminders && (!heroStartUtc || Date.parse(heroStartUtc) - Date.now() > 1440 * 60000)} />
                <p style={{ fontSize: 11, color: c.stone, margin: "8px 0 0", fontFamily: font.ui }}>
                  {focused.reminders ? `${describeReminders(heroStartUtc, Date.now())}. Toggle them when editing.` : "Reminders off for this interview. Toggle them when editing."}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12, color: c.stone, margin: 0, fontFamily: font.ui, lineHeight: 1.45 }}>
                Log an interview to set email reminders.
              </p>
            )}
          </Card>

          <Card pad={20}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={16} stroke={c.slate}>{I.google}</Icon>
                <h2 style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory, margin: 0 }}>Google Calendar</h2>
              </div>
              {googleConnected
                ? <Pill bg={c.sageLight} fg={c.sage} icon={<Icon size={11}>{I.check}</Icon>}>2-way</Pill>
                : <Pill bg={c.graphite} fg={c.stone} bd={c.border}>Off</Pill>}
            </div>
            <p style={{ fontSize: 12, color: c.stone, margin: "10px 0 0", lineHeight: 1.45, fontFamily: font.ui }}>
              {googleConnected
                ? "Synced. Interviews you log here appear on your Google Calendar, both ways."
                : "Connect to sync your interviews both ways with Google Calendar."}
            </p>
            {!googleConnected && !googleUnavailable && (
              <button className="cpr-tap" onClick={handleConnectGoogle} disabled={googleBusy} style={{ marginTop: sp.md, display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", color: c.ivory, border: `1px solid ${c.border}`, borderRadius: radius.md, padding: "9px 14px", fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, cursor: googleBusy ? "default" : "pointer" }}>
                <Icon size={14} stroke={c.slate}>{I.google}</Icon> {googleBusy ? "Connecting…" : "Connect"}
              </button>
            )}
          </Card>
        </div>

        {/* main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: sp.xl }}>
          {focused ? (
            <>
              {/* interview hero card */}
              <Card pad={24} style={{ borderColor: T.copperBorder }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: sp.lg, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: sp.md }}>
                    <div style={{ width: 52, height: 52, borderRadius: radius.md, background: c.graphite, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.display, fontSize: 24, color: c.gilt, flexShrink: 0 }}>
                      {(focused.company || focused.title || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: sp.sm, marginBottom: 3, flexWrap: "wrap" }}>
                        <h2 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 400, color: c.ivory, margin: 0 }}>
                          {heroName}
                        </h2>
                        <Pill bg={c.slateLight} fg={c.slate}>{heroRound || "Interview"}</Pill>
                      </div>
                      {heroSub && <div style={{ fontSize: 13, color: c.chalk, fontFamily: font.ui }}>{heroSub}</div>}
                    </div>
                  </div>
                  <Pill bg={T.copper100} fg={c.giltDark} bd={T.copperBorder} icon={<Icon size={11}>{I.clock}</Icon>}>{countdownLabel(focused)}</Pill>
                </div>

                {/* time + zone */}
                <div style={{ marginTop: sp.lg, display: "flex", alignItems: "center", gap: sp.lg, padding: "14px 16px", background: c.graphite, borderRadius: radius.md, border: `1px solid ${c.borderSubtle}` }}>
                  <Icon size={18} stroke={c.gilt}>{I.globe}</Icon>
                  <div>
                    <div style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: c.ivory }}>
                      {formatEventDate(focused.date)} · {formatEventTime(focused.time)}
                      {heroLocalLabel && <span style={{ color: c.gilt, fontWeight: 500 }}> ({heroLocalLabel} your time)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: c.stone, fontFamily: font.ui, marginTop: 2 }}>{timezoneLabel(focused.timezone || heroTz)} · {focused.duration} min{focused.location ? ` · ${focused.location}` : ""}</div>
                  </div>
                </div>

                {/* timezone-comfort note */}
                <div style={{ marginTop: sp.sm, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: awkward ? T.warningInk : c.sage, background: awkward ? T.warning100 : c.sageLight, border: `1px solid ${awkward ? T.warningLine : T.successMist}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui }}>
                  <Icon size={14} stroke={awkward ? T.warningInk : c.sage}>{awkward ? I.alert : I.check}</Icon>
                  {awkward ? "Early or late slot in your timezone. Confirm you will be sharp, and plan rest around it." : "Comfortable slot in your timezone. No awkward-hour conflict."}
                </div>

                {/* actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${c.borderSubtle}`, marginTop: sp.lg, paddingTop: sp.md }}>
                  <button className="cpr-tap" onClick={() => startMock(focused)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.slate, color: c.carbon, border: "none", borderRadius: radius.sm, padding: "8px 14px", fontFamily: font.ui, fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: shadow.sm }}>
                    <Icon size={13}>{I.play}</Icon> {practiceLabel}
                  </button>
                  <div style={{ position: "relative" }}>
                    <button className="cpr-tap" onClick={() => handleExportICS(focused)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: c.chalk, border: `1px solid ${c.border}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                      <Icon size={13}>{I.download}</Icon> Export .ics
                    </button>
                    {exportTooltip === focused.id && (
                      <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", background: c.sage, color: c.carbon, fontFamily: font.ui, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>Downloaded</div>
                    )}
                  </div>
                  <a className="cpr-tap" href={generateGoogleCalendarURL(focused)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: c.chalk, border: `1px solid ${c.border}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui, fontSize: 12, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>
                    <Icon size={13}>{I.cal}</Icon> Add to Google
                  </a>
                  <button className="cpr-tap" onClick={() => openEditForm(focused)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: c.stone, border: `1px solid ${c.border}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                    <Icon size={13}>{I.pencil}</Icon> Edit
                  </button>
                  <button className="cpr-tap" onClick={() => handleCancel(focused.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: c.ember, border: `1px solid ${c.emberLight}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                    <Icon size={13}>{I.x}</Icon> Cancel
                  </button>
                </div>
              </Card>

              {/* the runway */}
              <PrepRunwayRail interview={focused} all={events} onStart={() => startMock(focused)} onBuild={() => handleBuildRunway(focused.id)} building={buildingRunway} />
            </>
          ) : (
            <Card pad={40} style={{ textAlign: "center" }}>
              <div style={{ color: c.stone, display: "flex", justifyContent: "center", marginBottom: 12, opacity: 0.5 }}>
                <Icon size={40} sw={1.3}>{I.cal}</Icon>
              </div>
              <h2 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 400, color: c.ivory, margin: "0 0 6px" }}>No upcoming interviews</h2>
              <p style={{ fontSize: 13, color: c.chalk, margin: "0 auto 18px", maxWidth: 360, lineHeight: 1.5 }}>
                Add your interview schedule to get countdown reminders and an adaptive Prep Runway of mock sessions.
              </p>
              <button className="cpr-tap" onClick={openNewForm} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: c.slate, color: c.carbon, border: "none", borderRadius: radius.md, padding: "11px 20px", fontFamily: font.ui, fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: shadow.sm }}>
                <Icon size={15}>{I.plus}</Icon> Add your first interview
              </button>
            </Card>
          )}

          {/* past + cancelled */}
          {(past.length > 0 || cancelled.length > 0) && (
            <Card pad={20}>
              {past.length > 0 && (
                <>
                  <h3 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 400, color: c.ivory, margin: "0 0 12px" }}>Past ({past.length})</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: cancelled.length > 0 ? 20 : 0 }}>
                    {past.map((ev) => (
                      <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${c.borderSubtle}` }}>
                        <span style={{ fontSize: 12.5, color: c.chalk, fontFamily: font.ui }}>
                          <strong style={{ color: c.ivory, fontWeight: 600 }}>{ev.title}</strong> · {ev.company} · {formatEventDate(ev.date)}
                        </span>
                        <button className="cpr-tap" onClick={() => handleDelete(ev.id)} aria-label="Remove" style={{ display: "flex", color: c.stone, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Icon size={14}>{I.trash}</Icon>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {cancelled.length > 0 && (
                <>
                  <h3 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 400, color: c.stone, margin: "0 0 12px" }}>Cancelled ({cancelled.length})</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {cancelled.map((ev) => (
                      <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${c.borderSubtle}`, opacity: 0.6 }}>
                        <span style={{ fontSize: 12.5, color: c.chalk, fontFamily: font.ui, textDecoration: "line-through" }}>
                          {ev.title} · {ev.company} · {formatEventDate(ev.date)}
                        </span>
                        <button className="cpr-tap" onClick={() => handleDelete(ev.id)} aria-label="Remove" style={{ display: "flex", color: c.stone, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Icon size={14}>{I.trash}</Icon>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
