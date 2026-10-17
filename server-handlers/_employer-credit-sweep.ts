/* Daily sweep that credits back paid candidates the employer can no longer reach.
 *
 * Candidate-initiated causes (declined, blocked, withdrew) are credited inline
 * by their handlers; this sweep is the backstop for a declined response whose
 * inline credit failed, and the only path for the passive cause: an interview
 * invite nobody answered for NO_RESPONSE_DAYS. A candidate who has sent any
 * message on the conversation counts as reachable and is skipped. */

import { creditRefundForMatches, NO_RESPONSE_DAYS } from "./_employer-credit";
import type { NotifyInput } from "./_notify";

export interface SweepParams {
  base: string;
  headers: Record<string, string>;
  fetchImpl?: typeof fetch;
  notifyImpl?: (input: NotifyInput) => Promise<void>;
  now?: () => Date;
}

export interface SweepSummary {
  declinedScanned: number;
  noResponseScanned: number;
  skippedReachable: number;
  creditedMatches: number;
  creditedPaise: number;
}

const PAGE = 300;

async function ids(f: typeof fetch, url: string, headers: Record<string, string>): Promise<string[]> {
  const res = await f(url, { headers });
  if (!res.ok) throw new Error(`sweep query failed (${res.status})`);
  const rows = (await res.json().catch(() => null)) as Array<{ id: string }> | null;
  if (!Array.isArray(rows)) throw new Error("sweep query returned a non-array body");
  return rows.map((r) => r.id);
}

/** Matches whose candidate has replied on the conversation at least once. */
async function matchesWithCandidateReply(f: typeof fetch, base: string, headers: Record<string, string>, matchIds: string[]): Promise<Set<string>> {
  const replied = new Set<string>();
  if (matchIds.length === 0) return replied;
  const convRes = await f(`${base}/rest/v1/conversations?match_id=in.(${matchIds.join(",")})&select=id,match_id`, { headers });
  if (!convRes.ok) throw new Error(`conversation lookup failed (${convRes.status})`);
  const convs = (await convRes.json().catch(() => [])) as Array<{ id: string; match_id: string }>;
  if (convs.length === 0) return replied;
  const msgRes = await f(
    `${base}/rest/v1/conversation_messages?conversation_id=in.(${convs.map((c) => c.id).join(",")})&sender_role=eq.candidate&select=conversation_id&limit=1000`,
    { headers },
  );
  if (!msgRes.ok) throw new Error(`message lookup failed (${msgRes.status})`);
  const msgs = (await msgRes.json().catch(() => [])) as Array<{ conversation_id: string }>;
  const convToMatch = new Map(convs.map((c) => [c.id, c.match_id]));
  for (const m of msgs) {
    const matchId = convToMatch.get(m.conversation_id);
    if (matchId) replied.add(matchId);
  }
  return replied;
}

export async function sweepUnreachableCredits(p: SweepParams): Promise<SweepSummary> {
  const f = p.fetchImpl ?? fetch;
  const now = (p.now ?? (() => new Date()))();
  const summary: SweepSummary = { declinedScanned: 0, noResponseScanned: 0, skippedReachable: 0, creditedMatches: 0, creditedPaise: 0 };
  const credit = async (matchIds: string[], reason: "declined" | "no_response") => {
    const r = await creditRefundForMatches({ base: p.base, headers: p.headers, matchIds, reason, fetchImpl: f, notifyImpl: p.notifyImpl });
    summary.creditedMatches += r.credited.length;
    summary.creditedPaise += r.credited.reduce((s, c) => s + c.amountPaise, 0);
  };

  const declined = await ids(
    f,
    `${p.base}/rest/v1/requirement_matches?unlocked=eq.true&candidate_response=eq.declined&candidate_status=in.(shortlisted,interview_invited)&select=id&limit=${PAGE}`,
    p.headers,
  );
  summary.declinedScanned = declined.length;
  if (declined.length > 0) await credit(declined, "declined");

  const cutoff = new Date(now.getTime() - NO_RESPONSE_DAYS * 86_400_000).toISOString();
  const silent = await ids(
    f,
    `${p.base}/rest/v1/requirement_matches?unlocked=eq.true&candidate_status=eq.interview_invited&candidate_response=eq.none` +
      `&candidate_status_updated_at=lt.${encodeURIComponent(cutoff)}&select=id&order=candidate_status_updated_at.asc&limit=${PAGE}`,
    p.headers,
  );
  summary.noResponseScanned = silent.length;
  const replied = await matchesWithCandidateReply(f, p.base, p.headers, silent);
  const unreachable = silent.filter((id) => !replied.has(id));
  summary.skippedReachable = silent.length - unreachable.length;
  if (unreachable.length > 0) await credit(unreachable, "no_response");

  return summary;
}
