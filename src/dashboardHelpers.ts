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
  // PRI-35: target role/position for this interview. Feeds the mock deep-link
  // (so a practice run lands pre-configured for the role) and round-aware prep.
  // Optional so legacy localStorage rows and minimal entries still fit.
  role?: string;
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
    text:
      event.company && !event.title.toLowerCase().includes(event.company.toLowerCase())
        ? `${event.title} (${event.company})`
        : event.title,
    dates: `${icsUtc(inst.start)}/${icsUtc(inst.end)}`,
    details: `Interview Type: ${event.type}\n${event.notes || ""}`,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ── Interview type taxonomy ──
 * The calendar's friendly round labels, each mapped onto the mock-session focus
 * vocabulary the setup screen (SessionSetup) understands. Every label maps to a
 * real focus so a practice run launched from the calendar lands pre-configured
 * for that round, with no lossy "unmapped" fallthrough. Coverage is
 * deliberately India-market-aware: HR round, campus placement, government / PSU,
 * panel, and salary negotiation are first-class, not just FAANG-style technical
 * rounds. "Other" is intentionally focus-less (the setup screen then falls back
 * to the candidate's role-based default). */
export interface InterviewTypeDef {
  label: string;
  /** /session/new `type` param, or "" to defer to the setup screen default. */
  focus: string;
}

export const INTERVIEW_TYPES: InterviewTypeDef[] = [
  { label: "Phone Screen", focus: "behavioral" },
  { label: "Technical", focus: "technical" },
  { label: "System Design", focus: "technical" },
  { label: "Behavioral", focus: "behavioral" },
  { label: "Case Study", focus: "case-study" },
  { label: "HR Round", focus: "hr-round" },
  { label: "Managerial", focus: "management" },
  { label: "Panel", focus: "panel" },
  { label: "Salary Negotiation", focus: "salary-negotiation" },
  { label: "Campus Placement", focus: "campus-placement" },
  { label: "Government / PSU", focus: "government-psu" },
  { label: "Final Round", focus: "strategic" },
  { label: "Other", focus: "" },
];

export const interviewTypeOptions: string[] = INTERVIEW_TYPES.map((t) => t.label);

/** The mock focus for a calendar round label, or undefined when none applies
 *  (unknown label, or the deliberately focus-less "Other"). */
export function focusForType(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const hit = INTERVIEW_TYPES.find((t) => t.label === label);
  return hit && hit.focus ? hit.focus : undefined;
}

/* ── Timezone-correct scheduling ──
 * Indian candidates routinely interview at US/EU hours, so a wall-clock time is
 * only meaningful paired with the zone it was given in. These helpers convert a
 * (date, time, IANA zone) triple to an absolute UTC instant and back to a
 * zone-local label, using Intl rather than shipping a tz database. */

/** Curated zone list for the picker: the Indian-candidate home zone first, then
 *  the zones the companies they interview at actually sit in. */
export const COMMON_TIMEZONES: { id: string; label: string }[] = [
  { id: "Asia/Kolkata", label: "India (IST)" },
  { id: "America/Los_Angeles", label: "US Pacific (PT)" },
  { id: "America/Denver", label: "US Mountain (MT)" },
  { id: "America/Chicago", label: "US Central (CT)" },
  { id: "America/New_York", label: "US Eastern (ET)" },
  { id: "Europe/London", label: "UK (GMT/BST)" },
  { id: "Europe/Berlin", label: "Central Europe (CET)" },
  { id: "Asia/Dubai", label: "Gulf (GST)" },
  { id: "Asia/Singapore", label: "Singapore (SGT)" },
  { id: "Australia/Sydney", label: "Sydney (AEST)" },
  { id: "UTC", label: "UTC" },
];

/** Legacy IANA aliases some browsers/OSes still report (notably "Asia/Calcutta"
 *  for IST), mapped to the canonical zone our picker lists. Without this an
 *  Indian candidate whose browser reports the deprecated alias never matches the
 *  "Asia/Kolkata" option, so they see a raw alias and a duplicated picker row. */
const TZ_ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
};

/** Canonicalize a possibly-legacy IANA zone id to the form our picker uses. */
export function canonicalTimezone(tz: string): string {
  return TZ_ALIASES[tz] || tz;
}

/** Friendly label for a zone id (e.g. "India (IST)"), canonicalizing legacy
 *  aliases first and falling back to the raw id for zones outside our list. */
export function timezoneLabel(tz: string): string {
  const id = canonicalTimezone(tz);
  return COMMON_TIMEZONES.find((z) => z.id === id)?.label || id;
}

/** Offset in ms such that local_wall = utc + offset, for `timeZone` at the
 *  instant `utcDate`. Derived from Intl parts, so it honours DST automatically. */
function zoneOffsetMs(utcDate: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const p: Record<string, number> = {};
    for (const part of dtf.formatToParts(utcDate)) {
      if (part.type !== "literal") p[part.type] = Number(part.value);
    }
    // Some engines render hour "24" for midnight; normalise to 0.
    const hour = p.hour === 24 ? 0 : p.hour;
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second);
    return asUTC - utcDate.getTime();
  } catch {
    return 0;
  }
}

/** Convert a wall-clock date+time *in `timeZone`* to a UTC ISO instant. Two-pass
 *  to settle DST boundaries (the offset can differ either side of the guess).
 *  Returns null on an unparseable date. */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  if (!dm) return null;
  const tm = /^(\d{1,2}):(\d{2})/.exec(time || "00:00") || ["", "0", "0"];
  const y = Number(dm[1]), mo = Number(dm[2]), d = Number(dm[3]);
  const h = Number(tm[1]), mi = Number(tm[2]);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off1 = zoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - off1;
  const off2 = zoneOffsetMs(new Date(utc), timeZone);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc).toISOString();
}

/** Render a UTC instant as a short time label in `timeZone` (e.g. "9:00 AM"). */
export function formatTimeInZone(utcIso: string, timeZone: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  } catch {
    return "";
  }
}

/** Hour-of-day (0-23) of a UTC instant as seen in `timeZone`. */
export function hourInZone(utcIso: string, timeZone: string): number {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return 12;
  try {
    const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(d);
    const n = Number(h);
    return Number.isNaN(n) ? 12 : n % 24;
  } catch {
    return 12;
  }
}

/** A slot is "awkward" when it lands before 8am or at/after 9pm in the
 *  candidate's own zone, so they should plan rest/alertness around it. */
export function isAwkwardHour(hour: number): boolean {
  return hour < 8 || hour >= 21;
}

/* ── Reminder honesty ──
 * The default ladder fires 3 days and 1 day out, and the daily cron can't serve
 * anything under ~2h. For a near-term interview some of those reminders simply
 * can't happen, so the form should state what will actually fire rather than
 * promise "3 days and 1 day before" unconditionally. */
export function describeReminders(startUtc: string | null, nowMs: number): string {
  const fallback = "Email reminders 3 days and 1 day before";
  if (!startUtc) return fallback;
  const start = Date.parse(startUtc);
  if (Number.isNaN(start)) return fallback;
  const minsOut = (start - nowMs) / 60000;
  const fires: string[] = [];
  if (minsOut > 4320) fires.push("3 days");
  if (minsOut > 1440) fires.push("1 day");
  if (fires.length === 0) return "Too soon for an email reminder before this interview";
  return `Email reminder${fires.length > 1 ? "s" : ""} ${fires.join(" and ")} before`;
}

/* ── Natural-language quick add ──
 * Best-effort client-side parse of a phrase like
 * "Amazon SDE phone screen tuesday 3pm" into form fields the candidate then
 * reviews. Heuristic, not an LLM call: it fills what it's confident about
 * (company, round, date, time) and leaves the rest blank. Pure + testable. */
const NL_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export interface ParsedNaturalEvent {
  company?: string;
  type?: string;
  date?: string;
  time?: string;
}

function pad2(n: number): string { return n.toString().padStart(2, "0"); }
function toDateStr(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export function parseNaturalEvent(text: string, now: Date): ParsedNaturalEvent {
  const out: ParsedNaturalEvent = {};
  if (!text || !text.trim()) return out;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // Round / type: first matching known label wins (longest labels first so
  // "system design" beats "design" and "phone screen" beats a bare "phone").
  const byLen = [...INTERVIEW_TYPES].sort((a, b) => b.label.length - a.label.length);
  for (const t of byLen) {
    if (t.label === "Other") continue;
    if (lower.includes(t.label.toLowerCase())) { out.type = t.label; break; }
  }
  if (!out.type) {
    if (/\b(phone|screen)\b/.test(lower)) out.type = "Phone Screen";
    else if (/\b(coding|dsa|algorithms?)\b/.test(lower)) out.type = "Technical";
    else if (/\bhr\b/.test(lower)) out.type = "HR Round";
  }

  // Time: "3pm", "3:30 pm", "15:00".
  const t12 = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(lower);
  const t24 = /\b(\d{1,2}):(\d{2})\b/.exec(lower);
  if (t12) {
    let h = Number(t12[1]) % 12;
    if (t12[3] === "pm") h += 12;
    out.time = `${pad2(h)}:${t12[2] ? t12[2] : "00"}`;
  } else if (t24) {
    const h = Number(t24[1]);
    if (h >= 0 && h <= 23) out.time = `${pad2(h)}:${t24[2]}`;
  }

  // Date: "today", "tomorrow", a weekday name (next occurrence).
  if (/\btoday\b/.test(lower)) {
    out.date = toDateStr(now);
  } else if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now); d.setDate(d.getDate() + 1); out.date = toDateStr(d);
  } else {
    const wd = NL_WEEKDAYS.findIndex((w) => new RegExp(`\\b${w.slice(0, 3)}\\w*\\b`).test(lower));
    if (wd >= 0) {
      const d = new Date(now);
      let delta = (wd - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // a weekday name means the next one, not today
      d.setDate(d.getDate() + delta);
      out.date = toDateStr(d);
    }
  }

  // Company: the leading Capitalized run before any round keyword. "Amazon SDE
  // phone screen" -> "Amazon".
  const head = raw.split(/\b(phone|screen|technical|behavioral|behavioural|system|design|case|hr|managerial|panel|salary|campus|government|psu|final|interview|round|on|at|tomorrow|today|next|mon|tue|wed|thu|fri|sat|sun)\b/i)[0];
  const capRun = /^([A-Z][A-Za-z0-9&.]*(?:\s+[A-Z][A-Za-z0-9&.]*){0,2})/.exec(head.trim());
  if (capRun) {
    const words = capRun[1].trim().split(/\s+/);
    // A trailing short all-caps token after a normal-case word (e.g. "Amazon
    // SDE") is a role abbreviation, not part of the company name. Drop it so the
    // company field stays clean; a leading all-caps token (IBM, TCS, AWS) stays.
    if (words.length > 1 && /^[A-Z0-9]{1,4}$/.test(words[words.length - 1])) words.pop();
    out.company = words.join(" ");
  }

  return out;
}
