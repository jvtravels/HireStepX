/* Supabase Auth webhook → founder notification email.
 *
 * Supabase fires a POST to /api/notifications/new-signup on every
 * auth.users INSERT (new account created). This handler verifies the
 * shared secret and sends a plain-text notification to the founder via
 * Resend — no auth required from the caller (Supabase's servers send it).
 *
 * Setup:
 *   1. Generate a random secret:  openssl rand -hex 32
 *   2. Add SUPABASE_WEBHOOK_SECRET to Vercel env vars
 *   3. In Supabase Dashboard → Database → Webhooks → Create a new webhook:
 *        Table: auth.users  |  Event: INSERT
 *        URL: https://hirestepx.com/api/notifications/new-signup
 *        Headers: { "x-webhook-secret": "<your-secret>" }
 */

export const config = { runtime: "edge" };

declare const process: { env: Record<string, string | undefined> };

const RESEND_API_KEY  = (process.env.RESEND_API_KEY  || "").trim();
const WEBHOOK_SECRET  = (process.env.SUPABASE_WEBHOOK_SECRET || "").trim();
const FROM_EMAIL      = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const FOUNDER_EMAIL   = "vyasjay85@gmail.com";

interface SupabaseWebhookBody {
  type: string;
  table: string;
  schema: string;
  record: {
    id: string;
    email?: string;
    phone?: string;
    created_at?: string;
    raw_user_meta_data?: Record<string, unknown>;
  };
}

function sendEmail(subject: string, text: string): void {
  if (!RESEND_API_KEY) return;
  void fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [FOUNDER_EMAIL],
      subject,
      text,
    }),
  }).catch(() => { /* fire-and-forget */ });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  /* Verify shared secret — reject anything that doesn't match */
  const secret = req.headers.get("x-webhook-secret") || "";
  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: SupabaseWebhookBody;
  try {
    body = await req.json() as SupabaseWebhookBody;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  /* Only care about new user inserts */
  if (body.type !== "INSERT" || body.schema !== "auth") {
    return new Response("ok", { status: 200 });
  }

  const { email, id, created_at, raw_user_meta_data } = body.record;
  const signedUpAt = created_at
    ? new Date(created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "unknown";

  const meta = raw_user_meta_data
    ? Object.entries(raw_user_meta_data)
        .map(([k, v]) => `  ${k}: ${String(v)}`)
        .join("\n")
    : "  (none)";

  const subject = `New signup on HireStepX: ${email ?? "unknown"}`;
  const text = [
    `Someone just signed up on HireStepX!`,
    ``,
    `Email:     ${email ?? "(no email)"}`,
    `User ID:   ${id}`,
    `Signed up: ${signedUpAt} IST`,
    ``,
    `User metadata:`,
    meta,
    ``,
    `-- HireStepX`,
  ].join("\n");

  sendEmail(subject, text);

  return new Response("ok", { status: 200 });
}
