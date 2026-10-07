/* Pure scoring logic for the employer talent-roster matching pass.
   Deterministic heuristic (role/skill token overlap + roster performance),
   not LLM-based — kept cheap and auditable for this pass. LLM-based
   re-ranking (see analyze-jd-match.ts's callLLM precedent) is a possible
   follow-up, not implemented here. */

export interface CandidatePoolRow {
  id: string;
  name: string;
  target_role: string | null;
  industry: string | null;
  resume_data: unknown;
  avg_score: number | null;
  sessions_completed: number;
  last_active_days_ago: number;
  /** From extractResumeDetail(resume_data).yearsExperience — null for
      fallback (regex-parsed) resumes, which never populate it. Callers
      building CandidatePoolRow should pass that through rather than
      re-deriving it here, since _resume-detail-helpers.ts already owns
      that parsing. */
  years_experience?: number | null;
  /** Band + STAR-completeness %% from extractReadinessForecast/
      extractStarCompleteness (_employer-candidate-evidence-helpers.ts)
      against the candidate's latest practice session. null/undefined when
      no session has been evaluated yet — treated as "unknown", never as
      failing a quality bar the employer set (see meetsQualityBar below). */
  readiness_band?: "strongHire" | "hire" | "leanHire" | null;
  star_completeness_pct?: number | null;
}

export interface RequirementInput {
  title: string;
  location: string;
  description: string;
  /** The employer's structured skill picks (e.g. ["React", "Node.js"]) —
      distinct from whatever skill words happen to appear in the free-text
      title/description. Optional only for callers (tests, older call
      sites) that haven't been updated yet; treated as empty when absent. */
  skills?: string[];
  experienceMin?: number | null;
  experienceMax?: number | null;
  /** Optional hard quality bar: a candidate must have a readiness forecast
      at least this strong (strongHire > hire > leanHire) and/or a
      STAR-completeness percentage at least this high to be surfaced at
      all — see meetsQualityBar/rankAndCap below. */
  minReadinessBand?: "strongHire" | "hire" | "leanHire" | null;
  minStarCompleteness?: number | null;
  /** Contract-shape fields (full-time/contract/internship, duration,
      weekly hours) — no symmetric signal exists on CandidatePoolRow, so
      these aren't scored deterministically; they're passed to the LLM
      rerank prompt in _requirement-match-llm.ts so contract fit still
      informs the blended score. */
  employmentType?: string | null;
  durationWeeks?: number | null;
  hoursPerWeek?: number | null;
}

const READINESS_RANK: Record<"strongHire" | "hire" | "leanHire", number> = {
  strongHire: 2,
  hire: 1,
  leanHire: 0,
};

export interface ScoredCandidate {
  candidateId: string;
  matchScore: number;
  rosterScore: number;
  /** Whether this candidate clears RELEVANCE_RATIO_FLOOR on real role or
      skill overlap with the requirement — as opposed to a candidate from a
      totally unrelated field whose only "score" comes from location/roster/
      activity noise, or whose sole overlap is one generic/ambiguous token
      diluted among many unrelated ones. rankAndCap filters on this so an
      employer never sees a forced, padded-out list of irrelevant candidates
      just to hit the cap. */
  hasRelevance: boolean;
  /** Whether this candidate has any real evidence behind their profile —
      resume data on file, or at least one completed practice session.
      rankAndCap filters on this alongside hasRelevance: a candidate who
      merely shares a loose role/skill token with the requirement but has
      neither a resume nor any practice history is pure noise in an
      employer's shortlist, not a reviewable match (see rankAndCap doc
      comment). */
  hasEvidence: boolean;
  /** Whether this candidate clears the requirement's optional minReadinessBand/
      minStarCompleteness quality bar. A candidate with no evaluated session
      yet (readiness_band/star_completeness_pct both null) is treated as NOT
      meeting a bar the employer explicitly set — unproven isn't the same as
      qualifying — but is true when the requirement sets no bar at all.
      Optional so existing test fixtures / call sites built before this field
      existed keep compiling; rankAndCap treats an absent value as true. */
  meetsQualityBar?: boolean;
}

/** Checks a candidate's readiness band + STAR completeness against a
    requirement's optional quality-bar fields. Either side of the bar can be
    unset independently; a candidate must clear whichever side(s) ARE set.
    Missing candidate data only fails a bar that's actually configured — it
    never fails a requirement with no bar set. */
export function meetsQualityBar(
  candidate: Pick<CandidatePoolRow, "readiness_band" | "star_completeness_pct">,
  req: Pick<RequirementInput, "minReadinessBand" | "minStarCompleteness">,
): boolean {
  if (req.minReadinessBand) {
    if (!candidate.readiness_band) return false;
    if (READINESS_RANK[candidate.readiness_band] < READINESS_RANK[req.minReadinessBand]) return false;
  }
  if (req.minStarCompleteness != null) {
    if (candidate.star_completeness_pct == null) return false;
    if (candidate.star_completeness_pct < req.minStarCompleteness) return false;
  }
  return true;
}

/** 0-100 read-outs for the three inputs that drive matchScore, for
    surfacing "why this score" to employers. Not persisted — recomputed
    from the same live inputs (resume, requirement) each time it's read,
    so it can drift slightly from the stored matchScore if a candidate's
    resume changed since the match was scored. That's fine for an
    explanatory breakdown; it isn't the number of record. */
export interface MatchBreakdown {
  roleMatch: number;
  skillMatch: number;
  locationMatch: number;
}

/* Cheap suffix-stripping, not a real stemmer — just enough to fold common
   plural/gerund/ing variants ("prototyping" / "prototypes" -> "prototyp",
   "systems" -> "system") onto the same token so skill/role overlap isn't
   defeated by surface-form mismatches. Words ending "ss" (e.g. "business")
   are excluded from the plural-"s" strip so they aren't corrupted. Words
   ending "ering" (e.g. "engineering") are excluded from the "-ing" strip:
   unlike "prototyping" -> "prototype", "-ering" nouns name a field/activity
   rather than an in-progress verb, and folding them onto their "-er" actor
   noun ("engineering" -> "engineer") produces false role-overlap hits —
   any JD that merely mentions working "with engineering" would otherwise
   look like a role match for every Software Engineer in the pool. */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ing") && !token.endsWith("ering")) return token.slice(0, -3);
  if (token.length > 3 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length > 3 && token.endsWith("es") && !token.endsWith("ss")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/* Generic connective/filler words that show up in almost any job
   description ("own", "ship", "closely", "partner", ...) and carry no
   role/skill signal — left in, they inflate roleOverlap/skillOverlap for
   any candidate whose target_role or skills happen to share one, which is
   pure noise rather than a real match. Only applied to requirement text
   (title/description), never to a candidate's own (already terse)
   target_role/skills tokens, which have no filler to strip. */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by", "from",
  "is", "are", "was", "were", "be", "been", "being", "as", "we", "you", "your", "our", "us",
  "ll", "re", "ve", "it", "its", "this", "that", "these", "those", "across", "into", "through",
  "own", "owns", "ship", "ships", "closely", "partner", "partners", "partnering", "fast", "moving",
  "looking", "hiring", "drive", "driving", "build", "building", "work", "working", "end", "full",
  "cycle", "core", "new", "team", "teams", "startup", "environment", "together",
  // Generic seniority/rank words that appear as a suffix on almost any
  // Indian job title ("Sales Executive", "Customer Support Executive",
  // "Marketing Executive", ...) and so carry no domain signal on their
  // own — without stripping these, a candidate from a totally unrelated
  // field can clear a meaningful roleOverlap purely by sharing the rank
  // word, not the actual role.
  "executive", "officer", "associate", "specialist", "manager", "lead", "senior", "junior",
  "intern", "trainee", "head", "chief",
]);

function tokenize(text: string, opts: { stripStopwords?: boolean } = {}): string[] {
  const words = (text || "").toLowerCase().match(/[a-z0-9+.#]+/g) || [];
  const stemmed = words.map(stem);
  return opts.stripStopwords ? stemmed.filter((w) => !STOPWORDS.has(w)) : stemmed;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/* Fraction of `candidateTokens` that also appears in `reqTokens` — i.e. how
   much of the candidate's (small) role/skill vocabulary the job posting
   covers. Dividing by reqTokens.size instead would crush this score for any
   non-trivial job description, since a real JD's token count dwarfs a
   candidate's target_role/skills token count almost by definition. */
function intersectionRatio(reqTokens: Set<string>, candidateTokens: Set<string>): number {
  if (reqTokens.size === 0 || candidateTokens.size === 0) return 0;
  let hits = 0;
  for (const t of candidateTokens) if (reqTokens.has(t)) hits++;
  return hits / candidateTokens.size;
}

/* resumeData is a StoredResume (see src/resumeParser.ts): fallback-type
   resumes carry a flat `skills` array, ai-type ones carry `topSkills`
   instead — read whichever the stored variant actually has. */
export function extractSkills(resumeData: unknown): string[] {
  if (!resumeData || typeof resumeData !== "object") return [];
  const record = resumeData as Record<string, unknown>;
  const skills = Array.isArray(record.skills) ? record.skills : record.topSkills;
  return Array.isArray(skills) ? skills.filter((s): s is string => typeof s === "string") : [];
}

export function extractResumeLocation(resumeData: unknown): string {
  if (!resumeData || typeof resumeData !== "object") return "";
  const loc = (resumeData as Record<string, unknown>).location;
  return typeof loc === "string" ? loc : "";
}

/** A profile with neither a target_role nor resume_data has nothing for
    roleOverlap/skillOverlap to match against — it's pure noise in a
    requirement's shortlist, not a real candidate to screen (see rankAndCap's
    hasRelevance filter below). Candidate-pool callers should exclude these
    before scoring rather than let them occupy slots in the capped, ranked
    result with a meaningless low score. */
export function hasMatchSignal(candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">): boolean {
  return !!(candidate.target_role && candidate.target_role.trim()) || candidate.resume_data != null;
}

function fitInputs(candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">, req: RequirementInput) {
  const reqTokens = new Set([
    ...tokenize(req.title, { stripStopwords: true }),
    ...tokenize(req.description, { stripStopwords: true }),
  ]);
  // The employer's structured skill picks are the single most reliable
  // signal for skillOverlap — free-text title/description often omit them
  // (a "Sales Executive" posting may never spell out "CRM" or "B2B Sales"
  // in prose even though the employer picked those exact skill chips), so
  // they're folded into the skill-matching token set on top of the prose.
  const reqSkillTokens = new Set([...reqTokens, ...(req.skills || []).flatMap((s) => tokenize(s))]);
  const roleTokens = new Set(tokenize(candidate.target_role || ""));
  const skillTokens = new Set(extractSkills(candidate.resume_data).flatMap((s) => tokenize(s)));

  const roleOverlap = intersectionRatio(reqTokens, roleTokens);
  const skillOverlap = intersectionRatio(reqSkillTokens, skillTokens);

  const reqLocation = req.location.toLowerCase();
  const candidateLocation = extractResumeLocation(candidate.resume_data).toLowerCase();
  const isRemote = reqLocation.includes("remote");
  // 2026-10-04: lowered the "can't tell" default from 0.6 to 0.4 — missing
  // location data isn't positive signal and shouldn't read as closer to a
  // real match (1) than a real mismatch (0.35). See the fitComponent weight
  // comment below for why this axis is capped low regardless.
  let locationFit = 0.4;
  if (isRemote) {
    locationFit = 1;
  } else if (reqLocation && candidateLocation) {
    const reqLocTokens = tokenize(reqLocation);
    locationFit = reqLocTokens.some((t) => candidateLocation.includes(t)) ? 1 : 0.35;
  }

  return { roleOverlap, skillOverlap, locationFit };
}

/* A candidate outside the requirement's experience band isn't automatically
   wrong — "min 2, max 5" doesn't hard-disqualify a 6-year candidate the way
   zero role/skill overlap should — so this is a penalty, not an exclusion,
   and a tolerance band absorbs boundary noise. Unknown experience (fallback-
   parsed resumes never populate yearsExperience) is treated as neutral: we
   have no basis to penalize what we can't read. */
function experienceFit(yearsExperience: number | null | undefined, min: number | null | undefined, max: number | null | undefined): number {
  if (yearsExperience == null || (min == null && max == null)) return 1;
  const tolerance = 1;
  const lo = (min ?? 0) - tolerance;
  const hi = (max ?? Infinity) + tolerance;
  return yearsExperience >= lo && yearsExperience <= hi ? 1 : 0.6;
}

/** Deterministic 0-100 fit score for one candidate against one requirement,
    plus the candidate's lifetime roster score (session-performance based,
    independent of this specific requirement). */
export function scoreCandidateMatch(candidate: CandidatePoolRow, req: RequirementInput): ScoredCandidate {
  const { roleOverlap, skillOverlap, locationFit } = fitInputs(candidate, req);

  const rosterScore = Math.round(clamp(candidate.avg_score ?? 50, 0, 100));
  const activityBoost = clamp(candidate.sessions_completed, 0, 10) / 10;
  const recencyPenalty = candidate.last_active_days_ago > 30 ? 0.85 : 1;
  const expFit = experienceFit(candidate.years_experience, req.experienceMin, req.experienceMax);

  /* Skill/role fit outweighs location — location moved from 0.15 to 0.08 so
     it can never meaningfully outrank real skill/role signal the way a
     neutral-default locationFit previously could. roleOverlap/skillOverlap
     absorb the difference (0.55->0.58, 0.30->0.34). */
  const fitComponent = roleOverlap * 0.58 + skillOverlap * 0.34 + locationFit * 0.08;
  /* Must come from actual role/skill overlap, never from locationFit alone —
     a candidate sharing the employer's city but nothing else about the job
     (e.g. a Design Engineer living in the same city as a Sales Executive
     opening) is not "relevant" to the role just because locationFit=1 can
     reach 0.15 (1 * 0.15) on its own and clear the blended floor below.

     2026-10-04: raised from "> 0" to a real ratio floor after production
     data showed a single generic or ambiguous shared token (e.g. a Senior
     Backend Engineer's "B2B Partner Integrations" skill matching a Sales
     Executive req's "B2B Sales" chip on the word "b2b"; a Data Analytics
     candidate's "Business Intelligence" matching the req description's
     "new business" on the word "business") was enough to pass ">0" even
     though it's one coincidental token diluted among a dozen unrelated
     ones. Reusing 0.15 — the same floor this scoring already treats as
     "the minimum fraction of a candidate's vocabulary worth crediting"
     elsewhere in this file — filters those out while still passing a
     candidate whose role/skills genuinely echo multiple requirement terms
     (a Sales Assistant Intern's target_role overlapping "sales", or a
     profile whose skills include "Sales & Service" / "Strategy & Market
     Expansion" alongside "Business Transformation"). */
  const RELEVANCE_RATIO_FLOOR = 0.15;
  const hasRelevance = roleOverlap >= RELEVANCE_RATIO_FLOOR || skillOverlap >= RELEVANCE_RATIO_FLOOR;
  /* rosterScore defaults to 50 (candidate.avg_score ?? 50) for anyone with
     zero completed practice sessions — a "neutral, unknown" placeholder,
     not evidence of being an average performer. Crediting that default as
     if it were real roster-performance evidence let a candidate with
     literally zero practice history (zero evidence, per a 2026-10-04
     employer report) outrank candidates who'd actually practiced and
     scored lower on avg_score but had real sessions behind that number.
     Only a candidate with at least one completed session gets any roster
     credit; the activity term is already naturally 0 for zero sessions. */
  const hasRosterEvidence = candidate.sessions_completed > 0;
  const rosterCredit = hasRelevance && hasRosterEvidence ? rosterScore * 0.2 + activityBoost * 10 : 0;
  const matchScore = Math.round(
    clamp(fitComponent * 70 + rosterCredit, 0, 100) * recencyPenalty * expFit,
  );

  const hasEvidence = candidate.resume_data != null || hasRosterEvidence;

  return {
    candidateId: candidate.id,
    matchScore: clamp(matchScore, 0, 100),
    rosterScore,
    hasRelevance,
    hasEvidence,
    meetsQualityBar: meetsQualityBar(candidate, req),
  };
}

/** Human-readable 0-100 read-outs of the same three inputs scoreCandidateMatch
    weighs internally, for a "why this score" breakdown in the UI. */
export function explainMatch(candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">, req: RequirementInput): MatchBreakdown {
  const { roleOverlap, skillOverlap, locationFit } = fitInputs(candidate, req);
  return {
    roleMatch: Math.round(clamp(roleOverlap, 0, 1) * 100),
    skillMatch: Math.round(clamp(skillOverlap, 0, 1) * 100),
    locationMatch: Math.round(clamp(locationFit, 0, 1) * 100),
  };
}

/** Grounded "why this matched" sentence for the candidate-facing Jobs tab —
    built only from real inputs (the requirement's actual skill list, the
    candidate's own resume skills, and the same breakdown explainMatch
    surfaces to employers), never a fabricated per-row line. */
export function describeMatch(
  candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">,
  req: RequirementInput,
  reqSkills: string[],
): string {
  const breakdown = explainMatch(candidate, req);
  const candidateSkills = extractSkills(candidate.resume_data);
  const reqSkillSet = new Set(reqSkills.map((s) => s.toLowerCase()));
  const overlapping = candidateSkills.filter((s) => reqSkillSet.has(s.toLowerCase()));

  const parts: string[] = [];
  if (breakdown.roleMatch >= 50) parts.push("your target role matches this opening");
  if (overlapping.length > 0) {
    parts.push(`you share ${overlapping.length} skill${overlapping.length === 1 ? "" : "s"} (${overlapping.slice(0, 3).join(", ")})`);
  }
  if (breakdown.locationMatch >= 100) parts.push("it fits your location");

  if (parts.length === 0) return "Matched on your overall profile and practice history.";
  return `Matched because ${parts.join(" and ")}.`;
}

export type RequirementMatchStatus = "ready" | "partial" | "zero";

/** A candidate is a "strong match" for a requirement at this matchScore or
    above — shared by classifyRequirementStatus (requirement-level outcome),
    the Jobs table's AI Screening / Top Matches / Strong Match summary
    (_employer-requirements-helpers.ts), and the requirement-detail page's
    ScoreChip / scoreTiers (src/employer/_atoms.tsx). Must stay in sync with
    those — a candidate the Jobs list calls "strong" but the detail page
    colors as merely "fair" is the exact bug this constant exists to avoid.

    2026-10-04: re-derived from a real-data recalibration, not picked. The
    old value (85) was set for a formula that let roster/activity carry an
    unrelated candidate to a high score regardless of real fit (see the
    fit-floor/skills/stopword fixes above) — under that formula 85 was
    reachable by noise, so it wasn't measuring quality at all. Re-scoring
    the 3 real production requirements against the full candidate pool with
    the corrected formula put every candidate with genuine direct-role or
    real-skill alignment at 38-70, and every candidate without it at 31 or
    below with a sharp drop to single digits past ~20 — including the
    requirement (Sales Executive) whose pool has no real salesperson, which
    correctly produces zero "strong" matches rather than a false one. 40
    sits just above that top cluster's floor. Revisit once the candidate
    pool grows enough to shift the distribution meaningfully. */
export const STRONG_MATCH_THRESHOLD = 40;

/** Absolute floor below which a scored candidate is dropped from the
    shortlist entirely, independent of the hasRelevance/hasEvidence floors
    above. Those two gate on *structural* signal (any role/skill token
    overlap at all, any resume/session on file) but say nothing about the
    final blended score — a candidate who just clears the relevance ratio
    floor (0.15) with no roster/activity credit still lands in the
    high single digits to low 20s (see the STRONG_MATCH_THRESHOLD doc
    comment above), which is a "found one shared word" result, not a
    reviewable match. Production reports (2026-10-07) showed employers
    being shown a "Top 20 of 27" shortlist with scores as low as 13% —
    technically relevant/evidenced per the structural floors, but not a
    match any employer should be led to believe is worth reviewing.
    25 sits below genuine-but-weak fits (the Sales Assistant Intern /
    "modest overlap" cases in the test suite score 30+) and above the
    single-digit-to-20s noise band the recalibration above found. */
export const MIN_MATCH_SCORE_FLOOR = 25;

/** Classifies the overall requirement outcome from its scored candidates.
    `matches` is expected to already be floor-filtered (rankAndCap), so
    "zero" means literally no candidate cleared that floor — not merely
    "no strong (85+) match" — otherwise a requirement with several real,
    reviewable matches gets mislabeled "zero" and the employer UI
    (which keys the candidates table's visibility off this status) hides
    a non-empty shortlist entirely. */
export function classifyRequirementStatus(matches: Array<{ matchScore: number }>): RequirementMatchStatus {
  if (matches.length === 0) return "zero";
  const strong = matches.filter((m) => m.matchScore >= STRONG_MATCH_THRESHOLD).length;
  if (strong >= 3) return "ready";
  return "partial";
}

/** Keeps only candidates worth surfacing, ranked best first, capped so a
    requirement never returns an unbounded shortlist.

    2026-10-04: filters out candidates with no real relevance (hasRelevance
    false — zero meaningful role/skill/location signal) before capping. A
    prior version capped first with no floor, which meant a requirement
    with only 2 genuinely relevant candidates in the pool still padded the
    shortlist to 20 by scraping in unrelated profiles (e.g. software
    engineers shortlisted for a Sales Executive opening) sorted purely by
    roster/activity noise — exactly the "forced candidate" failure mode
    employers shouldn't see. A requirement can now legitimately return
    fewer than `cap` candidates, including zero.

    2026-10-04: also filters out candidates with no real evidence
    (hasEvidence false — no resume on file and zero completed practice
    sessions), independent of hasRelevance. A candidate can clear the
    relevance floor on a loose target_role token match alone while having
    nothing else behind the profile (no resume, no sessions) — that's a
    name and a guessed score an employer can't actually screen, not a
    reviewable match. These are pool noise the same way irrelevant
    candidates are, just along a different axis.

    Also enforces MIN_MATCH_SCORE_FLOOR: a candidate can clear the
    structural hasRelevance/hasEvidence floors on a single weak signal and
    still blend to a score in the single digits to low 20s — real for the
    structural checks, but not a score worth presenting as part of a
    "Top N matches" list (see that constant's doc comment).

    Returns `totalMatched` alongside the capped `ranked` list — the true
    size of the floor-filtered pool *before* the `cap` slice, so a caller
    can tell "Top 20" apart from "20 (all of them)" instead of reporting
    the post-cap count as if it were the whole matched pool. */
export function rankAndCap(scored: ScoredCandidate[], cap = 20): { ranked: ScoredCandidate[]; totalMatched: number } {
  const floorFiltered = scored
    .filter((s) => s.hasRelevance && s.hasEvidence && s.meetsQualityBar !== false && s.matchScore >= MIN_MATCH_SCORE_FLOOR)
    .sort((a, b) => b.matchScore - a.matchScore);
  return { ranked: floorFiltered.slice(0, cap), totalMatched: floorFiltered.length };
}
