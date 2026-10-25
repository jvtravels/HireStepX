/* Vercel Cron Function — Send interview reminder emails (PRI-35)
 *
 * Runs daily. Scans upcoming calendar events, finds long-lead email reminders
 * whose fire time has arrived (see _reminder-dispatch for the rule), sends each
 * once via Resend, and records it in calendar_reminder_log so the next scan
 * never double-sends. Near-term nudges (< 2h) are handled client-side by
 * src/interviewNotifications.ts; server-initiated web push is a future phase.
 */

import { verifyCronAuth } from "./_cron-auth";
import { recordCronResult } from "./_cron-heartbeat";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button, dataCard } from "./_email-theme";
import { fetchAllPages, mapPool, timeBudget } from "./_batch";
import { dueReminders, leadLabel, type ReminderEvent } from "./_reminder-dispatch";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const HORIZON_DAYS = 8; // furthest out an in-window reminder can reference
const PAGE_SIZE = 500;
const MAX_PAGES = 10;
const LOOKUP_CHUNK = 50;
const SEND_CONCURRENCY = 4;
const RUN_BUDGET_MS = 45_000;

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
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

    // Ordered + paginated so a busy window never silently drops events past a fixed cap.
    const eventsBase =
      `${SUPABASE_URL}/rest/v1/calendar_events?status=eq.upcoming` +
      `&start_utc=gte.${now.toISOString()}&start_utc=lte.${horizon.toISOString()}` +
      `&reminders=neq.[]` +
      `&select=id,user_id,title,company,start_utc,timezone,status,reminders&order=start_utc.asc,id.asc`;
    let firstPageFailed = false;
    const { rows: events, complete: eventsComplete } = await fetchAllPages<ReminderEvent>(async (offset, limit) => {
      const r = await fetch(`${eventsBase}&limit=${limit}&offset=${offset}`, { headers: svcHeaders(), signal: AbortSignal.timeout(10_000) }).catch(() => null);
      if (!r || !r.ok) {
        if (offset === 0) { firstPageFailed = true; console.error(`[cron:interview-reminders] event query failed (${r?.status ?? "network"})`); }
        return null;
      }
      const json = await r.json().catch(() => null);
      return Array.isArray(json) ? json : null;
    }, PAGE_SIZE, MAX_PAGES);
    if (firstPageFailed) {
      return res.status(500).json({ error: "Failed to query events" });
    }
    if (!eventsComplete) console.error(`[cron:interview-reminders] WARNING: event scan incomplete (${events.length} loaded)`);
    if (events.length === 0) {
      await recordCronResult("send-interview-reminders", { errors: 0 });
      return res.status(200).json({ sent: 0, message: "No upcoming events with reminders" });
    }

    // Chunked lookups: one giant in.(...) list exceeds URL limits and the response row cap.
    const sentKeys = new Set<string>();
    for (let i = 0; i < events.length; i += LOOKUP_CHUNK) {
      const ids = events.slice(i, i + LOOKUP_CHUNK).map((e) => encodeURIComponent(e.id)).join(",");
      try {
        const logRes = await fetch(
          `${SUPABASE_URL}/rest/v1/calendar_reminder_log?event_id=in.(${ids})&select=event_id,channel,minutes_before`,
          { headers: svcHeaders(), signal: AbortSignal.timeout(10_000) },
        );
        if (logRes.ok) {
          const rows = await logRes.json().catch(() => []);
          if (Array.isArray(rows)) for (const r of rows) sentKeys.add(`${r.event_id}:${r.channel}:${r.minutes_before}`);
        }
      } catch { /* a missed dedup row only risks a resend */ }
    }

    const due = dueReminders(events, { now: now.toISOString(), sentKeys });
    if (due.length === 0) {
      await recordCronResult("send-interview-reminders", { errors: 0 });
      return res.status(200).json({ sent: 0, message: "No reminders due", scanned: events.length });
    }

    // Resolve recipient emails for the users involved.
    const userIds = Array.from(new Set(due.map((d) => d.userId)));
    const emailByUser = new Map<string, { email: string; name: string }>();
    for (let i = 0; i < userIds.length; i += LOOKUP_CHUNK) {
      const ids = userIds.slice(i, i + LOOKUP_CHUNK).map(encodeURIComponent).join(",");
      try {
        const profRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids})&select=id,email,name`,
          { headers: svcHeaders(), signal: AbortSignal.timeout(10_000) },
        );
        if (profRes.ok) {
          const profs = await profRes.json().catch(() => []);
          if (Array.isArray(profs)) {
            for (const p of profs) if (p.email) emailByUser.set(p.id, { email: p.email, name: p.name || "there" });
          }
        }
      } catch { /* those users are skipped this run and retried next */ }
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let skippedForTime = 0;
    const budget = timeBudget(RUN_BUDGET_MS);
    await mapPool(due, SEND_CONCURRENCY, async (d) => {
      if (budget.expired()) { skippedForTime++; return; }
      const recipient = emailByUser.get(d.userId);
      if (!recipient || !d.event.start_utc) {
        skipped++;
        return;
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
          return;
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
    });

    // Only a run where every send failed counts as unhealthy; one bad address must not page.
    await recordCronResult("send-interview-reminders", { errors: sent === 0 ? failed : 0 });
    return res.status(200).json({ sent, failed, skipped, skippedForTime, due: due.length, scanned: events.length, complete: eventsComplete });
  } catch (err) {
    console.error("[cron:interview-reminders] fatal:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
