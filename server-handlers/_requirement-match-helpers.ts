/* Pure scoring logic for the employer talent-roster matching pass.
   Deterministic heuristic (role/skill token overlap + roster performance),
   not LLM-based — kept cheap and auditable for this pass. LLM-based
   re-ranking (see analyze-jd-match.ts's callLLM precedent) is a possible
   follow-up, not implemented here. */

import { canonicalSkillToken, canonicalizePhrases, skillFamilyKeys } from "../src/skillNormalize";
import { INDIAN_CITIES } from "../src/_indian-cities";

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
  /** Band + STAR-completeness %% from extractReadinessBand/
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
  /** The employer's "Other skills" (custom_skill_sets). Not part of the core
      skill match: only a small soft boost (see CUSTOM_SKILL_BOOST_MAX) for a
      candidate who is already relevant on role/skills. */
  customSkills?: string[];
  /** "remote" makes location neutral, same as writing Remote in the location. */
  workMode?: string | null;
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
  /** False when the candidate lacks the evidence a "strong" match needs: the
      requirement's skills (or, with none listed, its title) are not covered
      well enough, or there is neither a graded role-matched practice session
      nor an overlap with the candidate's real resume skill list. Such a
      candidate can still be a reviewable match but never a "strong" one: see
      capUnsupportedStrong. Optional for the same fixture-compat reason as
      meetsQualityBar. */
  skillsSupportStrong?: boolean;
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
  /** 100 inside the requested experience band (±1y), 60 outside it; null when
      no band was set or the resume carries no years. Absent unless the caller
      supplied the candidate's years (see explainMatch). */
  experienceMatch?: number | null;
  /** Server-graded practice sessions for THIS role (what scoring credits),
      not every graded session the candidate has ever done. */
  verifiedSessions?: number;
  /** Term-by-term reconstruction of the stored score. Present only when the
      caller supplied the full candidate pool row (see explainMatch). */
  components?: MatchScoreComponents;
}

/** The terms scoring multiplies together, so a breakdown can be checked
    against the number of record: round(clamp(fitPoints + rosterCredit +
    customBoost) * recencyMultiplier * experienceMultiplier), strong-capped,
    is deterministicScore, and blendedScore is what is stored. */
export interface MatchScoreComponents {
  fitPoints: number;
  rosterCredit: number;
  customBoost: number;
  recencyMultiplier: number;
  experienceMultiplier: number;
  deterministicScore: number;
  /** The model's raw opinion, or null when none was available for this match. */
  llmScore: number | null;
  blendedScore: number;
}

/** Weight the model's opinion carries against the deterministic score. */
export const LLM_BLEND_WEIGHT = 0.35;
const DETERMINISTIC_BLEND_WEIGHT = 0.65;

export function blendDeterministicWithLlm(deterministicScore: number, llmScore: number | null | undefined): number {
  if (llmScore == null) return deterministicScore;
  return Math.round(deterministicScore * DETERMINISTIC_BLEND_WEIGHT + llmScore * LLM_BLEND_WEIGHT);
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
  const words = canonicalizePhrases(text || "").match(/[a-z0-9+.#]+/g) || [];
  const stemmed = words.map((w) => stem(canonicalSkillToken(w)));
  return opts.stripStopwords ? stemmed.filter((w) => !STOPWORDS.has(w)) : stemmed;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/* Fraction of the REQUIREMENT's tokens that the candidate covers (capped at
   1 by construction). Normalising by the candidate's own token count let a
   sparse profile ("Engineer") score 1.0 against anything containing that one
   word while a thorough profile was diluted; dividing by the requirement's
   tokens rewards actually covering what the employer asked for. Callers pass
   only the title and the skills list as requirement tokens (never the whole
   JD), so the denominator stays small and stable. */
function intersectionHits(reqTokens: Set<string>, candidateTokens: Set<string>): number {
  let hits = 0;
  for (const t of reqTokens) if (candidateTokens.has(t)) hits++;
  return hits;
}

function intersectionRatio(reqTokens: Set<string>, candidateTokens: Set<string>): number {
  if (reqTokens.size === 0 || candidateTokens.size === 0) return 0;
  return Math.min(1, intersectionHits(reqTokens, candidateTokens) / reqTokens.size);
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

const MAX_FREE_TEXT_LOCATION = 40;

/* Stored locations come from resume parsing and sometimes carry a neighbouring
   line ("Full Stack Developer Vikaspuri, New Delhi"). Reduce to the known city
   so the candidates location filter lists one clean entry per city. */
export function normalizeLocation(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  let best = "";
  for (const city of INDIAN_CITIES) {
    if (city.length <= best.length || !/^[a-z -]+$/.test(city)) continue;
    const at = lower.indexOf(city);
    if (at < 0) continue;
    const before = lower[at - 1];
    const after = lower[at + city.length];
    if ((before && /[a-z]/.test(before)) || (after && /[a-z]/.test(after))) continue;
    best = city;
  }
  if (best) return best.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return text.length <= MAX_FREE_TEXT_LOCATION ? text : "";
}

export function extractResumeLocation(resumeData: unknown): string {
  if (!resumeData || typeof resumeData !== "object") return "";
  const loc = (resumeData as Record<string, unknown>).location;
  return typeof loc === "string" ? normalizeLocation(loc) : "";
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

/** Minimum covered required skills for a "strong" match, or this share of the list. */
export const STRONG_MIN_SKILLS_COVERED = 2;
export const STRONG_MIN_SKILLS_SHARE = 0.5;

/** True when the resume carries something a reviewer could actually read: a
    skill list, an experience history, a summary or a years-of-experience
    figure. A bare `{}` (a parse that produced nothing) is not evidence. */
export function hasResumeContent(resumeData: unknown): boolean {
  if (!resumeData || typeof resumeData !== "object") return false;
  const r = resumeData as Record<string, unknown>;
  if (extractSkills(resumeData).length > 0) return true;
  if (Array.isArray(r.experience) && r.experience.length > 0) return true;
  if (typeof r.summary === "string" && r.summary.trim()) return true;
  return typeof r.yearsExperience === "number" && Number.isFinite(r.yearsExperience);
}

/* Token groups the employer asked for: one group per listed skill, or, when
   no skills are listed, one group made of the title's content words. Every
   "does the candidate cover what was asked" check runs against these, so a
   requirement with 0 or 1 skills can no longer skip the check altogether. */
function requiredSkillUnits(skills: string[] | undefined, title: string | undefined): string[][] {
  const units = (skills || []).map((s) => tokenize(s)).filter((t) => t.length > 0);
  if (units.length > 0) return units;
  const titleTokens = tokenize(title || "", { stripStopwords: true });
  return titleTokens.length > 0 ? [titleTokens] : [];
}

/* A multi-word unit counts when at least half its tokens appear, so
   "B2B Sales" is matched by "Sales" but not by an unrelated "B2B". */
function unitsCovered(have: Set<string>, units: string[][]): number {
  let covered = 0;
  for (const tokens of units) {
    if (tokens.filter((t) => have.has(t)).length / tokens.length >= 0.5) covered++;
  }
  return covered;
}

/* Tokens the candidate's role and skills stand for, plus the generic family
   each specific skill belongs to ("PostgreSQL" also counts as "SQL"), so a
   posting that asks for the family is met by any member. Family keys are put
   through the same canonicalise-and-stem path as unit tokens or they would
   never compare equal. */
function resumeSkillTokens(resumeData: unknown): Set<string> {
  const skills = extractSkills(resumeData);
  const have = new Set(skills.flatMap((s) => tokenize(s)));
  for (const skill of skills) for (const family of skillFamilyKeys(skill)) for (const t of tokenize(family)) have.add(t);
  return have;
}

function candidateSkillTokens(candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">): Set<string> {
  return new Set([...tokenize(candidate.target_role || ""), ...resumeSkillTokens(candidate.resume_data)]);
}

/** How many of the employer's listed skills the candidate's skills or target
    role cover. A multi-word skill counts when at least half its tokens appear,
    so "B2B Sales" is matched by "Sales" but not by an unrelated "B2B". */
export function countRequiredSkillsCovered(
  candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">,
  requiredSkills: string[],
): number {
  const have = candidateSkillTokens(candidate);
  return unitsCovered(have, requiredSkills.map((s) => tokenize(s)).filter((t) => t.length > 0));
}

/** The skill gate for a "strong" match. It applies whatever the skill count:
    2+ listed skills need 2 covered (or half the list); 1 listed skill must be
    covered; with none listed the title's content words stand in for the
    list. With nothing to check against at all (no skills, title only filler
    words) the candidate cannot demonstrate overlap, so is never strong.
    `title` is optional only for callers that predate it. */
export function skillsSupportStrong(
  candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">,
  requiredSkills: string[] | undefined,
  title?: string,
): boolean {
  const units = requiredSkillUnits((requiredSkills || []).filter((s) => s.trim()), title);
  if (units.length === 0) return false;
  const have = candidateSkillTokens(candidate);
  const covered = unitsCovered(have, units);
  return covered >= STRONG_MIN_SKILLS_COVERED || covered / units.length >= STRONG_MIN_SKILLS_SHARE;
}

/** Evidence a "strong" match must rest on that the candidate did not simply
    write about themselves: a server-graded practice session for this role
    (sessions_completed is role-matched and graded-only by construction, see
    computeTrustedSessionStats), or an overlap between the requirement and the
    skills in their parsed resume. target_role is self-declared free text, so
    it never counts here, and the JD text is never the source of the tokens. */
export function hasStrongEvidence(
  candidate: Pick<CandidatePoolRow, "resume_data" | "sessions_completed">,
  requiredSkills: string[] | undefined,
  title?: string,
): boolean {
  if (candidate.sessions_completed > 0) return true;
  const units = requiredSkillUnits((requiredSkills || []).filter((s) => s.trim()), title);
  const resumeTokens = resumeSkillTokens(candidate.resume_data);
  return unitsCovered(resumeTokens, units) >= 1;
}

/** Most a candidate can gain from covering the employer's "Other skills". */
export const CUSTOM_SKILL_BOOST_MAX = 3;

/** Keeps a candidate whose skills don't back a high score out of the Strong tier. */
export function capUnsupportedStrong(score: number, supported: boolean | undefined): number {
  return supported === false ? Math.min(score, STRONG_MATCH_THRESHOLD - 1) : score;
}

/* Words that appear in many place names without identifying one ("New Delhi"
   vs "New York"); ignored unless they are all the requirement names. */
const GENERIC_LOCATION_TOKENS = new Set(["new", "india", "city", "state", "district", "north", "south", "east", "west"]);

/** Whole-token location match. A substring test let "new" match "renewable" and
    a "New Delhi" opening match any candidate in "New York". Both sides are
    tokenised the same way, so inflection folds equally and only complete words
    can overlap. */
export function locationsOverlap(requirementLocation: string, candidateLocation: string): boolean {
  const reqTokens = tokenize(requirementLocation);
  const specific = reqTokens.filter((t) => !GENERIC_LOCATION_TOKENS.has(t));
  const wanted = specific.length > 0 ? specific : reqTokens;
  if (wanted.length === 0) return false;
  const have = new Set(tokenize(candidateLocation));
  return wanted.some((t) => have.has(t));
}

function fitInputs(candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">, req: RequirementInput) {
  /* Requirement tokens come ONLY from the title and the employer's skill
     picks, never the JD description. A pasted JD is hundreds of words of
     boilerplate: folding it in made the denominator huge (or, before the
     ratio was flipped, let any shared word like "business" count as skill
     evidence). The skill chips are the reliable structured signal; the title
     carries the role. */
  const titleTokens = new Set(tokenize(req.title, { stripStopwords: true }));
  const reqTokens = titleTokens;
  const reqSkillTokens = new Set([...titleTokens, ...(req.skills || []).flatMap((s) => tokenize(s))]);
  const roleTokens = new Set(tokenize(candidate.target_role || ""));
  const skillTokens = new Set(extractSkills(candidate.resume_data).flatMap((s) => tokenize(s)));

  const roleOverlap = intersectionRatio(reqTokens, roleTokens);
  const skillOverlap = intersectionRatio(reqSkillTokens, skillTokens);
  const skillHits = intersectionHits(reqSkillTokens, skillTokens);

  const reqLocation = req.location.toLowerCase();
  const candidateLocation = extractResumeLocation(candidate.resume_data).toLowerCase();
  const isRemote = reqLocation.includes("remote") || req.workMode === "remote";
  // 2026-10-04: lowered the "can't tell" default from 0.6 to 0.4 — missing
  // location data isn't positive signal and shouldn't read as closer to a
  // real match (1) than a real mismatch (0.35). See the fitComponent weight
  // comment below for why this axis is capped low regardless.
  let locationFit = 0.4;
  if (isRemote) {
    locationFit = 1;
  } else if (reqLocation && candidateLocation) {
    locationFit = locationsOverlap(reqLocation, candidateLocation) ? 1 : 0.35;
  }

  return { roleOverlap, skillOverlap, skillHits, locationFit };
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

/** Every term that feeds the deterministic score, so the live scorer and the
    employer-facing "why this score" breakdown read one computation instead of
    two that can drift apart. */
interface ScoreParts {
  roleOverlap: number;
  skillOverlap: number;
  locationFit: number;
  rosterScore: number;
  hasRelevance: boolean;
  hasRosterEvidence: boolean;
  supportsStrong: boolean;
  /** 0-100 before the recency/experience multipliers and the strong-cap. */
  fitPoints: number;
  rosterCredit: number;
  customBoost: number;
  recencyPenalty: number;
  expFit: number;
  matchScore: number;
}

function computeScoreParts(candidate: CandidatePoolRow, req: RequirementInput): ScoreParts {
  const { roleOverlap, skillOverlap, skillHits, locationFit } = fitInputs(candidate, req);

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
  /* The ratio is now over the REQUIREMENT's tokens, so one coincidental word
     out of a long skill list (the "b2b" case above, 1 of 6) would clear the
     floor on its own. A skill-only match therefore needs two distinct hits,
     or a single hit that is a real share (>= 1/3) of a short requirement. */
  const SINGLE_HIT_MIN_SHARE = 1 / 3;
  const skillRelevant = skillOverlap >= RELEVANCE_RATIO_FLOOR && (skillHits >= 2 || skillOverlap >= SINGLE_HIT_MIN_SHARE);
  const hasRelevance = roleOverlap >= RELEVANCE_RATIO_FLOOR || skillRelevant;
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
  // "Strong" must rest on more than self-declared text: the skill gate applies
  // at any skill count, and there must be a graded role-matched session or a
  // real resume-skill overlap (see hasStrongEvidence).
  const supportsStrong = skillsSupportStrong(candidate, req.skills, req.title) && hasStrongEvidence(candidate, req.skills, req.title);
  /* Employer's "Other skills": at most CUSTOM_SKILL_BOOST_MAX points, and only
     for a candidate who already clears the relevance floor, so it can break a
     tie but never create a match. */
  const customSkills = (req.customSkills || []).filter((s) => s.trim());
  const customBoost = hasRelevance && customSkills.length > 0
    ? CUSTOM_SKILL_BOOST_MAX * (countRequiredSkillsCovered(candidate, customSkills) / customSkills.length)
    : 0;
  const fitPoints = fitComponent * 70;
  const matchScore = clamp(capUnsupportedStrong(
    Math.round(clamp(fitPoints + rosterCredit + customBoost, 0, 100) * recencyPenalty * expFit),
    supportsStrong,
  ), 0, 100);
  return {
    roleOverlap, skillOverlap, locationFit, rosterScore, hasRelevance, hasRosterEvidence, supportsStrong,
    fitPoints, rosterCredit, customBoost, recencyPenalty, expFit, matchScore,
  };
}

/** Deterministic 0-100 fit score for one candidate against one requirement,
    plus the candidate's lifetime roster score (session-performance based,
    independent of this specific requirement). */
export function scoreCandidateMatch(candidate: CandidatePoolRow, req: RequirementInput): ScoredCandidate {
  const parts = computeScoreParts(candidate, req);
  // A bare `{}` resume is not evidence; a parsed resume with content, or a
  // graded session, is.
  const hasEvidence = hasResumeContent(candidate.resume_data) || parts.hasRosterEvidence;

  return {
    candidateId: candidate.id,
    matchScore: parts.matchScore,
    rosterScore: parts.rosterScore,
    hasRelevance: parts.hasRelevance,
    hasEvidence,
    meetsQualityBar: meetsQualityBar(candidate, req),
    skillsSupportStrong: parts.supportsStrong,
  };
}

/** Human-readable 0-100 read-outs of the inputs scoreCandidateMatch weighs
    internally, for a "why this score" breakdown in the UI. `signals` carries
    what only the caller knows (parsed years of experience, count of
    role-matched graded sessions); without it those two fields are omitted
    rather than guessed. */
export function explainMatch(
  candidate: Pick<CandidatePoolRow, "target_role" | "resume_data">,
  req: RequirementInput,
  signals: {
    yearsExperience?: number | null;
    verifiedSessions?: number;
    /** Full pool row (role-matched session stats, last-active days, years).
        When given, `components` is filled from the same computation scoring
        runs, so the breakdown reproduces the stored score. */
    pool?: CandidatePoolRow;
    /** Raw model score persisted with the match, if any. */
    llmScore?: number | null;
  } = {},
): MatchBreakdown {
  const { roleOverlap, skillOverlap, locationFit } = fitInputs(candidate, req);
  const out: MatchBreakdown = {
    roleMatch: Math.round(clamp(roleOverlap, 0, 1) * 100),
    skillMatch: Math.round(clamp(skillOverlap, 0, 1) * 100),
    locationMatch: Math.round(clamp(locationFit, 0, 1) * 100),
  };
  if (signals.yearsExperience !== undefined) {
    const hasBand = req.experienceMin != null || req.experienceMax != null;
    // null = no band set or experience unreadable, i.e. nothing to compare.
    out.experienceMatch = signals.yearsExperience == null || !hasBand
      ? null
      : Math.round(experienceFit(signals.yearsExperience, req.experienceMin, req.experienceMax) * 100);
  }
  if (signals.verifiedSessions !== undefined) out.verifiedSessions = signals.verifiedSessions;
  if (signals.pool) {
    const parts = computeScoreParts(signals.pool, req);
    const llmScore = signals.llmScore ?? null;
    out.components = {
      fitPoints: Math.round(parts.fitPoints * 10) / 10,
      rosterCredit: Math.round(parts.rosterCredit * 10) / 10,
      customBoost: Math.round(parts.customBoost * 10) / 10,
      recencyMultiplier: parts.recencyPenalty,
      experienceMultiplier: parts.expFit,
      deterministicScore: parts.matchScore,
      llmScore,
      blendedScore: capUnsupportedStrong(blendDeterministicWithLlm(parts.matchScore, llmScore), parts.supportsStrong),
    };
  }
  return out;
}

/** Strong / Good / Possible label for a match score, for display next to the
    percentage. Thresholds are the shared STRONG_MATCH_THRESHOLD and
    FAIR_MATCH_SCORE so the label can never disagree with the tier colour. */
export const FAIR_MATCH_SCORE = 20;
export function matchBandLabel(score: number): "Strong" | "Good" | "Possible" {
  return score >= STRONG_MATCH_THRESHOLD ? "Strong" : score >= FAIR_MATCH_SCORE ? "Good" : "Possible";
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

/** Candidates an employer is shown per requirement. */
export const MATCH_SHORTLIST_CAP = 20;
/** Candidates the model re-ranks before the shortlist is cut to the cap, so a
    candidate it rates highly can climb in from just below the deterministic top. */
export const LLM_RERANK_WINDOW = 40;

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
export function rankAndCap(scored: ScoredCandidate[], cap = MATCH_SHORTLIST_CAP): { ranked: ScoredCandidate[]; totalMatched: number } {
  const floorFiltered = scored
    .filter((s) => s.hasRelevance && s.hasEvidence && s.meetsQualityBar !== false && s.matchScore >= MIN_MATCH_SCORE_FLOOR)
    // Equal scores order by candidate id so the cap boundary picks the same
    // people on every scan instead of whoever the pool read returned first.
    .sort((a, b) => b.matchScore - a.matchScore || (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0));
  return { ranked: floorFiltered.slice(0, cap), totalMatched: floorFiltered.length };
}


/** Stable fingerprint of every requirement field that changes who matches.
    The cron and the create/edit path capture it before a scan and compare it
    right before writing, so a scan started on stale criteria can't overwrite
    the shortlist an employer's edit already produced. Text is trimmed and
    skills are order-insensitive so cosmetic edits don't read as changes. */
export function requirementCriteriaFingerprint(req: RequirementInput): string {
  const list = (xs: string[] | undefined | null) => (xs || []).map((x) => x.trim().toLowerCase()).filter(Boolean).sort();
  return JSON.stringify([
    (req.title || "").trim(),
    (req.location || "").trim(),
    (req.description || "").trim(),
    list(req.skills),
    list(req.customSkills),
    req.experienceMin ?? null,
    req.experienceMax ?? null,
    req.minReadinessBand ?? null,
    req.minStarCompleteness ?? null,
    req.employmentType ?? null,
    req.durationWeeks ?? null,
    req.hoursPerWeek ?? null,
    req.workMode ?? null,
  ]);
}

/* ── Model prompt inputs and their fingerprints ── */

/** How much of the posting description the model prompt includes. */
export const DESCRIPTION_PROMPT_CHARS = 2000;

const MAX_PROMPT_SKILLS = 20;

/** One candidate's line in the model prompt. */
/* Candidate-authored text reaches the LLM prompt. Strip control characters
   and line breaks, collapse whitespace and cap the length so a profile cannot
   smuggle in a multi-line instruction block. */
const PROMPT_FIELD_CHARS = 80;
export function promptSafe(value: unknown, max = PROMPT_FIELD_CHARS): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function candidateSummary(c: CandidatePoolRow): string {
  const skills = extractSkills(c.resume_data).slice(0, MAX_PROMPT_SKILLS).map((k) => promptSafe(k, 40)).filter(Boolean);
  const years = typeof c.years_experience === "number" && Number.isFinite(c.years_experience) ? c.years_experience : null;
  // Real mock-interview history is the only server-verified signal here; the
  // prompt asks the model to treat its absence as "no evidence".
  return JSON.stringify({
    id: c.id,
    targetRole: promptSafe(c.target_role) || "not specified",
    industry: promptSafe(c.industry) || "unspecified",
    yearsExperience: years,
    location: promptSafe(extractResumeLocation(c.resume_data)) || "unspecified",
    skills,
    completedPracticeSessions: c.sessions_completed,
    avgPracticeScore: c.sessions_completed > 0 ? c.avg_score ?? null : null,
  });
}

function fnv1a(input: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/* Two differently-seeded 32-bit passes: a stored score is trusted only when
   this matches, and one 32-bit hash is thin for that. */
function shortHash(input: string): string {
  return fnv1a(input, 0x811c9dc5) + fnv1a(input, 0x9747b28c);
}

/** Identity of every requirement field the model prompt reads. A stored model
 *  score is only reusable while this is unchanged. */
export function llmCriteriaFingerprint(req: RequirementInput): string {
  return shortHash(JSON.stringify([
    req.title ?? "", req.location ?? "", (req.description ?? "").slice(0, DESCRIPTION_PROMPT_CHARS),
    req.skills ?? [], req.experienceMin ?? null, req.experienceMax ?? null,
    req.employmentType ?? null, req.durationWeeks ?? null, req.hoursPerWeek ?? null,
  ]));
}

/** Identity of everything the model sees about one candidate (role, skills,
 *  experience, location, practice evidence). profiles carries no resume
 *  updated_at, so the content the prompt is built from is the stamp. */
export function llmProfileStamp(c: CandidatePoolRow): string {
  return shortHash(candidateSummary({ ...c, id: "" }));
}

