/* Vercel Edge Function — Employer Request Contact Details
 *
 * POST /api/employer-request-contact
 * { matchId: string, fields: ("phone" | "email" | "linkedin" | "portfolio")[] }
 *
 * Lets an employer ask an unlocked candidate to add missing contact details.
 * The candidate gets an in-app notification (grouped per match so repeat
 * requests bump one row) and a system message in the match thread.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { asContactRequestFields, contactRequestText } from "./_employer-contact-request-helpers";
import { notify } from "./_notify";
import { findOrCreateConversationId, postSystemMessage } from "./_messages-helpers";
import { loadEmployerMatchAccess, loadAuthIdentity, DENIED_STATUS } from "./_entitlements";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 503, headers: withRequestId(corsHeaders(req)) });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-request-contact",
    ipLimit: 20,
    userLimit: 10,
    maxBytes: 2_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: { matchId?: unknown; fields?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const matchId = typeof body.matchId === "string" ? body.matchId : "";
  const fields = asContactRequestFields(body.fields);
  if (!matchId) {
    return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  }
  if (!fields) {
    return new Response(JSON.stringify({ error: "Choose at least one detail to request" }), { status: 400, headers });
  }

  try {
    const identity = await loadAuthIdentity(SUPABASE_URL, serviceHeaders(), auth.userId);
    const decision = await loadEmployerMatchAccess({
      supabaseUrl: SUPABASE_URL,
      headers: serviceHeaders(),
      employerId: auth.userId,
      matchId,
      authEmail: identity.email,
      emailConfirmed: identity.emailConfirmed,
    });
    if (!decision.ok) {
      if (decision.reason === "error") {
        return new Response(JSON.stringify({ error: "Failed to send request" }), { status: 502, headers });
      }
      const d = DENIED_STATUS[decision.reason];
      return new Response(JSON.stringify({ error: d.error }), { status: d.status, headers });
    }
    const { match, unlocked } = decision.access;
    if (!unlocked) {
      return new Response(
        JSON.stringify({ error: "Unlock this candidate before requesting their details.", code: "unlock_required" }),
        { status: 402, headers },
      );
    }
    if (match.candidate_response === "declined") {
      return new Response(JSON.stringify({ error: "This candidate has declined contact for this role." }), { status: 409, headers });
    }

    const roleTitle = match.employer_requirements?.title || "this role";
    const companyName = match.employer_requirements?.employers?.company_name || "An employer";
    const text = contactRequestText(companyName, roleTitle, fields);

    await notify({
      userId: match.candidate_user_id,
      type: "employer_contact_request",
      title: text.title,
      body: text.body,
      link: "/resume",
      actionLabel: "Update resume",
      groupKey: `contact_request:${matchId}`,
    }).catch(() => {});

    await (async () => {
      const conversationId = await findOrCreateConversationId(SUPABASE_URL, serviceHeaders(), {
        matchId,
        requirementId: match.requirement_id,
        employerId: auth.userId as string,
        candidateUserId: match.candidate_user_id,
      });
      if (conversationId) {
        await postSystemMessage(SUPABASE_URL, serviceHeaders(), {
          conversationId,
          employerId: auth.userId as string,
          candidateUserId: match.candidate_user_id,
          senderId: auth.userId as string,
          body: text.systemMessage,
        });
      }
    })().catch((err) => slog.warn("employer-request-contact: system message failed", { error: (err as Error).message }));

    return new Response(JSON.stringify({ ok: true, fields }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-request-contact threw", { code: "employer_request_contact_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to send request" }), { status: 500, headers });
  }
}
