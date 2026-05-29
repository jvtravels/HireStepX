/* Extracted from `_canonical-prose.ts` (2026-05-29 realism-pass P0-1
 * audit follow-up).
 *
 * Pre-extract the planner-level `humanizeRecruiterProse` call inlined
 * `state.candidateName.trim().split(/\s+/)[0]` to thread the proper-noun
 * guard. That duplicated the conversation-log fallback that lived inside
 * `getCandidateFirstName` in canonical-prose. Both call sites now route
 * through this single helper so a "what counts as a name" change happens
 * in one place.
 *
 * Pure. No clock, no IO.
 */

import type { NegotiationState } from "./_negotiation-kernel";

/** Best-effort first-name extraction. Prefers the typed
 *  `state.candidateName` field (threaded from intake) and falls back
 *  to scanning the conversation log for an "I'm X" / "my name is X"
 *  signature when no name was passed in. Returns null when neither
 *  source yields a name — caller substitutes a generic fallback. */
export function getCandidateFirstName(state: NegotiationState): string | null {
  /* Preferred: typed init field from intake. Kernel-first cleanup
   * (2026-05-16). */
  if (state.candidateName && state.candidateName.trim().length > 0) {
    const first = state.candidateName.trim().split(/\s+/)[0];
    if (first && first.length <= 20) return first;
  }
  /* Fallback: scan conversation log. Some sessions deserialize without a
   * candidateName (legacy state) or the candidate introduces themselves
   * mid-flow. */
  const log = state.conversationLog ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e && e.speaker === "candidate") {
      const m = e.text?.match(/\b(?:I['’]?m|my name is|this is)\s+([A-Z][a-z]+)\b/);
      if (m && m[1].length <= 20) return m[1];
    }
  }
  return null;
}
