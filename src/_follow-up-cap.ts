/* HireStepX — Follow-up insertion cap
 *
 * Pure function — answers "should I let this follow-up be inserted?"
 * based on how many turns the script already has. Stops follow-ups
 * from stretching a 3-question mini session into 6+ turns (QA bug 21).
 *
 * Cap formula: baseQuestionCount + ceil(baseQuestionCount × 0.5).
 * So 3 base → max 5 turns, 5 base → max 8, 10 base → max 15. Generous
 * enough for 1-2 high-value probes per question without unbounded
 * growth. The depth-≤2 gate inside the engine still applies as the
 * inner constraint (no 3-deep follow-up chains).
 *
 * See src/__tests__/followUpCap.test.ts.
 */

export interface FollowUpCapInput {
  /** All script steps so far, including the original questions. */
  script: ReadonlyArray<{ type: string }>;
}

export interface FollowUpCapResult {
  /** True iff inserting a follow-up at this point would NOT exceed the cap. */
  allowed: boolean;
  /** Current turn count (questions + follow-ups). */
  currentTurns: number;
  /** Maximum total turns allowed for this script's base size. */
  maxTurns: number;
}

export function checkFollowUpCap(input: FollowUpCapInput): FollowUpCapResult {
  const baseCount = input.script.filter(s => s.type === "question").length;
  const turnCount = input.script.filter(s => s.type === "question" || s.type === "follow-up").length;
  const maxTurns = baseCount + Math.ceil(baseCount * 0.5);
  return {
    allowed: turnCount < maxTurns,
    currentTurns: turnCount,
    maxTurns,
  };
}
