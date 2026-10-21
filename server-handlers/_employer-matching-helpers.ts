/* Pure + fetch-injectable helpers for the employer matching pipeline
 * (runMatching in employer-requirements.ts, the nightly cron, and the
 * requirement detail/list handlers). Everything that decides WHO may be
 * matched, HOW MUCH work a run may do, and WHAT an employer may see before a
 * paid unlock lives here so it is unit-tested directly
 * (src/__tests__/employerMatchingHelpers.test.ts) instead of through the
 * handlers' sequential fetch mocks.
 *
 * Trust model: employer-visible matching only counts SERVER-GRADED sessions
 * (sessions.report_generated_at is not null). `score` on such a row is
 * reconciled server-side by /api/evaluate-session; rows without a report are
 * client-relayed and never feed an employer-facing number.
 */

import {
  scoreCandidateMatch,
  hasMatchSignal,
  type CandidatePoolRow,
  type RequirementInput,
} from "./_requirement-match-helpers";
import { extractResumeDetail, type ResumeDetail } from "./_resume-detail-helpers";
import {
  extractReadinessBand,
  extractStarCompleteness,
  latestSessionByUser,
  roleMatches,
  type SessionRow,
} from "./_employer-candidate-evidence-helpers";
import { daysSinceLastActive } from "./_employer-requirements-helpers";
import { TIER_LIMITS, deriveEmployerTier, isSuspended, maskedCandidateName, type EmployerTier } from "./_employer-trust";
import { loadAuthIdentity } from "./_entitlements";
import { batchUnlockPrice, UNLOCK_BUNDLE_SIZE } from "./_unlock-pricing";
import { slog } from "./_shared";

type FetchImpl = typeof fetch;
type Headers = Record<string, string>;

/* ── Bounds ── */

/** PostgREST `in.(...)` batch size — keeps URLs well under proxy limits. */
export const MAX_IN_BATCH = 100;
/** Supabase's default max-rows is 1000; a bigger `limit` is silently capped,
 *  so every page we request stays at or below it. */
export const POOL_PAGE_SIZE = 500;
/** Upper bound on profiles examined per matching run. A run over a pool this
 *  large is already minutes of work across a cron sweep. */
export const MAX_POOL_SCAN = 10_000;
/** Sessions batches are smaller than MAX_IN_BATCH so one prolific candidate
 *  can't crowd the rest of the batch out of a 1000-row page. */
export const SESSION_BATCH = 50;
export const SESSION_PAGE_LIMIT = 1000;
/** Strong-match alert is one notification + one email per run; this caps how
 *  many matches a single alert reports (and the count it can claim). */
export const MAX_NEW_STRONG_ALERTS = 5;
/** Time a matching run keeps back for LLM rerank + writes after the scan. */
export const SCAN_RESERVE_MS = 4_000;
export const REMATCH_WINDOW_MS = 60 * 60 * 1000;
/** Fewer ms than this left in a run and the model call is skipped: it would
 *  only run the request into its timeout, and the deterministic result (which
 *  is always persisted) is a better outcome than a failed run. */
export const LLM_MIN_REMAINING_MS = 5_000;
/** Kept back after the model call for the upsert + status writes. */
export const LLM_WRITE_RESERVE_MS = 2_000;
export const LLM_MAX_BUDGET_MS = 12_000;
/** How long a stored model score may stand in for a missing one. */
export const LLM_SCORE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Most database reads one request keeps in flight at once. */
export const READ_CONCURRENCY = 6;

/** Maps `items` through `fn` with at most `limit` in flight; results keep the
 *  input order, so callers merge batches exactly as a sequential loop would. */
export async function mapConcurrent<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>, limit = READ_CONCURRENCY): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function inList(ids: string[]): string {
  return ids.map((id) => encodeURIComponent(id)).join(",");
}

/* ── Match-row bookkeeping ── */

export interface ExistingMatchRow {
  id: string;
  candidate_user_id: string;
  match_score: number;
  unlocked: boolean;
  candidate_status: string | null;
  candidate_status_note: string | null;
  interview_scheduled_at: string | null;
  /** Candidate's reply to the employer ("interested" / "declined"); absent on rows read before it was selected. */
  candidate_response?: string | null;
  missed_passes?: number | null;
  strong_alerted_at?: string | null;
  /** Raw (un-blended) model score from the last pass that had one. Absent
   *  when the column is not migrated yet (0048). */
  llm_score?: number | null;
  llm_scored_at?: string | null;
  /** What the stored model score was computed against (0050): the requirement
   *  fields the prompt reads, and the candidate profile content it saw. */
  llm_criteria_fingerprint?: string | null;
  llm_profile_stamp?: string | null;
}

/** Consecutive passes a locked match may miss the fresh ranking before it is removed. */
export const MISSED_PASSES_BEFORE_REMOVAL = 3;

/** A row the employer has acted on — paid to unlock, moved off the default
 *  "shortlisted" stage, left a note, or scheduled an interview — keeps its id
 *  and pipeline state through a re-match and is never re-scored. */
export function isTouchedMatch(m: Pick<ExistingMatchRow, "unlocked" | "candidate_status" | "candidate_status_note" | "interview_scheduled_at" | "candidate_response">): boolean {
  return !!m.unlocked || (!!m.candidate_response && m.candidate_response !== "none") || (!!m.candidate_status && m.candidate_status !== "shortlisted") || !!m.candidate_status_note || !!m.interview_scheduled_at;
}

/** PostgREST predicates mirroring !isTouchedMatch, appended to a DELETE so a
 *  row an employer touched after it was read is not removed. Keep in step with
 *  isTouchedMatch. */
export function untouchedMatchFilter(): string {
  return "&candidate_status_note=is.null&interview_scheduled_at=is.null" +
    "&and=(or(candidate_response.is.null,candidate_response.eq.none),or(candidate_status.is.null,candidate_status.eq.shortlisted))";
}

export interface ExistingMatchPlan {
  /** Locked rows whose candidate opted out / blocked the employer / has no
   *  profile any more. Deleted regardless of pipeline state — but NEVER an
   *  unlocked row: that is a paid-for snapshot. */
  removeIneligibleIds: string[];
  /** Touched rows that stay (not re-scored). */
  preserved: ExistingMatchRow[];
  /** Untouched rows eligible for re-scoring / stale cleanup. */
  untouched: ExistingMatchRow[];
}

export function planExistingMatches(existing: ExistingMatchRow[], ineligibleCandidateIds: Set<string>): ExistingMatchPlan {
  const removeIneligibleIds: string[] = [];
  const preserved: ExistingMatchRow[] = [];
  const untouched: ExistingMatchRow[] = [];
  for (const m of existing) {
    if (!m.unlocked && ineligibleCandidateIds.has(m.candidate_user_id)) {
      removeIneligibleIds.push(m.id);
    } else if (isTouchedMatch(m)) {
      preserved.push(m);
    } else {
      untouched.push(m);
    }
  }
  return { removeIneligibleIds, preserved, untouched };
}

/** Untouched, locked rows whose candidate did not make the fresh ranking.
 *  Only safe after a COMPLETE pool scan: a truncated scan can't tell "no
 *  longer matches" from "never looked at", so it removes nothing. */
export function planStaleRemovals(untouched: ExistingMatchRow[], rankedCandidateIds: Set<string>, scanComplete: boolean): { removeIds: string[]; missIds: Array<{ id: string; missed: number }> } {
  const removeIds: string[] = [];
  const missIds: Array<{ id: string; missed: number }> = [];
  if (!scanComplete) return { removeIds, missIds };
  for (const m of untouched) {
    if (m.unlocked || isTouchedMatch(m) || rankedCandidateIds.has(m.candidate_user_id)) continue;
    const missed = (m.missed_passes ?? 0) + 1;
    if (missed >= MISSED_PASSES_BEFORE_REMOVAL) removeIds.push(m.id);
    else missIds.push({ id: m.id, missed });
  }
  return { removeIds, missIds };
}

/* ── Pool selection ── */

export interface PoolProfile {
  id: string;
  name: string;
  target_role: string | null;
  industry: string | null;
  resume_data: unknown;
  practice_timestamps: string[] | null;
  employer_visibility?: string | null;
  deleted_at?: string | null;
}

export function isEligiblePoolProfile(
  p: PoolProfile,
  ctx: { ownerUserId: string; blockedCandidateIds: Set<string>; excludedCandidateIds: Set<string> },
): boolean {
  if (p.id === ctx.ownerUserId) return false;
  if (p.employer_visibility === "off") return false;
  if (p.deleted_at) return false;
  if (ctx.blockedCandidateIds.has(p.id)) return false;
  if (ctx.excludedCandidateIds.has(p.id)) return false;
  return hasMatchSignal(p);
}

/** Cheap pre-check before any session read: does this profile clear the
 *  role/skill relevance floor at all? hasRelevance depends only on the
 *  resume/target_role vs the requirement, never on sessions, so candidates
 *  failing here can't reach the shortlist whatever their sessions say. */
export function isRelevantProfile(p: PoolProfile, req: RequirementInput): boolean {
  const probe: CandidatePoolRow = {
    id: p.id, name: p.name, target_role: p.target_role, industry: p.industry, resume_data: p.resume_data,
    avg_score: null, sessions_completed: 0, last_active_days_ago: 999,
  };
  return scoreCandidateMatch(probe, req).hasRelevance;
}

export interface GradedSessionRow extends SessionRow {
  score: number;
  report_generated_at?: string | null;
}

/** Practice for a different role is not evidence for this requirement, so it
 *  must not lift (or sink) the shortlist score. Sessions with no usable role
 *  text are kept rather than discarded on a guess. */
export function keepSessionsForRole<T extends { target_role?: string | null }>(rows: T[], requirementTitle: string | null | undefined): T[] {
  return rows.filter((r) => roleMatches(r.target_role, requirementTitle) !== "no");
}

/** Only sessions the server graded count toward employer-visible numbers. */
export function keepGradedSessions<T extends { report_generated_at?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !!r.report_generated_at);
}

export interface TrustedSessionStats {
  avgScore: Map<string, number>;
  sessionCount: Map<string, number>;
  readinessBand: Map<string, "strongHire" | "hire" | "leanHire">;
  starPct: Map<string, number>;
}

export function computeTrustedSessionStats(rows: GradedSessionRow[]): TrustedSessionStats {
  const graded = keepGradedSessions(rows);
  const sums = new Map<string, number>();
  const sessionCount = new Map<string, number>();
  for (const s of graded) {
    const score = typeof s.score === "number" && Number.isFinite(s.score) ? Math.min(100, Math.max(0, s.score)) : 0;
    sums.set(s.user_id, (sums.get(s.user_id) || 0) + score);
    sessionCount.set(s.user_id, (sessionCount.get(s.user_id) || 0) + 1);
  }
  const avgScore = new Map<string, number>();
  for (const [uid, sum] of sums) avgScore.set(uid, sum / (sessionCount.get(uid) || 1));

  const readinessBand = new Map<string, "strongHire" | "hire" | "leanHire">();
  const starPct = new Map<string, number>();
  // Quality-bar evidence uses the same "latest real interview session" picker
  // the employer evidence panel uses; rows without report_json (not fetched
  // unless the requirement sets a bar) simply contribute nothing.
  for (const [uid, row] of latestSessionByUser(graded)) {
    const readiness = extractReadinessBand(row.report_json);
    if (readiness) readinessBand.set(uid, readiness.band);
    const star = extractStarCompleteness(row.report_json);
    if (star) starPct.set(uid, star.pct);
  }
  return { avgScore, sessionCount, readinessBand, starPct };
}

export function buildCandidatePoolRow(p: PoolProfile, stats: TrustedSessionStats, nowMs: number): CandidatePoolRow {
  const timestamps = Array.isArray(p.practice_timestamps) ? p.practice_timestamps : [];
  return {
    id: p.id,
    name: p.name,
    target_role: p.target_role,
    industry: p.industry,
    resume_data: p.resume_data,
    avg_score: stats.avgScore.get(p.id) ?? null,
    sessions_completed: stats.sessionCount.get(p.id) || 0,
    last_active_days_ago: daysSinceLastActive(timestamps, nowMs),
    years_experience: extractResumeDetail(p.resume_data).yearsExperience,
    readiness_band: stats.readinessBand.get(p.id) ?? null,
    star_completeness_pct: stats.starPct.get(p.id) ?? null,
  };
}

/* ── Bounded reads ── */

export interface KeysetResult<T> {
  /** Every row read — EMPTY when `onPage` is supplied (the caller streams
   *  pages instead of holding the whole table in memory). */
  rows: T[];
  /** True when the scan stopped at maxRows / the deadline / a failed page
   *  instead of reaching the end of the table. */
  truncated: boolean;
  failed: boolean;
  /** Rows examined across all pages. */
  seen: number;
}

/** Keyset-paginates `baseUrl` (which must already carry its select + filters)
 *  by `keyField` ascending. Never offset-paginates, so cost per page stays
 *  flat however deep the scan goes. */
export async function fetchKeyset<T extends Record<string, unknown>>(params: {
  baseUrl: string;
  headers: Headers;
  keyField: string;
  pageSize?: number;
  maxRows?: number;
  deadlineMs?: number;
  fetchImpl?: FetchImpl;
  onPage?: (rows: T[]) => void;
}): Promise<KeysetResult<T>> {
  const f = params.fetchImpl ?? fetch;
  const pageSize = Math.min(params.pageSize ?? POOL_PAGE_SIZE, 1000);
  const maxRows = params.maxRows ?? MAX_POOL_SCAN;
  const rows: T[] = [];
  let seen = 0;
  let cursor: string | null = null;
  const done = (truncated: boolean, failed = false): KeysetResult<T> => ({ rows, truncated, failed, seen });
  for (;;) {
    if (params.deadlineMs !== undefined && Date.now() >= params.deadlineMs) return done(true);
    const remaining = maxRows - seen;
    if (remaining <= 0) return done(true);
    const take = Math.min(pageSize, remaining);
    const url: string = `${params.baseUrl}&order=${params.keyField}.asc&limit=${take}` +
      (cursor !== null ? `&${params.keyField}=gt.${encodeURIComponent(cursor)}` : "");
    let page: T[];
    try {
      const res: Response = await f(url, { headers: params.headers });
      if (!res.ok) return done(true, true);
      page = (await res.json().catch(() => [])) as T[];
    } catch {
      return done(true, true);
    }
    if (!Array.isArray(page) || page.length === 0) return done(false);
    seen += page.length;
    if (params.onPage) params.onPage(page);
    else rows.push(...page);
    if (page.length < take) return done(false);
    const last = page[page.length - 1][params.keyField];
    if (typeof last !== "string") return done(true, true);
    cursor = last;
  }
}

export type ContactWithheldReason = "withdrew" | "declined";

/** Whether an unlocked match's contact details may still leave the server.
 *  Paying for an unlock buys a snapshot of the resume, not a standing right to
 *  reach someone who has since pulled employer visibility or declined contact.
 *  (A candidate who blocked the employer never reaches this point: the ranked
 *  list drops them entirely.) */
export function contactWithheldReason(m: {
  unlocked: boolean;
  candidateWithdrew: boolean;
  candidateResponse: string | null;
}): ContactWithheldReason | null {
  if (!m.unlocked) return null;
  if (m.candidateWithdrew) return "withdrew";
  if (m.candidateResponse === "declined") return "declined";
  return null;
}

/** uuid-shaped keyset start point that changes every day and per requirement.
 *  A fixed id-ascending scan with a MAX_POOL_SCAN cap means that once the pool
 *  outgrows the cap, the same highest-id profiles are never evaluated for any
 *  requirement. Rotating where the scan starts spreads that blind spot across
 *  the pool over successive runs. */
export function rotatedScanStart(seed: string, now: Date = new Date()): string {
  const input = `${seed}:${now.toISOString().slice(0, 10)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`;
}

/** fetchKeyset starting after `startKey` and wrapping round to the keys at or
 *  before it, sharing one row cap and deadline across both legs. */
export async function fetchKeysetRotated<T extends Record<string, unknown>>(
  params: Parameters<typeof fetchKeyset<T>>[0] & { startKey: string },
): Promise<KeysetResult<T>> {
  const { startKey, ...rest } = params;
  const maxRows = rest.maxRows ?? MAX_POOL_SCAN;
  const k = encodeURIComponent(startKey);
  const first = await fetchKeyset<T>({ ...rest, maxRows, baseUrl: `${rest.baseUrl}&${rest.keyField}=gt.${k}` });
  if (first.truncated) return first;
  const second = await fetchKeyset<T>({ ...rest, maxRows: maxRows - first.seen, baseUrl: `${rest.baseUrl}&${rest.keyField}=lte.${k}` });
  return {
    rows: [...first.rows, ...second.rows],
    truncated: second.truncated,
    failed: second.failed,
    seen: first.seen + second.seen,
  };
}

/** Candidate ids that blocked this employer. A candidate-scoped table, so it
 *  is bounded by how many people actually blocked them. Returns null on a
 *  failed read so callers fail closed instead of matching blocked people. */
export async function loadBlockedCandidateIds(
  supabaseUrl: string,
  headers: Headers,
  employerId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<Set<string> | null> {
  const r = await fetchKeyset<{ candidate_user_id: string }>({
    baseUrl: `${supabaseUrl}/rest/v1/employer_blocks?employer_id=eq.${encodeURIComponent(employerId)}&select=candidate_user_id`,
    headers, keyField: "candidate_user_id", pageSize: 1000, maxRows: 20_000, fetchImpl,
  });
  if (r.failed) return null;
  return new Set(r.rows.map((x) => x.candidate_user_id));
}

/** Candidates (from `ids`) who should no longer be reachable at all: opted
 *  out of employer visibility, scheduled for deletion, or whose profile is gone. Blocks are handled
 *  separately. Null on a failed read (fail closed). */
export async function loadOptedOutCandidateIds(
  supabaseUrl: string,
  headers: Headers,
  ids: string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Set<string> | null> {
  const present = new Set<string>();
  const off = new Set<string>();
  const pages = await mapConcurrent(chunk(ids, MAX_IN_BATCH), async (batch) => {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/profiles?id=in.(${inList(batch)})&select=id,employer_visibility,deleted_at`, { headers });
    if (!res.ok) return null;
    return (await res.json().catch(() => [])) as Array<{ id: string; employer_visibility?: string | null; deleted_at?: string | null }>;
  });
  for (const rows of pages) {
    if (rows === null) return null;
    for (const r of rows) {
      present.add(r.id);
      // A soft-deleted account is in its grace window and must read as gone,
      // whatever its visibility setting was.
      if (r.employer_visibility === "off" || r.deleted_at) off.add(r.id);
    }
  }
  for (const id of ids) if (!present.has(id)) off.add(id);
  return off;
}

/** How long a "hired" outcome on one job keeps a candidate out of other
 *  employers' fresh match lists. Conservative on purpose: long enough to cover a
 *  notice period and joining date, short enough that someone hired a year ago
 *  (and possibly looking again) is not hidden for good. */
export const HIRED_ELSEWHERE_WINDOW_DAYS = 90;

/** Of `ids`, who was marked hired against a DIFFERENT requirement within
 *  HIRED_ELSEWHERE_WINDOW_DAYS. Only the candidate ids come back: which employer
 *  or job hired them is never read into the result. Scoped to the
 *  post-prefilter candidates so the read stays small (uses the
 *  requirement_matches(candidate_user_id, candidate_status) index). A row with
 *  no status timestamp (written before the column existed) still counts. */
export async function loadHiredElsewhere(
  supabaseUrl: string,
  headers: Headers,
  requirementId: string,
  ids: string[],
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<Set<string>> {
  const out = new Set<string>();
  const cutoff = encodeURIComponent(new Date(nowMs - HIRED_ELSEWHERE_WINDOW_DAYS * 86_400_000).toISOString());
  for (const batch of chunk(ids, MAX_IN_BATCH)) {
    try {
      const res = await fetchImpl(
        `${supabaseUrl}/rest/v1/requirement_matches?candidate_status=eq.hired&requirement_id=neq.${encodeURIComponent(requirementId)}` +
          `&or=(candidate_status_updated_at.gte.${cutoff},candidate_status_updated_at.is.null)` +
          `&candidate_user_id=in.(${inList(batch)})&select=candidate_user_id&limit=1000`,
        { headers },
      );
      if (!res.ok) continue;
      const rows = (await res.json().catch(() => [])) as Array<{ candidate_user_id: string }>;
      for (const r of rows) out.add(r.candidate_user_id);
    } catch {
      /* best-effort, same as before: a failed hired-elsewhere read never fails the pass */
    }
  }
  return out;
}

/** Untouched rows whose candidate was hired elsewhere are dropped from this
 *  requirement's list; touched rows (the employer already acted) always stay. */
export function planHiredElsewhereRemovals(
  untouched: ExistingMatchRow[],
  hiredIds: Set<string>,
): { removeIds: string[]; untouched: ExistingMatchRow[] } {
  const removeIds: string[] = [];
  const keep: ExistingMatchRow[] = [];
  for (const m of untouched) {
    if (!m.unlocked && hiredIds.has(m.candidate_user_id)) removeIds.push(m.id);
    else keep.push(m);
  }
  return { removeIds, untouched: keep };
}

/** Pages fetched per candidate batch before we stop: 50 candidates x 5 pages
 *  of 1000 is 100 sessions per candidate, far past what scoring can use. */
export const SESSION_MAX_PAGES = 5;

/* One page of one batch, retried once on a non-OK status or a thrown fetch.
   null means both attempts failed. */
async function fetchSessionPage(url: string, headers: Headers, fetchImpl: FetchImpl): Promise<GradedSessionRow[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(url, { headers });
      if (!res.ok) continue;
      const rows = (await res.json().catch(() => null)) as GradedSessionRow[] | null;
      if (Array.isArray(rows)) return rows;
    } catch {
      /* fall through to the retry */
    }
  }
  return null;
}

/** Graded sessions for `ids`, batched and newest-first. `withReports` also
 *  pulls report_json, needed only when the requirement sets a quality bar.
 *  A batch whose rows fill a page is paged on (a prolific candidate must not
 *  silently lose the rest of their history), and a failed page is retried
 *  once. Candidates in a batch that still fails are scored without session
 *  evidence, so the count is logged rather than swallowed. */
export async function loadGradedSessions(
  supabaseUrl: string,
  headers: Headers,
  ids: string[],
  withReports: boolean,
  fetchImpl: FetchImpl = fetch,
): Promise<GradedSessionRow[]> {
  const select = `user_id,score,created_at,type,target_role,report_generated_at${withReports ? ",report_json" : ""}`;
  let skippedCandidates = 0;
  const perBatch = await mapConcurrent(chunk(ids, SESSION_BATCH), async (batch) => {
    const rowsOut: GradedSessionRow[] = [];
    for (let page = 0; page < SESSION_MAX_PAGES; page++) {
      const rows = await fetchSessionPage(
        `${supabaseUrl}/rest/v1/sessions?user_id=in.(${inList(batch)})&report_generated_at=not.is.null` +
          `&select=${select}&order=created_at.desc,id.desc&limit=${SESSION_PAGE_LIMIT}&offset=${page * SESSION_PAGE_LIMIT}`,
        headers, fetchImpl,
      );
      if (rows === null) { skippedCandidates += batch.length; break; }
      rowsOut.push(...rows);
      if (rows.length < SESSION_PAGE_LIMIT) break;
    }
    return rowsOut;
  });
  const out = perBatch.flat();
  if (skippedCandidates > 0) {
    slog.warn("loadGradedSessions: session batches failed, candidates scored without session evidence", { skippedCandidates, requested: ids.length });
  }
  return keepGradedSessions(out);
}

/** Per candidate: do they have anything an employer could actually screen?
 *  A parsed resume, or at least one server-graded session. Ungraded sessions
 *  are client-relayed and are not evidence. Null on a failed profile read. */
export async function loadEvidenceFlags(
  supabaseUrl: string,
  headers: Headers,
  ids: string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Map<string, boolean> | null> {
  const flags = new Map<string, boolean>(ids.map((id) => [id, false]));
  const pages = await mapConcurrent(chunk(ids, MAX_IN_BATCH), async (batch) => {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/profiles?id=in.(${inList(batch)})&resume_data=not.is.null&select=id`, { headers });
    if (!res.ok) return null;
    return (await res.json().catch(() => [])) as Array<{ id: string }>;
  });
  for (const rows of pages) {
    if (rows === null) return null;
    for (const r of rows) flags.set(r.id, true);
  }
  const withoutResume = ids.filter((id) => !flags.get(id));
  if (withoutResume.length > 0) {
    const sessions = await loadGradedSessions(supabaseUrl, headers, withoutResume, false, fetchImpl);
    for (const s of sessions) flags.set(s.user_id, true);
  }
  return flags;
}

/* ── Model-score budget + reuse ── */

/** Model-call budget from the time a run has left. 0 means skip the call. */
export function llmBudgetMs(remainingMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs < LLM_MIN_REMAINING_MS) return 0;
  return Math.min(LLM_MAX_BUDGET_MS, Math.floor(remainingMs - LLM_WRITE_RESERVE_MS));
}

export interface LlmScoreEntry {
  score: number;
  scoredAt: string;
  /** True when carried over from an earlier pass rather than just computed. */
  reused: boolean;
}

/** What a stored model score must still match to be reused. */
export interface LlmReuseGuard {
  criteriaFingerprint: string;
  /** Per candidate: stamp of the profile content as it is now. */
  profileStamps: Map<string, string>;
}

/** Model opinion per candidate for this pass: fresh scores win, and a
 *  candidate the model did not score this time (call skipped, failed, or the
 *  model omitted them) keeps their last stored opinion while it is recent AND
 *  was computed for the same requirement criteria and the same profile
 *  content. Without this a transient outage swings every blended score down,
 *  and the recovery swings it back up across the strong threshold; without the
 *  guard an opinion about an old resume or an old posting outlives the edit.
 *  A stored score with no recorded provenance (pre-0050, or the columns not
 *  migrated) is never reused. */
export function resolveLlmScores(
  candidateIds: string[],
  fresh: Map<string, number>,
  prior: Map<string, Pick<ExistingMatchRow, "llm_score" | "llm_scored_at" | "llm_criteria_fingerprint" | "llm_profile_stamp">>,
  nowMs: number,
  guard: LlmReuseGuard,
  maxAgeMs: number = LLM_SCORE_MAX_AGE_MS,
): Map<string, LlmScoreEntry> {
  const out = new Map<string, LlmScoreEntry>();
  const nowIso = new Date(nowMs).toISOString();
  for (const id of candidateIds) {
    const f = fresh.get(id);
    if (f != null) {
      out.set(id, { score: f, scoredAt: nowIso, reused: false });
      continue;
    }
    const p = prior.get(id);
    if (!p || p.llm_score == null || !p.llm_scored_at) continue;
    if (!p.llm_criteria_fingerprint || p.llm_criteria_fingerprint !== guard.criteriaFingerprint) continue;
    const stamp = guard.profileStamps.get(id);
    if (!stamp || p.llm_profile_stamp !== stamp) continue;
    const at = Date.parse(p.llm_scored_at);
    if (!Number.isFinite(at) || nowMs - at > maxAgeMs || at > nowMs + 60_000) continue;
    out.set(id, { score: p.llm_score, scoredAt: p.llm_scored_at, reused: true });
  }
  return out;
}

/** True when this candidate's blended score crossed the strong bar only
 *  because the model's opinion appeared or disappeared since the last pass,
 *  not because the deterministic evidence changed. Such a crossing is noise,
 *  not a new strong match, so it must not raise an alert. Only meaningful for
 *  an existing row whose model column was readable. */
export function isModelSourceFlip(p: {
  previousHadModelScore: boolean;
  nowHasModelScore: boolean;
  deterministicScore: number;
  strongThreshold: number;
}): boolean {
  return p.previousHadModelScore !== p.nowHasModelScore && p.deterministicScore < p.strongThreshold;
}

/** Statuses an employer or candidate has already closed out. Such a row stays
 *  on file (it is paid-for or pipeline history) but is not an open candidate,
 *  so it must not lift a requirement's status or its matched-pool size. */
const DEAD_MATCH_STATUSES = new Set(["rejected", "not_a_fit"]);

export function isLiveMatch(m: Pick<ExistingMatchRow, "candidate_status" | "candidate_response">): boolean {
  if (m.candidate_status && DEAD_MATCH_STATUSES.has(m.candidate_status)) return false;
  return m.candidate_response !== "declined";
}

/* ── Archive undo ── */

/** Pipeline stages an archive's "reject remaining" can have moved a row out
 *  of, and so the only ones a restore may put it back into. */
export const RESTORABLE_CANDIDATE_STATUSES = ["shortlisted", "interview_invited", "interviewing"] as const;
export type RestorableCandidateStatus = (typeof RESTORABLE_CANDIDATE_STATUSES)[number];
export const MAX_RESTORE_MATCHES = 1000;

export interface RejectedMatchRecord {
  id: string;
  previousStatus: RestorableCandidateStatus;
}

/** A legacy row with no status was "active" and shows as shortlisted. */
export function previousStatusOf(candidateStatus: string | null | undefined): RestorableCandidateStatus {
  return (RESTORABLE_CANDIDATE_STATUSES as readonly string[]).includes(candidateStatus ?? "")
    ? (candidateStatus as RestorableCandidateStatus)
    : "shortlisted";
}

/** Validates the undo payload the client echoes back from the archive
 *  response. Null on anything malformed: a restore must never write a status
 *  the archive could not have replaced. */
export function parseRestoreMatches(input: unknown): RejectedMatchRecord[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_RESTORE_MATCHES) return null;
  const out: RejectedMatchRecord[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") return null;
    const { id, previousStatus } = entry as { id?: unknown; previousStatus?: unknown };
    if (typeof id !== "string" || !/^[0-9a-fA-F-]{36}$/.test(id)) return null;
    if (typeof previousStatus !== "string" || !(RESTORABLE_CANDIDATE_STATUSES as readonly string[]).includes(previousStatus)) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, previousStatus: previousStatus as RestorableCandidateStatus });
  }
  return out;
}

/* ── Strong-match alerts ── */

export interface RankedLike {
  candidateId: string;
  matchScore: number;
}

/** Candidates who are strong NOW and were not strong on the previous pass,
 *  best first, capped so one run can never claim an unbounded alert. */
export function selectNewStrongMatches<T extends RankedLike>(
  ranked: T[],
  previousScoreByCandidate: Map<string, number>,
  strongThreshold: number,
  cap: number = MAX_NEW_STRONG_ALERTS,
  alreadyAlertedIds: Set<string> = new Set(),
): T[] {
  return ranked
    .filter((m) => m.matchScore >= strongThreshold && !alreadyAlertedIds.has(m.candidateId) && (previousScoreByCandidate.get(m.candidateId) ?? -1) < strongThreshold)
    .sort((a, b) => b.matchScore - a.matchScore || (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0))
    .slice(0, cap);
}

/** Alert copy carries counts and a score only — never a candidate name, id
 *  or id-derived label (the employer hasn't paid to identify anyone). */
export function strongMatchAlertBody(count: number, topScore: number, requirementTitle: string): string {
  const title = requirementTitle || "your requirement";
  return count === 1
    ? `A candidate now ranks as a strong match (${topScore}%) for ${title}.`
    : `${count} candidates now rank as strong matches for ${title} (top score ${topScore}%).`;
}

/* ── Cron / run budgets ── */

/** True when there is still time to start another batch: leaves room for a
 *  batch as slow as the slowest one seen so far. */
export function canStartBatch(elapsedMs: number, budgetMs: number, slowestBatchMs: number): boolean {
  return elapsedMs + slowestBatchMs < budgetMs;
}

/* ── Pagination ── */

export interface PageParams {
  page: number;
  limit: number;
}

export function parsePagination(searchParams: URLSearchParams): PageParams {
  const rawPage = Number.parseInt(searchParams.get("page") || "", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") || "", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 10_000) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_LIMIT) : DEFAULT_PAGE_LIMIT;
  return { page, limit };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  nextPage: number | null;
}

export function paginate<T>(items: T[], { page, limit }: PageParams): Paginated<T> {
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);
  return { items: slice, total: items.length, page, limit, nextPage: start + limit < items.length ? page + 1 : null };
}

/* ── Employer allowance (suspension + tier limits) ── */

export interface EmployerGateRow {
  website?: string | null;
  suspended_at?: string | null;
  verification_tier?: string | null;
}

export type Allowance =
  | { ok: true; tier: EmployerTier }
  | { ok: false; status: number; body: Record<string, unknown>; retryAfterSeconds?: number };

export const SUSPENDED_BODY = {
  error: "This employer account is suspended or scheduled for deletion. If you scheduled deletion, restore your account to continue; otherwise contact support@hirestepx.com.",
  code: "suspended",
};

export function suspendedAllowance(): Extract<Allowance, { ok: false }> {
  return { ok: false, status: 403, body: { ...SUSPENDED_BODY } };
}

async function countRows(url: string, headers: Headers, fetchImpl: FetchImpl): Promise<number | null> {
  try {
    const res = await fetchImpl(url, { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } });
    if (!res.ok) return null;
    const total = Number(res.headers.get("content-range")?.split("/")[1]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

export function openRequirementLimitAllowance(tier: EmployerTier, openCount: number): Allowance {
  const limit = TIER_LIMITS[tier].openRequirements;
  if (openCount < limit) return { ok: true, tier };
  const upgrade = tier === "basic"
    ? " Verify your company email to raise this limit."
    : tier === "email_verified"
      ? " Verify your company website to raise this limit."
      : "";
  return {
    ok: false,
    status: 403,
    body: {
      error: `Your ${tier.replace("_", " ")} account can have ${limit} open requirements at a time. Archive one to open another.${upgrade}`,
      code: "requirement_limit",
      tier,
      limit,
      openRequirements: openCount,
    },
  };
}

export function rematchLimitAllowance(tier: EmployerTier, recentCount: number): Allowance {
  const limit = TIER_LIMITS[tier].rematchesPerHour;
  if (recentCount < limit) return { ok: true, tier };
  return {
    ok: false,
    status: 429,
    retryAfterSeconds: 3600,
    body: {
      error: `You've re-run candidate matching ${recentCount} times in the last hour (limit ${limit} for your ${tier.replace("_", " ")} account). Try again later.`,
      code: "rematch_limit",
      tier,
      limit,
      recentRematches: recentCount,
      retryAfterSeconds: 3600,
    },
  };
}

/** Activity-row `detail` marking an edit that changed nothing matching reads,
 *  so it spent no rematch and must not count against the hourly limit. */
export const NO_REMATCH_DETAIL = "no_rematch";

/** Re-check after the insert: the pre-insert count can't see a concurrent
 *  create, so two simultaneous POSTs at the limit would both pass it. The
 *  count here includes the row just inserted; over the limit means the caller
 *  deletes that row and refuses. If two requests race, both can see the
 *  overshoot and both back out — the safe side of the race. An unreadable
 *  count is allowed through: the pre-insert gate already passed. */
export async function recheckOpenRequirementLimit(p: {
  supabaseUrl: string;
  headers: Headers;
  employerId: string;
  tier: EmployerTier;
  fetchImpl?: FetchImpl;
}): Promise<Allowance> {
  const f = p.fetchImpl ?? fetch;
  const open = await countRows(
    `${p.supabaseUrl}/rest/v1/employer_requirements?employer_id=eq.${encodeURIComponent(p.employerId)}&status=neq.closed&select=id`,
    p.headers, f,
  );
  if (open === null) return { ok: true, tier: p.tier };
  return openRequirementLimitAllowance(p.tier, Math.max(0, open - 1));
}

/** The fields runMatching actually reads. Anything else on a requirement
 *  (department, budget, due date, perks, notice period, stage...) can change
 *  without moving a single score. */
export interface MatchingInputs {
  title: string;
  description: string | null | undefined;
  skills: string[] | null | undefined;
  customSkillSets: string[] | null | undefined;
  locations: string[] | null | undefined;
  workMode: string | null | undefined;
  experienceMin: number | null | undefined;
  experienceMax: number | null | undefined;
  minReadinessBand: string | null | undefined;
  minStarCompleteness: number | null | undefined;
  employmentType: string | null | undefined;
  /** Judge contract fit for internships; matching reads both. */
  durationWeeks?: number | null;
  hoursPerWeek?: number | null;
}

function sameList(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const x = (a ?? []).map((v) => v.trim().toLowerCase());
  const y = (b ?? []).map((v) => v.trim().toLowerCase());
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** True when an edit changes something matching reads, or the last run never
 *  finished ("failed"/"generating"), in which case any save is a retry. Pure
 *  so the PATCH handler stays thin and the rule is tested directly. */
export function requirementNeedsRematch(
  before: MatchingInputs,
  after: MatchingInputs,
  lastStatus?: string | null,
): boolean {
  if (lastStatus === "failed" || lastStatus === "generating") return true;
  const text = (v: string | null | undefined) => (v ?? "").trim();
  return (
    text(before.title) !== text(after.title) ||
    text(before.description) !== text(after.description) ||
    !sameList(before.skills, after.skills) ||
    !sameList(before.customSkillSets, after.customSkillSets) ||
    !sameList(before.locations, after.locations) ||
    (before.workMode ?? null) !== (after.workMode ?? null) ||
    (before.experienceMin ?? null) !== (after.experienceMin ?? null) ||
    (before.experienceMax ?? null) !== (after.experienceMax ?? null) ||
    (before.minReadinessBand ?? null) !== (after.minReadinessBand ?? null) ||
    (before.minStarCompleteness ?? null) !== (after.minStarCompleteness ?? null) ||
    (before.employmentType ?? null) !== (after.employmentType ?? null) ||
    (before.durationWeeks ?? null) !== (after.durationWeeks ?? null) ||
    (before.hoursPerWeek ?? null) !== (after.hoursPerWeek ?? null)
  );
}

/** One gate for every employer action that creates or re-runs matching.
 *  Counts come from the DB (open requirements; activity rows in the last
 *  hour) so it works across edge isolates — unlike the Upstash helpers it
 *  never silently fails open: an unreadable count refuses with 503. */
export async function checkEmployerAllowance(p: {
  supabaseUrl: string;
  headers: Headers;
  employerId: string;
  employer: EmployerGateRow | null | undefined;
  needsOpenSlot: boolean;
  needsRematch: boolean;
  fetchImpl?: FetchImpl;
  nowMs?: number;
}): Promise<Allowance> {
  const f = p.fetchImpl ?? fetch;
  if (isSuspended(p.employer)) return suspendedAllowance();
  const identity = await loadAuthIdentity(p.supabaseUrl, p.headers, p.employerId, f);
  const tier = deriveEmployerTier({
    storedTier: p.employer?.verification_tier,
    email: identity.email,
    emailConfirmed: identity.emailConfirmed,
    website: p.employer?.website,
  });
  const unavailable = (): Allowance => ({
    ok: false,
    status: 503,
    body: { error: "Couldn't verify your account limits right now. Please try again in a moment.", code: "limit_check_unavailable" },
  });

  if (p.needsOpenSlot) {
    const open = await countRows(
      `${p.supabaseUrl}/rest/v1/employer_requirements?employer_id=eq.${encodeURIComponent(p.employerId)}&status=neq.closed&select=id`,
      p.headers, f,
    );
    if (open === null) return unavailable();
    const verdict = openRequirementLimitAllowance(tier, open);
    if (!verdict.ok) return verdict;
  }
  if (p.needsRematch) {
    const since = new Date((p.nowMs ?? Date.now()) - REMATCH_WINDOW_MS).toISOString();
    const recent = await countRows(
      `${p.supabaseUrl}/rest/v1/employer_requirement_activity?employer_id=eq.${encodeURIComponent(p.employerId)}` +
        `&action=in.(created,updated,reopened)&created_at=gte.${encodeURIComponent(since)}` +
        // Edits that re-ran nothing are logged with NO_REMATCH_DETAIL. A bare
        // detail=neq.x would also drop NULL rows (every older row), hence the or().
        `&or=(detail.is.null,detail.neq.${NO_REMATCH_DETAIL})&select=id`,
      p.headers, f,
    );
    if (recent === null) return unavailable();
    const verdict = rematchLimitAllowance(tier, recent);
    if (!verdict.ok) return verdict;
  }
  return { ok: true, tier };
}

/* ── Pre-unlock masking ── */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin|github|twitter|x)\.com\/\S+/gi;
const YEAR_RUN_RE = /^(?:(?:19|20)\d{2}[\s\-–/]*)+$/;
const PHONE_RE = /(?<![\w.])(?:\+?\d[\d\s().-]{8,}\d)(?![\w])/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LEGAL_SUFFIX_RE = /[\s,]+(?:pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|llc|inc\.?|corp\.?)\s*$/i;

/** "Acme Solutions LLP" is routinely written back as "Acme Solutions", so both forms are scrubbed. */
function withoutLegalSuffix(names: string[]): string[] {
  return names.flatMap((n) => {
    const base = n.replace(LEGAL_SUFFIX_RE, "").trim();
    return base.length >= 3 && base !== n ? [n, base] : [n];
  });
}

/** Removes contact patterns (and optionally named entities) from a free-text
 *  field. The candidate's own name is scrubbed separately. */
export function scrubFreeText(text: string, entityNames: string[], placeholder = "[redacted]", contactPlaceholder = "[redacted]"): string {
  let out = text;
  const names = Array.from(new Set(withoutLegalSuffix(entityNames.map((n) => n.trim()).filter((n) => n.length >= 2)))).sort((a, b) => b.length - a.length);
  for (const name of names) {
    out = out.replace(new RegExp(escapeRegExp(name), "gi"), placeholder);
  }
  return out
    .replace(EMAIL_RE, contactPlaceholder)
    .replace(URL_RE, contactPlaceholder)
    // 10+ digits only, and never a run of bare years ("2018 - 2021 - 2023").
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 10 && !YEAR_RUN_RE.test(m) ? contactPlaceholder : m));
}

export const LOCKED_MASKED_FIELDS = ["name", "email", "phone", "linkedin", "portfolioLinks", "contactInText"] as const;

/** Second pass over an already lock-redacted resume: a phone number, email or
 *  link written into the free text would defeat the contact lock. */
export function scrubLockedResume(redacted: ResumeDetail): ResumeDetail {
  const s = (t: string) => scrubFreeText(t, []);
  return {
    ...redacted,
    summary: s(redacted.summary),
    headline: redacted.headline ? s(redacted.headline) : redacted.headline,
    keyAchievements: redacted.keyAchievements.map(s),
    certifications: redacted.certifications.map(s),
    careerTrajectory: redacted.careerTrajectory ? s(redacted.careerTrajectory) : redacted.careerTrajectory,
    promotionSignals: redacted.promotionSignals.map(s),
    primaryDomain: redacted.primaryDomain ? s(redacted.primaryDomain) : redacted.primaryDomain,
    interviewStrengths: redacted.interviewStrengths.map(s),
    experience: redacted.experience.map((e) => ({
      ...e,
      title: s(e.title),
      ...(e.scope ? { scope: s(e.scope) } : {}),
      ...(e.partners ? { partners: e.partners.map(s) } : {}),
      ...(e.topProjects ? { topProjects: e.topProjects.map(s) } : {}),
      ...(e.bullets ? { bullets: e.bullets.map(s) } : {}),
    })),
  };
}

export interface StrongMatchLike {
  id: string;
  name: string;
  initials: string;
  yearsExperience: number | null;
  skills: string[];
}

/** The Jobs list's strong-match chips carry a name and initials per
 *  candidate. For a match the employer hasn't unlocked, swap both for the
 *  masked label and expose the (non-identifying) match id instead of the
 *  candidate's user id. */
export function maskStrongMatches<T extends StrongMatchLike>(
  strongMatches: T[],
  lookup: Map<string, { matchId: string; unlocked: boolean }>,
): T[] {
  return strongMatches.map((c) => {
    const m = lookup.get(c.id);
    if (m && m.unlocked) return c;
    // No lookup entry means we can't prove it's unlocked — mask.
    const matchId = m?.matchId ?? "";
    return {
      ...c,
      id: matchId,
      name: maskedCandidateName(matchId),
      initials: matchId.slice(0, 2).toUpperCase() || "?",
    };
  });
}

export { maskedCandidateName };

/* ── Visible shortlist + next unlock batch ── */

export interface RankableMatch extends Pick<ExistingMatchRow, "unlocked" | "candidate_status" | "candidate_status_note" | "interview_scheduled_at"> {
  id: string;
  candidate_user_id: string;
  match_score: number;
}

/** Rows the employer may see, in the fixed rank order (score desc, id asc).
 *  The detail page and the unlock order MUST share this so the rank positions
 *  the UI shows are the ones the server batches and prices. */
export function rankVisibleMatches<T extends RankableMatch>(
  matches: T[],
  gates: { blocked: Set<string>; optedOut: Set<string>; evidence: Map<string, boolean> },
): T[] {
  return matches
    .filter((m) => {
      if (gates.blocked.has(m.candidate_user_id)) return false;
      if (gates.optedOut.has(m.candidate_user_id) && !m.unlocked) return false;
      return isTouchedMatch(m) || !!gates.evidence.get(m.candidate_user_id);
    })
    .sort((x, y) => y.match_score - x.match_score || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export interface UnlockBatchQuote {
  /** 1-based rank range of the batch window (visible rank). */
  start: number;
  end: number;
  matchIds: string[];
  count: number;
  amountPaise: number;
  /** Locked visible candidates across the whole shortlist, not just this window. */
  lockedRemaining: number;
}

/** The first rank window of UNLOCK_BUNDLE_SIZE that still has a locked row,
 *  with the locked ids and the exact price the order will charge. */
export function nextUnlockBatchQuote(ranked: Array<{ id: string; unlocked: boolean }>): UnlockBatchQuote | null {
  for (let start = 0; start < ranked.length; start += UNLOCK_BUNDLE_SIZE) {
    const block = ranked.slice(start, start + UNLOCK_BUNDLE_SIZE);
    const locked = block.filter((r) => !r.unlocked);
    if (locked.length > 0) {
      return {
        start: start + 1,
        end: start + block.length,
        matchIds: locked.map((r) => r.id),
        count: locked.length,
        amountPaise: batchUnlockPrice(locked.length).amountPaise,
        lockedRemaining: ranked.filter((r) => !r.unlocked).length,
      };
    }
  }
  return null;
}

/** Loads the consent/evidence gates for a requirement's matches and returns
 *  the ranked visible list plus the opted-out set. Null when any gate read fails (fail closed). */
export async function loadRankedVisibleMatches<T extends RankableMatch>(
  supabaseUrl: string,
  headers: Headers,
  employerId: string,
  matches: T[],
  /** The block list, when the caller already started reading it. */
  blockedRead?: Promise<Set<string> | null>,
): Promise<{ ranked: T[]; optedOut: Set<string> } | null> {
  const ids = Array.from(new Set(matches.map((m) => m.candidate_user_id)));
  const [blocked, optedOut, evidence] = await Promise.all([
    blockedRead ?? loadBlockedCandidateIds(supabaseUrl, headers, employerId),
    ids.length > 0 ? loadOptedOutCandidateIds(supabaseUrl, headers, ids) : new Set<string>(),
    ids.length > 0 ? loadEvidenceFlags(supabaseUrl, headers, ids) : new Map<string, boolean>(),
  ]);
  if (!blocked || !optedOut || !evidence) return null;
  return { ranked: rankVisibleMatches(matches, { blocked, optedOut, evidence }), optedOut };
}
