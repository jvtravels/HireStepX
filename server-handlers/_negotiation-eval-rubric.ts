/* Negotiation-eval rubric — the criteria every recorded scenario is
 * scored against.
 *
 * The rubric is split into two layers, deliberately:
 *
 *   1. STRUCTURAL criteria — deterministic, derivable from the final
 *      NegotiationState (ledger, decisionLog, askedTopics, offers).
 *      These run in vitest, in CI, with no API keys.
 *
 *   2. SUBJECTIVE criteria — require reading the transcript text and
 *      forming a qualitative judgment (tone, persona authenticity,
 *      whether the coaching at the end honestly reflects the session).
 *      These are scored by an LLM judge in scripts/eval-negotiation.ts,
 *      run on-demand or on a schedule, NOT in CI.
 *
 * Adding a new criterion: pick the right layer (don't ask an LLM to
 * check what code can verify; don't ask code to score "did this feel
 * like a real recruiter"). Both layers feed into the same scorecard.
 *
 * This file defines the rubric SHAPE and labels. The actual scoring
 * lives in _negotiation-eval-deterministic.ts (structural) and
 * scripts/eval-negotiation.ts (subjective). */

export type RubricLayer = "structural" | "subjective";

export interface RubricCriterion {
  /** Stable id used in scorecards and CI output. Don't rename. */
  id: string;
  /** One-line human-readable label. */
  label: string;
  /** Two-sentence explanation: what passes, what fails. */
  description: string;
  /** Which layer scores it. */
  layer: RubricLayer;
  /** Relative weight when computing the blended scenario score. Sum across all criteria isn't required to be 100 — we normalize at scoring time. */
  weight: number;
}

/* The canonical rubric. Order matters only for readability in the
 * scorecard — scoring is keyed by `id`. */
export const NEGOTIATION_RUBRIC: readonly RubricCriterion[] = [
  /* ------------------------- structural ------------------------- */
  {
    id: "discovery-before-anchor",
    label: "Asked current CTC before stating an offer",
    description:
      "Recruiter must have at least asked for current CTC (askedTopics: currentCtcAsked) before any anchor-shaped action is emitted in the decisionLog. Passes if currentCtcAsked appears before the first anchor; fails if anchor lands first.",
    layer: "structural",
    weight: 3,
  },
  {
    id: "first-wins-honored",
    label: "Honored first-wins on every disclosed fact",
    description:
      "Every FactKind in the ledger has exactly one source — the first disclosure. A later contradicting candidate statement must not overwrite it. Passes if no fact's value changed mid-session; fails on any overwrite.",
    layer: "structural",
    weight: 3,
  },
  {
    id: "no-coercion-guardrails",
    label: "Zero coercion guardrails fired",
    description:
      "pressure-repeat, stall-cascade, and anchor-double-set counts on the decisionLog must all be 0. Passes only if every guardrail is clean; the single-axis PDF fixtures already enforce per-flag bounds, this rubric line gates the whole scenario.",
    layer: "structural",
    weight: 2,
  },
  {
    id: "probe-once-per-topic",
    label: "Each discovery topic probed at most twice",
    description:
      "askedTopicCount(ledger, topic) ≤ 2 across every known discovery topic. The bound is 2 (not 1) because long scenarios may legitimately re-probe a topic the candidate answered ambiguously; runaway re-probing trips the test.",
    layer: "structural",
    weight: 2,
  },
  {
    id: "decisionlog-fully-mapped",
    label: "Every emitted action maps to a known family",
    description:
      "For every entry in decisionLog with an actionKind, familyOf(kind) must not be 'unmapped'. Passes only on a 100% mapping rate; an unmapped kind indicates a taxonomy gap that downstream guardrails and coaching can't reason about.",
    layer: "structural",
    weight: 1,
  },
  {
    id: "no-fabricated-facts",
    label: "Facts the candidate didn't disclose stay null",
    description:
      "For every FactKind listed in the scenario's `undisclosed` set, getFact(ledger, kind) must be null at end of session. Passes if all undisclosed slots are null; fails on any silent fabrication.",
    layer: "structural",
    weight: 3,
  },

  /* ------------------------- subjective ------------------------- */
  {
    id: "recruiter-persona-authentic",
    label: "Sounds like a real Indian-tech recruiter",
    description:
      "Tone, vocabulary, and pacing read as a working recruiter — not a template, not a coach mid-conversation, not an LLM. Specifically: uses LPA naturally, references fixed/variable/ESOP without explanation, stays in role across turns.",
    layer: "subjective",
    weight: 3,
  },
  {
    id: "coaching-grounded-in-session",
    label: "Post-session coaching reflects what actually happened",
    description:
      "Coaching points cite specific moments from the transcript, not generic advice. If the candidate did X well or poorly, the coaching names X. No invented strengths or weaknesses, no generic 'be more confident' filler.",
    layer: "subjective",
    weight: 3,
  },
  {
    id: "no-out-of-character-coaching",
    label: "Recruiter never broke character mid-session",
    description:
      "Across the in-session turns, the AI never lapsed into coach-mode, narration, or meta-commentary ('as your interview practice partner, I would suggest...'). Coaching belongs in the post-session report only.",
    layer: "subjective",
    weight: 2,
  },
] as const;

/** Total weight across the rubric — used to normalize scenario scores
 *  to a 0-100 scale. */
export const RUBRIC_TOTAL_WEIGHT = NEGOTIATION_RUBRIC.reduce(
  (sum, c) => sum + c.weight,
  0,
);

/** Subset that the deterministic scorer can evaluate without an LLM. */
export const STRUCTURAL_RUBRIC = NEGOTIATION_RUBRIC.filter(
  (c) => c.layer === "structural",
);

/** Subset that requires the LLM judge. */
export const SUBJECTIVE_RUBRIC = NEGOTIATION_RUBRIC.filter(
  (c) => c.layer === "subjective",
);
