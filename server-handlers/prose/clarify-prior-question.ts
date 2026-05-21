/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * PDF#34 Fix 3 (2026-05-18) — clarification response.
 *
 * The candidate asked "what is that?" / "huh?" / "what does X mean?"
 * about a term the bot just used. Real recruiters answer the
 * comprehension question inline before re-asking — they NEVER
 * deflect with "this conversation is about Senior Product Designer
 * at Meesho" (the PDF#34 persona-break).
 *
 * The prose surface scans the prior AI text for known jargon terms
 * (vesting, ESOP, RSU, OTE, base/variable split, hike, notice
 * period) and emits a plain-English definition plus a re-asked
 * question. When no recognized term is found, ships a generic "let
 * me rephrase" recovery.
 *
 * Number-free; required token "let me" / "rephrase" / "mean" pins
 * the clarification semantics so the contract validator can confirm
 * the restyle didn't drop the clarification intent.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { ProseHelpers } from "./_helpers";

export function proseClarifyPriorQuestion(
  action: NextAction,
  _state: NegotiationState,
  _helpers: ProseHelpers,
): string {
  if (action.kind !== "clarify-prior-question") {
    throw new Error("proseClarifyPriorQuestion invoked for non-clarify-prior-question action");
  }
  const prior = (action.priorAiText || "").toLowerCase();
  if (/\bvest(?:ing|ed)?\b/.test(prior)) {
    return "Sorry, let me clarify — vesting is the schedule on which equity grants become yours over time. Most grants vest over 4 years with a 1-year cliff. Does your current package have any ESOPs or RSUs?";
  }
  if (/\b(?:esops?|rsus?|equity|stocks?|grants?)\b/.test(prior)) {
    return "Sorry, let me clarify — ESOPs / RSUs are stock options or restricted stock that the company grants on top of cash. They vest over time. Do you currently have anything like that in your package?";
  }
  if (/\b(?:base|fixed)\s+(?:split|salary|pay|component)\b/.test(prior) || /\bbase\s+split\b/.test(prior)) {
    return "Sorry, let me clarify — by base split I mean the fixed-salary portion of your CTC versus the variable / bonus piece. Of your current ₹X LPA total, how much is the fixed base?";
  }
  if (/\bvariable\b/.test(prior)) {
    return "Sorry, let me clarify — variable means the performance-linked bonus paid out on top of your fixed base. How is yours structured today — fixed-target bonus, or fully performance-linked?";
  }
  if (/\bnotice\s+period\b/.test(prior)) {
    return "Sorry, let me clarify — notice period is how long you'd need to serve before you can join us, per your current company's policy. How many days is yours?";
  }
  if (/\b(?:ote|on-target\s+earnings|commission)\b/.test(prior)) {
    return "Sorry, let me clarify — OTE is on-target earnings: base plus full target commission if you hit 100% of quota. What's your current OTE?";
  }
  if (/\bhike\b/.test(prior)) {
    return "Sorry, let me clarify — by hike I mean the percentage increase over your current CTC that you're hoping for. What number are you targeting?";
  }
  /* Generic fallback — restate without the jargon. */
  return "Sorry, let me rephrase that. Could you share a bit more about what you'd like me to explain — I want to make sure we're on the same page before moving forward.";
}
