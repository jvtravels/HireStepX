/* Per-focus signature metrics, the three numbers that define quality in
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
  /** What to measure, one precise instruction, second person to the model. */
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
      measure: "Share of ownership statements told in 'I' rather than 'we' (Indian-register 'we' is not penalised, judge whether the personal slice was nameable).",
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
        `  ${i + 1}. label "${s.label}", ${s.measure}\n` +
        `     value format: ${s.valueHint}; tone: ${s.toneRule}.`,
    )
    .join("\n");
  return (
    `\n\nFOCUS SIGNATURE METRICS (focus=${type}), populate the "focusMetrics" array with EXACTLY these ${specs.length} metrics, in this order, each grounded in the transcript. Echo the label verbatim. "value" must be a SHORT display string (the example format), never a sentence. "tone" is one of good|watch|miss|neutral, use "neutral" only when the metric genuinely had no good/bad signal in this round (e.g. the situation never came up).\n${lines}`
  );
}

/** The pinned label set for a focus, used by normalizeFocusMetrics to keep
 *  only metrics whose label matches the spec (defends against drift). */
export function signatureLabels(type: string | undefined): string[] {
  if (!type) return [];
  return (FOCUS_SIGNATURE_SPECS[type] ?? []).map((s) => s.label);
}

/* ── Per-question focus metrics ──────────────────────────────────────────────
 * Each per-question card in the report shows 4 mini metric tiles that replace
 * the generic (Words / Length / First-person / Quantified) strip with focus-
 * specific signal. The LLM emits these inside each `perQuestion[].focusMetrics`
 * entry — same tone enum (good|watch|miss|neutral) as the session-level strip. */

export interface PerQuestionMetricSpec {
  label: string;
  measure: string;
  valueHint: string;
  toneRule: string;
}

export const PER_QUESTION_METRIC_SPECS: Record<string, PerQuestionMetricSpec[]> = {
  behavioral: [
    { label: "Words",          measure: "Word count of the candidate's answer.",                                                                   valueHint: '"218"',    toneRule: "good 120-240, watch <80 or >300, miss extreme outliers" },
    { label: "First-person %", measure: "Share of ownership statements told as 'I' vs 'we'.",                                                      valueHint: '"64%"',    toneRule: "good ≥60, watch 40-59, miss <40" },
    { label: "Specifics",      measure: "Count of concrete specifics: named numbers, dates, company names, or outcomes.",                          valueHint: '"5"',      toneRule: "good ≥4, watch 2-3, miss ≤1" },
    { label: "STAR coverage",  measure: "Percentage of STAR elements present (Situation, Task, Action, Result, L is bonus).",                     valueHint: '"100%"',   toneRule: "good 100, watch 75, miss ≤50" },
  ],
  technical: [
    { label: "Approaches",    measure: "Count of distinct solution approaches the candidate articulated (brute-force + optimal = 2).",              valueHint: '"2"',             toneRule: "good ≥2, watch 1 with reasoning, miss 1 with none" },
    { label: "Complexity",    measure: "Whether the candidate stated Big-O for their final answer.",                                                valueHint: '"Stated" or "Not stated"', toneRule: "good stated, miss not stated" },
    { label: "Edge cases",    measure: "Count of distinct edge cases raised unprompted.",                                                           valueHint: '"3"',             toneRule: "good ≥3, watch 1-2, miss 0" },
    { label: "Test cases",    measure: "Count of concrete test-case examples the candidate mentioned.",                                             valueHint: '"2"',             toneRule: "good ≥2, watch 1, miss 0" },
  ],
  "case-study": [
    { label: "Framework",      measure: "Whether the candidate named and held a structuring framework through the answer.",                        valueHint: '"Yes" or "No"', toneRule: "good when named and held, watch named but loose, miss absent" },
    { label: "Solutions",      measure: "Count of distinct solution options the candidate generated before recommending.",                          valueHint: '"4"',           toneRule: "good ≥3, watch 2, miss ≤1" },
    { label: "Recommendation", measure: "Whether the candidate landed a clear decisive recommendation (vs hedging).",                              valueHint: '"Yes" or "No"', toneRule: "good clear and defended, watch present but soft, miss none" },
    { label: "Metrics named",  measure: "Count of success metrics or guardrails the candidate named.",                                             valueHint: '"1"',           toneRule: "good ≥2, watch 1, miss 0" },
  ],
  "system-design": [
    { label: "Components",     measure: "Count of distinct, justified system components in the candidate's design.",                               valueHint: '"6"',           toneRule: "good ≥5, watch 3-4, miss <3" },
    { label: "Capacity stated",measure: "Whether the candidate sized the system (TPS/QPS/storage) before designing.",                              valueHint: '"Yes" or "No"', toneRule: "good stated with numbers, watch vague, miss skipped" },
    { label: "DB justified",   measure: "Whether the candidate justified their database choice (why SQL vs NoSQL, etc.).",                          valueHint: '"Yes" or "No"', toneRule: "good justified, watch vague, miss not mentioned" },
    { label: "Failure modes",  measure: "Count of failure modes / bottlenecks the candidate reasoned about.",                                      valueHint: '"2"',           toneRule: "good ≥2, watch 1, miss 0" },
  ],
  strategic: [
    { label: "Stakeholders",      measure: "Count of distinct stakeholder groups the candidate explicitly reasoned about.",                        valueHint: '"4"',           toneRule: "good ≥3, watch 2, miss ≤1" },
    { label: "Time horizons",     measure: "How many time horizons (now / next / later) the candidate separated in their answer.",                 valueHint: '"3"',           toneRule: "good ≥2, watch 1, miss 0" },
    { label: "Decision criteria", measure: "Count of concrete criteria the candidate used to evaluate options.",                                   valueHint: '"5"',           toneRule: "good ≥3, watch 2, miss ≤1" },
    { label: "Risk owned",        measure: "Whether the candidate named a falsifiable risk they'd own rather than only upside.",                   valueHint: '"Yes" or "No"', toneRule: "good when real risk owned, watch hedged, miss none" },
  ],
  "campus-placement": [
    { label: "Project ownership", measure: "Share of project claims stated as the candidate's specific contribution vs the team's.",               valueHint: '"38%"',         toneRule: "good ≥60, watch 40-59, miss <40" },
    { label: "Architectural",     measure: "Count of architectural or design decisions the candidate explained with a 'why'.",                     valueHint: '"2"',           toneRule: "good ≥2, watch 1, miss 0" },
    { label: "Fundamentals",      measure: "Count of core-fundamentals questions (OOP, OS, DBMS, DSA) answered correctly out of those asked.",    valueHint: '"5"',           toneRule: "good nearly all correct, watch mixed, miss most missed" },
    { label: "Specific reasons",  measure: "Count of times the candidate gave a specific 'why' behind a tech/design choice rather than just 'what'.", valueHint: '"1"',       toneRule: "good ≥2, watch 1, miss 0" },
  ],
  panel: [
    { label: "Panelists addressed", measure: "Count of panelists the candidate directly addressed or engaged in this answer.",                     valueHint: '"3"',     toneRule: "good all present, watch most, miss fixated on one" },
    { label: "Direct response",     measure: "Percentage of the answer that directly addressed what the asking panelist asked (vs pivoting away).", valueHint: '"90%"',  toneRule: "good ≥80, watch 60-79, miss <60" },
    { label: "Tone shifts",         measure: "Count of times the candidate adapted register to a different panelist in this answer.",               valueHint: '"2"',     toneRule: "good ≥1, neutral 0" },
    { label: "Cross-references",    measure: "Count of times the candidate bridged back to an earlier panelist's question or comment.",            valueHint: '"1"',     toneRule: "good ≥1, neutral 0" },
  ],
  "government-psu": [
    { label: "Ethics keywords",    measure: "Count of explicit ethics/integrity/impartiality markers in the answer.",                              valueHint: '"4"',     toneRule: "good ≥3, watch 1-2, miss 0" },
    { label: "Public examples",    measure: "Count of real public-sector schemes, policies, or rulings cited by name.",                            valueHint: '"0"',     toneRule: "good ≥2, watch 1, miss 0" },
    { label: "Service language",   measure: "Count of appropriate public-service register markers (serve, citizen, public interest, hierarchy).",  valueHint: '"6"',     toneRule: "good ≥4, watch 2-3, miss ≤1" },
    { label: "Specific policies",  measure: "Count of specific acts, articles, provisions, or rules cited correctly.",                             valueHint: '"0"',     toneRule: "good ≥2, watch 1, miss 0" },
  ],
  management: [
    { label: "People scope",       measure: "Whether the candidate quantified the team or budget they managed.",                                   valueHint: '"Quantified" or "Vague"', toneRule: "good quantified, watch partial, miss absent" },
    { label: "Decision ownership", measure: "Whether the candidate owned a hard management call vs describing what 'we' did.",                     valueHint: '"Yes" or "No"',           toneRule: "good owned, watch shared, miss deflected" },
    { label: "Coaching examples",  measure: "Count of concrete examples of developing or course-correcting a direct report.",                      valueHint: '"2"',                     toneRule: "good ≥2, watch 1, miss 0" },
    { label: "Conflict handled",   measure: "Whether the candidate described how a team conflict was resolved rather than avoided.",                valueHint: '"Yes" or "No"',           toneRule: "good resolved with outcome, watch partial, miss avoided/absent" },
  ],
  "salary-negotiation": [
    { label: "Anchor delta",      measure: "How far above the AI's offer the candidate counter-anchored, as a percent (0% = accepted without counter).", valueHint: '"+37%" or "0%"',          toneRule: "good ≥+15, watch +1-14, miss 0 or below" },
    { label: "Concessions",       measure: "How many concessions the candidate gave in this turn, out of how many were pressed for.",                    valueHint: '"0 / 1" (given / pressed)', toneRule: "good 0 given, watch partial, miss folded first push" },
    { label: "Silence held",      measure: "Estimated post-counter pause before the candidate spoke again (longer = more confident).",                   valueHint: '"4.2s"',                  toneRule: "good ≥3s, watch 1-2.9s, miss <1s" },
    { label: "Disclosure leaks",  measure: "Count of premature disclosures that weakened leverage (current salary, hard ceiling, urgency).",             valueHint: '"0"',                     toneRule: "good 0, watch 1, miss ≥2" },
  ],
};

/* `managerial` shares the management spec. */
PER_QUESTION_METRIC_SPECS.managerial = PER_QUESTION_METRIC_SPECS.management;

/**
 * Render per-question metric instructions for the evaluator prompt. Returns ""
 * when the focus has no per-question spec (metrics tile falls back to generic
 * Words/Length/First-person/Quantified in the UI). Injected into the
 * `perQuestion` section of the prompt so the LLM knows what to emit per item.
 */
export function formatPerQuestionMetricsPrompt(type: string | undefined): string {
  if (!type) return "";
  const specs = PER_QUESTION_METRIC_SPECS[type];
  if (!specs || specs.length === 0) return "";
  const lines = specs
    .map(
      (s, i) =>
        `    ${i + 1}. label "${s.label}", ${s.measure}\n` +
        `       value format: ${s.valueHint}; tone: ${s.toneRule}.`,
    )
    .join("\n");
  return (
    `\n\nPER-QUESTION FOCUS METRICS (focus=${type}), inside each perQuestion item, also emit:\n` +
    `  "focusMetrics": [\n` +
    `    // Exactly these ${specs.length} metrics per question, in this order.\n` +
    `    // Echo labels verbatim. "value" is a SHORT display string (see format). "tone" is good|watch|miss|neutral.\n` +
    `    { "label": "...", "value": "...", "tone": "good|watch|miss|neutral" }\n` +
    `  ]\n${lines}`
  );
}
