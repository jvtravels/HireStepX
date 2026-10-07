/* Vercel Edge Function — Employer <-> Candidate Messaging
 *
 * GET  /api/messages?matchId=...         -> { conversation, messages[] }
 * POST /api/messages { matchId, body, attachmentPath?, attachmentName?, attachmentMime? }
 *
 * One conversation per requirement_matches row (see conversations table in
 * supabase-schema.sql). The conversation is created lazily on first send,
 * not when the match is created, so an un-messaged match never clutters
 * either side's inbox.
 *
 * Caller role (employer vs candidate) is never taken on trust: resolved
 * server-side from the match's own employer_id/candidate_user_id against
 * the authenticated caller (see resolveRole in _messages-helpers.ts).
 *
 * Contact-info / off-platform-contact phrases are auto-flagged (see
 * detectContactInfoFlag) but never block the send — product decision: this
 * is a monitoring signal for the admin console, not a hard gate, since
 * there's no contract/engagement concept in HireStepX to gate behind.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import {
  asMessageBody,
  resolveRole,
  detectContactInfoFlag,
  MATCH_ID_RE,
  type MessageRole,
} from "./_messages-helpers";
import { notify } from "./_notify";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

interface MatchRow {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  employer_requirements: { employer_id: string; title: string } | null;
}

interface ConversationRow {
  id: string;
  match_id: string;
  requirement_id: string;
  employer_id: string;
  candidate_user_id: string;
  last_message_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: MessageRole;
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  auto_flag_reason: string | null;
  created_at: string;
}

/** Resolves the match + its owning requirement in one round trip, and
 *  determines the caller's role. Returns null (with the response already
 *  written) on any failure. */
async function resolveMatchAndRole(
  req: Request,
  headers: Record<string, string>,
  matchId: string,
  authUserId: string,
): Promise<{ match: MatchRow; role: MessageRole } | Response> {
  const matchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}` +
      `&select=id,requirement_id,candidate_user_id,employer_requirements(employer_id,title)`,
    { headers: serviceHeaders() },
  );
  const matchRows = (await matchRes.json().catch(() => [])) as MatchRow[];
  if (!matchRes.ok || !matchRows[0] || !matchRows[0].employer_requirements) {
    return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
  }
  const match = matchRows[0];
  const role = resolveRole(authUserId, match.employer_requirements!.employer_id, match.candidate_user_id);
  if (!role) {
    return new Response(JSON.stringify({ error: "Not authorized for this conversation" }), { status: 403, headers });
  }
  return { match, role };
}

async function findOrCreateConversation(match: MatchRow): Promise<ConversationRow | null> {
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?match_id=eq.${encodeURIComponent(match.id)}&select=*`,
    { headers: serviceHeaders() },
  );
  const existingRows = (await existingRes.json().catch(() => [])) as ConversationRow[];
  if (existingRes.ok && existingRows[0]) return existingRows[0];

  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: "POST",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      match_id: match.id,
      requirement_id: match.requirement_id,
      employer_id: match.employer_requirements!.employer_id,
      candidate_user_id: match.candidate_user_id,
    }),
  });
  const createdRows = (await createRes.json().catch(() => [])) as ConversationRow[];
  if (createRes.ok && createdRows[0]) return createdRows[0];

  // Lost the create race to a concurrent sender — re-read.
  const retryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?match_id=eq.${encodeURIComponent(match.id)}&select=*`,
    { headers: serviceHeaders() },
  );
  const retryRows = (await retryRes.json().catch(() => [])) as ConversationRow[];
  return retryRows[0] ?? null;
}

function toMessageShape(row: MessageRow) {
  return {
    id: row.id,
    senderRole: row.sender_role,
    body: row.body,
    attachmentPath: row.attachment_path,
    attachmentName: row.attachment_name,
    attachmentMime: row.attachment_mime,
    flagged: row.auto_flag_reason != null,
    createdAt: row.created_at,
  };
}

interface ConversationListRow extends ConversationRow {
  employer_requirements: { title: string; employers: { company_name: string } | null } | null;
  profiles: { name: string | null } | null;
}

/** Lists every conversation the caller is a party to, newest first — the
 *  inbox view for a side with no single matchId in context (candidate's
 *  /messages page). Role-agnostic: a user is never both an employer and a
 *  candidate (employers.id/profiles.id are the same uuid space as
 *  auth.users.id, 1-1), so an `or=` filter on both FK columns is safe. */
async function handleListConversations(headers: Record<string, string>, authUserId: string): Promise<Response> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?or=(employer_id.eq.${authUserId},candidate_user_id.eq.${authUserId})` +
      `&select=*,employer_requirements(title,employers(company_name)),profiles(name)` +
      `&order=last_message_at.desc.nullslast,created_at.desc`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json().catch(() => [])) as ConversationListRow[];
  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to load conversations" }), { status: 502, headers });
  }

  const conversations = rows.map((row) => {
    const role: MessageRole = row.employer_id === authUserId ? "employer" : "candidate";
    return {
      matchId: row.match_id,
      conversationId: row.id,
      role,
      counterpartName: role === "employer" ? (row.profiles?.name || "Candidate") : (row.employer_requirements?.employers?.company_name || "Employer"),
      roleTitle: row.employer_requirements?.title || "Role",
      lastMessageAt: row.last_message_at,
    };
  });

  return new Response(JSON.stringify({ conversations }), { status: 200, headers });
}

async function handleGet(req: Request, headers: Record<string, string>, auth: { userId: string }): Promise<Response> {
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId") || "";
  if (!matchId) {
    return handleListConversations(headers, auth.userId);
  }
  if (!MATCH_ID_RE.test(matchId)) {
    return new Response(JSON.stringify({ error: "Invalid matchId" }), { status: 400, headers });
  }

  const resolved = await resolveMatchAndRole(req, headers, matchId, auth.userId);
  if (resolved instanceof Response) return resolved;
  const { match } = resolved;

  const convRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?match_id=eq.${encodeURIComponent(match.id)}&select=*`,
    { headers: serviceHeaders() },
  );
  const convRows = (await convRes.json().catch(() => [])) as ConversationRow[];
  const conversation = convRows[0] ?? null;
  if (!conversation) {
    return new Response(JSON.stringify({ conversation: null, messages: [] }), { status: 200, headers });
  }

  const msgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversation_messages?conversation_id=eq.${encodeURIComponent(conversation.id)}` +
      `&select=*&order=created_at.asc&limit=200`,
    { headers: serviceHeaders() },
  );
  const msgRows = (await msgRes.json().catch(() => [])) as MessageRow[];

  return new Response(
    JSON.stringify({
      conversation: { id: conversation.id, matchId: conversation.match_id, lastMessageAt: conversation.last_message_at },
      messages: msgRows.map(toMessageShape),
    }),
    { status: 200, headers },
  );
}

async function handlePost(req: Request, headers: Record<string, string>, auth: { userId: string }): Promise<Response> {
  let body: { matchId?: unknown; body?: unknown; attachmentPath?: unknown; attachmentName?: unknown; attachmentMime?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const matchId = typeof body.matchId === "string" ? body.matchId : "";
  if (!MATCH_ID_RE.test(matchId)) {
    return new Response(JSON.stringify({ error: "Invalid matchId" }), { status: 400, headers });
  }
  const text = asMessageBody(body.body);
  const attachmentPath = typeof body.attachmentPath === "string" ? body.attachmentPath.slice(0, 500) : null;
  const attachmentName = typeof body.attachmentName === "string" ? body.attachmentName.slice(0, 255) : null;
  const attachmentMime = typeof body.attachmentMime === "string" ? body.attachmentMime.slice(0, 100) : null;
  if (!text && !attachmentPath) {
    return new Response(JSON.stringify({ error: "Message body or attachment is required" }), { status: 400, headers });
  }

  const resolved = await resolveMatchAndRole(req, headers, matchId, auth.userId);
  if (resolved instanceof Response) return resolved;
  const { match, role } = resolved;

  const conversation = await findOrCreateConversation(match);
  if (!conversation) {
    slog.error("messages POST: failed to resolve conversation", { code: "messages_conversation_create_failed", userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to start conversation" }), { status: 500, headers });
  }

  const autoFlagReason = detectContactInfoFlag(text);
  const now = new Date().toISOString();

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/conversation_messages`, {
    method: "POST",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      conversation_id: conversation.id,
      employer_id: conversation.employer_id,
      candidate_user_id: conversation.candidate_user_id,
      sender_id: auth.userId,
      sender_role: role,
      body: text,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_mime: attachmentMime,
      auto_flag_reason: autoFlagReason,
    }),
  });
  const insertedRows = (await insertRes.json().catch(() => [])) as MessageRow[];
  if (!insertRes.ok || !insertedRows[0]) {
    const t = await insertRes.text().catch(() => "");
    slog.error("messages POST insert failed", { code: "messages_insert_failed", httpStatus: insertRes.status, body: t.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to send message" }), { status: 500, headers });
  }
  const inserted = insertedRows[0];

  if (autoFlagReason) {
    void fetch(`${SUPABASE_URL}/rest/v1/message_flags`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        message_id: inserted.id,
        conversation_id: conversation.id,
        flagged_by: auth.userId,
        flagged_by_role: "system",
        reason: autoFlagReason,
      }),
    }).catch((err) => slog.warn("messages: auto-flag insert failed", { error: (err as Error).message }));
  }

  // Best-effort — never blocks the send if it fails.
  void fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversation.id)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ last_message_at: now }),
  }).catch(() => {});

  const recipientId = role === "employer" ? conversation.candidate_user_id : conversation.employer_id;
  void notify({
    userId: recipientId,
    type: "new_message",
    title: role === "employer" ? "New message from an employer" : "New message from a candidate",
    body: text ? text.slice(0, 140) : "Sent an attachment.",
    link: role === "employer" ? "/messages" : `/employer/requirements/${match.requirement_id}`,
  });

  return new Response(JSON.stringify({ conversationId: conversation.id, message: toMessageShape(inserted) }), { status: 201, headers });
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
    endpoint: "messages",
    ipLimit: 60,
    userLimit: 40,
    maxBytes: 20_000,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  try {
    if (req.method === "GET") return await handleGet(req, headers, { userId: auth.userId });
    if (req.method === "POST") return await handlePost(req, headers, { userId: auth.userId });
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("messages threw", { code: "messages_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to process message request" }), { status: 500, headers });
  }
}
