/* Vercel Edge Function — Client Error Logger */
/* Receives error reports from the browser and logs them to Vercel's function logs */
/* These are visible in Vercel Dashboard → Logs, searchable and filterable */
/* Also forwards to PostHog so frontend errors live alongside server events
 * and can be correlated with session replays + funnel drop-offs. */

export const config = { runtime: "edge" };

import { captureServerEvent, distinctIdFrom } from "./_posthog";
import { isRateLimited, getClientIp } from "./_shared";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const ip = getClientIp(req);
  if (await isRateLimited(ip, "log-error", 20, 60_000)) {
    return new Response("Too many requests", { status: 429 });
  }

  // Reject oversized payloads
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 65536) {
    return new Response("Payload too large", { status: 413 });
  }

  try {
    const body = await req.json();

    // Validate basic shape
    if (!body.message || typeof body.message !== "string") {
      return new Response("Bad request", { status: 400 });
    }

    // Audit events also use this endpoint as a best-effort log sink. Preserve
    // their lower severity so expected auth events don't appear as app errors.
    const level = body.level === "info" || body.level === "warn" ? body.level : "error";
    const entry = JSON.stringify({
      level,
      source: "client",
      message: body.message?.slice(0, 500),
      stack: body.stack?.slice(0, 2000),
      url: body.url?.slice(0, 500),
      timestamp: body.timestamp,
      userAgent: body.userAgent?.slice(0, 300),
    });
    if (level === "info") console.info(entry);
    else if (level === "warn") console.warn(entry);
    else console.error(entry);

    // Also send to PostHog so the error shows up next to server events and
    // session replays for triage. Best-effort — don't block the response.
    const analyticsEvent = level === "info" ? "client_audit" : level === "warn" ? "client_warning" : "client_error";
    void captureServerEvent(analyticsEvent, distinctIdFrom(req, body.userId), {
      level,
      message: typeof body.message === "string" ? body.message.slice(0, 500) : "",
      url: typeof body.url === "string" ? body.url.slice(0, 500) : "",
      stack_first_frame: typeof body.stack === "string" ? body.stack.split("\n").slice(0, 3).join("\n").slice(0, 400) : "",
      user_agent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 200) : "",
    }, req);

    return new Response("ok", { status: 200 });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}
