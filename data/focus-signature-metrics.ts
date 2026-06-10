/* Per-focus signature metrics — the three numbers that define quality in
 * each interview focus. These are the instrument panel on the session card:
 * anchor delta for a negotiation, STAR coverage for a behavioral, capacity
 * math for a system design. A generic "did well / work on next" pair throws
 * away the single most focus-specific signal the evaluator can produce.
 *
 * The LABELS are pinned here in code (not invented by the LLM) so the card's
 * strip is deterministic across sessions and the tone thresholds stay
 * consistent. The evaluator fills in `value` (a short display string) and
 * `tone` (good / watch / miss / neutral) per metric, grounded in the
 * transcript. See server-handlers/evaluate-session.ts (prompt + schema) and
 * _evaluate-session-helpers.ts (normalizeFocusMetrics, the trust boundary).
 *
 * Keys match the focus `type` passed to the evaluator (the RECIPES keys in
 * focus-question-recipes.ts: behavioral, salary-negotiation, system-design,
 * …). A focus with no spec here simply emits no strip — the card degrades to
 * the plain-language coaching pair, never invents a number. */

export type FocusMetricTone = "good" | "watch" | "miss" | "neutral";

/** A persisted, display-ready metric. `value` is a string because the strip
 *  shows mixed forms — "88%", "0 / 1", "Not stated", "+37%", "4". */
export interface FocusMetric {
  label: string;
  value: string;
  tone: FocusMetricTone;
}

/** Authoring spec for one metric: the fixed label plus the guidance the LLM
 *  needs to compute its value + tone honestly from the transcript. */
export interface SignatureMetricSpec {
  /** Pinned, shown verbatim on the card. ≤ ~18 chars so the strip stays tidy. */
  label: string;
  /** What to measure — one precise instruction, second person to the model. */
  measure: string;
  /** Example value FORMAT so the model emits a renderable string, not prose. */
  valueHint: string;
  /** When each tone applies. Keeps green/amber/red consistent across sessions. */
  toneRule: string;
}

/* Three per focus. Ordered win-leaning → gap-leaning isn't required (the card
   renders them left-to-right as authored); order them the way an evaluator
   reads the round. */
export const FOCUS_SIGNATURE_SPECS: Record<string, SignatureMetricSpec[]> = {
  behavioral: [
    {
      label: "STAR coverage",
      measure: "Share of behavioral answers that contained all four of Situation, Task, Action, Result.",
      valueHint: '"88%"',
      toneRule: "good ≥80, watch 60-79, miss <60",
    },
    {
      label: "First-person",
      measure: "Share of ownership statements told in 'I' rather than 'we' (Indian-register 'we' is not penalised — judge whether the personal slice was nameable).",
      valueHint: '"71%"',
      toneRule: "good ≥65, watch 45-64, miss <45",
    },
    {
      label: "Conflict balance",
      measure: "Across conflict/disagreement stories, how many presented BOTH the other side's view and the candidate's, out of how many were told.",
      valueHint: '"1 / 1" (balanced / total); "0 / 1" if unbalanced',
      toneRule: "good when all balanced, watch when partial, miss when 0 balanced (use neutral if no conflict story arose)",
    },
  ],
  technical: [
    {
      label: "Approaches",
      measure: "How many distinct solution approaches the candidate articulated before committing (brute-force then optimised counts as 2).",
      valueHint: '"2"',
      toneRule: "good ≥2, watch 1 with reasoning, miss 1 with none",
    },
    {
      label: "Complexity",
      measure: "Whether the candidate stated time/space complexity (Big-O) for their final answer.",
      valueHint: '"Stated" or "Not stated"',
      toneRule: "good when stated and correct, watch when stated loosely, miss when not stated",
    },
    {
      label: "Edge cases",
      measure: "Count of distinct edge cases / failure inputs the candidate raised unprompted.",
      valueHint: '"3"',
      toneRule: "good ≥3, watch 1-2, miss 0",
    },
  ],
  "case-study": [
    {
      label: "Framework",
      measure: "Whether the candidate named a structuring framework and held it through the answer (vs drifting).",
      valueHint: '"Held" or "Dropped"',
      toneRule: "good when named and held, watch when named but loose, miss when absent",
    },
    {
      label: "Recommendation",
      measure: "Whether the candidate landed a clear, decisive recommendation rather than hedging.",
      valueHint: '"Clear" or "Vague"',
      toneRule: "good when clear and defended, watch when present but soft, miss when none",
    },
    {
      label: "Success metric",
      measure: "How many recommendations were paired with a measurable success metric (and ideally a guardrail).",
      valueHint: '"1 named" or "None"',
      toneRule: "good ≥1 with guardrail, watch 1 without guardrail, miss none",
    },
  ],
  "system-design": [
    {
      label: "Capacity stated",
      measure: "Whether the candidate sized the system (TPS / QPS / storage / spike) before designing.",
      valueHint: '"Yes" or "No"',
      toneRule: "good when sized with numbers, watch when vague, miss when skipped",
    },
    {
      label: "Components",
      measure: "Count of distinct, justified components in the candidate's architecture.",
      valueHint: '"6"',
      toneRule: "good ≥5, watch 3-4, miss <3",
    },
    {
      label: "Failure modes",
      measure: "Count of failure modes / bottlenecks the candidate reasoned about (replication, hot keys, retries).",
      valueHint: '"2"',
      toneRule: "good ≥2, watch 1, miss 0",
    },
  ],
  "salary-negotiation": [
    {
      label: "Anchor delta",
      measure: "How far above the opening/expected figure the candidate anchored, as a percent (0% if they never counter-anchored).",
      valueHint: '"+37%" or "0%"',
      toneRule: "good ≥+15%, watch +1-14%, miss 0% or anchored below",
    },
    {
      label: "Concessions",
      measure: "How many concessions the candidate gave up, out of how many were pressed for.",
      valueHint: '"0 / 3" (given / pressed)',
      toneRule: "good when 0 given, watch partial, miss when folded on the first push",
    },
    {
      label: "Disclosure leaks",
      measure: "Count of premature disclosures that weakened leverage (current salary, hard ceiling, urgency).",
      valueHint: '"0"',
      toneRule: "good 0, watch 1, miss ≥2",
    },
  ],
  strategic: [
    {
      label: "Stakeholders",
      measure: "Count of distinct stakeholder constituencies the candidate explicitly reasoned about.",
      valueHint: '"4"',
      toneRule: "good ≥3, watch 2, miss ≤1",
    },
    {
      label: "Time horizons",
      measure: "How many time horizons (now / next / later) the candidate separated in their plan.",
      valueHint: '"3"',
      toneRule: "good ≥2, watch 1, miss 0",
    },
    {
      label: "Risk owned",
      measure: "Whether the candidate named a falsifiable risk/bet they own rather than only upside.",
      valueHint: '"Yes" or "No"',
      toneRule: "good when a real risk is owned, watch when hedged, miss when none",
    },
  ],
  "campus-placement": [
    {
      label: "Project ownership",
      measure: "Share of project claims stated as the candidate's specific contribution vs the team's.",
      valueHint: '"38%"',
      toneRule: "good ≥60, watch 40-59, miss <40",
    },
    {
      label: "Fundamentals",
      measure: "How many core-fundamentals checks (OOP, DBMS, OS, networks, DSA) the candidate answered correctly, out of those asked.",
      valueHint: '"5 / 5"',
      toneRule: "good when nearly all correct, watch when mixed, miss when most missed",
    },
    {
      label: "Tech reasoning",
      measure: "Count of moments the candidate explained WHY behind a choice rather than only WHAT.",
      valueHint: '"1"',
      toneRule: "good ≥2, watch 1, miss 0",
    },
  ],
  panel: [
    {
      label: "Panelists",
      measure: "How many panelists the candidate addressed/engaged, out of the number on the panel.",
      valueHint: '"3 / 3"',
      toneRule: "good when all engaged, watch when most, miss when fixated on one",
    },
    {
      label: "Tone shifts",
      measure: "Count of times the candidate adapted register to a different panelist (technical vs HR vs senior).",
      valueHint: '"2"',
      toneRule: "good ≥2, watch 1, miss 0",
    },
    {
      label: "Cross-refs",
      measure: "Count of times the candidate bridged/connected one panelist's question to another's.",
      valueHint: '"1"',
      toneRule: "good ≥1, neutral 0 (nice-to-have, not a failure)",
    },
  ],
  "hr-round": [
    {
      label: "Motivation",
      measure: "Whether the candidate's reason for the move/company was specific and grounded vs generic.",
      valueHint: '"Specific" or "Generic"',
      toneRule: "good when specific with evidence, watch when partly, miss when generic",
    },
    {
      label: "Negative words",
      measure: "Count of negative/blaming references to current employer, manager, or team.",
      valueHint: '"0"',
      toneRule: "good 0, watch 1-2, miss ≥3",
    },
    {
      label: "Red flags",
      measure: "Count of rejection-grade HR red flags (entitlement, dishonesty about notice/comp, blame).",
      valueHint: '"0"',
      toneRule: "good 0, watch 1, miss ≥2",
    },
  ],
  "government-psu": [
    {
      label: "Schemes cited",
      measure: "Count of specific schemes/policies/provisions the candidate cited by name.",
      valueHint: '"0"',
      toneRule: "good ≥2, watch 1, miss 0",
    },
    {
      label: "Rulings invoked",
      measure: "Count of specific rulings/articles/rules the candidate invoked correctly.",
      valueHint: '"0"',
      toneRule: "good ≥1, watch 0 with sound principle, miss 0 with vague principle",
    },
    {
      label: "Service language",
      measure: "Count of appropriate public-service register markers (impartiality, integrity, hierarchy, public interest).",
      valueHint: '"6"',
      toneRule: "good ≥4, watch 2-3, miss ≤1",
    },
  ],
  management: [
    {
      label: "People scope",
      measure: "Whether the candidate quantified the team/scope they managed (reports, budget, surface).",
      valueHint: '"Quantified" or "Vague"',
      toneRule: "good when quantified, watch when partial, miss when absent",
    },
    {
      label: "Decision ownership",
      measure: "Whether the candidate owned a hard management decision rather than describing the team's.",
      valueHint: '"Yes" or "No"',
      toneRule: "good when owned, watch when shared, miss when deflected",
    },
    {
      label: "Coaching examples",
      measure: "Count of concrete examples of developing or correcting a report.",
      valueHint: '"2"',
      toneRule: "good ≥2, watch 1, miss 0",
    },
  ],
};

/* `managerial` is an alias of `management` in RECIPES; share the spec. */
FOCUS_SIGNATURE_SPECS.managerial = FOCUS_SIGNATURE_SPECS.management;

/**
 * Render the signature-metric instructions for the evaluator prompt. Returns
 * "" when the focus has no spec (the model then omits focusMetrics). Emitted
 * after the cacheable prefix alongside the focus rubric.
 */
export function formatSignatureMetricsPrompt(type: string | undefined): string {
  if (!type) return "";
  const specs = FOCUS_SIGNATURE_SPECS[type];
  if (!specs || specs.length === 0) return "";
  const lines = specs
    .map(
      (s, i) =>
        `  ${i + 1}. label "${s.label}" — ${s.measure}\n` +
        `     value format: ${s.valueHint}; tone: ${s.toneRule}.`,
    )
    .join("\n");
  return (
    `\n\nFOCUS SIGNATURE METRICS (focus=${type}) — populate the "focusMetrics" array with EXACTLY these ${specs.length} metrics, in this order, each grounded in the transcript. Echo the label verbatim. "value" must be a SHORT display string (the example format), never a sentence. "tone" is one of good|watch|miss|neutral — use "neutral" only when the metric genuinely had no good/bad signal in this round (e.g. the situation never came up).\n${lines}`
  );
}

/** The pinned label set for a focus — used by normalizeFocusMetrics to keep
 *  only metrics whose label matches the spec (defends against drift). */
export function signatureLabels(type: string | undefined): string[] {
  if (!type) return [];
  return (FOCUS_SIGNATURE_SPECS[type] ?? []).map((s) => s.label);
}
