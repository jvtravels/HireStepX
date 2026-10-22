/* Vercel Edge Function — Employer requests to a candidate
 *
 * GET  /api/employer-candidate-requests?matchId=…   → { requests: [...] }
 * POST /api/employer-candidate-requests
 *   { matchId, kind, topic?, fields?, note? }        → creates a pending request
 *   { action: "cancel", matchId, requestId }          → withdraws a pending one
 *
 * Requests work before unlock. A locked candidate sees "Confidential company"
 * and no conversation message is created; free text cannot carry contact info,
 * so a request is never a free side channel around the unlock fee.
 * Requires migration 0040 (answers 503 until then).
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog, supabaseServiceHeaders, supabaseUrl } from "./_shared";
import { loadEmployerMatchAccess, loadAuthIdentity, DENIED_STATUS } from "./_entitlements";
import { notify } from "./_notify";
import { findOrCreateConversationId, postSystemMessage, MATCH_ID_RE } from "./_messages-helpers";
import { CONFIDENTIAL_COMPANY_NAME } from "./candidate-hiring-activity";
import {
  DAILY_REQUEST_CAP,
  isMissingTableResponse,
  isUniqueViolation,
  parseCreateRequest,
  requestNotificationText,
  toRequestDto,
  type CandidateRequestRow,
} from "./_candidate-request-helpers";

const COLUMNS = "id,match_id,kind,topic,fields,note,status,response_note,created_at,resolved_at";

function json(headers: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export default async function handler(req: Request): Promise<Response> {
  const base = supabaseUrl();
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowGet: true }) });
  }
  if (!base) {
    return json(withRequestId(corsHeaders(req, { allowGet: true })), 503, { error: "Server misconfigured" });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-candidate-requests",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 3_000,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };
  if (!auth.userId) return json(headers, 401, { error: "Unauthorized" });
  const employerId = auth.userId;
  const service = supabaseServiceHeaders();

  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return json(headers, 400, { error: "Invalid JSON body" });
      }
    } else if (req.method !== "GET") {
      return json(headers, 405, { error: "Method not allowed" });
    }

    const matchId = String((req.method === "GET" ? url.searchParams.get("matchId") : body.matchId) ?? "");
    if (!MATCH_ID_RE.test(matchId)) return json(headers, 400, { error: "matchId is required" });

    const identity = await loadAuthIdentity(base, service, employerId);
    const decision = await loadEmployerMatchAccess({
      supabaseUrl: base,
      headers: service,
      employerId,
      matchId,
      authEmail: identity.email,
      emailConfirmed: identity.emailConfirmed,
    });
    if (!decision.ok) {
      if (decision.reason === "error") return json(headers, 502, { error: "Failed to load requests" });
      const d = DENIED_STATUS[decision.reason];
      return json(headers, d.status, { error: d.error });
    }
    const { match, unlocked, requirementOpen, candidateWithdrew } = decision.access;

    if (req.method === "GET") {
      const res = await fetch(
        `${base}/rest/v1/candidate_requests?match_id=eq.${encodeURIComponent(matchId)}&employer_id=eq.${encodeURIComponent(employerId)}&select=${COLUMNS}&order=created_at.desc&limit=100`,
        { headers: service, signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (isMissingTableResponse(res.status, text)) return json(headers, 200, { requests: [], available: false });
        return json(headers, 502, { error: "Failed to load requests" });
      }
      const rows = (await res.json().catch(() => [])) as CandidateRequestRow[];
      return json(headers, 200, { requests: rows.map(toRequestDto), available: true });
    }

    if (body.action === "cancel") {
      const requestId = String(body.requestId ?? "");
      if (!MATCH_ID_RE.test(requestId)) return json(headers, 400, { error: "requestId is required" });
      const res = await fetch(
        `${base}/rest/v1/candidate_requests?id=eq.${encodeURIComponent(requestId)}&match_id=eq.${encodeURIComponent(matchId)}&employer_id=eq.${encodeURIComponent(employerId)}&status=eq.pending`,
        {
          method: "PATCH",
          headers: { ...service, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ status: "cancelled", resolved_at: new Date().toISOString() }),
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!res.ok) return json(headers, 502, { error: "Failed to cancel request" });
      const rows = (await res.json().catch(() => [])) as CandidateRequestRow[];
      if (!rows[0]) return json(headers, 409, { error: "This request is no longer pending." });
      return json(headers, 200, { ok: true, request: toRequestDto(rows[0]) });
    }

    const parsed = parseCreateRequest(body);
    if (!parsed.ok) return json(headers, 400, { error: parsed.error });
    if (!requirementOpen) return json(headers, 409, { error: "This role is closed, so new requests are unavailable." });
    if (candidateWithdrew) return json(headers, 409, { error: "This candidate is no longer accepting requests." });
    if (match.candidate_response === "declined") {
      return json(headers, 409, { error: "This candidate has declined contact for this role." });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const capRes = await fetch(
      `${base}/rest/v1/candidate_requests?employer_id=eq.${encodeURIComponent(employerId)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${DAILY_REQUEST_CAP}`,
      { headers: service, signal: AbortSignal.timeout(6000) },
    );
    if (!capRes.ok) {
      const text = await capRes.text().catch(() => "");
      if (isMissingTableResponse(capRes.status, text)) return json(headers, 503, { error: "Requests are not available yet." });
      return json(headers, 502, { error: "Failed to send request" });
    }
    const recent = (await capRes.json().catch(() => [])) as unknown[];
    if (recent.length >= DAILY_REQUEST_CAP) {
      return json(headers, 429, { error: `You can send up to ${DAILY_REQUEST_CAP} requests a day. Try again tomorrow.` });
    }

    const input = parsed.value;
    const insert = await fetch(`${base}/rest/v1/candidate_requests`, {
      method: "POST",
      headers: { ...service, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        match_id: matchId,
        requirement_id: match.requirement_id,
        employer_id: employerId,
        candidate_user_id: match.candidate_user_id,
        kind: input.kind,
        topic: input.topic,
        fields: input.fields,
        note: input.note,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!insert.ok) {
      const text = await insert.text().catch(() => "");
      if (isUniqueViolation(insert.status, text)) {
        return json(headers, 409, { error: "You already have a pending request for this. Wait for the candidate to respond." });
      }
      if (isMissingTableResponse(insert.status, text)) return json(headers, 503, { error: "Requests are not available yet." });
      slog.error("employer-candidate-requests insert failed", { code: "candidate_request_insert_failed", status: insert.status, matchId });
      return json(headers, 502, { error: "Failed to send request" });
    }
    const created = ((await insert.json().catch(() => [])) as CandidateRequestRow[])[0];
    if (!created) return json(headers, 502, { error: "Failed to send request" });

    const roleTitle = match.employer_requirements?.title || "this role";
    const companyName = unlocked ? match.employer_requirements?.employers?.company_name || "An employer" : CONFIDENTIAL_COMPANY_NAME;
    const text = requestNotificationText(companyName, roleTitle, input);

    await notify({
      userId: match.candidate_user_id,
      type: "candidate_request",
      title: text.title,
      body: text.body,
      link: `/jobs/${matchId}`,
      actionLabel: input.kind === "contact" ? "Share details" : "View request",
      groupKey: `candidate_request:${matchId}`,
    }).catch(() => {});

    if (unlocked) {
      await (async () => {
        const conversationId = await findOrCreateConversationId(base, service, {
          matchId,
          requirementId: match.requirement_id,
          employerId,
          candidateUserId: match.candidate_user_id,
        });
        if (conversationId) {
          await postSystemMessage(base, service, {
            conversationId,
            employerId,
            candidateUserId: match.candidate_user_id,
            senderId: employerId,
            body: text.systemMessage,
          });
        }
      })().catch((err) => slog.warn("employer-candidate-requests: system message failed", { error: (err as Error).message }));
    }

    return json(headers, 200, { ok: true, request: toRequestDto(created) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-candidate-requests threw", { code: "candidate_request_unexpected_error", error: msg.slice(0, 200), userId: employerId });
    return json(headers, 500, { error: "Failed to send request" });
  }
}
