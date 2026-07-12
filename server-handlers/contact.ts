/* Public (unauthenticated) contact-form handler for the marketing site.
 *
 * POST /api/contact
 *   { name, email, topic, message }
 *
 * Sends an email to support@hirestepx.com via Resend and sends an
 * auto-reply to the submitter. IP-rate-limited to 5/hour to prevent abuse.
 * No auth required — this is a public marketing surface.
 */

export const config = { runtime: "edge" };

import { corsHeaders, withRequestId, isRateLimited, getClientIp } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";

interface ContactBody {
  name: string;
  email: string;
  topic: string;
  message: string;
}

function sendEmail(payload: { from: string; to: string[]; replyTo?: string; subject: string; html: string }): void {
  if (!RESEND_API_KEY) return;
  void fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => { /* fire-and-forget */ });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: withRequestId(corsHeaders(req)),
    });
  }

  const headers = withRequestId(corsHeaders(req));
  const ip = getClientIp(req);

  if (await isRateLimited(ip, "contact", 5, 3_600_000)) {
    return new Response(JSON.stringify({ error: "Too many requests — please try again in an hour." }), {
      status: 429, headers,
    });
  }

  let body: ContactBody;
  try {
    const raw = await req.text();
    if (raw.length > 10_000) {
      return new Response(JSON.stringify({ error: "Message too long" }), { status: 413, headers });
    }
    body = JSON.parse(raw) as ContactBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400, headers });
  }

  const { name, email, topic, message } = body;
  if (!name || !email || !message || typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email address" }), { status: 400, headers });
  }

  const safeText = (s: string) => String(s).slice(0, 2000).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ref = `HSX-${Date.now().toString(36).toUpperCase()}`;

  // Notify the support team
  sendEmail({
    from: FROM_EMAIL,
    to: ["support@hirestepx.com"],
    replyTo: email,
    subject: `[Contact] ${safeText(topic || "General")} — ${safeText(name)} (${ref})`,
    html: `
      <p><strong>From:</strong> ${safeText(name)} &lt;${safeText(email)}&gt;</p>
      <p><strong>Topic:</strong> ${safeText(topic || "—")}</p>
      <p><strong>Ref:</strong> ${ref}</p>
      <hr/>
      <p>${safeText(message).replace(/\n/g, "<br/>")}</p>
    `,
  });

  // Auto-reply to the submitter
  sendEmail({
    from: FROM_EMAIL,
    to: [email],
    subject: `We got your message (${ref}) — HireStepX Support`,
    html: `
      <p>Hi ${safeText(name)},</p>
      <p>Thanks for reaching out. We've received your message and will reply within 1 business day.</p>
      <p>Your reference number is <strong>${ref}</strong> — quote it if you follow up.</p>
      <p>— HireStepX Support Team</p>
      <hr/>
      <p style="color:#888;font-size:12px;">Your message: ${safeText(message).replace(/\n/g, "<br/>")}</p>
    `,
  });

  return new Response(JSON.stringify({ ok: true, ref }), { status: 200, headers });
}
