/* Pure request-shaping/aggregation pieces extracted from
 * employer-requirements.ts so they're unit-tested against the real code
 * rather than an inline copy. The scoring heuristic itself lives in
 * _requirement-match-helpers.ts.
 */

export interface RequirementRow {
  id: string;
  title: string;
  location: string;
  notice_period_pref: string;
  status: string;
  experience_min: number | null;
  experience_max: number | null;
  due_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  locations: string[];
  open_positions: number | null;
  work_mode: string | null;
  skills: string[];
  responsibilities: string | null;
  nice_to_have: string | null;
  preferred_industry: string | null;
  preferred_colleges: string[];
  target_companies: string[];
  perks_and_benefits: string[];
  employment_type: string | null;
  salary_type: string | null;
  preferred_domain: string | null;
  work_schedule: string | null;
  availability: string | null;
  relevant_experience: string | null;
  portfolio_required: boolean;
  custom_skill_sets: string[];
  created_at: string;
  stage: string;
  duration_weeks: number | null;
  hours_per_week: number | null;
}

/** The four hiring-pipeline stages an employer can move a posting through,
 *  independent of `status` (AI matching/generation lifecycle). */
export const REQUIREMENT_STAGES = ["ai_matching", "ready_for_review", "interviewing", "hired"] as const;
export type RequirementStage = (typeof REQUIREMENT_STAGES)[number];

/** Validated read of a client-supplied stage value — anything outside the
 *  four known stages returns null so callers can reject the request. */
export function asBoundedStage(v: unknown): RequirementStage | null {
  return typeof v === "string" && (REQUIREMENT_STAGES as readonly string[]).includes(v) ? (v as RequirementStage) : null;
}

/** Validated + length-capped read of a client-supplied field; returns "" for
 *  anything that isn't a string, so callers never propagate non-string JSON
 *  (numbers, objects, null) into a Postgres text column. */
export function asBoundedString(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Validated read of a client-supplied tag list (locations, skills, target
 *  companies, …): keeps only non-empty strings, trims + length-caps each
 *  entry, and caps the list length so a malicious payload can't balloon the
 *  Postgres array column. */
export function asBoundedStringArray(v: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const cleaned: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, maxItemLen);
    if (trimmed.length > 0) cleaned.push(trimmed);
    if (cleaned.length >= maxItems) break;
  }
  return cleaned;
}

/** A requirement needs a real title, at least one location, and a real JD
 *  before it's worth scoring against the candidate pool — the description
 *  is what the LLM diffs against each candidate's resume, so a token
 *  placeholder produces a useless JD-vs-candidate report. */
export function isValidRequirementInput(title: string, locations: string[], description: string): boolean {
  return title.length >= 2 && locations.length >= 1 && description.trim().length >= 20;
}

/** Validated read of a client-supplied open-positions count: whole numbers
 *  only, clamped to a plausible 1–500 range. Returns null for anything else
 *  so it stores as a real SQL NULL, not a fabricated default. */
export function asBoundedOpenPositions(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < 1 || v > 500) return null;
  return v;
}

/** Validated read of a client-supplied work mode: must be one of the three
 *  values the DB check constraint allows. Returns null for anything else so
 *  the column falls back to its own default rather than storing garbage. */
export function asBoundedWorkMode(v: unknown): "remote" | "onsite" | "hybrid" | null {
  return v === "remote" || v === "onsite" || v === "hybrid" ? v : null;
}

/** Validated read of a client-supplied employment type: must be one of the
 *  four values the DB check constraint allows. Returns null for anything
 *  else so the column falls back to its own default rather than storing
 *  garbage. */
export function asBoundedEmploymentType(v: unknown): "full-time" | "part-time" | "contract" | "internship" | null {
  return v === "full-time" || v === "part-time" || v === "contract" || v === "internship" ? v : null;
}

/** Validated read of a client-supplied salary type: must be one of the
 *  three values the DB check constraint allows. Returns null for anything
 *  else so the column falls back to its own default rather than storing
 *  garbage. */
export function asBoundedSalaryType(v: unknown): "per-month" | "fixed" | "per-annum" | null {
  return v === "per-month" || v === "fixed" || v === "per-annum" ? v : null;
}

/** Validated read of a client-supplied boolean flag (e.g. "portfolio
 *  required"): anything other than a real boolean is treated as false
 *  rather than propagating a truthy non-boolean into the column. */
export function asBoundedBoolean(v: unknown): boolean {
  return v === true;
}

/** Validated read of a client-supplied years-of-experience field: whole
 *  numbers only, clamped to a plausible 0–40 range. Returns null for
 *  anything else so it stores as a real SQL NULL, not a fabricated 0. */
export function asBoundedExperience(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < 0 || v > 40) return null;
  return v;
}

/** Validated read of a client-supplied due date: must be a real calendar
 *  date in strict YYYY-MM-DD form. Returns null for anything else — a
 *  malformed date is treated as "no due date", not a parse error. */
export function asBoundedDueDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : v;
}

/** Validated read of a client-supplied budget field: whole numbers only.
 *  The unit depends on salaryType — "per-annum" stores whole INR lakhs
 *  (clamped 0–1000, e.g. 12 = ₹12 LPA); "per-month"/"fixed" store a raw
 *  INR amount (clamped 0–1,00,00,000, e.g. 80000 = ₹80,000). Returns null
 *  for anything else so it stores as a real SQL NULL, not a fabricated 0. */
export function asBoundedBudget(v: unknown, salaryType: "per-month" | "fixed" | "per-annum" = "per-annum"): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return null;
  const max = salaryType === "per-annum" ? 1000 : 1_00_00_000;
  if (v < 0 || v > max) return null;
  return v;
}

/** Validated read of a client-supplied contract/project duration, in whole
 *  weeks: clamped to a plausible 1–104 range. Returns null for anything
 *  else so it stores as a real SQL NULL, not a fabricated value. */
export function asBoundedDurationWeeks(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < 1 || v > 104) return null;
  return v;
}

/** Validated read of a client-supplied weekly-hours commitment: clamped to
 *  a plausible 1–80 range. Returns null for anything else so it stores as
 *  a real SQL NULL, not a fabricated value. */
export function asBoundedHoursPerWeek(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < 1 || v > 80) return null;
  return v;
}

/** Jobs-table "AI Screening" summary for one requirement — evaluated count,
 *  score spread, and the strong-match (>= STRONG_MATCH_THRESHOLD) subset
 *  used for the Top Matches / Strong Match columns. */
export interface StrongMatchCandidate {
  id: string;
  name: string;
  initials: string;
  yearsExperience: number | null;
  skills: string[];
}

export interface AiScreeningSummary {
  evaluated: number;
  scoreLow: number | null;
  scoreHigh: number | null;
  topMatches: number;
  strongAvgScore: number | null;
  strongMatchInitials: string[];
  strongMatchExtra: number;
  strongMatches: StrongMatchCandidate[];
}

export const EMPTY_AI_SCREENING: AiScreeningSummary = {
  evaluated: 0,
  scoreLow: null,
  scoreHigh: null,
  topMatches: 0,
  strongAvgScore: null,
  strongMatchInitials: [],
  strongMatchExtra: 0,
  strongMatches: [],
};

/** How many strong-match avatar chips the Jobs table shows before folding
 *  the rest into a "+N" overflow chip. */
const STRONG_AVATAR_CAP = 2;

export interface RequirementMatchStats {
  evaluated: number;
  scoreLow: number | null;
  scoreHigh: number | null;
  topMatches: number;
  strongAvgScore: number | null;
  topCandidateIds: string[];
  strongMatchExtra: number;
}

/** Groups requirement_matches rows by requirement and reduces each group to
 *  the stats the Jobs table's AI Screening column needs. Candidate names
 *  aren't resolved here — callers batch-fetch names for topCandidateIds
 *  only, then pass the result to buildAiScreeningByRequirement. */
export function computeMatchStats(
  matchRows: Array<{ requirement_id: string; candidate_user_id: string; match_score: number }>,
  strongThreshold: number,
): Map<string, RequirementMatchStats> {
  const byRequirement = new Map<string, Array<{ candidate_user_id: string; match_score: number }>>();
  for (const m of matchRows) {
    const existing = byRequirement.get(m.requirement_id);
    if (existing) existing.push(m);
    else byRequirement.set(m.requirement_id, [m]);
  }

  const stats = new Map<string, RequirementMatchStats>();
  for (const [requirementId, rows] of byRequirement) {
    const scores = rows.map((r) => r.match_score);
    const strong = rows
      .filter((r) => r.match_score >= strongThreshold)
      .sort((a, b) => b.match_score - a.match_score);
    const strongAvgScore =
      strong.length > 0 ? Math.round(strong.reduce((sum, r) => sum + r.match_score, 0) / strong.length) : null;

    stats.set(requirementId, {
      evaluated: rows.length,
      scoreLow: Math.min(...scores),
      scoreHigh: Math.max(...scores),
      topMatches: strong.length,
      strongAvgScore,
      topCandidateIds: strong.slice(0, STRONG_AVATAR_CAP).map((r) => r.candidate_user_id),
      strongMatchExtra: Math.max(0, strong.length - STRONG_AVATAR_CAP),
    });
  }
  return stats;
}

/** First letters of up to the first two words of a name, for an avatar-chip
 *  initial — "?" for a blank/unknown name rather than an empty chip. */
export function nameInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

/** Resolves each requirement's strong-match candidate IDs into display
 *  initials and hover-card detail, once their profiles have been
 *  batch-fetched (see buildStrongMatchDetailsById). */
export function buildAiScreeningByRequirement(
  stats: Map<string, RequirementMatchStats>,
  detailsById: Map<string, Omit<StrongMatchCandidate, "id" | "initials">>,
): Map<string, AiScreeningSummary> {
  const result = new Map<string, AiScreeningSummary>();
  for (const [requirementId, s] of stats) {
    const strongMatches = s.topCandidateIds.map((id): StrongMatchCandidate => {
      const detail = detailsById.get(id) ?? { name: "", yearsExperience: null, skills: [] };
      return { id, initials: nameInitials(detail.name), ...detail };
    });
    result.set(requirementId, {
      evaluated: s.evaluated,
      scoreLow: s.scoreLow,
      scoreHigh: s.scoreHigh,
      topMatches: s.topMatches,
      strongAvgScore: s.strongAvgScore,
      strongMatchInitials: strongMatches.map((m) => m.initials),
      strongMatchExtra: s.strongMatchExtra,
      strongMatches,
    });
  }
  return result;
}

/** Joins requirement rows with their match counts and AI-screening summary
 *  for the GET response, defaulting to 0/empty for requirements nothing has
 *  matched yet. */
export function buildRequirementsListResponse(
  rows: RequirementRow[],
  countsByRequirement: Map<string, number>,
  aiScreeningByRequirement: Map<string, AiScreeningSummary> = new Map(),
): Array<{
  id: string;
  title: string;
  location: string;
  noticePeriodPref: string;
  status: string;
  experienceMin: number | null;
  experienceMax: number | null;
  dueDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  locations: string[];
  openPositions: number | null;
  workMode: string | null;
  skills: string[];
  employmentType: string | null;
  salaryType: string | null;
  createdAt: string;
  candidateCount: number;
  aiScreening: AiScreeningSummary;
  stage: string;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
}> {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    location: r.location,
    noticePeriodPref: r.notice_period_pref,
    status: r.status,
    stage: r.stage,
    experienceMin: r.experience_min ?? null,
    experienceMax: r.experience_max ?? null,
    dueDate: r.due_date ?? null,
    budgetMin: r.budget_min ?? null,
    budgetMax: r.budget_max ?? null,
    locations: r.locations ?? [],
    openPositions: r.open_positions ?? null,
    workMode: r.work_mode ?? null,
    skills: r.skills ?? [],
    employmentType: r.employment_type ?? null,
    salaryType: r.salary_type ?? null,
    createdAt: r.created_at.slice(0, 10),
    candidateCount: countsByRequirement.get(r.id) || 0,
    aiScreening: aiScreeningByRequirement.get(r.id) ?? EMPTY_AI_SCREENING,
    durationWeeks: r.duration_weeks ?? null,
    hoursPerWeek: r.hours_per_week ?? null,
  }));
}

/** Tallies how many requirement_matches rows belong to each requirement, so
 *  the GET response can report a candidateCount per requirement. */
export function countMatchesByRequirement(
  matchRows: Array<{ requirement_id: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of matchRows) counts.set(m.requirement_id, (counts.get(m.requirement_id) || 0) + 1);
  return counts;
}

/** Per-candidate average of their session scores — candidates with no
 *  sessions get no entry (the caller treats that as "no track record yet",
 *  not a zero). */
export function averageScoresByUser(
  sessionRows: Array<{ user_id: string; score: number }>,
): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const s of sessionRows) {
    sums.set(s.user_id, (sums.get(s.user_id) || 0) + (s.score || 0));
    counts.set(s.user_id, (counts.get(s.user_id) || 0) + 1);
  }
  const averages = new Map<string, number>();
  for (const [uid, sum] of sums) averages.set(uid, sum / (counts.get(uid) || 1));
  return averages;
}

/** Days since the candidate's most recent practice session, from their
 *  practice_timestamps array (already sorted ascending by the caller's
 *  storage convention) — 999 stands in for "never practiced" so recency
 *  scoring treats them as maximally stale rather than crashing on a missing
 *  date. */
export function daysSinceLastActive(timestamps: string[], nowMs: number): number {
  if (timestamps.length === 0) return 999;
  const lastActive = timestamps[timestamps.length - 1];
  return Math.max(0, Math.round((nowMs - new Date(lastActive).getTime()) / 86_400_000));
}
