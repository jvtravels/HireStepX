/* Vercel Edge Function — Signed URL for a chat attachment
 *
 * GET /api/message-attachment-url?messageId=... -> { url }
 *
 * `chat-attachments` is a private bucket (unlike the public employer-logos
 * bucket) — chat files are never served by a public URL. This mints a
 * short-lived signed URL after confirming the caller is a party to the
 * message's conversation, same ownership check as flag-message.ts.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { resolveRole, MESSAGE_ID_RE } from "./_messages-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "chat-attachments";
const SIGNED_URL_TTL_SECONDS = 300;

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowGet: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowGet: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "message-attachment-url",
    ipLimit: 60,
    userLimit: 30,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const url = new URL(req.url);
  const messageId = url.searchParams.get("messageId") || "";
  if (!MESSAGE_ID_RE.test(messageId)) {
    return new Response(JSON.stringify({ error: "Invalid messageId" }), { status: 400, headers });
  }

  try {
    const msgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_messages?id=eq.${encodeURIComponent(messageId)}` +
        `&select=id,employer_id,candidate_user_id,attachment_path`,
      { headers: serviceHeaders() },
    );
    const msgRows = (await msgRes.json().catch(() => [])) as Array<{
      id: string; employer_id: string; candidate_user_id: string; attachment_path: string | null;
    }>;
    if (!msgRes.ok || !msgRows[0]) {
      return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers });
    }
    const message = msgRows[0];
    if (!resolveRole(auth.userId, message.employer_id, message.candidate_user_id)) {
      return new Response(JSON.stringify({ error: "Not authorized for this conversation" }), { status: 403, headers });
    }
    if (!message.attachment_path) {
      return new Response(JSON.stringify({ error: "This message has no attachment" }), { status: 404, headers });
    }

    const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${message.attachment_path}`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    });
    const signData = (await signRes.json().catch(() => ({}))) as { signedURL?: string };
    if (!signRes.ok || !signData.signedURL) {
      return new Response(JSON.stringify({ error: "Could not generate a download link" }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ url: `${SUPABASE_URL}/storage/v1${signData.signedURL}` }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("message-attachment-url threw", { code: "message_attachment_url_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to generate download link" }), { status: 500, headers });
  }
}
