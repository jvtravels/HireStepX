/* Public one-click unsubscribe — RFC 8058 target and in-page confirm button.
 *
 * GET  /api/unsubscribe?t=TOKEN  → 302 to /unsubscribe?t=TOKEN. Never changes
 *      state: mail scanners and link previewers prefetch GET links, and must
 *      not unsubscribe people by accident.
 * POST /api/unsubscribe?t=TOKEN  → applies the opt-out and returns 200. Mail
 *      providers send `List-Unsubscribe=One-Click` as the form body with no
 *      cookies and no Origin, so there is deliberately no auth or origin
 *      check; the HMAC token is the credential. Body `action=resubscribe`
 *      (from the confirmation page) reverses it.
 * Idempotent. IP-rate-limited. */

export const config = { runtime: "edge" };

import { getClientIp, isRateLimited, withRequestId } from "./_shared";
import {
  CATEGORY_LABEL,
  preferenceDepsFromEnv,
  setEmailOptOut,
  verifyUnsubscribeToken,
  type PreferenceDeps,
} from "./_unsubscribe";

const MAX_BODY_BYTES = 2_000;

function json(status: number, payload: Record<string, unknown>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withRequestId({ "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...extra }),
  });
}

export interface UnsubscribeDeps {
  prefs?: PreferenceDeps;
  rateLimited?: (ip: string) => Promise<boolean>;
}

export async function handleUnsubscribe(req: Request, deps: UnsubscribeDeps = {}): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  if (req.method === "GET") {
    const dest = new URL("/unsubscribe", url);
    if (token) dest.searchParams.set("t", token);
    return new Response(null, { status: 302, headers: { Location: dest.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, { Allow: "GET, POST" });

  const limited = deps.rateLimited ?? ((ip: string) => isRateLimited(ip, "unsubscribe", 30, 60_000));
  if (await limited(getClientIp(req))) return json(429, { error: "Too many requests. Please try again shortly." }, { "Retry-After": "60" });

  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" });
  const form = new URLSearchParams(raw);
  const action = form.get("action") === "resubscribe" ? "resubscribe" : "unsubscribe";

  const verified = await verifyUnsubscribeToken(token);
  if (!verified.ok) {
    if (verified.reason === "unconfigured") return json(503, { error: "Unsubscribe is temporarily unavailable" });
    return verified.reason === "malformed" ? json(400, { error: "Invalid unsubscribe link" }) : json(403, { error: "Invalid unsubscribe link" });
  }

  const optOut = action === "unsubscribe";
  const saved = await setEmailOptOut(deps.prefs ?? preferenceDepsFromEnv(), verified.userId, verified.category, optOut);
  if (!saved) return json(503, { error: "We couldn't save your preference. Please try again in a few minutes." });
  return json(200, { ok: true, category: verified.category, label: CATEGORY_LABEL[verified.category], optedOut: optOut });
}

export default function handler(req: Request): Promise<Response> {
  return handleUnsubscribe(req);
}
