/* Pure extraction logic for employer-candidate-evidence.ts, unit-tested
 * against the real code rather than an inline copy — mirrors the
 * _employer-candidate-status-helpers.ts pattern.
 *
 * Reuses the RISkill shape persisted at sessions.report_json.skills (see
 * server-handlers/_readiness-core.ts) rather than inventing a new one —
 * only `name` and `score` are surfaced to the employer console, since
 * `weight` is an internal scoring detail with no display meaning here. */

import { scrubFreeText } from "./_employer-matching-helpers";
import { computeEvidenceCapabilities, type EvidenceCapability } from "../src/evidenceCapabilities";
export type { EvidenceCapability } from "../src/evidenceCapabilities";

export interface EvidenceSkill {
  name: string;
  score: number;
}

/** Narrows an unknown report_json blob down to its `skills` array, dropping
 *  any entry that doesn't have a real name + finite score rather than
 *  fabricating placeholders for malformed rows. */
export function extractEvidenceSkills(reportJson: unknown): EvidenceSkill[] {
  if (!reportJson || typeof reportJson !== "object") return [];
  const skills = (reportJson as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return [];
  const out: EvidenceSkill[] = [];
  for (const entry of skills) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as { name?: unknown }).name;
    const score = (entry as { score?: unknown }).score;
    if (typeof name !== "string" || !name.trim()) continue;
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    out.push({ name: name.trim(), score });
  }
  return out;
}

export interface EvidenceQuote {
  kind: "win" | "redFlag";
  text: string;
  quote: string;
}

/** Pulls up to 2 "win" quotes and 1 red-flag quote straight off the already-
 *  validated report_json.wins / report_json.redFlags arrays (see
 *  filterGroundedItems/filterGroundedRedFlags in evaluate-session.ts — every
 *  quote admitted there is already checked to be a real substring of the
 *  candidate's transcript, so this doesn't re-validate grounding). Entries
 *  missing a usable quote are skipped rather than surfaced with empty text. */
export function extractEvidenceQuotes(reportJson: unknown): EvidenceQuote[] {
  if (!reportJson || typeof reportJson !== "object") return [];
  const r = reportJson as { wins?: unknown; redFlags?: unknown };
  const out: EvidenceQuote[] = [];

  const wins = Array.isArray(r.wins) ? r.wins : [];
  for (const w of wins) {
    if (out.filter((q) => q.kind === "win").length >= 2) break;
    if (!w || typeof w !== "object") continue;
    const text = (w as { text?: unknown }).text;
    const quote = (w as { quote?: unknown }).quote;
    if (typeof text === "string" && text.trim() && typeof quote === "string" && quote.trim()) {
      out.push({ kind: "win", text: text.trim(), quote: quote.trim() });
    }
  }

  const redFlags = Array.isArray(r.redFlags) ? r.redFlags : [];
  for (const rf of redFlags) {
    if (!rf || typeof rf !== "object") continue;
    const title = (rf as { title?: unknown }).title;
    const quote = (rf as { quote?: unknown }).quote;
    if (typeof title === "string" && title.trim() && typeof quote === "string" && quote.trim()) {
      out.push({ kind: "redFlag", text: title.trim(), quote: quote.trim() });
      break;
    }
  }

  return out;
}

export type ReadinessBand = "strongHire" | "hire" | "leanHire";
const READINESS_BANDS: ReadinessBand[] = ["strongHire", "hire", "leanHire"];

export interface EvidenceReadiness {
  band: ReadinessBand;
  confidence: "low" | "medium" | "high";
}

/** Narrows report_json.readiness (see ReadinessForecast in
 *  evaluate-session.ts) to the band + confidence an employer card needs —
 *  drops estimatedHours/estimatedSessions/rationale, which are candidate-
 *  facing coaching detail with no meaning in an employer's shortlist. */
export function extractReadinessForecast(reportJson: unknown): EvidenceReadiness | null {
  if (!reportJson || typeof reportJson !== "object") return null;
  const readiness = (reportJson as { readiness?: unknown }).readiness;
  if (!readiness || typeof readiness !== "object") return null;
  const band = (readiness as { targetBand?: unknown }).targetBand;
  const confidence = (readiness as { confidence?: unknown }).confidence;
  if (typeof band !== "string" || !READINESS_BANDS.includes(band as ReadinessBand)) return null;
  return {
    band: band as ReadinessBand,
    confidence: confidence === "low" || confidence === "medium" || confidence === "high" ? confidence : "low",
  };
}

export interface StarCompleteness {
  /** % of scored questions whose answer covered all of Situation/Task/
   *  Action/Result — intentionally excludes the Learning (L) letter some
   *  sessions also track, since "STAR completeness" names the 4-part model. */
  pct: number;
  questionsConsidered: number;
}

/** Averages per-question STAR presence (report_json.perQuestion[].starPresence,
 *  the { S, T, A, R, L } shape evaluate-session.ts persists) into a single
 *  0-100 completeness figure. Questions with no starPresence block at all
 *  (e.g. a salary-negotiation session, or a pre-STAR-detection report
 *  version) are skipped rather than counted as 0% — absence of data isn't
 *  evidence of a weak answer. */
export function extractStarCompleteness(reportJson: unknown): StarCompleteness | null {
  if (!reportJson || typeof reportJson !== "object") return null;
  const perQuestion = (reportJson as { perQuestion?: unknown }).perQuestion;
  if (!Array.isArray(perQuestion)) return null;

  let consideredCount = 0;
  let totalRatio = 0;
  for (const q of perQuestion) {
    if (!q || typeof q !== "object") continue;
    const sp = (q as { starPresence?: unknown }).starPresence;
    if (!sp || typeof sp !== "object") continue;
    const letters = ["S", "T", "A", "R"] as const;
    const present = letters.filter((l) => (sp as Record<string, unknown>)[l] === true).length;
    const hasAnyBoolean = letters.some((l) => typeof (sp as Record<string, unknown>)[l] === "boolean");
    if (!hasAnyBoolean) continue;
    consideredCount++;
    totalRatio += present / letters.length;
  }
  if (consideredCount === 0) return null;
  return { pct: Math.round((totalRatio / consideredCount) * 100), questionsConsidered: consideredCount };
}

type FetchImpl = typeof fetch;

/** Atomically claims the "first view" of a match's evidence for notification
 *  purposes. Implemented as a conditional PATCH (`profile_viewed_at is null`)
 *  returning the representation: exactly one row back means THIS call flipped
 *  it, so the candidate gets notified once per match regardless of how many
 *  times the employer revisits the page — mirrors claimReferralReward's CAS
 *  pattern in _referral-reward-helpers.ts. */
export async function claimProfileView(
  baseUrl: string,
  serviceHeaders: Record<string, string>,
  matchId: string,
  nowIso: string,
  fetchImpl: FetchImpl = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${baseUrl}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&profile_viewed_at=is.null`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ profile_viewed_at: nowIso }),
      },
    );
    if (!res.ok) return false;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows.length === 1;
  } catch {
    return false;
  }
}

export interface SessionRow {
  user_id: string;
  created_at: string;
  report_json: unknown;
  type?: string;
  /** Same columns computeEvidenceCapabilities() reads off the candidate
   *  dashboard's RealSession — fetched directly rather than re-derived from
   *  report_json so "verified" means the exact same thing on both surfaces. */
  skill_scores?: Record<string, number> | null;
  score?: number;
  focus?: string;
}

/** Mirrors skillFamily() in src/interviewAPI.ts: salary-negotiation sessions
 *  score a disjoint skill set (anchoring, walk-away discipline, ...) that's
 *  meaningless evidence for a hiring requirement, which is always evaluating
 *  interview-family competence. Excluded here for the same reason that
 *  function keeps the two families from bleeding into each other. */
export function isNegotiationSession(type: string | undefined): boolean {
  return (type || "").toLowerCase().includes("negotiation");
}

/** A session only counts as usable evidence once it's actually been scored —
 *  `report_json` is written by /api/evaluate-session at completion, so a row
 *  with no extractable skills is either still in progress, was abandoned
 *  before evaluation, or genuinely has nothing to show. Distinguishing this
 *  from "negotiation session" lets the picker below skip incomplete rows the
 *  same way it skips off-topic ones. */
function hasEvidence(row: SessionRow): boolean {
  return extractEvidenceSkills(row.report_json).length > 0;
}

/** Picks, per candidate user id, the most-recent session row that's actually
 *  relevant, COMPLETED evidence for a hiring requirement — skipping
 *  salary-negotiation sessions (disjoint skill dimensions) and skipping rows
 *  that never made it to a scored report (abandoned/incomplete), so an
 *  in-progress or abandoned attempt never shadows an older completed session
 *  that has real skill data. Rows are expected pre-sorted newest-first by the
 *  caller's query, but this re-checks created_at defensively rather than
 *  trusting query order. */
export function latestSessionByUser(rows: SessionRow[]): Map<string, SessionRow> {
  const latest = new Map<string, SessionRow>();
  for (const row of rows) {
    if (isNegotiationSession(row.type)) continue;
    if (!hasEvidence(row)) continue;
    const existing = latest.get(row.user_id);
    if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
      latest.set(row.user_id, row);
    }
  }
  return latest;
}

export interface SessionTrendPoint {
  date: string;
  score: number;
  focus: string | null;
  type: string | null;
}

/** Graded, non-negotiation sessions as an oldest-to-newest score series so an
 *  employer can see whether the candidate is improving, not just the latest
 *  snapshot. Unscored rows are skipped; capped so the payload stays small. */
export function extractSessionTrend(rows: SessionRow[], limit = 8): SessionTrendPoint[] {
  const points: SessionTrendPoint[] = [];
  for (const row of rows) {
    if (isNegotiationSession(row.type)) continue;
    if (typeof row.score !== "number" || !Number.isFinite(row.score) || row.score <= 0) continue;
    if (!row.created_at) continue;
    points.push({
      date: row.created_at,
      score: Math.round(Math.min(100, row.score)),
      focus: typeof row.focus === "string" && row.focus.trim() ? row.focus.trim().slice(0, 60) : null,
      type: typeof row.type === "string" && row.type.trim() ? row.type.trim().slice(0, 40) : null,
    });
  }
  return points
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-limit);
}

/** Computes the SAME 4-capability "2+ sessions at 70+" verification bar the
 *  candidate dashboard shows (src/dashboardData.ts), from this one
 *  candidate's rows — unlike latestSessionByUser() this deliberately does
 *  NOT drop negotiation sessions: Salary Negotiation is one of the four
 *  capabilities and computeEvidenceCapabilities() matches it by focus
 *  itself. Rows with no score are harmless no-ops (they satisfy neither the
 *  skill-score nor the focus+score filters). */
/** skill_scores is relayed by the client through /api/sessions/save, whereas
 *  `score` is reconciled server-side by /api/evaluate-session. A session whose
 *  graded overall is below this floor can't plausibly carry a 70+ capability,
 *  so its skill_scores are ignored for employer-facing verification. */
export const SKILL_SCORE_PLAUSIBILITY_FLOOR = 50;

export function computeVerifiedCapabilitiesForCandidate(
  rows: SessionRow[],
  candidateUserId: string,
): EvidenceCapability[] {
  const own = rows.filter((r) => r.user_id === candidateUserId);
  return computeEvidenceCapabilities(
    own.map((r) => ({
      date: r.created_at,
      score: typeof r.score === "number" ? r.score : 0,
      focus: r.focus || "",
      skill_scores: typeof r.score === "number" && r.score >= SKILL_SCORE_PLAUSIBILITY_FLOOR ? (r.skill_scores ?? null) : null,
    })),
  );
}

export type AnswerVerdict = "strong" | "complete" | "partial" | "weak" | "skipped";
const ANSWER_VERDICTS: AnswerVerdict[] = ["strong", "complete", "partial", "weak", "skipped"];
const DIFFICULTIES = ["warmup", "standard", "hard"] as const;
const LENGTH_VERDICTS = ["too-brief", "right", "too-long"] as const;

export interface QuestionBreakdown {
  idx: number;
  question: string;
  score: number;
  verdict: AnswerVerdict;
  difficulty: (typeof DIFFICULTIES)[number] | null;
  star: { S: boolean; T: boolean; A: boolean; R: boolean } | null;
  length: { verdict: (typeof LENGTH_VERDICTS)[number]; wordCount: number } | null;
  /** Verbatim answer and the grader's note on it. Both routinely name past
   *  employers and colleagues, so they are only present once unlocked. */
  answerText?: string;
  explanation?: string;
}

/** One row per scored question from report_json.perQuestion, in interview
 *  order. Question wording is generated from the target role, so it is safe
 *  to show while locked; `includeAnswers` gates everything the candidate said. */
export function extractQuestionBreakdown(reportJson: unknown, includeAnswers: boolean, limit = 12): QuestionBreakdown[] {
  if (!reportJson || typeof reportJson !== "object") return [];
  const perQuestion = (reportJson as { perQuestion?: unknown }).perQuestion;
  if (!Array.isArray(perQuestion)) return [];
  const out: QuestionBreakdown[] = [];
  for (const raw of perQuestion) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;
    const question = typeof q.question === "string" ? q.question.trim() : "";
    const verdict = q.verdict;
    if (!question || typeof verdict !== "string" || !ANSWER_VERDICTS.includes(verdict as AnswerVerdict)) continue;
    const score = typeof q.score === "number" && Number.isFinite(q.score) ? Math.round(Math.max(0, Math.min(100, q.score))) : null;
    if (score == null) continue;

    const sp = q.starPresence && typeof q.starPresence === "object" ? (q.starPresence as Record<string, unknown>) : null;
    const star = sp && (["S", "T", "A", "R"] as const).some((l) => typeof sp[l] === "boolean")
      ? { S: sp.S === true, T: sp.T === true, A: sp.A === true, R: sp.R === true }
      : null;

    const lv = q.lengthVerdict && typeof q.lengthVerdict === "object" ? (q.lengthVerdict as Record<string, unknown>) : null;
    const length = lv && (LENGTH_VERDICTS as readonly string[]).includes(lv.verdict as string) && typeof lv.wordCount === "number" && Number.isFinite(lv.wordCount)
      ? { verdict: lv.verdict as (typeof LENGTH_VERDICTS)[number], wordCount: Math.max(0, Math.round(lv.wordCount)) }
      : null;

    const row: QuestionBreakdown = {
      idx: typeof q.idx === "number" && Number.isFinite(q.idx) ? q.idx : out.length,
      question: question.slice(0, 400),
      score,
      verdict: verdict as AnswerVerdict,
      difficulty: (DIFFICULTIES as readonly string[]).includes(q.difficulty as string) ? (q.difficulty as (typeof DIFFICULTIES)[number]) : null,
      star,
      length,
    };
    if (includeAnswers) {
      if (typeof q.answerText === "string" && q.answerText.trim()) row.answerText = q.answerText.trim().slice(0, 1500);
      if (typeof q.explanation === "string" && q.explanation.trim()) row.explanation = q.explanation.trim().slice(0, 500);
    }
    out.push(row);
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => a.idx - b.idx);
}

export interface DeliveryMetrics {
  paceWpm: number | null;
  fillersPerMin: number | null;
  /** Share of the session spent in pauses over 1.5s, 0-100. */
  pausePct: number | null;
  /** Median gap before starting an answer, in seconds. */
  responseSec: number | null;
  /** Hedging phrases per minute ("I think", "maybe"). */
  hedgesPerMin: number | null;
}

const positive = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const nonNegative = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Spoken-delivery numbers from report_json.coreMetrics / advancedDelivery.
 *  The evaluator writes all zeros when it had no timing data, so a zero pace
 *  means "not measured" and the whole block is dropped. With pace present,
 *  zero fillers or pauses are real readings; a zero response gap is not. */
export function extractDeliveryMetrics(reportJson: unknown): DeliveryMetrics | null {
  if (!reportJson || typeof reportJson !== "object") return null;
  const r = reportJson as { coreMetrics?: unknown; advancedDelivery?: unknown };
  const core = r.coreMetrics && typeof r.coreMetrics === "object" ? (r.coreMetrics as Record<string, unknown>) : {};
  const adv = r.advancedDelivery && typeof r.advancedDelivery === "object" ? (r.advancedDelivery as Record<string, unknown>) : {};

  const pace = positive(core.paceWpm);
  if (pace == null) return null;
  const fillers = nonNegative(core.fillerPerMin);
  const pause = nonNegative(core.silenceRatio);
  const latency = positive(adv.medianLatencyMs);
  const hedges = nonNegative(adv.hedgingPerMin);
  return {
    paceWpm: Math.round(pace),
    fillersPerMin: fillers != null ? round1(fillers) : null,
    pausePct: pause != null ? Math.round(Math.min(100, pause)) : null,
    responseSec: latency != null ? round1(latency / 1000) : null,
    hedgesPerMin: hedges != null ? round1(hedges) : null,
  };
}

export interface LockedQuestionContext {
  name: string;
  companies: string[];
  schools: string[];
}

/** Follow-up questions are generated from the resume, so they can name the
 *  candidate's employer or school. While locked, swap those for neutral
 *  wording ("At your company, ...") so the question still reads naturally. */
export function scrubLockedQuestions<T extends { question: string }>(questions: T[], ctx: LockedQuestionContext): T[] {
  const nameParts = ctx.name.trim().split(/\s+/).filter((p) => p.length > 1);
  const scrub = (text: string): string => {
    let out = scrubFreeText(scrubFreeText(text, ctx.schools, "your school"), ctx.companies, "your company");
    for (const part of nameParts) out = out.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[,]?\\s*`, "gi"), "");
    return out.trim();
  };
  return questions.map((q) => ({ ...q, question: scrub(q.question) }));
}
