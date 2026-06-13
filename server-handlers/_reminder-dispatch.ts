/* Reminder dispatch engine (PRI-35) — pure due-computation.
 *
 * Decides which calendar reminders a scan should send right now. Kept side-
 * effect-free and clock-free (the caller passes `now`) so it can be unit-
 * tested deterministically — see src/__tests__/reminderDispatch.test.ts.
 *
 * Cadence note: the reminder cron runs daily, so it can only serve long-lead
 * reminders accurately. A "30 minutes before" email can't be delivered on time
 * by a once-a-day job, so the engine ignores anything below MIN_EMAIL_LEAD and
 * leaves near-term nudges to the client-side browser notifications
 * (src/interviewNotifications.ts). Web push (server-initiated) is a future
 * phase, so only the "email" channel dispatches here.
 */

export interface ReminderConfig {
  channel: string; // "email" | "push"
  minutesBefore: number;
}

export interface ReminderEvent {
  id: string;
  user_id: string;
  title: string;
  company: string;
  start_utc: string | null;
  timezone: string;
  status: string;
  reminders: ReminderConfig[];
}

export interface DueReminder {
  key: string; // `${eventId}:${channel}:${minutesBefore}` — matches the log dedup key
  eventId: string;
  userId: string;
  channel: string;
  minutesBefore: number;
  fireAt: string; // ISO instant the reminder ideally fires (start - lead)
  event: ReminderEvent;
}

export interface DispatchOptions {
  now: string;
  /** Keys already delivered (from calendar_reminder_log). */
  sentKeys?: Set<string>;
  /** Shortest lead an email reminder may have to be eligible. Default 120m. */
  minEmailLeadMinutes?: number;
  /** How far past the ideal fire time we still send (covers the daily gap).
   *  Default 1500m (25h), slightly over the cron cadence so nothing slips. */
  lookbackMinutes?: number;
  /** How far before the ideal fire time we send early (to align with the daily
   *  run rather than wait another full day). Default 60m. */
  lookaheadMinutes?: number;
}

const MIN = 60_000;

export function reminderKey(eventId: string, channel: string, minutesBefore: number): string {
  return `${eventId}:${channel}:${minutesBefore}`;
}

/** Compute the reminders a scan at `now` should deliver. */
export function dueReminders(events: ReminderEvent[], opts: DispatchOptions): DueReminder[] {
  const nowMs = Date.parse(opts.now);
  if (Number.isNaN(nowMs)) return [];
  const sent = opts.sentKeys ?? new Set<string>();
  const minLead = opts.minEmailLeadMinutes ?? 120;
  const lookback = (opts.lookbackMinutes ?? 1500) * MIN;
  const lookahead = (opts.lookaheadMinutes ?? 60) * MIN;

  const out: DueReminder[] = [];
  const seen = new Set<string>();

  for (const ev of events) {
    if (ev.status !== "upcoming") continue;
    const startMs = ev.start_utc ? Date.parse(ev.start_utc) : NaN;
    if (Number.isNaN(startMs) || startMs <= nowMs) continue; // no instant, or already started
    if (!Array.isArray(ev.reminders)) continue;

    for (const r of ev.reminders) {
      if (r.channel !== "email") continue; // only email dispatches server-side for now
      if (typeof r.minutesBefore !== "number" || !Number.isFinite(r.minutesBefore)) continue;
      if (r.minutesBefore < minLead) continue; // too short for a daily cron to serve

      const key = reminderKey(ev.id, "email", r.minutesBefore);
      if (sent.has(key) || seen.has(key)) continue;

      const fireMs = startMs - r.minutesBefore * MIN;
      // Due when the ideal fire time sits within [now - lookback, now + lookahead].
      if (fireMs < nowMs - lookback || fireMs > nowMs + lookahead) continue;

      seen.add(key);
      out.push({
        key,
        eventId: ev.id,
        userId: ev.user_id,
        channel: "email",
        minutesBefore: r.minutesBefore,
        fireAt: new Date(fireMs).toISOString(),
        event: ev,
      });
    }
  }
  return out;
}

/** Friendly lead-time label for the email copy ("1 day", "3 hours"). */
export function leadLabel(minutesBefore: number): string {
  if (minutesBefore % 1440 === 0) {
    const d = minutesBefore / 1440;
    return `${d} day${d !== 1 ? "s" : ""}`;
  }
  if (minutesBefore % 60 === 0) {
    const h = minutesBefore / 60;
    return `${h} hour${h !== 1 ? "s" : ""}`;
  }
  return `${minutesBefore} minutes`;
}
