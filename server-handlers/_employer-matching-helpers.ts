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
  extractReadinessForecast,
  extractStarCompleteness,
  latestSessionByUser,
  type SessionRow,
} from "./_employer-candidate-evidence-helpers";
import { daysSinceLastActive } from "./_employer-requirements-helpers";
import { TIER_LIMITS, deriveEmployerTier, isSuspended, maskedCandidateName, type EmployerTier } from "./_employer-trust";
import { loadAuthIdentity } from "./_entitlements";

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

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
}

/** A row the employer has acted on — paid to unlock, moved off the default
 *  "shortlisted" stage, left a note, or scheduled an interview — keeps its id
 *  and pipeline state through a re-match and is never re-scored. */
export function isTouchedMatch(m: Pick<ExistingMatchRow, "unlocked" | "candidate_status" | "candidate_status_note" | "interview_scheduled_at">): boolean {
  return !!m.unlocked || (!!m.candidate_status && m.candidate_status !== "shortlisted") || !!m.candidate_status_note || !!m.interview_scheduled_at;
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
export function planStaleRemovals(untouched: ExistingMatchRow[], rankedCandidateIds: Set<string>, scanComplete: boolean): string[] {
  if (!scanComplete) return [];
  return untouched
    .filter((m) => !m.unlocked && !isTouchedMatch(m) && !rankedCandidateIds.has(m.candidate_user_id))
    .map((m) => m.id);
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
}

export function isEligiblePoolProfile(
  p: PoolProfile,
  ctx: { ownerUserId: string; blockedCandidateIds: Set<string>; excludedCandidateIds: Set<string> },
): boolean {
  if (p.id === ctx.ownerUserId) return false;
  if (p.employer_visibility === "off") return false;
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
    const readiness = extractReadinessForecast(row.report_json);
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
 *  out of employer visibility, or whose profile is gone. Blocks are handled
 *  separately. Null on a failed read (fail closed). */
export async function loadOptedOutCandidateIds(
  supabaseUrl: string,
  headers: Headers,
  ids: string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Set<string> | null> {
  const present = new Set<string>();
  const off = new Set<string>();
  for (const batch of chunk(ids, MAX_IN_BATCH)) {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/profiles?id=in.(${inList(batch)})&select=id,employer_visibility`, { headers });
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => [])) as Array<{ id: string; employer_visibility?: string | null }>;
    for (const r of rows) {
      present.add(r.id);
      if (r.employer_visibility === "off") off.add(r.id);
    }
  }
  for (const id of ids) if (!present.has(id)) off.add(id);
  return off;
}

/** Of `ids`, who is already hired against a DIFFERENT requirement. Scoped to
 *  the post-prefilter candidates so the read stays small (uses the
 *  requirement_matches(candidate_user_id, candidate_status) index). */
export async function loadHiredElsewhere(
  supabaseUrl: string,
  headers: Headers,
  requirementId: string,
  ids: string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Set<string>> {
  const out = new Set<string>();
  for (const batch of chunk(ids, MAX_IN_BATCH)) {
    try {
      const res = await fetchImpl(
        `${supabaseUrl}/rest/v1/requirement_matches?candidate_status=eq.hired&requirement_id=neq.${encodeURIComponent(requirementId)}` +
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

/** Graded sessions for `ids`, batched and newest-first. `withReports` also
 *  pulls report_json, needed only when the requirement sets a quality bar. */
export async function loadGradedSessions(
  supabaseUrl: string,
  headers: Headers,
  ids: string[],
  withReports: boolean,
  fetchImpl: FetchImpl = fetch,
): Promise<GradedSessionRow[]> {
  const select = `user_id,score,created_at,type,report_generated_at${withReports ? ",report_json" : ""}`;
  const out: GradedSessionRow[] = [];
  for (const batch of chunk(ids, SESSION_BATCH)) {
    try {
      const res = await fetchImpl(
        `${supabaseUrl}/rest/v1/sessions?user_id=in.(${inList(batch)})&report_generated_at=not.is.null` +
          `&select=${select}&order=created_at.desc&limit=${SESSION_PAGE_LIMIT}`,
        { headers },
      );
      if (!res.ok) continue;
      const rows = (await res.json().catch(() => [])) as GradedSessionRow[];
      if (Array.isArray(rows)) out.push(...rows);
    } catch {
      /* a failed batch just leaves those candidates without session evidence */
    }
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
  for (const batch of chunk(ids, MAX_IN_BATCH)) {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/profiles?id=in.(${inList(batch)})&resume_data=not.is.null&select=id`, { headers });
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => [])) as Array<{ id: string }>;
    for (const r of rows) flags.set(r.id, true);
  }
  const withoutResume = ids.filter((id) => !flags.get(id));
  if (withoutResume.length > 0) {
    const sessions = await loadGradedSessions(supabaseUrl, headers, withoutResume, false, fetchImpl);
    for (const s of sessions) flags.set(s.user_id, true);
  }
  return flags;
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
): T[] {
  return ranked
    .filter((m) => m.matchScore >= strongThreshold && (previousScoreByCandidate.get(m.candidateId) ?? -1) < strongThreshold)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, cap);
}

/** Alert copy carries counts and a score only — never a candidate name, id
 *  or id-derived label (the employer hasn't paid to identify anyone). */
export function strongMatchAlertBody(count: number, topScore: number, requirementTitle: string): string {
  const title = requirementTitle || "your requirement";
  return count === 1
    ? `A new strong match (${topScore}%) was found for ${title}.`
    : `${count} new strong matches found for ${title} (top score ${topScore}%).`;
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
  error: "This employer account is suspended. Contact support@hirestepx.com.",
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
        `&action=in.(created,updated,reopened)&created_at=gte.${encodeURIComponent(since)}&select=id`,
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

/** Removes contact patterns and every known employer/institution name from a
 *  free-text field. The candidate's own name is scrubbed by
 *  redactResumeDetailForLock; this covers what that leaves behind ("Led the
 *  payments team at Infosys", "B.Tech, IIT Madras", "reach me at ..."). */
export function scrubFreeText(text: string, entityNames: string[], placeholder = "[redacted]"): string {
  let out = text;
  const names = Array.from(new Set(entityNames.map((n) => n.trim()).filter((n) => n.length >= 2))).sort((a, b) => b.length - a.length);
  for (const name of names) {
    out = out.replace(new RegExp(escapeRegExp(name), "gi"), placeholder);
  }
  return out
    .replace(EMAIL_RE, placeholder)
    .replace(URL_RE, placeholder)
    // 10+ digits only, and never a run of bare years ("2018 - 2021 - 2023").
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 10 && !YEAR_RUN_RE.test(m) ? placeholder : m));
}

export const LOCKED_MASKED_FIELDS = [
  "name",
  "email",
  "phone",
  "linkedin",
  "portfolioLinks",
  "employerNames",
  "institutionNames",
  "freeTextIdentifiers",
] as const;

/** Second pass over an already lock-redacted resume: the structured
 *  company/school fields are blank, but the same names routinely reappear
 *  inside summary/headline/achievements/certifications text. */
export function scrubLockedResume(original: ResumeDetail, redacted: ResumeDetail): ResumeDetail {
  const entities = [
    ...original.experience.map((e) => e.company),
    ...original.education.map((e) => e.school),
  ];
  const s = (t: string) => scrubFreeText(t, entities);
  return {
    ...redacted,
    summary: s(redacted.summary),
    headline: redacted.headline ? s(redacted.headline) : redacted.headline,
    keyAchievements: redacted.keyAchievements.map(s),
    certifications: redacted.certifications.map(s),
    experience: redacted.experience.map((e) => ({ ...e, title: s(e.title) })),
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
