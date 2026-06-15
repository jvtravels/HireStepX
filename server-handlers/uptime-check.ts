/* Vercel Cron — Uptime Monitor */
/* Hits /api/health, logs degraded status, emails on degradation. */
/* Schedule lives in vercel.json (currently daily — bump to a 15-minute */
/* cadence once on a Vercel plan that permits sub-daily crons). */
/* Visible in Vercel Dashboard → Logs for alerting */

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

  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    if (data.status !== "healthy") {
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
        timestamp: new Date().toISOString(),
      }));

      // If Resend is configured, send alert email
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const degradedServices = Object.entries(services)
          .filter(([, v]) => v !== "ok")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ") || "unknown (no per-service detail in response)";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "HireStepX Alerts <alerts@hirestepx.com>",
            to: ["support@hirestepx.com"],
            subject: `[ALERT] HireStepX services degraded: ${degradedServices}`,
            text: `Health check at ${data.timestamp} returned status: ${data.status}\n\nServices:\n${JSON.stringify(services, null, 2)}\n\nCheck: ${baseUrl}/api/health`,
          }),
        }).catch((err) => {
          console.error("Failed to send alert email:", err);
        });
      }

      return new Response(JSON.stringify({ alert: true, ...data }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.warn(JSON.stringify({
      level: "info",
      source: "uptime-check",
      status: "healthy",
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ alert: false, ...data }), {
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
