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
import { c, font, shadow, sp, radius, ease } from "./tokens";
import { tokens as T } from "./auth/_tokens";
import { useAuth } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";
import { listEvents, saveEvent, deleteEvent, generatePrepRunway, connectGoogleCalendar, currentTimezone, type CalendarEventRow, type CalendarEventInput } from "./calendarAPI";
import {
  type InterviewEvent, loadEvents, saveEvents, generateEventId,
  daysUntilEvent, formatEventDate, formatEventTime,
  generateICS, generateGoogleCalendarURL, interviewTypeOptions,
} from "./dashboardHelpers";
import { useDashboardCore, useDashboardUI, useDashboardSubscription, useDashboardSessions } from "./DashboardContext";
import { DataLoadingSkeleton, ProGate } from "./dashboardComponents";

/* Scoped stylesheet — inline styles can't express :focus-visible, media
 * queries, or :hover, so the responsive grid + keyboard focus rings live here. */
const STYLE = `
.cpr-tap { -webkit-tap-highlight-color: transparent; }
.cpr-tap:focus-visible { outline: 2px solid ${c.slate}; outline-offset: 2px; border-radius: ${radius.sm}px; }
.cpr-grid { display: grid; grid-template-columns: 320px 1fr; gap: ${sp.xl}px; align-items: start; }
@media (max-width: 880px) {
  .cpr-grid { grid-template-columns: 1fr; }
  .cpr-header { flex-direction: column; align-items: flex-start; }
  .cpr-actions { align-items: stretch !important; width: 100%; }
}
@keyframes cpr-scrim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cpr-sheet-in { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.cpr-scrim { animation: cpr-scrim-in 0.18s cubic-bezier(0.16,1,0.3,1); }
.cpr-sheet { animation: cpr-sheet-in 0.24s cubic-bezier(0.16,1,0.3,1); }
@media (max-width: 560px) {
  .cpr-sheet { width: 100vw !important; }
  .cpr-form-row { grid-template-columns: 1fr !important; }
}
@media (prefers-reduced-motion: reduce) {
  .cpr-scrim, .cpr-sheet { animation: none; }
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
  };
}

function eventToInput(ev: InterviewEvent, opts: { withId: boolean }): CalendarEventInput {
  const local = new Date(`${ev.date}T${ev.time || "00:00"}`);
  const start_utc = Number.isNaN(local.getTime()) ? undefined : local.toISOString();
  return {
    ...(opts.withId ? { id: ev.id } : {}),
    title: ev.title,
    company: ev.company,
    type: ev.type,
    date: ev.date,
    time: ev.time,
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

function buildRunway(interview: InterviewEvent, all: InterviewEvent[]): RunwayNode[] {
  const children = all
    .filter((e) => e.kind === "prep-session" && e.parentInterviewId === interview.id && e.status !== "cancelled")
    .sort((a, b) => tsOf(a) - tsOf(b));
  const now = Date.now();
  const anchorTs = tsOf(interview);
  const firstUpcoming = children.findIndex((e) => tsOf(e) >= now);

  const nodes: RunwayNode[] = children.map((e, i) => {
    const dayDiff = Math.round((tsOf(e) - anchorTs) / 86_400_000);
    const tag = tsOf(e) > anchorTs ? "after" : dayDiff === 0 ? "T-0" : `T${dayDiff}`;
    const state: RunwayState = tsOf(e) < now ? "done" : i === firstUpcoming ? "active" : "upcoming";
    return { id: e.id, tag, title: e.title, detail: e.type || "Mock session", state };
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
          <h2 style={{ fontFamily: font.display, fontSize: 17, fontWeight: 400, color: c.ivory, margin: 0 }}>Prep Runway</h2>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
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
        <Icon size={14} stroke={c.stone}>{I.push}</Icon>
        {on ? <Pill bg={c.sageLight} fg={c.sage}>Set</Pill> : <Pill bg={c.graphite} fg={c.stone} bd={c.border}>Off</Pill>}
      </span>
    </div>
  );
}

export default function CalendarPage() {
  useDocTitle("Calendar");
  const { handleStartSession: onStartSession } = useDashboardCore();
  const { eventsLoading } = useDashboardSessions();
  const { setShowUpgradeModal, showToast } = useDashboardUI();
  const { isFree, isStarter } = useDashboardSubscription();
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
  const [formType, setFormType] = useState("Behavioral");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("10:00");
  const [formDuration, setFormDuration] = useState(60);
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formReminders, setFormReminders] = useState(true);
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
        const localOnly = prev.filter((e) => !dbIds.has(e.id));
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
  if (isFree || isStarter) return <ProGate feature="Interview Calendar" onUpgrade={() => setShowUpgradeModal(true)} />;

  const resetForm = () => {
    setFormTitle("");
    setFormCompany(user?.targetCompany || "");
    setFormType("Behavioral");
    setFormDate("");
    setFormTime("10:00");
    setFormDuration(60);
    setFormLocation("");
    setFormNotes("");
    setFormReminders(true);
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setFormCompany(user?.targetCompany || "");
    setShowForm(true);
  };

  const openEditForm = (ev: InterviewEvent) => {
    setFormTitle(ev.title);
    setFormCompany(ev.company);
    setFormType(ev.type);
    setFormDate(ev.date);
    setFormTime(ev.time);
    setFormDuration(ev.duration);
    setFormLocation(ev.location);
    setFormNotes(ev.notes);
    setFormReminders(ev.reminders);
    setEditingId(ev.id);
    setShowForm(true);
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

  const handleSave = async () => {
    if (!formTitle || !formDate || !formTime) {
      setFormError(!formTitle ? "Event title is required." : !formDate ? "Date is required." : "Time is required.");
      return;
    }
    if (!editingId) {
      const eventDateTime = new Date(`${formDate}T${formTime}`);
      if (eventDateTime < new Date()) {
        setFormError("Interview date and time cannot be in the past.");
        return;
      }
    }
    setFormError("");
    const draft: InterviewEvent = {
      id: editingId || generateEventId(),
      title: formTitle,
      company: formCompany,
      type: formType,
      date: formDate,
      time: formTime,
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
      updateEvents(editingId ? events.map((e) => (e.id === editingId ? draft : e)) : [...events, draft]);
      showToast(res.error || "Saved locally. Cloud sync failed.");
    }
    setShowForm(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    updateEvents(events.filter((e) => e.id !== id));
    if (focusedId === id) setFocusedId(null);
    const res = await deleteEvent(id);
    if (!res.ok && res.status !== 404) showToast(res.error || "Deleted locally. Cloud sync failed.");
  };

  const handleCancel = async (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const cancelled = { ...ev, status: "cancelled" as const };
    updateEvents(events.map((e) => (e.id === id ? cancelled : e)));
    const res = await saveEvent(eventToInput(cancelled, { withId: true }));
    if (!res.ok && res.status !== 404) showToast(res.error || "Cancelled locally. Sync failed.");
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
    width: "100%", padding: "10px 14px", fontFamily: font.ui, fontSize: 13,
    color: c.ivory, background: c.obsidian, border: `1px solid ${c.border}`,
    borderRadius: 8, outline: "none", boxSizing: "border-box" as const,
  };

  // Awkward-hour heuristic for the focused interview (Indian candidates often
  // interview at US/EU hours). Calm/positive unless it's genuinely early/late.
  const focusedHour = focused ? Number((focused.time || "10:00").split(":")[0]) : 10;
  const awkward = focused ? focusedHour < 8 || focusedHour >= 21 : false;

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

      {/* Add/Edit sheet — a focused right-anchored drawer over a scrim, so the
          page behind it never shifts. Closes on scrim click or Escape. */}
      {showForm && (
        <div className="cpr-scrim" onClick={() => { setShowForm(false); resetForm(); }}
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(14,12,8,0.34)", display: "flex", justifyContent: "flex-end" }}>
          <div className="cpr-sheet" role="dialog" aria-modal="true" aria-label={editingId ? "Edit interview" : "Add interview"} onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px, 100vw)", height: "100dvh", background: c.carbon, borderLeft: `1px solid ${c.border}`, boxShadow: shadow.xl, display: "flex", flexDirection: "column" }}>

            {/* header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "24px 28px 18px", borderBottom: `1px solid ${c.borderSubtle}` }}>
              <div>
                <Eyebrow>{editingId ? "Edit" : "New"}</Eyebrow>
                <h3 style={{ fontFamily: font.display, fontSize: 23, fontWeight: 400, color: c.ivory, margin: "5px 0 0" }}>{editingId ? "Edit interview" : "Add an interview"}</h3>
              </div>
              <button className="cpr-tap" onClick={() => { setShowForm(false); resetForm(); }} aria-label="Close" style={{ background: "none", border: "none", color: c.stone, cursor: "pointer", padding: 6, marginTop: 2, display: "flex", borderRadius: radius.sm }}>
                <Icon size={20}>{I.x}</Icon>
              </button>
            </div>

            {/* scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Interview title" htmlFor="cal-title" required>
                <input id="cal-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Final round interview" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = c.gilt)} onBlur={(e) => (e.currentTarget.style.borderColor = c.border)} />
              </Field>

              <Field label="Company" htmlFor="cal-company" required>
                <input id="cal-company" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="e.g. Google" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = c.gilt)} onBlur={(e) => (e.currentTarget.style.borderColor = c.border)} />
              </Field>

              <div className="cpr-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Date" htmlFor="cal-date" required>
                  <input id="cal-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ ...inputStyle, colorScheme: "light" }} />
                </Field>
                <Field label="Time" htmlFor="cal-time" required>
                  <input id="cal-time" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} style={{ ...inputStyle, colorScheme: "light" }} />
                </Field>
              </div>

              <Field label="Duration" htmlFor="cal-duration">
                <select id="cal-duration" value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value))} style={{ ...inputStyle, colorScheme: "light" }}>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </Field>

              <Field label="Interview type">
                <div role="group" aria-label="Interview type" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {interviewTypeOptions.map((t) => (
                    <button key={t} className="cpr-tap" onClick={() => setFormType(t)} style={{
                      fontFamily: font.ui, fontSize: 12, fontWeight: 500, padding: "6px 13px", borderRadius: radius.pill, cursor: "pointer",
                      background: formType === t ? T.copper100Soft : "transparent",
                      border: `1px solid ${formType === t ? c.gilt : c.border}`,
                      color: formType === t ? c.gilt : c.stone, transition: `all 0.2s ${ease.out}`,
                    }}>{t}</button>
                  ))}
                </div>
              </Field>

              <Field label="Location / link" htmlFor="cal-location">
                <input id="cal-location" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Zoom link, Google Meet, or address" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = c.gilt)} onBlur={(e) => (e.currentTarget.style.borderColor = c.border)} />
              </Field>

              <Field label="Notes" htmlFor="cal-notes">
                <textarea id="cal-notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Interviewer name, prep topics, things to remember..." rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = c.gilt)} onBlur={(e) => (e.currentTarget.style.borderColor = c.border)} />
              </Field>

              {/* reminders */}
              <div role="switch" aria-checked={formReminders} tabIndex={0} className="cpr-tap" onClick={() => setFormReminders(!formReminders)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFormReminders(!formReminders); } }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: radius.md, border: `1px solid ${c.border}`, background: c.obsidian, cursor: "pointer" }}>
                <span style={{ width: 38, height: 22, borderRadius: 11, padding: 2, flexShrink: 0, background: formReminders ? c.sage : c.borderHover, transition: "background 0.2s" }}>
                  <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: c.carbon, transform: formReminders ? "translateX(16px)" : "translateX(0)", transition: "transform 0.2s", boxShadow: shadow.sm }} />
                </span>
                <span>
                  <span style={{ display: "block", fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory }}>Reminders</span>
                  <span style={{ display: "block", fontFamily: font.ui, fontSize: 11.5, color: c.stone, marginTop: 1 }}>Email and push at 72h, 24h, and 2h before</span>
                </span>
              </div>
            </div>

            {/* footer */}
            <div style={{ borderTop: `1px solid ${c.borderSubtle}`, padding: "16px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
              {formError && <span style={{ fontFamily: font.ui, fontSize: 12, color: c.ember }}>{formError}</span>}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="cpr-tap" onClick={() => { setShowForm(false); resetForm(); }} style={{ fontFamily: font.ui, fontSize: 13.5, fontWeight: 500, color: c.chalk, background: "transparent", border: `1px solid ${c.border}`, borderRadius: radius.md, padding: "12px 20px", cursor: "pointer" }}>Cancel</button>
                <button className="cpr-tap" onClick={handleSave} disabled={!formTitle || !formDate || !formTime || saving} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, background: formTitle && formDate && formTime && !saving ? c.slate : c.border, color: formTitle && formDate && formTime && !saving ? c.carbon : c.stone, border: "none", borderRadius: radius.md, padding: "12px 24px", cursor: formTitle && formDate && formTime && !saving ? "pointer" : "not-allowed", boxShadow: formTitle && formDate && formTime && !saving ? shadow.sm : "none" }}>
                  {saving ? "Saving…" : editingId ? "Save changes" : (<><Icon size={15}>{I.plus}</Icon> Add interview</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
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
                <ReminderRow label="72 hours before" on={focused.reminders} />
                <ReminderRow label="24 hours before" on={focused.reminders} />
                <ReminderRow label="2 hours before" on={focused.reminders} />
                <p style={{ fontSize: 11, color: c.stone, margin: "8px 0 0", fontFamily: font.ui }}>
                  Toggle reminders when editing an interview.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12, color: c.stone, margin: 0, fontFamily: font.ui, lineHeight: 1.45 }}>
                Log an interview to set email and push reminders.
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
                        <h2 style={{ fontFamily: font.display, fontSize: 19, fontWeight: 400, color: c.ivory, margin: 0 }}>
                          {focused.company ? `${focused.company} · ${focused.type}` : focused.title}
                        </h2>
                        <Pill bg={c.slateLight} fg={c.slate}>Interview</Pill>
                      </div>
                      <div style={{ fontSize: 13, color: c.chalk, fontFamily: font.ui }}>{focused.title}</div>
                    </div>
                  </div>
                  <Pill bg={T.copper100} fg={c.giltDark} bd={T.copperBorder} icon={<Icon size={11}>{I.clock}</Icon>}>{countdownLabel(focused)}</Pill>
                </div>

                {/* time + zone */}
                <div style={{ marginTop: sp.lg, display: "flex", alignItems: "center", gap: sp.lg, padding: "14px 16px", background: c.graphite, borderRadius: radius.md, border: `1px solid ${c.borderSubtle}` }}>
                  <Icon size={18} stroke={c.gilt}>{I.globe}</Icon>
                  <div>
                    <div style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: c.ivory }}>{formatEventDate(focused.date)} · {formatEventTime(focused.time)}</div>
                    <div style={{ fontSize: 12, color: c.stone, fontFamily: font.ui, marginTop: 2 }}>{currentTimezone()} · {focused.duration} min{focused.location ? ` · ${focused.location}` : ""}</div>
                  </div>
                </div>

                {/* timezone-comfort note */}
                <div style={{ marginTop: sp.sm, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: awkward ? T.warningInk : c.sage, background: awkward ? T.warning100 : c.sageLight, border: `1px solid ${awkward ? T.warningLine : T.successMist}`, borderRadius: radius.sm, padding: "8px 12px", fontFamily: font.ui }}>
                  <Icon size={14} stroke={awkward ? T.warningInk : c.sage}>{awkward ? I.alert : I.check}</Icon>
                  {awkward ? "Early or late slot in your timezone. Confirm you will be sharp, and plan rest around it." : "Comfortable slot in your timezone. No awkward-hour conflict."}
                </div>

                {/* actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${c.borderSubtle}`, marginTop: sp.lg, paddingTop: sp.md }}>
                  <button className="cpr-tap" onClick={() => onStartSession()} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.slate, color: c.carbon, border: "none", borderRadius: radius.sm, padding: "8px 14px", fontFamily: font.ui, fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: shadow.sm }}>
                    <Icon size={13}>{I.play}</Icon> Practice {focused.type}
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
              <PrepRunwayRail interview={focused} all={events} onStart={() => onStartSession()} onBuild={() => handleBuildRunway(focused.id)} building={buildingRunway} />
            </>
          ) : (
            <Card pad={40} style={{ textAlign: "center" }}>
              <div style={{ color: c.stone, display: "flex", justifyContent: "center", marginBottom: 12, opacity: 0.5 }}>
                <Icon size={40} sw={1.3}>{I.cal}</Icon>
              </div>
              <h2 style={{ fontFamily: font.display, fontSize: 19, fontWeight: 400, color: c.ivory, margin: "0 0 6px" }}>No upcoming interviews</h2>
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
