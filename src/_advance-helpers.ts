/* HireStepX — handleNextQuestion helpers
 *
 * Pure functions extracted from useInterviewEngine.ts handleNextQuestion()
 * — the central transition function that runs when the user finishes an
 * answer. Lifting these out lets us unit-test the branchy logic in
 * isolation and shrinks the orchestration callback to roughly half its
 * previous size.
 *
 * Anything in this file MUST be pure (no React hooks, no DOM, no globals
 * other than Math/Date/regex). The engine still owns ALL side effects:
 * setState, refs, fetches, navigation. This file just shapes the
 * inputs into outputs.
 */

import type { NegotiationPhase } from "./_negotiation-state";

/* ─── Repeat-question detection ─────────────────────────────────────
   "Sorry, can you repeat that?" — when the candidate's only utterance
   is a request to re-hear the question, the engine re-speaks instead
   of treating it as a (very short, low-quality) answer. Real interviews
   do this naturally; HireStepX shouldn't punish it. */
const REPEAT_PRIMARY_PAT = /^(?:sorry,?\s+)?(?:can you|could you|please)?\s*(?:repeat|say|ask)\s*(?:that|the\s+question|it|again)?(?:\s+please)?\s*\??$/i;
const REPEAT_ALT_PAT = /^(?:one more time|come again|say (?:that )?again|i didn'?t (?:hear|catch) (?:that|you))\s*\??$/i;
const REPEAT_MAX_LEN = 60;

export function isRepeatRequest(rawTranscript: string): boolean {
  if (!rawTranscript || rawTranscript.length >= REPEAT_MAX_LEN) return false;
  return REPEAT_PRIMARY_PAT.test(rawTranscript) || REPEAT_ALT_PAT.test(rawTranscript);
}

/* ─── Adaptive difficulty trend ─────────────────────────────────────
   The follow-up LLM uses this signal to escalate or ease up based on
   how the candidate is actually performing this session. Quality
   scores are 1-5 per answer; we look at the rolling last-3 average. */
export type AdaptiveDifficulty = "escalate" | "ease" | "hold";

export function computeAdaptiveDifficulty(recentAnswerScores: number[]): AdaptiveDifficulty {
  const sample = recentAnswerScores.slice(-3);
  if (sample.length < 2) return "hold";
  const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
  if (avg >= 4) return "escalate";
  if (avg <= 2) return "ease";
  return "hold";
}

/* ─── Conversation-history payload builder ──────────────────────────
   Builds the "what was discussed earlier" string that the follow-up
   LLM uses for cross-question continuity. Filters out thinking phrases
   ("Hmm, okay") and bracketed system notes ("[Answer recorded]") so
   the LLM sees only meaningful Q&A exchanges. Salary-negotiation gets
   longer excerpts because every ₹ number and "competing offer" matters. */
const THINKING_PHRASE_RE = /^(Hmm|Let me|Okay|Alright|Interesting|I see|Good|That's|Right|So,|Well,|Mm)/;
const THINKING_PHRASE_MAX_LEN = 40;

export interface TranscriptEntry { speaker: "ai" | "user"; text: string; time: string }

export function buildConversationHistory(input: {
  transcript: TranscriptEntry[];
  currentQuestionText: string;
  currentAnswerText: string;
  isSalaryNeg: boolean;
}): string {
  const { transcript, currentQuestionText, currentAnswerText, isSalaryNeg } = input;
  const qLimit = isSalaryNeg ? 250 : 150;
  const aLimit = isSalaryNeg ? 200 : 120;
  const lines: string[] = [];
  for (const t of transcript) {
    if (t.text.startsWith("[")) continue; // skip system notes
    if (t.speaker === "ai") {
      // Skip short thinking-phrase fillers
      if (t.text.length < THINKING_PHRASE_MAX_LEN && THINKING_PHRASE_RE.test(t.text)) continue;
      lines.push(`Q: ${t.text.slice(0, qLimit)}`);
    } else {
      lines.push(`A: ${t.text.slice(0, aLimit)}`);
    }
  }
  // Append the current exchange
  lines.push(`Q: ${currentQuestionText.slice(0, qLimit)}`);
  lines.push(`A: ${currentAnswerText.slice(0, aLimit)}`);
  /* Salary-neg keeps EVERY turn (typically 12-16 total) — every number
     and promise matters. Regular interviews keep last 20 to save tokens. */
  return (isSalaryNeg ? lines : lines.slice(-20)).join("\n");
}

/* ─── Negotiation phase coaching hint picker ────────────────────────
   At each phase transition in salary-negotiation, surface AT MOST ONE
   coaching tip — and only when the candidate is missing a known
   high-leverage move for that phase. The engine tracks which phases
   have already been hinted via a Set, passed in as `alreadyShown`. */
/* Mirror the relevant fields from interviewEvaluation.NegotiationFacts.
   We accept anything that has the fields we read so the engine can pass
   the rich object directly without an adapter. `candidateCounter` is a
   STRING (e.g. "25 LPA") in the source — we only check truthiness. */
export interface NegotiationFacts {
  candidateCounter?: string | null;
  deflectedNumbers?: boolean;
  topicsRaised: string[];
  hasCompetingOffers: boolean;
  mentionedBATNA: boolean;
  acceptedImmediately: boolean;
}

export function pickNegotiationCoachingHint(input: {
  phase: NegotiationPhase | undefined;
  facts: NegotiationFacts | undefined;
  alreadyShown: ReadonlySet<string>;
}): string | null {
  const { phase, facts, alreadyShown } = input;
  if (!phase || !facts) return null;
  if (alreadyShown.has(phase)) return null;
  /* POST-ACCEPTANCE GUARD (added 2026-Q2): once the candidate has
     accepted the offer, all active-negotiation tips become tone-deaf.
     The user is now in logistics/benefits-clarification mode, not
     negotiation mode. Suppress active-negotiation tips entirely; the
     "accepting too quickly" probe-expectations hint still fires
     because that's specifically about the acceptance moment and is
     useful learning post-session. */
  if (
    facts.acceptedImmediately &&
    phase !== "probe-expectations"
  ) {
    return null;
  }
  if (phase === "counter-offer" && !facts.candidateCounter && !facts.deflectedNumbers) {
    return "💡 Tip: Name a specific number — candidates who anchor first tend to get better outcomes.";
  }
  if (phase === "benefits-discussion" && facts.topicsRaised.length === 0) {
    return "💡 Tip: Ask about equity, joining bonus, or flexibility — total package often matters more than base.";
  }
  if (phase === "closing-pressure" && !facts.hasCompetingOffers && !facts.mentionedBATNA) {
    return "💡 Tip: Mentioning competing offers or alternatives gives you stronger leverage at closing.";
  }
  if (phase === "probe-expectations" && facts.acceptedImmediately) {
    return "💡 Tip: Accepting too quickly leaves value on the table. Try countering or exploring the full package first.";
  }
  return null;
}

/* ─── Recent follow-ups extractor ───────────────────────────────────
   The follow-up LLM also gets a small window of "what we just probed
   on" so it doesn't repeat itself.

   Two-tier output (refined 2026-Q2):
     • Verbatim window: last N follow-ups in full (high-fidelity, for
       phrasing variation).
     • Transcript-wide opener fingerprints: ALL prior follow-ups (and
       script questions) compressed to their first 6 normalised words.
       Catches the "same probe re-emerges 6 turns later" failure mode
       where the verbatim window had already rotated past the original.

   The fingerprint set is appended as an explicit "DO-NOT-REASK
   OPENERS" block so the LLM can't accidentally rephrase its way back
   to the same probe. */
export function extractRecentFollowUps(input: {
  script: { type: string; aiText: string }[];
  currentStep: number;
  currentAnswerText: string;
  windowBack?: number;
}): string[] {
  const { script, currentStep, currentAnswerText, windowBack = 6 } = input;
  const out: string[] = [];
  /* Transcript-wide opener fingerprints come FIRST so consumers that
     append the candidate's answer can still rely on it being the
     last element of the array. */
  const seen = new Set<string>();
  const fingerprints: string[] = [];
  for (let i = 0; i <= currentStep; i++) {
    const s = script[i];
    if (!s) continue;
    if (s.type !== "follow-up" && s.type !== "question") continue;
    const fp = fingerprintOpener(s.aiText);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    fingerprints.push(fp);
  }
  if (fingerprints.length > 0) {
    out.push(
      `DO-NOT-REASK OPENERS (you have already asked these — do NOT rephrase your way back to them, even if the candidate's answer was thin):\n  - ${fingerprints.join("\n  - ")}`,
    );
  }
  for (let i = Math.max(0, currentStep - windowBack); i <= currentStep; i++) {
    const s = script[i];
    if (s?.type === "follow-up") out.push(`Q: ${s.aiText}`);
  }
  if (currentAnswerText) out.push(`A: ${currentAnswerText}`);
  return out;
}

/* Normalise a question opener to its essential probe shape. Strips
   filler words, punctuation, casing, and keeps the first ~6 content
   words. This is the dedup key for transcript-wide repetition checks. */
function fingerprintOpener(text: string): string {
  if (!text) return "";
  const filler = new Set([
    "i", "you", "your", "the", "a", "an", "to", "of", "in", "for", "on",
    "and", "or", "but", "so", "is", "are", "was", "were", "be", "do",
    "does", "did", "have", "has", "had", "would", "could", "should",
    "may", "might", "shall", "will", "can", "this", "that", "it",
    "us", "we", "me", "my", "their", "his", "her", "its", "our",
    "let", "lets", "tell", "share", "what", "how", "why", "when",
    "where", "which", "well", "now", "ok", "great", "thanks", "first",
  ]);
  const normalised = text
    .toLowerCase()
    .replace(/\[(?:pause|pause:long|emphasis)[^\]]*\]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalised.split(" ").filter(w => w && !filler.has(w));
  return words.slice(0, 6).join(" ");
}
