/* The single "may this employer touch this candidate match?" check.
 *
 * Every employer-facing handler that reads or writes a requirement_matches
 * row (evidence, status changes, messaging, unlock) resolves access through
 * loadEmployerMatchAccess() instead of re-implementing ownership, so a new
 * handler can't forget a rule. The decision itself (decideEmployerMatchAccess)
 * is pure and unit-tested; loadEmployerMatchAccess only fetches the rows.
 *
 * Rules, in order:
 *   1. the match must exist and belong to one of the caller's requirements
 *   2. a suspended employer is read-only (no messaging / status changes / unlock)
 *   3. a candidate who set employer_visibility = 'off' is unreachable unless the
 *      employer already paid to unlock (their snapshot stays; new contact doesn't)
 *   4. a candidate who blocked the employer is unreachable, paid or not
 */

import { isSuspended, deriveEmployerTier, type EmployerTier } from "./_employer-trust";

export interface MatchAccessRow {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  match_score: number;
  unlocked: boolean;
  candidate_status: string;
  candidate_response?: string | null;
  interview_scheduled_at?: string | null;
  employer_requirements: {
    employer_id: string;
    status: string;
    title: string;
    employers: {
      company_name: string;
      website?: string | null;
      suspended_at?: string | null;
      verification_tier?: string | null;
    } | null;
  } | null;
  profiles: { name: string | null; employer_visibility?: string | null } | null;
}

export type AccessDenied = "not_found" | "forbidden" | "suspended" | "candidate_opted_out" | "blocked";

export interface EmployerMatchAccess {
  match: MatchAccessRow;
  employerId: string;
  requirementOpen: boolean;
  unlocked: boolean;
  /** True when the candidate has since withdrawn employer visibility but the
   *  employer holds a paid unlock — evidence/messaging stay closed. */
  candidateWithdrew: boolean;
  tier: EmployerTier;
}

export type AccessDecision =
  | { ok: true; access: EmployerMatchAccess }
  | { ok: false; reason: AccessDenied };

export function decideEmployerMatchAccess(
  row: MatchAccessRow | null | undefined,
  employerId: string,
  opts: { blockedByCandidate: boolean; authEmail?: string | null; emailConfirmed?: boolean },
): AccessDecision {
  if (!row || !row.employer_requirements) return { ok: false, reason: "not_found" };
  if (row.employer_requirements.employer_id !== employerId) return { ok: false, reason: "forbidden" };
  const employer = row.employer_requirements.employers;
  if (isSuspended(employer)) return { ok: false, reason: "suspended" };
  if (opts.blockedByCandidate) return { ok: false, reason: "blocked" };
  const withdrew = row.profiles?.employer_visibility === "off";
  if (withdrew && !row.unlocked) return { ok: false, reason: "candidate_opted_out" };
  return {
    ok: true,
    access: {
      match: row,
      employerId,
      requirementOpen: row.employer_requirements.status !== "closed",
      unlocked: !!row.unlocked,
      candidateWithdrew: withdrew,
      tier: deriveEmployerTier({
        storedTier: employer?.verification_tier,
        email: opts.authEmail ?? null,
        emailConfirmed: !!opts.emailConfirmed,
        website: employer?.website ?? null,
      }),
    },
  };
}

export const DENIED_STATUS: Record<AccessDenied, { status: number; error: string }> = {
  not_found: { status: 404, error: "Candidate match not found" },
  forbidden: { status: 403, error: "Forbidden" },
  suspended: { status: 403, error: "This employer account is suspended. Contact support@hirestepx.com." },
  candidate_opted_out: { status: 404, error: "Candidate match not found" },
  blocked: { status: 404, error: "Candidate match not found" },
};

const MATCH_SELECT =
  "id,requirement_id,candidate_user_id,match_score,unlocked,candidate_status,candidate_response,interview_scheduled_at," +
  "employer_requirements(employer_id,status,title,employers(company_name,website,suspended_at,verification_tier))," +
  "profiles(name,employer_visibility)";

/** Raw match + requirement + employer + candidate-consent row, or null when absent.
 *  Throws never; returns "error" for a failed lookup so callers can 502 instead of 404. */
export async function fetchMatchAccessRow(
  supabaseUrl: string,
  headers: Record<string, string>,
  matchId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MatchAccessRow | null | "error"> {
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=${MATCH_SELECT}`,
    { headers },
  );
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as MatchAccessRow[];
  return rows[0] ?? null;
}

export async function isBlockedByCandidate(
  supabaseUrl: string,
  headers: Record<string, string>,
  candidateUserId: string,
  employerId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean | "error"> {
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_blocks?candidate_user_id=eq.${encodeURIComponent(candidateUserId)}` +
      `&employer_id=eq.${encodeURIComponent(employerId)}&select=candidate_user_id&limit=1`,
    { headers },
  );
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as unknown[];
  return rows.length > 0;
}

export async function loadEmployerMatchAccess(params: {
  supabaseUrl: string;
  headers: Record<string, string>;
  employerId: string;
  matchId: string;
  authEmail?: string | null;
  emailConfirmed?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<AccessDecision | { ok: false; reason: "error" }> {
  const f = params.fetchImpl ?? fetch;
  const row = await fetchMatchAccessRow(params.supabaseUrl, params.headers, params.matchId, f);
  if (row === "error") return { ok: false, reason: "error" };
  let blocked = false;
  if (row && row.employer_requirements?.employer_id === params.employerId) {
    const b = await isBlockedByCandidate(params.supabaseUrl, params.headers, row.candidate_user_id, params.employerId, f);
    if (b === "error") return { ok: false, reason: "error" };
    blocked = b;
  }
  return decideEmployerMatchAccess(row, params.employerId, {
    blockedByCandidate: blocked,
    authEmail: params.authEmail,
    emailConfirmed: params.emailConfirmed,
  });
}

export interface AuthIdentity {
  email: string | null;
  emailConfirmed: boolean;
}

/** The confirmed sign-in email of an auth user (service-role admin lookup) —
 *  the input deriveEmployerTier needs. Fails closed to "no identity" so a
 *  lookup error can only ever lower an employer's derived tier, never raise it. */
export async function loadAuthIdentity(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthIdentity> {
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers });
    if (!res.ok) return { email: null, emailConfirmed: false };
    const user = (await res.json().catch(() => null)) as { email?: string | null; email_confirmed_at?: string | null } | null;
    return { email: user?.email ?? null, emailConfirmed: !!user?.email_confirmed_at };
  } catch {
    return { email: null, emailConfirmed: false };
  }
}
