/* Vercel Edge Function — Help & Support widget feedback intake.
 *
 * Stores free-text feedback / issue reports from the floating "?" widget into
 * the service-role-only `support_messages` table. The previous client did a
 * direct supabase-js insert into the per-session `feedback` table, which has a
 * different schema (rating/session_id NOT NULL) — so every submission failed
 * and silently fell back to a mailto: pop-up. This endpoint is the real,
 * persisted destination the operator reads in the Supabase dashboard.
 *
 * POST /api/support-feedback
 *   { message, page?, userAgent? }   (email is derived from the auth context)
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

/** Fire-and-forget: send email via Resend. Errors are swallowed so they never
 *  block the API response — the DB insert is the durable record. */
function sendResendEmail(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
}): void {
  if (!RESEND_API_KEY) return;
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => { /* best-effort — don't surface Resend failures to users */ });
}

interface SupportBody {
  message?: unknown;
  email?: unknown;
  page?: unknown;
  userAgent?: unknown;
  type?: unknown;
}

function asString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
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

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "support-feedback",
    ipLimit: 20,
    userLimit: 10,
    maxBytes: 8_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  if (!auth.userId || typeof auth.userId !== "string") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: SupportBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const message = asString(body.message, 4000).trim();
  const email = asString(body.email, 254).trim() || null;
  const page = asString(body.page, 200) || null;
  const userAgent = asString(body.userAgent, 400) || null;
  const rawType = asString(body.type, 20).toLowerCase();
  const type = (["bug", "feature", "billing", "other"].includes(rawType) ? rawType : "other");

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), { status: 400, headers });
  }

  // Fetch user context (plan tier + 30-day session count) concurrently — best-effort,
  // never blocks or fails the submit if these queries flake.
  const authHeaders = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [profileRes, sessionCountRes] = await Promise.allSettled([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(auth.userId)}&select=subscription_tier&limit=1`,
      { headers: authHeaders },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(auth.userId)}&created_at=gte.${encodeURIComponent(thirtyDaysAgo)}&select=id`,
      { headers: authHeaders },
    ),
  ]);

  let planTier: string | null = null;
  if (profileRes.status === "fulfilled" && profileRes.value.ok) {
    const rows = await profileRes.value.json().catch(() => []) as Array<{ subscription_tier?: string | null }>;
    planTier = rows[0]?.subscription_tier ?? null;
  }

  let sessionCount30d = 0;
  if (sessionCountRes.status === "fulfilled" && sessionCountRes.value.ok) {
    const rows = await sessionCountRes.value.json().catch(() => []) as unknown[];
    sessionCount30d = Array.isArray(rows) ? rows.length : 0;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/support_messages`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: auth.userId,
        email,
        message,
        page,
        user_agent: userAgent,
        type,
        plan_tier: planTier,
        session_count_30d: sessionCount30d,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[support-feedback] supabase error: HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return new Response(JSON.stringify({ ok: false, persisted: false }), { status: 502, headers });
    }

    const timestamp = new Date().toISOString();

    // Admin notification — fire and forget
    sendResendEmail({
      from: "HireStepX Support <noreply@hirestepx.com>",
      to: ["support@hirestepx.com"],
      subject: `[Support][${type.toUpperCase()}] New message from ${email || auth.userId}`,
      html: `
        <p><strong>User:</strong> ${email || "(no email)"} (ID: ${auth.userId})</p>
        <p><strong>Plan:</strong> ${planTier || "unknown"} &nbsp;|&nbsp; <strong>Sessions (30d):</strong> ${sessionCount30d}</p>
        <p><strong>Type:</strong> ${type} &nbsp;|&nbsp; <strong>Page:</strong> ${page || "(unknown)"}</p>
        <p><strong>Received:</strong> ${timestamp}</p>
        <hr/>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${message.replace(/\n/g, "<br/>")}</blockquote>
      `,
    });

    // Auto-reply to user — only when email is available
    if (email) {
      sendResendEmail({
        from: "HireStepX Support <support@hirestepx.com>",
        to: [email],
        subject: "We received your message — HireStepX Support",
        html: `
          <p>Hi,</p>
          <p>We've received your message and will get back to you within 1 business day.</p>
          <p>Here's what you sent:</p>
          <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${message.slice(0, 500).replace(/\n/g, "<br/>")}${message.length > 500 ? "…" : ""}</blockquote>
          <p>Reply to this email or reach us at <a href="mailto:support@hirestepx.com">support@hirestepx.com</a>.</p>
          <p>— The HireStepX Team</p>
        `,
      });
    }

    return new Response(JSON.stringify({ ok: true, persisted: true }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[support-feedback] threw: ${msg.slice(0, 200)}`);
    return new Response(JSON.stringify({ ok: false, persisted: false }), { status: 502, headers });
  }
}
