/* Vercel Edge Function — Client Error Logger */
/* Receives error reports from the browser and logs them to Vercel's function logs */
/* These are visible in Vercel Dashboard → Logs, searchable and filterable */
/* Also forwards to PostHog so frontend errors live alongside server events
 * and can be correlated with session replays + funnel drop-offs. */

export const config = { runtime: "edge" };

import { captureServerEvent, distinctIdFrom } from "./_posthog";

const _rateLimit = new Map<string, number[]>();
function checkRate(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (_rateLimit.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) return false;
  hits.push(now);
  _rateLimit.set(ip, hits);
  return true;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-real-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const ip = getClientIp(req);
  if (!checkRate(ip, 20, 60_000)) {
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

    // Log to Vercel function logs (visible in dashboard)
    console.error(JSON.stringify({
      level: "error",
      source: "client",
      message: body.message?.slice(0, 500),
      stack: body.stack?.slice(0, 2000),
      url: body.url?.slice(0, 500),
      timestamp: body.timestamp,
      userAgent: body.userAgent?.slice(0, 300),
    }));

    // Also send to PostHog so the error shows up next to server events and
    // session replays for triage. Best-effort — don't block the response.
    void captureServerEvent("client_error", distinctIdFrom(req, body.userId), {
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
