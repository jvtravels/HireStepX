/* Vercel Edge Function — Waitlist Signup
 *
 * Server-side path for the ComingSoon waitlist form. The form previously
 * called supabase-js directly from the browser, which depends on the
 * waitlist table having permissive anon-INSERT RLS — and we kept hitting
 * "table doesn't accept this insert" errors when the deployed schema
 * didn't match what the form sent.
 *
 * This endpoint uses the service role key, which bypasses RLS entirely.
 * Failure modes are captured server-side and surfaced as actionable
 * messages to the client (so the user sees "this email is already on
 * the list" instead of a generic "couldn't save").
 *
 * POST /api/waitlist-signup { email, source?, referrer?, utm_source? ... }
 */

export const config = { runtime: "edge" };

import { corsHeaders, withRequestId, isRateLimited, getClientIp, checkBodySize, tooLargeResponse, rateLimitResponse } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface SignupBody {
  email?: unknown;
  source?: unknown;
  referrer?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req)),
    });
  }

  /* This endpoint is intentionally UNAUTHENTICATED — anyone can submit
     their email. We can't use withAuthAndRateLimit (it requires auth).
     Manual preamble: body size cap + IP rate limit. Bot abuse is also
     mitigated by the client-side honeypot + min-time heuristic in
     ComingSoon.tsx, and the table itself dedupes on email. */
  const headers = withRequestId(corsHeaders(req));
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  if (checkBodySize(req, 2_000)) return tooLargeResponse(headers);
  const ip = getClientIp(req);
  if (await isRateLimited(ip, "waitlist-signup", 10, 60_000)) {
    return rateLimitResponse(headers);
  }

  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const email = asString(body.email, 254).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "Please enter a valid email address." }), { status: 400, headers });
  }

  const payload: Record<string, string> = {
    email,
    source: asString(body.source, 50) || "coming_soon",
    referrer: asString(body.referrer, 200),
    utm_source: asString(body.utm_source, 100),
    utm_medium: asString(body.utm_medium, 100),
    utm_campaign: asString(body.utm_campaign, 100),
  };

  /* PostgREST insert with progressive fallback. We try the most
     desirable behavior first (upsert with all UTM columns) and fall
     back through three tiers — each strips assumptions until something
     works. This is robust against an existing table whose schema
     predates this code. */
  const baseUrl = `${SUPABASE_URL}/rest/v1/waitlist`;
  const baseHeaders = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  };

  type Attempt = { url: string; body: Record<string, unknown>; description: string };
  const attempts: Attempt[] = [
    /* T1: upsert on email with all the columns we'd ideally store. */
    { url: `${baseUrl}?on_conflict=email`, body: payload, description: "full upsert" },
    /* T2: same body, no on_conflict (the table may have a different
       UNIQUE constraint, e.g. id-based PK with email as plain column). */
    { url: baseUrl, body: payload, description: "plain insert with UTM" },
    /* T3: minimal body — drops UTM/source/referrer. Catches tables
       that have email + created_at only. */
    { url: baseUrl, body: { email }, description: "minimal email-only insert" },
  ];

  let lastErrText = "";
  let lastStatus = 0;
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(attempt.body),
      });
      if (res.ok) {
        if (attempt !== attempts[0]) {
          console.warn(`[waitlist-signup] succeeded on fallback "${attempt.description}"`);
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }
      lastErrText = await res.text().catch(() => "");
      lastStatus = res.status;

      /* Duplicate-key conflict on a non-upsert path = success from the
         user's perspective (their email is already on the list). */
      if (/duplicate key|unique constraint/i.test(lastErrText)) {
        return new Response(JSON.stringify({ ok: true, alreadySignedUp: true }), { status: 200, headers });
      }

      /* Hard failures we should NOT retry past — table missing means
         the schema isn't applied; further retries won't help. */
      if (/relation .* does not exist|relation "waitlist" does not exist|table .* not found/i.test(lastErrText)) {
        console.error(`[waitlist-signup] table missing: ${lastErrText.slice(0, 200)}`);
        return new Response(JSON.stringify({
          error: "Waitlist isn't set up yet — please email hello@hirestepx.com to get on the list.",
        }), { status: 503, headers });
      }

      console.warn(`[waitlist-signup] attempt "${attempt.description}" failed HTTP ${res.status}: ${lastErrText.slice(0, 200)}`);
      /* Otherwise loop to next fallback. */
    } catch (err) {
      lastErrText = err instanceof Error ? err.message : String(err);
      console.warn(`[waitlist-signup] attempt "${attempt.description}" threw: ${lastErrText.slice(0, 200)}`);
    }
  }

  console.error(`[waitlist-signup] all attempts failed. last status=${lastStatus} body=${lastErrText.slice(0, 300)}`);
  return new Response(JSON.stringify({
    error: "We couldn't save your email. Please try again — or email hello@hirestepx.com.",
  }), { status: 500, headers });
}
