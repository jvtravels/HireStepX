/* User-signal lexicon (PDF#29 Bug 7, 2026-05-18).
 *
 * Single source of truth for detecting that the candidate is signalling
 * frustration / "you're looping on a topic I already answered". Pre-
 * existing code lived only in the post-session analyzer (which fires
 * AFTER the call is over); the live planner had no consumer, so the
 * bot could ride out a candidate visibly repeating themselves three
 * times. This module exposes the regex so the kernel can fold the
 * frustration signal into NegotiationState and the planner can
 * promote `acknowledge-and-recover` to the highest-priority lever.
 *
 * Pure. No clock, no IO.
 */

/** True when the candidate's last utterance contains a frustration
 *  cue ("I already told you my CTC is 18", "you keep asking", "I just
 *  said", "we covered this", "asked and answered"). Conservative —
 *  the live planner only fires the recover lever when this matches;
 *  false positives interrupt the negotiation, so the cue list is
 *  deliberately narrow. */
export const USER_FRUSTRATION_RE =
  /\b(?:i\s+already\s+told\s+you|you\s+keep\s+asking|i\s+just\s+said|we\s+(?:covered|discussed)\s+this|asked\s+(?:and\s+)?answered)\b/i;
