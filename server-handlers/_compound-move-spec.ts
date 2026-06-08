/* ARCH-C2b (2026-06-08) — CompoundMoveSpec.
 *
 * The response pipeline has two sites where a candidate-facing turn
 * is built by concatenating two prose fragments:
 *
 *   1. `_response-pipeline.ts:929` — FACT_GROUNDING_HEDGE + planner
 *      canonical pivot (when the LLM answer hallucinated a non-numeric
 *      fact AND the planner picked a sequence-critical action).
 *   2. `_response-pipeline.ts:998` — LLM answer + planner canonical
 *      pivot (when the candidate asked a question AND the planner
 *      picked a sequence-critical action).
 *
 * Both sites use `composeAnswerWithPivot` (a one-line string join).
 * That has no notion of *frame compatibility*: the fragments may
 * contradict each other and produce incoherent prose. Examples:
 *
 *   - HEDGE("Let me confirm with my hiring manager — I'll revert")
 *     + CLOSE-RECAP("Let me recap the fitment before I revert internally
 *       — Fixed ₹20L, variable target ₹4L, ... I'll get the offer letter
 *       prepared and circulate by EOD.")
 *     → recruiter both defers AND closes in the same turn.
 *
 *   - HEDGE(...) + COMMIT-REQUIRING counter-offer ("We've already moved on
 *     fitment once. Let me see what's possible at this stage.")
 *     → recruiter both defers AND counters in the same turn.
 *
 * CompoundMoveSpec is a constructor-validated pair. Construct with
 * (answerFrame, pivotFrame, answerText, pivotText). The constructor
 * throws on any pair in `INCOMPATIBLE_FRAME_PAIRS` so the caller is
 * forced to handle the refusal — either ship the pivot alone (planner's
 * escalation wins) or downgrade the answer to a neutral surface.
 *
 * This is the second hard-gate in the MoveSpec architecture (the first
 * was `closeRecapFormalToMoveSpec` throwing without verbalAcceptanceTurn).
 * Same pattern: invariants live in constructors, not in downstream
 * regex / validator checks.
 */

import type { NextAction } from "./_next-action-planner";

/** Frame stance of the answer fragment (first half of the compound). */
export type AnswerFrame =
  /* Plain LLM answer to a candidate question. No deferral, no hedge. */
  | "neutral"
  /* Defer-shaped answer: "let me check / I'll revert / coming back to you". */
  | "defer"
  /* Fact-grounding hedge: "let me confirm with the hiring manager".
   *  Distinct from defer because hedge is a SAFETY substitution when
   *  the LLM hallucinated a fact — the candidate's question wasn't
   *  refused, the answer was redacted. */
  | "hedge";

/** Frame stance of the pivot fragment (second half — planner's escalation). */
export type PivotFrame =
  /* Discovery / info-gathering / softer probe. Composable with anything. */
  | "neutral"
  /* Formal close: "let me recap the fitment ... offer letter by EOD". */
  | "close-recap"
  /* Commit-requiring: anchor / counter / band-anchor / open-with-offer
   *  — anything that puts a NUMBER on the table the candidate is
   *  expected to react to this turn. */
  | "commit-requiring";

/** Forbidden (answer, pivot) pairs. The constructor throws on a match. */
const INCOMPATIBLE_FRAME_PAIRS: ReadonlySet<`${AnswerFrame}|${PivotFrame}`> =
  new Set([
    /* Hedge ("let me check with hiring manager") cannot share a turn
     * with a formal close — you don't recap fitment while simultaneously
     * deferring to your boss. */
    "hedge|close-recap",
    /* Hedge cannot share a turn with a number-on-the-table commit —
     * deferring AND anchoring in the same breath telegraphs that the
     * anchor isn't real. */
    "hedge|commit-requiring",
    /* Defer ("I'll come back to you") cannot share a turn with a close —
     * if you're closing today you're not coming back tomorrow. */
    "defer|close-recap",
    /* Defer cannot share a turn with a commit-requiring anchor for the
     * same reason as hedge — undermines the anchor's force. */
    "defer|commit-requiring",
  ]);

/** Map a NextAction kind to its pivot frame class. Lives here (not on
 *  the action itself) because the action type union is shared with the
 *  legacy planner and we don't want to retrofit frame fields onto every
 *  variant. Centralized lookup is auditable. */
export function classifyPivotByAction(action: NextAction): PivotFrame {
  switch (action.kind) {
    case "close-recap-formal":
      return "close-recap";
    case "counter-offer":
    case "anchor-with-offer":
    case "band-anchor-with-rationale":
    case "open-with-offer":
    case "comparative-anchoring":
    case "calibrated-surprise-lowball":
      return "commit-requiring";
    default:
      return "neutral";
  }
}

/** Refusal raised by CompoundMoveSpec's constructor. Callers catch
 *  this, log telemetry, and ship the pivot alone. */
export class IncompatibleCompoundFrameError extends Error {
  readonly answerFrame: AnswerFrame;
  readonly pivotFrame: PivotFrame;
  constructor(answerFrame: AnswerFrame, pivotFrame: PivotFrame) {
    super(
      `CompoundMoveSpec refused: ${answerFrame} + ${pivotFrame} produces ` +
        `contradictory frames in a single turn.`,
    );
    this.name = "IncompatibleCompoundFrameError";
    this.answerFrame = answerFrame;
    this.pivotFrame = pivotFrame;
  }
}

/** Constructor-validated compound. `render()` returns the joined prose
 *  (current behavior preserved — same join as `composeAnswerWithPivot`)
 *  but the construction itself enforces the compatibility matrix. */
export class CompoundMoveSpec {
  readonly answerFrame: AnswerFrame;
  readonly pivotFrame: PivotFrame;
  readonly answerText: string;
  readonly pivotText: string;

  constructor(
    answerFrame: AnswerFrame,
    pivotFrame: PivotFrame,
    answerText: string,
    pivotText: string,
  ) {
    if (INCOMPATIBLE_FRAME_PAIRS.has(`${answerFrame}|${pivotFrame}`)) {
      throw new IncompatibleCompoundFrameError(answerFrame, pivotFrame);
    }
    this.answerFrame = answerFrame;
    this.pivotFrame = pivotFrame;
    this.answerText = answerText;
    this.pivotText = pivotText;
  }

  /** Same join shape `composeAnswerWithPivot` used: trim the answer,
   *  force a terminal period, single space, pivot. */
  render(): string {
    const trimmed = this.answerText.trim().replace(/[.!?]*$/, ".");
    const pivot = this.pivotText.trim();
    if (!pivot) return trimmed;
    return `${trimmed} ${pivot}`;
  }
}

/** Pure introspection for tests / callers that want to ask "would this
 *  pair throw?" without actually constructing. */
export function isCompoundCompatible(
  answerFrame: AnswerFrame,
  pivotFrame: PivotFrame,
): boolean {
  return !INCOMPATIBLE_FRAME_PAIRS.has(`${answerFrame}|${pivotFrame}`);
}
