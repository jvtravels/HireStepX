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
import type { EvalScenario } from "../data/negotiation-eval-scenarios";
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

/** Returns the set of FactKinds that appear in the ledger with MORE
 *  than one fact-* entry — i.e. the candidate restated the fact and
 *  the planner re-recorded it. First-wins is enforced at READ time
 *  (getFact), but the AUDIT trail of re-disclosures lives in the
 *  ledger. We check both: the read-value is stable AND no re-recorded
 *  fact disagrees with the first-recorded one for the same kind. */
function findFirstWinsViolations(led: ConversationLedger): string[] {
  const byKind = new Map<FactKind, { firstValue: unknown; firstTurn: number }>();
  const violations: string[] = [];
  for (const entry of led.entries) {
    if (!isFactEntry(entry)) continue;
    // entry.kind is "fact-<factkind>"; strip the prefix.
    const k = entry.kind.replace(/^fact-/, "") as FactKind;
    const seen = byKind.get(k);
    if (!seen) {
      byKind.set(k, { firstValue: entry.value, firstTurn: entry.atTurn });
      continue;
    }
    if (seen.firstValue !== entry.value) {
      violations.push(
        `${k} changed from ${String(seen.firstValue)} (turn ${seen.firstTurn}) to ${String(entry.value)} (turn ${entry.atTurn})`,
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

/** Returns the turn-index at which currentCtcAsked first appeared in
 *  the ledger (or null if it never did). */
function firstCurrentCtcAskedTurn(led: ConversationLedger): number | null {
  for (const entry of led.entries) {
    if (entry.kind === "asked-topic" && entry.topic === "currentCtcAsked") {
      return entry.atTurn;
    }
  }
  return null;
}

/* ----------------------------- scorers ----------------------------- */

function scoreDiscoveryBeforeAnchor(state: NegotiationState): CriterionVerdict {
  const askedAt = firstCurrentCtcAskedTurn(state.ledger!);
  const anchoredAt = firstAnchorTurn(state);
  if (anchoredAt === null) {
    return {
      criterionId: "discovery-before-anchor",
      label: "Asked current CTC before stating an offer",
      verdict: "n/a",
      reason: "no anchor action was emitted in this scenario",
      weight: 3,
    };
  }
  if (askedAt === null) {
    return {
      criterionId: "discovery-before-anchor",
      label: "Asked current CTC before stating an offer",
      verdict: "fail",
      reason: `anchor emitted at turn ${anchoredAt} but currentCtcAsked never recorded`,
      weight: 3,
    };
  }
  if (askedAt > anchoredAt) {
    return {
      criterionId: "discovery-before-anchor",
      label: "Asked current CTC before stating an offer",
      verdict: "fail",
      reason: `anchor at turn ${anchoredAt} preceded currentCtcAsked at turn ${askedAt}`,
      weight: 3,
    };
  }
  return {
    criterionId: "discovery-before-anchor",
    label: "Asked current CTC before stating an offer",
    verdict: "pass",
    reason: `currentCtcAsked at turn ${askedAt}, anchor at turn ${anchoredAt}`,
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

/* ----------------------------- entrypoint ----------------------------- */

/** Score one scenario's final state against the structural rubric.
 *  Returns a scorecard with verdicts in rubric order. */
export function scoreScenarioStructural(
  state: NegotiationState,
  scenario: EvalScenario,
): ScenarioScorecard {
  const verdicts: CriterionVerdict[] = [
    scoreDiscoveryBeforeAnchor(state),
    scoreFirstWins(state),
    scoreNoCoercionGuardrails(state),
    scoreProbeOnce(state),
    scoreDecisionLogMapped(state),
    scoreNoFabricatedFacts(state, scenario),
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
