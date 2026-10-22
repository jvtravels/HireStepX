/* When a graded session lands, an employer's pending "practise a round" request
   for that round, on a role the session fits, is answered by the session itself:
   the employer sees the result on the evidence tab, the candidate has nothing
   more to do. Pure selection here; the write lives in fulfilPracticeRequests. */

import { roundKeyForTopic, roundOf, type RoundKey } from "../src/focusRounds";
import { roleMatches } from "./_employer-candidate-evidence-helpers";
import { slog, supabaseServiceHeaders, supabaseUrl } from "./_shared";
import { notify } from "./_notify";
import { maskedCandidateName } from "./_employer-trust";
import { candidateDetailLink } from "./_candidate-consent-helpers";
import { resolutionNotificationText } from "./_candidate-request-helpers";

export interface PendingPracticeRequest {
  id: string;
  match_id: string;
  topic: string | null;
  created_at: string;
}

export interface GradedSession {
  type: string | null;
  focus: string | null;
  target_role: string | null;
  score: number | null;
  created_at: string;
}

export function requestsAnsweredBySession(
  requests: readonly PendingPracticeRequest[],
  session: GradedSession,
  roleTitleByMatch: ReadonlyMap<string, string | null>,
): PendingPracticeRequest[] {
  if (typeof session.score !== "number" || !(session.score > 0)) return [];
  const round: RoundKey | null = roundOf(session);
  if (!round) return [];
  const at = new Date(session.created_at).getTime();
  return requests.filter((r) => {
    if (roundKeyForTopic(r.topic) !== round) return false;
    // A session older than the request cannot be the answer to it.
    if (new Date(r.created_at).getTime() > at) return false;
    return roleMatches(session.target_role, roleTitleByMatch.get(r.match_id) ?? null) !== "no";
  });
}

/** Best-effort: never throws, because the report is already saved and a failed
 *  fulfilment only means the candidate can still answer the request by hand. */
export async function fulfilPracticeRequests(userId: string, sessionId: string, f: typeof fetch = fetch): Promise<number> {
  try {
    const base = supabaseUrl();
    const headers = supabaseServiceHeaders();
    if (!base || !headers.apikey) return 0;
    const get = async <T>(path: string): Promise<T[]> => {
      const res = await f(`${base}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(5000) });
      return res.ok ? ((await res.json().catch(() => [])) as T[]) : [];
    };
    const [session] = await get<GradedSession>(
      `sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&select=type,focus,target_role,score,created_at&limit=1`,
    );
    if (!session || !roundOf(session)) return 0;
    const pending = await get<PendingPracticeRequest>(
      `candidate_requests?candidate_user_id=eq.${encodeURIComponent(userId)}&kind=eq.practice&status=eq.pending&select=id,match_id,topic,created_at&limit=50`,
    );
    if (pending.length === 0) return 0;
    const matchIds = [...new Set(pending.map((r) => r.match_id))];
    const matches = await get<{ id: string; requirement_id: string; employer_requirements: { employer_id: string; title: string | null } | null }>(
      `requirement_matches?id=in.(${matchIds.map(encodeURIComponent).join(",")})&candidate_user_id=eq.${encodeURIComponent(userId)}&select=id,requirement_id,employer_requirements(employer_id,title)`,
    );
    const byMatch = new Map(matches.map((m) => [m.id, m]));
    const titles = new Map(matches.map((m) => [m.id, m.employer_requirements?.title ?? null]));
    const answered = requestsAnsweredBySession(pending.filter((r) => byMatch.has(r.match_id)), session, titles);
    let done = 0;
    for (const r of answered) {
      const res = await f(
        `${base}/rest/v1/candidate_requests?id=eq.${encodeURIComponent(r.id)}&candidate_user_id=eq.${encodeURIComponent(userId)}&status=eq.pending`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ status: "fulfilled", response_note: "Completed the practice session. See the practice tab.", resolved_at: new Date().toISOString() }),
          signal: AbortSignal.timeout(5000),
        },
      ).catch(() => null);
      const updated = res && res.ok ? ((await res.json().catch(() => [])) as unknown[]) : [];
      if (updated.length === 0) continue;
      done += 1;
      const m = byMatch.get(r.match_id)!;
      const text = resolutionNotificationText("fulfilled", { kind: "practice", topic: r.topic, fields: null }, maskedCandidateName(m.id));
      await notify({
        userId: m.employer_requirements!.employer_id,
        type: "candidate_request_resolved",
        title: text.title,
        body: text.body,
        link: candidateDetailLink(m.requirement_id, m.id),
        groupKey: `candidate_request_resolved:${m.id}`,
      });
    }
    return done;
  } catch (err) {
    slog.warn("practice request fulfilment failed", { error: err instanceof Error ? err.message.slice(0, 200) : String(err) });
    return 0;
  }
}
