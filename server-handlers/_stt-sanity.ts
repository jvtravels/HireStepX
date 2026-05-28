/* STT sanity gate (PDF#51 Fix 3 — 2026-05-28).
 *
 * Why this exists
 * ─────────────────────────────────────────────────────────────────
 * PDF#51 surfaced a class of failures where the user's audio was
 * garbled by speech-to-text into 1-3 character fragments (e.g. "m.",
 * "k. uh. m.", "ths") and the kernel happily folded it into the
 * conversation log, then asked the LLM to "respond" to nothing.
 * The LLM, lacking a real prompt, hallucinated — fabricating
 * concessions, repeating prior anchor numbers, or going off-topic.
 *
 * The architectural fix: detect obviously-garbled STT output BEFORE
 * the LLM call and short-circuit to a deterministic re-prompt
 * ("Sorry, I didn't catch that — could you say it again?"). The
 * kernel-state still advances (turnIndex must, otherwise a stuck
 * mic could spin indefinitely) but the LLM is never asked to
 * synthesize a response from noise.
 *
 * This is NOT a content classifier. It is shape-only: token count,
 * vowel presence, single-letter clusters. Anything that looks like
 * a real word (≥2 chars with a vowel, or a known short token like
 * "ok"/"yes"/"no") gets through to the regular planner.
 *
 * Strictness rationale: false-positives here cause one wasted turn
 * (the candidate repeats themselves), whereas false-negatives cause
 * the LLM-hallucination failure mode PDF#51 documents. We err
 * toward strict — only the most obvious garble shapes fire.
 */

export type SttGarblingReason =
  | "empty"
  | "no-tokens"
  | "no-word-tokens"
  | "single-letter-cluster"
  | "low-word-ratio"
  | null;

export interface SttGarblingResult {
  garbled: boolean;
  reason: SttGarblingReason;
}

const VOWEL_RE = /[aeiouAEIOU]/;
/* Legit short tokens that lack a vowel or are one char long but
 * are real candidate utterances. "a" and "i" are real English
 * words; "ok", "hi", "no", "yes", "yo", "ya", "um", "uh", "hm",
 * "mm" all show up in recruiter-side recordings as standalone
 * responses ("ok.", "yeah no."). Keep this set tight — adding to
 * it weakens the gate. */
const SHORT_LEGIT_RE = /^(?:a|i|ok|okay|hi|hm|hmm|mm|mmm|no|yes|yeah|yep|nope|yo|ya|um|uh|huh|sure|fine|right|maybe)$/i;

function looksLikeWord(token: string): boolean {
  if (SHORT_LEGIT_RE.test(token)) return true;
  if (token.length >= 2 && VOWEL_RE.test(token)) return true;
  return false;
}

export function detectSttGarbling(text: string): SttGarblingResult {
  const trimmed = (text || "").trim();
  if (trimmed.length === 0) return { garbled: true, reason: "empty" };

  /* Tokenize on whitespace + punctuation so "m. uh. k." splits
   * into ["m", "uh", "k"] — that shape is the signature STT-
   * garble cluster we're targeting. */
  const tokens = trimmed
    .split(/[\s,.;:!?\-—()\[\]"'/]+/)
    .filter(Boolean);
  if (tokens.length === 0) return { garbled: true, reason: "no-tokens" };

  const wordy = tokens.filter(looksLikeWord);
  if (wordy.length === 0) return { garbled: true, reason: "no-word-tokens" };

  /* Single-letter cluster: 3+ standalone non-{a,i} chars indicates
   * the STT engine dropped most of the audio. "m. k. uh." passes
   * this check (uh is wordy) but "m. k. b." does not — and that
   * second shape is the failure mode. */
  const singles = tokens.filter((t) => t.length === 1 && !/^[ai]$/i.test(t));
  if (singles.length >= 3 && wordy.length <= singles.length) {
    return { garbled: true, reason: "single-letter-cluster" };
  }

  /* Short text where most tokens fail the word-shape test. The
   * 25-char cap keeps this from firing on legitimate sentence
   * fragments — by 26+ chars a real utterance has enough word
   * tokens to clear the 50% ratio bar. */
  if (trimmed.length <= 25 && wordy.length / tokens.length < 0.5) {
    return { garbled: true, reason: "low-word-ratio" };
  }

  return { garbled: false, reason: null };
}

/* Deterministic re-prompt prose. Matches the conversational
 * register of the surrounding recruiter dialogue (first-person
 * apology, plain ask, no exclamation). */
export function sttRepromptResponse(): string {
  return "Sorry, I didn't catch that clearly. Could you say that again?";
}
