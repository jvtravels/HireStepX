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
  isConversationUnread,
  MATCH_ID_RE,
  isSelfConversation,
  type MessageRole,
  type MessageSenderRole,
} from "./_messages-helpers";
import { notify } from "./_notify";
import {
  fetchMatchAccessRow,
  isBlockedByCandidate,
  decideEmployerMatchAccess,
  loadAuthIdentity,
  DENIED_STATUS,
  type EmployerMatchAccess,
  type MatchAccessRow,
} from "./_entitlements";
import { maskedCandidateName } from "./_employer-trust";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

type MatchRow = MatchAccessRow;

interface ConversationRow {
  id: string;
  match_id: string;
  requirement_id: string;
  employer_id: string;
  candidate_user_id: string;
  last_message_at: string | null;
  last_sender_role: MessageSenderRole | null;
  employer_last_read_at: string | null;
  candidate_last_read_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: MessageSenderRole;
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  auto_flag_reason: string | null;
  created_at: string;
}

/** Resolves the match + its owning requirement in one round trip, determines
 *  the caller's role and, for an employer, runs the shared entitlement check
 *  (ownership, suspension, candidate opt-out, candidate block). Returns the
 *  failure Response on any denial. */
async function resolveMatchAndRole(
  headers: Record<string, string>,
  matchId: string,
  authUserId: string,
): Promise<{ match: MatchRow; role: MessageRole; access: EmployerMatchAccess | null } | Response> {
  const row = await fetchMatchAccessRow(SUPABASE_URL, serviceHeaders(), matchId);
  if (row === "error") {
    return new Response(JSON.stringify({ error: "Failed to load conversation" }), { status: 502, headers });
  }
  if (!row || !row.employer_requirements) {
    return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
  }
  const employerId = row.employer_requirements.employer_id;
  // conversations carries a CHECK (employer_id <> candidate_user_id), so a
  // match where the employer is also the candidate can never get a
  // conversation — reject it as a client error instead of a downstream 500.
  if (isSelfConversation(employerId, row.candidate_user_id)) {
    return new Response(JSON.stringify({ error: "You can't message yourself" }), { status: 400, headers });
  }
  const role = resolveRole(authUserId, employerId, row.candidate_user_id);
  if (!role) {
    return new Response(JSON.stringify({ error: "Not authorized for this conversation" }), { status: 403, headers });
  }
  if (role === "candidate") return { match: row, role, access: null };

  const blocked = await isBlockedByCandidate(SUPABASE_URL, serviceHeaders(), row.candidate_user_id, employerId);
  if (blocked === "error") {
    return new Response(JSON.stringify({ error: "Failed to load conversation" }), { status: 502, headers });
  }
  const identity = await loadAuthIdentity(SUPABASE_URL, serviceHeaders(), authUserId);
  const decision = decideEmployerMatchAccess(row, authUserId, {
    blockedByCandidate: blocked,
    authEmail: identity.email,
    emailConfirmed: identity.emailConfirmed,
  });
  if (!decision.ok) {
    const d = DENIED_STATUS[decision.reason];
    return new Response(JSON.stringify({ error: d.error }), { status: d.status, headers });
  }
  return { match: row, role, access: decision.access };
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
  const createText = await createRes.text().catch(() => "");
  let createdRows: ConversationRow[] = [];
  try { createdRows = JSON.parse(createText) as ConversationRow[]; } catch { /* PostgREST error body — logged below if the re-read also fails */ }
  if (createRes.ok && createdRows[0]) return createdRows[0];

  // Lost the create race to a concurrent sender — re-read.
  const retryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?match_id=eq.${encodeURIComponent(match.id)}&select=*`,
    { headers: serviceHeaders() },
  );
  const retryRows = (await retryRes.json().catch(() => [])) as ConversationRow[];
  if (retryRows[0]) return retryRows[0];
  // Only log once the race re-read has also come up empty, so a benign lost
  // race doesn't page as an error. Keep the PostgREST error (constraint / FK /
  // grant) — the caller's log only says "failed to resolve conversation",
  // which hid the real cause.
  slog.error("messages: conversation insert failed", {
    code: "messages_conversation_insert_failed",
    httpStatus: createRes.status,
    body: createText.slice(0, 300),
    matchId: match.id,
  });
  return null;
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
  employer_requirements: { title: string; employers: { company_name: string; suspended_at?: string | null } | null } | null;
  profiles: { name: string | null; employer_visibility?: string | null } | null;
  requirement_matches: { candidate_status: string; match_score: number; unlocked: boolean } | null;
}

/** Lists every conversation the caller is a party to, newest first — the
 *  inbox view for a side with no single matchId in context (candidate's
 *  /messages page). Role-agnostic: a user is never both an employer and a
 *  candidate (employers.id/profiles.id are the same uuid space as
 *  auth.users.id, 1-1), so an `or=` filter on both FK columns is safe. */
async function handleListConversations(headers: Record<string, string>, authUserId: string): Promise<Response> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?or=(employer_id.eq.${authUserId},candidate_user_id.eq.${authUserId})` +
      `&select=*,employer_requirements(title,employers(company_name,suspended_at)),profiles(name,employer_visibility),requirement_matches(candidate_status,match_score,unlocked)` +
      `&order=last_message_at.desc.nullslast,created_at.desc`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json().catch(() => [])) as ConversationListRow[];
  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to load conversations" }), { status: 502, headers });
  }

  // An employer must not see threads a candidate has since blocked, nor ones
  // with a candidate who withdrew visibility before the employer paid to unlock.
  let blockedCandidates = new Set<string>();
  if (rows.some((r) => r.employer_id === authUserId)) {
    const blockRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_blocks?employer_id=eq.${encodeURIComponent(authUserId)}&select=candidate_user_id`,
      { headers: serviceHeaders() },
    );
    if (blockRes.ok) {
      const blockRows = (await blockRes.json().catch(() => [])) as Array<{ candidate_user_id: string }>;
      blockedCandidates = new Set(blockRows.map((b) => b.candidate_user_id));
    }
  }
  const visible = rows.filter((row) => {
    if (row.employer_id !== authUserId) return true;
    if (blockedCandidates.has(row.candidate_user_id)) return false;
    return !(row.profiles?.employer_visibility === "off" && !row.requirement_matches?.unlocked);
  });

  const conversations = visible.map((row) => {
    const role: MessageRole = row.employer_id === authUserId ? "employer" : "candidate";
    const viewerLastReadAt = role === "employer" ? row.employer_last_read_at : row.candidate_last_read_at;
    return {
      matchId: row.match_id,
      conversationId: row.id,
      role,
      counterpartName: role === "employer"
        ? (row.requirement_matches?.unlocked ? (row.profiles?.name || "Candidate") : maskedCandidateName(row.match_id))
        : (row.employer_requirements?.employers?.company_name || "Employer"),
      // Independent of `role` on purpose: a candidate must never see a
      // person's name as the other party, even if `role` mis-resolves on a
      // malformed row (e.g. employer_id == candidate_user_id). The candidate
      // UI reads this field instead of counterpartName.
      companyName: row.employer_requirements?.employers?.company_name || "Employer",
      roleTitle: row.employer_requirements?.title || "Role",
      lastMessageAt: row.last_message_at,
      unread: isConversationUnread(role, row.last_message_at, row.last_sender_role, viewerLastReadAt),
      candidateStatus: row.requirement_matches?.candidate_status || "shortlisted",
      matchScore: row.requirement_matches?.match_score ?? null,
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

  const resolved = await resolveMatchAndRole(headers, matchId, auth.userId);
  if (resolved instanceof Response) return resolved;
  const { match, role } = resolved;

  // Pre-unlock the employer only ever knows the candidate as "Candidate #xxxxxx".
  const candidateName = role === "employer" && !match.unlocked
    ? maskedCandidateName(match.id)
    : (match.profiles?.name || "Candidate");
  const context = {
    roleTitle: match.employer_requirements?.title || "Role",
    companyName: match.employer_requirements?.employers?.company_name || "Employer",
    candidateName,
    matchScore: match.match_score ?? null,
    candidateStatus: match.candidate_status || "shortlisted",
    interviewScheduledAt: match.interview_scheduled_at ?? null,
    viewerRole: role,
  };

  const convRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?match_id=eq.${encodeURIComponent(match.id)}&select=*`,
    { headers: serviceHeaders() },
  );
  const convRows = (await convRes.json().catch(() => [])) as ConversationRow[];
  const conversation = convRows[0] ?? null;
  if (!conversation) {
    return new Response(JSON.stringify({ conversation: null, messages: [], context }), { status: 200, headers });
  }

  const msgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversation_messages?conversation_id=eq.${encodeURIComponent(conversation.id)}` +
      `&select=*&order=created_at.asc&limit=200`,
    { headers: serviceHeaders() },
  );
  const msgRows = (await msgRes.json().catch(() => [])) as MessageRow[];

  // Best-effort — never blocks the read if it fails. Opening the thread is
  // what clears the unread badge for this viewer. Logged (not silently
  // swallowed) since repeated failures here silently desyncs the unread
  // badge with zero visibility until a user reports it.
  const readColumn = role === "employer" ? "employer_last_read_at" : "candidate_last_read_at";
  void fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversation.id)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ [readColumn]: new Date().toISOString() }),
  }).catch((err) => slog.warn("messages: last-read update failed", { conversationId: conversation.id, error: (err as Error).message }));

  return new Response(
    JSON.stringify({
      conversation: { id: conversation.id, matchId: conversation.match_id, lastMessageAt: conversation.last_message_at },
      messages: msgRows.map(toMessageShape),
      context,
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

  const resolved = await resolveMatchAndRole(headers, matchId, auth.userId);
  if (resolved instanceof Response) return resolved;
  const { match, role } = resolved;

  // Attachments must live under this match's own storage prefix, otherwise a
  // caller could attach (and have the recipient sign) another thread's file.
  if (attachmentPath && !attachmentPath.startsWith(`${match.id}/`)) {
    return new Response(JSON.stringify({ error: "Invalid attachment" }), { status: 400, headers });
  }

  // An employer only gets to open a conversation after paying to unlock the
  // candidate, or once the candidate has expressed interest. Unpaid cold
  // contact is exactly the spam vector the unlock fee exists to price in.
  if (role === "employer" && !match.unlocked && match.candidate_response !== "interested") {
    return new Response(
      JSON.stringify({ error: "Unlock this candidate to message them.", code: "unlock_required" }),
      { status: 402, headers },
    );
  }

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

  // Best-effort — never blocks the send if it fails. Logged since a failure
  // here leaves the conversation's ordering/unread state stale with no
  // other signal that it happened.
  void fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversation.id)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ last_message_at: now, last_sender_role: role }),
  }).catch((err) => slog.warn("messages: last_message_at update failed", { conversationId: conversation.id, error: (err as Error).message }));

  const recipientId = role === "employer" ? conversation.candidate_user_id : conversation.employer_id;
  // Awaited: on the edge runtime an un-awaited promise can be dropped once the
  // response returns, which silently lost the recipient's notification.
  await notify({
    userId: recipientId,
    type: "new_message",
    title: role === "employer" ? "New message from an employer" : "New message from a candidate",
    body: text ? text.slice(0, 140) : "Sent an attachment.",
    link: role === "employer" ? "/messages" : `/employer/requirements/${match.requirement_id}`,
  }).catch(() => {});

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
