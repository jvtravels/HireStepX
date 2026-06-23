/* Pure helpers extracted from evaluate-session.ts so we can unit-test the
   scoring/normalization pipeline without spinning up the edge handler. The
   handler imports these — behaviour must remain bit-identical. */

import {
  FOCUS_SIGNATURE_SPECS,
  type FocusMetric,
  type FocusMetricTone,
} from "../data/focus-signature-metrics";
import { detectStarPresence } from "../src/_star-detection";
import type { HrCompanyNorms } from "../data/hr-company-norms";

export type { FocusMetric } from "../data/focus-signature-metrics";

export type Band = "strongHire" | "hire" | "leanHire" | "noHire" | "strongNoHire";

export interface BandThresholds {
  strongHire: number;
  hire: number;
  leanHire: number;
  noHire: number;
}

export interface CompanyProfile {
  label: string;
  bands: BandThresholds;
  skillWeights: Record<string, number>;
  note: string;
}

export interface TranscriptTurn {
  role: "interviewer" | "candidate";
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface CoreMetrics {
  fillerPerMin: number;
  silenceRatio: number;
  paceWpm: number;
  energy: number;
}

export interface AdvancedDelivery {
  hedgingPerMin: number;
  lexicalDiversity: number;
  firstPersonRatio: number;
  medianLatencyMs: number;
  selfCorrectionRate: number;
}

export interface WinOrFix {
  text: string;
  questionIdx: number;
  quote: string;
}

/**
 * Plain-language coaching pair surfaced on the dashboard session card.
 * `strength` is what the candidate did well; `gap` is the single highest-
 * leverage thing to fix next, with a concrete rewrite example. Every field
 * is grounded in the transcript — `meaning`/`example` must reference what
 * the candidate actually said, never generic advice.
 */
export interface Coaching {
  strength: { headline: string; meaning: string };
  gap: { headline: string; meaning: string; example: string };
}

export type RedFlagType =
  | "blame"
  | "missing_result"
  | "we_without_i"
  | "scope_drift"
  | "contradiction"
  | "vague";

export interface RedFlag {
  type: RedFlagType;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  questionIdx: number;
  quote: string;
}

export interface ThoughtBubbleSegment {
  startMs: number;
  endMs: number;
  state:
    | "tracking"
    | "losingThread"
    | "probingForScope"
    | "readyToMoveOn"
    | "impressed"
    | "concerned";
  note: string;
}

export interface StoryReuseFinding {
  storyLabel: string;
  questionIndices: number[];
  concern: string;
}

export interface BlindSpot {
  competency: string;
  frequencyPct: number | null;
  note: string;
}

export interface ReadinessForecast {
  targetBand: "strongHire" | "hire" | "leanHire";
  estimatedHours: number;
  estimatedSessions: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
}

export interface CrossSessionInsight {
  kind: "improvement" | "regression" | "persistent";
  text: string;
  metric?: string;
  delta?: number;
}

/**
 * Resume-grounding sub-score — measures how often a candidate's answers
 * cite specific resume facts (named companies, projects, tech, metrics
 * they actually shipped) vs. generic claims. Only meaningful when the
 * engine passed a resumeContext block to the evaluator; null otherwise.
 * 0-100 scale, calibrated:
 *   0-39  = barely references resume; mostly generic
 *   40-69 = some grounding but several wasted opportunities
 *   70-100 = consistently anchors answers in real, on-resume specifics
 */
export interface ResumeGroundingScore {
  score: number;
  rationale: string;
}

export const ROLE_SKILLS: Record<string, string[]> = {
  swe: ["Problem Framing", "Technical Depth", "Trade-off Reasoning", "Communication", "Ownership"],
  pm: ["Product Sense", "Analytical", "Execution", "Influencing", "Customer Focus"],
  em: ["Strategic Thinking", "People Management", "Execution", "Communication", "Conflict Handling"],
  data: ["Analytical", "Technical Depth", "Business Impact", "Communication", "Ownership"],
  behavioral: ["Structure", "Ownership", "Impact", "Communication", "Composure"],
};

/* HR-round sessions are graded on the 8 HR rubric dimensions, not the
   candidate's role-family competencies — so the DimensionGate in the report
   gets real per-axis scores instead of role-family proxies. */
export const HR_ROUND_SKILL_AXES: readonly string[] = [
  "Logistics clarity",
  "Comp transparency",
  "Switch-rationale honesty",
  "Compliance readiness",
  "Commitment signal",
  "Benefits/policy literacy",
  "Self-awareness",
  "Motivation specificity",
];

/* Salary-negotiation sessions are scored on negotiation craft, not role-family
   competencies (a PM negotiating is graded on anchoring/leverage, not product
   sense). These six axes mirror the salary-negotiation focus recipe dimensions
   verbatim (data/focus-question-recipes.ts) so the LLM's per-skill scores stay
   consistent with the rubric it is already grading against (#99). */
export const NEGOTIATION_SKILL_AXES: readonly string[] = [
  "Anchor strength",
  "Counter-offer judgement",
  "Trade-off awareness",
  "Structural fluency",
  "Tactical composure",
  "Walk-away discipline",
];

/* Single source of truth for the report's skill axes. Focus type wins over
   role family: an HR round or a salary negotiation is graded on what the
   interviewer actually evaluated, regardless of the candidate's role. Falls
   back to role-family competencies (then behavioral) for everything else. */
export function resolveSkillAxes(
  metaType: string | undefined,
  roleFamily: string | undefined,
): string[] {
  if (metaType === "hr-round") return [...HR_ROUND_SKILL_AXES];
  if (metaType === "salary-negotiation") return [...NEGOTIATION_SKILL_AXES];
  const family = (roleFamily || "behavioral") as keyof typeof ROLE_SKILLS;
  return [...(ROLE_SKILLS[family] || ROLE_SKILLS.behavioral)];
}

/* Focuses graded on their own non-behavioral rubric (HR logistics, negotiation
   craft) whose answers are NOT STAR-shaped. The deterministic structural anchor
   (computeStructuralAnchor) measures STAR-pillar presence, so applying it to a
   notice-period / CTC / why-leaving answer systematically under-scores these
   rounds. For these focuses we skip the anchor and let the rubric-weighted LLM
   blend stand on its own (the per-axis weights already brake the score). */
export function isStarShapedFocus(metaType: string | undefined): boolean {
  return metaType !== "hr-round" && metaType !== "salary-negotiation";
}

/* Build a skillWeights map (axis-name -> weight) from a resolved focus recipe's
   scoringRubric. The HR/negotiation rubric dimension names match the report's
   skill-axis names verbatim (see HR_ROUND_SKILL_AXES), so these weights flow
   straight into computeBlendedOverall — making the sector/seniority overlay
   (_hr-round-overlays.ts) actually move the displayed score instead of being
   prompt-only decoration. Returns {} when there is no rubric (callers then fall
   back to equal 1.0 weighting). */
export function deriveSkillWeightsFromRubric(
  scoringRubric: ReadonlyArray<{ dimension: string; weight: number }> | undefined,
): Record<string, number> {
  if (!scoringRubric || scoringRubric.length === 0) return {};
  const out: Record<string, number> = {};
  for (const r of scoringRubric) {
    if (typeof r.weight === "number" && isFinite(r.weight) && r.weight > 0) {
      out[r.dimension] = r.weight;
    }
  }
  return out;
}

/* Normalize a skill/dimension name for tolerant matching: lowercase, drop every
   non-alphanumeric run. "Logistics clarity", "Logistics  Clarity" and
   "logistics-clarity" all collapse to "logisticsclarity". */
export function canonicalizeAxisName(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/* Reconcile LLM-returned skill names back to a canonical axis list. Any skill
   whose normalized name matches a canonical axis is renamed to the canonical
   spelling verbatim; unknown skills pass through unchanged. Without this, a
   paraphrased name ("Logistics" vs "Logistics clarity") silently (a) misses its
   overlay weight in computeBlendedOverall — skillWeights[name] is undefined, so
   the sector/seniority calibration falls back to 1.0 — and (b) mislabels the
   dimension in the rendered report. */
export function reconcileSkillAxisNames<T extends { name: string }>(
  rawSkills: readonly T[],
  canonicalAxes: readonly string[],
): T[] {
  const canonByNorm = new Map<string, string>();
  for (const axis of canonicalAxes) canonByNorm.set(canonicalizeAxisName(axis), axis);
  return rawSkills.map((s) => {
    const canon = canonByNorm.get(canonicalizeAxisName(s.name));
    return canon && canon !== s.name ? { ...s, name: canon } : s;
  });
}

/* Project an LLM-returned skills array onto the canonical HR axis set.

   Two bugs this closes, both silent:
   1. Axis drop on overflow — the LLM occasionally emits >8 skills (extra
      free-form rows, or a canonical axis duplicated). A naive `slice(0, 8)`
      *before* reconciliation can drop a genuine rubric axis that happened to
      land at index ≥8 while keeping a junk row at index <8, leaving the
      report missing a weighted dimension.
   2. Ordering drift — even within 8 rows, the LLM's order need not match the
      rubric order, so the rendered breakdown wouldn't line up with the
      overlay-derived weights.

   Fix: reconcile names first (so tolerant matches canonicalize), then select
   exactly the canonical axes in rubric order, deduping by name. Non-canonical
   rows are dropped. Returns ≤ canonicalAxes.length rows. Coverage is still
   enforced separately by skillsCoverAxes — this only guarantees we never lose
   an axis the LLM actually provided. */
export function selectCanonicalHrSkills<T extends { name: string }>(
  rawSkills: readonly T[],
  canonicalAxes: readonly string[],
): T[] {
  const reconciled = reconcileSkillAxisNames(rawSkills, canonicalAxes);
  const byName = new Map<string, T>();
  for (const s of reconciled) if (!byName.has(s.name)) byName.set(s.name, s);
  return canonicalAxes
    .map((axis) => byName.get(axis))
    .filter((s): s is T => Boolean(s));
}

/* True when `skills` (matched tolerantly by normalized name) covers every
   canonical axis. Used to reject an HR report that omitted a rubric dimension
   (e.g. a BFSI round missing "Compliance readiness", the most-weighted axis) so
   the caller retries rather than rendering a partial rubric as if complete. */
export function skillsCoverAxes(
  skills: ReadonlyArray<{ name?: unknown }>,
  canonicalAxes: readonly string[],
): boolean {
  const present = new Set(
    skills.map((s) => canonicalizeAxisName(typeof s?.name === "string" ? s.name : "")),
  );
  return canonicalAxes.every((axis) => present.has(canonicalizeAxisName(axis)));
}

/* A parsed LLM response can be syntactically valid JSON yet semantically
   empty — e.g. a verbose fallback model (gemini-2.5-flash) truncates the large
   report at its token cap, closing the object after the early fields but before
   `skills`/`hrReport`. extractJSON happily returns that object, and the report
   builder then defaults the missing arrays to [] and the score to 50 — surfacing
   a confident-looking "noHire 50" with a blank skills breakdown. That is worse
   than no report. Treat such a response as unusable so the caller retries and,
   failing that, returns a retryable 503 ("transcript saved") instead.

   Minimum bar: a non-empty skills array (every report type renders it), plus —
   for hr-round — the structured hrReport block (its whole value proposition). */
export function isUsableEvalReport(
  parsed: { skills?: unknown; hrReport?: unknown } | null | undefined,
  metaType?: string,
): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const skills = (parsed as { skills?: unknown }).skills;
  if (!Array.isArray(skills) || skills.length === 0) return false;
  if (metaType === "hr-round") {
    const hr = (parsed as { hrReport?: unknown }).hrReport;
    if (!hr || typeof hr !== "object" || Array.isArray(hr)) return false;
    // The HR rubric is 8 dimensions; a report missing one renders an
    // incomplete (and silently mis-weighted) breakdown. Reject so the caller
    // retries rather than surfacing a partial rubric. Matched tolerantly by
    // normalized name so a paraphrased-but-present axis is not falsely rejected.
    if (!skillsCoverAxes(skills as Array<{ name?: unknown }>, HR_ROUND_SKILL_AXES)) return false;
  }
  return true;
}

export const DEFAULT_BANDS: BandThresholds = {
  strongHire: 85,
  hire: 70,
  leanHire: 55,
  noHire: 40,
};

export const COMPANY_BANDS: Record<string, CompanyProfile> = {
  amazon:       { label: "Amazon",              bands: { strongHire: 90, hire: 75, leanHire: 60, noHire: 42 }, skillWeights: { "Ownership": 1.3, "Impact": 1.2, "Technical Depth": 1.15, "Problem Framing": 1.1, "Influencing": 1.1 }, note: "Amazon Bar Raiser — Ownership + Deliver Results weighted heavily." },
  google:       { label: "Google",              bands: { strongHire: 88, hire: 73, leanHire: 58, noHire: 42 }, skillWeights: { "Problem Framing": 1.2, "Technical Depth": 1.2, "Communication": 1.15, "Trade-off Reasoning": 1.1 }, note: "Google G&L + technical bar." },
  meta:         { label: "Meta",                bands: { strongHire: 88, hire: 72, leanHire: 58, noHire: 42 }, skillWeights: { "Impact": 1.25, "Execution": 1.15, "Technical Depth": 1.1, "Problem Framing": 1.05 }, note: "Meta's signal-based E-level rubric — Impact above all." },
  stripe:       { label: "Stripe",              bands: { strongHire: 87, hire: 72, leanHire: 57, noHire: 42 }, skillWeights: { "Communication": 1.3, "Problem Framing": 1.15, "Ownership": 1.1, "Technical Depth": 1.1, "Customer Focus": 1.05 }, note: "Stripe's high writing and clarity bar." },
  netflix:      { label: "Netflix",             bands: { strongHire: 90, hire: 76, leanHire: 62, noHire: 45 }, skillWeights: { "Impact": 1.3, "Ownership": 1.2, "Influencing": 1.15, "Execution": 1.1 }, note: "Netflix keeper-test — senior by default." },
  microsoft:    { label: "Microsoft",           bands: { strongHire: 86, hire: 71, leanHire: 56, noHire: 40 }, skillWeights: { "Technical Depth": 1.15, "Problem Framing": 1.1, "Communication": 1.1, "Impact": 1.1 }, note: "Microsoft Growth Mindset + technical rubric." },
  apple:        { label: "Apple",               bands: { strongHire: 88, hire: 73, leanHire: 58, noHire: 42 }, skillWeights: { "Technical Depth": 1.2, "Problem Framing": 1.15, "Customer Focus": 1.15, "Ownership": 1.1 }, note: "Apple craft + secrecy culture — depth over breadth." },
  "series-b":   { label: "Series-B Startup",    bands: { strongHire: 80, hire: 65, leanHire: 50, noHire: 35 }, skillWeights: { "Ownership": 1.2, "Execution": 1.15, "Impact": 1.1 }, note: "Series-B growth stage — bias toward ownership + execution." },
  "early-stage":{ label: "Early-Stage Startup", bands: { strongHire: 78, hire: 62, leanHire: 48, noHire: 32 }, skillWeights: { "Ownership": 1.25, "Execution": 1.2 }, note: "Seed / Series-A — friendlier bar, scrappy ownership." },
};

export const COMPANY_ALIASES: Record<string, string> = {
  aws: "amazon", amzn: "amazon", alphabet: "google", facebook: "meta", fb: "meta",
  msft: "microsoft", ms: "microsoft", nflx: "netflix", startup: "early-stage",
};

export function applyBands(score: number, bands: BandThresholds): Band {
  if (score >= bands.strongHire) return "strongHire";
  if (score >= bands.hire) return "hire";
  if (score >= bands.leanHire) return "leanHire";
  if (score >= bands.noHire) return "noHire";
  return "strongNoHire";
}

export function resolveCompanyProfile(
  targetCompany: string | null | undefined,
): CompanyProfile | null {
  if (!targetCompany) return null;
  const key = String(targetCompany).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!key) return null;
  if (COMPANY_BANDS[key]) return COMPANY_BANDS[key];
  if (COMPANY_ALIASES[key] && COMPANY_BANDS[COMPANY_ALIASES[key]]) {
    return COMPANY_BANDS[COMPANY_ALIASES[key]];
  }
  for (const k of Object.keys(COMPANY_BANDS)) {
    if (key.includes(k)) return COMPANY_BANDS[k];
  }
  return null;
}

/** Sector-aware calibration copy for the report's `calibration` block.
 * COMPANY_BANDS only covers US big-tech, so every Indian employer — the
 * product's core audience — fell through to a "Generic — set a target company"
 * note even when the user HAD set one (e.g. "HDFC Bank" → "Generic"). When no
 * tuned profile exists but a company is named, show the company back and, for
 * HR rounds, describe the sector calibration the overlay actually applied
 * (weights still differ by sector via resolveHrSectorOverlay). Band thresholds
 * stay at DEFAULT — we don't fabricate per-company numbers we haven't tuned. */
export function resolveCalibrationLabel(
  targetCompany: string | null | undefined,
  profile: CompanyProfile | null,
  hrSector: "services-tier1" | "product-unicorn" | "bfsi" | "none" = "none",
): { companyLabel: string; companyNote: string } {
  if (profile) return { companyLabel: profile.label, companyNote: profile.note };
  const named = (targetCompany ?? "").trim();
  if (!named) {
    return {
      companyLabel: "Generic",
      companyNote: "Generic calibration — set a target company for role-specific scoring.",
    };
  }
  const sectorNote: Record<Exclude<typeof hrSector, "none">, string> = {
    "services-tier1": "Tier-1 IT services calibration — process discipline, documentation, and notice-period rigor weighted up.",
    "bfsi": "BFSI calibration — compliance readiness, stability, and background-verification rigor weighted up.",
    "product-unicorn": "Product-unicorn calibration — compensation transparency and switch-rationale clarity weighted up.",
  };
  const companyNote =
    hrSector !== "none"
      ? sectorNote[hrSector]
      : `Calibrated to a general senior bar — ${named} isn't in our tuned profile set yet, so band thresholds use the default rubric.`;
  return { companyLabel: named, companyNote };
}

export function computeCoreMetrics(
  transcript: TranscriptTurn[],
  durationSec: number,
): CoreMetrics {
  const candidateTurns = transcript.filter((t) => t.role === "candidate");
  const allText = candidateTurns.map((t) => t.text).join(" ");
  const words = allText.split(/\s+/).filter(Boolean);
  const fillerRegex = /\b(um+|uh+|like|you know|so|actually|basically|literally)\b/gi;
  const fillerMatches = allText.match(fillerRegex) || [];
  const speakingMinutes = Math.max(durationSec / 60, 0.1);

  let silenceMs = 0;
  for (let i = 1; i < candidateTurns.length; i++) {
    const prev = candidateTurns[i - 1];
    const cur = candidateTurns[i];
    if (prev.endMs != null && cur.startMs != null) {
      const gap = cur.startMs - prev.endMs;
      if (gap > 1500) silenceMs += gap;
    }
  }
  const silenceRatio =
    durationSec > 0 ? Math.min(100, Math.round((silenceMs / (durationSec * 1000)) * 100)) : 0;

  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const diversity = words.length > 0 ? uniqueWords / words.length : 0;
  const avgLen = candidateTurns.length > 0 ? words.length / candidateTurns.length : 0;
  const energy = Math.max(
    0,
    Math.min(100, Math.round(40 + diversity * 80 + Math.min(avgLen, 30))),
  );

  return {
    fillerPerMin: Math.round((fillerMatches.length / speakingMinutes) * 10) / 10,
    silenceRatio,
    paceWpm: Math.round(words.length / speakingMinutes),
    energy,
  };
}

export function computeAdvancedDelivery(
  transcript: TranscriptTurn[],
  durationSec: number,
): AdvancedDelivery {
  const candidateTurns = transcript.filter((t) => t.role === "candidate");
  const allText = candidateTurns.map((t) => t.text).join(" ");
  const words = allText.split(/\s+/).filter(Boolean);
  const speakingMinutes = Math.max(durationSec / 60, 0.1);

  const hedgeRegex = /\b(?:i\s+(?:think|guess|feel|believe|assume|suppose)|maybe|kind\s+of|sort\s+of|kinda|sorta|probably|perhaps|might|could\s+be|i'?m\s+not\s+sure)\b/gi;
  const hedgeCount = (allText.match(hedgeRegex) || []).length;

  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
  const lexicalDiversity = words.length >= 20 ? uniqueWords / words.length : 0;

  const iCount = (allText.match(/\bI\b/g) || []).length;
  const weCount = (allText.match(/\bwe\b/gi) || []).length;
  const firstPersonRatio = iCount + weCount > 0 ? iCount / (iCount + weCount) : 0.5;

  const latencies: number[] = [];
  for (let i = 1; i < transcript.length; i++) {
    const prev = transcript[i - 1];
    const cur = transcript[i];
    if (
      prev.role === "interviewer" &&
      cur.role === "candidate" &&
      prev.endMs != null &&
      cur.startMs != null
    ) {
      const gap = cur.startMs - prev.endMs;
      if (gap >= 0 && gap < 30_000) latencies.push(gap);
    }
  }
  latencies.sort((a, b) => a - b);
  const medianLatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)] : 0;

  const scRegex = /\b(?:let\s+me\s+rephrase|actually(?:,|\s+let\s+me)|what\s+i\s+(?:meant|mean)\s+(?:to\s+say\s+)?(?:is|was)|sorry,?\s+i\s+misspoke|scratch\s+that|let\s+me\s+start\s+over)\b/gi;
  const scCount = (allText.match(scRegex) || []).length;

  return {
    hedgingPerMin: Math.round((hedgeCount / speakingMinutes) * 10) / 10,
    lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
    firstPersonRatio: Math.round(firstPersonRatio * 100) / 100,
    medianLatencyMs: Math.round(medianLatencyMs),
    selfCorrectionRate: Math.round((scCount / speakingMinutes) * 10) / 10,
  };
}

export function filterGroundedItems(
  items: WinOrFix[] | undefined,
  candidateCorpus: string,
): WinOrFix[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((w) => w && typeof w.text === "string" && w.text.trim().length > 0)
    .filter((w) => {
      if (w.questionIdx === -1 || !w.quote) return true;
      return typeof w.quote === "string" && candidateCorpus.includes(w.quote.trim());
    })
    .slice(0, 3);
}

export function filterGroundedRedFlags(
  items: RedFlag[] | undefined,
  candidateCorpus: string,
): RedFlag[] {
  if (!Array.isArray(items)) return [];
  const validTypes: RedFlagType[] = [
    "blame",
    "missing_result",
    "we_without_i",
    "scope_drift",
    "contradiction",
    "vague",
  ];
  const validSeverities = ["high", "medium", "low"] as const;
  return items
    .filter(
      (f) =>
        f &&
        validTypes.includes(f.type) &&
        (validSeverities as readonly string[]).includes(f.severity),
    )
    .filter((f) => typeof f.title === "string" && f.title.trim().length > 0)
    .filter((f) => {
      if (f.questionIdx === -1 || !f.quote) return true;
      return typeof f.quote === "string" && candidateCorpus.includes(f.quote.trim());
    })
    .slice(0, 4);
}

export function validateReportShape(
  report: unknown,
  transcript: TranscriptTurn[],
): boolean {
  if (!report || typeof report !== "object") return false;
  const r = report as Record<string, unknown>;
  if (typeof r.overallScore !== "number" || r.overallScore < 0 || r.overallScore > 100) return false;
  if (!Array.isArray(r.perQuestion)) return false;

  const candidateCorpus = transcript
    .filter((t) => t.role === "candidate")
    .map((t) => t.text)
    .join("\n");

  for (const pq of r.perQuestion as Array<{
    restructured?: { citations?: Array<{ sourceStart?: number; sourceEnd?: number }> };
  }>) {
    if (pq.restructured && Array.isArray(pq.restructured.citations)) {
      for (const c of pq.restructured.citations) {
        if (typeof c.sourceStart !== "number" || typeof c.sourceEnd !== "number") continue;
        if (
          c.sourceStart >= candidateCorpus.length ||
          c.sourceEnd > candidateCorpus.length
        )
          return false;
      }
    }
  }
  return true;
}

/**
 * Blend role-weighted skill composite with the LLM's holistic overall score.
 * 60/40 split — composite keeps company calibration honest, LLM captures
 * cross-cutting signal weights don't model. Result is clamped 0-100.
 */
/* ── Score-stability anchor ──
 *
 * WHY: both the LLM `overallScore` and its per-skill scores are regenerated
 * each run and drift run-to-run on identical input — the single biggest
 * credibility bug in the report (a 72 one run, 58 the next on the same
 * transcript). `computeStructuralAnchor` derives a deterministic 0-100
 * estimate from the transcript using the SAME STAR detector the live coach
 * uses, so identical input always yields the identical anchor.
 * `computeBlendedOverall` then (a) pulls the LLM blend toward that anchor by
 * ANCHOR_WEIGHT — compressing a Δ run-to-run swing to (1-ANCHOR_WEIGHT)·Δ —
 * and (b) hard-clamps the result to ±ANCHOR_MAX_DEVIATION of it, killing
 * egregious outliers. Conservative defaults: the LLM still owns the majority
 * of the content judgment; the anchor only brakes variance and outliers. */
const ANCHOR_WEIGHT = 0.35;
const ANCHOR_MAX_DEVIATION = 18;

/**
 * Deterministic structural anchor (0-100) for the overall score, computed
 * purely from the transcript (no LLM). Only substantive candidate answers
 * (≥25 words, not skipped) count. Scale is calibrated to the known
 * mock-interview distribution (average 45-65, per the scorer prompt): a
 * full STAR answer with metrics lands ~75-80; a one-pillar fragment ~35-45;
 * with no substantive answer to ground on it returns a neutral 50 so the
 * blend/clamp become a no-op on the LLM score.
 */
export function computeStructuralAnchor(transcript: TranscriptTurn[]): number {
  const answers = transcript
    .filter((t) => t.role === "candidate")
    .map((t) => (t.text || "").trim())
    .filter(
      (text) =>
        !text.startsWith("[SKIPPED") &&
        text.split(/\s+/).filter(Boolean).length >= 25,
    );
  if (answers.length === 0) return 50;

  let sum = 0;
  for (const text of answers) {
    const star = detectStarPresence(text);
    // Base 30 keeps a structurally-thin-but-present answer off the floor;
    // 4 STAR pillars carry the bulk (0..55); metrics + STAR+L learning are
    // bonuses for concrete, reflective answers.
    const pillarScore = (star.count / 4) * 55;
    const metricBonus = star.hasMetrics ? 10 : 0;
    const learningBonus = star.learning ? 5 : 0;
    sum += 30 + pillarScore + metricBonus + learningBonus;
  }
  return Math.round(Math.max(0, Math.min(100, sum / answers.length)));
}

export function computeBlendedOverall(
  rawSkills: Array<{ name: string; score: number }>,
  skillWeights: Record<string, number>,
  llmOverall: number,
  /** Deterministic structural anchor from computeStructuralAnchor(). When
   *  omitted the function behaves exactly as before (pure LLM blend) so
   *  existing callers/tests are unaffected. */
  structuralAnchor?: number,
): {
  weightedSkills: Array<{ name: string; score: number; weight: number }>;
  overallScore: number;
  /** True when the ±ANCHOR_MAX_DEVIATION clamp actually changed the score —
   *  i.e. the LLM blend disagreed with the deterministic structure by more
   *  than the allowed band. Lets the handler emit `score_anchor_clamped`
   *  telemetry (PRI-36) to measure how often that happens in production. */
  anchorClamped: boolean;
  /** Signed gap (blended − anchor) in points; 0 when no anchor supplied.
   *  Magnitude > ANCHOR_MAX_DEVIATION ⇔ anchorClamped. */
  anchorDelta: number;
} {
  const weightedSkills = rawSkills.map((s) => ({
    name: s.name,
    score: s.score,
    weight: Math.round((skillWeights[s.name] ?? 1.0) * 100) / 100,
  }));
  const totalWeight = weightedSkills.reduce((sum, w) => sum + w.weight, 0) || 1;
  const composite =
    weightedSkills.length > 0
      ? weightedSkills.reduce((sum, w) => sum + w.score * w.weight, 0) / totalWeight
      : llmOverall;
  const blended = composite * 0.6 + llmOverall * 0.4;

  let anchored = blended;
  let anchorClamped = false;
  let anchorDelta = 0;
  if (typeof structuralAnchor === "number" && isFinite(structuralAnchor)) {
    anchorDelta = Math.round((blended - structuralAnchor) * 10) / 10;
    const pulled = blended * (1 - ANCHOR_WEIGHT) + structuralAnchor * ANCHOR_WEIGHT;
    anchored = Math.max(
      structuralAnchor - ANCHOR_MAX_DEVIATION,
      Math.min(structuralAnchor + ANCHOR_MAX_DEVIATION, pulled),
    );
    // The clamp "fired" only when it actually moved the pulled value.
    anchorClamped = Math.abs(pulled - anchored) > 1e-9;
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(anchored)));
  return { weightedSkills, overallScore, anchorClamped, anchorDelta };
}

/** Validate + clamp thoughtBubble segments coming from the LLM. */
export function normalizeThoughtBubble(raw: unknown): ThoughtBubbleSegment[] {
  const validStates = [
    "tracking",
    "losingThread",
    "probingForScope",
    "readyToMoveOn",
    "impressed",
    "concerned",
  ];
  if (!Array.isArray(raw)) return [];
  return (raw as ThoughtBubbleSegment[])
    .filter((s) => s && validStates.includes(s.state) && typeof s.note === "string")
    .map((s) => ({
      startMs: Math.max(0, Math.floor(Number(s.startMs) || 0)),
      endMs: Math.max(0, Math.floor(Number(s.endMs) || 0)),
      state: s.state,
      note: s.note.slice(0, 100),
    }))
    .filter((s) => s.endMs >= s.startMs)
    .slice(0, 8);
}

export function normalizeScoreConfidence(raw: unknown): number {
  if (typeof raw !== "number" || !isFinite(raw)) return 0.8;
  return Math.max(0, Math.min(1, Math.round(raw * 100) / 100));
}

export function normalizeStoryReuse(raw: unknown): StoryReuseFinding[] {
  if (!Array.isArray(raw)) return [];
  return (raw as StoryReuseFinding[])
    .filter(
      (f) =>
        f &&
        typeof f.storyLabel === "string" &&
        Array.isArray(f.questionIndices) &&
        f.questionIndices.length >= 2 &&
        typeof f.concern === "string",
    )
    .map((f) => ({
      storyLabel: f.storyLabel.slice(0, 60),
      questionIndices: f.questionIndices.filter((i) => typeof i === "number" && i >= 0).slice(0, 6),
      concern: f.concern.slice(0, 200),
    }))
    .filter((f) => f.questionIndices.length >= 2)
    .slice(0, 3);
}

export function normalizeBlindSpots(raw: unknown): BlindSpot[] {
  if (!Array.isArray(raw)) return [];
  return (raw as BlindSpot[])
    .filter((b) => b && typeof b.competency === "string" && b.competency.trim().length > 0)
    .map((b) => ({
      competency: b.competency.slice(0, 60),
      frequencyPct:
        typeof b.frequencyPct === "number" &&
        isFinite(b.frequencyPct) &&
        b.frequencyPct >= 0 &&
        b.frequencyPct <= 100
          ? Math.round(b.frequencyPct)
          : null,
      note: typeof b.note === "string" ? b.note.slice(0, 160) : "",
    }))
    .slice(0, 5);
}

/** Full band ladder, low→high, for ordering comparisons. */
const BAND_RANK: Record<string, number> = {
  strongNoHire: 0,
  noHire: 1,
  leanHire: 2,
  hire: 3,
  strongHire: 4,
};
/** Bands a readiness forecast may target, ascending. */
const TARGET_BANDS_ASC: ReadinessForecast["targetBand"][] = ["leanHire", "hire", "strongHire"];

export function normalizeReadiness(
  raw: unknown,
  currentBand?: string,
): ReadinessForecast | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as ReadinessForecast;
  const validConf = ["low", "medium", "high"];
  if (!TARGET_BANDS_ASC.includes(r.targetBand)) return null;
  let targetBand = r.targetBand;
  // A readiness FORECAST must point UP — the goal band has to be strictly above
  // the candidate's current band. The LLM sometimes echoes the current band
  // (observed: targetBand "hire" while already AT hire), which renders as
  // "20h of practice to reach the band you're already in". Enforce the next
  // achievable band above current; if the candidate is already at the top
  // (strongHire), there's no higher band to forecast toward — drop the card.
  if (currentBand && BAND_RANK[currentBand] !== undefined) {
    const nextUp = TARGET_BANDS_ASC.find((b) => BAND_RANK[b] > BAND_RANK[currentBand]);
    if (!nextUp) return null;
    if (BAND_RANK[targetBand] <= BAND_RANK[currentBand]) targetBand = nextUp;
  }
  return {
    targetBand,
    estimatedHours: Math.max(0, Math.min(500, Math.round(Number(r.estimatedHours) || 0))),
    estimatedSessions: Math.max(0, Math.min(100, Math.round(Number(r.estimatedSessions) || 0))),
    confidence: validConf.includes(r.confidence) ? r.confidence : "medium",
    rationale: typeof r.rationale === "string" ? r.rationale.slice(0, 220) : "",
  };
}

/**
 * Plain-language coaching normalizer. Returns null when the LLM omitted the
 * field or returned a malformed shape, so the dashboard card falls back to
 * the legacy strength/weakness one-liners. Trims each string so a misbehaving
 * model can't blow up the persisted payload. A coaching object survives only
 * if BOTH strength and gap carry a non-empty headline — partial coaching is
 * worse than the legacy fallback.
 */
export function normalizeCoaching(raw: unknown): Coaching | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { strength?: unknown; gap?: unknown };
  if (!r.strength || typeof r.strength !== "object") return null;
  if (!r.gap || typeof r.gap !== "object") return null;
  const s = r.strength as { headline?: unknown; meaning?: unknown };
  const g = r.gap as { headline?: unknown; meaning?: unknown; example?: unknown };
  const str = (v: unknown, max: number): string =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const strength = { headline: str(s.headline, 60), meaning: str(s.meaning, 160) };
  const gap = {
    headline: str(g.headline, 60),
    meaning: str(g.meaning, 160),
    example: str(g.example, 160),
  };
  if (!strength.headline || !gap.headline) return null;
  return { strength, gap };
}

/**
 * Focus signature-metric normalizer — the trust boundary for the card's
 * instrument strip. The LLM is asked to echo the pinned labels for this
 * focus (see data/focus-signature-metrics.ts) and fill value + tone. We keep
 * ONLY metrics whose label matches a spec for `type`, re-order them to the
 * spec's canonical order, cap the value string, and clamp tone to the enum.
 * A focus with no spec (or no valid metrics) returns [] — the card then
 * renders no strip and falls back to the coaching pair. Labels are pinned in
 * code, so the model can't invent an axis the UI doesn't expect.
 */
export function normalizeFocusMetrics(raw: unknown, type: string | undefined): FocusMetric[] {
  if (!Array.isArray(raw) || !type) return [];
  const specs = FOCUS_SIGNATURE_SPECS[type];
  if (!specs || specs.length === 0) return [];
  const validTones: FocusMetricTone[] = ["good", "watch", "miss", "neutral"];
  const norm = (s: string) => s.trim().toLowerCase();
  const byLabel = new Map<string, FocusMetric>();
  for (const item of raw as Array<{ label?: unknown; value?: unknown; tone?: unknown }>) {
    if (!item || typeof item !== "object") continue;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const value = typeof item.value === "string" ? item.value.trim().slice(0, 18) : "";
    if (!label || !value) continue;
    const spec = specs.find((sp) => norm(sp.label) === norm(label));
    if (!spec) continue; // drift guard: drop labels the card doesn't expect
    const tone: FocusMetricTone =
      typeof item.tone === "string" && validTones.includes(item.tone as FocusMetricTone)
        ? (item.tone as FocusMetricTone)
        : "neutral";
    // Use the pinned label spelling, not the model's echo, so casing/spacing
    // stays identical across sessions. First valid wins (ignore duplicates).
    if (!byLabel.has(norm(spec.label))) {
      byLabel.set(norm(spec.label), { label: spec.label, value, tone });
    }
  }
  // Return in canonical spec order, only the metrics the model actually filled.
  return specs
    .map((sp) => byLabel.get(norm(sp.label)))
    .filter((m): m is FocusMetric => Boolean(m));
}

/**
 * Resume-grounding normalizer. Returns null when the LLM omitted the field
 * or when resumeContext wasn't passed (caller-enforced). Clamps to 0-100
 * and trims rationale so a misbehaving model can't blow up the payload.
 */
export function normalizeResumeGrounding(raw: unknown): ResumeGroundingScore | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { score?: unknown; rationale?: unknown };
  const scoreNum = typeof r.score === "number" ? r.score : Number(r.score);
  if (!isFinite(scoreNum)) return null;
  const score = Math.max(0, Math.min(100, Math.round(scoreNum)));
  const rationale = typeof r.rationale === "string" ? r.rationale.slice(0, 220) : "";
  return { score, rationale };
}

/**
 * Cross-session insights are gated: empty array if no prior reports were
 * provided to the LLM. Defense-in-depth against fabricated history.
 */
export function normalizeCrossSessionInsights(
  raw: unknown,
  priorSessionCount: number,
): CrossSessionInsight[] {
  if (!Array.isArray(raw)) return [];
  if (priorSessionCount === 0) return [];
  const validKinds = ["improvement", "regression", "persistent"];
  return (raw as CrossSessionInsight[])
    .filter(
      (i) =>
        i &&
        validKinds.includes(i.kind) &&
        typeof i.text === "string" &&
        i.text.trim().length > 0,
    )
    .map((i) => ({
      kind: i.kind,
      text: i.text.slice(0, 220),
      metric: typeof i.metric === "string" ? i.metric.slice(0, 40) : undefined,
      delta:
        typeof i.delta === "number" && isFinite(i.delta) ? Math.round(i.delta * 10) / 10 : undefined,
    }))
    .slice(0, 4);
}

/* ─── HR-round structured extraction ────────────────────────────────────
   Populated only when the session focus is hr-round. Contains the
   motivation rewrite + logistics facts the evaluator extracted from the
   transcript so the HrFullReport component can render actionable panels
   without fabricating data that wasn't in the conversation. */

export interface HrReportData {
  /** What the candidate actually said for "why this company" — verbatim excerpt
   *  or close paraphrase from the transcript. */
  motivationBefore: string;
  /** Stronger rewrite that sounds like a real candidate (not an LLM press release).
   *  Grounded in any specific product/leader/domain signals from the transcript. */
  motivationAfter: string;
  /** Notice period the candidate stated in days (e.g. 60), or null if not discussed. */
  noticeDays: number | null;
  /** How flexible the candidate was about serving the full notice period. */
  noticeFlexibility: "buyout-possible" | "strict" | "not-stated";
  /** CTC expectation the candidate stated, e.g. "35–40L" or "10% hike", or null. */
  compExpected: string | null;
  /** How likely the candidate is to take a counter-offer from their current
   *  employer. "not-assessed" when the topic never came up in the conversation —
   *  the report must NOT invent a counter-offer script for a candidate who was
   *  never asked about competing/retention offers. */
  counterOfferRisk: "low" | "med" | "high" | "not-assessed";
  /** Document gaps the candidate explicitly admitted in the BGV discussion. */
  bgvGaps: string[];
  /** Sector-grounded India HR norms (notice/BGV/comp/dual-employment) resolved
   *  deterministically from the target company — NOT LLM output. null when no
   *  company is set or the sector is unrecognised (render falls back to generic
   *  copy). Lets the report cite "TCS → IT services → 60–90 day notice, buyouts
   *  rare" instead of one generic paragraph for every employer. */
  companyNorms: HrCompanyNorms | null;
}

/* Generic-filler detector for the coached "motivationAfter" rewrite. The prompt
   bans these phrases, but a prompt ban is best-effort — this is the deterministic
   backstop. A rewrite that still leans on résumé-padding clichés ("achieve my
   career goals", "great culture", "grow professionally") is worse than no
   rewrite: it teaches the candidate to parrot filler. When matched we blank the
   field rather than ship the cliché. */
const GENERIC_MOTIVATION_RE =
  /\b(?:achieve\s+my\s+career\s+goals?|career\s+growth|grow(?:th)?\s+(?:professionally|my\s+career|opportunit)|take\s+my\s+career\s+to\s+the\s+next\s+level|learn\s+and\s+grow|great\s+(?:culture|brand|company|work\s+culture|place\s+to\s+work)|excited\s+about\s+the\s+(?:opportunity|journey|digital\s+transformation)|passionate\s+about\s+(?:technology|the\s+industry)|work[-\s]life\s+balance|aligns?\s+with\s+my\s+(?:values|career\s+goals)|make\s+a\s+(?:real\s+)?(?:difference|impact)\b(?!\s+(?:on|to|in|by|through)\s))/i;

export function isGenericMotivation(text: string): boolean {
  return GENERIC_MOTIVATION_RE.test(text || "");
}

/* Coerce a notice-period value to integer days. Accepts a number (already days),
   or a verbal string the LLM may echo from speech — "2 months", "60 days",
   "3 mo", "2-month". Returns null when unparseable or outside (0, 365]. */
export function coerceNoticeDays(raw: unknown): number | null {
  if (typeof raw === "number" && isFinite(raw) && raw > 0 && raw <= 365) {
    return Math.round(raw);
  }
  if (typeof raw === "string") {
    const m = raw.toLowerCase().match(/(\d+(?:\.\d+)?)[\s-]*(months?|mos?|weeks?|wks?|days?)?/);
    if (m) {
      const n = parseFloat(m[1]);
      const unit = m[2] || "day";
      let days = n;
      if (/^mo|^month/.test(unit)) days = n * 30;
      else if (/^w/.test(unit)) days = n * 7;
      days = Math.round(days);
      if (days > 0 && days <= 365) return days;
    }
  }
  return null;
}

/* Topics that must actually appear in the conversation before the report is
   allowed to assert anything about them — prevents the LLM inventing BGV gaps
   or a counter-offer risk for a candidate who was never probed on them. */
const BGV_TOPIC_RE =
  /\b(?:bgv|background\s+(?:check|verification)|relieving\s+letter|reliev|pay\s*slip|payslip|form\s*16|marksheet|mark\s+sheet|uan|epf|offer\s+letter|experience\s+letter|reference\s+check|document|verification|gap\s+in\s+(?:employment|career))\b/i;
const COUNTER_OFFER_TOPIC_RE =
  /\b(?:counter[-\s]?offer|other\s+offers?|competing\s+offer|retention|current\s+employer\s+(?:match|retain|counter)|are\s+you\s+(?:interviewing|considering)|in\s+the\s+market)\b/i;
// Notice-period / joining-timeline topic — gates noticeDays + noticeFlexibility
// so the report can't assert a notice period or buyout stance for a candidate
// who was never asked about it (same grounding invariant as BGV / counter-offer).
const NOTICE_TOPIC_RE =
  /\b(?:notice\s*period|serve\s+(?:my\s+|the\s+)?notice|buy[\s-]?out|buyout|last\s+working\s+day|reliev|when\s+can\s+you\s+(?:join|start)|how\s+(?:soon|early|quickly)\s+can\s+you\s+(?:join|start)|joining\s+(?:date|timeline)|notice\s+to\s+serve|\d+\s*(?:months?|mos?|weeks?|wks?|days?)\s+notice)\b/i;
// Compensation-expectation topic — gates compExpected so the report can't put a
// CTC/hike figure in the candidate's mouth when comp never came up.
const COMP_TOPIC_RE =
  /\b(?:ctc|salary|compensation|\bcomp\b|package|\blpa\b|lakhs?|crores?|\bhike\b|expected\s+(?:comp|salary|ctc|package|number)|comp(?:ensation)?\s+expectation|current\s+(?:ctc|salary|package|comp)|in[\s-]?hand|take[\s-]?home|₹)\b/i;

/**
 * Normalize + ground the LLM's hrReport block. `conversationCorpus` (the full
 * transcript text, interviewer + candidate) is optional for backward-compat,
 * but when supplied it grounds the topic-dependent fields: BGV gaps and
 * counter-offer risk are only asserted if those topics actually surfaced in the
 * conversation, so the report can't fabricate document failures or a retention
 * script for a candidate who was never probed on them.
 */
export function normalizeHrReport(
  raw: unknown,
  conversationCorpus?: string,
  companyNorms?: HrCompanyNorms | null,
): HrReportData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const corpus = typeof conversationCorpus === "string" ? conversationCorpus : "";
  const grounded = corpus.length > 0;
  const motivationBefore =
    typeof r.motivationBefore === "string" ? r.motivationBefore.trim().slice(0, 300) : "";
  let motivationAfter =
    typeof r.motivationAfter === "string" ? r.motivationAfter.trim().slice(0, 300) : "";
  // P1 #8 — deterministic backstop: drop a rewrite that still leans on filler.
  if (motivationAfter && isGenericMotivation(motivationAfter)) motivationAfter = "";
  if (!motivationBefore && !motivationAfter) return null;
  // P2 — notice/comp grounding: like BGV + counter-offer below, these logistics
  // fields may only be asserted if their topic actually surfaced in the
  // conversation. Otherwise the LLM can fabricate a notice period, buyout
  // stance, or CTC expectation the candidate never stated.
  const noticeGrounded = !grounded || NOTICE_TOPIC_RE.test(corpus);
  const compGrounded = !grounded || COMP_TOPIC_RE.test(corpus);
  const noticeDays = noticeGrounded ? coerceNoticeDays(r.noticeDays) : null;
  const validFlex = ["buyout-possible", "strict", "not-stated"] as const;
  const noticeFlexibility =
    noticeGrounded && validFlex.includes(r.noticeFlexibility as typeof validFlex[number])
      ? (r.noticeFlexibility as typeof validFlex[number])
      : "not-stated";
  const compExpected =
    compGrounded && typeof r.compExpected === "string"
      ? r.compExpected.trim().slice(0, 40) || null
      : null;
  // P0 #6 — counter-offer risk defaults to "not-assessed", not "med". When we
  // have the corpus and the topic never came up, force "not-assessed" so the
  // report doesn't manufacture a retention script (re-introduces script-leak).
  const validRisk = ["low", "med", "high", "not-assessed"] as const;
  let counterOfferRisk: HrReportData["counterOfferRisk"] = validRisk.includes(
    r.counterOfferRisk as typeof validRisk[number],
  )
    ? (r.counterOfferRisk as typeof validRisk[number])
    : "not-assessed";
  if (grounded && counterOfferRisk !== "not-assessed" && !COUNTER_OFFER_TOPIC_RE.test(corpus)) {
    counterOfferRisk = "not-assessed";
  }
  // P1 #7 — BGV gaps only survive if the BGV/document topic was actually
  // discussed; otherwise they're ungrounded and would render as hard red
  // document failures the candidate never admitted.
  let bgvGaps = Array.isArray(r.bgvGaps)
    ? (r.bgvGaps as unknown[])
        .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        .map((g) => g.trim().slice(0, 80))
        .slice(0, 6)
    : [];
  if (grounded && bgvGaps.length > 0 && !BGV_TOPIC_RE.test(corpus)) bgvGaps = [];
  return {
    motivationBefore,
    motivationAfter,
    noticeDays,
    noticeFlexibility,
    compExpected,
    counterOfferRisk,
    bgvGaps,
    companyNorms: companyNorms ?? null,
  };
}
