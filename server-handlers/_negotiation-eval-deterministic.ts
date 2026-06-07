/* Negotiation-eval deterministic scorer — runs the STRUCTURAL rubric
 * criteria against a NegotiationState produced by the replay harness.
 *
 * No LLM calls. No file I/O. Pure function from (state, scenario) →
 * scorecard. Safe to run in vitest in CI on every PR.
 *
 * Returns a list of CriterionVerdict — one per structural criterion in
 * NEGOTIATION_RUBRIC — with pass/fail + a one-line reason. The reason
 * is what shows up in the CI failure message ("first-wins-honored:
 * FAIL — current-ctc changed from 18 to 19 at turn 6"), so it has to
 * be specific enough that a human can act on it without re-running.
 *
 * Subjective criteria are EXCLUDED here — they're scored by the LLM
 * judge in scripts/eval-negotiation.ts. The CI scorecard surfaces both
 * layers but only the structural layer gates the PR. */

import type { NegotiationState } from "./_negotiation-kernel";
import type { EvalScenario, EvalScenarioTurn } from "../data/negotiation-eval-scenarios";
import { detectTranscriptAntipatterns } from "./_prose-antipatterns";
import {
  getFact,
  askedTopicCount,
  isFactEntry,
  type ConversationLedger,
  type FactKind,
} from "./_conversation-ledger";
import {
  countGuardrailFlag,
} from "./_decision-log-readers";
import { familyOf } from "./_action-families";
import { STRUCTURAL_RUBRIC } from "./_negotiation-eval-rubric";

export type Verdict = "pass" | "fail" | "n/a";

export interface CriterionVerdict {
  criterionId: string;
  label: string;
  verdict: Verdict;
  /** One-line, action-oriented reason. Must be specific enough that a
   *  reader doesn't need to re-run to know what happened. */
  reason: string;
  weight: number;
}

export interface ScenarioScorecard {
  scenarioId: string;
  scenarioLabel: string;
  /** Per-criterion verdicts in rubric order. */
  verdicts: readonly CriterionVerdict[];
  /** Weighted pass rate over scored (non-n/a) criteria, 0..100. */
  score: number;
  /** True iff every scored criterion passed. */
  allPassed: boolean;
}

/* ----------------------------- helpers ----------------------------- */

/** Verifies first-wins at the READ layer — the architectural contract.
 *
 *  The ledger is append-only by design (audit trail across multiple
 *  candidate disclosures of the same fact). First-wins is enforced at
 *  READ time via `getFact`, which short-circuits on the first matching
 *  fact-* entry. So a "violation" is NOT the presence of contradicting
 *  audit entries — that's data — it's a mismatch between what `getFact`
 *  returns and the earliest recorded value.
 *
 *  Pre-EVAL-4 the scorer was over-strict: it flagged any divergent
 *  audit entry as a failure, which would (correctly) catch a scenario
 *  where the candidate self-corrects upward but (incorrectly) frame it
 *  as a kernel bug. The architectural contract says the kernel SHOULD
 *  append both (audit) and the read layer SHOULD return the first.
 *  This implementation tests that contract directly.
 *
 *  If a future refactor breaks `getFact` to return the LATEST value,
 *  every scenario with a re-disclosure trips immediately — exactly the
 *  regression detector we want. */
function findFirstWinsViolations(led: ConversationLedger): string[] {
  const firstByKind = new Map<FactKind, { value: unknown; turn: number }>();
  for (const entry of led.entries) {
    if (!isFactEntry(entry)) continue;
    const k = entry.kind.replace(/^fact-/, "") as FactKind;
    if (!firstByKind.has(k)) {
      firstByKind.set(k, { value: entry.value, turn: entry.atTurn });
    }
  }
  const violations: string[] = [];
  for (const [kind, first] of firstByKind) {
    const read = getFact(led, kind);
    if (read !== first.value) {
      violations.push(
        `getFact(${kind}) returned ${String(read)} but earliest-recorded was ${String(first.value)} at turn ${first.turn} — read layer broken`,
      );
    }
  }
  return violations;
}

/** Returns the turn-index of the first emitted action whose family is
 *  "anchor-set" (or null if none). Used by discovery-before-anchor.
 *  anchor-defend is excluded — by definition it follows an earlier
 *  anchor-set, so it's a downstream signal, not first-anchor evidence. */
function firstAnchorTurn(state: NegotiationState): number | null {
  for (const entry of state.decisionLog ?? []) {
    if (entry.family === "anchor-set") return entry.turn;
  }
  return null;
}

/** Returns the turn-index at which the planner FIRST knew the
 *  candidate's current CTC — either because it asked (askedTopic) OR
 *  because the candidate volunteered the fact unsolicited.
 *
 *  Both paths satisfy the underlying intent of the
 *  discovery-before-anchor rubric: "don't anchor without knowing
 *  current CTC". The original implementation only checked the
 *  askedTopic, which false-failed scenarios where a confident
 *  candidate disclosed CTC on turn 1 without being prompted. */
function firstCurrentCtcKnownTurn(led: ConversationLedger): number | null {
  let earliest: number | null = null;
  for (const entry of led.entries) {
    let candidate: number | null = null;
    if (entry.kind === "asked-topic" && entry.topic === "currentCtcAsked") {
      candidate = entry.atTurn;
    } else if (entry.kind === "fact-current-ctc") {
      candidate = entry.atTurn;
    }
    if (candidate !== null && (earliest === null || candidate < earliest)) {
      earliest = candidate;
    }
  }
  return earliest;
}

/* ----------------------------- scorers ----------------------------- */

function scoreDiscoveryBeforeAnchor(state: NegotiationState): CriterionVerdict {
  const knownAt = firstCurrentCtcKnownTurn(state.ledger!);
  const anchoredAt = firstAnchorTurn(state);
  if (anchoredAt === null) {
    return {
      criterionId: "discovery-before-anchor",
      label: "Knew current CTC before stating an offer",
      verdict: "n/a",
      reason: "no anchor action was emitted in this scenario",
      weight: 3,
    };
  }
  if (knownAt === null) {
    return {
      criterionId: "discovery-before-anchor",
      label: "Knew current CTC before stating an offer",
      verdict: "fail",
      reason: `anchor emitted at turn ${anchoredAt} but current CTC was never known (neither asked nor volunteered)`,
      weight: 3,
    };
  }
  if (knownAt > anchoredAt) {
    return {
      criterionId: "discovery-before-anchor",
      label: "Knew current CTC before stating an offer",
      verdict: "fail",
      reason: `anchor at turn ${anchoredAt} preceded current-CTC knowledge at turn ${knownAt}`,
      weight: 3,
    };
  }
  return {
    criterionId: "discovery-before-anchor",
    label: "Knew current CTC before stating an offer",
    verdict: "pass",
    reason: `current CTC known by turn ${knownAt}, anchor at turn ${anchoredAt}`,
    weight: 3,
  };
}

function scoreFirstWins(state: NegotiationState): CriterionVerdict {
  const violations = findFirstWinsViolations(state.ledger!);
  if (violations.length === 0) {
    return {
      criterionId: "first-wins-honored",
      label: "Honored first-wins on every disclosed fact",
      verdict: "pass",
      reason: "no fact-value changed across the session",
      weight: 3,
    };
  }
  return {
    criterionId: "first-wins-honored",
    label: "Honored first-wins on every disclosed fact",
    verdict: "fail",
    reason: violations.join("; "),
    weight: 3,
  };
}

function scoreNoCoercionGuardrails(state: NegotiationState): CriterionVerdict {
  const flags = ["pressure-repeat", "stall-cascade", "anchor-double-set"] as const;
  const nonzero = flags
    .map((f) => [f, countGuardrailFlag(state, f)] as const)
    .filter(([, c]) => c > 0);
  if (nonzero.length === 0) {
    return {
      criterionId: "no-coercion-guardrails",
      label: "Zero coercion guardrails fired",
      verdict: "pass",
      reason: "pressure-repeat, stall-cascade, anchor-double-set all 0",
      weight: 2,
    };
  }
  return {
    criterionId: "no-coercion-guardrails",
    label: "Zero coercion guardrails fired",
    verdict: "fail",
    reason: nonzero.map(([f, c]) => `${f}=${c}`).join(", "),
    weight: 2,
  };
}

const PROBE_TOPICS = [
  "currentCtcAsked",
  "targetAsked",
  "noticePeriodAsked",
  "competingOffersAsked",
  "fixedVariableSplitAsked",
  "valueProofAsked",
] as const;

function scoreProbeOnce(state: NegotiationState): CriterionVerdict {
  const offenders = PROBE_TOPICS
    .map((t) => [t, askedTopicCount(state.ledger!, t)] as const)
    .filter(([, c]) => c > 2);
  if (offenders.length === 0) {
    return {
      criterionId: "probe-once-per-topic",
      label: "Each discovery topic probed at most twice",
      verdict: "pass",
      reason: "every discovery topic probed ≤ 2 times",
      weight: 2,
    };
  }
  return {
    criterionId: "probe-once-per-topic",
    label: "Each discovery topic probed at most twice",
    verdict: "fail",
    reason: offenders.map(([t, c]) => `${t}=${c}`).join(", "),
    weight: 2,
  };
}

function scoreDecisionLogMapped(state: NegotiationState): CriterionVerdict {
  const unmapped: string[] = [];
  for (const entry of state.decisionLog ?? []) {
    if (!entry.actionKind) continue;
    if (familyOf(entry.actionKind) === "unmapped") {
      unmapped.push(`turn ${entry.turn}: ${entry.actionKind}`);
    }
  }
  if (unmapped.length === 0) {
    return {
      criterionId: "decisionlog-fully-mapped",
      label: "Every emitted action maps to a known family",
      verdict: "pass",
      reason: `${state.decisionLog?.length ?? 0} entries, all mapped`,
      weight: 1,
    };
  }
  return {
    criterionId: "decisionlog-fully-mapped",
    label: "Every emitted action maps to a known family",
    verdict: "fail",
    reason: unmapped.slice(0, 3).join("; ") + (unmapped.length > 3 ? ` (+${unmapped.length - 3} more)` : ""),
    weight: 1,
  };
}

function scoreNoFabricatedFacts(
  state: NegotiationState,
  scenario: EvalScenario,
): CriterionVerdict {
  const fabricated = scenario.undisclosed
    .map((k) => [k, getFact(state.ledger!, k)] as const)
    .filter(([, v]) => v !== null);
  if (fabricated.length === 0) {
    return {
      criterionId: "no-fabricated-facts",
      label: "Facts the candidate didn't disclose stay null",
      verdict: "pass",
      reason: `all ${scenario.undisclosed.length} undisclosed facts stayed null`,
      weight: 3,
    };
  }
  return {
    criterionId: "no-fabricated-facts",
    label: "Facts the candidate didn't disclose stay null",
    verdict: "fail",
    reason: fabricated.map(([k, v]) => `${k}=${String(v)}`).join(", "),
    weight: 3,
  };
}

function scoreDisclosedFactsBound(
  state: NegotiationState,
  scenario: EvalScenario,
): CriterionVerdict {
  const expected = scenario.expectedDisclosures;
  if (!expected || Object.keys(expected).length === 0) {
    return {
      criterionId: "disclosed-facts-bound",
      label: "Facts the candidate DID disclose are bound to the right value",
      verdict: "n/a",
      reason: "scenario did not declare expectedDisclosures",
      weight: 3,
    };
  }
  const mismatches: string[] = [];
  for (const [kind, expectedValue] of Object.entries(expected)) {
    const bound = getFact(state.ledger!, kind as FactKind);
    if (bound !== expectedValue) {
      mismatches.push(`${kind}: expected ${String(expectedValue)}, got ${String(bound)}`);
    }
  }
  if (mismatches.length === 0) {
    return {
      criterionId: "disclosed-facts-bound",
      label: "Facts the candidate DID disclose are bound to the right value",
      verdict: "pass",
      reason: `all ${Object.keys(expected).length} declared disclosures bound correctly`,
      weight: 3,
    };
  }
  return {
    criterionId: "disclosed-facts-bound",
    label: "Facts the candidate DID disclose are bound to the right value",
    verdict: "fail",
    reason: mismatches.join("; "),
    weight: 3,
  };
}

function scoreProseAntipatterns(
  _state: NegotiationState,
  scenario: EvalScenario,
  transcriptTurns?: readonly EvalScenarioTurn[],
): CriterionVerdict {
  const turns = transcriptTurns ?? scenario.turns;
  const hits = detectTranscriptAntipatterns(turns);
  if (hits.length === 0) {
    return {
      criterionId: "prose-antipatterns-zero",
      label: "Recruiter prose has zero deterministic antipatterns",
      verdict: "pass",
      reason: `scanned ${turns.length} turns; no antipatterns fired`,
      weight: 2,
    };
  }
  const reason = hits
    .slice(0, 3)
    .map((h) => `turn ${h.turnIndex}: ${h.pattern.id}`)
    .join("; ") + (hits.length > 3 ? ` (+${hits.length - 3} more)` : "");
  return {
    criterionId: "prose-antipatterns-zero",
    label: "Recruiter prose has zero deterministic antipatterns",
    verdict: "fail",
    reason,
    weight: 2,
  };
}

/* ----------------------------- entrypoint ----------------------------- */

/** Score one scenario's final state against the structural rubric.
 *  Returns a scorecard with verdicts in rubric order.
 *
 *  transcriptTurns is optional: when provided (by the generated harness),
 *  prose-antipattern scoring runs against the LLM-produced bot text
 *  instead of the fixture aiText. When omitted, fixture aiText is used. */
export function scoreScenarioStructural(
  state: NegotiationState,
  scenario: EvalScenario,
  transcriptTurns?: readonly EvalScenarioTurn[],
): ScenarioScorecard {
  const verdicts: CriterionVerdict[] = [
    scoreDiscoveryBeforeAnchor(state),
    scoreFirstWins(state),
    scoreNoCoercionGuardrails(state),
    scoreProbeOnce(state),
    scoreDecisionLogMapped(state),
    scoreNoFabricatedFacts(state, scenario),
    scoreDisclosedFactsBound(state, scenario),
    scoreProseAntipatterns(state, scenario, transcriptTurns),
  ];

  // Sanity: every structural criterion in the rubric must be scored
  // here. If a future PR adds a criterion to the rubric without adding
  // a scorer, fail loudly rather than silently mis-scoring.
  const rubricIds = new Set(STRUCTURAL_RUBRIC.map((c) => c.id));
  const scoredIds = new Set(verdicts.map((v) => v.criterionId));
  for (const id of rubricIds) {
    if (!scoredIds.has(id)) {
      throw new Error(
        `negotiation-eval: structural criterion "${id}" is in the rubric but no scorer was registered for it`,
      );
    }
  }

  const scored = verdicts.filter((v) => v.verdict !== "n/a");
  const earnedWeight = scored
    .filter((v) => v.verdict === "pass")
    .reduce((s, v) => s + v.weight, 0);
  const totalWeight = scored.reduce((s, v) => s + v.weight, 0);
  const score = totalWeight === 0 ? 100 : Math.round((earnedWeight / totalWeight) * 100);
  const allPassed = scored.every((v) => v.verdict === "pass");

  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    verdicts,
    score,
    allPassed,
  };
}

/** Format a scorecard for human-readable output (CI log, console).
 *  One line per criterion + a final summary line. */
export function formatScorecard(card: ScenarioScorecard): string {
  const lines = [`# ${card.scenarioId} — ${card.score}/100${card.allPassed ? "  ✓" : ""}`];
  for (const v of card.verdicts) {
    const mark = v.verdict === "pass" ? "✓" : v.verdict === "fail" ? "✗" : "·";
    lines.push(`  ${mark} ${v.criterionId}: ${v.reason}`);
  }
  return lines.join("\n");
}
