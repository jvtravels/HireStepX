/* Vercel Cron — Uptime Monitor */
/* Hits /api/health, logs degraded status, emails on degradation. Also */
/* folds in the admin dashboard's business-level health signals (Groq */
/* fallback rate, session volume/failure anomalies, rate-card staleness — */
/* see _health-alerts.ts) so they reach an inbox instead of sitting */
/* poll-only behind the admin "health" tab. */
/* Schedule lives in vercel.json — runs daily (the plan only permits */
/* daily crons; sub-daily cadence is rejected at deploy time). For */
/* minute-level uptime alerting — the gap that matters most during a fast */
/* traffic surge — point an external monitor (UptimeRobot/BetterStack) at */
/* /api/health; that is a dashboard signup, not something this cron can do. */
/* No logic here assumes any particular cadence. */
/* Visible in Vercel Dashboard → Logs for alerting */

import { getHealthAlerts } from "./_health-alerts";

export const config = { runtime: "edge" };

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://hirestepx.vercel.app";

  async function sendAlertEmail(subject: string, text: string) {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "HireStepX Alerts <alerts@hirestepx.com>",
        to: ["support@hirestepx.com"],
        subject,
        text,
      }),
    }).catch((err) => {
      console.error("Failed to send alert email:", err);
    });
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
        criticalBusinessAlerts.length > 0 ? `${criticalBusinessAlerts.length} critical signal(s)` : null,
      ].filter(Boolean).join(", ") || "health signals present";

      await sendAlertEmail(
        `[ALERT] HireStepX: ${subjectBits}`,
        `Health check at ${data.timestamp} returned status: ${data.status}\n\nServices:\n${JSON.stringify(services, null, 2)}\n\nBusiness health signals:\n${alertSummary}\n\nCheck: ${baseUrl}/api/health`,
      );

      return new Response(JSON.stringify({ alert: true, ...data, businessAlerts }), {
        status: data.status !== "healthy" ? 503 : 200,
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
  } catch {
    console.error(JSON.stringify({
      level: "alert",
      source: "uptime-check",
      error: "Health check request failed",
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ alert: true, error: "Health check unreachable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
