/* Behavioral competency taxonomy — Phase 2 of the Behavioral
 * score-improvement plan (docs/Interview Focus/SCORE_IMPROVEMENT_PLAN.md).
 *
 * Why this exists:
 *   v1 of the behavioral analyzer collapsed every answer into one STAR
 *   rubric. Amazon Leadership Principles, Google "Googleyness", Indian
 *   product-co "ownership / customer-obsession" — all fed the same
 *   "weak STAR structure" verdict. Candidates couldn't tell which of
 *   their stories demonstrated which competency, and our report
 *   surfaced only negatives ("you missed Result") instead of
 *   anchoring on positives ("3 stories demonstrated ownership").
 *
 * What this module does:
 *   - Defines ~10 universal competencies that map cleanly to the
 *     dominant Indian hiring tracks (Amazon LPs, Google, Indian
 *     product-co, services lateral, startup).
 *   - For each, owns a conservative regex pattern set. Conservative
 *     because false positives ("I owned it" claimed when the answer
 *     never demonstrates ownership behaviour) erode trust faster than
 *     false negatives.
 *   - Maps each competency to the tracks where it's load-bearing,
 *     so callers (the analyzer, the report UI) can weight per-track.
 *
 * Detection bar:
 *   A competency fires when the answer contains a behavioural marker
 *   (verb + first-person), not just the noun. "I want ownership" does
 *   NOT count for `ownership`; "I owned the migration end-to-end"
 *   does. This is the same discipline as `_star-detection.ts`'s
 *   action regex — narrow on purpose.
 *
 * Adding a new competency:
 *   1. Add to `Competency` type.
 *   2. Add a row to COMPETENCY_PATTERNS with ≥2 distinct phrasings.
 *   3. Add to COMPETENCY_TRACK_WEIGHTS for every track it applies to.
 *   4. Add a row to COMPETENCY_LABELS for the report.
 *   5. Land a unit test asserting it fires on the intended phrasings
 *      and does NOT fire on similar noun-only mentions. */

export type Competency =
  | "ownership"
  | "customer-obsession"
  | "bias-for-action"
  | "learn-and-be-curious"
  | "earn-trust"
  | "deliver-results"
  | "think-big"
  | "dive-deep"
  | "influence-without-authority"
  | "invent-and-simplify";

export type CompetencyTrack =
  | "amazon-lp"
  | "google"
  | "indian-product"
  | "services-lateral"
  | "startup";

/* Each row: a small set of regex patterns that fire on first-person
 * behavioural language for that competency. Two-or-more patterns per
 * row by convention — one phrasing is fragile; two cover the dialect
 * spread between Indian candidates (Hindi-English code-switching,
 * services-track formality, product-track casual). */
export const COMPETENCY_PATTERNS: Record<Competency, RegExp[]> = {
  ownership: [
    /\bi\s+(?:owned|took\s+ownership(?:\s+of)?|was\s+(?:accountable|responsible)\s+for|drove(?:\s+(?:the|this|that))?|championed|stewarded)\b/i,
    /\bthe\s+buck\s+stopped\s+with\s+me\b/i,
    /\bi\s+stepped\s+up\s+(?:to|when|and)\b/i,
  ],
  "customer-obsession": [
    /\bi\s+(?:talked|spoke|met)\s+(?:to|with)\s+(?:(?:the|a|an|some|several|many|few|\d+|five|ten|two|three|four|six|seven|eight|nine|dozens?\s+of|hundreds?\s+of)\s+)?(?:customers?|users?|merchants?)\b/i,
    /\b(?:user|customer)\s+(?:research|interview|feedback|complaints?|pain[\s-]?point|journey)\b/i,
    /\bi\s+(?:dogfooded|used\s+it\s+myself|sat\s+with\s+(?:the\s+)?(?:customer|user))\b/i,
    /\b(?:nps|csat|user\s+retention|drop[\s-]?off)\b/i,
  ],
  "bias-for-action": [
    /\bi\s+(?:didn'?t\s+wait|just\s+(?:shipped|did\s+it|started)|moved\s+fast|acted\s+quickly|decided\s+to\s+(?:ship|act|move))\b/i,
    /\bi\s+(?:cut\s+through|broke\s+the\s+deadlock|unblocked)\b/i,
    /\b(?:within|in)\s+(?:a\s+)?(?:day|hour|few\s+hours|24\s*hours)\s+i\s+\w+/i,
  ],
  "learn-and-be-curious": [
    /\bi\s+(?:read\s+up|researched|dug\s+into|studied|took\s+a\s+(?:course|workshop)|self[\s-]?taught|paired\s+with)\b/i,
    /\bi\s+(?:didn'?t\s+know|wasn'?t\s+familiar|hadn'?t\s+seen)\b[^.]{0,40}\b(?:so\s+i|i\s+(?:read|started|figured))\b/i,
    /\bi\s+(?:experimented|prototyped|spiked|ran\s+a\s+(?:poc|spike|experiment))\b/i,
  ],
  "earn-trust": [
    /\bi\s+(?:rebuilt|earned|regained|restored)\s+(?:the\s+)?trust\b/i,
    /\bi\s+(?:was\s+)?(?:honest|transparent|candid|upfront)\s+(?:with|about)\b/i,
    /\bi\s+(?:admitted|owned\s+up\s+to|came\s+clean\s+about)\b/i,
    /\bi\s+(?:flagged|escalated)\s+(?:it\s+|the\s+(?:issue|risk))/i,
  ],
  "deliver-results": [
    /\bi\s+(?:shipped|launched|delivered|released|rolled\s+out|went\s+live)\b/i,
    /\b(?:we|i)\s+(?:hit|met|beat)\s+(?:the\s+)?(?:target|deadline|sla|kpi|goal)\b/i,
    /\bon\s+(?:time|schedule)\b(?:[^.]{0,40}\b(?:shipped|delivered|launched))?/i,
  ],
  "think-big": [
    /\bi\s+(?:proposed|pitched|argued\s+for|made\s+the\s+case\s+for)\s+(?:a\s+(?:bigger|larger|long(?:er)?[\s-]?term|multi[\s-]?year))\b/i,
    /\b(?:long(?:er)?[\s-]?term|multi[\s-]?year|3[\s-]?year|5[\s-]?year|strategic|industry[\s-]?wide|company[\s-]?wide)\s+(?:vision|bet|investment|roadmap|play|plan)\b/i,
    /\bi\s+(?:zoomed\s+out|stepped\s+back|reframed)\b/i,
  ],
  "dive-deep": [
    /\bi\s+(?:investigated|root[\s-]?caused|debugged|traced|profiled|measured|instrumented|added\s+(?:logs|metrics|tracing)|dug\s+(?:into|in))\b/i,
    /\b(?:the\s+)?(?:data|metrics|numbers|logs)\s+showed\b/i,
    /\bi\s+(?:looked\s+at|pulled|queried)\s+the\s+(?:data|logs|metrics|db|database)\b/i,
  ],
  "influence-without-authority": [
    /\bi\s+(?:convinced|persuaded|got\s+buy[\s-]?in|aligned|won\s+(?:over|support))\b/i,
    /\bi\s+(?:partnered|collaborated|worked\s+across)\s+(?:with\s+)?(?:another|other|partner)\s+team/i,
    /\bcross[\s-]?(?:team|functional|org)\s+(?:alignment|buy[\s-]?in)\b/i,
  ],
  "invent-and-simplify": [
    /\bi\s+(?:simplified|streamlined|rethought|redesigned|reworked|cut\s+the\s+(?:scope|complexity))\b/i,
    /\bi\s+(?:proposed|introduced|invented|came\s+up\s+with)\s+a\s+(?:new|different|simpler)\b/i,
    /\bi\s+(?:questioned|challenged)\s+the\s+(?:process|assumption|status[\s-]?quo)\b/i,
  ],
};

/* Track-weighting: which competencies are load-bearing for each
 * hiring track. The analyzer surfaces all hits, but the report ranks
 * "top demonstrated" by the candidate's target track when known.
 * Weights are 1 (load-bearing) — kept boolean for now; can move to
 * graded weights when we have more signal. */
export const COMPETENCY_TRACK_WEIGHTS: Record<
  CompetencyTrack,
  Partial<Record<Competency, number>>
> = {
  "amazon-lp": {
    ownership: 1,
    "customer-obsession": 1,
    "bias-for-action": 1,
    "deliver-results": 1,
    "dive-deep": 1,
    "learn-and-be-curious": 1,
    "earn-trust": 1,
    "think-big": 1,
    "invent-and-simplify": 1,
  },
  google: {
    "dive-deep": 1,
    "learn-and-be-curious": 1,
    "influence-without-authority": 1,
    "earn-trust": 1,
    "invent-and-simplify": 1,
  },
  "indian-product": {
    ownership: 1,
    "customer-obsession": 1,
    "bias-for-action": 1,
    "deliver-results": 1,
    "influence-without-authority": 1,
  },
  "services-lateral": {
    "deliver-results": 1,
    "earn-trust": 1,
    "customer-obsession": 1,
    "influence-without-authority": 1,
  },
  startup: {
    ownership: 1,
    "bias-for-action": 1,
    "invent-and-simplify": 1,
    "deliver-results": 1,
  },
};

/* Human-readable labels for the report UI. Kept short (< 32 chars)
 * to fit badge chips — same constraint as COMPETENCY_LABELS in
 * data/behavioral-question-bank.ts. */
export const COMPETENCY_LABELS: Record<Competency, string> = {
  ownership: "Ownership",
  "customer-obsession": "Customer obsession",
  "bias-for-action": "Bias for action",
  "learn-and-be-curious": "Learn & be curious",
  "earn-trust": "Earn trust",
  "deliver-results": "Deliver results",
  "think-big": "Think big",
  "dive-deep": "Dive deep",
  "influence-without-authority": "Influence w/o authority",
  "invent-and-simplify": "Invent & simplify",
};

/** Detect competencies demonstrated in a single answer. Returns the
 *  Set of competency keys whose pattern set matched. Conservative —
 *  one pattern hit is enough, but the patterns themselves require
 *  first-person behavioural framing. */
export function detectCompetencies(text: string): Set<Competency> {
  const out = new Set<Competency>();
  if (!text) return out;
  for (const key of Object.keys(COMPETENCY_PATTERNS) as Competency[]) {
    if (COMPETENCY_PATTERNS[key].some((re) => re.test(text))) {
      out.add(key);
    }
  }
  return out;
}

/** Aggregate competency hits across all user answers in a session,
 *  returning frequency counts. Frequency matters: one ownership hit
 *  could be incidental, three across distinct stories is a pattern. */
export function aggregateCompetencies(
  answers: string[],
): Record<Competency, number> {
  const counts: Record<Competency, number> = {
    ownership: 0,
    "customer-obsession": 0,
    "bias-for-action": 0,
    "learn-and-be-curious": 0,
    "earn-trust": 0,
    "deliver-results": 0,
    "think-big": 0,
    "dive-deep": 0,
    "influence-without-authority": 0,
    "invent-and-simplify": 0,
  };
  for (const a of answers) {
    const hits = detectCompetencies(a);
    for (const c of hits) counts[c] += 1;
  }
  return counts;
}

/** Pick the top N competencies for a target track. Ties broken by
 *  raw count, then by taxonomy order (deterministic). Returns the
 *  competencies the candidate most clearly demonstrated against the
 *  track they're interviewing for. */
export function topCompetenciesForTrack(
  counts: Record<Competency, number>,
  track: CompetencyTrack | null,
  n = 3,
): Competency[] {
  const weights = track ? COMPETENCY_TRACK_WEIGHTS[track] : null;
  const scored = (Object.keys(counts) as Competency[])
    .map((c) => ({
      c,
      score: counts[c] * (weights?.[c] ?? 1),
      raw: counts[c],
    }))
    .filter((x) => x.raw > 0)
    .sort((a, b) => b.score - a.score || b.raw - a.raw);
  return scored.slice(0, n).map((x) => x.c);
}
