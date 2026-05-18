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
 *  cue. Live planner uses this to promote `acknowledge-and-recover` to
 *  the top of the cascade.
 *
 *  PDF#30 broadening (2026-05-18) — every cue in this regex maps to a
 *  candidate phrasing actually observed in the Meesho/Prita session:
 *    T5  "already told you 24 LPA CTC"          (no leading "i")
 *    T9  "why are you repeating the question?"
 *    T15 "I have told you multiple times..."    (not "already told")
 *    T17 "but why do you want justification on my current CTC"
 *
 *  Conservative still — each alt requires a verb that pins the
 *  candidate complaining about repetition / re-asking; no bare cues
 *  like "I said" or "told you" alone (false-positive risk on normal
 *  disclosure).
 */
export const USER_FRUSTRATION_RE = new RegExp(
  [
    // "I already told you" / "I have told you" / "I told you (already|multiple times|before)" / "already told you" (no leading "i", PDF#30 T5)
    String.raw`(?:\bi\s+)?(?:have\s+|already\s+)?told\s+you(?:\s+(?:already|multiple\s+times|before|many\s+times|so\s+many\s+times))?`,
    // "you keep asking" / "you keep repeating"
    String.raw`\byou\s+keep\s+(?:asking|repeating)`,
    // "I just said"
    String.raw`\bi\s+just\s+said\b`,
    // "we covered this" / "we discussed this"
    String.raw`\bwe\s+(?:covered|discussed)\s+this`,
    // "asked and answered"
    String.raw`\basked\s+(?:and\s+)?answered`,
    // "as I mentioned" / "as I said" / "like I said" / "I repeat"
    String.raw`\b(?:as|like)\s+i\s+(?:mentioned|said|stated|told\s+you)\b`,
    String.raw`\bi\s+repeat\b`,
    // PDF#30 T9 — "why are you repeating the question?" / "why are you asking again?"
    String.raw`\bwhy\s+(?:are\s+you|do\s+you|you)\s+(?:repeat(?:ing)?|ask(?:ing)?\s+(?:again|the\s+same|me\s+(?:again|the\s+same))|keep\s+(?:asking|repeating))`,
    // PDF#30 T17 — "but why do you want justification on my current CTC" —
    // the candidate questioning the bot's premise after already disclosing.
    String.raw`\bwhy\s+do\s+you\s+(?:want|need)\s+(?:justification|to\s+(?:ask|know))`,
    // "multiple times" / "many times" as standalone qualifier when paired
    // with "told"/"said" (handled by the first alt above) — also catch
    // bare "i said this (already|multiple times)" without "told".
    String.raw`\bi\s+said\s+(?:this\s+)?(?:already|multiple\s+times|many\s+times|before)`,
  ].join("|"),
  "i",
);
