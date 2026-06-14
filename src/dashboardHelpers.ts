/* ─── Interview Events (Calendar Integration) ─── */
export interface InterviewEvent {
  id: string;
  title: string;
  company: string;
  type: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  notes: string;
  status: "upcoming" | "completed" | "cancelled";
  reminders: boolean;
  google_event_id?: string;
  // PRI-35: authoritative UTC instants + IANA zone carried from the DB row so
  // the ICS export reflects the real scheduled moment (the naive date/time
  // strings lose zone information). Optional for legacy localStorage rows.
  start_utc?: string;
  end_utc?: string;
  timezone?: string;
  // PRI-35: carried through from the DB row so the Prep Runway rail can group
  // mock-prep sessions under the real interview they prepare for. Optional so
  // legacy localStorage rows and the create form (real interviews) still fit.
  kind?: "real" | "prep-session";
  parentInterviewId?: string;
  // PRI-35: set on a row that was saved to localStorage because its cloud write
  // failed, so the next DB refresh keeps it (a pending local edit) instead of a
  // stale row the server already deleted. Rows without it that are absent from
  // the DB are treated as server-deleted and dropped on merge.
  _pendingSync?: boolean;
}

export const EVENTS_KEY = "hirestepx_events";

export function loadEvents(): InterviewEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* expected: localStorage/JSON.parse may fail */ }
  return [];
}

export function saveEvents(events: InterviewEvent[]) {
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); } catch { /* expected: localStorage may be unavailable */ }
}

export function generateEventId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Whole calendar days from today to the event (0 = today, 1 = tomorrow, negative
 * = past). Measured midnight-to-midnight in local time, not as raw 24h chunks,
 * so an event tomorrow morning reads as 1 day out regardless of the current hour
 * (the old ms/86400000 ceil drifted to 2). Drives the upcoming/past split and
 * the T-countdown labels. */
export function daysUntilEvent(date: string, time: string): number {
  const event = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(event.getTime())) return 0;
  const eventMidnight = new Date(event.getFullYear(), event.getMonth(), event.getDate());
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((eventMidnight.getTime() - todayMidnight.getTime()) / 86400000);
}

export function formatEventDate(date: string): string {
  return new Date(date + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatEventTime(time: string): string {
  // Guard a missing or malformed time the same way daysUntilEvent does: an
  // event saved with an empty/colon-less time ("" or "9") otherwise yields an
  // undefined minute and crashes the whole dashboard on `m.toString()`.
  const [h, m] = (time || "00:00").split(":").map(Number);
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  const ampm = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return `${hour}:${mm.toString().padStart(2, "0")} ${ampm}`;
}

/* ── RFC 5545 (iCalendar) helpers ── */

/** Escape a TEXT value per RFC 5545 §3.3.11: backslash, semicolon, comma, and
 *  newline are the reserved characters. Carriage returns are dropped (a bare CR
 *  isn't meaningful inside an escaped value). */
function icsEscape(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line to <=75 octets per RFC 5545 §3.1, continuation lines
 *  begin with a single space. We fold on UTF-16 code units, which is safe for
 *  the ASCII-dominant content here and never splits below the octet limit. */
function icsFold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** Format a Date as an RFC 5545 UTC timestamp (YYYYMMDDTHHMMSSZ). */
function icsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Resolve a calendar event's authoritative start/end Date pair. Prefers the
 *  stored UTC instants; falls back to composing the naive date/time strings. */
function eventInstants(event: InterviewEvent): { start: Date; end: Date } | null {
  const start = event.start_utc ? new Date(event.start_utc) : new Date(`${event.date}T${event.time || "00:00"}`);
  if (Number.isNaN(start.getTime())) return null;
  let end = event.end_utc ? new Date(event.end_utc) : new Date(start.getTime() + (event.duration || 60) * 60000);
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + (event.duration || 60) * 60000);
  }
  return { start, end };
}

/* Generate RFC 5545-correct .ics content. All times are emitted as UTC instants
 * (DTSTART/DTEND with a trailing Z), so no VTIMEZONE block is needed and the
 * event lands at the right wall-clock moment in any importing client. */
export function generateICS(event: InterviewEvent, opts?: { now?: Date }): string {
  const inst = eventInstants(event);
  if (!inst) return "";
  const { start, end } = inst;
  const dtstamp = icsUtc(opts?.now ?? new Date());
  const uid = `${event.id || icsUtc(start)}@hirestepx.com`;
  const summary = event.company ? `${event.title} (${event.company})` : event.title;
  const descParts = [`Interview Type: ${event.type}`];
  if (event.notes) descParts.push(`Notes: ${event.notes}`);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HireStepX//Interview Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    "SEQUENCE:0",
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(descParts.join("\n"))}`,
    `LOCATION:${icsEscape(event.location || "")}`,
    `STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Interview tomorrow: ${event.title}${event.company ? " at " + event.company : ""}`)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Interview in 30 minutes: ${event.title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n");
}

/* Generate a Google Calendar "add event" template URL. */
export function generateGoogleCalendarURL(event: InterviewEvent): string {
  const inst = eventInstants(event);
  if (!inst) return "https://calendar.google.com/calendar";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.company ? `${event.title} (${event.company})` : event.title,
    dates: `${icsUtc(inst.start)}/${icsUtc(inst.end)}`,
    details: `Interview Type: ${event.type}\n${event.notes || ""}`,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const interviewTypeOptions = ["Phone Screen", "Technical", "Behavioral", "System Design", "Culture Fit", "Final Round", "Other"];
