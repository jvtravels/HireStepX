/* Vercel Cron Function — Send interview reminder emails (PRI-35)
 *
 * Runs daily. Scans upcoming calendar events, finds long-lead email reminders
 * whose fire time has arrived (see _reminder-dispatch for the rule), sends each
 * once via Resend, and records it in calendar_reminder_log so the next scan
 * never double-sends. Near-term nudges (< 2h) are handled client-side by
 * src/interviewNotifications.ts; server-initiated web push is a future phase.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button, dataCard } from "./_email-theme";
import { dueReminders, leadLabel, type ReminderEvent } from "./_reminder-dispatch";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <onboarding@resend.dev>";
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const HORIZON_DAYS = 8; // furthest out an in-window reminder can reference

function svcHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

function fmtWhen(startUtc: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short", day: "numeric", month: "short",
      hour: "numeric", minute: "2-digit", timeZone: tz,
    }).format(new Date(startUtc));
  } catch {
    return new Date(startUtc).toUTCString();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Fail closed: accept Vercel's cron header or an explicit bearer secret.
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const hasSecret = CRON_SECRET && req.headers.authorization === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !hasSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

    // Upcoming events with at least one reminder configured, in the horizon.
    const eventsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/calendar_events?status=eq.upcoming` +
        `&start_utc=gte.${now.toISOString()}&start_utc=lte.${horizon.toISOString()}` +
        `&reminders=neq.[]` +
        `&select=id,user_id,title,company,start_utc,timezone,status,reminders&limit=500`,
      { headers: svcHeaders(), signal: AbortSignal.timeout(10_000) },
    );
    if (!eventsRes.ok) {
      console.error(`[cron:interview-reminders] event query failed (${eventsRes.status})`);
      return res.status(500).json({ error: "Failed to query events" });
    }
    const events: ReminderEvent[] = await eventsRes.json();
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ sent: 0, message: "No upcoming events with reminders" });
    }

    // Pull the already-sent log for just these events to build the dedup set.
    const eventIds = events.map((e) => e.id);
    const sentKeys = new Set<string>();
    const logRes = await fetch(
      `${SUPABASE_URL}/rest/v1/calendar_reminder_log?event_id=in.(${eventIds.map(encodeURIComponent).join(",")})` +
        `&select=event_id,channel,minutes_before`,
      { headers: svcHeaders(), signal: AbortSignal.timeout(10_000) },
    );
    if (logRes.ok) {
      const rows = await logRes.json().catch(() => []);
      if (Array.isArray(rows)) {
        for (const r of rows) sentKeys.add(`${r.event_id}:${r.channel}:${r.minutes_before}`);
      }
    }

    const due = dueReminders(events, { now: now.toISOString(), sentKeys });
    if (due.length === 0) {
      return res.status(200).json({ sent: 0, message: "No reminders due", scanned: events.length });
    }

    // Resolve recipient emails for the users involved.
    const userIds = Array.from(new Set(due.map((d) => d.userId)));
    const emailByUser = new Map<string, { email: string; name: string }>();
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${userIds.map(encodeURIComponent).join(",")})&select=id,email,name`,
      { headers: svcHeaders(), signal: AbortSignal.timeout(10_000) },
    );
    if (profRes.ok) {
      const profs = await profRes.json().catch(() => []);
      if (Array.isArray(profs)) {
        for (const p of profs) if (p.email) emailByUser.set(p.id, { email: p.email, name: p.name || "there" });
      }
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const d of due) {
      const recipient = emailByUser.get(d.userId);
      if (!recipient || !d.event.start_utc) {
        skipped++;
        continue;
      }
      const lead = leadLabel(d.minutesBefore);
      const when = fmtWhen(d.event.start_utc, d.event.timezone || "Asia/Kolkata");
      const heading = d.event.company ? `${d.event.company} interview` : "Your interview";
      const calUrl = `${APP_URL}/calendar`;

      const emailBody = JSON.stringify({
        from: FROM_EMAIL,
        to: [recipient.email],
        subject: `In ${lead}: ${d.event.title}`,
        html: emailShell({
          preview: `Your interview is in ${lead}. A quick prep run now pays off.`,
          body:
            title("Your interview", { accentWord: `in ${lead}.` }) +
            para(`Hi ${escapeHtml(recipient.name)}, this is your reminder that ${b(escapeHtml(heading))} is coming up. Block a few minutes to review your notes and run a quick mock so you walk in warm.`) +
            dataCard("Interview", [
              ["What", escapeHtml(d.event.title)],
              ["When", escapeHtml(when)],
              ["Lead time", lead],
            ]) +
            button("Open your calendar", calUrl),
        }),
      });

      const sendEmail = async (): Promise<boolean> => {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 10_000);
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            signal: ac.signal,
            body: emailBody,
          });
          return r.ok;
        } finally {
          clearTimeout(t);
        }
      };

      try {
        let ok = await sendEmail();
        if (!ok) {
          await new Promise((r) => setTimeout(r, 1000));
          ok = await sendEmail();
        }
        if (!ok) {
          failed++;
          console.error(`[cron:interview-reminders] send failed for event ${d.eventId}`);
          continue;
        }
        // Record the send. ignore-duplicates makes a concurrent run a no-op
        // rather than a double-send; a log write failure only risks a resend.
        await fetch(`${SUPABASE_URL}/rest/v1/calendar_reminder_log`, {
          method: "POST",
          headers: svcHeaders({ "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }),
          body: JSON.stringify({
            user_id: d.userId,
            event_id: d.eventId,
            channel: d.channel,
            minutes_before: d.minutesBefore,
          }),
          signal: AbortSignal.timeout(10_000),
        }).catch((e) => console.error(`[cron:interview-reminders] log write failed for ${d.eventId}:`, e));
        sent++;
      } catch (err) {
        failed++;
        console.error(`[cron:interview-reminders] error for event ${d.eventId}:`, err);
      }
    }

    return res.status(200).json({ sent, failed, skipped, due: due.length, scanned: events.length });
  } catch (err) {
    console.error("[cron:interview-reminders] fatal:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
