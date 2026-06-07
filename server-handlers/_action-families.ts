/* Month 2 PR-1 (PDF #28) — Action family taxonomy.
 *
 * The planner emits ~37 distinct actionKind literals today. Most of
 * them are siblings (variations on the same move shape) but the code
 * branches on the leaf string, so guardrails, telemetry, and reasoning
 * have to be re-attached one leaf at a time. Families give us a single
 * layer above the leaves where rules can attach once and cover every
 * sibling.
 *
 * THIS MODULE INTRODUCES THE TAXONOMY ONLY. No behavior change.
 *  - ActionFamily — the 11-family union.
 *  - KIND_TO_FAMILY — exhaustive map for every actionKind currently
 *    emitted by _next-action-planner.ts (audited 2026-06-07).
 *  - familyOf(kind) — runtime lookup; returns "unmapped" when a kind
 *    has no family yet (e.g. a new kind landed without taxonomy update).
 *  - isOfFamily(kind, family) — predicate for narrowing decision sites.
 *
 * Subsequent PRs (Month 2 PR-2+) will:
 *   - Route planner decisions through families first, leaf last.
 *   - Attach family-level guardrails (e.g. "no two pressure-leverage
 *     moves in a row") at one site instead of three.
 *   - Drive Month 3's replay harness by family signature, so PDF-audit
 *     regressions can be expressed as family sequences instead of
 *     brittle leaf-kind sequences.
 *
 * IMPORTANT: every new actionKind added to the planner MUST be added to
 * KIND_TO_FAMILY in the same PR. The "all-kinds-have-a-family" unit
 * test will fail loudly otherwise. */

/* The 11 families covering every actionKind in the planner today. */
export type ActionFamily =
  | "discovery-probe"
  | "anchor-set"
  | "anchor-defend"
  | "stall-tactic"
  | "pressure-leverage"
  | "competing-offer-handle"
  | "acknowledge-recover"
  | "recap-summary"
  | "sweetener-offer"
  | "answer-direct"
  | "terminal-close";

/* Full set as a runtime array for iteration / exhaustiveness checks. */
export const ACTION_FAMILIES: readonly ActionFamily[] = [
  "discovery-probe",
  "anchor-set",
  "anchor-defend",
  "stall-tactic",
  "pressure-leverage",
  "competing-offer-handle",
  "acknowledge-recover",
  "recap-summary",
  "sweetener-offer",
  "answer-direct",
  "terminal-close",
] as const;

/* Exhaustive mapping. Audited against `grep "actionKind:" server-handlers/`
 * on 2026-06-07. Keep alphabetical within each family for diff hygiene.
 *
 * When you add a new actionKind to the planner, add the (kind, family)
 * pair here in the same PR — the unit test below will otherwise fail. */
export const KIND_TO_FAMILY: Readonly<Record<string, ActionFamily>> = {
  /* discovery-probe — surface-level information requests. */
  "ctc-ask": "discovery-probe",
  "currentCtcAsked": "discovery-probe",
  "discovery-probe": "discovery-probe",
  "noticePeriodAsked": "discovery-probe",

  /* anchor-set — opening or re-anchoring with a number on the table. */
  "anchor-with-offer": "anchor-set",
  "band-anchor-with-rationale": "anchor-set",
  "calibrated-surprise-lowball": "anchor-set",
  "comparative-anchoring": "anchor-set",

  /* anchor-defend — holding the anchor against candidate pressure. */
  "anchor-defense-hike-strong": "anchor-defend",
  "ctc-inflation-anchor": "anchor-defend",
  "ctc-inflation-truth": "anchor-defend",
  "internal-equity-defense": "anchor-defend",

  /* stall-tactic — buying time without committing. */
  "manager-consult-stall": "stall-tactic",
  "panel-approval-stall": "stall-tactic",
  "vague-promise": "stall-tactic",

  /* pressure-leverage — coercive moves; subject to family-level rate
   * limits in Month 2 PR-3. */
  "exploding-offer-pressure": "pressure-leverage",
  "fake-competing-candidate": "pressure-leverage",
  "fake-leverage-challenge": "pressure-leverage",
  "retention-trump-warning": "pressure-leverage",

  /* competing-offer-handle — responses when the candidate has another
   * offer on the table. */
  "acknowledge-existing-offer": "competing-offer-handle",
  "acknowledge-retention-offer": "competing-offer-handle",
  "competing-offer-warm-ack": "competing-offer-handle",
  "competitor-match": "competing-offer-handle",
  "match-existing-offer-prose": "competing-offer-handle",

  /* acknowledge-recover — repair moves after a misstep or contradiction. */
  "acknowledge-and-recover": "acknowledge-recover",
  "callback-prior-context": "acknowledge-recover",
  "clarify-prior-question": "acknowledge-recover",
  "contradiction-callout": "acknowledge-recover",

  /* recap-summary — turn-summarizing / phase-transition moves. */
  "close-recap-formal": "recap-summary",
  "paraphrase-recap": "recap-summary",
  "round-transition": "recap-summary",

  /* sweetener-offer — proactive concession outside the cash band. */
  "proactive-sweetener": "sweetener-offer",

  /* answer-direct — straight reply to a candidate question. */
  "answer-direct": "answer-direct",
  "reactive-followup": "answer-direct",

  /* terminal-close — session-ending moves. */
  "accept-lowball-quiet": "terminal-close",
  "polite-walkaway": "terminal-close",
  "post-acceptance-document-request": "terminal-close",
};

/* All actionKinds known to the taxonomy. Sorted for stable test output. */
export const KNOWN_ACTION_KINDS: readonly string[] = Object.keys(
  KIND_TO_FAMILY,
).sort();

/* Runtime lookup. Returns "unmapped" for any kind not in the table —
 * call sites can choose to log/throw on unmapped during the migration
 * window. Once Month 2 PR-2+ migrates the planner, "unmapped" should be
 * unreachable in production. */
export function familyOf(kind: string): ActionFamily | "unmapped" {
  return KIND_TO_FAMILY[kind] ?? "unmapped";
}

/* Predicate for narrowing decisions by family. Cheap, allocation-free. */
export function isOfFamily(kind: string, family: ActionFamily): boolean {
  return KIND_TO_FAMILY[kind] === family;
}

/* All actionKinds belonging to a given family. Used by tests and the
 * upcoming family-aware planner branches to enumerate alternatives. */
export function kindsInFamily(family: ActionFamily): string[] {
  return Object.entries(KIND_TO_FAMILY)
    .filter(([, f]) => f === family)
    .map(([k]) => k)
    .sort();
}
