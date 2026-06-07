/* Month 2 PR-5 (PDF #28) — decision-log telemetry readers.
 *
 * Pure functions that consumers (debug panel, Month 3 replay harness,
 * audit tooling) use to query the decisionLog without poking the raw
 * array shape. Keeps the readers in one place so the log schema
 * (extended in M2 PR-3 with actionKind / family / guardrailFlags) can
 * evolve without rippling through every consumer.
 *
 * Why a dedicated module instead of methods on the kernel:
 *   - The kernel writes the log (pickAiMove), this module READS it.
 *     Separating writers from readers means the readers can be imported
 *     by UI code, replay tooling, and tests without dragging in the
 *     full kernel surface.
 *   - All functions are pure and total — they accept a potentially
 *     missing decisionLog and return sensible empties.
 *
 * Public surface (audited 2026-06-07):
 *   - recentGuardrailFlags(state, n) — last N entries' flags, newest first
 *   - countGuardrailFlag(state, flag) — total occurrences of a flag
 *   - lastFamilyEmitted(state) — most recent stamped family or null
 *   - guardrailFlagSummary(state) — flag → count map over the session
 *
 * Month 3's replay harness will use countGuardrailFlag to assert
 * regressions like:
 *   "PDF#34 replay should produce 0 pressure-repeat flags." */

import type { NegotiationState } from "./_negotiation-kernel";
import type { ActionFamily } from "./_action-families";

/* Internal — the decisionLog entry shape mirrors the kernel's
 * inline type. Kept narrow so a kernel schema change forces an
 * explicit update here. */
type LogEntry = {
  turn: number;
  picker: string;
  rationale: string;
  phase: NegotiationState["phase"];
  briefTags?: string[];
  actionKind?: string;
  family?: ActionFamily | "unmapped";
  guardrailFlags?: string[];
};

function readLog(state: NegotiationState): readonly LogEntry[] {
  return (state.decisionLog ?? []) as readonly LogEntry[];
}

/** Returns the guardrail flags from the most recent `n` decision-log
 *  entries, in newest-first order, flattened into one array. Empty
 *  array when no entries or no flags. Each flag string is namespaced
 *  by rule (e.g. "pressure-repeat", "stall-cascade") so consumers can
 *  filter by prefix if rule families grow. */
export function recentGuardrailFlags(
  state: NegotiationState,
  n: number = 5,
): string[] {
  if (n <= 0) return [];
  const log = readLog(state);
  const slice = log.slice(-n).reverse();
  const out: string[] = [];
  for (const entry of slice) {
    if (entry.guardrailFlags && entry.guardrailFlags.length > 0) {
      out.push(...entry.guardrailFlags);
    }
  }
  return out;
}

/** Total count of `flag` across every entry in the decision log.
 *  Useful for replay-harness assertions like
 *  `expect(countGuardrailFlag(state, "pressure-repeat")).toBe(0)`. */
export function countGuardrailFlag(
  state: NegotiationState,
  flag: string,
): number {
  let total = 0;
  for (const entry of readLog(state)) {
    if (entry.guardrailFlags?.includes(flag)) total++;
  }
  return total;
}

/** Returns the family of the most recently emitted move. Null when
 *  the log is empty or the last entry has no family stamped (which
 *  only happens for legacy entries written before M2 PR-3). */
export function lastFamilyEmitted(
  state: NegotiationState,
): ActionFamily | "unmapped" | null {
  const log = readLog(state);
  if (log.length === 0) return null;
  return log[log.length - 1].family ?? null;
}

/** Returns a flag → count map across the entire session. Useful for
 *  session-end summaries ("this session triggered 3 stall-cascade,
 *  1 pressure-repeat") and replay assertions over multiple rules. */
export function guardrailFlagSummary(
  state: NegotiationState,
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const entry of readLog(state)) {
    if (!entry.guardrailFlags) continue;
    for (const flag of entry.guardrailFlags) {
      summary[flag] = (summary[flag] ?? 0) + 1;
    }
  }
  return summary;
}
