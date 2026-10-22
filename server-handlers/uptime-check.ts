/* Vercel Cron — Uptime Monitor */
/* Hits /api/health, logs degraded status, emails on degradation. Also */
/* folds in the admin dashboard's business-level health signals (Groq */
/* fallback rate, session volume/failure anomalies, rate-card staleness — */
/* see _health-alerts.ts) so they reach an inbox instead of sitting */
/* poll-only behind the admin "health" tab. */
/* Schedule lives in vercel.json — runs daily (the plan only permits */
/* daily crons; sub-daily cadence is rejected at deploy time). For */
/* sub-daily uptime alerting (this is NOT minute-level; it runs once a day), */
/* point an external monitor (UptimeRobot/BetterStack) at /api/health; */
/* that is a dashboard signup, not something this cron can do. */
/* No logic here assumes any particular cadence. */
/* Visible in Vercel Dashboard → Logs for alerting */

import { verifyCronAuth } from "./_cron-auth";
import { getHealthAlerts, isActionRequired, actionSubjectBits } from "./_health-alerts";

export const config = { runtime: "edge" };

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  // Verify cron secret to prevent unauthorized triggers
  // Fail closed: an unset secret must not leave this endpoint open.
  if (!verifyCronAuth(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Probe the production host, not VERCEL_URL: that is the per-deployment URL,
  // which can sit behind Vercel deployment protection and answer 401 to the cron.
  const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://hirestepx.com").trim().replace(/\/$/, "");

  const logAlertFailure = (channel: string, extra: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: "error", source: "uptime-check", code: `alert_${channel}_failed`, ...extra, timestamp: new Date().toISOString() }));

  async function sendEmail(subject: string, text: string): Promise<boolean> {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error(JSON.stringify({ level: "error", source: "uptime-check", code: "alert_email_unconfigured", timestamp: new Date().toISOString() }));
      return false;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "HireStepX Alerts <alerts@hirestepx.com>",
          to: [(process.env.ALERT_EMAIL || "").trim() || "support@hirestepx.com"],
          subject,
          text,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return true;
      logAlertFailure("email", { httpStatus: res.status });
      return false;
    } catch (err) {
      logAlertFailure("email", { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  // Second channel so a Resend outage (which is also when this cron most needs
  // to speak up) does not silence the only alert.
  async function sendSlack(subject: string, text: string): Promise<boolean> {
    const hook = (process.env.SLACK_ALERT_WEBHOOK_URL || "").trim();
    if (!hook) return false;
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*${subject}*\n${text}` }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return true;
      logAlertFailure("slack", { httpStatus: res.status });
      return false;
    } catch (err) {
      logAlertFailure("slack", { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  // Returns false only when NO channel delivered. The caller surfaces that as a
  // 500 so the cron shows as failed instead of silently dropping the only
  // notification the founder gets.
  async function sendAlertEmail(subject: string, text: string): Promise<boolean> {
    const [email, slack] = await Promise.all([sendEmail(subject, text), sendSlack(subject, text)]);
    return email || slack;
  }

  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    // Business-level signals (fallback rate, session volume/failure anomalies,
    // rate-card staleness) catch incidents that a pure reachability ping can't
    // — e.g. Groq's API answers /v1/models fine but is erroring/throttling on
    // real completions. These used to be poll-only behind the admin dashboard's
    // "health" tab; folding them into this cron pushes them out daily instead.
    let businessAlerts: Awaited<ReturnType<typeof getHealthAlerts>>["alerts"] = [];
    try {
      businessAlerts = (await getHealthAlerts()).alerts;
    } catch (err) {
      console.error("[uptime-check] getHealthAlerts failed:", err);
    }
    const criticalBusinessAlerts = businessAlerts.filter(a => a.severity === "critical");

    if (data.status !== "healthy" || businessAlerts.length > 0) {
      // services may be absent on older deploys / unexpected shapes — default
      // to {} so a degraded response can never throw here (audit P1-3).
      const services: Record<string, string> = (data.services && typeof data.services === "object")
        ? data.services
        : {};

      // Log as error so it's easy to filter in Vercel logs
      console.error(JSON.stringify({
        level: "alert",
        source: "uptime-check",
        status: data.status,
        services,
        businessAlerts,
        timestamp: new Date().toISOString(),
      }));

      const degradedServices = Object.entries(services)
        .filter(([, v]) => v !== "ok")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const alertSummary = businessAlerts.map(a => `[${a.severity}] ${a.code}: ${a.message}`).join("\n") || "none";
      const subjectBits = [
        data.status !== "healthy" ? `services degraded (${degradedServices || "unknown"})` : null,
        ...actionSubjectBits(businessAlerts),
        criticalBusinessAlerts.length > 0 ? `${criticalBusinessAlerts.length} critical signal(s)` : null,
      ].filter(Boolean).join(", ") || "health signals present";

      // Money owed or a dead cron should be unmissable in an inbox of daily alerts.
      const action = isActionRequired(businessAlerts);
      const delivered = await sendAlertEmail(
        `${action ? "[ACTION] " : ""}[ALERT] HireStepX: ${subjectBits}`,
        `Health check at ${data.timestamp} returned status: ${data.status}\n\nServices:\n${JSON.stringify(services, null, 2)}\n\nBusiness health signals:\n${alertSummary}\n\nCheck: ${baseUrl}/api/health`,
      );

      return new Response(JSON.stringify({ alert: true, alertEmailSent: delivered, ...data, businessAlerts }), {
        status: data.status !== "healthy" ? 503 : delivered ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.warn(JSON.stringify({
      level: "info",
      source: "uptime-check",
      status: "healthy",
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ alert: false, ...data, businessAlerts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      level: "alert",
      source: "uptime-check",
      error: "Health check request failed",
      reason,
      timestamp: new Date().toISOString(),
    }));

    // An unreachable /api/health is the outage itself; it must page, not just log.
    const delivered = await sendAlertEmail(
      "[ACTION] [ALERT] HireStepX: health check unreachable",
      `The daily uptime check could not read ${baseUrl}/api/health (${reason}).\n\nThe site may be down, or the endpoint is failing. Check the Vercel deployment and logs.`,
    );

    return new Response(JSON.stringify({ alert: true, alertEmailSent: delivered, error: "Health check unreachable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
